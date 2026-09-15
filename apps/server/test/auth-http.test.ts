import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthRequestOriginAllowed, resolveAuthHttp } from '../src/auth-http.ts';

const fakeDb = {} as D1Database;

test('auth config exposes only the dedicated local credential surface', async () => {
  const request = new Request('https://api.example.com/api/auth/config');
  const result = await resolveAuthHttp(request, { DB: fakeDb });
  assert.deepEqual(result, {
    status: 200,
    body: {
      local: {
        enabled: true,
        usernameMinLength: 4,
        usernameMaxLength: 24,
        passwordMinLength: 10,
        passwordMaxLength: 128,
      },
    },
    headers: {
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'cache-control': 'no-store',
      vary: 'Origin',
    },
  });
  assert.equal(JSON.stringify(result).includes('google'), false);
});

test('retired Google auth route is outside the active auth surface', async () => {
  const request = new Request('https://api.example.com/api/auth/google', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential: 'retired' }),
  });
  assert.equal(await resolveAuthHttp(request, { DB: fakeDb }), null);
});

test('local login and registration preflight allows only the credential JSON surface', async () => {
  for (const path of ['/api/auth/login', '/api/auth/register']) {
    const request = new Request(`https://api.example.com${path}`, {
      method: 'OPTIONS',
      headers: { origin: 'https://game.example.com' },
    });
    const result = await resolveAuthHttp(request, {
      DB: fakeDb,
      AUTH_ALLOWED_ORIGINS: 'https://game.example.com',
    });
    assert.equal(result?.status, 204);
    assert.equal(result?.headers?.['access-control-allow-origin'], 'https://game.example.com');
    assert.equal(result?.headers?.['access-control-allow-headers'], 'content-type');
  }
});

test('auth origin policy accepts same-origin and configured Pages origin while rejecting others', () => {
  assert.equal(isAuthRequestOriginAllowed(new Request('https://api.example.com/api/auth/config'), undefined), true);
  assert.equal(isAuthRequestOriginAllowed(new Request('https://api.example.com/api/auth/config', {
    headers: { origin: 'https://api.example.com' },
  }), undefined), true);
  assert.equal(isAuthRequestOriginAllowed(new Request('https://api.example.com/api/auth/config', {
    headers: { origin: 'https://game.example.com' },
  }), 'https://game.example.com'), true);
  assert.equal(isAuthRequestOriginAllowed(new Request('https://api.example.com/api/auth/config', {
    headers: { origin: 'https://evil.example.com' },
  }), 'https://game.example.com'), false);
});
