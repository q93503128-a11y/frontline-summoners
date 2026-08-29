import assert from 'node:assert/strict';
import test from 'node:test';
import { getFormationRestrictionViolation } from '../src/formation-restrictions.ts';

const slots = [
  { slotId: 'a', cost: 50, rarity: 'C', acquisitionClass: 'STORY', role: '전열', unitTags: ['ARMORED'] },
  { slotId: 'b', cost: 180, rarity: 'B', acquisitionClass: 'RECRUITMENT', role: '원거리', unitTags: [] },
  { slotId: 'c', cost: 420, rarity: 'A', acquisitionClass: 'RECRUITMENT', role: '광역', unitTags: [] },
];

test('max distinct and selected-form cost restrictions reject only violating formations', () => {
  assert.equal(getFormationRestrictionViolation({ maxDistinctUnits: 2 }, slots)?.includes('최대 2종'), true);
  assert.equal(getFormationRestrictionViolation({ maxDistinctUnits: 3 }, slots), undefined);
  assert.equal(getFormationRestrictionViolation({ maxUnitCost: 400 }, slots)?.includes('420'), true);
  assert.equal(getFormationRestrictionViolation({ maxUnitCost: 450 }, slots), undefined);
});

test('co-op override can be stricter than solo maxDistinctUnits without mutating authored data', () => {
  assert.equal(getFormationRestrictionViolation({ maxDistinctUnits: 5 }, slots), undefined);
  assert.equal(getFormationRestrictionViolation({ maxDistinctUnits: 5 }, slots, { maxDistinctUnitsOverride: 2 })?.includes('최대 2종'), true);
});

test('rarity, acquisition, role and tags share the same reusable validation path', () => {
  assert.ok(getFormationRestrictionViolation({ allowedRarities: ['C', 'B'] }, slots));
  assert.ok(getFormationRestrictionViolation({ allowedAcquisitionClasses: ['STORY'] }, slots));
  assert.ok(getFormationRestrictionViolation({ allowedRoles: ['전열'] }, slots));
  assert.ok(getFormationRestrictionViolation({ forbiddenUnitTags: ['ARMORED'] }, slots));
});
