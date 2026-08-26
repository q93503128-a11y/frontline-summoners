import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGES, getUnlockedSlotIds } from '../src/prototype.ts';
import { autoPlayCampaignStage } from './campaign-baseline.ts';

const FINAL_LIMITS = [
  { maxSeconds: 330, minBaseRatio: 0.02 },
  { maxSeconds: 345, minBaseRatio: 0.02 },
  { maxSeconds: 360, minBaseRatio: 0.015 },
  { maxSeconds: 390, minBaseRatio: 0.01 },
  { maxSeconds: 450, minBaseRatio: 0.01 },
] as const;

const EXPECTED_ROSTER_SIZE_BEFORE_STAGE = [8, 9, 9, 9, 9] as const;

test('stage twenty locks the canonical sequential boss trigger structure', () => {
  const stage = STAGES[19]!;
  assert.equal(stage.id, 'main_01_020');
  assert.equal(stage.permanentRewardId, 'border-crown');
  assert.deepEqual(stage.specialRules, ['chapterClear:1', 'levelCap:20', 'specialHubUnlock:true']);

  const waves = new Map(stage.waves.map((wave) => [wave.id, wave] as const));
  assert.deepEqual(waves.get('GOLD')?.trigger, {
    type: 'ANY_OF',
    conditions: [
      { type: 'TIME', frame: 900 },
      { type: 'ENEMY_BASE_HP_BELOW', percent: 80 },
    ],
  }, 'golden-mask phase must begin at 30s or when the enemy base reaches 80% HP');
  assert.deepEqual(waves.get('GOLD_H50A')?.trigger, { type: 'BOSS_HP_BELOW', enemyId: 'enemy-boss', percent: 50 });
  assert.deepEqual(waves.get('GOLD_H50B')?.trigger, { type: 'BOSS_HP_BELOW', enemyId: 'enemy-boss', percent: 50 });
  assert.deepEqual(waves.get('IRON')?.trigger, {
    type: 'ANY_OF',
    conditions: [
      { type: 'AFTER_WAVE_CLEARED', waveId: 'GOLD', delayFrames: 180 },
      { type: 'ENEMY_BASE_HP_BELOW', percent: 45 },
    ],
  }, 'iron-general phase must follow the golden-mask clear with delay or emergency base threshold');
  assert.deepEqual(waves.get('IRON_H65')?.trigger, { type: 'BOSS_HP_BELOW', enemyId: 'enemy-boss-iron', percent: 65 });
  assert.deepEqual(waves.get('IRON_H35A')?.trigger, { type: 'BOSS_HP_BELOW', enemyId: 'enemy-boss-iron', percent: 35 });
  assert.deepEqual(waves.get('IRON_H35B')?.trigger, { type: 'BOSS_HP_BELOW', enemyId: 'enemy-boss-iron', percent: 35 });
});

test('stages sixteen through twenty stay beatable in exact unlock/permanent-reward order and final bosses actually appear', () => {
  const clearedStageIds = STAGES.slice(0, 15).map((stage) => stage.id);
  assert.deepEqual(
    getUnlockedSlotIds(clearedStageIds),
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer', 'royal'],
  );

  for (let stageIndex = 15; stageIndex < 20; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const limit = FINAL_LIMITS[stageIndex - 15]!;
    const { state, unlockedSlotIds, ownedPermanentRewardIds, seenEnemyIds, targetSupplyLevel } = autoPlayCampaignStage(stageIndex, clearedStageIds, {
      maxSeconds: limit.maxSeconds,
      cannonBaseRatio: 0.75,
    });

    assert.equal(ownedPermanentRewardIds.length, clearedStageIds.length, 'final baseline must not receive a permanent reward before its stage is cleared');
    assert.equal(targetSupplyLevel, stageIndex >= 16 ? 3 : 2, 'final baseline must upgrade enough wallet capacity for legitimately unlocked expensive units');
    assert.equal(
      unlockedSlotIds.length,
      EXPECTED_ROSTER_SIZE_BEFORE_STAGE[stageIndex - 15],
      `STAGE ${stageIndex + 1} started with the wrong number of legitimately unlocked units`,
    );

    if (stageIndex === 15) assert.ok(!unlockedSlotIds.includes('heretic'), 'heretic must not be usable until STAGE 16 is cleared');
    else assert.ok(unlockedSlotIds.includes('heretic'), 'heretic must be usable from STAGE 17 onward');
    assert.ok(!unlockedSlotIds.includes('voidsage'), 'voidsage is the STAGE 20 clear reward and must never be usable during chapter 1');

    assert.equal(
      state.battle.winner,
      'PLAYER',
      `STAGE ${stageIndex + 1} (${stage.id}) failed with legitimately unlocked slots: ${unlockedSlotIds.join(', ')}`,
    );
    assert.ok(state.battle.tick <= limit.maxSeconds * 30, `STAGE ${stageIndex + 1} exceeded ${limit.maxSeconds}s baseline: ${state.battle.tick} ticks`);

    const baseRatio = state.battle.bases.PLAYER.hp / state.battle.bases.PLAYER.maxHp;
    assert.ok(
      baseRatio >= limit.minBaseRatio,
      `STAGE ${stageIndex + 1} left player base at ${(baseRatio * 100).toFixed(1)}%, expected >= ${limit.minBaseRatio * 100}%`,
    );

    if (stageIndex === 18) assert.ok(seenEnemyIds.has('enemy-boss'), 'STAGE 19 must not be clearable before the golden-mask boss actually appears');
    if (stageIndex === 19) {
      assert.ok(seenEnemyIds.has('enemy-boss'), 'STAGE 20 must spawn the golden-mask boss before victory');
      assert.ok(seenEnemyIds.has('enemy-boss-iron'), 'STAGE 20 must spawn the iron general before victory');
    }

    clearedStageIds.push(stage.id);
  }

  assert.deepEqual(
    getUnlockedSlotIds(clearedStageIds),
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer', 'royal', 'heretic', 'voidsage'],
    'clearing ST20 must leave the whole chapter-one 10-unit core roster unlocked',
  );
});