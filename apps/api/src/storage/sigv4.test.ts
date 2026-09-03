import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presignS3Url } from './sigv4';

const base = {
  endpoint: 'https://s3.gra.io.cloud.ovh.net',
  region: 'gra',
  bucket: 'okapi-photos',
  accessKey: 'AKIAIOSFODNN7EXAMPLE',
  secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  expiresSeconds: 900,
  forcePathStyle: true,
  now: new Date('2026-07-15T12:00:00Z'),
};

test('presign PUT : structure et déterminisme', () => {
  const url = presignS3Url({ ...base, method: 'PUT', key: 'parcels/abc/photos/1.jpg' });
  assert.match(url, /^https:\/\/s3\.gra\.io\.cloud\.ovh\.net\/okapi-photos\/parcels\/abc\/photos\/1\.jpg\?/);
  assert.match(url, /X-Amz-Algorithm=AWS4-HMAC-SHA256/);
  assert.match(url, /X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260715%2Fgra%2Fs3%2Faws4_request/);
  assert.match(url, /X-Amz-Date=20260715T120000Z/);
  assert.match(url, /X-Amz-Expires=900/);
  assert.match(url, /X-Amz-SignedHeaders=host/);
  assert.match(url, /X-Amz-Signature=[0-9a-f]{64}$/);
  // même entrée -> même signature
  assert.equal(url, presignS3Url({ ...base, method: 'PUT', key: 'parcels/abc/photos/1.jpg' }));
});

test('presign GET diffère de PUT', () => {
  const put = presignS3Url({ ...base, method: 'PUT', key: 'k/1.jpg' });
  const get = presignS3Url({ ...base, method: 'GET', key: 'k/1.jpg' });
  assert.notEqual(
    put.match(/X-Amz-Signature=([0-9a-f]+)/)![1],
    get.match(/X-Amz-Signature=([0-9a-f]+)/)![1],
  );
});

test('virtual-hosted style', () => {
  const url = presignS3Url({ ...base, forcePathStyle: false, method: 'GET', key: 'k/1.jpg' });
  assert.match(url, /^https:\/\/okapi-photos\.s3\.gra\.io\.cloud\.ovh\.net\/k\/1\.jpg\?/);
});
