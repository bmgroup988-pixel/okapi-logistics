import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { paymentCreateSchema, paymentRefundSchema, type PaymentCreateInput } from '@okapi/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaymentsService } from './payments.service';

const failSchema = z.object({ reason: z.string().max(500).optional() });

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('parcels/:id/payments')
  @RequirePermissions('payment:create')
  async create(
    @Param('id', ParseUUIDPipe) parcelId: string,
    @Body(new ZodValidationPipe(paymentCreateSchema)) body: PaymentCreateInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.payments.create(parcelId, body, user, {
      idempotencyKey,
      requestId: req.requestId,
      path: req.path,
    });
    res.status(result.status);
    if (result.replayed) res.setHeader('idempotent-replayed', 'true');
    return result.body;
  }

  @Get('parcels/:id/payments')
  @RequirePermissions('payment:create')
  list(@Param('id', ParseUUIDPipe) parcelId: string, @CurrentUser() user: CurrentUserType) {
    return this.payments.listForParcel(parcelId, user);
  }

  @Get('parcels/:id/documents')
  @RequirePermissions('document:read')
  documents(@Param('id', ParseUUIDPipe) parcelId: string, @CurrentUser() user: CurrentUserType) {
    return this.payments.documentsForParcel(parcelId, user);
  }

  @Post('payments/:paymentId/confirm')
  @RequirePermissions('payment:confirm')
  confirm(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.payments.confirm(paymentId, user, req.requestId);
  }

  @Post('payments/:paymentId/fail')
  @RequirePermissions('payment:confirm')
  fail(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body(new ZodValidationPipe(failSchema)) body: z.infer<typeof failSchema>,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.payments.fail(paymentId, body.reason, user, req.requestId);
  }

  @Post('payments/:paymentId/refund')
  @RequirePermissions('payment:refund')
  refund(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body(new ZodValidationPipe(paymentRefundSchema)) body: z.infer<typeof paymentRefundSchema>,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.payments.refund(paymentId, body, user, req.requestId);
  }
}
