import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MAIN_STAGE_RESOURCE_REWARDS } from '@frontline/sim/main-stage-rewards';
import { createInitialAccountSave } from '../src/account-save-authority.ts';
import { __accountMutationTestOnly } from '../src/account-mutation-authority.ts';
import { createAccountTrustedRecordBattle } from '../src/account-trusted-battle-runtime.ts';
import { __trustedBattleTestOnly, TRUSTED_BATTLE_KINDS } from '../src/trusted-battle-authority.ts';
import { __accountHttpTestOnly } from '../src/account-http.ts';

const STARTED_AT_SECONDS = Math.floor(Date.parse('2026-08-31T03:30:00Z') / 1000);
const EXPIRES_AT_SECONDS = STARTED_AT_SECONDS + 6 * 60 * 60;
const COMPLETED_AT_MS = (STARTED_AT_SECONDS + 60) * 1000;

function unlockedSnapshot(count: number) {
  let snapshot = createInitialAccountSave();
  for (const reward of MAIN_STAGE_RESOURCE_REWARDS.slice(0, count)) {
    snapshot = __accountMutationTestOnly.buildMainBattleResult(snapshot, reward.stageId, 'SOLO_BATTLE').snapshot;
  }
  return snapshot;
}

function recordRow(
  battleId: string,
  targetId: 'record_endless_front' | 'record_boss_rush',
  snapshot: ReturnType<typeof unlockedSnapshot>,
  initialStateHash: string,
) {
  return {
    battle_id: battleId,
    battle_kind: 'RECORD' as const,
    target_id: targetId,
    start_revision: 0,
    start_snapshot_json: JSON.stringify(snapshot),
    initial_state_hash: initialStateHash,
    started_at: STARTED_AT_SECONDS,
    expires_at: EXPIRES_AT_SECONDS,
    completion_fingerprint: null,
    completed_at: null,
    result_json: null,
    claimed_at: null,
  };
}

test('trusted battle authority exposes RECORD and reconstructs deterministic record initial hashes', () => {
  assert.ok(TRUSTED_BATTLE_KINDS.includes('RECORD'));
  const snapshot = unlockedSnapshot(80);
  const endlessA = createAccountTrustedRecordBattle('record_endless_front', snapshot);
  const endlessB = createAccountTrustedRecordBattle('record_endless_front', snapshot);
  const bossA = createAccountTrustedRecordBattle('record_boss_rush', snapshot);
  const bossB = createAccountTrustedRecordBattle('record_boss_rush', snapshot);
  assert.equal(endlessA.battle.stateHash, endlessB.battle.stateHash);
  assert.equal(bossA.battle.stateHash, bossB.battle.stateHash);
});

test('trusted endless replay derives survival score and discoveries without client score input', () => {
  const snapshot = unlockedSnapshot(60);
  const initial = createAccountTrustedRecordBattle('record_endless_front', snapshot);
  const result = __trustedBattleTestOnly.replayRecordBattle(
    recordRow('record-endless-test', 'record_endless_front', snapshot, initial.battle.stateHash),
    [],
    COMPLETED_AT_MS,
  );

  assert.equal(result.kind, 'RECORD');
  assert.equal(result.recordMode, 'ENDLESS_FRONT');
  assert.equal(result.winner, 'ENEMY');
  assert.ok(result.clearFrames > 0);
  assert.ok(result.discoveredEnemyIds.includes('enemy-raider'));
});

test('trusted boss-rush replay derives defeated count rather than accepting a client claim', () => {
  const snapshot = unlockedSnapshot(80);
  const initial = createAccountTrustedRecordBattle('record_boss_rush', snapshot);
  const result = __trustedBattleTestOnly.replayRecordBattle(
    recordRow('record-boss-test', 'record_boss_rush', snapshot, initial.battle.stateHash),
    [],
    COMPLETED_AT_MS,
  );

  assert.equal(result.kind, 'RECORD');
  assert.equal(result.recordMode, 'BOSS_RUSH');
  assert.equal(result.defeatedBosses, 0);
  assert.equal(result.recordCompleted, false);
  assert.equal(result.winner, 'ENEMY');
});

test('record result merges server replay discoveries in the same authoritative snapshot mutation', () => {
  const snapshot = unlockedSnapshot(60);
  const built = __accountMutationTestOnly.buildRecordResult(snapshot, {
    battleId: 'record-discovery-test',
    expectedRevision: 0,
    mode: 'ENDLESS_FRONT',
    survivalFrames: 1800,
  }, ['enemy-raider', 'enemy-sprinter']);
  assert.ok(built.snapshot.discoveredEnemyIds.includes('enemy-raider'));
  assert.ok(built.snapshot.discoveredEnemyIds.includes('enemy-sprinter'));
  assert.equal(built.result.recordModeProgress.endlessBestReachedMinute, 1);
});

test('account HTTP accepts RECORD start tickets but still accepts no client score or reward fields', () => {
  assert.deepEqual(__accountHttpTestOnly.parseBattleStart({
    kind: 'RECORD', targetId: 'record_endless_front', survivalFrames: 999999, defeatedBosses: 9, reward: { gold: 999999 },
  }), { kind: 'RECORD', targetId: 'record_endless_front' });
  assert.deepEqual(__accountHttpTestOnly.parseBattleComplete({
    battleId: 'record-1',
    survivalFrames: 999999,
    defeatedBosses: 9,
    recordCompleted: true,
    reward: { gold: 999999 },
    commands: [],
  }), { battleId: 'record-1', commands: [] });
});

test('record migration widens trusted battle kind while preserving existing proof rows', async () => {
  const sql = await readFile(new URL('../migrations/0012_trusted_record_battles.sql', import.meta.url), 'utf8');
  assert.match(sql, /battle_kind IN \('MAIN', 'SPECIAL', 'RECORD'\)/);
  assert.match(sql, /INSERT INTO trusted_battle_runs_v2/);
  assert.match(sql, /FROM trusted_battle_runs/);
  assert.match(sql, /DROP TABLE trusted_battle_runs/);
  assert.match(sql, /ALTER TABLE trusted_battle_runs_v2 RENAME TO trusted_battle_runs/);
});
