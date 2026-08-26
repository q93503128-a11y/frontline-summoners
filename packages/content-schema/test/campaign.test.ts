import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DEFAULT_ENEMY_UNIT_CAP,
  DEFAULT_PLAYER_UNIT_CAP,
  MAX_STAGE_DIFFICULTY,
  MIN_PLAYER_RECHARGE_FRAMES,
  parseCampaignBundle,
  parseCampaignStages,
  parseEnemies,
  parsePlayerUnits,
} from '../src/index.ts';

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

function storyUnit(id: string): Record<string, unknown> {
  return {
    id,
    displayName: id,
    acquisitionClass: 'STORY',
    rarity: null,
    role: '물량',
    description: id,
    maxHp: 100,
    attackDamage: 10,
    moveSpeed: 1,
    standingRange: 40,
    attackMinRange: 0,
    attackMaxRange: 50,
    cycleFrames: 30,
    hitFrames: [5],
    backswingFrames: 5,
    naturalKnockbackCount: 1,
    targetMode: 'SINGLE',
    attributes: ['NEUTRAL'],
    combatTags: [],
    damageBonuses: [],
    cost: 10,
    rechargeFrames: MIN_PLAYER_RECHARGE_FRAMES,
  };
}

function enemy(id = 'enemy'): Record<string, unknown> {
  return {
    id,
    displayName: id,
    maxHp: 100,
    attackDamage: 10,
    moveSpeed: 1,
    standingRange: 40,
    attackMinRange: 0,
    attackMaxRange: 50,
    cycleFrames: 30,
    hitFrames: [5],
    backswingFrames: 5,
    naturalKnockbackCount: 1,
    targetMode: 'SINGLE',
    attributes: ['NEUTRAL'],
    combatTags: [],
    damageBonuses: [],
    rewardSupply: 10,
  };
}

function timeWave(enemyId = 'enemy', frame = 0): Record<string, unknown> {
  return {
    id: 'W1',
    trigger: { type: 'TIME', frame },
    spawn: { enemyId, count: 1, intervalFrames: 1 },
  };
}

function stage(id = 's1'): Record<string, unknown> {
  return {
    id,
    chapter: 'x',
    name: id,
    subtitle: id,
    difficulty: 1,
    playerBaseHp: 100,
    enemyBaseHp: 100,
    startingSupply: 0,
    mapLength: 800,
    theme: 'meadow',
    decorSeed: 1,
    waves: [timeWave()],
    permanentRewardId: `reward-${id}`,
  };
}

test('chapter one bundle has 10 player units, 10 enemies, 20 stages and seven battlefield themes', async () => {
  const bundle = await loadBundle();
  assert.equal(bundle.playerUnits.length, 10);
  assert.equal(bundle.enemies.length, 10);
  assert.equal(bundle.stages.length, 20);
  assert.equal(bundle.playerUnits[0]?.id, 'militia');
  assert.equal(bundle.stages[0]?.id, 'main_01_001');
  assert.equal(bundle.stages[19]?.id, 'main_01_020');
  assert.ok(new Set(bundle.stages.map((candidate) => candidate.theme)).size >= 7);
});

test('chapter one defaults to progression stages and live simultaneous unit caps', async () => {
  const bundle = await loadBundle();
  assert.ok(bundle.stages.every((candidate) => candidate.stageType === 'PROGRESSION'));
  assert.ok(bundle.stages.every((candidate) => candidate.playerUnitCap === DEFAULT_PLAYER_UNIT_CAP));
  assert.ok(bundle.stages.every((candidate) => candidate.enemyUnitCap === DEFAULT_ENEMY_UNIT_CAP));
  assert.ok(bundle.stages.every((candidate) => candidate.formationRestrictions.allowedRarities.length === 0));
  assert.ok(bundle.stages.slice(0, 19).every((candidate) => candidate.specialRules.length === 0));
  assert.deepEqual(bundle.stages[19]?.specialRules, ['chapterClear:1', 'levelCap:20', 'specialHubUnlock:true']);
});

test('chapter one keeps exactly nine deterministic STORY character unlock milestones', async () => {
  const bundle = await loadBundle();
  const unlocks = bundle.stages.flatMap((candidate, index) => candidate.unlockUnitId ? [`${index + 1}:${candidate.unlockUnitId}`] : []);
  assert.deepEqual(unlocks, [
    '1:guard', '2:hunter', '4:duelist', '6:lancer', '8:battlemage',
    '10:pyromancer', '13:royal', '16:heretic', '20:voidsage',
  ]);
});

test('chapter one uses canonical attributes, combat tags, and damage-bonus targets', async () => {
  const bundle = await loadBundle();
  const voidsage = bundle.playerUnits.find((unit) => unit.id === 'voidsage');
  const ironBoss = bundle.enemies.find((candidate) => candidate.id === 'enemy-boss-iron');
  assert.deepEqual(voidsage?.attributes, ['ARCANE', 'ANOMALY']);
  assert.deepEqual(voidsage?.combatTags, []);
  assert.deepEqual(voidsage?.damageBonuses, [{ targetKind: 'TAG', target: 'BOSS', multiplierPermille: 1500 }]);
  assert.deepEqual(ironBoss?.attributes, ['NEUTRAL']);
  assert.deepEqual(ironBoss?.combatTags, ['ARMORED', 'BOSS']);
});

test('combat schema rejects unknown or duplicate canonical attributes/tags and invalid specialist multipliers', () => {
  assert.throws(
    () => parsePlayerUnits([{ ...storyUnit('unit'), attributes: ['MISSING'] }]),
    /attributes\[0\] is unknown: MISSING/,
  );
  assert.throws(
    () => parsePlayerUnits([{ ...storyUnit('unit'), combatTags: ['FLOATING', 'FLOATING'] }]),
    /combatTags must be unique/,
  );
  assert.throws(
    () => parsePlayerUnits([{ ...storyUnit('unit'), damageBonuses: [{ targetKind: 'TAG', target: 'BOSS', multiplierPermille: 999 }] }]),
    /1000\.\.3000/,
  );
  assert.throws(
    () => parsePlayerUnits([{ ...storyUnit('unit'), combatTags: ['FLYING'] }]),
    /combatTags\[0\] is unknown: FLYING/,
  );

  assert.throws(
    () => parseEnemies([{ ...enemy(), damageBonuses: [
      { targetKind: 'ATTRIBUTE', target: 'ARCANE', multiplierPermille: 1200 },
      { targetKind: 'ATTRIBUTE', target: 'ARCANE', multiplierPermille: 1300 },
    ] }]),
    /damageBonuses targets must be unique/,
  );
});

test('campaign bundle rejects a non-starter STORY unit that can never be unlocked', () => {
  const units = [storyUnit('starter'), { ...storyUnit('orphan'), role: '전열' }];
  assert.throws(
    () => parseCampaignBundle({ playerUnits: units, enemies: [enemy()], stages: [stage()], starterUnitId: 'starter' }),
    /never unlocked/,
  );
});

test('campaign validator rejects unknown enemy references', () => {
  const bad = [{ ...stage('a'), waves: [timeWave('missing')] }];
  assert.throws(() => parseCampaignStages(bad, { enemyIds: new Set(['enemy']) }), /unknown enemy/);
});

test('stage schema supports twelve difficulty levels, per-stage unit caps and restriction DSL', () => {
  const special = {
    ...stage('special-a'),
    chapter: 'special',
    name: 'special',
    subtitle: 'special',
    stageType: 'SPECIAL',
    permanentRewardId: undefined,
    difficulty: MAX_STAGE_DIFFICULTY,
    playerUnitCap: 5,
    enemyUnitCap: 20,
    formationRestrictions: {
      allowedRarities: ['C', 'B'],
      maxRarity: 'A',
      allowedRoles: ['전열'],
      maxUnitCost: 1000,
      requiredUnitTags: ['MAGIC'],
      forbiddenUnitTags: ['HUMAN'],
      maxDistinctUnits: 5,
      sameFactionOnly: true,
    },
    specialRules: ['base-weapon-disabled'],
  };
  const [parsed] = parseCampaignStages([special], { enemyIds: new Set(['enemy']) });
  assert.equal(parsed?.stageType, 'SPECIAL');
  assert.equal(parsed?.difficulty, 12);
  assert.equal(parsed?.playerUnitCap, 5);
  assert.equal(parsed?.enemyUnitCap, 20);
  assert.deepEqual(parsed?.formationRestrictions.allowedRarities, ['C', 'B']);
  assert.deepEqual(parsed?.formationRestrictions.requiredUnitTags, ['MAGIC']);
  assert.equal(parsed?.formationRestrictions.sameFactionOnly, true);
  assert.deepEqual(parsed?.specialRules, ['base-weapon-disabled']);
});

test('stage schema rejects difficulty above 12 and invalid unit caps', () => {
  const base = stage('a');
  assert.throws(() => parseCampaignStages([{ ...base, difficulty: 13 }]), /1\.\.12/);
  assert.throws(() => parseCampaignStages([{ ...base, playerUnitCap: 0 }]), /1\.\.500/);
});
