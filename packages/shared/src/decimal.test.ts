import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dAdd, dSub, dMul, dDiv, dRound, dCmp } from './decimal.js';

test('dAdd / dSub gardent la précision', () => {
  assert.equal(dAdd('0.1', '0.2'), '0.3');
  assert.equal(dSub('13.64', '8.64'), '5.00');
  assert.equal(dAdd('-5', '5'), '0');
});

test('dMul concatène les échelles', () => {
  assert.equal(dMul('1.10', '12.40'), '13.6400');
  assert.equal(dMul('0.00164', '5000'), '8.20000');
});

test('dDiv arrondit à la précision demandée', () => {
  assert.equal(dDiv('10', '3', 2), '3.33');
  assert.equal(dDiv('8.20', '0.00164', 2), '5000.00');
});

test('dRound HALF_UP et HALF_EVEN', () => {
  assert.equal(dRound('2.345', 2), '2.35');
  assert.equal(dRound('2.344', 2), '2.34');
  assert.equal(dRound('-2.345', 2), '-2.35');
  assert.equal(dRound('2.345', 2, 'HALF_EVEN'), '2.34');
  assert.equal(dRound('2.355', 2, 'HALF_EVEN'), '2.36');
});

test('dCmp', () => {
  assert.equal(dCmp('5.00', '5'), 0);
  assert.equal(dCmp('4.99', '5'), -1);
  assert.equal(dCmp('5.01', '5'), 1);
});
