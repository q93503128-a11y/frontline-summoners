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

test('stage navigation groups progression and special stages instead of flattening all future content into one menu', () => {
  assert.equal(STAGE_COLLECTIONS.length, 2);
  assert.deepEqual(STAGE_COLLECTIONS.map((collection) => collection.id), ['chapter-01', 'special-border-01']);
  assert.equal(getStageCollection('chapter-01').stages, STAGES);
  assert.equal(getStageCollection('special-border-01').stages, SPECIAL_STAGES);
  assert.equal(getStageCollectionForStage('border-01').id, 'chapter-01');
  assert.equal(getStageCollectionForStage('special-05').id, 'special-border-01');
});

test('collection unlocks are anchored to a progression stage id instead of a brittle hard-coded clear count', async () => {
  const chapter = getStageCollection('chapter-01');
  const special = getStageCollection('special-border-01');
  assert.equal(chapter.unlockAfterStageId, undefined);
  assert.equal(chapter.requiredProgressionClears, 0);
  assert.equal(special.unlockAfterStageId, 'border-20');
  assert.equal(special.requiredProgressionClears, 20, 'the UI countdown is derived from the border-20 ordinal');

  const raw = await readFile(new URL('../../../content/stage-collections.json', import.meta.url), 'utf8');
  assert.match(raw, /"unlockAfterStageId"\s*:\s*"border-20"/);
  assert.doesNotMatch(raw, /"requiredProgressionClears"/, 'collection content must not persist a duplicated numeric gate');
});

test('current hub cannot silently receive an off-screen third collection before its paging controls are wired', () => {
  assert.ok(
    STAGE_COLLECTIONS.length <= STAGE_COLLECTIONS_PER_PAGE,
    'StageHubScene must consume getStageCollectionPage() and expose previous/next controls before adding collection 3+',
  );
});

test('sortie hub collection paging remains bounded when future chapters and events multiply', () => {
  assert.equal(STAGE_COLLECTIONS_PER_PAGE, 2);
  const progression = STAGE_COLLECTIONS[0]!;
  const special = STAGE_COLLECTIONS[1]!;
  const simulatedFutureCollections = [progression, special, progression, special, progression];

  assert.equal(getStageCollectionPageCount(simulatedFutureCollections), 3);
  assert.deepEqual(getStageCollectionPage(0, simulatedFutureCollections), [progression, special]);
  assert.deepEqual(getStageCollectionPage(1, simulatedFutureCollections), [progression, special]);
  assert.deepEqual(getStageCollectionPage(2, simulatedFutureCollections), [progression]);
  assert.deepEqual(getStageCollectionPage(99, simulatedFutureCollections), [progression], 'out-of-range pages clamp to the final page');
  assert.deepEqual(getStageCollectionPage(-5, simulatedFutureCollections), [progression, special], 'negative pages clamp to page zero');
});

test('stage pages inside a collection use one five-stage paging rule and can recover the page for a played stage', () => {
  const progression = getStageCollection('chapter-01');
  const special = getStageCollection('special-border-01');
  assert.equal(STAGES_PER_COLLECTION_PAGE, 5);
  assert.equal(getCollectionStagePageCount(progression), 4);
  assert.equal(getCollectionStagePageCount(special), 1);
  assert.deepEqual(getCollectionStagePage(progression, 0).map((stage) => stage.id), STAGES.slice(0, 5).map((stage) => stage.id));
  assert.deepEqual(getCollectionStagePage(progression, 3).map((stage) => stage.id), STAGES.slice(15, 20).map((stage) => stage.id));
  assert.deepEqual(getCollectionStagePage(progression, 99).map((stage) => stage.id), STAGES.slice(15, 20).map((stage) => stage.id));
  assert.equal(getCollectionStagePageIndexForStage(progression, 'border-01'), 0);
  assert.equal(getCollectionStagePageIndexForStage(progression, 'border-20'), 3);
  assert.equal(getCollectionStagePageIndexForStage(special, 'special-05'), 0);
  assert.throws(() => getCollectionStagePageIndexForStage(progression, 'special-01'), /not part of collection/);
});

test('collection-aware sortie gate keeps progression sequential and SPECIAL tied to its collection unlock anchor', () => {
  const fullChapter = STAGES.map((stage) => stage.id);
  const nineteen = STAGES.slice(0, 19).map((stage) => stage.id);

  assert.equal(isSortieStageUnlocked('border-01', []), true);
  assert.equal(isSortieStageUnlocked('border-02', []), false);
  assert.equal(isSortieStageUnlocked('border-02', ['border-01']), true);
  assert.equal(isSortieStageUnlocked('special-01', nineteen), false);
  assert.equal(isSortieStageUnlocked('special-01', ['border-20']), false, 'scattered late clear cannot unlock the collection');
  assert.equal(isSortieStageUnlocked('special-01', fullChapter), true);
  assert.equal(isSortieStageUnlocked('special-05', fullChapter), true, 'the first SPECIAL collection opens all five challenges together');
  assert.equal(isSortieStageUnlocked('missing-stage', fullChapter), false);
});

test('special collection unlock uses contiguous campaign progress and cannot be opened by scattered late-stage save fragments', () => {
  const special = getStageCollection('special-border-01');
  assert.equal(isStageCollectionUnlocked(special, STAGES.map((stage) => stage.id)), true);
  assert.equal(isStageCollectionUnlocked(special, ['border-20']), false);
  assert.equal(isStageCollectionUnlocked(special, STAGES.slice(0, 19).map((stage) => stage.id)), false);
});

test('collection progress stays scoped to its own axis and reports the first uncleared stage', () => {
  const progression = getStageCollection('chapter-01');
  const special = getStageCollection('special-border-01');
  const progressionClears = STAGES.slice(0, 4).map((stage) => stage.id);
  const specialClears = ['special-01', 'special-03'];

  assert.deepEqual(getCollectionClearedIds(progression, progressionClears, specialClears), progressionClears);
  assert.deepEqual(getCollectionClearedIds(special, progressionClears, specialClears), specialClears);
  assert.equal(getFirstUnclearedCollectionStageIndex(progression, progressionClears, specialClears), 4);
  assert.equal(getFirstUnclearedCollectionStageIndex(special, progressionClears, specialClears), 1);
});
