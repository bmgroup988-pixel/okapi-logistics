import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryDisplayName, humanizeNameKey } from './geo-names.js';

test('humanizeNameKey : slugs tiretés (seed)', () => {
  assert.equal(humanizeNameKey('city.cotonou'), 'Cotonou');
  assert.equal(humanizeNameKey('city.dar-es-salaam'), 'Dar-es-Salaam');
  assert.equal(humanizeNameKey('city.pointe-noire'), 'Pointe-Noire');
  assert.equal(humanizeNameKey('city.mbuji-mayi'), 'Mbuji-Mayi');
});

test('humanizeNameKey : texte libre avec espaces (saisi via /admin/cities)', () => {
  assert.equal(humanizeNameKey('Dar es Salaam'), 'Dar es Salaam');
  assert.equal(humanizeNameKey('nairobi'), 'Nairobi');
});

test('humanizeNameKey : valeurs vides', () => {
  assert.equal(humanizeNameKey(null), '');
  assert.equal(humanizeNameKey(undefined), '');
  assert.equal(humanizeNameKey(''), '');
});

test('countryDisplayName : table statique puis repli sur humanizeNameKey', () => {
  assert.equal(countryDisplayName('BJ'), 'Bénin');
  assert.equal(countryDisplayName('CD'), 'RD Congo');
  assert.equal(countryDisplayName('XX', 'country.ruritanie'), 'Ruritanie');
  assert.equal(countryDisplayName('XX'), 'XX');
});
