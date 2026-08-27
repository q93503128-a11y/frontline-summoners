import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_SUPPLY_LEVELS } from '@frontline/sim/playable';
import { STAGES } from '../src/prototype.ts';

async function readLiveBalanceAnchors(): Promise<string> {
  return readFile(new URL('../../../docs/LIVE_BALANCE_ANCHORS.md', import.meta.url), 'utf8');
}

test('live balance anchors track the runtime supply economy without duplicating volatile values across handoff docs', async () => {
  const source = await readLiveBalanceAnchors();
  const expectedIncome = DEFAULT_SUPPLY_LEVELS.map((level) => level.incomePerSecond);
  assert.deepEqual(expectedIncome, [12, 20, 30, 42, 56, 72, 90, 110]);

  for (let levelIndex = 0; levelIndex < DEFAULT_SUPPLY_LEVELS.length; levelIndex += 1) {
    const level = DEFAULT_SUPPLY_LEVELS[levelIndex]!;
    const levelNumber = levelIndex + 1;
    assert.ok(
      source.includes(`Lv${levelNumber}: ${level.incomePerSecond}/초`),
      `LIVE_BALANCE_ANCHORS must record current Lv${levelNumber} income ${level.incomePerSecond}/s`,
    );
  }
  assert.ok(!source.includes('Lv2: 16/초'), 'live anchors still contain the retired Lv2 16/s economy');
  assert.ok(!source.includes('16/s·1400'), 'live anchors still contain the retired Lv2 16/s economy');
});

test('live balance anchors track the current chapter-one starting-supply checkpoints', async () => {
  assert.equal(STAGES[0]!.startingSupply, 50);
  assert.equal(STAGES[7]!.startingSupply, 160);
  assert.equal(STAGES[18]!.startingSupply, 290);
  assert.equal(STAGES[19]!.startingSupply, 300);

  const source = await readLiveBalanceAnchors();
  for (const [stageNumber, supply] of [[1, 50], [8, 160], [19, 290], [20, 300]] as const) {
    assert.ok(source.includes(`ST${stageNumber}: ${supply}`), `LIVE_BALANCE_ANCHORS must record ST${stageNumber} starting supply ${supply}`);
  }
  assert.ok(!source.includes('50→260'), 'live anchors still describe the retired 50→260 campaign curve');
});
