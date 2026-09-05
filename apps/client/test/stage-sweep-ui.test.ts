import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('stage selection exposes sweep only after clear and routes it through save authority', async () => {
  const source = await readFile(new URL('../src/stage-select-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /recordGuestStageSweep/);
  assert.match(source, /const sweepEligible = cleared && stage\.sweepEligibility === 'AFTER_NORMAL_CLEAR'/);
  assert.match(source, /const canSweep = unlocked && sweepEligible && sweepTickets > 0/);
  assert.match(source, /getGuestResourceBalance\(this\.progress, 'sweep_ticket'\)/);
  assert.match(source, /보상 충전 \$\{periodicCharges\}\/4/);
  assert.match(source, /if \(canSweep\) void this\.executeSweep\(stage\)/);
  assert.match(source, /소탕 완료/);
  assert.match(source, /저장 실패\(현재 실행에서는 유지\)/);
});
