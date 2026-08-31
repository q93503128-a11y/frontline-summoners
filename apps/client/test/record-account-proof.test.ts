import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __accountNetworkTestOnly } from '../src/account-network.ts';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('account network parses trusted RECORD tickets and server-derived scores', () => {
  const start = __accountNetworkTestOnly.parseTrustedBattleStart({
    battleId: 'record-1', kind: 'RECORD', targetId: 'record_endless_front', startRevision: 8,
    initialStateHash: 'hash-1', expiresAtMs: 123456,
  });
  assert.equal(start?.kind, 'RECORD');
  const endless = __accountNetworkTestOnly.parseTrustedBattleCompletion({
    battleId: 'record-1', kind: 'RECORD', targetId: 'record_endless_front', winner: 'ENEMY', clearFrames: 7200,
    finalStateHash: 'hash-2', playerBaseHp: 0, enemyBaseHp: 2000000000, completedAtMs: 123456,
    recordMode: 'ENDLESS_FRONT',
  });
  assert.equal(endless?.recordMode, 'ENDLESS_FRONT');
  assert.equal(endless?.clearFrames, 7200);
  const boss = __accountNetworkTestOnly.parseTrustedBattleCompletion({
    battleId: 'record-2', kind: 'RECORD', targetId: 'record_boss_rush', winner: 'PLAYER', clearFrames: 9000,
    finalStateHash: 'hash-3', playerBaseHp: 1000, enemyBaseHp: 2000000000, completedAtMs: 123456,
    recordMode: 'BOSS_RUSH', defeatedBosses: 9, recordCompleted: true,
  });
  assert.equal(boss?.defeatedBosses, 9);
  assert.equal(boss?.recordCompleted, true);
  assert.equal(__accountNetworkTestOnly.parseTrustedBattleCompletion({
    battleId: 'record-bad', kind: 'RECORD', targetId: 'record_boss_rush', winner: 'PLAYER', clearFrames: 1,
    finalStateHash: 'x', playerBaseHp: 1, enemyBaseHp: 1, completedAtMs: 1,
  }), null);
});

test('record hub uses active account authority and blocks offline-cache challenges', async () => {
  const hub = await readSource('../src/record-hub-scene.ts');
  assert.match(hub, /loadActiveProgress\(\)/);
  assert.match(hub, /ACCOUNT_OFFLINE_CACHE/);
  assert.match(hub, /const canChallenge = unlocked && this\.authority !== 'ACCOUNT_OFFLINE_CACHE'/);
  assert.match(hub, /온라인 복구 후 서버 검증 기록 도전 가능/);
  assert.doesNotMatch(hub, /loadGuestProgress\(\)/);
});

test('record battle starts a RECORD proof, verifies initial hash and logs only accepted deterministic commands', async () => {
  const battle = await readSource('../src/record-battle-scene.ts');
  assert.match(battle, /loadActiveProgress\(\)/);
  assert.match(battle, /startAuthenticatedTrustedBattle\('RECORD', this\.modeId\)/);
  assert.match(battle, /ticket\.initialStateHash !== this\.runtime\.battle\.stateHash/);
  assert.match(battle, /if \(result\.ok\) this\.appendTrustedCommand\(\{ tick, type: 'SPAWN', slotId \}\)/);
  assert.match(battle, /if \(result\.ok\) this\.appendTrustedCommand\(\{ tick, type: 'UPGRADE_SUPPLY' \}\)/);
  assert.match(battle, /type: 'FIRE_BASE_WEAPON'/);
  assert.match(battle, /if \(this\.authority !== 'GUEST_LOCAL'\) return/);
  assert.match(battle, /trustedBattleId: this\.trustedBattleId, trustedCommands: \[\.\.\.this\.trustedCommands\]/);
});

test('record result completes server replay before claim, recovers online state for retry, and never guest-fallbacks trusted proofs', async () => {
  const result = await readSource('../src/record-result-scene.ts');
  assert.match(result, /getAccountClientState\(\)\.kind !== 'AUTHENTICATED_ONLINE'/);
  assert.match(result, /await refreshAuthenticatedAccount\(\)/);
  assert.match(result, /온라인 연결을 복구한 뒤 결과 재전송을 다시 시도하세요/);
  assert.match(result, /completeAuthenticatedTrustedBattle\(battleId, commands\)/);
  assert.match(result, /claimAuthenticatedTrustedBattle\(battleId\)/);
  assert.match(result, /assertTrustedCompletion\(this\.modeId, completed\.result\)/);
  assert.match(result, /accountSnapshotToGuestProgress\(claim\.snapshot\)/);
  assert.match(result, /서버 재생 검증 · 계정 기록\/도감\/새 구간 보상 저장 완료/);
  assert.match(result, /결과 재전송/);
  assert.match(result, /this\.trustedBattleId[\s\S]*\? this\.recordAuthenticatedResult/);
});
