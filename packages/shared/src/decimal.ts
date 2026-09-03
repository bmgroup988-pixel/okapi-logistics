/**
 * Décimal à virgule fixe basé sur `bigint` — aucune arithmétique flottante.
 *
 * Toutes les valeurs monétaires et les taux transitent sous forme de chaînes
 * (`"1234.5678"`), comme en base (`NUMERIC(18,4)` pour la monnaie, `NUMERIC(18,8)`
 * pour les taux). Ce module fournit les opérations exactes utilisées par
 * `money.ts`, `fx.ts` et `pricing.ts`.
 */

export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'UP' | 'DOWN';

interface Parts {
  neg: boolean;
  /** mantisse entière non signée, sans zéros de tête superflus */
  mantissa: bigint;
  /** nombre de chiffres après la virgule */
  scale: number;
}

const DECIMAL_RE = /^\s*(-?)(\d+)(?:\.(\d+))?\s*$/;

function parse(input: string): Parts {
  const m = DECIMAL_RE.exec(input);
  if (!m) throw new Error(`Nombre décimal invalide : ${JSON.stringify(input)}`);
  const neg = m[1] === '-';
  const intPart = m[2] ?? '0';
  const frac = m[3] ?? '';
  const mantissa = BigInt((intPart + frac).replace(/^0+(?=\d)/, ''));
  return { neg: neg && mantissa !== 0n, mantissa, scale: frac.length };
}

function signed(p: Parts): bigint {
  return p.neg ? -p.mantissa : p.mantissa;
}

function align(a: Parts, b: Parts): { a: bigint; b: bigint; scale: number } {
  const scale = Math.max(a.scale, b.scale);
  return {
    a: signed(a) * 10n ** BigInt(scale - a.scale),
    b: signed(b) * 10n ** BigInt(scale - b.scale),
    scale,
  };
}

function format(value: bigint, scale: number): string {
  const neg = value < 0n;
  const digits = (neg ? -value : value).toString().padStart(scale + 1, '0');
  const cut = digits.length - scale;
  const intPart = digits.slice(0, cut);
  const fracPart = scale > 0 ? '.' + digits.slice(cut) : '';
  return (neg ? '-' : '') + intPart + fracPart;
}

export function dAdd(a: string, b: string): string {
  const x = align(parse(a), parse(b));
  return format(x.a + x.b, x.scale);
}

export function dSub(a: string, b: string): string {
  const x = align(parse(a), parse(b));
  return format(x.a - x.b, x.scale);
}

export function dMul(a: string, b: string): string {
  const pa = parse(a);
  const pb = parse(b);
  return format(signed(pa) * signed(pb), pa.scale + pb.scale);
}

export function dCmp(a: string, b: string): -1 | 0 | 1 {
  const x = align(parse(a), parse(b));
  return x.a < x.b ? -1 : x.a > x.b ? 1 : 0;
}

export function dRound(value: string, dp: number, mode: RoundingMode = 'HALF_UP'): string {
  if (dp < 0) throw new Error('dp doit être >= 0');
  const p = parse(value);
  if (p.scale <= dp) {
    return format(signed(p) * 10n ** BigInt(dp - p.scale), dp);
  }
  const drop = p.scale - dp;
  const divisor = 10n ** BigInt(drop);
  const abs = p.mantissa;
  const quotient = abs / divisor;
  const remainder = abs % divisor;

  let roundUp = false;
  const doubled = remainder * 2n;
  switch (mode) {
    case 'UP':
      roundUp = remainder > 0n;
      break;
    case 'DOWN':
      roundUp = false;
      break;
    case 'HALF_UP':
      roundUp = doubled >= divisor;
      break;
    case 'HALF_EVEN':
      if (doubled > divisor) roundUp = true;
      else if (doubled === divisor) roundUp = quotient % 2n === 1n;
      break;
  }
  const result = quotient + (roundUp ? 1n : 0n);
  return format(p.neg ? -result : result, dp);
}

export function dDiv(a: string, b: string, dp: number, mode: RoundingMode = 'HALF_UP'): string {
  const pa = parse(a);
  const pb = parse(b);
  if (pb.mantissa === 0n) throw new Error('Division par zéro');
  const guard = dp + 2;
  const numerator = signed(pa) * 10n ** BigInt(pb.scale + guard);
  const quotient = numerator / signed(pb);
  const quotientScale = pa.scale + guard;
  return dRound(format(quotient, quotientScale), dp, mode);
}

export function dIsNegative(a: string): boolean {
  return dCmp(a, '0') < 0;
}

export function dMax(a: string, b: string): string {
  return dCmp(a, b) >= 0 ? a : b;
}

export function dMin(a: string, b: string): string {
  return dCmp(a, b) <= 0 ? a : b;
}

/** Normalise vers `dp` décimales exactement (utile pour comparer/afficher). */
export function dScale(a: string, dp: number, mode: RoundingMode = 'HALF_UP'): string {
  return dRound(a, dp, mode);
}
