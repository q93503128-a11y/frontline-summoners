import assert from 'node:assert/strict';
import test from 'node:test';
import type { BattleUnitDefinition } from '@frontline/sim';
import {
  formatCombatTraits,
  formatCompactCombatIdentity,
  formatDamageSpecialty,
  getCombatTraitLabel,
} from '../src/combat-trait-labels.ts';

const fighter = (overrides: Partial<BattleUnitDefinition> = {}): BattleUnitDefinition => ({
  id: 'fighter', maxHp: 100, attackDamage: 10, moveSpeed: 1, standingRange: 40,
  attackMinRange: 0, attackMaxRange: 50, targetMode: 'SINGLE', naturalKnockbackCount: 0,
  naturalKnockbackFrames: 12, naturalKnockbackDistance: 30, deathFrames: 12,
  attackTiming: { cycleFrames: 30, hitFrames: [5], backswingFrames: 5 },
  ...overrides,
});

test('all combat trait ids have Korean player-facing labels', () => {
  assert.equal(getCombatTraitLabel('LIGHT'), '경량');
  assert.equal(getCombatTraitLabel('ARMORED'), '중갑');
  assert.equal(getCombatTraitLabel('ARCANE'), '비전');
  assert.equal(getCombatTraitLabel('BOSS'), '보스');
});

test('specialty text is derived from the battle definition multiplier', () => {
  const definition = fighter({
    traits: ['ARCANE'],
    damageBonuses: [{ trait: 'BOSS', multiplierPermille: 1500 }],
  });
  assert.equal(formatCombatTraits(definition), '속성 비전');
  assert.equal(formatDamageSpecialty(definition), '보스 특효 +50%');
  assert.equal(formatCompactCombatIdentity(definition), '비전 / 보스+50%');
});

test('units without a specialty do not invent one', () => {
  const definition = fighter({ traits: ['ARMORED'], damageBonuses: [] });
  assert.equal(formatDamageSpecialty(definition), null);
  assert.equal(formatCompactCombatIdentity(definition), '중갑');
});
