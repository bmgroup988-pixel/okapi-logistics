import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      isOrigin: c.isOrigin,
      isDestination: c.isDestination,
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
