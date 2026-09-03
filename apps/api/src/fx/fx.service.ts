import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { API_ERROR_CODES, crossConvert, currencyDecimals, dRound, effectiveRate } from '@okapi/shared';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

export class FxRateMissingError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Aucun taux de change disponible pour ${from} -> ${to}`);
  }
}

export interface Conversion {
  amount: string;
  rate: string; // taux from -> to figé
  exchangeRateId: string | null;
}

@Injectable()
export class FxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get referenceCurrency(): string {
    return this.config.get('REFERENCE_CURRENCY', { infer: true });
  }

  /** Dernier taux `currency -> devise de référence` en vigueur à `at`. */
  private async rateToReference(
    currency: string,
    at: Date,
  ): Promise<{ rate: string; id: string | null }> {
    if (currency === this.referenceCurrency) return { rate: '1', id: null };
    const row = await this.prisma.exchangeRate.findFirst({
      where: {
        baseCurrency: currency,
        quoteCurrency: this.referenceCurrency,
        effectiveFrom: { lte: at },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!row) throw new FxRateMissingError(currency, this.referenceCurrency);
    return { rate: row.rate.toString(), id: row.id };
  }

  /** Convertit `amount` de `from` vers `to` à la date `at` (défaut : maintenant). */
  async convert(amount: string, from: string, to: string, at: Date = new Date()): Promise<Conversion> {
    if (from === to) {
      return { amount: dRound(amount, currencyDecimals(to)), rate: '1', exchangeRateId: null };
    }
    const fromRef = await this.rateToReference(from, at);
    const toRef = await this.rateToReference(to, at);
    const converted = crossConvert(amount, from, to, fromRef.rate, toRef.rate, currencyDecimals(to));
    const rate = effectiveRate(fromRef.rate, toRef.rate);
    // l'id de taux le plus pertinent : celui de la devise non-référence
    const exchangeRateId = from === this.referenceCurrency ? toRef.id : fromRef.id;
    return { amount: converted, rate, exchangeRateId };
  }

  /** Convertit vers la devise de référence (consolidation). */
  toReference(amount: string, from: string, at: Date = new Date()): Promise<Conversion> {
    return this.convert(amount, from, this.referenceCurrency, at);
  }

  static get MISSING_CODE() {
    return API_ERROR_CODES.FX_RATE_MISSING;
  }
}
