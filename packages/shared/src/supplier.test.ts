import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeShipmentCode, composeSupplierInvoiceNumber, generateSupplierCode } from './supplier.js';

test('generateSupplierCode : format FRN-XXXXXX, alphabet sans caractères ambigus', () => {
  const code = generateSupplierCode();
  assert.match(code, /^FRN-[A-HJ-NP-Z2-9]{6}$/);
});

test('generateSupplierCode : pas de collision triviale sur un petit échantillon', () => {
  const codes = new Set(Array.from({ length: 50 }, () => generateSupplierCode()));
  assert.equal(codes.size, 50);
});

test('composeShipmentCode : EXP + AAMM + NNNN', () => {
  const at = new Date('2026-09-15T10:00:00Z');
  assert.equal(composeShipmentCode({ at, seq: 7 }), 'EXP26090007');
});

test('composeSupplierInvoiceNumber : FACT-{code}-AAMM-NNNN', () => {
  const at = new Date('2026-09-15T10:00:00Z');
  assert.equal(
    composeSupplierInvoiceNumber({ at, seq: 3, supplierCode: 'FRN-7K2M9X' }),
    'FACT-FRN-7K2M9X-2609-0003',
  );
});

test('composeShipmentCode : rejette un séquentiel invalide', () => {
  assert.throws(() => composeShipmentCode({ seq: 0 }));
});
