import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type DocumentType } from '@prisma/client';
import { createHash } from 'node:crypto';
import { currencyDecimals, dAdd, dMul, dRound } from '@okapi/shared';
import type { Env } from '../config/env.schema';
import { FxService } from '../fx/fx.service';
import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../sequences/sequence.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { renderLabelPdf, renderReceiptPdf, type PdfBrandColors } from './pdf.util';

/**
 * Facturation — reçus, factures, avoirs (EF-PAY-07/08, RG-09).
 * Numérotation continue par pays. Les pièces sont immuables (append-only).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly storage: StorageService,
    private readonly fx: FxService,
    private readonly config: ConfigService<Env, true>,
    private readonly settings: SettingsService,
  ) {}

  private get contactEmail(): string {
    return this.config.get('CONTACT_EMAIL', { infer: true });
  }

  /** Couleurs de marque configurées (identité visuelle, W-SAD-03) — appliquées aux PDF générés. */
  private async brandColors(): Promise<PdfBrandColors> {
    const b = await this.settings.branding();
    return { navy: String(b.brand.navy), orange: String(b.brand.orange) };
  }

  private async pieceNumber(type: DocumentType, iso2: string, at: Date): Promise<string> {
    const scopeType = type.toLowerCase();
    const seq = await this.sequences.next(scopeType, `country:${iso2}`, 'ALL');
    return `${iso2}-${at.getUTCFullYear()}-${String(seq).padStart(6, '0')}`;
  }

  private async storePdf(
    parcelId: string,
    type: DocumentType,
    number: string | null,
    bytes: Uint8Array,
    paymentId?: string,
    invoiceId?: string,
  ): Promise<string> {
    const key = `parcels/${parcelId}/documents/${type.toLowerCase()}-${number ?? Date.now()}.pdf`;
    const checksum = createHash('sha256').update(bytes).digest('hex');
    try {
      await this.storage.putObject(key, bytes, 'application/pdf');
    } catch (err) {
      this.logger.warn(`Upload PDF différé (${type} ${number ?? ''}) : ${(err as Error).message}`);
    }
    await this.prisma.documentFile.create({
      data: {
        parcelId,
        paymentId: paymentId ?? null,
        invoiceId: invoiceId ?? null,
        type,
        storageKey: key,
        number,
        checksumSha256: checksum,
      },
    });
    return key;
  }

  /* --------------------------------------------- à l'enregistrement du colis */
  async onParcelRegistered(parcelId: string): Promise<void> {
    const p = await this.prisma.parcel.findUniqueOrThrow({
      where: { id: parcelId },
      include: { originCity: true, destinationCity: true, contacts: true, registrationAgency: { include: { country: true } } },
    });
    const sender = p.contacts.find((c) => c.role === 'SENDER');
    const recipient = p.contacts.find((c) => c.role === 'RECIPIENT');
    const trackingBase = this.config.get('PUBLIC_TRACKING_BASE_URL', { infer: true });
    const colors = await this.brandColors();

    // Étiquette
    const label = await renderLabelPdf({
      trackingNumber: p.trackingNumber,
      originCode: p.originCity.code,
      destinationCode: p.destinationCity.code,
      weightKg: p.weightKg.toString(),
      transportMode: p.transportMode,
      registeredAt: p.createdAt.toISOString(),
      senderName: sender?.name ?? '',
      senderPhone: sender?.phone ?? null,
      recipientName: recipient?.name ?? '',
      recipientPhone: recipient?.phone ?? null,
      trackingUrl: `${trackingBase}/${p.clientLocale}/suivi/${p.trackingNumber}`,
      colors,
    });
    await this.storePdf(parcelId, 'LABEL', null, label);

    // Reçu d'enregistrement
    const iso2 = p.registrationAgency.country.iso2;
    const number = await this.pieceNumber('REGISTRATION_RECEIPT', iso2, p.createdAt);
    const dp = currencyDecimals(p.billingCurrency);
    const receipt = await renderReceiptPdf({
      title: 'RECU D\'ENREGISTREMENT',
      number,
      issuedAt: p.createdAt.toISOString(),
      agencyName: p.registrationAgency.name,
      agencyPhone: p.registrationAgency.phone,
      contactEmail: this.contactEmail,
      trackingNumber: p.trackingNumber,
      lines: [
        { label: 'Trajet', value: `${p.originCity.code} -> ${p.destinationCity.code} (${p.transportMode})` },
        { label: 'Poids', value: `${p.weightKg.toString()} kg` },
        { label: 'Montant total du', value: `${p.amountDue.toFixed(dp)} ${p.billingCurrency}` },
        { label: 'Statut de paiement', value: p.paymentStatus },
      ],
      legalMentions: this.legalMentions(iso2, p.registrationAgency.country.taxRate.toString()),
      slogan: 'Le futur du commerce africain',
      colors,
    });
    await this.prisma.invoice.create({
      data: {
        parcelId,
        type: 'REGISTRATION_RECEIPT',
        number,
        countryId: p.countryId,
        amountNet: p.amountDue,
        amountTax: '0',
        amountGross: p.amountDue,
        currency: p.billingCurrency,
        amountReference: p.amountDueReference,
        referenceCurrency: p.referenceCurrency,
        fxRate: p.fxRateDue,
        legalMentionsSnapshot: { iso2, taxRate: p.registrationAgency.country.taxRate.toString() },
      },
    });
    await this.storePdf(parcelId, 'REGISTRATION_RECEIPT', number, receipt);
  }

  /* --------------------------------------------------- à chaque paiement */
  async onPaymentConfirmed(paymentId: string): Promise<void> {
    const pay = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { parcel: { include: { registrationAgency: { include: { country: true } } } } },
    });
    const parcel = pay.parcel;
    const iso2 = parcel.registrationAgency.country.iso2;
    const dp = currencyDecimals(parcel.billingCurrency);
    const number = await this.pieceNumber('PAYMENT_RECEIPT', iso2, new Date());
    const colors = await this.brandColors();

    const receipt = await renderReceiptPdf({
      title: 'RECU DE PAIEMENT',
      number,
      issuedAt: new Date().toISOString(),
      agencyName: parcel.registrationAgency.name,
      agencyPhone: parcel.registrationAgency.phone,
      contactEmail: this.contactEmail,
      trackingNumber: parcel.trackingNumber,
      lines: [
        { label: 'Montant recu', value: `${pay.amount.toString()} ${pay.currency}` },
        ...(pay.currency !== parcel.billingCurrency
          ? [
              {
                label: 'Contre-valeur',
                value: `${pay.amountInBillingCurrency.toFixed(dp)} ${parcel.billingCurrency} (taux ${pay.fxRateToBilling.toString()})`,
              },
            ]
          : []),
        { label: 'Moyen', value: `${pay.method}${pay.mobileMoneyProvider ? ` (${pay.mobileMoneyProvider})` : ''}` },
        ...(pay.externalRef ? [{ label: 'Reference', value: pay.externalRef }] : []),
        { label: 'Deja encaisse (cumul)', value: `${parcel.amountPaid.toFixed(dp)} ${parcel.billingCurrency}` },
        { label: 'SOLDE RESTANT', value: `${parcel.balance.toFixed(dp)} ${parcel.billingCurrency}` },
        { label: 'Statut', value: parcel.paymentStatus },
      ],
      legalMentions: this.legalMentions(iso2, parcel.registrationAgency.country.taxRate.toString()),
      slogan: 'Le futur du commerce africain',
      colors,
    });

    await this.prisma.invoice.create({
      data: {
        parcelId: parcel.id,
        type: 'PAYMENT_RECEIPT',
        number,
        countryId: parcel.countryId,
        paymentId: pay.id,
        amountNet: pay.amountInBillingCurrency,
        amountTax: '0',
        amountGross: pay.amountInBillingCurrency,
        currency: parcel.billingCurrency,
        amountReference: pay.amountReference,
        referenceCurrency: pay.referenceCurrency,
        fxRate: pay.fxRate,
        legalMentionsSnapshot: { iso2, method: pay.method, ref: pay.externalRef },
      },
    });
    await this.storePdf(parcel.id, 'PAYMENT_RECEIPT', number, receipt, pay.id);

    // Facture récapitulative à la clôture
    if (parcel.paymentStatus === 'PAYE') {
      await this.issueInvoice(parcel.id);
    }
  }

  async issueInvoice(parcelId: string): Promise<void> {
    const existing = await this.prisma.invoice.findFirst({ where: { parcelId, type: 'INVOICE' } });
    if (existing) return;
    const p = await this.prisma.parcel.findUniqueOrThrow({
      where: { id: parcelId },
      include: { originCity: true, destinationCity: true, registrationAgency: { include: { country: true } } },
    });
    const iso2 = p.registrationAgency.country.iso2;
    const taxRate = p.registrationAgency.country.taxRate.toString();
    const dp = currencyDecimals(p.billingCurrency);
    const net = dRound(p.amountDue.toString(), dp);
    const tax = dRound(dMul(net, taxRate), dp); // TVA 0 par défaut (D13)
    const gross = dRound(dAdd(net, tax), dp);
    const number = await this.pieceNumber('INVOICE', iso2, new Date());
    const colors = await this.brandColors();

    const pdf = await renderReceiptPdf({
      title: 'FACTURE',
      number,
      issuedAt: new Date().toISOString(),
      agencyName: p.registrationAgency.name,
      agencyPhone: p.registrationAgency.phone,
      contactEmail: this.contactEmail,
      trackingNumber: p.trackingNumber,
      lines: [
        { label: 'Trajet', value: `${p.originCity.code} -> ${p.destinationCity.code} (${p.transportMode})` },
        { label: 'Poids', value: `${p.weightKg.toString()} kg` },
        { label: 'Montant HT', value: `${net} ${p.billingCurrency}` },
        { label: `TVA (${taxRate})`, value: `${tax} ${p.billingCurrency}` },
        { label: 'Total TTC', value: `${gross} ${p.billingCurrency}` },
        { label: 'Statut', value: 'PAYE' },
      ],
      legalMentions: this.legalMentions(iso2, taxRate),
      slogan: 'Le futur du commerce africain',
      colors,
    });

    const inv = await this.prisma.invoice.create({
      data: {
        parcelId,
        type: 'INVOICE',
        number,
        countryId: p.countryId,
        amountNet: net,
        amountTax: tax,
        amountGross: gross,
        currency: p.billingCurrency,
        amountReference: p.amountDueReference,
        referenceCurrency: p.referenceCurrency,
        fxRate: p.fxRateDue,
        legalMentionsSnapshot: { iso2, taxRate },
      },
    });
    await this.storePdf(parcelId, 'INVOICE', number, pdf, undefined, inv.id);
  }

  async issueCreditNote(refundPaymentId: string): Promise<void> {
    const pay = await this.prisma.payment.findUniqueOrThrow({
      where: { id: refundPaymentId },
      include: { parcel: { include: { registrationAgency: { include: { country: true } } } } },
    });
    const parcel = pay.parcel;
    const iso2 = parcel.registrationAgency.country.iso2;
    const number = await this.pieceNumber('CREDIT_NOTE', iso2, new Date());
    const colors = await this.brandColors();
    const pdf = await renderReceiptPdf({
      title: 'AVOIR',
      number,
      issuedAt: new Date().toISOString(),
      agencyName: parcel.registrationAgency.name,
      agencyPhone: parcel.registrationAgency.phone,
      contactEmail: this.contactEmail,
      trackingNumber: parcel.trackingNumber,
      lines: [
        { label: 'Remboursement', value: `${pay.amountInBillingCurrency.toString()} ${parcel.billingCurrency}` },
        { label: 'Motif', value: pay.refundReason ?? '-' },
        { label: 'Solde restant', value: `${parcel.balance.toString()} ${parcel.billingCurrency}` },
      ],
      legalMentions: this.legalMentions(iso2, parcel.registrationAgency.country.taxRate.toString()),
      slogan: 'Le futur du commerce africain',
      colors,
    });
    const inv = await this.prisma.invoice.create({
      data: {
        parcelId: parcel.id,
        type: 'CREDIT_NOTE',
        number,
        countryId: parcel.countryId,
        paymentId: pay.id,
        amountNet: pay.amountInBillingCurrency,
        amountTax: '0',
        amountGross: pay.amountInBillingCurrency,
        currency: parcel.billingCurrency,
        amountReference: pay.amountReference,
        referenceCurrency: pay.referenceCurrency,
        fxRate: pay.fxRate,
        legalMentionsSnapshot: { iso2, reason: pay.refundReason },
      },
    });
    await this.storePdf(parcel.id, 'CREDIT_NOTE', number, pdf, pay.id, inv.id);
  }

  async listDocuments(parcelId: string) {
    const docs = await this.prisma.documentFile.findMany({
      where: { parcelId },
      orderBy: { generatedAt: 'asc' },
    });
    return docs.map((d) => ({
      id: d.id,
      type: d.type,
      number: d.number,
      generatedAt: d.generatedAt.toISOString(),
      url: this.storage.presignGet(d.storageKey, 'internal').url,
    }));
  }

  private legalMentions(iso2: string, taxRate: string): string {
    return `Emis par Okapi Logistics - ${iso2}. TVA ${taxRate}. Le futur du commerce africain.`;
  }
}
