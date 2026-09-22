/**
 * Groupage — regroupement de colis (walk-in et/ou fournisseur) pour un même
 * trajet/transit, indépendant de la facturation (déjà réglée à l'enregistrement
 * de chaque colis). Permet de savoir précisément, colis par colis, lesquels
 * d'un lot donné sont effectivement partis / arrivés — demande produit du
 * 2026-09-22.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Clé de période mensuelle `AAMM` (UTC) — même convention que `tracking.ts`. */
function periodKey(at: Date): string {
  return pad2(at.getUTCFullYear() % 100) + pad2(at.getUTCMonth() + 1);
}

export interface ComposeGroupageCodeInput {
  at?: Date;
  seq: number;
}

/** Code de groupage `GRP` + `AAMM` + `NNNN`, séquentiel global, mensuel. */
export function composeGroupageCode({ at = new Date(), seq }: ComposeGroupageCodeInput): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Séquentiel invalide : ${seq}`);
  }
  return `GRP${periodKey(at)}${String(seq).padStart(4, '0')}`;
}
