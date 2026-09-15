import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __localLoginTestOnly } from '../src/local-login.ts';

const INTERNAL_PLAYER_ERROR_MARKER = /HTTP|API|fetch|network|JSON|token|session|auth|origin|D1|sqlite|migration|request|response/i;

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
  assert.doesNotMatch(account, /google/i);
  assert.match(refined, /extends BaseAccountCommandScene/);
  assert.doesNotMatch(refined, /Google|requestLocalCredentials|renderLocalAccountActions/);
  assert.match(main, /AccountScene.*account-refined-scene/);
});

test('local auth failures stay player-facing and do not expose protocol details', () => {
  assert.equal(__localLoginTestOnly.errorMessage({ error: 'username_taken' }, 409, 'register'), '이미 사용 중인 아이디입니다.');
  assert.equal(__localLoginTestOnly.errorMessage({ error: 'invalid_credentials' }, 401, 'login'), '아이디 또는 비밀번호가 올바르지 않습니다.');
  const serverFailure = __localLoginTestOnly.errorMessage({}, 503, 'login');
  assert.equal(serverFailure, '계정 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.');
  assert.doesNotMatch(serverFailure, INTERNAL_PLAYER_ERROR_MARKER);
  const missingRoute = __localLoginTestOnly.errorMessage({}, 404, 'register');
  assert.equal(missingRoute, '계정 기능을 현재 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  assert.doesNotMatch(missingRoute, INTERNAL_PLAYER_ERROR_MARKER);
  const deniedOrigin = __localLoginTestOnly.errorMessage({ error: 'auth_origin_denied' }, 403, 'login');
  assert.equal(deniedOrigin, '현재 접속 환경에서는 계정 연결을 사용할 수 없습니다.');
  assert.doesNotMatch(deniedOrigin, INTERNAL_PLAYER_ERROR_MARKER);
});

test('account command scene keeps credential errors and mobile controls on the player-facing surface', async () => {
  const account = await readFile(new URL('../src/account-command-scene.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(account, /googleScriptSrc/);
  assert.doesNotMatch(account, /SPECIAL/);
  assert.doesNotMatch(account, /return error\.message/);
  assert.match(account, /ACCOUNT_ACTION_FAILED_MESSAGE/);
  assert.match(account, /INTERNAL_ACCOUNT_ERROR_MARKER/);
  assert.ok((account.match(/accountConnectionMessage\(error\)/g) ?? []).length >= 5);

  assert.match(account, /flexWrap: 'wrap'/);
  assert.match(account, /justifyContent: 'center'/);
  assert.match(account, /boxSizing: 'border-box'/);
  assert.match(account, /flex: '1 1 170px'/);
  assert.match(account, /const appliedScale =/);
  assert.match(account, /const renderedWidthLimit =/);
  assert.match(account, /logicalWidth \/ appliedScale|renderedWidthLimit \/ appliedScale/);
});
