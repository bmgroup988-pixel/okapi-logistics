import { createHash, createHmac } from 'node:crypto';

/**
 * Signature AWS SigV4 « en-tête » (Authorization header) pour un appel API
 * direct (ex. Amazon SES v2 SendEmail). Complète `storage/sigv4.ts` (qui
 * signe des URL présignées S3 en query-string) — même famille d'algorithme,
 * variante différente. Aucune dépendance externe (pas de aws-sdk), cohérent
 * avec le choix déjà fait pour le stockage objet.
 * Réf. https://docs.aws.amazon.com/general/latest/gr/sigv4-signed-request-examples.html
 */

export interface SignedRequestParams {
  method: 'GET' | 'POST';
  url: string; // URL complète, ex. https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails
  region: string;
  service: string; // ex. "ses"
  accessKey: string;
  secretKey: string;
  body: string;
  extraHeaders?: Record<string, string>;
  now?: Date;
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

export function signAwsRequest(p: SignedRequestParams): { headers: Record<string, string>; url: string } {
  const now = p.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const url = new URL(p.url);

  // Toutes les clés normalisées en minuscules dès le départ (SigV4 exige des
  // noms d'en-têtes canoniques en minuscules, triés).
  const rawHeaders: Record<string, string> = {
    host: url.host,
    'x-amz-date': amzDate,
    'content-type': 'application/json',
    ...Object.fromEntries(Object.entries(p.extraHeaders ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
  };
  const signedHeaderNames = Object.keys(rawHeaders).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${rawHeaders[h]}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalRequest = [
    p.method,
    url.pathname || '/',
    url.search.replace(/^\?/, ''),
    canonicalHeaders,
    signedHeaders,
    sha256Hex(p.body),
  ].join('\n');

  const scope = `${dateStamp}/${p.region}/${p.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${p.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, p.region);
  const kService = hmac(kRegion, p.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${p.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: p.url,
    headers: { ...rawHeaders, authorization },
  };
}
