import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  STAGE_COLLECTIONS,
  STAGE_COLLECTIONS_PER_PAGE,
  STAGES_PER_COLLECTION_PAGE,
  getCollectionClearedIds,
  getCollectionStagePage,
  getCollectionStagePageCount,
  getCollectionStagePageIndexForStage,
  getFirstUnclearedCollectionStageIndex,
  getStageCollection,
  getStageCollectionForStage,
  getStageCollectionPage,
  getStageCollectionPageCount,
  isSortieStageUnlocked,
  isStageCollectionUnlocked,
} from '../src/stage-navigation.ts';
import { SPECIAL_STAGES, STAGES } from '../src/prototype.ts';

const FIRST_MAIN_STAGE_ID = 'main_01_001';
const SECOND_MAIN_STAGE_ID = 'main_01_002';
const FINAL_CHAPTER_ONE_STAGE_ID = 'main_01_020';
const FIRST_CHAPTER_TWO_STAGE_ID = 'main_02_001';
const FINAL_CHAPTER_TWO_STAGE_ID = 'main_02_020';
const CHAPTER_ONE_STAGES = STAGES.slice(0, 20);
const CHAPTER_TWO_STAGES = STAGES.slice(20, 40);

test('stage navigation groups both progression chapters and special stages instead of flattening them', () => {
  assert.equal(STAGE_COLLECTIONS.length, 3);
  assert.deepEqual(STAGE_COLLECTIONS.map((collection) => collection.id), ['chapter-01', 'chapter-02', 'special-border-01']);
  assert.deepEqual(getStageCollection('chapter-01').stages, CHAPTER_ONE_STAGES);
  assert.deepEqual(getStageCollection('chapter-02').stages, CHAPTER_TWO_STAGES);
  assert.deepEqual(getStageCollection('special-border-01').stages, SPECIAL_STAGES);
  assert.equal(getStageCollectionForStage(FIRST_MAIN_STAGE_ID).id, 'chapter-01');
  assert.equal(getStageCollectionForStage(FIRST_CHAPTER_TWO_STAGE_ID).id, 'chapter-02');
  assert.equal(getStageCollectionForStage('special-05').id, 'special-border-01');
});

test('collection unlocks are anchored to canonical progression stage ids instead of brittle hard-coded clear counts', async () => {
  const chapterOne = getStageCollection('chapter-01');
  const chapterTwo = getStageCollection('chapter-02');
  const special = getStageCollection('special-border-01');
  assert.equal(chapterOne.unlockAfterStageId, undefined);
  assert.equal(chapterOne.requiredProgressionClears, 0);
  assert.equal(chapterTwo.unlockAfterStageId, FINAL_CHAPTER_ONE_STAGE_ID);
  assert.equal(chapterTwo.requiredProgressionClears, 20);
  assert.equal(special.unlockAfterStageId, FINAL_CHAPTER_ONE_STAGE_ID);
  assert.equal(special.requiredProgressionClears, 20, 'the UI countdown is derived from the canonical chapter-final ordinal');

  const raw = await readFile(new URL('../../../content/stage-collections.json', import.meta.url), 'utf8');
  assert.match(raw, /"id"\s*:\s*"chapter-02"/);
  assert.match(raw, /"unlockAfterStageId"\s*:\s*"main_01_020"/);
  assert.doesNotMatch(raw, /"requiredProgressionClears"/, 'collection content must not persist a duplicated numeric gate');
});

test('stage hub consumes collection paging and exposes previous/next controls for the third collection', async () => {
  assert.ok(STAGE_COLLECTIONS.length > STAGE_COLLECTIONS_PER_PAGE);
  const source = await readFile(new URL('../src/stage-hub-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /getStageCollectionPage\(this\.page\)/);
  assert.match(source, /getStageCollectionPageCount\(\)/);
  assert.match(source, /'◀ 이전', \(\) => this\.changePage\(-1\)/);
  assert.match(source, /'다음 ▶', \(\) => this\.changePage\(1\)/);
});

test('sortie hub collection paging remains bounded when future chapters and events multiply', () => {
  assert.equal(STAGE_COLLECTIONS_PER_PAGE, 2);
  const progression = STAGE_COLLECTIONS[0]!;
  const chapterTwo = STAGE_COLLECTIONS[1]!;
  const special = STAGE_COLLECTIONS[2]!;
  const simulatedFutureCollections = [progression, chapterTwo, special, progression, chapterTwo];

  assert.equal(getStageCollectionPageCount(simulatedFutureCollections), 3);
  assert.deepEqual(getStageCollectionPage(0, simulatedFutureCollections), [progression, chapterTwo]);
  assert.deepEqual(getStageCollectionPage(1, simulatedFutureCollections), [special, progression]);
  assert.deepEqual(getStageCollectionPage(2, simulatedFutureCollections), [chapterTwo]);
  assert.deepEqual(getStageCollectionPage(99, simulatedFutureCollections), [chapterTwo], 'out-of-range pages clamp to the final page');
  assert.deepEqual(getStageCollectionPage(-5, simulatedFutureCollections), [progression, chapterTwo], 'negative pages clamp to page zero');
});

test('stage pages inside each collection use one five-stage paging rule and can recover played-stage pages', () => {
  const chapterOne = getStageCollection('chapter-01');
  const chapterTwo = getStageCollection('chapter-02');
  const special = getStageCollection('special-border-01');
  assert.equal(STAGES_PER_COLLECTION_PAGE, 5);
  assert.equal(getCollectionStagePageCount(chapterOne), 4);
  assert.equal(getCollectionStagePageCount(chapterTwo), 4);
  assert.equal(getCollectionStagePageCount(special), 1);
  assert.deepEqual(getCollectionStagePage(chapterOne, 0).map((stage) => stage.id), CHAPTER_ONE_STAGES.slice(0, 5).map((stage) => stage.id));
  assert.deepEqual(getCollectionStagePage(chapterOne, 3).map((stage) => stage.id), CHAPTER_ONE_STAGES.slice(15, 20).map((stage) => stage.id));
  assert.deepEqual(getCollectionStagePage(chapterTwo, 0).map((stage) => stage.id), CHAPTER_TWO_STAGES.slice(0, 5).map((stage) => stage.id));
  assert.deepEqual(getCollectionStagePage(chapterTwo, 99).map((stage) => stage.id), CHAPTER_TWO_STAGES.slice(15, 20).map((stage) => stage.id));
  assert.equal(getCollectionStagePageIndexForStage(chapterOne, FIRST_MAIN_STAGE_ID), 0);
  assert.equal(getCollectionStagePageIndexForStage(chapterOne, FINAL_CHAPTER_ONE_STAGE_ID), 3);
  assert.equal(getCollectionStagePageIndexForStage(chapterTwo, FIRST_CHAPTER_TWO_STAGE_ID), 0);
  assert.equal(getCollectionStagePageIndexForStage(chapterTwo, FINAL_CHAPTER_TWO_STAGE_ID), 3);
  assert.equal(getCollectionStagePageIndexForStage(special, 'special-05'), 0);
  assert.throws(() => getCollectionStagePageIndexForStage(chapterOne, 'special-01'), /not part of collection/);
});

test('collection-aware sortie gate keeps progression sequential and chapter-one-gated collections tied to their anchor', () => {
  const fullChapterOne = CHAPTER_ONE_STAGES.map((stage) => stage.id);
  const nineteen = CHAPTER_ONE_STAGES.slice(0, 19).map((stage) => stage.id);

  assert.equal(isSortieStageUnlocked(FIRST_MAIN_STAGE_ID, []), true);
  assert.equal(isSortieStageUnlocked(SECOND_MAIN_STAGE_ID, []), false);
  assert.equal(isSortieStageUnlocked(SECOND_MAIN_STAGE_ID, [FIRST_MAIN_STAGE_ID]), true);
  assert.equal(isSortieStageUnlocked(FIRST_CHAPTER_TWO_STAGE_ID, nineteen), false);
  assert.equal(isSortieStageUnlocked(FIRST_CHAPTER_TWO_STAGE_ID, fullChapterOne), true);
  assert.equal(isSortieStageUnlocked('special-01', nineteen), false);
  assert.equal(isSortieStageUnlocked('special-01', [FINAL_CHAPTER_ONE_STAGE_ID]), false, 'scattered late clear cannot unlock the collection');
  assert.equal(isSortieStageUnlocked('special-01', fullChapterOne), true);
  assert.equal(isSortieStageUnlocked('special-05', fullChapterOne), true, 'the first SPECIAL collection opens all five challenges together');
  assert.equal(isSortieStageUnlocked('missing-stage', fullChapterOne), false);
});

test('chapter-two and special collection unlocks require contiguous chapter-one progress', () => {
  const chapterTwo = getStageCollection('chapter-02');
  const special = getStageCollection('special-border-01');
  const fullChapterOne = CHAPTER_ONE_STAGES.map((stage) => stage.id);
  assert.equal(isStageCollectionUnlocked(chapterTwo, fullChapterOne), true);
  assert.equal(isStageCollectionUnlocked(special, fullChapterOne), true);
  assert.equal(isStageCollectionUnlocked(chapterTwo, [FINAL_CHAPTER_ONE_STAGE_ID]), false);
  assert.equal(isStageCollectionUnlocked(special, [FINAL_CHAPTER_ONE_STAGE_ID]), false);
  assert.equal(isStageCollectionUnlocked(chapterTwo, CHAPTER_ONE_STAGES.slice(0, 19).map((stage) => stage.id)), false);
});

test('collection progress stays scoped to its own axis and reports the first uncleared stage', () => {
  const chapterOne = getStageCollection('chapter-01');
  const chapterTwo = getStageCollection('chapter-02');
  const special = getStageCollection('special-border-01');
  const progressionClears = [...CHAPTER_ONE_STAGES.map((stage) => stage.id), ...CHAPTER_TWO_STAGES.slice(0, 4).map((stage) => stage.id)];
  const specialClears = ['special-01', 'special-03'];

  assert.deepEqual(getCollectionClearedIds(chapterOne, progressionClears, specialClears), CHAPTER_ONE_STAGES.map((stage) => stage.id));
  assert.deepEqual(getCollectionClearedIds(chapterTwo, progressionClears, specialClears), CHAPTER_TWO_STAGES.slice(0, 4).map((stage) => stage.id));
  assert.deepEqual(getCollectionClearedIds(special, progressionClears, specialClears), specialClears);
  assert.equal(getFirstUnclearedCollectionStageIndex(chapterOne, progressionClears, specialClears), 20);
  assert.equal(getFirstUnclearedCollectionStageIndex(chapterTwo, progressionClears, specialClears), 4);
  assert.equal(getFirstUnclearedCollectionStageIndex(special, progressionClears, specialClears), 1);
});
