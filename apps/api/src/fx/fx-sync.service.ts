import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { dDiv } from '@okapi/shared';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Synchronisation des taux de change via exchangerate.host (D8).
 *
 * Convention interne : on stocke « 1 unité de <base> = <rate> <référence> ».
 * L'API renvoie « 1 <référence> = rate <devise> » ⇒ on inverse.
 *
 * Résilience (EF-DEV) : en cas d'échec, on conserve les derniers taux connus et
 * on journalise ; un taux manuel plus récent prévaut toujours (source MANUAL).
 *
 * En production, remplacer le `setInterval` par `@nestjs/schedule` + `@Cron(FX_SYNC_CRON)`.
 */
@Injectable()
export class FxSyncService implements OnModuleInit {
  private readonly logger = new Logger(FxSyncService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    // premier passage différé pour ne pas bloquer le démarrage
    setTimeout(() => void this.sync().catch(() => undefined), 5_000);
    this.timer = setInterval(() => void this.sync().catch(() => undefined), 6 * 60 * 60 * 1000);
    this.timer.unref?.();
  }

  async sync(): Promise<{ updated: number; skipped: number; source: string }> {
    const reference = this.config.get('REFERENCE_CURRENCY', { infer: true });
    const apiBase = this.config.get('FX_API_BASE', { infer: true });
    const apiKey = this.config.get('FX_API_KEY', { infer: true });

    const currencies = await this.prisma.currency.findMany({
      where: { isActive: true, code: { not: reference } },
    });
    const symbols = currencies.map((c) => c.code);
    if (symbols.length === 0) return { updated: 0, skipped: 0, source: 'exchangerate.host' };

    const params = new URLSearchParams({ base: reference, symbols: symbols.join(',') });
    if (apiKey) params.set('access_key', apiKey);
    const url = `${apiBase.replace(/\/+$/, '')}/latest?${params.toString()}`;

    let rates: Record<string, number>;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { rates?: Record<string, number>; quotes?: Record<string, number> };
      rates = json.rates ?? normalizeQuotes(json.quotes, reference);
      if (!rates || Object.keys(rates).length === 0) throw new Error('réponse sans taux');
    } catch (err) {
      this.logger.warn(`Sync taux ignorée (${(err as Error).message}) — derniers taux conservés`);
      return { updated: 0, skipped: symbols.length, source: 'exchangerate.host (échec)' };
    }

    const effectiveFrom = new Date();
    let updated = 0;
    let skipped = 0;
    for (const code of symbols) {
      const perReference = rates[code];
      if (!perReference || perReference <= 0) {
        skipped++;
        continue;
      }
      // 1 <code> = (1 / perReference) <référence>
      const rate = dDiv('1', String(perReference), 8);
      const last = await this.prisma.exchangeRate.findFirst({
        where: { baseCurrency: code, quoteCurrency: reference },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (last && last.source === 'MANUAL' && last.effectiveFrom > new Date(Date.now() - 60_000)) {
        skipped++; // un taux manuel très récent prévaut
        continue;
      }
      await this.prisma.exchangeRate.create({
        data: {
          baseCurrency: code,
          quoteCurrency: reference,
          rate,
          source: 'API',
          provider: 'exchangerate.host',
          effectiveFrom,
        },
      });
      updated++;
    }
    this.logger.log(`Sync taux : ${updated} mis à jour, ${skipped} ignorés`);
    return { updated, skipped, source: 'exchangerate.host' };
  }
}

function normalizeQuotes(
  quotes: Record<string, number> | undefined,
  reference: string,
): Record<string, number> {
  if (!quotes) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(quotes)) {
    if (k.startsWith(reference)) out[k.slice(reference.length)] = v;
  }
  return out;
}
