import { dMul, dDiv, dRound, type RoundingMode } from './decimal.js';
import { currencyDecimals, type CurrencyCode } from './money.js';

/**
 * Conversion de devises.
 *
 * Convention : un taux `rate` exprime « 1 unité de `base` = `rate` unités de la
 * devise pivot » (la devise de référence, USD par défaut — EF-DEV-05). Les
 * couples arbitraires passent par la pivot (produit croisé — RG-04).
 *
 * Aucune conversion « best effort » : si un taux manque, la couche appelante
 * doit bloquer la transaction (EF-DEV-08).
 */

export interface RateToPivot {
  currency: CurrencyCode;
  /** 1 `currency` = `rate` pivot */
  rate: string;
}

/** Convertit `amount` (dans `from`) vers la devise pivot, au taux fourni. */
export function toPivot(
  amount: string,
  fromRateToPivot: string,
  pivotDecimals = 2,
  mode: RoundingMode = 'HALF_UP',
): string {
  return dRound(dMul(amount, fromRateToPivot), pivotDecimals, mode);
}

/** Convertit depuis la devise pivot vers `to`, au taux fourni. */
export function fromPivot(
  pivotAmount: string,
  toRateToPivot: string,
  toDecimals: number,
  mode: RoundingMode = 'HALF_UP',
): string {
  return dDiv(pivotAmount, toRateToPivot, toDecimals, mode);
}

/**
 * Convertit `amount` de `from` vers `to` via la pivot.
 * `fromRate` et `toRate` sont les taux « 1 unité → pivot » de chaque devise.
 * Si l'une des devises EST la pivot, passer `"1"` comme taux correspondant.
 */
export function crossConvert(
  amount: string,
  from: CurrencyCode,
  to: CurrencyCode,
  fromRateToPivot: string,
  toRateToPivot: string,
  toDecimalsOverride?: number,
  mode: RoundingMode = 'HALF_UP',
): string {
  const toDecimals = toDecimalsOverride ?? currencyDecimals(to);
  if (from === to) return dRound(amount, toDecimals, mode);
  // amount * (from→pivot) / (to→pivot)
  const inPivot = dMul(amount, fromRateToPivot);
  return dDiv(inPivot, toRateToPivot, toDecimals, mode);
}

/** Taux effectif `from → to` (utile pour figer `fx_rate` sur une transaction). */
export function effectiveRate(
  fromRateToPivot: string,
  toRateToPivot: string,
  ratePrecision = 8,
  mode: RoundingMode = 'HALF_UP',
): string {
  return dDiv(fromRateToPivot, toRateToPivot, ratePrecision, mode);
}
