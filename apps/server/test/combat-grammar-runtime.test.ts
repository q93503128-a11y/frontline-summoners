import assert from 'node:assert/strict';
import test from 'node:test';
import type { CoopPlayerLoadout } from '../src/coop-room.ts';
import { createServerCoopBattle } from '../src/runtime-content.ts';

const FRONT_CANNON = 'base_weapon_front_cannon' as const;
const militiaLoadout = (): CoopPlayerLoadout => ({
  characters: [{ characterId: 'militia', level: 1, plusLevel: 0 }],
  permanentRewardIds: [],
  clearedStageIds: [],
});

test('server authoritative runtime preserves late-boss phase and per-hit grammar after co-op scaling', () => {
  const battle = createServerCoopBattle('main_01_009', militiaLoadout(), militiaLoadout(), FRONT_CANNON);
  const archmagus = battle.shared.enemies.find((enemy) => enemy.enemyId === 'boss_ch3_archmagus')!.definition;
  const belzar = battle.shared.enemies.find((enemy) => enemy.enemyId === 'boss_ch3_belzar')!.definition;
  const zero = battle.shared.enemies.find((enemy) => enemy.enemyId === 'boss_ch4_zero_engine')!.definition;

  assert.deepEqual(archmagus.attackPhases?.map((phase) => phase.patternIndices), [[0], [0, 0, 1]]);
  assert.deepEqual(belzar.attackPhases?.map((phase) => phase.patternIndices), [[0], [0]]);
  assert.equal(belzar.hitEffects?.[2]?.onHitPush?.chancePermille, 350);
  assert.deepEqual(zero.attackPhases?.map((phase) => phase.patternIndices), [[0, 0, 1, 0, 2], [0, 3, 2, 0, 3], [2, 0, 3, 2]]);
  assert.ok((zero.attackPattern?.[2]?.hitDamages?.reduce((sum, value) => sum + value, 0) ?? 0) > 450, 'co-op attack scaling also scales split hit damages');
});

test('server co-op personal kill rewards apply the stage +5% supply multiplier', () => {
  const battle = createServerCoopBattle('main_01_009', militiaLoadout(), militiaLoadout(), FRONT_CANNON);
  const baseline = createServerCoopBattle('main_01_008', militiaLoadout(), militiaLoadout(), FRONT_CANNON);
  const enemyId = 'enemy-raider';
  assert.equal(battle.enemyRewardSupplyBySeat.A[enemyId], Math.round((baseline.enemyRewardSupplyBySeat.A[enemyId] ?? 0) * 1.05));
  assert.equal(battle.enemyRewardSupplyBySeat.B[enemyId], Math.round((baseline.enemyRewardSupplyBySeat.B[enemyId] ?? 0) * 1.05));
});
