import { dAdd, dSub, dCmp, dMax } from './decimal.js';
import type { PaymentState, PaymentStatus } from './enums.js';

/**
 * Statut de paiement et solde — RG-03 / EF-PAY-01 / EF-PAY-02.
 * Dérivés (jamais saisis) à partir des paiements confirmés d'un colis, dans la
 * devise de facturation. Le back-end matérialise le résultat sur `parcels`.
 */

export interface PaymentLike {
  state: PaymentState;
  /** montant converti dans la devise de facturation du colis */
  amountInBillingCurrency: string;
}

export interface Settlement {
  amountPaid: string;
  balance: string;
  paymentStatus: PaymentStatus;
}

export function computeSettlement(amountDue: string, payments: PaymentLike[]): Settlement {
  let confirmed = '0';
  let refunded = '0';
  for (const p of payments) {
    if (p.state === 'CONFIRME') confirmed = dAdd(confirmed, p.amountInBillingCurrency);
    else if (p.state === 'REMBOURSE') refunded = dAdd(refunded, p.amountInBillingCurrency);
  }
  const paid = dMax(dSub(confirmed, refunded), '0');
  const balance = dSub(amountDue, paid);

  let paymentStatus: PaymentStatus;
  if (dCmp(amountDue, '0') <= 0 || dCmp(paid, amountDue) >= 0) paymentStatus = 'PAYE';
  else if (dCmp(paid, '0') > 0) paymentStatus = 'PARTIEL';
  else paymentStatus = 'IMPAYE';

  return { amountPaid: paid, balance, paymentStatus };
}

export function isUnpaid(status: PaymentStatus): boolean {
  return status === 'IMPAYE' || status === 'PARTIEL';
}
