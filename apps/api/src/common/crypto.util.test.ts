import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  jwtSign,
  jwtVerify,
  JwtError,
  encryptSecret,
  decryptSecret,
  generateBase32Secret,
  totpVerify,
  sha256Hex,
} from './crypto.util';

test('JWT HS256 : signature et vérification', () => {
  const token = jwtSign({ sub: 'u1', email: 'a@b.c', sid: 's1' }, 'secret', 60);
  const payload = jwtVerify<{ sub: string; email: string; sid: string }>(token, 'secret');
  assert.equal(payload.sub, 'u1');
  assert.equal(payload.email, 'a@b.c');
  assert.ok(payload.exp > payload.iat);
});

test('JWT : mauvaise clé rejetée', () => {
  const token = jwtSign({ sub: 'u1' }, 'secret', 60);
  assert.throws(() => jwtVerify(token, 'autre'), JwtError);
});

test('JWT : jeton expiré rejeté', () => {
  const token = jwtSign({ sub: 'u1' }, 'secret', -1);
  assert.throws(() => jwtVerify(token, 'secret'), /expiré/);
});

test('chiffrement AES-256-GCM du secret TOTP', () => {
  const enc = encryptSecret('JBSWY3DPEHPK3PXP', 'master-key');
  assert.notEqual(enc, 'JBSWY3DPEHPK3PXP');
  assert.equal(decryptSecret(enc, 'master-key'), 'JBSWY3DPEHPK3PXP');
  assert.throws(() => decryptSecret(enc, 'mauvaise-cle'));
});

test('TOTP : un code généré maintenant est accepté', () => {
  const secret = generateBase32Secret();
  // reproduit HOTP pour le compteur courant
  const step = 30;
  const counter = Math.floor(Date.now() / 1000 / step);
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of secret) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', Buffer.from(bytes)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (
    (((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff)) %
    1_000_000
  )
    .toString()
    .padStart(6, '0');
  assert.equal(totpVerify(secret, code), true);
  assert.equal(totpVerify(secret, '000000'), totpVerify(secret, '000000')); // stable
});

test('sha256Hex', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
