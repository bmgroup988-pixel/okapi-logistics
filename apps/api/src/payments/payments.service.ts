import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Payment } from '@prisma/client';
import {
  API_ERROR_CODES,
  computeSettlement,
  currencyDecimals,
  dCmp,
  type PaymentCreateInput,
  type PaymentDto,
} from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { parcelScopeWhere } from '../auth/scope';
import { BillingService } from '../billing/billing.service';
import { IdempotencyService } from '../common/idempotency.service';
import { FxService } from '../fx/fx.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxService,
    private readonly billing: BillingService,
    private readonly notifications: NotificationsService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
  ) {}

  private async parcelScoped(parcelId: string, user: CurrentUser) {
    const parcel = await this.prisma.parcel.findFirst({
      where: { AND: [{ id: parcelId }, parcelScopeWhere(user)] },
    });
    if (!parcel) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Colis introuvable' } });
    }
    return parcel;
  }

  /* ------------------------------------------------------------ création */
  async create(
    parcelId: string,
    input: PaymentCreateInput,
    user: CurrentUser,
    opts: { idempotencyKey?: string; requestId?: string | null; path: string },
  ) {
    const fingerprint = this.idempotency.fingerprint('POST', opts.path, input);
    return this.idempotency.execute<PaymentDto>(opts.idempotencyKey, user.id, fingerprint, async () => {
      const parcel = await this.parcelScoped(parcelId, user);
      if (parcel.status === 'ANNULE') {
        throw new BadRequestException({
          error: { code: API_ERROR_CODES.CONFLICT, message: 'Colis annulé : aucun paiement possible' },
        });
      }

      const currencyRow = await this.prisma.currency.findUnique({ where: { code: input.currency } });
      if (!currencyRow || !currencyRow.isActive) {
        throw new BadRequestException({
          error: { code: API_ERROR_CODES.VALIDATION, message: `Devise inactive : ${input.currency}` },
        });
      }

      const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
      const toBilling = await this.fx.convert(input.amount, input.currency, parcel.billingCurrency, receivedAt);
      const toRef = await this.fx.convert(input.amount, input.currency, this.fx.referenceCurrency, receivedAt);

      const state = input.method === 'CASH' ? 'CONFIRME' : 'EN_ATTENTE';
      const payment = await this.prisma.payment.create({
        data: {
          parcelId,
          amount: input.amount,
          currency: input.currency,
          amountInBillingCurrency: toBilling.amount,
          billingCurrency: parcel.billingCurrency,
          amountReference: toRef.amount,
          referenceCurrency: this.fx.referenceCurrency,
          fxRate: toRef.rate,
          fxRateToBilling: toBilling.rate,
          exchangeRateId: toRef.exchangeRateId ?? toBilling.exchangeRateId,
          method: input.method,
          mobileMoneyProvider: input.mobileMoneyProvider ?? null,
          externalRef: input.externalRef ?? null,
          state,
          confirmedAt: state === 'CONFIRME' ? new Date() : null,
          collectedById: user.id,
          agencyId: parcel.registrationAgencyId,
          countryId: parcel.countryId,
          receivedAt,
          idempotencyKey: opts.idempotencyKey ?? null,
          createdById: user.id,
        },
      });

      await this.recompute(parcelId);
      await this.audit.record({
        action: 'CREATE',
        entityType: 'payment',
        entityId: payment.id,
        actorUserId: user.id,
        requestId: opts.requestId,
        after: { parcelId, amount: input.amount, currency: input.currency, method: input.method, state },
      });

      if (state === 'CONFIRME') {
        await this.afterConfirmed(payment.id);
      }
      return { status: 201, body: await this.toDto(payment.id) };
    });
  }

  /* ---------------------------------------------------------- confirmation */
  async confirm(paymentId: string, user: CurrentUser, requestId?: string | null): Promise<PaymentDto> {
    const payment = await this.loadScoped(paymentId, user);
    if (payment.state !== 'EN_ATTENTE') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: `Paiement déjà ${payment.state}` },
      });
    }
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { state: 'CONFIRME', confirmedAt: new Date() },
    });
    await this.recompute(payment.parcelId);
    await this.afterConfirmed(paymentId);
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'payment',
      entityId: paymentId,
      actorUserId: user.id,
      requestId,
      before: { state: 'EN_ATTENTE' },
      after: { state: 'CONFIRME' },
    });
    return this.toDto(paymentId);
  }

  async fail(
    paymentId: string,
    reason: string | undefined,
    user: CurrentUser,
    requestId?: string | null,
  ): Promise<PaymentDto> {
    const payment = await this.loadScoped(paymentId, user);
    if (payment.state !== 'EN_ATTENTE') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: `Paiement déjà ${payment.state}` },
      });
    }
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { state: 'ECHOUE', failureReason: reason ?? null },
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'payment',
      entityId: paymentId,
      actorUserId: user.id,
      requestId,
      after: { state: 'ECHOUE', reason: reason ?? null },
    });
    return this.toDto(paymentId);
  }

  /* --------------------------------------------------------- remboursement */
  async refund(
    paymentId: string,
    body: { amount?: string; reason: string },
    user: CurrentUser,
    requestId?: string | null,
  ): Promise<PaymentDto> {
    const original = await this.loadScoped(paymentId, user);
    if (original.state !== 'CONFIRME') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Seul un paiement confirmé peut être remboursé' },
      });
    }
    const maxAmount = original.amountInBillingCurrency.toString();
    const amount = body.amount ?? maxAmount;
    if (dCmp(amount, '0') <= 0 || dCmp(amount, maxAmount) > 0) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: `Montant de remboursement invalide (max ${maxAmount})` },
      });
    }
    const parcel = await this.prisma.parcel.findUniqueOrThrow({ where: { id: original.parcelId } });
    const toRef = await this.fx.convert(amount, parcel.billingCurrency, this.fx.referenceCurrency);

    const refund = await this.prisma.payment.create({
      data: {
        parcelId: original.parcelId,
        amount,
        currency: parcel.billingCurrency,
        amountInBillingCurrency: amount,
        billingCurrency: parcel.billingCurrency,
        amountReference: toRef.amount,
        referenceCurrency: this.fx.referenceCurrency,
        fxRate: toRef.rate,
        fxRateToBilling: '1',
        method: original.method,
        state: 'REMBOURSE',
        refundOfPaymentId: original.id,
        refundReason: body.reason,
        collectedById: user.id,
        agencyId: original.agencyId,
        countryId: original.countryId,
        receivedAt: new Date(),
        createdById: user.id,
      },
    });
    await this.recompute(original.parcelId);
    await this.billing.issueCreditNote(refund.id);
    await this.audit.record({
      action: 'REFUND',
      entityType: 'payment',
      entityId: refund.id,
      actorUserId: user.id,
      requestId,
      before: { originalPaymentId: original.id },
      after: { amount, reason: body.reason },
    });
    return this.toDto(refund.id);
  }

  /* ------------------------------------------------------------- listing */
  async listForParcel(parcelId: string, user: CurrentUser): Promise<PaymentDto[]> {
    await this.parcelScoped(parcelId, user);
    const rows = await this.prisma.payment.findMany({
      where: { parcelId },
      orderBy: { receivedAt: 'asc' },
    });
    return Promise.all(rows.map((r) => this.mapDto(r)));
  }

  async documentsForParcel(parcelId: string, user: CurrentUser) {
    await this.parcelScoped(parcelId, user);
    return this.billing.listDocuments(parcelId);
  }

  /* -------------------------------------------------------------- interne */
  private async loadScoped(paymentId: string, user: CurrentUser): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Paiement introuvable' } });
    }
    await this.parcelScoped(payment.parcelId, user);
    return payment;
  }

  /** Recalcule solde + statut de paiement du colis (RG-03). */
  async recompute(parcelId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    const [parcel, payments] = await Promise.all([
      client.parcel.findUniqueOrThrow({ where: { id: parcelId } }),
      client.payment.findMany({ where: { parcelId } }),
    ]);
    const settlement = computeSettlement(
      parcel.amountDue.toString(),
      payments.map((p) => ({ state: p.state, amountInBillingCurrency: p.amountInBillingCurrency.toString() })),
    );
    await client.parcel.update({
      where: { id: parcelId },
      data: {
        amountPaid: settlement.amountPaid,
        balance: settlement.balance,
        paymentStatus: settlement.paymentStatus,
      },
    });
  }

  private async afterConfirmed(paymentId: string): Promise<void> {
    await this.billing.onPaymentConfirmed(paymentId);
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await this.notifications.enqueueForParcel(payment.parcelId, 'PAYMENT_RECEIVED');
  }

  private async toDto(paymentId: string): Promise<PaymentDto> {
    const p = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    return this.mapDto(p);
  }

  private async mapDto(p: Payment): Promise<PaymentDto> {
    const collectedBy = await this.prisma.user.findUnique({ where: { id: p.collectedById } });
    return {
      id: p.id,
      amount: { amount: p.amount.toFixed(currencyDecimals(p.currency)), currency: p.currency },
      amountInBillingCurrency: {
        amount: p.amountInBillingCurrency.toFixed(currencyDecimals(p.billingCurrency)),
        currency: p.billingCurrency,
      },
      amountReference: {
        amount: p.amountReference.toFixed(currencyDecimals(p.referenceCurrency)),
        currency: p.referenceCurrency,
      },
      fxRate: p.fxRate.toString(),
      method: p.method,
      mobileMoneyProvider: p.mobileMoneyProvider,
      externalRef: p.externalRef,
      state: p.state,
      receivedAt: p.receivedAt.toISOString(),
      collectedByName: collectedBy?.fullName ?? null,
    };
  }
}
