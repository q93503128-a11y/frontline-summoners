import assert from 'node:assert/strict';
import test from 'node:test';
import { PROFILE_COSMETICS } from '@frontline/sim/achievement-profile';
import { __pvpSeasonAuthorityTestOnly } from '../src/pvp-season-authority.ts';
import {
  PVP_SEASON_HONOR_COSMETIC_IDS,
  resolvePvpSeasonHonorCosmeticIds,
} from '../src/pvp-season-profile-reward.ts';

const cosmeticIds = new Set(PROFILE_COSMETICS.map((cosmetic) => cosmetic.id));

test('every season honor maps to a real equipable profile cosmetic', () => {
  assert.equal(Object.keys(PVP_SEASON_HONOR_COSMETIC_IDS).length, 6);
  for (const cosmeticId of Object.values(PVP_SEASON_HONOR_COSMETIC_IDS)) {
    assert.ok(cosmeticIds.has(cosmeticId), `missing profile cosmetic catalog entry: ${cosmeticId}`);
  }
});

test('top 10 Master season finish resolves the full cumulative profile honor set', () => {
  const honors = __pvpSeasonAuthorityTestOnly.resolvePvpSeasonHonors({
    finalTier: 'MASTER',
    placementMatches: 5,
    finalRank: 10,
  });
  assert.deepEqual(resolvePvpSeasonHonorCosmeticIds(honors), [
    'emblem_pvp_season_gold',
    'frame_pvp_season_platinum',
    'title_pvp_season_master',
    'banner_pvp_season_top1000',
    'emblem_pvp_season_top100',
    'badge_pvp_season_top10',
  ]);
});

test('unplaced season finish grants no profile honor cosmetics', () => {
  const honors = __pvpSeasonAuthorityTestOnly.resolvePvpSeasonHonors({
    finalTier: 'MASTER',
    placementMatches: 4,
    finalRank: null,
  });
  assert.deepEqual(resolvePvpSeasonHonorCosmeticIds(honors), []);
});
