import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signAwsRequest } from './aws-sigv4-header';

const base = {
  method: 'POST' as const,
  url: 'https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails',
  region: 'eu-west-1',
  service: 'ses',
  accessKey: 'AKIAIOSFODNN7EXAMPLE',
  secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  body: '{"FromEmailAddress":"a@b.com"}',
  now: new Date('2026-07-15T12:00:00Z'),
};

test('signAwsRequest : structure et déterminisme', () => {
  const { headers, url } = signAwsRequest(base);
  assert.equal(url, base.url);
  assert.equal(headers.host, 'email.eu-west-1.amazonaws.com');
  assert.equal(headers['x-amz-date'], '20260715T120000Z');
  assert.match(headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20260715\/eu-west-1\/ses\/aws4_request, SignedHeaders=/);
  assert.match(headers.authorization, /Signature=[0-9a-f]{64}$/);
  // même entrée -> même signature
  assert.equal(signAwsRequest(base).headers.authorization, headers.authorization);
});

test('signAwsRequest : un corps différent change la signature', () => {
  const a = signAwsRequest(base);
  const b = signAwsRequest({ ...base, body: '{"FromEmailAddress":"other@b.com"}' });
  assert.notEqual(a.headers.authorization, b.headers.authorization);
});

test('signAwsRequest : en-têtes additionnels inclus et signés', () => {
  const { headers } = signAwsRequest({ ...base, extraHeaders: { 'X-Amz-Target': 'SimpleEmailService_v2.SendEmail' } });
  assert.equal(headers['x-amz-target'], 'SimpleEmailService_v2.SendEmail');
  assert.match(headers.authorization, /SignedHeaders=content-type;host;x-amz-date;x-amz-target/);
});
