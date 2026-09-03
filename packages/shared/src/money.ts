import { dRound, dCmp, type RoundingMode } from './decimal.js';

/**
 * Devises prises en charge nativement (D3/D4). Toute autre devise s'ajoute par
 * configuration en base sans modification du code ; cette table sert de repli
 * pour les décimales et le symbole quand la ligne `currencies` n'est pas chargée.
 */
export const CURRENCY_META = {
  USD: { decimals: 2, symbol: '$' },
  EUR: { decimals: 2, symbol: '€' },
  XOF: { decimals: 0, symbol: 'FCFA' },
  CDF: { decimals: 2, symbol: 'FC' },
  XAF: { decimals: 0, symbol: 'FCFA' },
  ZAR: { decimals: 2, symbol: 'R' },
  RWF: { decimals: 0, symbol: 'FRw' },
  BIF: { decimals: 0, symbol: 'FBu' },
  TZS: { decimals: 2, symbol: 'TSh' },
  GBP: { decimals: 2, symbol: '£' },
  CNY: { decimals: 2, symbol: '¥' },
  NGN: { decimals: 2, symbol: '₦' },
} as const;

export type KnownCurrency = keyof typeof CURRENCY_META;
/** Code ISO 4217 : les devises configurées en base peuvent dépasser cette liste. */
export type CurrencyCode = KnownCurrency | (string & {});

export const REFERENCE_CURRENCY: CurrencyCode = 'USD';

export interface Money {
  /** Chaîne décimale, jamais un nombre flottant. */
  amount: string;
  currency: CurrencyCode;
}

export function currencyDecimals(currency: CurrencyCode, fallback = 2): number {
  return (CURRENCY_META as Record<string, { decimals: number }>)[currency]?.decimals ?? fallback;
}

export function currencySymbol(currency: CurrencyCode): string {
  return (CURRENCY_META as Record<string, { symbol: string }>)[currency]?.symbol ?? currency;
}

/** Construit un `Money` en arrondissant au nombre de décimales de la devise. */
export function money(
  amount: string,
  currency: CurrencyCode,
  mode: RoundingMode = 'HALF_UP',
  decimalsOverride?: number,
): Money {
  const dp = decimalsOverride ?? currencyDecimals(currency);
  return { amount: dRound(amount, dp, mode), currency };
}

export function isZero(m: Money): boolean {
  return dCmp(m.amount, '0') === 0;
}

export function formatMoney(m: Money, locale = 'fr'): string {
  const dp = currencyDecimals(m.currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: m.currency,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(Number(m.amount));
  } catch {
    return `${m.amount} ${currencySymbol(m.currency)}`;
  }
}
