import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

const cityIdQuery = z.object({ cityId: z.string().uuid() });

/** Référentiels en lecture pour le back-office (villes, agences, devises). */
@Controller('reference')
export class ReferenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('cities')
  async cities() {
    const rows = await this.prisma.city.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { code: 'asc' },
      include: { country: true },
    });
    return rows.map((c) => ({
      id: c.id,
      code: c.code,
      countryId: c.countryId,
      countryIso2: c.country.iso2,
      timezone: c.timezone,
      /// HUB / PARTNER / PLANNED — addendum 08, §1.2. Une destination
      /// PARTNER requiert le choix d'un partenaire de livraison (voir
      /// GET /reference/delivery-partners) à la création du colis.
      status: c.status,
      isOrigin: c.isOrigin,
      isDestination: c.isDestination,
    }));
  }

  /**
   * Partenaires de livraison actifs pour une ville PARTNER, avec leur tarif
   * courant — utilisé par l'agent à la création d'un colis (addendum 08,
   * §1.4). Lecture ouverte à tout compte authentifié, comme le reste de ce
   * contrôleur (pas de `city:write` ici — c'est l'administration du
   * référentiel, pas sa consultation, qui est réservée).
   */
  @Get('delivery-partners')
  async deliveryPartners(@Query(new ZodValidationPipe(cityIdQuery)) q: z.infer<typeof cityIdQuery>) {
    const rows = await this.prisma.deliveryPartner.findMany({
      where: { cityId: q.cityId, isActive: true },
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
        ? { pricePerKg: p.tariffs[0].pricePerKg.toString(), currency: p.tariffs[0].currencyCode }
        : null,
    }));
  }

  @Get('agencies')
  async agencies() {
    const rows = await this.prisma.agency.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { code: 'asc' },
    });
    return rows.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      countryId: a.countryId,
      cityId: a.cityId,
      billingCurrency: a.billingCurrency,
    }));
  }

  @Get('currencies')
  async currencies() {
    const rows = await this.prisma.currency.findMany({ orderBy: { code: 'asc' } });
    return rows.map((c) => ({
      code: c.code,
      symbol: c.symbol,
      decimalDigits: c.decimalDigits,
      isActive: c.isActive,
      isReference: c.isReference,
    }));
  }

  @Get('countries')
  async countries() {
    const rows = await this.prisma.country.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { iso2: 'asc' },
    });
    return rows.map((c) => ({
      id: c.id,
      iso2: c.iso2,
      defaultCurrency: c.defaultCurrency,
      defaultLocale: c.defaultLocale,
      unpaidDeliveryPolicy: c.unpaidDeliveryPolicy,
    }));
  }
}
