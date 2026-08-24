import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAGE_COLLECTIONS,
  getCollectionClearedIds,
  getFirstUnclearedCollectionStageIndex,
  getStageCollection,
  getStageCollectionForStage,
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
