import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseStagePolicies } from '../src/stage-policy.ts';

async function readJson(relative: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8')) as unknown;
}

async function readJsonArray(relative: string): Promise<readonly unknown[]> {
  const value = await readJson(relative);
  assert.ok(Array.isArray(value), `${relative} must contain a JSON array`);
  return value;
}

test('current stage policy registry covers every implemented main and SPECIAL stage exactly once', async () => {
  const stageFiles = [
    '../../../content/stages/chapter-01.json',
    '../../../content/stages/chapter-02-01-05.json',
    '../../../content/stages/chapter-02-06-10.json',
    '../../../content/stages/chapter-02-11-15.json',
    '../../../content/stages/chapter-02-16-20.json',
    '../../../content/stages/chapter-03-01-05.json',
    '../../../content/stages/chapter-03-06-10.json',
    '../../../content/stages/chapter-03-11-15.json',
    '../../../content/stages/chapter-03-16-20.json',
    '../../../content/stages/chapter-04-01-05.json',
    '../../../content/stages/chapter-04-06-10.json',
    '../../../content/stages/chapter-04-11-15.json',
    '../../../content/stages/chapter-04-16-20.json',
    '../../../content/stages/special-01.json',
    '../../../content/stages/special-resource-01.json',
    '../../../content/stages/special-permanent-glutton.json',
    '../../../content/stages/special-permanent-undead.json',
    '../../../content/stages/special-permanent-glass.json',
    '../../../content/stages/special-permanent-mech.json',
    '../../../content/stages/special-permanent-anomaly.json',
    '../../../content/stages/special-permanent-echoes.json',
    '../../../content/stages/special-event-01.json',
  ] as const;
  const policyFiles = [
    '../../../content/stages/policies-01-02.json',
    '../../../content/stages/policies-03.json',
    '../../../content/stages/policies-04.json',
    '../../../content/stages/policies-special-resource.json',
    '../../../content/stages/policies-special-permanent.json',
    '../../../content/stages/policies-special-restriction.json',
    '../../../content/stages/policies-special-event.json',
  ] as const;

  const stageGroups = await Promise.all(stageFiles.map(readJsonArray));
  const policyGroups = await Promise.all(policyFiles.map(readJsonArray));
  const stageIds = new Set(
    stageGroups.flat().map((stage) => (stage as Record<string, unknown>).id as string),
  );
  const policies = parseStagePolicies(policyGroups.flat(), stageIds);

  assert.equal(stageIds.size, 141);
  assert.equal(policies.length, 141);
  assert.equal(new Set(policies.map((policy) => policy.stageId)).size, policies.length);
});

test('chapter-one tutorial and cooperative policy values match the authored v1 design', async () => {
  const policies = parseStagePolicies(await readJson('../../../content/stages/policies-01.json'));
  const byId = new Map(policies.map((policy) => [policy.stageId, policy] as const));
  const neutral = { enemyHpPermille: 1000, enemyAttackPermille: 1000, enemyBaseHpPermille: 1000 };
  const coop = { enemyHpPermille: 1180, enemyAttackPermille: 1080, enemyBaseHpPermille: 1120 };

  for (const stageId of ['main_01_001', 'main_01_002']) {
    const policy = byId.get(stageId)!;
    assert.equal(policy.multiplayerPolicy, 'SOLO_ONLY');
    assert.deepEqual(policy.coopStatScaling, neutral);
  }
  for (let stageNumber = 3; stageNumber <= 20; stageNumber += 1) {
    const stageId = `main_01_${String(stageNumber).padStart(3, '0')}`;
    const policy = byId.get(stageId)!;
    assert.equal(policy.multiplayerPolicy, 'SOLO_OR_COOP');
    assert.deepEqual(policy.coopStatScaling, coop);
  }
  for (let specialNumber = 1; specialNumber <= 5; specialNumber += 1) {
    const policy = byId.get(`special-0${specialNumber}`)!;
    assert.equal(policy.multiplayerPolicy, 'SOLO_OR_COOP');
    assert.deepEqual(policy.coopStatScaling, coop);
  }

  for (const policy of policies) {
    assert.equal(policy.speedUpEligibility, 'AFTER_NORMAL_CLEAR');
    assert.equal(policy.sweepEligibility, 'AFTER_NORMAL_CLEAR');
    assert.equal(policy.rewardChargePolicy, 'NONE');
  }
});

test('stage policies reject duplicate, missing, unknown, and invalid SOLO_ONLY coop metadata', () => {
  const valid = {
    stageId: 'main_01_001',
    multiplayerPolicy: 'SOLO_ONLY',
    speedUpEligibility: 'AFTER_NORMAL_CLEAR',
    sweepEligibility: 'AFTER_NORMAL_CLEAR',
    rewardChargePolicy: 'NONE',
    coopStatScaling: { enemyHpPermille: 1000, enemyAttackPermille: 1000, enemyBaseHpPermille: 1000 },
  } as const;

  assert.throws(() => parseStagePolicies([valid, valid]), /duplicate stage policy id/);
  assert.throws(() => parseStagePolicies([valid], new Set(['main_01_001', 'main_01_002'])), /missing stage policy: main_01_002/);
  assert.throws(() => parseStagePolicies([valid], new Set(['other-stage'])), /references unknown stage/);
  assert.throws(() => parseStagePolicies([{ ...valid, coopStatScaling: { ...valid.coopStatScaling, enemyHpPermille: 1180 } }]), /SOLO_ONLY stage must use neutral coopStatScaling/);
});
