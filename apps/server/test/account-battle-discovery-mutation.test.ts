import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialAccountSave } from '../src/account-save-authority.ts';
import { __accountMutationTestOnly } from '../src/account-mutation-authority.ts';
import { __accountSpecialMutationTestOnly } from '../src/account-special-mutation-authority.ts';

const OPEN_NOW = Date.parse('2026-08-30T09:30:00+09:00');

function clearThrough(count: number) {
  let snapshot = createInitialAccountSave();
  for (let index = 0; index < count; index += 1) {
    const stageId = `main_${String(Math.floor(index / 20) + 1).padStart(2, '0')}_${String(index % 20 + 1).padStart(3, '0')}`;
    snapshot = __accountMutationTestOnly.buildMainBattleResult(snapshot, stageId, 'SOLO_BATTLE').snapshot;
  }
  return snapshot;
}

test('MAIN battle result merges server-derived enemy discovery in the same mutation snapshot', () => {
  const snapshot = createInitialAccountSave();
  const result = __accountMutationTestOnly.buildMainBattleResult(
    snapshot,
    'main_01_001',
    'SOLO_BATTLE',
    ['enemy-raider'],
  );
  assert.deepEqual(result.snapshot.discoveredEnemyIds, ['enemy-raider']);
  assert.equal(result.result.firstClear, true);
  assert.deepEqual(result.result.resourceReward, { gold: 150, summon_crystal: 40 });
});

test('SPECIAL battle result merges server-derived enemy discovery without changing sortie-start availability semantics', () => {
  const snapshot = clearThrough(3);
  const result = __accountSpecialMutationTestOnly.buildSpecialBattleResult(
    snapshot,
    'special_gold_convoy_01',
    OPEN_NOW,
    OPEN_NOW,
    ['enemy-raider'],
  );
  assert.deepEqual(result.snapshot.discoveredEnemyIds, ['enemy-raider']);
  assert.equal(result.result.firstClear, true);
  assert.deepEqual(result.result.resourceReward, { gold: 600, sweep_ticket: 1 });
});
