import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  API_ERROR_CODES,
  dAdd,
  dMul,
  type PartnerSettlementGenerateInput,
  type PartnerSettlementUpdateInput,
} from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { paginate } from '../common/api-response';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Réconciliation des commissions dues aux partenaires de livraison —
 * addendum 08, §5. Le rapprochement agrège les colis `LIVRE` d'un partenaire
 * livrés sur la période ; le détail (liste des colis inclus) est recalculé à
 * la demande à partir des mêmes critères plutôt que persisté dans une table
 * de liaison dédiée (non prévue par l'addendum) — une régularisation après
 * génération (correction de colis, litige) doit donc passer par une nouvelle
 * génération plutôt que par une modification manuelle du brouillon.
 */
@Injectable()
export class PartnerSettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(params: { deliveryPartnerId?: string; periodStart?: string; periodEnd?: string }, page = 1, limit = 20) {
    const where: Prisma.PartnerSettlementWhereInput = {
      deliveryPartnerId: params.deliveryPartnerId ?? undefined,
      periodStart: params.periodStart ? { gte: new Date(params.periodStart) } : undefined,
      periodEnd: params.periodEnd ? { lte: new Date(params.periodEnd) } : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.partnerSettlement.findMany({
        where,
        include: { deliveryPartner: true },
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.partnerSettlement.count({ where }),
    ]);
    return paginate(rows.map(toSummaryDto), total, page, limit);
  }

  async get(id: string) {
    const s = await this.prisma.partnerSettlement.findUnique({
      where: { id },
      include: { deliveryPartner: true },
    });
    if (!s) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Règlement introuvable' } });
    }
    const parcels = await this.includedParcels(s.deliveryPartnerId, s.periodStart, s.periodEnd);
    return {
      ...toSummaryDto(s),
      parcels: parcels.map((p) => ({
        id: p.id,
        trackingNumber: p.trackingNumber,
        weightKg: p.weightKg.toString(),
        amountPaid: p.amountPaid.toString(),
        billingCurrency: p.billingCurrency,
        deliveredAt: p.deliveredAt?.toISOString() ?? null,
      })),
    };
  }

  private includedParcels(deliveryPartnerId: string, periodStart: Date, periodEnd: Date) {
    return this.prisma.parcel.findMany({
      where: {
        deliveryPartnerId,
        status: 'LIVRE',
        deliveredAt: { gte: periodStart, lte: endOfDay(periodEnd) },
      },
      orderBy: { deliveredAt: 'asc' },
    });
  }

  /**
   * Génère (ou régénère) le brouillon de règlement pour un partenaire sur une
   * période — addendum 08, §5.3. `PER_KG` : somme(poids × prix/kg du tarif
   * partenaire actif à la date de livraison). `PERCENT_COLLECTED` :
   * commissionPct × montant encaissé. Devise du règlement = celle du tarif
   * partenaire actif (limite v1 : suppose un partenaire facturé dans une
   * devise unique).
   */
  async generate(input: PartnerSettlementGenerateInput, user: CurrentUser, requestId?: string | null) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: input.deliveryPartnerId } });
    if (!partner) {
      throw new BadRequestException({ error: { code: API_ERROR_CODES.VALIDATION, message: 'Partenaire introuvable' } });
    }
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (periodEnd < periodStart) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: 'periodEnd doit être postérieure à periodStart' },
      });
    }

    const overlapping = await this.prisma.partnerSettlement.findFirst({
      where: {
        deliveryPartnerId: input.deliveryPartnerId,
        status: { in: ['VALIDATED', 'PAID'] },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    });
    if (overlapping) {
      throw new BadRequestException({
        error: {
          code: API_ERROR_CODES.CONFLICT,
          message: `Période déjà couverte par un règlement ${overlapping.status} (${overlapping.id}) — les colis livrés sur cette période ont déjà été réglés. Utilisez une période distincte ou traitez la correction séparément.`,
        },
      });
    }

    const parcels = await this.includedParcels(input.deliveryPartnerId, periodStart, periodEnd);

    let totalCollected = '0';
    let commission = '0';
    let currency = 'USD';

    if (partner.settlementMode === 'PERCENT_COLLECTED') {
      const pct = partner.commissionPct?.toString() ?? '0';
      for (const p of parcels) {
        totalCollected = dAdd(totalCollected, p.amountPaid.toString());
        currency = p.billingCurrency;
      }
      commission = dMul(totalCollected, pct);
    } else {
      // PER_KG — utilise le tarif partenaire actif à la date de livraison de chaque colis.
      const tariffs = await this.prisma.partnerTariff.findMany({
        where: { deliveryPartnerId: input.deliveryPartnerId },
        orderBy: { effectiveFrom: 'desc' },
      });
      for (const p of parcels) {
        totalCollected = dAdd(totalCollected, p.amountPaid.toString());
        currency = p.billingCurrency;
        const at = p.deliveredAt ?? periodEnd;
        const applicable = tariffs.find(
          (t) => t.effectiveFrom <= at && (!t.effectiveTo || t.effectiveTo >= at),
        );
        if (applicable) {
          commission = dAdd(commission, dMul(applicable.pricePerKg.toString(), p.weightKg.toString()));
          currency = applicable.currencyCode;
        }
      }
    }

    const existing = await this.prisma.partnerSettlement.findFirst({
      where: { deliveryPartnerId: input.deliveryPartnerId, periodStart, periodEnd },
    });
    const data = {
      deliveryPartnerId: input.deliveryPartnerId,
      periodStart,
      periodEnd,
      parcelCount: parcels.length,
      totalCollectedAmount: totalCollected,
      commissionAmount: commission,
      currencyCode: currency,
      status: 'DRAFT' as const,
    };

    const settlement =
      existing && existing.status === 'DRAFT'
        ? await this.prisma.partnerSettlement.update({ where: { id: existing.id }, data })
        : await this.prisma.partnerSettlement.create({ data });

    await this.audit.record({
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'partner_settlement',
      entityId: settlement.id,
      actorUserId: user.id,
      requestId,
      after: { deliveryPartnerId: input.deliveryPartnerId, parcelCount: parcels.length, commission },
    });
    return { id: settlement.id };
  }

  async update(id: string, input: PartnerSettlementUpdateInput, user: CurrentUser, requestId?: string | null) {
    const before = await this.prisma.partnerSettlement.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Règlement introuvable' } });
    }
    if (before.status === 'PAID') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Un règlement payé ne peut plus être modifié' },
      });
    }
    if (before.status === 'DRAFT' && input.status !== 'VALIDATED') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Un brouillon doit être validé avant paiement' },
      });
    }

    const settlement = await this.prisma.partnerSettlement.update({
      where: { id },
      data: {
        status: input.status,
        validatedByUserId: input.status === 'VALIDATED' ? user.id : before.validatedByUserId,
        paidAt: input.status === 'PAID' ? new Date() : before.paidAt,
        paymentReference: input.paymentReference ?? before.paymentReference,
      },
    });

    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'partner_settlement',
      entityId: id,
      actorUserId: user.id,
      requestId,
      before: { status: before.status },
      after: { status: settlement.status, paymentReference: settlement.paymentReference },
    });
    return { id: settlement.id, status: settlement.status };
  }
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

function toSummaryDto(s: {
  id: string;
  deliveryPartnerId: string;
  deliveryPartner?: { name: string };
  periodStart: Date;
  periodEnd: Date;
  parcelCount: number;
  totalCollectedAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  currencyCode: string;
  status: string;
  paidAt: Date | null;
  paymentReference: string | null;
}) {
  return {
    id: s.id,
    deliveryPartnerId: s.deliveryPartnerId,
    deliveryPartnerName: s.deliveryPartner?.name ?? null,
    periodStart: s.periodStart.toISOString().slice(0, 10),
    periodEnd: s.periodEnd.toISOString().slice(0, 10),
    parcelCount: s.parcelCount,
    totalCollectedAmount: s.totalCollectedAmount.toString(),
    commissionAmount: s.commissionAmount.toString(),
    currency: s.currencyCode,
    status: s.status,
    paidAt: s.paidAt?.toISOString() ?? null,
    paymentReference: s.paymentReference,
  };
}
