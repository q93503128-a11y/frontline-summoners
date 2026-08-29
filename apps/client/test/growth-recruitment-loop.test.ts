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

test('every duplicate in one recruitment batch advances the same character by one plus level in order', () => {
  const plan = planDuplicatePlusLevelApplications(baseProgress(4), [
    duplicatePull(1),
    duplicatePull(2),
    duplicatePull(3),
  ]);
  assert.deepEqual(plan.map((step) => step.targetPlusLevel), [5, 6, 7]);
  assert.deepEqual(plan.map((step) => step.pullIndex), [0, 1, 2]);
});

test('duplicate plus growth respects the canonical +50 cap', () => {
  const plan = planDuplicatePlusLevelApplications(baseProgress(49), [duplicatePull(1), duplicatePull(2)]);
  assert.deepEqual(plan.map((step) => step.targetPlusLevel), [50, 50]);
});

test('new pulls do not fabricate plus-level applications', () => {
  const fresh: RecruitmentPullResult = { ...duplicatePull(1), duplicate: false };
  assert.deepEqual(planDuplicatePlusLevelApplications(baseProgress(0), [fresh]), []);
});

test('recruitment UI routes through duplicate-growth authority and exposes the resulting plus level', async () => {
  const source = await readFile(new URL('../src/recruitment-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /performGuestRecruitmentWithDuplicateGrowth as performGuestRecruitment/);
  assert.match(source, /중복 1장은 해당 캐릭터 \+레벨 1로 바로 적용됩니다/);
  assert.match(source, /pull\.plusLevelAfter/);
  assert.match(source, /현재 \+\$\{pull\.plusLevelAfter\}/);
});

test('growth scene is registered and exposes paid evolution unlock plus already-unlocked form selection', async () => {
  const [main, growth] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/growth-scene.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(main, /import \{ GrowthScene \} from '\.\/growth-scene';/);
  assert.match(main, /game\.scene\.add\('growth', GrowthScene, false\);/);
  assert.match(growth, /getOwnedCharacterIds\(this\.progress\)/);
  assert.match(growth, /buildCharacterCombatSlot\(slot, meta\.level, meta\.selectedFormId, meta\.plusLevel\)/);
  assert.match(growth, /meta\.unlockedFormIds\.includes\(form\.formId\)/);
  assert.match(growth, /getEvolutionRecipe\(form\.formId\)/);
  assert.match(growth, /getGuestResourceBalance\(this\.progress, 'evo_fragment'\)/);
  assert.match(growth, /recordGuestEvolutionUnlock\(characterId, formId\)/);
  assert.match(growth, /selectGuestEvolutionForm\(characterId, formId\)/);
  assert.doesNotMatch(growth, /recordGuestCharacterLevel/);
});

test('implemented level-cap display follows the four chapter completion 10 to 20 to 30 to 40 to 50 contract', async () => {
  const growth = await readFile(new URL('../src/growth-scene.ts', import.meta.url), 'utf8');
  assert.match(growth, /CHAPTER_ONE_FINAL_STAGE_ID = 'main_01_020'/);
  assert.match(growth, /CHAPTER_TWO_FINAL_STAGE_ID = 'main_02_020'/);
  assert.match(growth, /CHAPTER_THREE_FINAL_STAGE_ID = 'main_03_020'/);
  assert.match(growth, /CHAPTER_FOUR_FINAL_STAGE_ID = 'main_04_020'/);
  assert.match(growth, /if \(cleared\.has\(CHAPTER_FOUR_FINAL_STAGE_ID\)\) return 50/);
  assert.match(growth, /if \(cleared\.has\(CHAPTER_THREE_FINAL_STAGE_ID\)\) return 40/);
  assert.match(growth, /if \(cleared\.has\(CHAPTER_TWO_FINAL_STAGE_ID\)\) return 30/);
  assert.match(growth, /if \(cleared\.has\(CHAPTER_ONE_FINAL_STAGE_ID\)\) return 20/);
  assert.match(growth, /제1장 완료 시 기본 레벨 상한 Lv20/);
  assert.match(growth, /제2장 완료 시 기본 레벨 상한 Lv30/);
  assert.match(growth, /제3장 완료 시 기본 레벨 상한 Lv40/);
  assert.match(growth, /제4장 완료 시 기본 레벨 상한 Lv50/);
  assert.match(growth, /제4장 완료 · 기본 레벨 상한 Lv50 · 1차 메인 엔딩 달성/);
});
