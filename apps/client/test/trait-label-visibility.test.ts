import assert from 'node:assert/strict';
import test from 'node:test';
import { selectVisibleTraitLabelIds } from '../src/trait-label-visibility.ts';

test('dense ordinary enemies collapse to spaced representative labels', () => {
  const visible = selectVisibleTraitLabelIds([
    { simulationId: 1, screenX: 100, isBoss: false },
    { simulationId: 2, screenX: 125, isBoss: false },
    { simulationId: 3, screenX: 180, isBoss: false },
    { simulationId: 4, screenX: 260, isBoss: false },
  ], 76);
  assert.deepEqual([...visible], [1, 4]);
});

test('boss labels remain visible even when they are inside the ordinary spacing gap', () => {
  const visible = selectVisibleTraitLabelIds([
    { simulationId: 1, screenX: 100, isBoss: false },
    { simulationId: 2, screenX: 120, isBoss: true },
    { simulationId: 3, screenX: 145, isBoss: false },
  ], 76);
  assert.ok(visible.has(1));
  assert.ok(visible.has(2));
  assert.ok(!visible.has(3));
});

test('label selection is independent of input iteration order', () => {
  const a = selectVisibleTraitLabelIds([
    { simulationId: 9, screenX: 260, isBoss: false },
    { simulationId: 2, screenX: 100, isBoss: false },
    { simulationId: 5, screenX: 180, isBoss: false },
  ]);
  const b = selectVisibleTraitLabelIds([
    { simulationId: 5, screenX: 180, isBoss: false },
    { simulationId: 2, screenX: 100, isBoss: false },
    { simulationId: 9, screenX: 260, isBoss: false },
  ]);
  assert.deepEqual([...a], [...b]);
});
