import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';

/* --------------------------------- Hachage / jetons opaques --------------------------------- */

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function randomTokenB64Url(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/* --------------------------------- JWT HS256 (sans dépendance) --------------------------------- */

export interface JwtStandardClaims {
  iat: number;
  exp: number;
}

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function jwtSign<T extends object>(
  payload: T,
  secret: string,
  expiresInSec: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const data = `${head}.${b64urlJson(body)}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export class JwtError extends Error {}

export function jwtVerify<T extends object = Record<string, unknown>>(
  token: string,
  secret: string,
): T & JwtStandardClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('jeton malformé');
  const [head, body, sig] = parts as [string, string, string];
  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  if (!safeEqual(sig, expected)) throw new JwtError('signature invalide');
  let payload: T & JwtStandardClaims;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & JwtStandardClaims;
  } catch {
    throw new JwtError('charge utile illisible');
  }
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new JwtError('jeton expiré');
  }
  return payload;
}

/* --------------------------------- Chiffrement de secret (TOTP) --------------------------------- */
// AES-256-GCM. Clé dérivée de la clé maîtresse applicative.
// En production : enveloppe KMS OVHcloud (voir docs/02 §10) — ceci est le repli dev.

function deriveKey(masterKey: string): Buffer {
  return scryptSync(masterKey, 'okapi:totp:v1', 32);
}

export function encryptSecret(plain: string, masterKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(masterKey), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${enc.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptSecret(payload: string, masterKey: string): string {
  const [ivB, encB, tagB] = payload.split('.');
  if (!ivB || !encB || !tagB) throw new Error('secret chiffré malformé');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(masterKey),
    Buffer.from(ivB, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encB, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/* --------------------------------- TOTP RFC 6238 --------------------------------- */

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(bytes = 20): string {
  const buf = randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('secret base32 invalide');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

export function totpVerify(base32Secret: string, code: string, window = 1, step = 30): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i++) {
    if (safeEqual(hotp(secret, counter + i), code)) return true;
  }
  return false;
}

export function totpAuthUri(base32Secret: string, account: string, issuer = 'Okapi Logistics'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
