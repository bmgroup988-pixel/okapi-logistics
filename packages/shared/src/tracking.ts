/**
 * Numéro de suivi — RG-01 / EF-ENR-07 / EF-ENR-08, décision D2.
 *
 * Structure : `OKP` + `AA` + `MM` + séquentiel + code IATA ville de destination.
 * Le séquentiel est **propre à chaque ville de destination** et **remis à zéro
 * chaque mois** ; il est complété à gauche par des zéros sur au moins 4 chiffres,
 * et s'étend à 5+ chiffres en cas de débordement (> 9999 pour une destination
 * dans le mois).
 *
 * Exemple : `OKP26070042FIH` = 42ᵉ colis à destination de Kinshasa (FIH) en
 * juillet 2026.
 */

export const TRACKING_PREFIX = 'OKP';
export const TRACKING_RE = /^OKP(\d{2})(\d{2})(\d{4,})([A-Z]{3})$/;
export const MIN_SEQ_DIGITS = 4;

export interface TrackingParts {
  year: number; // 2 chiffres -> 20xx
  month: number; // 1..12
  seq: number;
  cityCode: string; // 3 lettres majuscules (code IATA)
}

export interface ComposeInput {
  /** date de référence (UTC) — par défaut maintenant */
  at?: Date;
  seq: number;
  /** code IATA de la ville de destination, 3 lettres */
  cityCode: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Clé de période mensuelle `AAMM` (UTC) utilisée par la table `sequences`. */
export function trackingPeriodKey(at: Date = new Date()): string {
  return pad2(at.getUTCFullYear() % 100) + pad2(at.getUTCMonth() + 1);
}

export function composeTrackingNumber({ at = new Date(), seq, cityCode }: ComposeInput): string {
  const code = cityCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error(`Code ville invalide (3 lettres attendues) : ${JSON.stringify(cityCode)}`);
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Séquentiel invalide : ${seq}`);
  }
  const seqStr = String(seq).padStart(MIN_SEQ_DIGITS, '0');
  return `${TRACKING_PREFIX}${trackingPeriodKey(at)}${seqStr}${code}`;
}

export function parseTrackingNumber(input: string): TrackingParts | null {
  const m = TRACKING_RE.exec(input.trim().toUpperCase());
  if (!m) return null;
  return {
    year: 2000 + Number(m[1]),
    month: Number(m[2]),
    seq: Number(m[3]),
    cityCode: m[4]!,
  };
}

export function isValidTrackingNumber(input: string): boolean {
  const p = parseTrackingNumber(input);
  return !!p && p.month >= 1 && p.month <= 12;
}
