import assert from 'node:assert/strict';
import test from 'node:test';
import { UnitState } from '@frontline/sim';
import { getAttackSpriteFrame, getLoopingSpriteFrame, classifyImpact } from '../src/combat-visuals.ts';

const timing = { cycleFrames: 40, hitFrames: [8], backswingFrames: 6 } as const;

test('first simulation hit maps exactly to configured sprite contact frame', () => {
  const before = getAttackSpriteFrame({ frameCount: 7, contactFrame: 4, timing, state: UnitState.Foreswing, stateFrame: 7 });
  const atHitBeforeStateTransition = getAttackSpriteFrame({ frameCount: 7, contactFrame: 4, timing, state: UnitState.Foreswing, stateFrame: 8 });
  const atHitAfterStateTransition = getAttackSpriteFrame({ frameCount: 7, contactFrame: 4, timing, state: UnitState.Backswing, stateFrame: 0 });
  assert.ok(before < 4);
  assert.equal(atHitBeforeStateTransition, 4);
  assert.equal(atHitAfterStateTransition, 4);
});

test('backswing advances from contact pose toward final sprite frame', () => {
  const start = getAttackSpriteFrame({ frameCount: 7, contactFrame: 4, timing, state: UnitState.Backswing, stateFrame: 0 });
  const middle = getAttackSpriteFrame({ frameCount: 7, contactFrame: 4, timing, state: UnitState.Backswing, stateFrame: 3 });
  const end = getAttackSpriteFrame({ frameCount: 7, contactFrame: 4, timing, state: UnitState.Backswing, stateFrame: 6 });
  assert.equal(start, 4);
  assert.ok(middle >= start);
  assert.equal(end, 6);
});

test('looping movement animation offsets unit phases instead of marching in lockstep', () => {
  const a = getLoopingSpriteFrame(8, 120, 1);
  const b = getLoopingSpriteFrame(8, 120, 2);
  assert.notEqual(a, b);
});

test('impact weight is proportional to target max hp', () => {
  assert.equal(classifyImpact(5, 100), 'LIGHT');
  assert.equal(classifyImpact(20, 100), 'MEDIUM');
  assert.equal(classifyImpact(40, 100), 'HEAVY');
});
