import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCampaignBundle, parseCampaignStages, parseEnemies, parsePlayerUnits } from '../src/index.ts';

async function readJson(relativePath: string): Promise<unknown> {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(await readFile(url, 'utf8')) as unknown;
}

async function loadBundle() {
  return parseCampaignBundle({
    playerUnits: await readJson('../../../content/units/chapter-01.json'),
    enemies: await readJson('../../../content/enemies/chapter-01.json'),
    stages: await readJson('../../../content/stages/chapter-01.json'),
    starterUnitId: 'militia',
    expectedStageCount: 20,
    requiredThemeCount: 7,
  });
}

test('chapter one bundle has 10 player units, 10 enemies, 20 stages and seven battlefield themes', async () => {
  const bundle = await loadBundle();
  assert.equal(bundle.playerUnits.length, 10);
  assert.equal(bundle.enemies.length, 10);
  assert.equal(bundle.stages.length, 20);
  assert.equal(bundle.playerUnits[0]?.id, 'militia');
  assert.equal(bundle.stages[0]?.id, 'border-01');
  assert.equal(bundle.stages[19]?.id, 'border-20');
  assert.ok(new Set(bundle.stages.map((stage) => stage.theme)).size >= 7);
});

test('chapter one keeps exactly nine deterministic character unlock milestones', async () => {
  const bundle = await loadBundle();
  const unlocks = bundle.stages.flatMap((stage, index) => stage.unlockUnitId ? [`${index + 1}:${stage.unlockUnitId}`] : []);
  assert.deepEqual(unlocks, [
    '1:guard', '2:hunter', '4:duelist', '6:lancer', '8:battlemage',
    '10:pyromancer', '13:royal', '16:heretic', '20:voidsage',
  ]);
});

test('chapter one trait data is explicit and boss tags can coexist with another trait', async () => {
  const bundle = await loadBundle();
  const voidsage = bundle.playerUnits.find((unit) => unit.id === 'voidsage');
  const ironBoss = bundle.enemies.find((enemy) => enemy.id === 'enemy-boss-iron');
  assert.deepEqual(voidsage?.traits, ['ARCANE']);
  assert.deepEqual(voidsage?.damageBonuses, [{ trait: 'BOSS', multiplierPermille: 1500 }]);
  assert.deepEqual(ironBoss?.traits, ['ARMORED', 'BOSS']);
});

test('combat schema rejects unknown or duplicate traits and invalid specialist multipliers', () => {
  const base = {
    id: 'unit', displayName: 'unit', rarity: 'C', role: '물량', description: 'unit',
    maxHp: 100, attackDamage: 10, moveSpeed: 1, standingRange: 40, attackMinRange: 0, attackMaxRange: 50,
    cycleFrames: 30, hitFrames: [5], backswingFrames: 5, naturalKnockbackCount: 1, targetMode: 'SINGLE', cost: 10, rechargeFrames: 30,
  };
  assert.throws(() => parsePlayerUnits([{ ...base, traits: ['MISSING'] }]), /traits\[0\] is unknown/);
  assert.throws(() => parsePlayerUnits([{ ...base, traits: ['LIGHT', 'LIGHT'] }]), /traits must be unique/);
  assert.throws(() => parsePlayerUnits([{ ...base, damageBonuses: [{ trait: 'LIGHT', multiplierPermille: 999 }] }]), /1000\.\.3000/);

  const enemy = {
    id: 'enemy', displayName: 'enemy', maxHp: 100, attackDamage: 10, moveSpeed: 1, standingRange: 40,
    attackMinRange: 0, attackMaxRange: 50, cycleFrames: 30, hitFrames: [5], backswingFrames: 5,
    naturalKnockbackCount: 1, targetMode: 'SINGLE', rewardSupply: 10,
    damageBonuses: [{ trait: 'ARCANE', multiplierPermille: 1200 }, { trait: 'ARCANE', multiplierPermille: 1300 }],
  };
  assert.throws(() => parseEnemies([enemy]), /damageBonuses traits must be unique/);
});

test('campaign bundle rejects a non-starter player unit that can never be unlocked', () => {
  const units = [
    {
      id: 'starter', displayName: 'starter', rarity: 'C', role: '물량', description: 'starter',
      maxHp: 100, attackDamage: 10, moveSpeed: 1, standingRange: 40, attackMinRange: 0, attackMaxRange: 50,
      cycleFrames: 30, hitFrames: [5], backswingFrames: 5, naturalKnockbackCount: 1, targetMode: 'SINGLE', cost: 10, rechargeFrames: 30,
    },
    {
      id: 'orphan', displayName: 'orphan', rarity: 'C', role: '전열', description: 'orphan',
      maxHp: 100, attackDamage: 10, moveSpeed: 1, standingRange: 40, attackMinRange: 0, attackMaxRange: 50,
      cycleFrames: 30, hitFrames: [5], backswingFrames: 5, naturalKnockbackCount: 1, targetMode: 'SINGLE', cost: 10, rechargeFrames: 30,
    },
  ];
  const enemies = [{
    id: 'enemy', displayName: 'enemy', maxHp: 100, attackDamage: 10, moveSpeed: 1, standingRange: 40,
    attackMinRange: 0, attackMaxRange: 50, cycleFrames: 30, hitFrames: [5], backswingFrames: 5,
    naturalKnockbackCount: 1, targetMode: 'SINGLE', rewardSupply: 10,
  }];
  const stages = [{
    id: 's1', chapter: 'x', name: 's1', subtitle: 's1', difficulty: 1,
    playerBaseHp: 100, enemyBaseHp: 100, startingSupply: 0, mapLength: 800,
    theme: 'meadow', decorSeed: 1,
    waves: [{ enemyId: 'enemy', atTick: 0, count: 1, intervalTicks: 1 }],
    treasure: { id: 't', name: 't', effect: 't' },
  }];
  assert.throws(() => parseCampaignBundle({ playerUnits: units, enemies, stages, starterUnitId: 'starter' }), /never unlocked/);
});

test('campaign validator rejects unknown enemy references', () => {
  const bad = [
    {
      id: 'a', chapter: 'x', name: 'a', subtitle: 'a', difficulty: 1,
      playerBaseHp: 100, enemyBaseHp: 100, startingSupply: 0, mapLength: 800,
      theme: 'meadow', decorSeed: 1,
      waves: [{ enemyId: 'missing', atTick: 0, count: 1, intervalTicks: 1 }],
      treasure: { id: 't', name: 't', effect: 't' },
    },
  ];
  assert.throws(() => parseCampaignStages(bad, { enemyIds: new Set(['enemy']) }), /unknown enemy/);
});
