import { Injectable } from '@nestjs/common';
import type { ParcelStatus } from '@prisma/client';
import { countryDisplayName, dAdd, dSub } from '@okapi/shared';
import type { CurrentUser } from '../auth/current-user';
import { parcelScopeWhere, paymentScopeWhere } from '../auth/scope';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from '../fx/fx.service';

export interface FinancialStatusQuery {
  periodStart?: string;
  periodEnd?: string;
}

interface AgencyRow {
  agencyId: string;
  agencyCode: string;
  agencyName: string;
  countryIso2: string;
  countryName: string;
  billingCurrency: string;
  parcelCount: number;
  byStatus: Record<string, number>;
  billed: string; // devise de référence (USD)
  collected: string;
  unpaid: string;
}

/**
 * État financier (facturé / encaissé / impayé) et état des colis, par
 * agence et global — W-ADM-01. Les montants agrégés utilisent
 * systématiquement la devise de référence (amountDueReference côté colis,
 * amountReference côté paiement) : seule façon de sommer across-agences
 * dont les devises de facturation diffèrent sans reconversion à la volée.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
  ) {}

  async financialStatus(query: FinancialStatusQuery, user: CurrentUser) {
    const dateFilter =
      query.periodStart || query.periodEnd
        ? {
            createdAt: {
              ...(query.periodStart ? { gte: new Date(query.periodStart) } : {}),
              ...(query.periodEnd ? { lte: new Date(`${query.periodEnd}T23:59:59.999Z`) } : {}),
            },
          }
        : {};

    const parcelWhere = { ...parcelScopeWhere(user), ...dateFilter };
    const paymentWhere = { ...paymentScopeWhere(user), ...dateFilter };

    const [statusCounts, billedByAgency, paymentsByAgency, agencies] = await Promise.all([
      this.prisma.parcel.groupBy({
        by: ['registrationAgencyId', 'status'],
        where: parcelWhere,
        _count: { _all: true },
      }),
      this.prisma.parcel.groupBy({
        by: ['registrationAgencyId'],
        where: parcelWhere,
        _sum: { amountDueReference: true },
      }),
      this.prisma.payment.groupBy({
        by: ['agencyId', 'state'],
        where: paymentWhere,
        _sum: { amountReference: true },
      }),
      this.prisma.agency.findMany({
        include: { country: true },
      }),
    ]);

    const agencyMap = new Map(agencies.map((a) => [a.id, a]));
    const rows = new Map<string, AgencyRow>();

    const ensureRow = (agencyId: string): AgencyRow => {
      let row = rows.get(agencyId);
      if (!row) {
        const agency = agencyMap.get(agencyId);
        row = {
          agencyId,
          agencyCode: agency?.code ?? '—',
          agencyName: agency?.name ?? 'Agence inconnue',
          countryIso2: agency?.country.iso2 ?? '—',
          countryName: agency ? countryDisplayName(agency.country.iso2, agency.country.nameKey) : '—',
          billingCurrency: agency?.billingCurrency ?? this.fx.referenceCurrency,
          parcelCount: 0,
          byStatus: {},
          billed: '0',
          collected: '0',
          unpaid: '0',
        };
        rows.set(agencyId, row);
      }
      return row;
    };

    for (const s of statusCounts) {
      const row = ensureRow(s.registrationAgencyId);
      const count = s._count._all;
      row.byStatus[s.status] = (row.byStatus[s.status] ?? 0) + count;
      row.parcelCount += count;
    }
    for (const b of billedByAgency) {
      const row = ensureRow(b.registrationAgencyId);
      row.billed = b._sum.amountDueReference?.toString() ?? '0';
    }
    for (const p of paymentsByAgency) {
      if (!p.agencyId) continue;
      const row = ensureRow(p.agencyId);
      const amount = p._sum.amountReference?.toString() ?? '0';
      if (p.state === 'CONFIRME') row.collected = dAdd(row.collected, amount);
      else if (p.state === 'REMBOURSE') row.collected = dSub(row.collected, amount);
    }
    for (const row of rows.values()) {
      row.unpaid = dSub(row.billed, row.collected);
    }

    const byAgency = [...rows.values()].sort((a, b) => a.agencyName.localeCompare(b.agencyName));

    const globalByStatus: Record<string, number> = {};
    let globalBilled = '0';
    let globalCollected = '0';
    let globalParcelCount = 0;
    for (const row of byAgency) {
      globalParcelCount += row.parcelCount;
      globalBilled = dAdd(globalBilled, row.billed);
      globalCollected = dAdd(globalCollected, row.collected);
      for (const [status, count] of Object.entries(row.byStatus)) {
        globalByStatus[status] = (globalByStatus[status] ?? 0) + count;
      }
    }

    const ALL_STATUSES: ParcelStatus[] = [
      'ENREGISTRE',
      'EN_TRANSIT',
      'ARRIVE',
      'HANDED_TO_PARTNER',
      'LIVRE',
      'ANNULE',
      'RETOURNE',
    ];
    for (const s of ALL_STATUSES) globalByStatus[s] ??= 0;

    return {
      currency: this.fx.referenceCurrency,
      global: {
        agencyCount: byAgency.length,
        parcelCount: globalParcelCount,
        byStatus: globalByStatus,
        billed: globalBilled,
        collected: globalCollected,
        unpaid: dSub(globalBilled, globalCollected),
      },
      byAgency,
    };
  }
}
