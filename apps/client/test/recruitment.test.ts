import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_RECRUITMENT_PROGRESS,
  FIRST_RECRUITMENT_BANNER,
  RECRUITMENT_BANNERS,
  RECRUITMENT_UNITS,
  getBannerCharacterIds,
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

test('executable v1 roster is exactly ten story plus thirty-three recruitment characters', () => {
  assert.equal(PLAYER_SLOTS.length, 10);
  assert.equal(RECRUITMENT_UNITS.length, 33);
  assert.equal(RECRUITMENT_PLAYER_SLOTS.length, 33);
  assert.equal(ALL_PLAYER_SLOTS.length, 43);
  assert.ok(RECRUITMENT_UNITS.every((unit) => unit.acquisitionClass === 'RECRUITMENT' && unit.rarity !== null));
  assert.ok(PLAYER_SLOTS.every((unit) => unit.acquisitionClass === 'STORY' && unit.rarity === null));

  const fullChapter = STAGES.map((stage) => stage.id);
  assert.equal(getUnlockedSlotIds(fullChapter).length, 10);
  assert.equal(getUnlockedSlotIds(fullChapter).includes('char_s01_arselia'), false);

  const battle = createPrototypeBattle(STAGES[0]!.id, ['militia', 'char_s01_arselia'], []);
  assert.deepEqual(battle.playerSlots.map((slot) => slot.slotId), ['militia', 'char_s01_arselia']);
});

test('three initial banners share C5/B5/A5 and each owns S5/SS1', () => {
  assert.equal(RECRUITMENT_BANNERS.length, 3);
  const common = FIRST_RECRUITMENT_BANNER.poolByRarity;
  for (const banner of RECRUITMENT_BANNERS) {
    assert.deepEqual(banner.ratesPermille, { C: 420, B: 320, A: 227, S: 30, SS: 3 });
    assert.equal(Object.values(banner.ratesPermille).reduce((sum, value) => sum + value, 0), 1000);
    assert.deepEqual(banner.poolByRarity.C, common.C);
    assert.deepEqual(banner.poolByRarity.B, common.B);
    assert.deepEqual(banner.poolByRarity.A, common.A);
    assert.equal(banner.poolByRarity.C.length, 5);
    assert.equal(banner.poolByRarity.B.length, 5);
    assert.equal(banner.poolByRarity.A.length, 5);
    assert.equal(banner.poolByRarity.S.length, 5);
    assert.equal(banner.poolByRarity.SS.length, 1);
    assert.equal(getBannerCharacterIds(banner).length, 21);
  }
  assert.deepEqual(RECRUITMENT_BANNERS.map((banner) => banner.seriesId), [
    'series_01_starlight_order',
    'series_02_primordial_titans',
    'series_03_zero_edge',
  ]);
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

test('series-exclusive S and SS ids never leak into another initial banner', () => {
  for (const banner of RECRUITMENT_BANNERS) {
    for (const rarity of ['S', 'SS'] as const) {
      for (const characterId of banner.poolByRarity[rarity]) {
        const unit = RECRUITMENT_UNITS.find((candidate) => candidate.id === characterId);
        assert.equal(unit?.seriesId, banner.seriesId);
      }
    }
  }
});
