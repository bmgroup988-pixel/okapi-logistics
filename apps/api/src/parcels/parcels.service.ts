import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Parcel } from '@prisma/client';
import {
  API_ERROR_CODES,
  canTransition,
  composeTrackingNumber,
  currencyDecimals,
  isOverrideWithinRange,
  isUnpaid,
  parcelListQuerySchema,
  trackingPeriodKey,
  type ParcelCreateInput,
  type ParcelDetailDto,
  type ParcelSummaryDto,
  type ParcelTransitionInput,
  type ParcelUpdateInput,
} from '@okapi/shared';
import type { z } from 'zod';
import { Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { canActOnAgency, defaultAgencyId, parcelScopeWhere } from '../auth/scope';
import { BillingService } from '../billing/billing.service';
import { paginate } from '../common/api-response';
import { IdempotencyService } from '../common/idempotency.service';
import { FxService } from '../fx/fx.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../sequences/sequence.service';
import { StorageService } from '../storage/storage.service';

type ListQuery = z.infer<typeof parcelListQuerySchema>;

@Injectable()
export class ParcelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly fx: FxService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly idempotency: IdempotencyService,
    private readonly sequences: SequenceService,
    private readonly billing: BillingService,
    private readonly audit: AuditService,
  ) {}

  private readonly logger = new Logger(ParcelsService.name);

  /* ------------------------------------------------------------ création */
  async create(
    input: ParcelCreateInput,
    user: CurrentUser,
    opts: { idempotencyKey?: string; requestId?: string | null; path: string },
  ): Promise<{ status: number; body: ParcelDetailDto; replayed: boolean }> {
    const fingerprint = this.idempotency.fingerprint('POST', opts.path, input);
    return this.idempotency.execute<ParcelDetailDto>(
      opts.idempotencyKey,
      user.id,
      fingerprint,
      async () => {
        const parcel = await this.doCreate(input, user, opts.requestId ?? null);
        // Étiquette + reçu d'enregistrement (EF-ENR-10) — sans bloquer la création.
        try {
          await this.billing.onParcelRegistered(parcel.id);
        } catch (err) {
          this.logger.error(
            `Génération des documents différée pour ${parcel.trackingNumber}`,
            err as Error,
          );
        }
        return { status: 201, body: await this.toDetailDto(parcel.id) };
      },
    );
  }

  private async doCreate(
    input: ParcelCreateInput,
    user: CurrentUser,
    requestId: string | null,
  ): Promise<Parcel> {
    const agencyId = defaultAgencyId(user);
    if (!agencyId) {
      throw new BadRequestException({
        error: {
          code: API_ERROR_CODES.VALIDATION,
          message: 'Impossible de déterminer l’agence d’enregistrement pour ce compte',
        },
      });
    }
    if (!canActOnAgency(user, agencyId)) {
      throw new ForbiddenException({ error: { code: API_ERROR_CODES.FORBIDDEN, message: 'Hors périmètre' } });
    }

    const agency = await this.prisma.agency.findUniqueOrThrow({ where: { id: agencyId } });
    const [origin, destination] = await Promise.all([
      this.prisma.city.findUnique({ where: { id: input.originCityId } }),
      this.prisma.city.findUnique({ where: { id: input.destinationCityId } }),
    ]);
    if (!origin || !origin.isActive || !origin.isOrigin) {
      throw new BadRequestException({ error: { code: API_ERROR_CODES.VALIDATION, message: 'Ville de départ invalide' } });
    }
    if (!destination || !destination.isActive || !destination.isDestination) {
      throw new BadRequestException({ error: { code: API_ERROR_CODES.VALIDATION, message: 'Ville de destination invalide' } });
    }

    const billingCurrency = input.billingCurrency ?? agency.billingCurrency;
    const currencyRow = await this.prisma.currency.findUnique({ where: { code: billingCurrency } });
    if (!currencyRow || !currencyRow.isActive) {
      throw new BadRequestException({ error: { code: API_ERROR_CODES.VALIDATION, message: `Devise de facturation inactive : ${billingCurrency}` } });
    }

    const now = new Date();
    const declaredValue = input.declaredValue?.amount ?? '0';
    const declaredValueCurrency = input.declaredValue?.currency ?? billingCurrency;

    // 1) prix dans la devise du tarif
    const quote = await this.pricing.quoteForParcel({
      originCityId: origin.id,
      destinationCityId: destination.id,
      mode: input.transportMode,
      weightKg: input.weightKg,
      declaredValue,
      overridePct: input.pricingOverridePct,
      at: now,
    });

    if (
      input.pricingOverridePct &&
      !isOverrideWithinRange(
        input.pricingOverridePct,
        String(quote.snapshot.overrideMin ?? '-0.15'),
        String(quote.snapshot.overrideMax ?? '0.15'),
      )
    ) {
      throw new BadRequestException({
        error: {
          code: 'PRICING_OVERRIDE_OUT_OF_RANGE',
          message: 'L’ajustement de tarif dépasse la fourchette autorisée (justification requise en agence)',
        },
      });
    }

    // 2) conversion vers la devise de facturation puis vers la devise de référence
    const toBilling = await this.fx.convert(quote.amount, quote.currency, billingCurrency, now);
    const toRef = await this.fx.toReference(toBilling.amount, billingCurrency, now);

    // 3) numéro de suivi (séquentiel par destination, mensuel — D2)
    const seq = await this.sequences.next('tracking', destination.code, trackingPeriodKey(now));
    const trackingNumber = composeTrackingNumber({ at: now, seq, cityCode: destination.code });

    const parcel = await this.prisma.$transaction(async (tx) => {
      const created = await tx.parcel.create({
        data: {
          trackingNumber,
          registrationAgencyId: agency.id,
          registrationAgentId: user.id,
          countryId: agency.countryId,
          originCityId: origin.id,
          destinationCityId: destination.id,
          destinationCityCode: destination.code,
          transportMode: input.transportMode,
          weightKg: input.weightKg,
          contentNature: input.contentNature,
          declaredValue,
          declaredValueCurrency,
          billingCurrency,
          amountDue: toBilling.amount,
          amountPaid: '0',
          balance: toBilling.amount,
          referenceCurrency: this.fx.referenceCurrency,
          amountDueReference: toRef.amount,
          fxRateDue: toRef.rate,
          exchangeRateIdDue: toRef.exchangeRateId,
          pricingOverridePct: input.pricingOverridePct ?? '0',
          pricingSnapshot: quote.snapshot as Prisma.InputJsonValue,
          consentGiven: input.consent.given,
          consentTextVersion: input.consent.textVersion,
          consentAt: now,
          clientChannel: input.clientChannel ?? null,
          clientLocale: input.clientLocale,
          createdById: user.id,
          contacts: {
            create: [
              { role: 'SENDER', ...contactData(input.sender) },
              { role: 'RECIPIENT', ...contactData(input.recipient) },
            ],
          },
          events: {
            create: [
              {
                status: 'ENREGISTRE',
                locationCityId: origin.id,
                note: 'Colis enregistré',
                visibleToClient: true,
                createdById: user.id,
              },
            ],
          },
        },
      });

      await tx.consent.create({
        data: {
          parcelId: created.id,
          subjectRef: normalizeRef(input.recipient.phone ?? input.recipient.email ?? input.sender.phone ?? ''),
          purpose: 'transport_execution',
          textVersion: input.consent.textVersion,
          channel: 'agency_form',
          given: true,
        },
      });

      return created;
    });

    await this.audit.record({
      action: 'CREATE',
      entityType: 'parcel',
      entityId: parcel.id,
      actorUserId: user.id,
      requestId,
      after: {
        trackingNumber,
        amountDue: toBilling.amount,
        billingCurrency,
        overridePct: input.pricingOverridePct ?? '0',
      },
    });

    return parcel;
  }

  /* -------------------------------------------------------------- listing */
  async list(query: ListQuery, user: CurrentUser) {
    const where: Prisma.ParcelWhereInput = { AND: [parcelScopeWhere(user)] };
    const and = where.AND as Prisma.ParcelWhereInput[];
    if (query.status) and.push({ status: { in: query.status.split(',') as never } });
    if (query.paymentStatus) and.push({ paymentStatus: { in: query.paymentStatus.split(',') as never } });
    if (query.destinationCityId) and.push({ destinationCityId: query.destinationCityId });
    if (query.agencyId) and.push({ registrationAgencyId: query.agencyId });
    if (query.countryId) and.push({ countryId: query.countryId });
    if (query.transportMode) and.push({ transportMode: query.transportMode });
    if (query.from) and.push({ createdAt: { gte: new Date(query.from) } });
    if (query.to) and.push({ createdAt: { lte: new Date(query.to) } });
    if (query.q) {
      and.push({
        OR: [
          { trackingNumber: { contains: query.q, mode: 'insensitive' } },
          { contacts: { some: { name: { contains: query.q, mode: 'insensitive' } } } },
          { contacts: { some: { phone: { contains: query.q } } } },
        ],
      });
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.parcel.findMany({
        where,
        orderBy: parseSort(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { originCity: true, destinationCity: true },
      }),
      this.prisma.parcel.count({ where }),
    ]);

    return paginate(rows.map(toSummaryDto), total, query.page, query.limit);
  }

  /* --------------------------------------------------------------- detail */
  async findScoped(id: string, user: CurrentUser) {
    const parcel = await this.prisma.parcel.findFirst({
      where: { AND: [{ id }, parcelScopeWhere(user)] },
    });
    if (!parcel) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Colis introuvable' } });
    }
    return parcel;
  }

  async get(id: string, user: CurrentUser): Promise<ParcelDetailDto> {
    await this.findScoped(id, user);
    return this.toDetailDto(id);
  }

  async events(id: string, user: CurrentUser) {
    await this.findScoped(id, user);
    const events = await this.prisma.parcelEvent.findMany({
      where: { parcelId: id },
      orderBy: { createdAt: 'asc' },
      include: { createdBy: true, locationCity: true },
    });
    return events.map((e) => ({
      id: e.id,
      status: e.status,
      locationLabel: e.locationLabel ?? e.locationCity?.code ?? null,
      note: e.note,
      visibleToClient: e.visibleToClient,
      createdAt: e.createdAt.toISOString(),
      createdByName: e.createdBy?.fullName ?? null,
    }));
  }

  /* --------------------------------------------------------------- update */
  async update(id: string, input: ParcelUpdateInput, user: CurrentUser, requestId?: string | null) {
    const parcel = await this.findScoped(id, user);
    if (parcel.status !== 'ENREGISTRE') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Le colis ne peut plus être modifié après expédition' },
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.parcel.update({
        where: { id },
        data: {
          contentNature: input.contentNature ?? undefined,
          weightKg: input.weightKg ?? undefined,
          declaredValue: input.declaredValue?.amount ?? undefined,
          declaredValueCurrency: input.declaredValue?.currency ?? undefined,
          clientChannel: input.clientChannel === undefined ? undefined : input.clientChannel,
          clientLocale: input.clientLocale ?? undefined,
          updatedById: user.id,
        },
      });
      if (input.sender) {
        await tx.parcelContact.update({
          where: { parcelId_role: { parcelId: id, role: 'SENDER' } },
          data: contactData(input.sender),
        });
      }
      if (input.recipient) {
        await tx.parcelContact.update({
          where: { parcelId_role: { parcelId: id, role: 'RECIPIENT' } },
          data: contactData(input.recipient),
        });
      }
    });
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'parcel',
      entityId: id,
      actorUserId: user.id,
      requestId,
      after: { fields: Object.keys(input) },
    });
    return this.toDetailDto(id);
  }

  /* ----------------------------------------------------------- transition */
  async transition(
    id: string,
    input: ParcelTransitionInput,
    user: CurrentUser,
    requestId?: string | null,
  ): Promise<ParcelDetailDto> {
    const parcel = await this.findScoped(id, user);
    if (!canTransition(parcel.status, input.to)) {
      throw new BadRequestException({
        error: {
          code: API_ERROR_CODES.INVALID_TRANSITION,
          message: `Transition ${parcel.status} → ${input.to} non autorisée`,
        },
      });
    }

    if (input.to === 'LIVRE' && parcel.paymentStatus !== 'PAYE') {
      const country = await this.prisma.country.findUniqueOrThrow({ where: { id: parcel.countryId } });
      if (country.unpaidDeliveryPolicy === 'strict') {
        throw new ForbiddenException({
          error: {
            code: API_ERROR_CODES.UNPAID_DELIVERY_BLOCKED,
            message: 'Livraison interdite avec un solde impayé dans ce pays',
          },
        });
      }
      if (!input.unpaidOverrideReason) {
        throw new BadRequestException({
          error: {
            code: API_ERROR_CODES.UNPAID_DELIVERY_BLOCKED,
            message: 'Une justification est requise pour livrer avec un solde impayé',
          },
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.parcel.update({
        where: { id },
        data: {
          status: input.to,
          deliveredAt: input.to === 'LIVRE' ? new Date() : undefined,
          updatedById: user.id,
        },
      });
      if (input.to === 'EN_TRANSIT') {
        await tx.parcelPhoto.updateMany({ where: { parcelId: id }, data: { locked: true } });
      }
      await tx.parcelEvent.create({
        data: {
          parcelId: id,
          status: input.to,
          locationCityId: input.locationCityId ?? null,
          locationLabel: input.locationLabel ?? null,
          note: input.unpaidOverrideReason
            ? `${input.note ?? ''} [dérogation impayé : ${input.unpaidOverrideReason}]`.trim()
            : (input.note ?? null),
          visibleToClient: input.visibleToClient,
          createdById: user.id,
        },
      });
    });

    await this.notifications.enqueueForParcel(id, 'STATUS_CHANGE');
    if (input.to === 'ARRIVE' && isUnpaid(parcel.paymentStatus)) {
      await this.notifications.enqueueForParcel(id, 'UNPAID_ON_ARRIVAL');
    }
    if (input.to === 'LIVRE') {
      await this.notifications.enqueueForParcel(id, 'DELIVERED');
    }

    await this.audit.record({
      action: 'TRANSITION',
      entityType: 'parcel',
      entityId: id,
      actorUserId: user.id,
      requestId,
      before: { status: parcel.status },
      after: { status: input.to, unpaidOverride: input.unpaidOverrideReason ?? null },
    });

    return this.toDetailDto(id);
  }

  async cancel(id: string, reason: string, user: CurrentUser, requestId?: string | null) {
    const parcel = await this.findScoped(id, user);
    if (!canTransition(parcel.status, 'ANNULE')) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.INVALID_TRANSITION, message: 'Le colis ne peut plus être annulé' },
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.parcel.update({ where: { id }, data: { status: 'ANNULE', cancelReason: reason, updatedById: user.id } });
      await tx.parcelEvent.create({
        data: { parcelId: id, status: 'ANNULE', note: reason, visibleToClient: true, createdById: user.id },
      });
    });
    await this.audit.record({
      action: 'TRANSITION',
      entityType: 'parcel',
      entityId: id,
      actorUserId: user.id,
      requestId,
      before: { status: parcel.status },
      after: { status: 'ANNULE', reason },
    });
    return this.toDetailDto(id);
  }

  /* ------------------------------------------------------------- photos */
  private assertPhotoEditable(parcel: Parcel) {
    if (parcel.status !== 'ENREGISTRE') {
      throw new BadRequestException({
        error: {
          code: API_ERROR_CODES.CONFLICT,
          message: 'Les photos sont verrouillées après expédition (preuve — EF-ENR-06)',
        },
      });
    }
  }

  async presignPhoto(id: string, user: CurrentUser) {
    const parcel = await this.findScoped(id, user);
    this.assertPhotoEditable(parcel);
    const key = this.storage.buildPhotoKey(id);
    return this.storage.presignPut(key);
  }

  async confirmPhoto(
    id: string,
    body: { storageKey: string; sha256: string; bytes: number; mimeType: string; isPrimary: boolean },
    user: CurrentUser,
    requestId?: string | null,
  ) {
    const parcel = await this.findScoped(id, user);
    this.assertPhotoEditable(parcel);

    const primaryExists = await this.prisma.parcelPhoto.count({ where: { parcelId: id, isPrimary: true } });
    const makePrimary = body.isPrimary || primaryExists === 0;

    const photo = await this.prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.parcelPhoto.updateMany({ where: { parcelId: id, isPrimary: true }, data: { isPrimary: false } });
      }
      return tx.parcelPhoto.create({
        data: {
          parcelId: id,
          storageKey: body.storageKey,
          sha256: body.sha256,
          bytes: body.bytes,
          mimeType: body.mimeType,
          isPrimary: makePrimary,
          exifStripped: false,
          takenById: user.id,
        },
      });
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'parcel_photo',
      entityId: photo.id,
      actorUserId: user.id,
      requestId,
      after: { parcelId: id, isPrimary: makePrimary, sha256: body.sha256 },
    });
    return { id: photo.id, isPrimary: photo.isPrimary };
  }

  async listPhotos(id: string, user: CurrentUser, scope: 'internal' | 'client' = 'internal') {
    await this.findScoped(id, user);
    const photos = await this.prisma.parcelPhoto.findMany({
      where: { parcelId: id },
      orderBy: [{ isPrimary: 'desc' }, { takenAt: 'asc' }],
    });
    return photos.map((p) => ({
      id: p.id,
      url: p.storageKey ? this.storage.presignGet(p.storageKey, scope).url : null,
      isPrimary: p.isPrimary,
      takenAt: p.takenAt.toISOString(),
      locked: p.locked,
    }));
  }

  /* --------------------------------------------------------------- DTO */
  private async toDetailDto(id: string): Promise<ParcelDetailDto> {
    const p = await this.prisma.parcel.findUniqueOrThrow({
      where: { id },
      include: {
        originCity: true,
        destinationCity: true,
        contacts: true,
        photos: { orderBy: [{ isPrimary: 'desc' }, { takenAt: 'asc' }] },
        events: { orderBy: { createdAt: 'asc' }, include: { createdBy: true, locationCity: true } },
      },
    });
    const sender = p.contacts.find((c) => c.role === 'SENDER')!;
    const recipient = p.contacts.find((c) => c.role === 'RECIPIENT')!;
    const dp = currencyDecimals(p.billingCurrency);
    return {
      ...toSummaryDto(p),
      referenceCurrency: p.referenceCurrency,
      amountDueReference: { amount: p.amountDueReference.toFixed(currencyDecimals(p.referenceCurrency)), currency: p.referenceCurrency },
      contentNature: p.contentNature,
      declaredValue: { amount: p.declaredValue.toFixed(currencyDecimals(p.declaredValueCurrency)), currency: p.declaredValueCurrency },
      sender: contactDto(sender),
      recipient: contactDto(recipient),
      clientChannel: p.clientChannel,
      clientLocale: (p.clientLocale as ParcelDetailDto['clientLocale']) ?? 'fr',
      events: p.events.map((e) => ({
        id: e.id,
        status: e.status,
        locationLabel: e.locationLabel ?? e.locationCity?.code ?? null,
        note: e.note,
        visibleToClient: e.visibleToClient,
        createdAt: e.createdAt.toISOString(),
        createdByName: e.createdBy?.fullName ?? null,
      })),
      photos: p.photos.map((ph) => ({
        id: ph.id,
        url: ph.storageKey ? this.storage.presignGet(ph.storageKey, 'internal').url : '',
        isPrimary: ph.isPrimary,
        takenAt: ph.takenAt.toISOString(),
        locked: ph.locked,
      })),
      updatedAt: p.updatedAt.toISOString(),
      amountDue: { amount: p.amountDue.toFixed(dp), currency: p.billingCurrency },
      amountPaid: { amount: p.amountPaid.toFixed(dp), currency: p.billingCurrency },
      balance: { amount: p.balance.toFixed(dp), currency: p.billingCurrency },
    };
  }
}

/* ------------------------------------------------------------ helpers */
function contactData(c: {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  cityLabel?: string | null;
  countryLabel?: string | null;
  idDocumentRef?: string | null;
}) {
  return {
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    address: c.address ?? null,
    cityLabel: c.cityLabel ?? null,
    countryLabel: c.countryLabel ?? null,
    idDocumentRef: c.idDocumentRef ?? null,
  };
}

function contactDto(c: {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  anonymized: boolean;
}) {
  return {
    name: c.anonymized ? 'REDACTED' : c.name,
    phone: c.anonymized ? null : c.phone,
    email: c.anonymized ? null : c.email,
    address: c.anonymized ? null : c.address,
    anonymized: c.anonymized,
  };
}

function toSummaryDto(p: {
  id: string;
  trackingNumber: string;
  status: ParcelSummaryDto['status'];
  paymentStatus: ParcelSummaryDto['paymentStatus'];
  originCity?: { code: string } | null;
  destinationCity?: { code: string } | null;
  destinationCityCode: string;
  transportMode: ParcelSummaryDto['transportMode'];
  weightKg: Prisma.Decimal;
  amountDue: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  balance: Prisma.Decimal;
  billingCurrency: string;
  createdAt: Date;
}): ParcelSummaryDto {
  const dp = currencyDecimals(p.billingCurrency);
  return {
    id: p.id,
    trackingNumber: p.trackingNumber,
    status: p.status,
    paymentStatus: p.paymentStatus,
    originCityCode: p.originCity?.code ?? '',
    destinationCityCode: p.destinationCity?.code ?? p.destinationCityCode,
    transportMode: p.transportMode,
    weightKg: p.weightKg.toString(),
    amountDue: { amount: p.amountDue.toFixed(dp), currency: p.billingCurrency },
    amountPaid: { amount: p.amountPaid.toFixed(dp), currency: p.billingCurrency },
    balance: { amount: p.balance.toFixed(dp), currency: p.billingCurrency },
    createdAt: p.createdAt.toISOString(),
  };
}

function parseSort(sort?: string): Prisma.ParcelOrderByWithRelationInput {
  if (!sort) return { createdAt: 'desc' };
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  const allowed = ['createdAt', 'weightKg', 'trackingNumber', 'status'];
  if (!allowed.includes(field)) return { createdAt: 'desc' };
  return { [field]: desc ? 'desc' : 'asc' };
}

function normalizeRef(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, '');
}
