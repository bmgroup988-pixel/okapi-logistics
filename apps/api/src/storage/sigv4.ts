import { createHash, createHmac } from 'node:crypto';

/**
 * Signature AWS SigV4 pour URL pré-signées S3 (query-string auth).
 * Compatible AWS S3, OVHcloud Object Storage et MinIO. Aucune dépendance externe.
 * Réf. https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 */

export interface PresignParams {
  method: 'GET' | 'PUT';
  endpoint: string; // ex. https://s3.gra.io.cloud.ovh.net  (sans slash final)
  region: string;
  bucket: string;
  key: string;
  accessKey: string;
  secretKey: string;
  expiresSeconds: number;
  forcePathStyle?: boolean;
  now?: Date;
}

function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function encodeKeyPath(key: string): string {
  return key
    .split('/')
    .map((seg) => rfc3986(seg))
    .join('/');
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

export function presignS3Url(p: PresignParams): string {
  const now = p.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const url = new URL(p.endpoint);
  const pathStyle = p.forcePathStyle ?? true;
  const host = pathStyle ? url.host : `${p.bucket}.${url.host}`;
  const canonicalUri = pathStyle
    ? `/${p.bucket}/${encodeKeyPath(p.key)}`
    : `/${encodeKeyPath(p.key)}`;

  const scope = `${dateStamp}/${p.region}/s3/aws4_request`;
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${p.accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(p.expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(query[k]!)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    p.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${p.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, p.region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `${url.protocol}//${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
