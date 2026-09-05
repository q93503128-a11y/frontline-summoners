import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildAchievementEvaluationInput } from '../src/achievement-profile.ts';
import { getEvolutionForms } from '../src/character-growth.ts';
import type { GuestProgress } from '../src/save.ts';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

function firstTenMainStageIds(): readonly string[] {
  return Array.from({ length: 10 }, (_, index) => `main_01_${String(index + 1).padStart(3, '0')}`);
}

test('guest achievement input derives growth, evolution, co-op and record progress from the real save axes', () => {
  const forms = getEvolutionForms('militia');
  const f1 = forms.find((form) => form.formOrder === 1)!;
  const f2 = forms.find((form) => form.formOrder === 2)!;
  const f3 = forms.find((form) => form.formOrder === 3)!;
  const clearedStageIds = firstTenMainStageIds();
  const normalClearSourceByStage = Object.fromEntries(clearedStageIds.map((stageId) => [stageId, 'COOP_BATTLE' as const]));
  const progress: GuestProgress = {
    clearedStageIds,
    normalClearSourceByStage,
    specialClearedStageIds: ['special_gold_convoy_01'],
    permanentRewardIds: [],
    discoveredEnemyIds: ['enemy-grunt', 'enemy-runner'],
    characterProgressById: {
      militia: { level: 50, plusLevel: 12, unlockedFormIds: [f1.formId, f2.formId, f3.formId], selectedFormId: f3.formId },
    },
    recordModeProgress: {
      endlessBestTimeMs: 600_000,
      endlessBestReachedMinute: 10,
      endlessRewardedMinute: 10,
      bossRushBestDefeated: 5,
      bossRushRewardedDefeated: 5,
    },
  };
  const input = buildAchievementEvaluationInput(progress);
  assert.equal(input.maxCharacterLevel, 50);
  assert.equal(input.maxCharacterPlusLevel, 12);
  assert.equal(input.unlockedF2Count, 1);
  assert.equal(input.unlockedF3Count, 1);
  assert.equal(input.coopClearedStageIds.length, 10);
  assert.equal(input.endlessBestReachedMinute, 10);
  assert.equal(input.bossRushBestDefeated, 5);
  assert.equal(input.specialClearedStageIds.includes('special_gold_convoy_01'), true);
});

test('profile and achievement scene is reachable from main menu and registered exactly once', async () => {
  const [main, profile] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/profile-scene.ts'),
  ]);
  assert.match(main, /import \{ ProfileScene \} from '\.\/profile-scene';/);
  assert.match(main, /'프로필 · 업적', \(\) => this\.scene\.start\('profile'\)/);
  assert.equal((main.match(/game\.scene\.add\('profile', ProfileScene, false\)/g) ?? []).length, 1);
  assert.match(profile, /loadActiveProgress\(\)/);
  assert.match(profile, /loadGuestAchievementProfile\(view\.progress\)/);
  assert.match(profile, /deriveReadOnlyAccountAchievementProfile\(view\.progress\)/);
});

test('profile UI exposes equipped cosmetics and masks incomplete hidden achievements without a claim-button mailbox', async () => {
  const profile = await readSource('../src/profile-scene.ts');
  assert.match(profile, /대표 배지/);
  assert.match(profile, /this\.cycleCosmetic\('TITLE'\)/);
  assert.match(profile, /this\.cycleCosmetic\('FRAME'\)/);
  assert.match(profile, /this\.cycleCosmetic\('BANNER'\)/);
  assert.match(profile, /this\.cycleCosmetic\('EMBLEM'\)/);
  assert.match(profile, /definition\.visibility === 'HIDDEN' && !evaluation\.complete/);
  assert.match(profile, /hidden \? '\?\?\?' : definition\.name/);
  assert.match(profile, /evaluation\.complete \? '완료 ✓'/);
  assert.doesNotMatch(profile, /수령하기|보상 수령|claimAchievement/);
});

test('guest achievement storage is separate from combat save schema and auto-claims completed cosmetics idempotently', async () => {
  const runtime = await readSource('../src/achievement-profile.ts');
  assert.match(runtime, /frontline-summoners:achievement-profile:v1/);
  assert.match(runtime, /completedIds/);
  assert.match(runtime, /claimedAchievementIds = \[\.\.\.new Set/);
  assert.match(runtime, /normalizeOwnedProfileCosmeticIds/);
  assert.match(runtime, /writeStoredGuestProfile\(stored\)/);
  assert.doesNotMatch(runtime, /indexedDB|resourceLedgerById|grantResources|spendResources/);
});
