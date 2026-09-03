import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMMON_SIGNATURE_UNIT_IDS,
  ENEMY_SIGNATURE_UNIT_IDS,
  getSignatureSilhouetteOverlaySpec,
} from '../src/common-silhouette-overlays.ts';

const COMMON_IDS = [
  'char_common_c_turnip_rider',
  'char_common_c_tin_squire',
  'char_common_c_slinger',
  'char_common_c_bell_crab',
  'char_common_c_lantern_moth',
  'char_common_b_lantern_witch',
  'char_common_b_clockduck',
  'char_common_b_coffin_merchant',
  'char_common_b_moss_golem',
  'char_common_b_ink_raven',
  'char_common_a_glass_keeper',
  'char_common_a_bonedrum',
  'char_common_a_paper_dragon',
  'char_common_a_meteor_cart',
  'char_common_a_mirror_guide',
] as const;

const ENEMY_IDS = [
  'enemy-sprinter',
  'enemy-spearman',
  'enemy-shield',
  'enemy-cultist',
  'enemy-sniper',
  'enemy-knight',
  'enemy-berserker',
  'enemy-boss',
  'enemy-boss-iron',
  'enemy_ch2_mossboar',
  'enemy_ch2_umbrella',
  'enemy_ch2_vinerider',
  'enemy_ch2_seedbattery',
  'enemy_ch2_bonewheel',
  'enemy_ch2_coffinbug',
  'enemy_ch2_gravebell',
  'enemy_ch2_revivedarmor',
  'boss_ch2_rootwidow',
  'boss_ch2_funeral_king',
] as const;

test('all 15 common C/B/A characters have distinct F1/F2/F3 placeholder identity silhouettes', () => {
  assert.deepEqual([...COMMON_SIGNATURE_UNIT_IDS].sort(), [...COMMON_IDS].sort());
  for (const unitId of COMMON_IDS) {
    const f1 = getSignatureSilhouetteOverlaySpec(unitId, `${unitId}_f1`);
    const f2 = getSignatureSilhouetteOverlaySpec(unitId, `${unitId}_f2`);
    const f3 = getSignatureSilhouetteOverlaySpec(unitId, `${unitId}_f3`);
    assert.ok(f1 && f2 && f3, `missing common signature forms: ${unitId}`);
    assert.equal(new Set([f1.key, f2.key, f3.key]).size, 3, `form keys collapsed: ${unitId}`);
    assert.equal(f1.formOrder, 1);
    assert.equal(f2.formOrder, 2);
    assert.equal(f3.formOrder, 3);
    assert.ok(f1.scale < f2.scale && f2.scale < f3.scale, `form silhouette growth is not readable: ${unitId}`);
    assert.equal(f1.shape, f2.shape);
    assert.equal(f2.shape, f3.shape);
  }
});

test('chapter 1-2 enemy identity batch covers 19 nontrivial silhouettes without pretending raider needs a creature prop', () => {
  assert.deepEqual([...ENEMY_SIGNATURE_UNIT_IDS].sort(), [...ENEMY_IDS].sort());
  for (const unitId of ENEMY_IDS) {
    const spec = getSignatureSilhouetteOverlaySpec(unitId);
    assert.ok(spec, `missing enemy signature: ${unitId}`);
    assert.equal(spec.formOrder, 1);
    assert.ok(spec.key.includes(unitId));
  }
  assert.equal(getSignatureSilhouetteOverlaySpec('enemy-raider'), undefined);
});

test('signature silhouettes reject noncanonical form ids and unrelated premium/story units', () => {
  assert.equal(getSignatureSilhouetteOverlaySpec('char_common_c_turnip_rider'), undefined);
  assert.equal(getSignatureSilhouetteOverlaySpec('char_common_c_turnip_rider', 'char_common_c_turnip_rider_f4'), undefined);
  assert.equal(getSignatureSilhouetteOverlaySpec('militia', 'militia_f3'), undefined);
  assert.equal(getSignatureSilhouetteOverlaySpec('char_s01_elsia', 'char_s01_elsia_f1'), undefined);
});
