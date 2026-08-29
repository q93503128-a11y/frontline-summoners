import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnemies } from '../src/index.ts';

const enemy = (overrides: Record<string, unknown> = {}) => ({
  id: 'effect-enemy', displayName: '효과 적', maxHp: 100, attackDamage: 10, moveSpeed: 1,
  standingRange: 100, attackMinRange: 0, attackMaxRange: 100, cycleFrames: 30, hitFrames: [5],
  backswingFrames: 6, naturalKnockbackCount: 1, targetMode: 'SINGLE', attributes: ['NATURE'],
  combatTags: [], damageBonuses: [], rewardSupply: 10, ...overrides,
});

test('enemy schema preserves fractional movement and deterministic hit/revive mechanics', () => {
  const parsed = parseEnemies([enemy({
    moveSpeed: 0.55,
    onHitSlow: { chancePermille: 200, durationFrames: 45, speedPermille: 600 },
    onHitPush: { chancePermille: 200, distance: 35, frames: 10 },
    reviveOnce: { delayFrames: 75, hpPermille: 250 },
    closeRangeAttack: {
      triggerMaxDistance: 170, attackDamage: 180, attackMinRange: 0, attackMaxRange: 190,
      cycleFrames: 75, hitFrames: [28],
    },
    attackPattern: [
      { attackDamage: 10, attackMinRange: 0, attackMaxRange: 100, cycleFrames: 30, hitFrames: [5] },
      { attackDamage: 20, attackMinRange: 120, attackMaxRange: 240, cycleFrames: 40, hitFrames: [10], onHitSlow: { chancePermille: 250, durationFrames: 45, speedPermille: 600 } },
    ],
  })])[0]!;

  assert.equal(parsed.moveSpeed, 0.55);
  assert.deepEqual(parsed.onHitSlow, { chancePermille: 200, durationFrames: 45, speedPermille: 600 });
  assert.deepEqual(parsed.onHitPush, { chancePermille: 200, distance: 35, frames: 10 });
  assert.deepEqual(parsed.reviveOnce, { delayFrames: 75, hpPermille: 250 });
  assert.equal(parsed.closeRangeAttack?.triggerMaxDistance, 170);
  assert.deepEqual(parsed.attackPattern?.[1]?.onHitSlow, { chancePermille: 250, durationFrames: 45, speedPermille: 600 });
});

test('combat effect schema rejects invalid probability, slow strength and revive HP', () => {
  assert.throws(() => parseEnemies([enemy({ onHitSlow: { chancePermille: 0, durationFrames: 45, speedPermille: 600 } })]), /chancePermille/);
  assert.throws(() => parseEnemies([enemy({ onHitSlow: { chancePermille: 200, durationFrames: 45, speedPermille: 1000 } })]), /speedPermille/);
  assert.throws(() => parseEnemies([enemy({ onHitPush: { chancePermille: 1001, distance: 35, frames: 10 } })]), /chancePermille/);
  assert.throws(() => parseEnemies([enemy({ reviveOnce: { delayFrames: 75, hpPermille: 0 } })]), /hpPermille/);
  assert.throws(() => parseEnemies([enemy({ moveSpeed: Number.NaN })]), /moveSpeed/);
});
