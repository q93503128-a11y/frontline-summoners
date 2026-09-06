import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

function assertContainsTokens(source: string, surface: string, tokens: readonly string[]): void {
  for (const token of tokens) assert.ok(source.includes(token), `${surface} must cover ${token}`);
}

test('account and profile presentation contain long text and hide internal vocabulary', async () => {
  const [account, profile] = await Promise.all([
    readSource('../src/account-refined-scene.ts'),
    readSource('../src/profile-command-scene.ts'),
  ]);

  assert.ok(account.includes("replace(/\\bSPECIAL\\b/g, '특수')"));
  assert.ok(account.includes('fitTextToWidth(object, maxWidth'));
  assertContainsTokens(account, 'account presentation sanitizer', [
    'HTTP_', 'fetch', 'network', 'websocket', 'state hash', 'revision', 'requestId', 'migrationId', 'account_', 'profile_', 'guest_',
  ]);
  assert.ok(account.includes('현재 Google 계정 연결을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'));
  assert.ok(account.includes('Google 계정 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'));

  assert.ok(profile.includes("replace(/\\bSPECIAL\\b/g, '특수')"));
  assert.ok(profile.includes('fitTextToWidth(object, maxWidth'));
  assertContainsTokens(profile, 'profile presentation sanitizer', [
    'HTTP_', 'fetch', 'network', 'state hash', 'revision', 'requestId', 'seatId', 'matchId', 'websocket', 'account_', 'profile_',
  ]);
  assert.ok(profile.indexOf('불러오는 중') < profile.indexOf('state hash'));
});

test('co-op and record presentation sanitize transport details and bound dynamic copy', async () => {
  const [coop, record] = await Promise.all([
    readSource('../src/public-coop-command-scenes.ts'),
    readSource('../src/record-command-scenes.ts'),
  ]);

  assert.ok(coop.includes('function fitPublicCoopText'));
  assert.ok(coop.includes('fitTextToWidth(target, maxWidth'));
  assertContainsTokens(coop, 'public co-op presentation sanitizer', [
    'requestId', 'revision', 'seatId', 'matchId', 'roomId', 'queueId', 'public_coop_', 'coop_',
  ]);
  assert.ok(coop.includes('협동 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.'));

  assertContainsTokens(record, 'record presentation sanitizer', [
    'requestId', 'request_', 'account_', 'state hash', 'websocket', 'record_',
  ]);
  assert.ok(record.includes("value.startsWith('기록 정보를 처리하지 못했습니다.')"));
  assert.ok(record.includes('fitTextToWidth(target, 900'));
});
