import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { planDuplicatePlusLevelApplications } from '../src/recruitment-growth.ts';
import type { RecruitmentPullResult } from '../src/recruitment.ts';
import type { GuestProgress } from '../src/save.ts';

const baseProgress = (plusLevel: number): GuestProgress => ({
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  ownedRecruitmentCharacterIds: ['char_s01_mireille'],
  characterProgressById: {
    char_s01_mireille: {
      level: 1,
      plusLevel,
      unlockedFormIds: ['char_s01_mireille_f1'],
      selectedFormId: 'char_s01_mireille_f1',
    },
  },
});

const duplicatePull = (pullNumber: number): RecruitmentPullResult => ({
  pullNumber,
  characterId: 'char_s01_mireille',
  rarity: 'S',
  duplicate: true,
});

test('duplicate plus planning remains deterministic for tooling and stops at the canonical +50 cap', () => {
  const plan = planDuplicatePlusLevelApplications(baseProgress(48), [duplicatePull(1), duplicatePull(2), duplicatePull(3)]);
  assert.deepEqual(plan.map((step) => step.targetPlusLevel), [49, 50, 50]);
  assert.deepEqual(plan.map((step) => step.pullIndex), [0, 1, 2]);
});

test('new pulls do not fabricate plus-level applications', () => {
  const fresh: RecruitmentPullResult = { ...duplicatePull(1), duplicate: false };
  assert.deepEqual(planDuplicatePlusLevelApplications(baseProgress(0), [fresh]), []);
});

test('recruitment UI exposes paid pulls and explicit duplicate handling through active authority', async () => {
  const source = await readFile(new URL('../src/recruitment-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /performActiveRecruitment/);
  assert.doesNotMatch(source, /performGuestRecruitmentWithDuplicateGrowth as performGuestRecruitment/);
  assert.match(source, /getRecruitmentCost\(1\)/);
  assert.match(source, /getRecruitmentCost\(10\)/);
  assert.match(source, /'APPLY_PLUS'/);
  assert.match(source, /'DISMANTLE'/);
  assert.match(source, /\+1 우선/);
  assert.match(source, /분해 우선/);
  assert.match(source, /pull\.duplicateResolution === 'PLUS'/);
  assert.match(source, /pull\.duplicateResolution === 'DISMANTLE'/);
});

test('focused growth scene keeps paid level, plus growth, evolution unlock, and form selection on active authority', async () => {
  const [main, growth] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/growth-command-scene.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(main, /import \{ GrowthScene \} from '\.\/growth-command-scene';/);
  assert.match(main, /game\.scene\.add\('growth', GrowthScene, false\);/);
  assert.match(growth, /getOwnedCharacterIds\(this\.progress\)/);
  assert.match(growth, /buildCharacterCombatSlot\(slot, meta\.level, meta\.selectedFormId, meta\.plusLevel\)/);
  assert.match(growth, /getLevelUpgradeGoldCost/);
  assert.match(growth, /getPlusLevelSoulEssenceCost/);
  assert.match(growth, /recordActiveCharacterLevel\(characterId, targetLevel\)/);
  assert.match(growth, /recordActiveCharacterPlusLevel\(characterId, current\.plusLevel \+ 1\)/);
  assert.match(growth, /getEvolutionRecipe\(form\.formId\)/);
  assert.match(growth, /recordActiveEvolutionUnlock\(characterId, formId\)/);
  assert.match(growth, /selectActiveEvolutionForm\(characterId, formId\)/);
  assert.doesNotMatch(growth, /recordGuestCharacterLevel|recordGuestCharacterPlusLevel|recordGuestEvolutionUnlock|selectGuestEvolutionForm/);
});

test('runtime level cap delegates to save authority and communicates the four chapter cap chain', async () => {
  const growth = await readFile(new URL('../src/growth-command-scene.ts', import.meta.url), 'utf8');
  const save = await readFile(new URL('../src/save.ts', import.meta.url), 'utf8');
  assert.match(growth, /getGuestBaseLevelCap\(this\.progress\)/);
  assert.match(save, /if \(cleared\.has\('main_04_020'\)\) return 50/);
  assert.match(save, /if \(cleared\.has\('main_03_020'\)\) return 40/);
  assert.match(save, /if \(cleared\.has\('main_02_020'\)\) return 30/);
  assert.match(save, /if \(cleared\.has\('main_01_020'\)\) return 20/);
  assert.match(growth, /제1장 완료 시 Lv20 개방/);
  assert.match(growth, /제2장 완료 시 Lv30 개방/);
  assert.match(growth, /제3장 완료 시 Lv40 개방/);
  assert.match(growth, /제4장 완료 시 Lv50 개방/);
});
