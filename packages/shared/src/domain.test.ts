import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote } from './pricing.js';
import { computeSettlement } from './payments.js';
import { composeTrackingNumber, parseTrackingNumber } from './tracking.js';
import { crossConvert } from './fx.js';
import { canTransition } from './enums.js';

test('quote : prix/kg × poids, plancher, ajustement', () => {
  const r = quote({ pricePerKg: '1.10', weightKg: '12.40', decimals: 2 });
  assert.equal(r.amount, '13.64');

  const withMin = quote({ pricePerKg: '0.45', weightKg: '2', minCharge: '5.00', decimals: 2 });
  assert.equal(withMin.amount, '5.00');
  assert.equal(withMin.breakdown.minChargeApplied, true);

  const discounted = quote({
    pricePerKg: '1.00',
    weightKg: '10',
    overridePct: '-0.15',
    decimals: 2,
  });
  assert.equal(discounted.amount, '8.50');
});

test('computeSettlement : statut de paiement dérivé', () => {
  const s = computeSettlement('13.64', [
    { state: 'CONFIRME', amountInBillingCurrency: '8.20' },
    { state: 'CONFIRME', amountInBillingCurrency: '0.44' },
    { state: 'EN_ATTENTE', amountInBillingCurrency: '3.00' },
  ]);
  assert.equal(s.amountPaid, '8.64');
  assert.equal(s.balance, '5.00');
  assert.equal(s.paymentStatus, 'PARTIEL');

  const paid = computeSettlement('10', [{ state: 'CONFIRME', amountInBillingCurrency: '10' }]);
  assert.equal(paid.paymentStatus, 'PAYE');
});

test('numéro de suivi : composition et relecture', () => {
  const at = new Date('2026-07-15T10:00:00Z');
  assert.equal(composeTrackingNumber({ at, seq: 42, cityCode: 'fih' }), 'OKP26070042FIH');
  const parts = parseTrackingNumber('OKP26070042FIH');
  assert.deepEqual(parts, { year: 2026, month: 7, seq: 42, cityCode: 'FIH' });
  assert.equal(parseTrackingNumber('bad'), null);
});

test('crossConvert : XOF -> USD via pivot', () => {
  // 1 XOF = 0.00164 USD ; USD = pivot -> toRate = "1"
  assert.equal(crossConvert('5000', 'XOF', 'USD', '0.00164', '1', 2), '8.20');
});

test('transitions de statut', () => {
  assert.equal(canTransition('ENREGISTRE', 'EN_TRANSIT'), true);
  assert.equal(canTransition('ENREGISTRE', 'LIVRE'), false);
  assert.equal(canTransition('LIVRE', 'ARRIVE'), false);
});
