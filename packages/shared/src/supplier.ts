/** Fournisseurs, expéditions et factures fournisseurs — docs/11. */

// Alphabet sans I/O/0/1 (ambiguïté visuelle à la lecture/saisie manuelle).
const SUPPLIER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Code fournisseur anti-fraude, attribué par le système à la création —
 * jamais choisi par le fournisseur lui-même (docs/11 §1). Utilise l'API Web
 * Crypto (`globalThis.crypto`), disponible nativement côté Node >= 19 comme
 * côté navigateur — pas d'import `node:crypto` à isoler côté serveur.
 */
export function generateSupplierCode(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += SUPPLIER_CODE_ALPHABET[b % SUPPLIER_CODE_ALPHABET.length];
  return `FRN-${out}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Clé de période mensuelle `AAMM` (UTC) — même convention que `tracking.ts`. */
function periodKey(at: Date): string {
  return pad2(at.getUTCFullYear() % 100) + pad2(at.getUTCMonth() + 1);
}

export interface ComposeShipmentCodeInput {
  at?: Date;
  seq: number;
}

/** Code d'expédition `EXP` + `AAMM` + `NNNN`, séquentiel par fournisseur/mois — docs/11 §3. */
export function composeShipmentCode({ at = new Date(), seq }: ComposeShipmentCodeInput): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Séquentiel invalide : ${seq}`);
  }
  return `EXP${periodKey(at)}${String(seq).padStart(4, '0')}`;
}

export interface ComposeSupplierInvoiceNumberInput {
  at?: Date;
  seq: number;
  supplierCode: string;
}

/** Numéro de facture fournisseur `FACT-{code}-AAMM-NNNN` — docs/11 §3. */
export function composeSupplierInvoiceNumber({
  at = new Date(),
  seq,
  supplierCode,
}: ComposeSupplierInvoiceNumberInput): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Séquentiel invalide : ${seq}`);
  }
  return `FACT-${supplierCode}-${periodKey(at)}-${String(seq).padStart(4, '0')}`;
}
