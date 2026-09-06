import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('account and profile presentation contain long text and hide internal vocabulary', async () => {
  const [account, profile] = await Promise.all([
    readSource('../src/account-refined-scene.ts'),
    readSource('../src/profile-command-scene.ts'),
  ]);

  assert.ok(account.includes("replace(/\\bSPECIAL\\b/g, '특수')"));
  assert.ok(account.includes('fitTextToWidth(object, maxWidth'));
  assert.match(account, /state hash/);
  assert.match(account, /requestId/);

  assert.ok(profile.includes("replace(/\\bSPECIAL\\b/g, '특수')"));
  assert.ok(profile.includes('fitTextToWidth(object, maxWidth'));
  assert.match(profile, /seatId\|matchId\|websocket/);
  assert.ok(profile.indexOf('불러오는 중') < profile.indexOf('state hash'));
});

test('co-op and record presentation sanitize transport details and bound dynamic copy', async () => {
  const [coop, record] = await Promise.all([
    readSource('../src/public-coop-command-scenes.ts'),
    readSource('../src/record-command-scenes.ts'),
  ]);

  assert.ok(coop.includes('function fitPublicCoopText'));
  assert.ok(coop.includes('fitTextToWidth(target, maxWidth'));
  assert.match(coop, /requestId\|revision\|seatId\|matchId\|roomId\|queueId/);
  assert.match(coop, /public_coop_\|coop_/);
  assert.ok(coop.includes('협동 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.'));

  assert.match(record, /requestId\|request_\|account_\|state hash\|websocket\|record_/);
  assert.ok(record.includes("value.startsWith('기록 정보를 처리하지 못했습니다.')"));
  assert.ok(record.includes('fitTextToWidth(target, 900'));
});
