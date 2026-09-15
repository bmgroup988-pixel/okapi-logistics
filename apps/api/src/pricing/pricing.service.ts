import { BadRequestException, Injectable } from '@nestjs/common';
import type { TransportMode } from '@prisma/client';
import { API_ERROR_CODES, currencyDecimals, quote, type QuoteResult } from '@okapi/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Doit être une `HttpException` (pas un `Error` nu) : `AllExceptionsFilter` ne
 * mappe que les `HttpException` vers un statut précis — un `Error` brut tombe
 * en 500 alors que « tarif non configuré » est une condition métier normale
 * (à corriger côté configuration, pas une panne serveur).
 */
export class TariffMissingError extends BadRequestException {
  constructor(cityCode: string, mode: string) {
    super({
      error: {
        code: API_ERROR_CODES.TARIFF_MISSING,
        message: `Aucun tarif (prix par kg) défini pour ${cityCode} en mode ${mode}`,
      },
    });
  }
}

export interface PriceQuote extends QuoteResult {
  currency: string;
  tariffId: string;
  pricePerKg: string;
  snapshot: Record<string, unknown>;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résout le tarif actif pour une destination + mode (règle ville→ville
   * prioritaire, sinon corridor pays), puis calcule le montant dû — D6.
   */
  async quoteForParcel(params: {
    originCityId: string;
    destinationCityId: string;
    mode: TransportMode;
    weightKg: string;
    declaredValue?: string;
    overridePct?: string;
    at?: Date;
  }): Promise<PriceQuote> {
    const at = params.at ?? new Date();
    const destination = await this.prisma.city.findUniqueOrThrow({
      where: { id: params.destinationCityId },
      include: { country: true },
    });

    // 1) tarif ville -> ville
    let tariff = await this.prisma.tariff.findFirst({
      where: {
        destinationCityId: params.destinationCityId,
        originCityId: params.originCityId,
        mode: params.mode,
        validFrom: { lte: at },
        OR: [{ validTo: null }, { validTo: { gte: at } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    // 2) tarif « toutes origines » vers la destination
    if (!tariff) {
      tariff = await this.prisma.tariff.findFirst({
        where: {
          destinationCityId: params.destinationCityId,
          originCityId: null,
          mode: params.mode,
          validFrom: { lte: at },
          OR: [{ validTo: null }, { validTo: { gte: at } }],
        },
        orderBy: { validFrom: 'desc' },
      });
    }

    // 3) tarif au niveau du corridor pays
    if (!tariff) {
      const origin = await this.prisma.city.findUniqueOrThrow({
        where: { id: params.originCityId },
      });
      const corridor = await this.prisma.corridor.findUnique({
        where: {
          originCountryId_destinationCountryId: {
            originCountryId: origin.countryId,
            destinationCountryId: destination.countryId,
          },
        },
      });
      if (corridor) {
        tariff = await this.prisma.tariff.findFirst({
          where: {
            corridorId: corridor.id,
            mode: params.mode,
            validFrom: { lte: at },
            OR: [{ validTo: null }, { validTo: { gte: at } }],
          },
          orderBy: { validFrom: 'desc' },
        });
      }
    }

    if (!tariff) throw new TariffMissingError(destination.code, params.mode);

    const decimals = currencyDecimals(tariff.currency);
    const result = quote({
      pricePerKg: tariff.pricePerKg.toString(),
      weightKg: params.weightKg,
      fixedFee: tariff.fixedFee.toString(),
      minCharge: tariff.minCharge.toString(),
      adValoremEnabled: tariff.adValoremEnabled,
      adValoremRate: tariff.adValoremRate.toString(),
      declaredValue: params.declaredValue,
      overridePct: params.overridePct,
      decimals,
    });

    return {
      ...result,
      currency: tariff.currency,
      tariffId: tariff.id,
      pricePerKg: tariff.pricePerKg.toString(),
      snapshot: {
        tariffId: tariff.id,
        currency: tariff.currency,
        pricePerKg: tariff.pricePerKg.toString(),
        fixedFee: tariff.fixedFee.toString(),
        minCharge: tariff.minCharge.toString(),
        adValoremEnabled: tariff.adValoremEnabled,
        adValoremRate: tariff.adValoremRate.toString(),
        overrideMin: tariff.overrideMin.toString(),
        overrideMax: tariff.overrideMax.toString(),
        weightKg: params.weightKg,
        breakdown: result.breakdown,
        computedAt: at.toISOString(),
      },
    };
  }

  async overrideRange(tariffId: string): Promise<{ min: string; max: string }> {
    const t = await this.prisma.tariff.findUniqueOrThrow({ where: { id: tariffId } });
    return { min: t.overrideMin.toString(), max: t.overrideMax.toString() };
  }
}
