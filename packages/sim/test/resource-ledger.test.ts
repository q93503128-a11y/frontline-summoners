import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getResourceBalance,
  grantResources,
  mergeResourceLedgers,
  spendResources,
} from '../src/resource-ledger.ts';

test('resource ledger grants and spends without permitting negative balances', () => {
  const granted = grantResources({}, { gold: 5000, evo_fragment: 20, evo_core: 2 });
  assert.equal(getResourceBalance(granted, 'gold'), 5000);
  assert.equal(getResourceBalance(granted, 'evo_fragment'), 20);
  const spent = spendResources(granted, { gold: 1200, evo_fragment: 7, evo_core: 1 });
  assert.equal(getResourceBalance(spent, 'gold'), 3800);
  assert.equal(getResourceBalance(spent, 'evo_fragment'), 13);
  assert.equal(getResourceBalance(spent, 'evo_core'), 1);
  assert.throws(() => spendResources(spent, { evo_core: 2 }), /Insufficient meta resource/);
});

test('monotonic earned/spent merge cannot resurrect already-spent currency', () => {
  const earned = grantResources({}, { gold: 1000, evo_fragment: 10 });
  const spent = spendResources(earned, { gold: 700, evo_fragment: 8 });
  const staleCopy = earned;
  const mergedA = mergeResourceLedgers(spent, staleCopy);
  const mergedB = mergeResourceLedgers(staleCopy, spent);
  assert.equal(getResourceBalance(mergedA, 'gold'), 300);
  assert.equal(getResourceBalance(mergedA, 'evo_fragment'), 2);
  assert.deepEqual(mergedA, mergedB);
});

test('resource merge keeps newer earnings and newer spending independently', () => {
  const branchA = spendResources(grantResources({}, { gold: 2000 }), { gold: 500 });
  const branchB = grantResources({}, { gold: 2600 });
  const merged = mergeResourceLedgers(branchA, branchB);
  assert.equal(merged.gold?.earned, 2600);
  assert.equal(merged.gold?.spent, 500);
  assert.equal(getResourceBalance(merged, 'gold'), 2100);
});
