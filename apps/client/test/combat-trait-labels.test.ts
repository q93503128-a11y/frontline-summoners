import assert from 'node:assert/strict';
import test from 'node:test';
import type { BattleUnitDefinition } from '@frontline/sim';
import {
  formatCombatTraits,
  formatCompactCombatIdentity,
  formatCompactTraits,
  formatDamageSpecialty,
  getCombatAttributeLabel,
  getCombatTagLabel,
} from '../src/combat-trait-labels.ts';

const fighter = (overrides: Partial<BattleUnitDefinition> = {}): BattleUnitDefinition => ({
  id: 'fighter', maxHp: 100, attackDamage: 10, moveSpeed: 1, standingRange: 40,
  attackMinRange: 0, attackMaxRange: 50, targetMode: 'SINGLE', naturalKnockbackCount: 0,
  naturalKnockbackFrames: 12, naturalKnockbackDistance: 30, deathFrames: 12,
  attackTiming: { cycleFrames: 30, hitFrames: [5], backswingFrames: 5 },
  ...overrides,
});

test('all current attributes and combat tags have Korean player-facing labels', () => {
  assert.equal(getCombatAttributeLabel('NEUTRAL'), '중립');
  assert.equal(getCombatAttributeLabel('BEAST'), '야수');
  assert.equal(getCombatAttributeLabel('UNDEAD'), '언데드');
  assert.equal(getCombatAttributeLabel('NATURE'), '자연');
  assert.equal(getCombatAttributeLabel('ARCANE'), '비전');
  assert.equal(getCombatAttributeLabel('DEMON'), '악마');
  assert.equal(getCombatAttributeLabel('MACHINE'), '기계');
  assert.equal(getCombatAttributeLabel('ANOMALY'), '이상');
  assert.equal(getCombatTagLabel('ARMORED'), '중갑');
  assert.equal(getCombatTagLabel('FLOATING'), '부유');
  assert.equal(getCombatTagLabel('GIANT'), '거대');
  assert.equal(getCombatTagLabel('BOSS'), '보스');
  assert.equal(getCombatTagLabel('STRUCTURE'), '구조물');
  assert.equal(getCombatTagLabel('SUMMON'), '소환체');
  assert.equal(getCombatTagLabel('SWARM'), '군집');
});

test('attribute identity and combat tags are rendered as separate layers', () => {
  const definition = fighter({ attributes: ['ARCANE'], combatTags: ['ARMORED', 'FLOATING'] });
  assert.equal(formatCombatTraits(definition), '속성 비전 · 태그 중갑·부유');
  assert.equal(formatCompactTraits(definition), '비전·중갑·부유');
});

test('specialty text derives labels from ATTRIBUTE and TAG targets', () => {
  const definition = fighter({
    attributes: ['ARCANE'],
    combatTags: ['ARMORED'],
    damageBonuses: [
      { targetKind: 'ATTRIBUTE', target: 'UNDEAD', multiplierPermille: 1300 },
      { targetKind: 'TAG', target: 'BOSS', multiplierPermille: 1500 },
    ],
  });
  assert.equal(formatDamageSpecialty(definition), '언데드 특효 +30% · 보스 특효 +50%');
  assert.equal(formatCompactCombatIdentity(definition), '비전·중갑 / 보스+50%');
});

test('units without explicit identity or specialty use neutral identity and invent no bonus', () => {
  const definition = fighter({ attributes: [], combatTags: [], damageBonuses: [] });
  assert.equal(formatCombatTraits(definition), '속성 중립');
  assert.equal(formatCompactTraits(definition), '중립');
  assert.equal(formatDamageSpecialty(definition), null);
  assert.equal(formatCompactCombatIdentity(definition), '중립');
});
