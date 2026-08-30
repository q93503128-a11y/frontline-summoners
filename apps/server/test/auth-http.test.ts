import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthRequestOriginAllowed, resolveAuthHttp } from '../src/auth-http.ts';

const fakeDb = {} as D1Database;

test('google auth origin gate allows same-origin or configured exact origins and rejects unrelated sites', () => {
  assert.equal(isAuthRequestOriginAllowed(
    new Request('https://api.example/api/auth/config', { headers: { origin: 'https://api.example' } }),
    undefined,
  ), true);
  assert.equal(isAuthRequestOriginAllowed(
    new Request('https://api.example/api/auth/config', { headers: { origin: 'https://game.example' } }),
    'https://game.example, https://staging.example',
  ), true);
  assert.equal(isAuthRequestOriginAllowed(
    new Request('https://api.example/api/auth/config', { headers: { origin: 'https://evil.example' } }),
    'https://game.example',
  ), false);
});

test('auth config exposes public Google client id only to an allowed browser origin', async () => {
  const allowed = await resolveAuthHttp(
    new Request('https://api.example/api/auth/config', { headers: { origin: 'https://game.example' } }),
    { DB: fakeDb, GOOGLE_CLIENT_ID: '123456789012-example.apps.googleusercontent.com', AUTH_ALLOWED_ORIGINS: 'https://game.example' },
  );
  assert.equal(allowed?.status, 200);
  assert.deepEqual(allowed?.body, {
    google: { enabled: true, clientId: '123456789012-example.apps.googleusercontent.com' },
  });
  assert.equal(allowed?.headers?.['access-control-allow-origin'], 'https://game.example');
  assert.equal(allowed?.headers?.['cache-control'], 'no-store');

  const denied = await resolveAuthHttp(
    new Request('https://api.example/api/auth/config', { headers: { origin: 'https://evil.example' } }),
    { DB: fakeDb, GOOGLE_CLIENT_ID: '123456789012-example.apps.googleusercontent.com', AUTH_ALLOWED_ORIGINS: 'https://game.example' },
  );
  assert.equal(denied?.status, 403);
  assert.equal(denied?.headers?.['access-control-allow-origin'], undefined);
});

test('google login route stays closed until a server client id is configured', async () => {
  const result = await resolveAuthHttp(
    new Request('https://api.example/api/auth/google', {
      method: 'POST',
      headers: { origin: 'https://game.example', 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'x'.repeat(128) }),
    }),
    { DB: fakeDb, AUTH_ALLOWED_ORIGINS: 'https://game.example' },
  );
  assert.equal(result?.status, 503);
  assert.deepEqual(result?.body, { error: 'google_auth_not_configured' });
});

test('auth preflight returns only exact origin instead of wildcard CORS', async () => {
  const result = await resolveAuthHttp(
    new Request('https://api.example/api/auth/google', { method: 'OPTIONS', headers: { origin: 'https://game.example' } }),
    { DB: fakeDb, AUTH_ALLOWED_ORIGINS: 'https://game.example' },
  );
  assert.equal(result?.status, 204);
  assert.equal(result?.headers?.['access-control-allow-origin'], 'https://game.example');
  assert.notEqual(result?.headers?.['access-control-allow-origin'], '*');
});
