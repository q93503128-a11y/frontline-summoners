import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createServerCoopBattle,
  getServerCoopStage,
  getServerRuntimeCoopStageIds,
} from '../src/runtime-content.ts';
import type { CoopPlayerLoadout } from '../src/coop-room.ts';

const FRONT_CANNON = 'base_weapon_front_cannon' as const;
const militiaLoadout = (): CoopPlayerLoadout => ({
  characters: [{ characterId: 'militia', level: 1, plusLevel: 0 }],
  permanentRewardIds: [],
  clearedStageIds: [],
});

test('server authoritative runtime exposes all permanent challenge SPECIAL stages for co-op', () => {
  const ids = new Set(getServerRuntimeCoopStageIds());
  for (const prefix of ['glutton', 'undead', 'glass', 'mechcastle', 'anomaly']) {
    for (let i = 1; i <= 4; i += 1) assert.ok(ids.has(`special_${prefix}_0${i}`));
  }
  for (let i = 1; i <= 3; i += 1) assert.ok(ids.has(`special_echoes_0${i}`));
  assert.equal(getServerCoopStage('special_anomaly_04').policy.multiplayerPolicy, 'SOLO_OR_COOP');
});

test('server co-op scaling preserves dedicated SPECIAL boss mechanics', () => {
  const battle = createServerCoopBattle('special_glutton_04', militiaLoadout(), militiaLoadout(), FRONT_CANNON);
  const glutton = battle.shared.enemies.find((candidate) => candidate.enemyId === 'boss_sp_glutton_drake');
  assert.ok(glutton);
  assert.deepEqual(glutton.definition.hpThresholdAdvance, {
    thresholdsPermille: [600, 300],
    distance: 210,
    nextAttackStartupReductionFrames: 18,
  });

  const anomaly = createServerCoopBattle('special_anomaly_04', militiaLoadout(), militiaLoadout(), FRONT_CANNON);
  const unobservable = anomaly.shared.enemies.find((candidate) => candidate.enemyId === 'boss_sp_unobservable');
  assert.ok(unobservable);
  assert.deepEqual(unobservable.definition.attackPattern?.[2]?.onHitWeaken, {
    chancePermille: 1000,
    durationFrames: 90,
    attackPermille: 750,
  });
});
