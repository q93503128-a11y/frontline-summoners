import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PLAYER_SLOTS,
  STARTER_SLOT_ID,
  STAGES,
  createPrototypeBattle,
  getContiguousClearedStageIds,
  getStage,
  getStageNumber,
  getTreasureIdsForClearedStages,
  getUnlockedSlotIds,
  isStageUnlocked,
} from '../src/prototype.ts';

async function loadCanonicalStageJson(): Promise<unknown> {
  const url = new URL('../../../content/stages/chapter-01.json', import.meta.url);
  return JSON.parse(await readFile(url, 'utf8')) as unknown;
}

test('fresh progress owns only the starter and can enter only stage one', () => {
  assert.deepEqual(getUnlockedSlotIds([]), [STARTER_SLOT_ID]);
  assert.equal(STARTER_SLOT_ID, 'militia');
  assert.equal(isStageUnlocked(STAGES[0]!.id, []), true);
  assert.equal(isStageUnlocked(STAGES[1]!.id, []), false);
  assert.equal(isStageUnlocked(STAGES[19]!.id, []), false);

  const battle = createPrototypeBattle(STAGES[0]!.id, getUnlockedSlotIds([]));
  assert.equal(battle.playerSlots.length, 1);
  assert.equal(battle.playerSlots[0]?.slotId, 'militia');
});

test('clearing a stage opens only its immediate successor', () => {
  const cleared = [STAGES[0]!.id];
  assert.equal(isStageUnlocked(STAGES[1]!.id, cleared), true);
  assert.equal(isStageUnlocked(STAGES[2]!.id, cleared), false);
  assert.deepEqual(getUnlockedSlotIds(cleared), ['militia', 'guard']);
});

test('progression rejects unknown stage ids and cannot be skipped by a non-contiguous clear set', () => {
  assert.equal(isStageUnlocked('missing-stage', STAGES.map((stage) => stage.id)), false);
  assert.throws(() => getStage('missing-stage'), /Unknown stage: missing-stage/);
  assert.throws(() => getStageNumber('missing-stage'), /Unknown progression stage: missing-stage/);

  const outOfOrder = [STAGES[2]!.id, STAGES[15]!.id];
  assert.deepEqual(getContiguousClearedStageIds(outOfOrder), []);
  assert.equal(isStageUnlocked(STAGES[3]!.id, outOfOrder), false, 'out-of-order clear records must not open later campaign stages');
  assert.deepEqual(getUnlockedSlotIds(outOfOrder), ['militia'], 'out-of-order clear records must not grant later roster rewards');
  assert.deepEqual(getTreasureIdsForClearedStages(outOfOrder), [], 'out-of-order clear records must not grant derived treasure effects');

  const contiguous = [STAGES[0]!.id, STAGES[1]!.id, STAGES[2]!.id];
  assert.deepEqual(getContiguousClearedStageIds(contiguous), contiguous);
  assert.equal(isStageUnlocked(STAGES[3]!.id, contiguous), true);
});

test('full chapter progression unlocks all ten player units', () => {
  const cleared = STAGES.map((stage) => stage.id);
  assert.deepEqual(getUnlockedSlotIds(cleared), PLAYER_SLOTS.map((slot) => slot.slotId));
});

test('runtime stage definitions stay identical to canonical chapter json', async () => {
  const raw = await loadCanonicalStageJson();
  assert.deepEqual(STAGES, raw);
});

test('chapter one has visible battlefield variety in both theme and length', () => {
  assert.equal(new Set(STAGES.map((stage) => stage.theme)).size, 7);
  assert.ok(new Set(STAGES.map((stage) => stage.mapLength)).size >= 12);
  assert.ok(Math.min(...STAGES.map((stage) => stage.mapLength)) <= 800);
  assert.ok(Math.max(...STAGES.map((stage) => stage.mapLength)) >= 1300);
});