import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACHIEVEMENTS,
  DEFAULT_PROFILE_COSMETIC_IDS,
  PROFILE_COSMETICS,
  evaluateAchievements,
  getAchievement,
  normalizeOwnedProfileCosmeticIds,
  normalizeProfileLoadout,
  type AchievementEvaluationInput,
} from '../src/achievement-profile.ts';

const completeMainIds = Array.from({ length: 4 }, (_, chapterIndex) =>
  Array.from({ length: 20 }, (_, stageIndex) => `main_${String(chapterIndex + 1).padStart(2, '0')}_${String(stageIndex + 1).padStart(3, '0')}`),
).flat();

const richInput: AchievementEvaluationInput = {
  mainClearedStageIds: completeMainIds,
  specialClearedStageIds: [
    'special_gold_convoy_01', 'special_gold_convoy_02', 'special_gold_convoy_03', 'special_gold_convoy_04', 'special_gold_convoy_05',
    'special_soul_forge_01', 'special_soul_forge_02', 'special_soul_forge_03', 'special_soul_forge_04',
    'special_evolution_gate_01', 'special_evolution_gate_02', 'special_evolution_gate_03', 'special_evolution_gate_04', 'special_evolution_gate_05',
    'special_starlight_rift_01', 'special_starlight_rift_02', 'special_starlight_rift_03', 'special_starlight_rift_04',
    'special_glutton_04', 'special_undead_04', 'special_glass_04',
  ],
  maxCharacterLevel: 50,
  maxCharacterPlusLevel: 50,
  unlockedF2Count: 20,
  unlockedF3Count: 10,
  ownedCharacterCount: 40,
  discoveredEnemyCount: 50,
  coopClearedStageIds: Array.from({ length: 10 }, (_, index) => `coop-clear-${index + 1}`),
  endlessBestReachedMinute: 10,
  bossRushBestDefeated: 8,
  factIds: [],
};

function evaluationMap(input: AchievementEvaluationInput = richInput) {
  return new Map(evaluateAchievements(input).map((evaluation) => [evaluation.achievementId, evaluation] as const));
}

test('initial achievement catalog locks fifty authored permanent milestones without grind clones', () => {
  assert.equal(ACHIEVEMENTS.length, 50);
  assert.equal(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size, 50);
  assert.equal(new Set(PROFILE_COSMETICS.map((cosmetic) => cosmetic.id)).size, PROFILE_COSMETICS.length);
  assert.deepEqual(DEFAULT_PROFILE_COSMETIC_IDS, ['frame_default_wood', 'banner_default_frontline', 'emblem_default']);
  assert.ok(ACHIEVEMENTS.every((achievement) => achievement.repeatable === false));
  assert.ok(ACHIEVEMENTS.every((achievement) => !/100회|500회|1000회/.test(achievement.shortDescription)));
});

test('shared evaluator resolves main special growth codex coop and record milestones from typed state', () => {
  const evaluations = evaluationMap();
  for (const achievementId of [
    'ach_main_c1', 'ach_main_c4', 'ach_main_80',
    'ach_gold_5', 'ach_permanent_3', 'ach_special_20',
    'ach_lv50', 'ach_plus50', 'ach_f3_10', 'ach_owned40', 'ach_codex_enemy50',
    'ach_coop_10', 'ach_endless_10', 'ach_bossrush_8',
  ]) {
    assert.equal(evaluations.get(achievementId)?.complete, true, achievementId);
  }
  assert.equal(evaluations.get('ach_special_20')?.current, 20);
  assert.equal(evaluations.get('ach_f3_10')?.current, 10);
  assert.equal(evaluations.get('ach_coop_10')?.current, 10);
});

test('future fact and PvP hooks stay incomplete until their authoritative signals exist', () => {
  const withoutSignals = evaluationMap();
  assert.equal(withoutSignals.get('ach_coop_friend')?.complete, false);
  assert.equal(withoutSignals.get('ach_pvp_silver')?.complete, false);
  assert.equal(withoutSignals.get('ach_quirk_turnip_five')?.complete, false);

  const withSignals = evaluationMap({
    ...richInput,
    factIds: ['coop_friend_first', 'pvp_first_ranked', 'quirk_turnip_five'],
    pvpBestTier: 'MASTER',
  });
  assert.equal(withSignals.get('ach_coop_friend')?.complete, true);
  assert.equal(withSignals.get('ach_pvp_ranked_first')?.complete, true);
  assert.equal(withSignals.get('ach_pvp_silver')?.complete, true);
  assert.equal(withSignals.get('ach_pvp_gold')?.complete, true);
  assert.equal(withSignals.get('ach_pvp_diamond')?.complete, true);
  assert.equal(withSignals.get('ach_pvp_master')?.complete, true);
  assert.equal(withSignals.get('ach_quirk_turnip_five')?.complete, true);
});

test('quirky challenge achievements are hidden and never carry unresolved mandatory economy rewards', () => {
  const quirky = ACHIEVEMENTS.filter((achievement) => achievement.category === 'QUIRK');
  assert.equal(quirky.length, 4);
  assert.ok(quirky.every((achievement) => achievement.visibility === 'HIDDEN'));
  assert.ok(quirky.every((achievement) => achievement.designRewardNote === undefined));
});

test('claimed achievements idempotently unlock cosmetics while profile loadout rejects unowned choices and caps badges at three', () => {
  const claimed = ['ach_main_c1', 'ach_main_c4', 'ach_main_80', 'ach_special_20', 'ach_f3_10', 'ach_codex_enemy50'];
  const owned = normalizeOwnedProfileCosmeticIds(['unknown-cosmetic', 'badge_main_v1'], claimed);
  assert.ok(owned.includes('frame_default_wood'));
  assert.ok(owned.includes('title_border_breaker'));
  assert.ok(owned.includes('frame_border_iron'));
  assert.ok(owned.includes('title_first_front_complete'));
  assert.ok(owned.includes('badge_main_v1'));
  assert.ok(owned.includes('badge_special_20'));
  assert.ok(owned.includes('badge_f3_10'));
  assert.ok(owned.includes('badge_codex_50'));
  assert.equal(owned.includes('unknown-cosmetic'), false);

  const normalized = normalizeProfileLoadout({
    portraitCharacterId: 'owned-b',
    titleId: 'title_border_breaker',
    frameId: 'frame_pvp_master',
    bannerId: 'banner_gear_empire',
    emblemId: 'emblem_default',
    badgeIds: ['badge_main_v1', 'badge_special_20', 'badge_f3_10', 'badge_codex_50'],
  }, owned, ['owned-a', 'owned-b']);
  assert.equal(normalized.portraitCharacterId, 'owned-b');
  assert.equal(normalized.titleId, 'title_border_breaker');
  assert.notEqual(normalized.frameId, 'frame_pvp_master');
  assert.equal(normalized.bannerId, 'banner_gear_empire');
  assert.deepEqual(normalized.badgeIds, ['badge_main_v1', 'badge_special_20', 'badge_f3_10']);
});

test('unresolved economy reward candidates remain notes rather than fabricated resource amounts', () => {
  assert.match(getAchievement('ach_main_20').designRewardNote ?? '', /경제/);
  assert.match(getAchievement('ach_main_40').designRewardNote ?? '', /경제/);
  assert.match(getAchievement('ach_gold_1').designRewardNote ?? '', /경제/);
  assert.equal('resourceReward' in getAchievement('ach_main_20'), false);
});
