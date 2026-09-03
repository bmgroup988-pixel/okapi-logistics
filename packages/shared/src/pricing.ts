import { dAdd, dMul, dCmp, dRound } from './decimal.js';

/**
 * Calcul du montant dû — EF-ENR-09, décision D6.
 *
 *   montant = prix_par_kg(destination, mode) × poids
 *           + frais_fixes                       (0 par défaut)
 *           + ad_valorem_rate × valeur_déclarée (si activé)
 *   plancher = min_charge                       (0 par défaut)
 *   ajustement agent = ± override_pct           (dans la fourchette autorisée)
 *
 * Fonction pure : la couche appelante fournit les paramètres tarifaires figés
 * (`pricing_snapshot`) et enregistre la dérogation si `overridePct != 0`.
 */

export interface QuoteInput {
  pricePerKg: string;
  weightKg: string;
  fixedFee?: string;
  minCharge?: string;
  adValoremEnabled?: boolean;
  adValoremRate?: string;
  declaredValue?: string;
  /** ajustement agent, ex. "-0.1" pour -10 %, "0.05" pour +5 % */
  overridePct?: string;
  /** décimales de la devise de facturation */
  decimals: number;
}

export interface QuoteBreakdown {
  base: string;
  fixedFee: string;
  adValorem: string;
  subtotal: string;
  minChargeApplied: boolean;
  overridePct: string;
  overrideAmount: string;
}

export interface QuoteResult {
  amount: string;
  breakdown: QuoteBreakdown;
}

export function quote(input: QuoteInput): QuoteResult {
  const fixedFee = input.fixedFee ?? '0';
  const minCharge = input.minCharge ?? '0';
  const overridePct = input.overridePct ?? '0';

  const base = dMul(input.pricePerKg, input.weightKg);
  const adValorem =
    input.adValoremEnabled && input.adValoremRate && input.declaredValue
      ? dMul(input.adValoremRate, input.declaredValue)
      : '0';

  let subtotal = dAdd(dAdd(base, fixedFee), adValorem);

  let minChargeApplied = false;
  if (dCmp(minCharge, '0') > 0 && dCmp(subtotal, minCharge) < 0) {
    subtotal = minCharge;
    minChargeApplied = true;
  }

  const overrideAmount = dCmp(overridePct, '0') === 0 ? '0' : dMul(subtotal, overridePct);
  const total = dRound(dAdd(subtotal, overrideAmount), input.decimals);

  return {
    amount: total,
    breakdown: {
      base: dRound(base, input.decimals + 2),
      fixedFee,
      adValorem: dRound(adValorem, input.decimals + 2),
      subtotal: dRound(subtotal, input.decimals + 2),
      minChargeApplied,
      overridePct,
      overrideAmount: dRound(overrideAmount, input.decimals + 2),
    },
  };
}

/** Vérifie que l'ajustement agent reste dans la fourchette autorisée du tarif. */
export function isOverrideWithinRange(
  overridePct: string,
  overrideMin: string,
  overrideMax: string,
): boolean {
  return dCmp(overridePct, overrideMin) >= 0 && dCmp(overridePct, overrideMax) <= 0;
}
