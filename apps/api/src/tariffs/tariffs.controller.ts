import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { quoteRequestSchema, tariffUpsertSchema } from '@okapi/shared';
import type { Request } from 'express';
import { z } from 'zod';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FxService } from '../fx/fx.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { TariffsService } from './tariffs.service';

const listQuery = z.object({
  destinationCityId: z.string().uuid().optional(),
  corridorId: z.string().uuid().optional(),
  mode: z.enum(['AIR', 'SEA']).optional(),
});

@Controller()
export class TariffsController {
  constructor(
    private readonly tariffs: TariffsService,
    private readonly pricing: PricingService,
    private readonly fx: FxService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('admin/tariffs')
  @RequirePermissions('tariff:read')
  list(@Query(new ZodValidationPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.tariffs.list(q);
  }

  @Post('admin/tariffs')
  @RequirePermissions('tariff:write')
  upsert(
    @Body(new ZodValidationPipe(tariffUpsertSchema)) body: z.infer<typeof tariffUpsertSchema>,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.tariffs.upsert(body, user, req.requestId);
  }

  /** Aperçu de prix pour le back-office (W-AGT-04). */
  @Post('pricing/quote')
  @RequirePermissions('tariff:read')
  async quote(
    @Body(new ZodValidationPipe(quoteRequestSchema)) body: z.infer<typeof quoteRequestSchema>,
  ) {
    const q = await this.pricing.quoteForParcel({
      originCityId: body.originCityId,
      destinationCityId: body.destinationCityId,
      mode: body.mode,
      weightKg: body.weightKg,
      declaredValue: body.declaredValue?.amount,
    });
    let billing = { amount: q.amount, currency: q.currency, rate: '1' };
    if (body.billingCurrency && body.billingCurrency !== q.currency) {
      const conv = await this.fx.convert(q.amount, q.currency, body.billingCurrency);
      billing = { amount: conv.amount, currency: body.billingCurrency, rate: conv.rate };
    }
    const reference = await this.fx.toReference(billing.amount, billing.currency);
    return {
      tariffCurrency: q.currency,
      pricePerKg: q.pricePerKg,
      amountTariffCurrency: q.amount,
      amountBillingCurrency: billing,
      amountReference: { amount: reference.amount, currency: this.fx.referenceCurrency },
      breakdown: q.breakdown,
    };
  }
}
