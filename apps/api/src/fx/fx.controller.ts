import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { API_ERROR_CODES, manualRateSchema } from '@okapi/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { FxService } from './fx.service';
import { FxSyncService } from './fx-sync.service';

const convertQuery = z.object({
  from: z.string().length(3),
  to: z.string().length(3).optional(),
  at: z.string().datetime().optional(),
  amount: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

@Controller()
export class FxController {
  constructor(
    private readonly fx: FxService,
    private readonly sync: FxSyncService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('exchange-rates')
  @RequirePermissions('fx:read')
  async convert(@Query(new ZodValidationPipe(convertQuery)) q: z.infer<typeof convertQuery>) {
    const to = q.to ?? this.fx.referenceCurrency;
    const at = q.at ? new Date(q.at) : new Date();
    const conv = await this.fx.convert(q.amount ?? '1', q.from, to, at);
    return { from: q.from, to, at: at.toISOString(), rate: conv.rate, amount: conv.amount };
  }

  @Get('admin/exchange-rates')
  @RequirePermissions('fx:read')
  async list() {
    const reference = this.fx.referenceCurrency;
    const currencies = await this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    const rows = await Promise.all(
      currencies
        .filter((c) => c.code !== reference)
        .map(async (c) => {
          const last = await this.prisma.exchangeRate.findFirst({
            where: { baseCurrency: c.code, quoteCurrency: reference },
            orderBy: { effectiveFrom: 'desc' },
          });
          const ageHours = last
            ? (Date.now() - last.effectiveFrom.getTime()) / 3_600_000
            : null;
          return {
            currency: c.code,
            rateToReference: last?.rate.toString() ?? null,
            source: last?.source ?? null,
            effectiveFrom: last?.effectiveFrom.toISOString() ?? null,
            ageHours: ageHours == null ? null : Math.round(ageHours),
            stale: ageHours != null && ageHours > 36,
          };
        }),
    );
    return { referenceCurrency: reference, rates: rows };
  }

  @Get('admin/exchange-rates/:base/history')
  @RequirePermissions('fx:read')
  history(@Param('base') base: string) {
    return this.prisma.exchangeRate.findMany({
      where: { baseCurrency: base.toUpperCase(), quoteCurrency: this.fx.referenceCurrency },
      orderBy: { effectiveFrom: 'desc' },
      take: 100,
    });
  }

  @Post('admin/exchange-rates')
  @RequirePermissions('fx:write')
  async createManual(
    @Body(new ZodValidationPipe(manualRateSchema)) body: z.infer<typeof manualRateSchema>,
    @CurrentUser() user: CurrentUserType,
  ) {
    const reference = this.fx.referenceCurrency;
    if (body.baseCurrency === reference) {
      throw new BadRequestException({
        error: {
          code: API_ERROR_CODES.VALIDATION,
          message: 'La devise de référence ne peut pas avoir de taux vers elle-même',
        },
      });
    }
    const currency = await this.prisma.currency.findUnique({ where: { code: body.baseCurrency } });
    if (!currency || !currency.isActive) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: `Devise inactive ou inconnue : ${body.baseCurrency}` },
      });
    }
    const row = await this.prisma.exchangeRate.create({
      data: {
        baseCurrency: body.baseCurrency,
        quoteCurrency: reference,
        rate: body.rate,
        source: 'MANUAL',
        provider: body.note ?? 'saisie manuelle',
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
        createdById: user.id,
      },
    });
    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'exchange_rate',
      entityId: row.id,
      actorUserId: user.id,
      after: { base: body.baseCurrency, quote: reference, rate: body.rate, source: 'MANUAL' },
    });
    return row;
  }

  @Post('admin/exchange-rates/sync')
  @RequirePermissions('fx:write')
  async runSync(@CurrentUser() user: CurrentUserType) {
    const result = await this.sync.sync();
    await this.audit.record({
      action: 'CONFIG_CHANGE',
      entityType: 'exchange_rate',
      actorUserId: user.id,
      after: result,
    });
    return result;
  }
}
