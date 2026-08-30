import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  stepPlayableBattle,
  trySpawnPlayerUnit,
} from '@frontline/sim/playable';
import { createInitialAccountSave } from '../src/account-save-authority.ts';
import { createAccountTrustedBattle } from '../src/account-trusted-battle-runtime.ts';
import {
  __trustedBattleTestOnly,
  TRUSTED_BATTLE_MAX_COMMANDS,
  TRUSTED_BATTLE_MAX_REPLAY_FRAMES,
  type TrustedBattleCommand,
} from '../src/trusted-battle-authority.ts';
import { __accountHttpTestOnly } from '../src/account-http.ts';

test('trusted battle runtime reconstructs the fresh-account stage from canonical server snapshot', () => {
  const snapshot = createInitialAccountSave();
  const first = createAccountTrustedBattle('main_01_001', snapshot);
  const second = createAccountTrustedBattle('main_01_001', snapshot);
  assert.equal(first.stateHash, second.stateHash);
  assert.equal(first.playerSlots.length, snapshot.deckSlotIds.length);
  assert.equal(first.playerSlots[0]?.slotId, 'militia');
  assert.equal(first.baseWeapon.id, snapshot.selectedBaseWeaponId);
});

test('trusted replay derives the same terminal result from successful action log without client winner input', () => {
  const snapshot = createInitialAccountSave();
  const initial = createAccountTrustedBattle('main_01_001', snapshot);
  const live = createAccountTrustedBattle('main_01_001', snapshot);
  const commands: TrustedBattleCommand[] = [];

  while (live.battle.winner === null && live.battle.tick < 20_000) {
    const spawn = trySpawnPlayerUnit(live, 'militia');
    if (spawn.ok) commands.push({ tick: live.battle.tick, type: 'SPAWN', slotId: 'militia' });
    stepPlayableBattle(live);
  }

  assert.equal(live.battle.winner, 'PLAYER');
  assert.ok(commands.length > 0);
  assert.ok(commands.length < TRUSTED_BATTLE_MAX_COMMANDS);

  const result = __trustedBattleTestOnly.replayTrustedBattle({
    battle_id: 'battle-test-1',
    battle_kind: 'MAIN',
    target_id: 'main_01_001',
    start_revision: 0,
    start_snapshot_json: JSON.stringify(snapshot),
    initial_state_hash: initial.stateHash,
    started_at: 1_000,
    expires_at: 99_999,
    completion_fingerprint: null,
    completed_at: null,
    result_json: null,
    claimed_at: null,
  }, commands, 2_000_000);

  assert.equal(result.winner, 'PLAYER');
  assert.equal(result.clearFrames, live.battle.tick);
  assert.equal(result.finalStateHash, live.stateHash);
  assert.equal(result.enemyBaseHp, 0);
});

test('trusted command normalization rejects reordering, impossible ticks and oversized logs', () => {
  assert.deepEqual(__trustedBattleTestOnly.normalizeCommands([
    { tick: 0, type: 'SPAWN', slotId: 'militia' },
    { tick: 0, type: 'FIRE_BASE_WEAPON' },
    { tick: 15, type: 'UPGRADE_SUPPLY' },
  ]), [
    { tick: 0, type: 'SPAWN', slotId: 'militia' },
    { tick: 0, type: 'FIRE_BASE_WEAPON' },
    { tick: 15, type: 'UPGRADE_SUPPLY' },
  ]);
  assert.throws(() => __trustedBattleTestOnly.normalizeCommands([
    { tick: 5, type: 'UPGRADE_SUPPLY' },
    { tick: 4, type: 'FIRE_BASE_WEAPON' },
  ]), /non-decreasing/);
  assert.throws(() => __trustedBattleTestOnly.normalizeCommands([
    { tick: TRUSTED_BATTLE_MAX_REPLAY_FRAMES, type: 'FIRE_BASE_WEAPON' },
  ]), /integer/);
  assert.throws(() => __trustedBattleTestOnly.normalizeCommands(
    Array.from({ length: TRUSTED_BATTLE_MAX_COMMANDS + 1 }, (_, tick) => ({ tick, type: 'UPGRADE_SUPPLY' as const })),
  ), /at most/);
});

test('trusted battle HTTP accepts only ticket target, command log, battle id and revision while ignoring forged outcome fields', () => {
  assert.deepEqual(__accountHttpTestOnly.parseBattleStart({
    kind: 'MAIN', targetId: 'main_01_001', accountId: 'forged-account', winner: 'PLAYER',
  }), { kind: 'MAIN', targetId: 'main_01_001' });
  assert.deepEqual(__accountHttpTestOnly.parseBattleComplete({
    battleId: 'battle-1',
    winner: 'PLAYER',
    clearFrames: 1,
    reward: { gold: 999999 },
    commands: [{ tick: 3, type: 'SPAWN', slotId: 'militia' }],
  }), {
    battleId: 'battle-1',
    commands: [{ tick: 3, type: 'SPAWN', slotId: 'militia' }],
  });
  assert.deepEqual(__accountHttpTestOnly.parseBattleClaim({
    battleId: 'battle-1', expectedRevision: 7, accountId: 'forged-account', reward: { gold: 999999 },
  }), { battleId: 'battle-1', expectedRevision: 7 });
});

test('trusted battle migration stores start snapshot, completion proof and one-time claim state', async () => {
  const sql = await readFile(new URL('../migrations/0008_trusted_battle_runs.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS trusted_battle_runs/);
  assert.match(sql, /user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /start_snapshot_json TEXT NOT NULL/);
  assert.match(sql, /initial_state_hash TEXT NOT NULL/);
  assert.match(sql, /completion_fingerprint TEXT/);
  assert.match(sql, /result_json TEXT/);
  assert.match(sql, /claimed_at INTEGER/);
  assert.match(sql, /CHECK \(claimed_at IS NULL OR completed_at IS NOT NULL\)/);
});

test('public account battle routes go only through trusted replay authority rather than proofless result mutation calls', async () => {
  const source = await readFile(new URL('../src/account-http.ts', import.meta.url), 'utf8');
  assert.match(source, /\/api\/account\/battles\/start/);
  assert.match(source, /\/api\/account\/battles\/complete/);
  assert.match(source, /\/api\/account\/battles\/claim/);
  assert.match(source, /startTrustedBattle/);
  assert.match(source, /completeTrustedBattle/);
  assert.match(source, /claimTrustedBattle/);
  assert.doesNotMatch(source, /applyAccountMainBattleResult/);
  assert.doesNotMatch(source, /applyAccountSpecialBattleResult/);
  assert.doesNotMatch(source, /body\.winner|raw\.winner|body\.clearFrames|raw\.clearFrames|body\.reward|raw\.reward/);
});
