import { PDFDocument, StandardFonts, rgb, type RGB } from 'pdf-lib';
import QRCode from 'qrcode';

const DEFAULT_NAVY = rgb(0x17 / 255, 0x06 / 255, 0x55 / 255);
const DEFAULT_ORANGE = rgb(0xe4 / 255, 0x79 / 255, 0x11 / 255);
const INK = rgb(0.15, 0.15, 0.18);
const MUTE = rgb(0.42, 0.42, 0.46);

/** Couleurs de marque configurables (identité visuelle, W-SAD-03) — voir SettingsService.branding(). */
export interface PdfBrandColors {
  navy?: string;
  orange?: string;
}

function hexToRgb(hex: string | undefined, fallback: RGB): RGB {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex ?? '');
  if (!m) return fallback;
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function copyrightLine(): string {
  return `(C) ${new Date().getFullYear()} Global Okapi Group. Tous droits reserves.`;
}

export interface LabelData {
  trackingNumber: string;
  originCode: string;
  destinationCode: string;
  weightKg: string;
  transportMode: string;
  registeredAt: string; // ISO
  senderName: string;
  senderPhone: string | null;
  recipientName: string;
  recipientPhone: string | null;
  trackingUrl: string;
  colors?: PdfBrandColors;
}

export interface ReceiptLine {
  label: string;
  value: string;
}

export interface ReceiptData {
  title: string; // "REÇU" / "FACTURE" / "AVOIR"
  number: string;
  issuedAt: string;
  agencyName: string;
  agencyPhone: string | null;
  contactEmail: string;
  trackingNumber: string;
  lines: ReceiptLine[];
  legalMentions: string;
  slogan: string;
  colors?: PdfBrandColors;
}

/** Étiquette colis 100 × 150 mm (≈ 283 × 425 pt) — EF-ENR-10. */
export async function renderLabelPdf(d: LabelData): Promise<Uint8Array> {
  const NAVY = hexToRgb(d.colors?.navy, DEFAULT_NAVY);
  const doc = await PDFDocument.create();
  const page = doc.addPage([283, 425]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 8, y: 8, width: 267, height: 409, borderColor: NAVY, borderWidth: 1.5 });
  page.drawText('OKAPI LOGISTICS', { x: 18, y: 396, size: 12, font: bold, color: NAVY });
  page.drawText(d.transportMode === 'AIR' ? 'Aerien' : 'Maritime', { x: 210, y: 398, size: 9, font, color: MUTE });

  const qrPng = await QRCode.toBuffer(d.trackingUrl, { type: 'png', margin: 1, width: 150 });
  const qrImg = await doc.embedPng(qrPng);
  page.drawImage(qrImg, { x: 18, y: 250, width: 120, height: 120 });

  page.drawText(d.trackingNumber, { x: 150, y: 330, size: 13, font: bold, color: INK });
  page.drawText(`${d.originCode}  ->  ${d.destinationCode}`, { x: 150, y: 308, size: 11, font, color: INK });
  page.drawText(`${d.weightKg} kg`, { x: 150, y: 290, size: 10, font, color: MUTE });
  page.drawText(new Date(d.registeredAt).toISOString().slice(0, 10), { x: 150, y: 274, size: 10, font, color: MUTE });

  let y = 220;
  const row = (k: string, v: string) => {
    page.drawText(k, { x: 18, y, size: 8, font: bold, color: MUTE });
    page.drawText(v, { x: 18, y: y - 12, size: 10, font, color: INK });
    y -= 34;
  };
  row('EXPEDITEUR', `${d.senderName}${d.senderPhone ? ' - ' + d.senderPhone : ''}`);
  row('DESTINATAIRE', `${d.recipientName}${d.recipientPhone ? ' - ' + d.recipientPhone : ''}`);

  page.drawText('Suivi :', { x: 18, y: 60, size: 8, font: bold, color: MUTE });
  page.drawText(d.trackingUrl, { x: 18, y: 48, size: 7, font, color: NAVY });
  page.drawText(copyrightLine(), { x: 18, y: 20, size: 6, font, color: MUTE });

  return doc.save();
}

/** Reçu / facture / avoir A5 (≈ 420 × 595 pt) — EF-PAY-07 / RG-09. */
export async function renderReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const NAVY = hexToRgb(d.colors?.navy, DEFAULT_NAVY);
  const ORANGE = hexToRgb(d.colors?.orange, DEFAULT_ORANGE);
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 595]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText('OKAPI LOGISTICS', { x: 32, y: 555, size: 14, font: bold, color: NAVY });
  page.drawText(`${d.title} N° ${d.number}`, { x: 32, y: 534, size: 11, font: bold, color: INK });
  page.drawText(new Date(d.issuedAt).toISOString().replace('T', ' ').slice(0, 16), {
    x: 300,
    y: 534,
    size: 9,
    font,
    color: MUTE,
  });
  page.drawText(`${d.agencyName}${d.agencyPhone ? ' - ' + d.agencyPhone : ''}`, { x: 32, y: 518, size: 9, font, color: MUTE });
  page.drawText(d.contactEmail, { x: 32, y: 506, size: 9, font, color: MUTE });
  page.drawText(`Colis : ${d.trackingNumber}`, { x: 32, y: 486, size: 10, font: bold, color: INK });

  page.drawLine({ start: { x: 32, y: 476 }, end: { x: 388, y: 476 }, thickness: 0.75, color: MUTE });

  let y = 456;
  for (const l of d.lines) {
    page.drawText(l.label, { x: 32, y, size: 9, font, color: MUTE });
    page.drawText(l.value, { x: 388 - bold.widthOfTextAtSize(l.value, 10), y, size: 10, font: bold, color: INK });
    y -= 20;
  }

  page.drawLine({ start: { x: 32, y: y - 4 }, end: { x: 388, y: y - 4 }, thickness: 0.75, color: MUTE });
  page.drawText(d.legalMentions, { x: 32, y: 50, size: 7, font, color: MUTE, maxWidth: 356, lineHeight: 9 });
  page.drawText(d.slogan, { x: 32, y: 30, size: 8, font: bold, color: ORANGE });
  page.drawText(copyrightLine(), { x: 32, y: 16, size: 6, font, color: MUTE });

  return doc.save();
}

export interface SupplierInvoiceLineData {
  trackingNumber: string;
  recipientName: string;
  destinationCityLabel: string;
  weightKg: string;
  amount: string;
}

export interface SupplierInvoiceData {
  number: string;
  issuedAt: string;
  supplierName: string;
  supplierCode: string;
  shipmentCode: string;
  currency: string;
  lines: SupplierInvoiceLineData[];
  totalAmount: string;
  legalMentions: string;
  slogan: string;
  colors?: PdfBrandColors;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Facture fournisseur consolidée — une ligne par client final d'une
 * expédition groupée (docs/11, §2.4/§4/§7). Hauteur de page ajustée au
 * nombre de lignes (page unique, pas de pagination multi-pages).
 */
export async function renderSupplierInvoicePdf(d: SupplierInvoiceData): Promise<Uint8Array> {
  const NAVY = hexToRgb(d.colors?.navy, DEFAULT_NAVY);
  const ORANGE = hexToRgb(d.colors?.orange, DEFAULT_ORANGE);
  const rowHeight = 16;
  const headerHeight = 150;
  const footerHeight = 100;
  const height = Math.max(420, headerHeight + footerHeight + d.lines.length * rowHeight);

  const doc = await PDFDocument.create();
  const page = doc.addPage([420, height]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 40;
  page.drawText('OKAPI LOGISTICS', { x: 32, y, size: 14, font: bold, color: NAVY });
  y -= 20;
  page.drawText(`FACTURE N° ${d.number}`, { x: 32, y, size: 11, font: bold, color: INK });
  page.drawText(new Date(d.issuedAt).toISOString().replace('T', ' ').slice(0, 16), {
    x: 300,
    y,
    size: 9,
    font,
    color: MUTE,
  });
  y -= 18;
  page.drawText(`Fournisseur : ${d.supplierName} (${d.supplierCode})`, { x: 32, y, size: 9, font, color: MUTE });
  y -= 14;
  page.drawText(`Expédition : ${d.shipmentCode}`, { x: 32, y, size: 9, font, color: MUTE });
  y -= 20;

  page.drawLine({ start: { x: 32, y }, end: { x: 388, y }, thickness: 0.75, color: MUTE });
  y -= 14;
  page.drawText('Colis', { x: 32, y, size: 8, font: bold, color: MUTE });
  page.drawText('Client', { x: 100, y, size: 8, font: bold, color: MUTE });
  page.drawText('Ville', { x: 220, y, size: 8, font: bold, color: MUTE });
  page.drawText('Poids', { x: 300, y, size: 8, font: bold, color: MUTE });
  page.drawText('Montant', { x: 340, y, size: 8, font: bold, color: MUTE });
  y -= 12;
  page.drawLine({ start: { x: 32, y }, end: { x: 388, y }, thickness: 0.5, color: MUTE });
  y -= 14;

  for (const l of d.lines) {
    page.drawText(l.trackingNumber, { x: 32, y, size: 7, font, color: INK });
    page.drawText(truncate(l.recipientName, 20), { x: 100, y, size: 7, font, color: INK });
    page.drawText(truncate(l.destinationCityLabel, 16), { x: 220, y, size: 7, font, color: INK });
    page.drawText(`${l.weightKg}kg`, { x: 300, y, size: 7, font, color: INK });
    page.drawText(l.amount, { x: 388 - font.widthOfTextAtSize(l.amount, 7), y, size: 7, font, color: INK });
    y -= rowHeight;
  }

  y -= 4;
  page.drawLine({ start: { x: 32, y }, end: { x: 388, y }, thickness: 0.75, color: MUTE });
  y -= 18;
  page.drawText('TOTAL', { x: 300, y, size: 10, font: bold, color: INK });
  const totalStr = `${d.totalAmount} ${d.currency}`;
  page.drawText(totalStr, { x: 388 - bold.widthOfTextAtSize(totalStr, 11), y, size: 11, font: bold, color: NAVY });

  page.drawText(d.legalMentions, { x: 32, y: 50, size: 7, font, color: MUTE, maxWidth: 356, lineHeight: 9 });
  page.drawText(d.slogan, { x: 32, y: 30, size: 8, font: bold, color: ORANGE });
  page.drawText(copyrightLine(), { x: 32, y: 16, size: 6, font, color: MUTE });

  return doc.save();
}
