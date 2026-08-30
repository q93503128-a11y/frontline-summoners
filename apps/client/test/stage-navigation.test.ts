import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_COLLECTIONS,
  STAGE_COLLECTIONS_PER_PAGE,
  STAGES_PER_COLLECTION_PAGE,
  getCollectionStagePageCount,
  getSpecialStageUnlockText,
  getStageCollection,
  getStageCollectionAvailabilityText,
  getStageCollectionForStage,
  getStageCollectionPageCount,
  isSortieStageUnlocked,
  isStageCollectionAvailable,
  isStageCollectionUnlocked,
} from '../src/stage-navigation.ts';
import { STAGES } from '../src/prototype.ts';

const CH1 = STAGES.slice(0, 20).map((stage) => stage.id);
const CH2 = STAGES.slice(20, 40).map((stage) => stage.id);
const CH3 = STAGES.slice(40, 60).map((stage) => stage.id);
const CH4 = STAGES.slice(60, 80).map((stage) => stage.id);
const DURING_SUMMER = Date.parse('2026-08-29T12:00:00+09:00');
const AFTER_SUMMER = Date.parse('2026-10-01T12:00:00+09:00');
const GOLD_OPEN = Date.parse('2026-08-30T12:00:00+09:00');
const GOLD_CLOSED = Date.parse('2026-09-03T12:00:00+09:00');

test('stage navigation covers four main chapters plus fifteen executable SPECIAL collections', () => {
  assert.equal(STAGE_COLLECTIONS.length, 19);
  assert.deepEqual(STAGE_COLLECTIONS.slice(0, 4).map((collection) => collection.id), ['chapter-01','chapter-02','chapter-03','chapter-04']);
  assert.equal(getStageCollectionForStage('special_gold_convoy_05').id, 'special_gold_convoy');
  assert.equal(getStageCollectionForStage('special_five_banners_02').id, 'special_five_banners');
  assert.equal(getStageCollectionForStage('special_light_purse_02').id, 'special_light_purse');
  assert.equal(getStageCollectionForStage('event_summer_01_06').id, 'event_summer_kaiju_01');
  assert.equal(getStageCollectionForStage('event_zero_edge_01_05').id, 'event_zero_edge_trial_01');
});

test('hub and collection paging remain bounded at current content volume', () => {
  assert.equal(STAGE_COLLECTIONS_PER_PAGE, 2);
  assert.equal(STAGES_PER_COLLECTION_PAGE, 5);
  assert.equal(getStageCollectionPageCount(), 10);
  assert.equal(getCollectionStagePageCount(getStageCollection('chapter-01')), 4);
  assert.equal(getCollectionStagePageCount(getStageCollection('event_summer_kaiju_01')), 2);
});

test('main chapter collection gates still require contiguous canonical progression', () => {
  assert.equal(isStageCollectionUnlocked(getStageCollection('chapter-02'), CH1), true);
  assert.equal(isStageCollectionUnlocked(getStageCollection('chapter-03'), [...CH1, ...CH2]), true);
  assert.equal(isStageCollectionUnlocked(getStageCollection('chapter-04'), [...CH1, ...CH2, ...CH3]), true);
  assert.equal(isStageCollectionUnlocked(getStageCollection('chapter-04'), [...CH1, ...CH2, CH3[19]!]), false);
});

test('periodic SPECIAL availability repeats 72h windows and participates in sortie gates', () => {
  const gold = getStageCollection('special_gold_convoy');
  assert.equal(isStageCollectionAvailable(gold, GOLD_OPEN), true);
  assert.equal(isStageCollectionAvailable(gold, GOLD_CLOSED), false);
  assert.equal(getStageCollectionAvailabilityText(gold, GOLD_CLOSED), '주기 종료 · 약 60시간 후 재개방');
  assert.equal(isSortieStageUnlocked('special_gold_convoy_01', CH1.slice(0, 3), [], GOLD_OPEN), true);
  assert.equal(isSortieStageUnlocked('special_gold_convoy_01', CH1.slice(0, 3), [], GOLD_CLOSED), false);
});

test('periodic SPECIAL tiers require both previous SPECIAL clear and configured main progress', () => {
  assert.equal(isSortieStageUnlocked('special_gold_convoy_01', CH1, [], GOLD_OPEN), true);
  assert.equal(isSortieStageUnlocked('special_gold_convoy_02', CH1, [], GOLD_OPEN), false);
  assert.equal(isSortieStageUnlocked('special_gold_convoy_02', CH1, ['special_gold_convoy_01'], GOLD_OPEN), true);
  assert.equal(isSortieStageUnlocked('special_gold_convoy_03', [...CH1, ...CH2.slice(0, 19)], ['special_gold_convoy_01','special_gold_convoy_02'], GOLD_OPEN), false);
  assert.equal(isSortieStageUnlocked('special_gold_convoy_03', [...CH1, ...CH2], ['special_gold_convoy_01','special_gold_convoy_02'], GOLD_OPEN), true);
});

test('restriction collections enforce chapter gates and internal clear order', () => {
  assert.equal(isSortieStageUnlocked('special_five_banners_01', [...CH1, ...CH2.slice(0, 19)], []), false);
  assert.equal(isSortieStageUnlocked('special_five_banners_01', [...CH1, ...CH2], []), true);
  assert.equal(isSortieStageUnlocked('special_five_banners_02', [...CH1, ...CH2], []), false);
  assert.equal(isSortieStageUnlocked('special_five_banners_02', [...CH1, ...CH2], ['special_five_banners_01']), true);
  assert.equal(isSortieStageUnlocked('special_light_purse_01', [...CH1, ...CH2, ...CH3.slice(0, 9)], []), false);
  assert.equal(isSortieStageUnlocked('special_light_purse_01', [...CH1, ...CH2, ...CH3.slice(0, 10)], []), true);
});

test('event availability is deterministic, rerunnable, and participates in sortie gates', () => {
  const summer = getStageCollection('event_summer_kaiju_01');
  assert.equal(isStageCollectionAvailable(summer, DURING_SUMMER), true);
  assert.equal(isStageCollectionAvailable(summer, AFTER_SUMMER), false);
  assert.equal(getStageCollectionAvailabilityText(summer, AFTER_SUMMER), '이벤트 시작 전 · 복각 일정 있음');
  assert.equal(isSortieStageUnlocked('event_summer_01_01', CH1, [], DURING_SUMMER), true);
  assert.equal(isSortieStageUnlocked('event_summer_01_01', CH1, [], AFTER_SUMMER), false);
  assert.equal(getSpecialStageUnlockText('event_summer_01_01', CH1, [], AFTER_SUMMER), '이벤트 시작 전 · 복각 일정 있음');
});

test('event stages preserve sequential NORMAL_CLEAR inside an active window', () => {
  assert.equal(isSortieStageUnlocked('event_summer_01_02', CH1, [], DURING_SUMMER), false);
  assert.equal(isSortieStageUnlocked('event_summer_01_02', CH1, ['event_summer_01_01'], DURING_SUMMER), true);
  assert.equal(isSortieStageUnlocked('event_zero_edge_01_02', CH1, [], DURING_SUMMER), false);
  assert.equal(isSortieStageUnlocked('event_zero_edge_01_02', CH1, ['event_zero_edge_01_01'], DURING_SUMMER), true);
});

test('permanent challenge collections retain chapter gates and internal order', () => {
  assert.equal(isSortieStageUnlocked('special_glutton_02', CH1, []), false);
  assert.equal(isSortieStageUnlocked('special_glutton_02', CH1, ['special_glutton_01']), true);
  assert.equal(isSortieStageUnlocked('special_echoes_01', [...CH1, ...CH2, ...CH3, ...CH4.slice(0, 19)], []), false);
  assert.equal(isSortieStageUnlocked('special_echoes_01', [...CH1, ...CH2, ...CH3, ...CH4], []), true);
});

test('SPECIAL lock text distinguishes periodic availability, main progression and previous-stage gates', () => {
  assert.equal(getSpecialStageUnlockText('special_gold_convoy_02', CH1, [], GOLD_OPEN), '이전 단계 NORMAL_CLEAR 필요');
  assert.equal(getSpecialStageUnlockText('special_gold_convoy_03', CH1, ['special_gold_convoy_01','special_gold_convoy_02'], GOLD_OPEN), '메인 40 스테이지 진도 필요');
  assert.equal(getSpecialStageUnlockText('special_gold_convoy_03', [...CH1, ...CH2], ['special_gold_convoy_01','special_gold_convoy_02'], GOLD_OPEN), undefined);
  assert.equal(getSpecialStageUnlockText('special_gold_convoy_01', CH1, [], GOLD_CLOSED), '주기 종료 · 약 60시간 후 재개방');
});
