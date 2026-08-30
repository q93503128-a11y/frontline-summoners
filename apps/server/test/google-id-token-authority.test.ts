import assert from 'node:assert/strict';
import test from 'node:test';
import {
  __googleIdTokenTestOnly,
  GoogleIdTokenValidationError,
  verifyGoogleIdToken,
} from '../src/google-id-token-authority.ts';

const CLIENT_ID = '123456789012-example.apps.googleusercontent.com';
const NOW_MS = 1_800_000_000_000;

type Fixture = {
  readonly credential: string;
  readonly fetcher: typeof fetch;
};

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signedFixture(overrides: Readonly<Record<string, unknown>> = {}): Promise<Fixture> {
  const keyPair = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  }, true, ['sign', 'verify']) as CryptoKeyPair;
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const header = { alg: 'RS256', kid: 'test-google-key', typ: 'JWT' };
  const claims = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-subject-123',
    iat: Math.floor(NOW_MS / 1000) - 30,
    exp: Math.floor(NOW_MS / 1000) + 3600,
    ...overrides,
  };
  const encodedHeader = encodeJson(header);
  const encodedClaims = encodeJson(claims);
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  ));
  const credential = `${signingInput}.${base64Url(signature)}`;
  const fetcher = (async () => new Response(JSON.stringify({
    keys: [{ ...publicJwk, kid: 'test-google-key', alg: 'RS256', use: 'sig' }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  })) as typeof fetch;
  return { credential, fetcher };
}

test('google id token verifier accepts a correctly signed RS256 token and returns only stable sub identity', async () => {
  __googleIdTokenTestOnly.resetJwksCache();
  const fixture = await signedFixture({ email: 'ignored@example.com', email_verified: true });
  const identity = await verifyGoogleIdToken(fixture.credential, CLIENT_ID, NOW_MS, fixture.fetcher);
  assert.deepEqual(identity, { provider: 'google', providerSubject: 'google-subject-123' });
});

test('google id token verifier rejects wrong audience and expired credentials before identity binding', async () => {
  __googleIdTokenTestOnly.resetJwksCache();
  const wrongAudience = await signedFixture({ aud: 'attacker.apps.googleusercontent.com' });
  await assert.rejects(
    verifyGoogleIdToken(wrongAudience.credential, CLIENT_ID, NOW_MS, wrongAudience.fetcher),
    (error: unknown) => error instanceof GoogleIdTokenValidationError && /audience/.test(error.message),
  );

  const expired = await signedFixture({ exp: Math.floor(NOW_MS / 1000) - 1 });
  await assert.rejects(
    verifyGoogleIdToken(expired.credential, CLIENT_ID, NOW_MS, expired.fetcher),
    (error: unknown) => error instanceof GoogleIdTokenValidationError && /expired/.test(error.message),
  );
});

test('google id token verifier rejects tampered signatures', async () => {
  __googleIdTokenTestOnly.resetJwksCache();
  const fixture = await signedFixture();
  const [header, claims, signature] = fixture.credential.split('.') as [string, string, string];
  const tamperedClaims = encodeJson({
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'forged-google-subject',
    iat: Math.floor(NOW_MS / 1000) - 30,
    exp: Math.floor(NOW_MS / 1000) + 3600,
  });
  await assert.rejects(
    verifyGoogleIdToken(`${header}.${tamperedClaims}.${signature}`, CLIENT_ID, NOW_MS, fixture.fetcher),
    (error: unknown) => error instanceof GoogleIdTokenValidationError && /signature/.test(error.message),
  );
  assert.notEqual(claims, tamperedClaims);
});

test('google jwks cache obeys provider max-age with a bounded fallback', () => {
  assert.equal(__googleIdTokenTestOnly.parseCacheMaxAgeMs('public, max-age=3600'), 3_600_000);
  assert.equal(__googleIdTokenTestOnly.parseCacheMaxAgeMs(null), 300_000);
  assert.equal(__googleIdTokenTestOnly.parseCacheMaxAgeMs('max-age=999999999'), 86_400_000);
});
