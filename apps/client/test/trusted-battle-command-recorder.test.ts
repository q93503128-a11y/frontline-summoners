import assert from 'node:assert/strict';
import test from 'node:test';
import { TrustedBattleCommandRecorder, TRUSTED_BATTLE_CLIENT_MAX_COMMANDS } from '../src/trusted-battle-command-recorder.ts';

test('trusted battle recorder stores only locally accepted actions at simulation ticks', () => {
  const recorder = new TrustedBattleCommandRecorder();
  recorder.recordSpawn(0, 'militia', false);
  recorder.recordSpawn(0, 'militia', true);
  recorder.recordSupplyUpgrade(5, false);
  recorder.recordSupplyUpgrade(5, true);
  recorder.recordBaseWeapon(5, true);
  assert.deepEqual(recorder.seal(), [
    { tick: 0, type: 'SPAWN', slotId: 'militia' },
    { tick: 5, type: 'UPGRADE_SUPPLY' },
    { tick: 5, type: 'FIRE_BASE_WEAPON' },
  ]);
  assert.equal(recorder.size, 3);
  assert.equal(recorder.isSealed, true);
});

test('trusted battle recorder rejects reordered ticks, empty accepted slots, post-seal writes and oversized logs', () => {
  const reordered = new TrustedBattleCommandRecorder();
  reordered.recordBaseWeapon(4, true);
  assert.throws(() => reordered.recordSupplyUpgrade(3, true), /non-decreasing/);

  const empty = new TrustedBattleCommandRecorder();
  assert.throws(() => empty.recordSpawn(0, '   ', true), /must not be empty/);

  const sealed = new TrustedBattleCommandRecorder();
  sealed.recordSpawn(0, 'militia', true);
  sealed.seal();
  assert.throws(() => sealed.recordBaseWeapon(1, true), /sealed/);

  const maxed = new TrustedBattleCommandRecorder();
  for (let index = 0; index < TRUSTED_BATTLE_CLIENT_MAX_COMMANDS; index += 1) maxed.recordSupplyUpgrade(index, true);
  assert.throws(() => maxed.recordSupplyUpgrade(TRUSTED_BATTLE_CLIENT_MAX_COMMANDS, true), /limit exceeded/);
});
