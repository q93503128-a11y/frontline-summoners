import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_RECRUITMENT_PROGRESS,
  FIRST_RECRUITMENT_BANNER,
  RECRUITMENT_UNITS,
  recruit,
  redeemBannerSelection,
  type RecruitmentRandomSource,
} from '../src/recruitment.ts';

class ZeroRandom implements RecruitmentRandomSource {
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error('invalid maxExclusive');
    return 0;
  }
}

const rarityRank = { C: 0, B: 1, A: 2, S: 3, SS: 4 } as const;

test('first recruitment pool is separate from the ten free chapter-one characters and spans all five rarities', () => {
  assert.equal(RECRUITMENT_UNITS.length, 15);
  const counts = Object.fromEntries(['C', 'B', 'A', 'S', 'SS'].map((rarity) => [rarity, RECRUITMENT_UNITS.filter((unit) => unit.rarity === rarity).length]));
  assert.deepEqual(counts, { C: 4, B: 4, A: 3, S: 2, SS: 2 });
});

test('restored recruitment rates are 30/28/24/13/5 and sum to 100 percent', () => {
  assert.deepEqual(FIRST_RECRUITMENT_BANNER.ratesPermille, {
    C: 300,
    B: 280,
    A: 240,
    S: 130,
    SS: 50,
  });
  assert.equal(Object.values(FIRST_RECRUITMENT_BANNER.ratesPermille).reduce((sum, value) => sum + value, 0), 1000);
});

test('ten-pull and thirty-pull milestones enforce the restored minimum rarities while normal pulls still use the banner table', () => {
  const batch = recruit(EMPTY_RECRUITMENT_PROGRESS, [], 30, new ZeroRandom());
  assert.equal(batch.results.length, 30);
  assert.equal(batch.results[0]?.rarity, 'C');

  for (const pullNumber of [10, 20]) {
    const result = batch.results[pullNumber - 1]!;
    assert.ok(rarityRank[result.rarity] >= rarityRank.A);
    assert.equal(result.guaranteedBy, 'TEN_PULL_A_PLUS');
  }
  const thirtieth = batch.results[29]!;
  assert.ok(rarityRank[thirtieth.rarity] >= rarityRank.S);
  assert.equal(thirtieth.guaranteedBy, 'THIRTY_PULL_S_PLUS');
});

test('the sixtieth pull overrides lower milestones with the pickup SS guarantee', () => {
  const batch = recruit(EMPTY_RECRUITMENT_PROGRESS, [], 60, new ZeroRandom());
  const sixtieth = batch.results[59]!;
  assert.equal(sixtieth.rarity, 'SS');
  assert.equal(sixtieth.characterId, 'moon-eater');
  assert.equal(sixtieth.guaranteedBy, 'SIXTY_PULL_PICKUP_SS');
});

test('every hundred pulls grants a selectable banner-character credit rather than silently replacing the random result', () => {
  const batch = recruit(EMPTY_RECRUITMENT_PROGRESS, [], 100, new ZeroRandom());
  assert.equal(batch.progress.totalPulls, 100);
  assert.equal(batch.progress.selectionCredits, 1);
  assert.equal(batch.results[99]?.selectionCreditGranted, true);

  const selected = redeemBannerSelection(batch.progress, batch.ownedCharacterIds, 'castle-crab');
  assert.equal(selected.progress.selectionCredits, 0);
  assert.equal(selected.ownedCharacterIds.includes('castle-crab'), true);
});

test('duplicate pulls are detected but do not invent shard quantities before the economy table is canonized', () => {
  const owned = ['turnip-rider'];
  const batch = recruit(EMPTY_RECRUITMENT_PROGRESS, owned, 1, new ZeroRandom());
  assert.equal(batch.results[0]?.characterId, 'turnip-rider');
  assert.equal(batch.results[0]?.duplicate, true);
});
