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

test('stage twenty preserves an economy opening before both mandatory boss phases', () => {
  const stage = STAGES[19]!;
  assert.equal(stage.id, 'border-20');
  assert.deepEqual(
    stage.waves.map((wave) => [wave.enemyId, wave.atTick, wave.count, wave.intervalTicks]),
    [
      ['enemy-shield', 450, 2, 250],
      ['enemy-berserker', 1000, 1, 230],
      ['enemy-boss', 1500, 1, 9999],
      ['enemy-sniper', 1800, 1, 260],
      ['enemy-boss-iron', 2400, 1, 9999],
    ],
    'STAGE 20 must keep its 15s economy opening and 50s/80s boss phases instead of reverting to the old early rush',
  );
});

test('stages sixteen through twenty stay beatable in exact unlock/treasure order and final bosses actually appear', () => {
  const clearedStageIds = STAGES.slice(0, 15).map((stage) => stage.id);
  assert.deepEqual(
    getUnlockedSlotIds(clearedStageIds),
    ['militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer', 'royal'],
  );

  for (let stageIndex = 15; stageIndex < 20; stageIndex += 1) {
    const stage = STAGES[stageIndex]!;
    const limit = FINAL_LIMITS[stageIndex - 15]!;
    const { state, unlockedSlotIds, ownedTreasureIds, seenEnemyIds, targetSupplyLevel } = autoPlayCampaignStage(stageIndex, clearedStageIds, {
      maxSeconds: limit.maxSeconds,
      cannonBaseRatio: 0.75,
    });

    assert.equal(ownedTreasureIds.length, clearedStageIds.length, 'final baseline must not receive a treasure before its stage is cleared');
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
