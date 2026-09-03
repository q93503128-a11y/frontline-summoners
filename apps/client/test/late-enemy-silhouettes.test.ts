import assert from 'node:assert/strict';
import test from 'node:test';
import { ENEMIES } from '../src/prototype.ts';
import {
  LATE_ENEMY_SIGNATURE_UNIT_IDS,
  getLateEnemySilhouetteSpec,
} from '../src/late-enemy-silhouette-overlays.ts';

function isLateEnemyId(unitId: string): boolean {
  return unitId.startsWith('enemy_ch3_')
    || unitId.startsWith('boss_ch3_')
    || unitId.startsWith('enemy_ch4_')
    || unitId.startsWith('boss_ch4_')
    || unitId.startsWith('enemy_sp_')
    || unitId.startsWith('boss_sp_')
    || unitId.startsWith('enemy_ev_')
    || unitId.startsWith('boss_ev_');
}

const CANONICAL_LATE_IDS = ENEMIES.map((enemy) => enemy.enemyId).filter(isLateEnemyId);

test('late enemy silhouette batch covers every canonical chapter 3-4 and special/event enemy', () => {
  assert.equal(CANONICAL_LATE_IDS.length, 60);
  assert.deepEqual([...LATE_ENEMY_SIGNATURE_UNIT_IDS].sort(), [...CANONICAL_LATE_IDS].sort());
  const keys = new Set<string>();
  for (const unitId of CANONICAL_LATE_IDS) {
    const spec = getLateEnemySilhouetteSpec(unitId);
    assert.ok(spec, `missing late enemy silhouette: ${unitId}`);
    assert.equal(spec.kind, 'LATE_ENEMY');
    assert.ok(spec.key.includes(unitId));
    assert.ok(spec.scale > 0.7);
    assert.ok(spec.attackPushMax >= 2 && spec.attackPushMax <= 9);
    assert.ok(!keys.has(spec.key), `duplicate late enemy silhouette key: ${spec.key}`);
    keys.add(spec.key);
  }
});

test('late campaign motifs preserve the canonical readable identities', () => {
  assert.equal(getLateEnemySilhouetteSpec('enemy_ch3_glasseye')?.shape, 'ARCANE_EYE');
  assert.equal(getLateEnemySilhouetteSpec('enemy_ch3_floating_library')?.shape, 'ARCHIVE');
  assert.equal(getLateEnemySilhouetteSpec('enemy_ch3_chain_demon')?.shape, 'CHAIN_DEMON');
  assert.equal(getLateEnemySilhouetteSpec('enemy_ch3_arcane_battery')?.shape, 'ARTILLERY');
  assert.equal(getLateEnemySilhouetteSpec('enemy_ch4_sawbird')?.shape, 'SAW_BIRD');
  assert.equal(getLateEnemySilhouetteSpec('enemy_ch4_magnet_spider')?.shape, 'MAGNET_SPIDER');
  assert.equal(getLateEnemySilhouetteSpec('enemy_ch4_void_lens')?.shape, 'VOID_LENS');
  assert.equal(getLateEnemySilhouetteSpec('boss_ch4_zero_engine')?.shape, 'ENGINE');
});

test('permanent and event bosses remain visibly larger and use their own motif families', () => {
  const bossIds = CANONICAL_LATE_IDS.filter((unitId) => unitId.startsWith('boss_'));
  assert.ok(bossIds.length >= 10);
  for (const unitId of bossIds) {
    const spec = getLateEnemySilhouetteSpec(unitId);
    assert.ok(spec && spec.scale >= 1.25, `boss placeholder silhouette is not larger: ${unitId}`);
  }
  assert.equal(getLateEnemySilhouetteSpec('boss_sp_glass_castle')?.shape, 'CASTLE');
  assert.equal(getLateEnemySilhouetteSpec('boss_sp_soul_grand_forge')?.shape, 'FORGE');
  assert.equal(getLateEnemySilhouetteSpec('boss_sp_evo_gatekeeper')?.shape, 'SEAL');
  assert.equal(getLateEnemySilhouetteSpec('boss_ev_summer_kaiju')?.shape, 'BEAST');
  assert.equal(getLateEnemySilhouetteSpec('boss_ev_ze_testframe')?.shape, 'EVENT_MACHINE');
});

test('late enemy presentation stays scoped away from early enemies and player units', () => {
  assert.equal(getLateEnemySilhouetteSpec('enemy-raider'), undefined);
  assert.equal(getLateEnemySilhouetteSpec('enemy_ch2_mossboar'), undefined);
  assert.equal(getLateEnemySilhouetteSpec('militia'), undefined);
  assert.equal(getLateEnemySilhouetteSpec('char_common_a_mirror_guide'), undefined);
});
