import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __googleLoginTestOnly } from '../src/google-login.ts';

test('google auth config/session parser accepts only configured client ids and fixed session tokens', () => {
  assert.deepEqual(__googleLoginTestOnly.parseGoogleAuthConfig({
    google: { enabled: true, clientId: '123456789012-example.apps.googleusercontent.com' },
    local: { enabled: true },
  }), {
    enabled: true,
    clientId: '123456789012-example.apps.googleusercontent.com',
  });
  assert.equal(__googleLoginTestOnly.parseGoogleAuthConfig({ google: { enabled: true, clientId: null } }), null);
  assert.deepEqual(__googleLoginTestOnly.parseGoogleSessionResponse({
    sessionToken: 'ab'.repeat(32),
    expiresAtMs: 1_900_000_000_000,
  }), {
    sessionToken: 'ab'.repeat(32),
    expiresAtMs: 1_900_000_000_000,
  });
  assert.equal(__googleLoginTestOnly.parseGoogleSessionResponse({ sessionToken: 'short', expiresAtMs: 1 }), null);
});

test('google auth reports a disconnected account api when Pages returns HTML instead of JSON', async () => {
  await assert.rejects(
    () => __googleLoginTestOnly.readJsonApiResponse(new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }), 'Google 로그인'),
    /계정 API가 게임 페이지와 연결되지 않았습니다/,
  );
});

test('account scene uses official Google Identity Services credential flow and server exchange', async () => {
  const scene = await readFile(new URL('../src/account-scene.ts', import.meta.url), 'utf8');
  const login = await readFile(new URL('../src/google-login.ts', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(scene, /https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(scene, /api\.initialize/);
  assert.match(scene, /api\.renderButton/);
  assert.match(scene, /loginWithGoogleCredential\(response\.credential\)/);
  assert.match(login, /\/api\/auth\/config/);
  assert.match(login, /\/api\/auth\/google/);
  assert.match(login, /setAuthenticatedAccountSession\(session\.sessionToken\)/);
  assert.match(login, /content-type/);
  assert.doesNotMatch(login, /accountId/);
  assert.match(main, /scene\.start\('account'\)/);
  assert.match(main, /game\.scene\.add\('account', AccountScene, false\)/);
});
