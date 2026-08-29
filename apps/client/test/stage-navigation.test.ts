import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_COLLECTIONS,
  STAGE_COLLECTIONS_PER_PAGE,
  STAGES_PER_COLLECTION_PAGE,
  getCollectionStagePageCount,
  getSpecialStageUnlockText,
  getStageCollection,
  getStageCollectionForStage,
  getStageCollectionPageCount,
  isSortieStageUnlocked,
  isStageCollectionUnlocked,
} from '../src/stage-navigation.ts';
import { STAGES } from '../src/prototype.ts';

const CH1 = STAGES.slice(0, 20).map((stage) => stage.id);
const CH2 = STAGES.slice(20, 40).map((stage) => stage.id);
const CH3 = STAGES.slice(40, 60).map((stage) => stage.id);
const CH4 = STAGES.slice(60, 80).map((stage) => stage.id);

test('stage navigation covers four main chapters plus five SPECIAL collections', () => {
  assert.equal(STAGE_COLLECTIONS.length, 9);
  assert.deepEqual(STAGE_COLLECTIONS.slice(0, 4).map((collection) => collection.id), ['chapter-01','chapter-02','chapter-03','chapter-04']);
  assert.equal(getStageCollectionForStage('resource_gold_05').id, 'special-gold-convoy');
  assert.equal(getStageCollectionForStage('resource_evolution_05').id, 'special-evolution-gate');
  assert.equal(getStageCollectionForStage('resource_starlight_04').id, 'special-starlight-rift');
});

test('hub and collection paging remain bounded at current content volume', () => {
  assert.equal(STAGE_COLLECTIONS_PER_PAGE, 2);
  assert.equal(STAGES_PER_COLLECTION_PAGE, 5);
  assert.equal(getStageCollectionPageCount(), 5);
  assert.equal(getCollectionStagePageCount(getStageCollection('chapter-01')), 4);
  assert.equal(getCollectionStagePageCount(getStageCollection('special-gold-convoy')), 1);
});

test('main chapter collection gates still require contiguous canonical progression', () => {
  assert.equal(isStageCollectionUnlocked(getStageCollection('chapter-02'), CH1), true);
  assert.equal(isStageCollectionUnlocked(getStageCollection('chapter-03'), [...CH1, ...CH2]), true);
  assert.equal(isStageCollectionUnlocked(getStageCollection('chapter-04'), [...CH1, ...CH2, ...CH3]), true);
  assert.equal(isStageCollectionUnlocked(getStageCollection('chapter-04'), [...CH1, ...CH2, CH3[19]!]), false);
});

test('periodic SPECIAL tiers require both previous SPECIAL clear and configured main progress', () => {
  const chapterOneOnly = CH1;
  assert.equal(isSortieStageUnlocked('resource_gold_01', chapterOneOnly, []), true);
  assert.equal(isSortieStageUnlocked('resource_gold_02', chapterOneOnly, []), false);
  assert.equal(isSortieStageUnlocked('resource_gold_02', chapterOneOnly, ['resource_gold_01']), true);

  assert.equal(isSortieStageUnlocked('resource_gold_03', [...CH1, ...CH2.slice(0, 9)], ['resource_gold_01','resource_gold_02']), false);
  assert.equal(isSortieStageUnlocked('resource_gold_03', [...CH1, ...CH2.slice(0, 10)], ['resource_gold_01','resource_gold_02']), true);

  assert.equal(isSortieStageUnlocked('resource_evolution_05', [...CH1, ...CH2, ...CH3, ...CH4.slice(0, 9)], ['resource_evolution_01','resource_evolution_02','resource_evolution_03','resource_evolution_04']), false);
  assert.equal(isSortieStageUnlocked('resource_evolution_05', [...CH1, ...CH2, ...CH3, ...CH4.slice(0, 10)], ['resource_evolution_01','resource_evolution_02','resource_evolution_03','resource_evolution_04']), true);
});

test('SPECIAL lock text distinguishes main progression gate from previous-stage gate', () => {
  assert.equal(getSpecialStageUnlockText('resource_gold_02', CH1, []), '이전 단계 NORMAL_CLEAR 필요');
  assert.equal(getSpecialStageUnlockText('resource_gold_03', CH1, ['resource_gold_01','resource_gold_02']), '메인 30 스테이지 진도 필요');
  assert.equal(getSpecialStageUnlockText('resource_gold_03', [...CH1, ...CH2.slice(0, 10)], ['resource_gold_01','resource_gold_02']), undefined);
});
