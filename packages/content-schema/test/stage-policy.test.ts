import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseStagePolicies } from '../src/stage-policy.ts';

async function readJson(relative: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8')) as unknown;
}

test('current stage policy registry covers every implemented main and SPECIAL stage exactly once', async () => {
  const [mainRaw, specialRaw, policiesRaw] = await Promise.all([
    readJson('../../../content/stages/chapter-01.json'),
    readJson('../../../content/stages/special-01.json'),
    readJson('../../../content/stages/policies-01.json'),
  ]);
  assert.ok(Array.isArray(mainRaw));
  assert.ok(Array.isArray(specialRaw));
  const stageIds = new Set(
    [...mainRaw, ...specialRaw].map((stage) => (stage as Record<string, unknown>).id as string),
  );
  const policies = parseStagePolicies(policiesRaw, stageIds);

  assert.equal(stageIds.size, 25);
  assert.equal(policies.length, 25);
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
