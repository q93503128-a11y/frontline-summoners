import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEvolutionCatalogOverrides, buildEvolutionCatalog } from '../src/evolution-catalog.ts';
import { applyEvolutionForm } from '../src/meta-progression.ts';
import type { PlayerRosterSlot } from '../src/playable.ts';

const baseCatalog = [{
  id: 'unit',
  names: ['A', 'B', 'C'],
  template: 'MASS',
  recipes: [[10, 1, 0, 0, 10], [30, 2, 1, 0, 20]],
}];

const explicitOverride = [{
  id: 'unit',
  names: ['A', 'B2', 'C2'],
  template: 'EXPLICIT',
  forms: [
    { formId: 'unit_f1', formOrder: 1, name: 'A', description: 'base', modifiers: {} },
    {
      formId: 'unit_f2', formOrder: 2, name: 'B2', description: 'timing form',
      modifiers: {
        maxHpPermille: 1200,
        attackDamagePermille: 1500,
        costPermille: 1250,
        rechargePermille: 1100,
        moveSpeedDelta: -0.25,
        standingRangeDelta: 5,
        attackMaxRangeDelta: 10,
        naturalKnockbackCount: 4,
        targetMode: 'AREA',
        attackTiming: { cycleFrames: 45, hitFrames: [9], backswingFrames: 7 },
      },
    },
    { formId: 'unit_f3', formOrder: 3, name: 'C2', description: 'third', modifiers: {} },
  ],
  recipes: [[10, 1, 0, 0, 10], [30, 2, 1, 0, 20]],
}];

const slot: PlayerRosterSlot = {
  slotId: 'unit',
  displayName: 'A',
  cost: 100,
  rechargeFrames: 100,
  definition: {
    id: 'unit',
    maxHp: 100,
    attackDamage: 20,
    moveSpeed: 2,
    standingRange: 50,
    attackMinRange: 0,
    attackMaxRange: 60,
    targetMode: 'SINGLE',
    naturalKnockbackCount: 2,
    naturalKnockbackFrames: 12,
    naturalKnockbackDistance: 34,
    deathFrames: 12,
    attackTiming: { cycleFrames: 60, hitFrames: [12], backswingFrames: 8 },
  },
};

test('catalog override replaces complete entries before normal evolution validation', () => {
  const source = applyEvolutionCatalogOverrides(baseCatalog, explicitOverride);
  const catalog = buildEvolutionCatalog(source, new Set(['unit']));
  assert.equal(catalog.forms[1]?.name, 'B2');
  assert.equal(catalog.recipes[0]?.formId, 'unit_f2');
  assert.throws(() => applyEvolutionCatalogOverrides(baseCatalog, [{ ...explicitOverride[0]!, id: 'missing' }]), /unknown character/);
});

test('explicit evolution grammar can change fractional movement, KB, target mode and attack timing generically', () => {
  const source = applyEvolutionCatalogOverrides(baseCatalog, explicitOverride);
  const catalog = buildEvolutionCatalog(source, new Set(['unit']));
  const evolved = applyEvolutionForm(slot, catalog.forms, 'unit_f2');
  assert.equal(evolved.definition.maxHp, 120);
  assert.equal(evolved.definition.attackDamage, 30);
  assert.equal(evolved.cost, 125);
  assert.equal(evolved.rechargeFrames, 110);
  assert.equal(evolved.definition.moveSpeed, 1.75);
  assert.equal(evolved.definition.standingRange, 55);
  assert.equal(evolved.definition.attackMaxRange, 70);
  assert.equal(evolved.definition.naturalKnockbackCount, 4);
  assert.equal(evolved.definition.targetMode, 'AREA');
  assert.deepEqual(evolved.definition.attackTiming, { cycleFrames: 45, hitFrames: [9], backswingFrames: 7 });
});
