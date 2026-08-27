import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_RECRUITMENT_PROGRESS,
  FIRST_RECRUITMENT_BANNER,
  RECRUITMENT_UNITS,
  recruit,
  type RecruitmentRandomSource,
} from '../src/recruitment.ts';
import {
  ALL_PLAYER_SLOTS,
  PLAYER_SLOTS,
  RECRUITMENT_PLAYER_SLOTS,
  STAGES,
  createPrototypeBattle,
  getUnlockedSlotIds,
} from '../src/prototype.ts';

class ZeroRandom implements RecruitmentRandomSource {
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error('invalid maxExclusive');
    return 0;
  }
}

class SequenceRandom implements RecruitmentRandomSource {
  private index = 0;
  constructor(private readonly sequence: readonly number[]) {}
  nextInt(maxExclusive: number): number {
    const value = this.sequence[this.index++ % this.sequence.length] ?? 0;
    return Math.abs(value) % maxExclusive;
  }
}

test('current executable recruitment slice stays separate from the ten story characters', () => {
  assert.equal(PLAYER_SLOTS.length, 10);
  assert.equal(RECRUITMENT_PLAYER_SLOTS.length, RECRUITMENT_UNITS.length);
  assert.equal(ALL_PLAYER_SLOTS.length, PLAYER_SLOTS.length + RECRUITMENT_PLAYER_SLOTS.length);
  assert.ok(RECRUITMENT_UNITS.every((unit) => unit.acquisitionClass === 'RECRUITMENT' && unit.rarity !== null));
  assert.ok(PLAYER_SLOTS.every((unit) => unit.acquisitionClass === 'STORY' && unit.rarity === null));

  const fullChapter = STAGES.map((stage) => stage.id);
  assert.equal(getUnlockedSlotIds(fullChapter).length, 10);
  assert.equal(getUnlockedSlotIds(fullChapter).includes('moon-eater'), false);

  const battle = createPrototypeBattle(STAGES[0]!.id, ['militia', 'moon-eater'], []);
  assert.deepEqual(battle.playerSlots.map((slot) => slot.slotId), ['militia', 'moon-eater']);
});

test('v1 candidate recruitment rates sum to 100 percent and keep S/SS intentionally rare', () => {
  assert.deepEqual(FIRST_RECRUITMENT_BANNER.ratesPermille, {
    C: 420,
    B: 320,
    A: 227,
    S: 30,
    SS: 3,
  });
  assert.equal(Object.values(FIRST_RECRUITMENT_BANNER.ratesPermille).reduce((sum, value) => sum + value, 0), 1000);
  assert.equal(FIRST_RECRUITMENT_BANNER.poolByRarity.SS.length, 1);
});

test('pull count is history only: 10/30/60/100 milestones do not alter the random table', () => {
  const batch = recruit({ totalPulls: 9 }, [], 92, new ZeroRandom());
  assert.equal(batch.results.length, 92);
  assert.equal(batch.results[0]?.pullNumber, 10);
  assert.equal(batch.results[20]?.pullNumber, 30);
  assert.equal(batch.results[50]?.pullNumber, 60);
  assert.equal(batch.results[90]?.pullNumber, 100);
  assert.equal(batch.progress.totalPulls, 101);
  assert.ok(batch.results.every((result) => result.rarity === 'C'));
  assert.ok(batch.results.every((result) => result.characterId === FIRST_RECRUITMENT_BANNER.poolByRarity.C[0]));
});

test('rarity selection follows the banner table without guarantee overrides', () => {
  const thresholds = [
    { roll: 0, rarity: 'C' },
    { roll: 419, rarity: 'C' },
    { roll: 420, rarity: 'B' },
    { roll: 739, rarity: 'B' },
    { roll: 740, rarity: 'A' },
    { roll: 966, rarity: 'A' },
    { roll: 967, rarity: 'S' },
    { roll: 996, rarity: 'S' },
    { roll: 997, rarity: 'SS' },
    { roll: 999, rarity: 'SS' },
  ] as const;

  for (const { roll, rarity } of thresholds) {
    const result = recruit(EMPTY_RECRUITMENT_PROGRESS, [], 1, new SequenceRandom([roll, 0]));
    assert.equal(result.results[0]?.rarity, rarity);
  }
});

test('duplicate pulls are detected without changing odds or inventing a pity state', () => {
  const firstC = FIRST_RECRUITMENT_BANNER.poolByRarity.C[0]!;
  const batch = recruit(EMPTY_RECRUITMENT_PROGRESS, [firstC], 1, new ZeroRandom());
  assert.equal(batch.results[0]?.characterId, firstC);
  assert.equal(batch.results[0]?.duplicate, true);
  assert.deepEqual(batch.progress, { totalPulls: 1 });
});
