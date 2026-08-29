import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PLAYER_SLOTS,
  STARTER_SLOT_ID,
  STAGES,
  createPrototypeBattle,
  getContiguousClearedStageIds,
  getPermanentRewardIdsForClearedStages,
  getStage,
  getStageNumber,
  getUnlockedSlotIds,
  isStageUnlocked,
} from '../src/prototype.ts';

async function loadCanonicalStageJson(): Promise<readonly Record<string, unknown>[]> {
  const urls = [
    '../../../content/stages/chapter-01.json',
    '../../../content/stages/chapter-02-01-05.json',
    '../../../content/stages/chapter-02-06-10.json',
    '../../../content/stages/chapter-02-11-15.json',
    '../../../content/stages/chapter-02-16-20.json',
  ];
  const chunks = await Promise.all(urls.map(async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')) as readonly Record<string, unknown>[]));
  return chunks.flat();
}

function assertAuthoredSubset(actual: unknown, authored: unknown, context: string): void {
  if (Array.isArray(authored)) {
    assert.ok(Array.isArray(actual), `${context} must remain an array`);
    assert.equal(actual.length, authored.length, `${context} changed authored array length`);
    authored.forEach((value, index) => assertAuthoredSubset(actual[index], value, `${context}[${index}]`));
    return;
  }

  if (typeof authored === 'object' && authored !== null) {
    assert.ok(typeof actual === 'object' && actual !== null && !Array.isArray(actual), `${context} must remain an object`);
    const actualRecord = actual as Record<string, unknown>;
    for (const [key, value] of Object.entries(authored as Record<string, unknown>)) {
      assert.ok(Object.hasOwn(actualRecord, key), `${context} lost authored field ${key}`);
      assertAuthoredSubset(actualRecord[key], value, `${context}.${key}`);
    }
    return;
  }

  assert.deepEqual(actual, authored, `${context} changed authored value`);
}

test('fresh progress owns only the starter and can enter only stage one', () => {
  assert.deepEqual(getUnlockedSlotIds([]), [STARTER_SLOT_ID]);
  assert.equal(STARTER_SLOT_ID, 'militia');
  assert.equal(isStageUnlocked(STAGES[0]!.id, []), true);
  assert.equal(isStageUnlocked(STAGES[1]!.id, []), false);
  assert.equal(isStageUnlocked(STAGES[19]!.id, []), false);
  assert.equal(isStageUnlocked(STAGES[20]!.id, []), false);

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

test('chapter-two entry is the immediate successor of a contiguous chapter-one clear', () => {
  const chapterOne = STAGES.slice(0, 20).map((stage) => stage.id);
  assert.equal(STAGES[19]!.id, 'main_01_020');
  assert.equal(STAGES[20]!.id, 'main_02_001');
  assert.equal(isStageUnlocked(STAGES[20]!.id, chapterOne.slice(0, 19)), false);
  assert.equal(isStageUnlocked(STAGES[20]!.id, chapterOne), true);
  assert.equal(isStageUnlocked(STAGES[21]!.id, chapterOne), false);
});

test('progression rejects unknown stage ids and cannot be skipped by a non-contiguous clear set', () => {
  assert.equal(isStageUnlocked('missing-stage', STAGES.map((stage) => stage.id)), false);
  assert.throws(() => getStage('missing-stage'), /Unknown stage: missing-stage/);
  assert.throws(() => getStageNumber('missing-stage'), /Unknown progression stage: missing-stage/);

  const outOfOrder = [STAGES[2]!.id, STAGES[15]!.id, STAGES[35]!.id];
  assert.deepEqual(getContiguousClearedStageIds(outOfOrder), []);
  assert.equal(isStageUnlocked(STAGES[3]!.id, outOfOrder), false, 'out-of-order clear records must not open later campaign stages');
  assert.deepEqual(getUnlockedSlotIds(outOfOrder), ['militia'], 'out-of-order clear records must not grant later roster rewards');
  assert.deepEqual(getPermanentRewardIdsForClearedStages(outOfOrder), [], 'out-of-order clear records must not grant permanent stage rewards');

  const contiguous = [STAGES[0]!.id, STAGES[1]!.id, STAGES[2]!.id];
  assert.deepEqual(getContiguousClearedStageIds(contiguous), contiguous);
  assert.equal(isStageUnlocked(STAGES[3]!.id, contiguous), true);
  assert.deepEqual(
    getPermanentRewardIdsForClearedStages(contiguous),
    contiguous.map((stageId) => getStage(stageId).permanentRewardId),
    'each normally cleared progression stage grants its canonical permanent reward',
  );
});

test('full current progression keeps the ten story units and grants all forty permanent rewards', () => {
  const cleared = STAGES.map((stage) => stage.id);
  assert.equal(STAGES.length, 40);
  assert.deepEqual(getUnlockedSlotIds(cleared), PLAYER_SLOTS.map((slot) => slot.slotId));
  assert.deepEqual(getPermanentRewardIdsForClearedStages(cleared), STAGES.map((stage) => stage.permanentRewardId));
});

test('runtime stage definitions preserve every authored canonical field while allowing schema defaults', async () => {
  const raw = await loadCanonicalStageJson();
  assert.equal(STAGES.length, raw.length);
  for (const [index, rawStage] of raw.entries()) {
    const runtimeStage = STAGES[index] as unknown as Record<string, unknown>;
    assertAuthoredSubset(runtimeStage, rawStage, String(rawStage.id));
  }

  assert.equal(
    STAGES[0]!.waves[0]!.spawn.magnificationPermille,
    1000,
    'omitted wave magnification must normalize to the neutral 1000 permille default',
  );
});

test('chapter one retains visible battlefield variety in both theme and length', () => {
  const chapterOne = STAGES.slice(0, 20);
  const lengths = chapterOne.map((stage) => stage.mapLength);
  assert.equal(new Set(chapterOne.map((stage) => stage.theme)).size, 7);
  assert.ok(new Set(lengths).size >= 12);
  assert.ok(Math.max(...lengths) - Math.min(...lengths) >= 1000, 'chapter should include meaningfully short and long battlefields');
});
