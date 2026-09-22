/**
 * Numéro de suivi — RG-01 / EF-ENR-07 / EF-ENR-08, décision D2 (révisée le
 * jour de l'enregistrement s'affiche désormais dans le code, demande produit
 * du 2026-09-22).
 *
 * Structure : `OKP` + `JJ` + `MM` + `AA` (jour/mois/année d'enregistrement)
 * + séquentiel + code IATA ville de destination. Le séquentiel reste **propre
 * à chaque ville de destination** et **remis à zéro chaque mois** (pas
 * chaque jour — il continue de s'incrémenter tout le mois, ex. 100 colis le
 * 1er, le colis du 2 démarre à 101) ; il est complété à gauche par des zéros
 * sur au moins 4 chiffres, et s'étend à 5+ chiffres en cas de débordement
 * (> 9999 pour une destination dans le mois).
 *
 * Exemple : `OKP2209260042FIH` = 42ᵉ colis à destination de Kinshasa (FIH),
 * enregistré le 22 septembre 2026.
 *
 * Compatibilité : les numéros déjà émis avant ce changement (format
 * `OKP` + `AA` + `MM` + séquentiel + ville, sans le jour) restent valides et
 * continuent d'être reconnus par `parseTrackingNumber` / `isValidTrackingNumber`
 * — seuls les nouveaux colis utilisent le nouveau format à partir de leur
 * enregistrement.
 */

export const TRACKING_PREFIX = 'OKP';
/** Nouveau format (avec jour) : OKP + JJMMAA(6) + séquentiel(4+) + ville(3). */
export const TRACKING_RE = /^OKP(\d{2})(\d{2})(\d{2})(\d{4,})([A-Z]{3})$/;
/** Ancien format (sans jour, pré-2026-09-22) : OKP + AAMM(4) + séquentiel(4+) + ville(3). */
export const TRACKING_RE_LEGACY = /^OKP(\d{2})(\d{2})(\d{4,})([A-Z]{3})$/;
export const MIN_SEQ_DIGITS = 4;

export interface TrackingParts {
  year: number; // 2 chiffres -> 20xx
  month: number; // 1..12
  /** Jour d'enregistrement — absent sur les numéros émis avant le 2026-09-22 (ancien format). */
  day: number | null;
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

/**
 * Clé de période mensuelle `AAMM` (UTC) utilisée par la table `sequences`
 * pour le compteur (remise à zéro mensuelle) — aussi réutilisée telle quelle
 * pour les codes d'expédition/facture fournisseur (`supplier.ts`). Ne pas
 * confondre avec `trackingDateKey`, purement l'affichage du jour dans le
 * numéro de suivi : le *compteur* reste mensuel même si le *code affiché*
 * montre désormais le jour exact.
 */
export function trackingPeriodKey(at: Date = new Date()): string {
  return pad2(at.getUTCFullYear() % 100) + pad2(at.getUTCMonth() + 1);
}

/** Clé de date `JJMMAA` (UTC) affichée dans le numéro de suivi. */
function trackingDateKey(at: Date): string {
  return pad2(at.getUTCDate()) + pad2(at.getUTCMonth() + 1) + pad2(at.getUTCFullYear() % 100);
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
  return `${TRACKING_PREFIX}${trackingDateKey(at)}${seqStr}${code}`;
}

export function parseTrackingNumber(input: string): TrackingParts | null {
  const normalized = input.trim().toUpperCase();
  const m = TRACKING_RE.exec(normalized);
  if (m) {
    return {
      day: Number(m[1]),
      month: Number(m[2]),
      year: 2000 + Number(m[3]),
      seq: Number(m[4]),
      cityCode: m[5]!,
    };
  }
  // Repli sur l'ancien format (numéros émis avant l'ajout du jour) — jamais
  // généré pour un nouveau colis, seulement reconnu en lecture.
  const legacy = TRACKING_RE_LEGACY.exec(normalized);
  if (legacy) {
    return {
      day: null,
      year: 2000 + Number(legacy[1]),
      month: Number(legacy[2]),
      seq: Number(legacy[3]),
      cityCode: legacy[4]!,
    };
  }
  return null;
}

export function isValidTrackingNumber(input: string): boolean {
  const p = parseTrackingNumber(input);
  if (!p || p.month < 1 || p.month > 12) return false;
  if (p.day !== null && (p.day < 1 || p.day > 31)) return false;
  return true;
}
