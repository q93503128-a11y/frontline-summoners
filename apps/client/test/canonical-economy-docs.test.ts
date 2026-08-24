import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_SUPPLY_LEVELS } from '@frontline/sim/playable';
import { STAGES } from '../src/prototype.ts';

const DOCS = [
  '../../../docs/CANONICAL.md',
  '../../../docs/GAME_DESIGN_FULL.md',
  '../../../docs/IMPLEMENTATION_STATUS.md',
  '../../../docs/NEW_CHAT_PROMPT.md',
] as const;

async function readDocs(): Promise<readonly string[]> {
  return Promise.all(DOCS.map((relative) => readFile(new URL(relative, import.meta.url), 'utf8')));
}

test('canonical docs track the live supply economy instead of retaining retired values', async () => {
  const docs = await readDocs();
  const expectedIncome = DEFAULT_SUPPLY_LEVELS.map((level) => level.incomePerSecond);
  assert.deepEqual(expectedIncome, [12, 20, 30, 42, 56, 72, 90, 110]);

  for (const [index, source] of docs.entries()) {
    const name = DOCS[index]!;
    for (let levelIndex = 0; levelIndex < DEFAULT_SUPPLY_LEVELS.length; levelIndex += 1) {
      const level = DEFAULT_SUPPLY_LEVELS[levelIndex]!;
      const levelNumber = levelIndex + 1;
      assert.ok(
        source.includes(`Lv${levelNumber}`) && source.includes(String(level.incomePerSecond)),
        `${name} must mention current Lv${levelNumber} income ${level.incomePerSecond}/s`,
      );
    }
    assert.ok(!source.includes('Lv2: 16/초'), `${name} still contains the retired Lv2 16/s economy`);
    assert.ok(!source.includes('Lv2 16/s'), `${name} still contains the retired Lv2 16/s economy`);
    assert.ok(!source.includes('16/s·1400'), `${name} still contains the retired Lv2 16/s economy`);
  }
});

test('canonical handoff documents track the current chapter-one starting-supply anchors', async () => {
  assert.equal(STAGES[0]!.startingSupply, 50);
  assert.equal(STAGES[7]!.startingSupply, 160);
  assert.equal(STAGES[18]!.startingSupply, 280);
  assert.equal(STAGES[19]!.startingSupply, 300);

  const [canonical, , implementation, handoff] = await readDocs();
  for (const [name, source] of [
    ['CANONICAL', canonical],
    ['IMPLEMENTATION_STATUS', implementation],
    ['NEW_CHAT_PROMPT', handoff],
  ] as const) {
    assert.match(source, /ST8[^\n]*160/, `${name} must record the current ST8 starting-supply jump`);
    assert.match(source, /ST20[^\n]*300/, `${name} must record the current ST20 starting supply`);
    assert.ok(!source.includes('50→260'), `${name} still describes the retired 50→260 campaign curve`);
  }
});
