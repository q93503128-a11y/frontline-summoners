import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __localLoginTestOnly } from '../src/local-login.ts';

test('local credential parser normalizes usernames and accepts only fixed account sessions', () => {
  assert.equal(__localLoginTestOnly.normalizeUsername('  Commander_01 '), 'commander_01');
  assert.throws(() => __localLoginTestOnly.normalizeUsername('ABC!'), /아이디/);
  assert.equal(__localLoginTestOnly.validatePassword('1234567890'), '1234567890');
  assert.throws(() => __localLoginTestOnly.validatePassword('short'), /비밀번호/);
  assert.deepEqual(__localLoginTestOnly.sessionFromPayload({
    sessionToken: 'ab'.repeat(32),
    expiresAtMs: 1_900_000_000_000,
  }), {
    sessionToken: 'ab'.repeat(32),
    expiresAtMs: 1_900_000_000_000,
  });
  assert.equal(__localLoginTestOnly.sessionFromPayload({ sessionToken: 'short', expiresAtMs: 1 }), null);
});

test('local login uses the canonical register/login API and persists only server session tokens', async () => {
  const login = await readFile(new URL('../src/local-login.ts', import.meta.url), 'utf8');
  const account = await readFile(new URL('../src/account-command-scene.ts', import.meta.url), 'utf8');
  const refined = await readFile(new URL('../src/account-refined-scene.ts', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');

  assert.match(login, /\/api\/auth\/\$\{mode\}/);
  assert.match(login, /setAuthenticatedAccountSession\(session\.sessionToken\)/);
  assert.doesNotMatch(login, /google/i);
  assert.match(account, /loginWithLocalCredentials/);
  assert.match(account, /registerLocalCredentials/);
  assert.doesNotMatch(account, /accounts\.google\.com|loginWithGoogleCredential|fetchGoogleAuthConfig/);
  assert.match(refined, /extends BaseAccountCommandScene/);
  assert.doesNotMatch(refined, /Google|requestLocalCredentials|renderLocalAccountActions/);
  assert.match(main, /AccountScene.*account-refined-scene/);
});

test('local auth failures stay player-facing', () => {
  assert.equal(__localLoginTestOnly.errorMessage({ error: 'username_taken' }, 409, 'register'), '이미 사용 중인 아이디입니다.');
  assert.equal(__localLoginTestOnly.errorMessage({ error: 'invalid_credentials' }, 401, 'login'), '아이디 또는 비밀번호가 올바르지 않습니다.');
  assert.match(__localLoginTestOnly.errorMessage({}, 503, 'login'), /HTTP 503/);
});
