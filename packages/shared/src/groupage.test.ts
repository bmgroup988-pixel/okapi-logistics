import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeGroupageCode } from './groupage.js';

test('composeGroupageCode : GRP + AAMM + NNNN', () => {
  const at = new Date('2026-09-15T10:00:00Z');
  assert.equal(composeGroupageCode({ at, seq: 7 }), 'GRP26090007');
});

test('composeGroupageCode : rejette un séquentiel invalide', () => {
  assert.throws(() => composeGroupageCode({ seq: 0 }));
});
