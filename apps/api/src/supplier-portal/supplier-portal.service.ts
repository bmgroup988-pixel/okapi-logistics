import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  API_ERROR_CODES,
  composeShipmentCode,
  composeSupplierInvoiceNumber,
  composeTrackingNumber,
  dAdd,
  humanizeNameKey,
  trackingPeriodKey,
  type SupplierPortalParcelCreateInput,
} from '@okapi/shared';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../auth/current-user';
import { currentSupplierId } from '../auth/scope';
import { FxService } from '../fx/fx.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../sequences/sequence.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { renderSupplierInvoicePdf, type PdfBrandColors } from '../billing/pdf.util';

/**
 * Portail fournisseur en libre-service : expéditions groupées, ajout de
 * colis, clôture + facturation consolidée — docs/11, §4/§6.2.
 */
@Injectable()
export class SupplierPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequences: SequenceService,
    private readonly fx: FxService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Fournisseur rattaché au compte connecté — jamais null pour un rôle FOURNISSEUR valide. */
  private async requireSupplier(user: CurrentUser) {
    const supplierId = currentSupplierId(user);
    if (!supplierId) {
      throw new ForbiddenException({
        error: { code: API_ERROR_CODES.FORBIDDEN, message: 'Compte non rattaché à un fournisseur' },
      });
    }
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier || !supplier.isActive) {
      throw new ForbiddenException({
        error: { code: API_ERROR_CODES.FORBIDDEN, message: 'Compte fournisseur introuvable ou désactivé' },
      });
    }
    return supplier;
  }

  private async requireOwnedShipment(shipmentId: string, supplierId: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment || shipment.supplierId !== supplierId) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Expédition introuvable' } });
    }
    return shipment;
  }

  /* -------------------------------------------------------------- expéditions */
  async listShipments(user: CurrentUser) {
    const supplier = await this.requireSupplier(user);
    const rows = await this.prisma.shipment.findMany({
      where: { supplierId: supplier.id },
      orderBy: { openedAt: 'desc' },
    });
    return rows.map(toShipmentDto);
  }

  async openShipment(user: CurrentUser, requestId?: string | null) {
    const supplier = await this.requireSupplier(user);
    const now = new Date();
    const seq = await this.sequences.next('shipment', `supplier:${supplier.code}`, trackingPeriodKey(now));
    const code = composeShipmentCode({ at: now, seq });

    const shipment = await this.prisma.shipment.create({
      data: {
        code,
        supplierId: supplier.id,
        originAgencyId: supplier.defaultAgencyId,
        currency: supplier.billingCurrency,
        openedById: user.id,
      },
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'shipment',
      entityId: shipment.id,
      actorUserId: user.id,
      requestId,
      after: { code: shipment.code, supplierId: supplier.id },
    });
    return toShipmentDto(shipment);
  }

  async getShipmentDetail(shipmentId: string, user: CurrentUser) {
    const supplier = await this.requireSupplier(user);
    const shipment = await this.requireOwnedShipment(shipmentId, supplier.id);
    const parcels = await this.prisma.parcel.findMany({
      where: { shipmentId: shipment.id },
      include: { contacts: true, destinationCity: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...toShipmentDto(shipment),
      parcels: parcels.map((p) => {
        const recipient = p.contacts.find((c) => c.role === 'RECIPIENT');
        return {
          id: p.id,
          trackingNumber: p.trackingNumber,
          recipientName: recipient?.name ?? '',
          recipientPhone: recipient?.phone ?? null,
          destinationCityCode: p.destinationCity.code,
          destinationCityName: humanizeNameKey(p.destinationCity.nameKey),
          weightKg: p.weightKg.toString(),
          amountDue: p.amountDue.toString(),
          currency: p.billingCurrency,
          createdAt: p.createdAt.toISOString(),
        };
      }),
    };
  }

  /* ------------------------------------------------------------------- colis */
  async addParcel(
    shipmentId: string,
    input: SupplierPortalParcelCreateInput,
    user: CurrentUser,
    requestId?: string | null,
  ) {
    const supplier = await this.requireSupplier(user);
    const shipment = await this.requireOwnedShipment(shipmentId, supplier.id);
    if (shipment.status !== 'OUVERTE') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Expédition déjà clôturée ou annulée' },
      });
    }

    const [agency, destination] = await Promise.all([
      this.prisma.agency.findUniqueOrThrow({ where: { id: supplier.defaultAgencyId } }),
      this.prisma.city.findUnique({ where: { id: input.destinationCityId } }),
    ]);
    if (!destination || !destination.isActive || !destination.isDestination) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: 'Ville de destination invalide' },
      });
    }

    const now = new Date();
    const toRef = await this.fx.toReference(input.amount, supplier.billingCurrency, now);

    const seq = await this.sequences.next('tracking', destination.code, trackingPeriodKey(now));
    const trackingNumber = composeTrackingNumber({ at: now, seq, cityCode: destination.code });

    const parcel = await this.prisma.$transaction(async (tx) => {
      const created = await tx.parcel.create({
        data: {
          trackingNumber,
          registrationAgencyId: agency.id,
          registrationAgentId: user.id,
          countryId: agency.countryId,
          originCityId: agency.cityId,
          destinationCityId: destination.id,
          destinationCityCode: destination.code,
          transportMode: input.transportMode,
          weightKg: input.weightKg,
          contentNature: input.contentNature,
          declaredValue: 0,
          declaredValueCurrency: supplier.billingCurrency,
          billingCurrency: supplier.billingCurrency,
          amountDue: input.amount,
          balance: input.amount,
          referenceCurrency: this.fx.referenceCurrency,
          amountDueReference: toRef.amount,
          fxRateDue: toRef.rate,
          exchangeRateIdDue: toRef.exchangeRateId,
          pricingSnapshot: { source: 'supplier-portal', shipmentId: shipment.id, manualAmount: true },
          consentGiven: true,
          consentTextVersion: 'supplier-portal-v1',
          consentAt: now,
          supplierId: supplier.id,
          shipmentId: shipment.id,
          // WhatsApp est le canal principal des clients finaux de fournisseurs
          // — docs/11. Sans téléphone destinataire, pas de canal (silencieux).
          clientChannel: input.recipientPhone ? 'WHATSAPP' : undefined,
          createdById: user.id,
          contacts: {
            create: [
              { role: 'SENDER', name: supplier.name, phone: supplier.contactPhone, email: supplier.contactEmail },
              { role: 'RECIPIENT', name: input.recipientName, phone: input.recipientPhone ?? null },
            ],
          },
          events: {
            create: [{ status: 'ENREGISTRE', createdById: user.id }],
          },
        },
      });

      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          parcelCount: { increment: 1 },
          totalWeightKg: { increment: input.weightKg },
          totalAmountDue: { increment: input.amount },
          totalAmountDueReference: { increment: toRef.amount },
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
      after: { trackingNumber, shipmentId: shipment.id, supplierId: supplier.id },
    });

    // Notifie le client final (WhatsApp) et le fournisseur — sans bloquer la création.
    try {
      await this.notifications.enqueueForParcel(parcel.id, 'STATUS_CHANGE');
    } catch {
      // best effort — la création du colis n'est jamais bloquée par l'échec d'une notification.
    }

    return { id: parcel.id, trackingNumber: parcel.trackingNumber };
  }

  async removeParcel(shipmentId: string, parcelId: string, user: CurrentUser, requestId?: string | null) {
    const supplier = await this.requireSupplier(user);
    const shipment = await this.requireOwnedShipment(shipmentId, supplier.id);
    if (shipment.status !== 'OUVERTE') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Expédition déjà clôturée ou annulée' },
      });
    }
    const parcel = await this.prisma.parcel.findUnique({ where: { id: parcelId } });
    if (!parcel || parcel.shipmentId !== shipment.id) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Colis introuvable' } });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.parcel.update({
        where: { id: parcelId },
        data: { status: 'ANNULE', cancelReason: 'Retiré de l’expédition avant clôture', shipmentId: null },
      });
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          parcelCount: { decrement: 1 },
          totalWeightKg: { decrement: parcel.weightKg.toString() },
          totalAmountDue: { decrement: parcel.amountDue.toString() },
          totalAmountDueReference: { decrement: parcel.amountDueReference.toString() },
        },
      });
    });

    await this.audit.record({
      action: 'UPDATE',
      entityType: 'parcel',
      entityId: parcelId,
      actorUserId: user.id,
      requestId,
      after: { status: 'ANNULE', shipmentId: null },
    });
    return { id: parcelId };
  }

  /* -------------------------------------------------------------- clôture */
  async closeShipment(shipmentId: string, user: CurrentUser, requestId?: string | null) {
    const supplier = await this.requireSupplier(user);
    const shipment = await this.requireOwnedShipment(shipmentId, supplier.id);
    if (shipment.status !== 'OUVERTE') {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.CONFLICT, message: 'Expédition déjà clôturée ou annulée' },
      });
    }

    const parcels = await this.prisma.parcel.findMany({
      where: { shipmentId: shipment.id },
      include: { contacts: true, destinationCity: true },
      orderBy: { createdAt: 'asc' },
    });
    if (parcels.length === 0) {
      throw new BadRequestException({
        error: { code: API_ERROR_CODES.VALIDATION, message: 'Impossible de clôturer une expédition sans colis' },
      });
    }

    const now = new Date();
    let amountGross = '0';
    let amountReference = '0';
    for (const p of parcels) {
      amountGross = dAdd(amountGross, p.amountDue.toString());
      amountReference = dAdd(amountReference, p.amountDueReference.toString());
    }
    const toRef = await this.fx.toReference(amountGross, supplier.billingCurrency, now);

    const seq = await this.sequences.next('supplier_invoice', `supplier:${supplier.code}`, trackingPeriodKey(now));
    const number = composeSupplierInvoiceNumber({ at: now, seq, supplierCode: supplier.code });

    const invoice = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplierInvoice.create({
        data: {
          shipmentId: shipment.id,
          supplierId: supplier.id,
          number,
          currency: supplier.billingCurrency,
          amountGross,
          referenceCurrency: this.fx.referenceCurrency,
          amountReference,
          fxRate: toRef.rate,
          issuedById: user.id,
          legalMentionsSnapshot: { supplierCode: supplier.code, shipmentCode: shipment.code },
          lines: {
            create: parcels.map((p) => {
              const recipient = p.contacts.find((c) => c.role === 'RECIPIENT');
              return {
                parcelId: p.id,
                trackingNumber: p.trackingNumber,
                recipientName: recipient?.name ?? '',
                recipientPhone: recipient?.phone ?? null,
                destinationCityLabel: `${p.destinationCity.code} ${humanizeNameKey(p.destinationCity.nameKey)}`,
                weightKg: p.weightKg,
                amount: p.amountDue,
                currency: p.billingCurrency,
                amountReference: p.amountDueReference,
              };
            }),
          },
        },
        include: { lines: true },
      });

      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: 'CLOTUREE',
          closedAt: now,
          closedById: user.id,
          parcelCount: parcels.length,
          totalWeightKg: parcels.reduce((s, p) => s + Number(p.weightKg), 0),
          totalAmountDue: amountGross,
          totalAmountDueReference: amountReference,
        },
      });

      return created;
    });

    // Génération et stockage du PDF — best effort, ne bloque pas la clôture
    // si le stockage échoue (même pattern que BillingService.storePdf).
    try {
      const branding = await this.settings.branding();
      const colors: PdfBrandColors = { navy: String(branding.brand.navy), orange: String(branding.brand.orange) };
      const pdfBytes = await renderSupplierInvoicePdf({
        number: invoice.number,
        issuedAt: invoice.issuedAt.toISOString(),
        supplierName: supplier.name,
        supplierCode: supplier.code,
        shipmentCode: shipment.code,
        currency: invoice.currency,
        totalAmount: invoice.amountGross.toString(),
        legalMentions: `Émis par Okapi Logistics. Facture consolidée — expédition ${shipment.code}.`,
        slogan: 'Le futur du commerce africain',
        colors,
        lines: invoice.lines.map((l) => ({
          trackingNumber: l.trackingNumber,
          recipientName: l.recipientName,
          destinationCityLabel: l.destinationCityLabel,
          weightKg: l.weightKg.toString(),
          amount: l.amount.toString(),
        })),
      });
      const key = `suppliers/${supplier.id}/invoices/${invoice.number}.pdf`;
      await this.storage.putObject(key, pdfBytes, 'application/pdf');
      await this.prisma.supplierInvoice.update({ where: { id: invoice.id }, data: { storageKey: key } });
    } catch {
      // Le PDF pourra être régénéré/téléchargé plus tard ; la facture existe déjà en base.
    }

    await this.audit.record({
      action: 'CREATE',
      entityType: 'supplier_invoice',
      entityId: invoice.id,
      actorUserId: user.id,
      requestId,
      after: { number: invoice.number, shipmentId: shipment.id, amountGross },
    });

    return toInvoiceDto(invoice);
  }

  /* --------------------------------------------------------------- factures */
  async listInvoices(user: CurrentUser) {
    const supplier = await this.requireSupplier(user);
    const rows = await this.prisma.supplierInvoice.findMany({
      where: { supplierId: supplier.id },
      orderBy: { issuedAt: 'desc' },
    });
    return rows.map(toInvoiceDto);
  }

  async getInvoiceDetail(invoiceId: string, user: CurrentUser) {
    const supplier = await this.requireSupplier(user);
    const invoice = await this.prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    });
    if (!invoice || invoice.supplierId !== supplier.id) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Facture introuvable' } });
    }
    return {
      ...toInvoiceDto(invoice),
      lines: invoice.lines.map((l) => ({
        trackingNumber: l.trackingNumber,
        recipientName: l.recipientName,
        recipientPhone: l.recipientPhone,
        destinationCityLabel: l.destinationCityLabel,
        weightKg: l.weightKg.toString(),
        amount: l.amount.toString(),
        currency: l.currency,
      })),
    };
  }

  async getInvoicePdfUrl(invoiceId: string, user: CurrentUser): Promise<{ url: string }> {
    const supplier = await this.requireSupplier(user);
    const invoice = await this.prisma.supplierInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.supplierId !== supplier.id) {
      throw new NotFoundException({ error: { code: API_ERROR_CODES.NOT_FOUND, message: 'Facture introuvable' } });
    }
    if (!invoice.storageKey) {
      throw new NotFoundException({
        error: { code: API_ERROR_CODES.NOT_FOUND, message: 'PDF non disponible pour cette facture' },
      });
    }
    return this.storage.presignGet(invoice.storageKey, 'client');
  }
}

function toShipmentDto(row: {
  id: string;
  code: string;
  status: string;
  parcelCount: number;
  totalWeightKg: unknown;
  currency: string;
  totalAmountDue: unknown;
  referenceCurrency: string;
  totalAmountDueReference: unknown;
  openedAt: Date;
  closedAt: Date | null;
}) {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    parcelCount: row.parcelCount,
    totalWeightKg: String(row.totalWeightKg),
    currency: row.currency,
    totalAmountDue: String(row.totalAmountDue),
    referenceCurrency: row.referenceCurrency,
    totalAmountDueReference: String(row.totalAmountDueReference),
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  };
}

function toInvoiceDto(row: {
  id: string;
  number: string;
  shipmentId: string;
  currency: string;
  amountGross: unknown;
  referenceCurrency: string;
  amountReference: unknown;
  issuedAt: Date;
}) {
  return {
    id: row.id,
    number: row.number,
    shipmentId: row.shipmentId,
    currency: row.currency,
    amountGross: String(row.amountGross),
    referenceCurrency: row.referenceCurrency,
    amountReference: String(row.amountReference),
    issuedAt: row.issuedAt.toISOString(),
  };
}
