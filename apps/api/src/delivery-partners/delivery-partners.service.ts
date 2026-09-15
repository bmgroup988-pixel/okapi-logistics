import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  API_ERROR_CODES,
  countryDisplayName,
  humanizeNameKey,
  type CityCreateInput,
  type CityUpdateInput,
  type DeliveryPartnerUpsertInput,
  type PartnerTariffCreateInput,
} from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Administration du référentiel de villes (couverture réseau) et des
 * partenaires de livraison — addendum 08, §1.4-1.6.
 */
@Injectable()
export class DeliveryPartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* --------------------------------------------------------------- villes */
  async listCities() {
    const rows = await this.prisma.city.findMany({
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
      include: { country: true, _count: { select: { deliveryPartners: true, agencies: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      nameKey: c.nameKey,
      name: humanizeNameKey(c.nameKey),
      countryId: c.countryId,
      countryIso2: c.country.iso2,
      countryName: countryDisplayName(c.country.iso2, c.country.nameKey),
      timezone: c.timezone,
      status: c.status,
      isOrigin: c.isOrigin,
      isDestination: c.isDestination,
      isActive: c.isActive,
      deliveryPartnerCount: c._count.deliveryPartners,
      agencyCount: c._count.agencies,
    }));
  }

  async createCity(input: CityCreateInput, user: CurrentUser, requestId?: string | null) {
    const country = await this.prisma.country.findUnique({ where: { id: input.countryId } });
    if (!country) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: 'Pays introuvable' },
      });
    }
    const existing = await this.prisma.city.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: `Le code ville ${input.code} existe déjà` },
      });
    }
    const city = await this.prisma.city.create({
      data: {
        code: input.code,
        nameKey: input.nameKey,
        countryId: input.countryId,
        timezone: input.timezone,
        status: input.status,
        isOrigin: input.isOrigin,
        isDestination: input.isDestination,
      },
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'city',
      entityId: city.id,
      actorUserId: user.id,
      requestId,
      after: { code: city.code, status: city.status },
    });
    return { id: city.id };
  }

  async updateCity(id: string, input: CityUpdateInput, user: CurrentUser, requestId?: string | null) {
    const before = await this.prisma.city.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Ville introuvable' } });
    }
    const city = await this.prisma.city.update({
      where: { id },
      data: {
        status: input.status ?? undefined,
        nameKey: input.nameKey ?? undefined,
        timezone: input.timezone ?? undefined,
        isOrigin: input.isOrigin ?? undefined,
        isDestination: input.isDestination ?? undefined,
        isActive: input.isActive ?? undefined,
      },
    });
    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'city',
      entityId: id,
      actorUserId: user.id,
      requestId,
      before: { status: before.status },
      after: { status: city.status },
    });
    return { id: city.id, status: city.status };
  }

  /* ------------------------------------------------- partenaires livraison */
  async listDeliveryPartners(cityId?: string) {
    const rows = await this.prisma.deliveryPartner.findMany({
      where: { cityId: cityId ?? undefined },
      orderBy: [{ isPreferred: 'desc' }, { name: 'asc' }],
      include: { city: true },
    });
    return rows.map((p) => ({
      id: p.id,
      cityId: p.cityId,
      cityCode: p.city.code,
      name: p.name,
      coverageZone: p.coverageZone,
      contactName: p.contactName,
      contactPhone: p.contactPhone,
      contactEmail: p.contactEmail,
      commissionPct: p.commissionPct?.toString() ?? null,
      settlementMode: p.settlementMode,
      reliabilityNote: p.reliabilityNote,
      isPreferred: p.isPreferred,
      isActive: p.isActive,
    }));
  }

  /** Partenaires actifs d'une ville pour la sélection agent (EF-ENR-*). */
  async listActiveForCity(cityId: string) {
    const rows = await this.prisma.deliveryPartner.findMany({
      where: { cityId, isActive: true },
      orderBy: [{ isPreferred: 'desc' }, { name: 'asc' }],
      include: {
        tariffs: { where: { isActive: true }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      coverageZone: p.coverageZone,
      isPreferred: p.isPreferred,
      currentTariff: p.tariffs[0]
        ? {
            pricePerKg: p.tariffs[0].pricePerKg.toString(),
            currency: p.tariffs[0].currencyCode,
          }
        : null,
    }));
  }

  async upsertDeliveryPartner(
    input: DeliveryPartnerUpsertInput,
    user: CurrentUser,
    id?: string,
    requestId?: string | null,
  ) {
    const city = await this.prisma.city.findUnique({ where: { id: input.cityId } });
    if (!city) {
      throw new BadRequestException({ error: { code: API_ERROR_CODES.VALIDATION, message: 'Ville introuvable' } });
    }

    const data = {
      cityId: input.cityId,
      name: input.name,
      coverageZone: input.coverageZone ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      commissionPct: input.commissionPct ?? null,
      settlementMode: input.settlementMode,
      reliabilityNote: input.reliabilityNote ?? null,
      isPreferred: input.isPreferred,
      isActive: input.isActive,
    };

    const partner = id
      ? await this.prisma.deliveryPartner.update({ where: { id }, data })
      : await this.prisma.deliveryPartner.create({ data });

    // Un seul partenaire "préféré" par ville — on désactive les autres.
    if (input.isPreferred) {
      await this.prisma.deliveryPartner.updateMany({
        where: { cityId: input.cityId, id: { not: partner.id } },
        data: { isPreferred: false },
      });
    }

    await this.audit.record({
      action: id ? 'UPDATE' : 'CREATE',
      entityType: 'delivery_partner',
      entityId: partner.id,
      actorUserId: user.id,
      requestId,
      after: { name: partner.name, cityId: partner.cityId, isActive: partner.isActive },
    });
    return { id: partner.id };
  }

  /* ------------------------------------------------------ tarifs partenaire */
  async listPartnerTariffs(deliveryPartnerId: string) {
    const rows = await this.prisma.partnerTariff.findMany({
      where: { deliveryPartnerId },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rows.map((t) => ({
      id: t.id,
      pricePerKg: t.pricePerKg.toString(),
      currency: t.currencyCode,
      minWeightKg: t.minWeightKg?.toString() ?? null,
      isActive: t.isActive,
      effectiveFrom: t.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: t.effectiveTo ? t.effectiveTo.toISOString().slice(0, 10) : null,
    }));
  }

  /** Nouvelle version datée du tarif partenaire — ferme la précédente (même motif que TariffsService). */
  async createPartnerTariff(
    deliveryPartnerId: string,
    input: PartnerTariffCreateInput,
    user: CurrentUser,
    requestId?: string | null,
  ) {
    const partner = await this.prisma.deliveryPartner.findUnique({ where: { id: deliveryPartnerId } });
    if (!partner) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Partenaire introuvable' } });
    }
    const currency = await this.prisma.currency.findUnique({ where: { code: input.currency } });
    if (!currency || !currency.isActive) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: `Devise inactive : ${input.currency}` },
      });
    }
    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();

    const tariff = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.partnerTariff.findFirst({
        where: { deliveryPartnerId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (previous) {
        const closeAt = new Date(effectiveFrom.getTime() - 24 * 3600 * 1000);
        await tx.partnerTariff.update({ where: { id: previous.id }, data: { effectiveTo: closeAt } });
      }
      return tx.partnerTariff.create({
        data: {
          deliveryPartnerId,
          pricePerKg: input.pricePerKg,
          currencyCode: input.currency,
          minWeightKg: input.minWeightKg ?? null,
          effectiveFrom,
        },
      });
    });

    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'partner_tariff',
      entityId: tariff.id,
      actorUserId: user.id,
      requestId,
      after: { deliveryPartnerId, pricePerKg: input.pricePerKg, currency: input.currency },
    });
    return { id: tariff.id };
  }
}
