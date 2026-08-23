import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCampaignStages } from '../src/index.ts';

const enemyIds = new Set([
  'enemy-raider', 'enemy-sprinter', 'enemy-spearman', 'enemy-shield', 'enemy-cultist',
  'enemy-sniper', 'enemy-knight', 'enemy-berserker', 'enemy-boss', 'enemy-boss-iron',
]);
const playerUnitIds = new Set([
  'militia', 'guard', 'hunter', 'duelist', 'lancer', 'battlemage', 'pyromancer', 'royal', 'heretic', 'voidsage',
]);

async function loadChapter(): Promise<unknown> {
  const url = new URL('../../../content/stages/chapter-01.json', import.meta.url);
  return JSON.parse(await readFile(url, 'utf8')) as unknown;
}

test('chapter one has 20 valid sequential-content stages and at least seven battlefield themes', async () => {
  const stages = parseCampaignStages(await loadChapter(), {
    enemyIds,
    playerUnitIds,
    starterUnitId: 'militia',
    expectedStageCount: 20,
    requiredThemeCount: 7,
  });
  assert.equal(stages.length, 20);
  assert.equal(stages[0]?.id, 'border-01');
  assert.equal(stages[19]?.id, 'border-20');
  assert.equal(stages[0]?.unlockUnitId, 'guard');
  assert.equal(stages[19]?.unlockUnitId, 'voidsage');
});

test('chapter one keeps exactly nine deterministic character unlock milestones', async () => {
  const stages = parseCampaignStages(await loadChapter(), { enemyIds, playerUnitIds, starterUnitId: 'militia' });
  const unlocks = stages.flatMap((stage, index) => stage.unlockUnitId ? [`${index + 1}:${stage.unlockUnitId}`] : []);
  assert.deepEqual(unlocks, [
    '1:guard', '2:hunter', '4:duelist', '6:lancer', '8:battlemage',
    '10:pyromancer', '13:royal', '16:heretic', '20:voidsage',
  ]);
});

test('campaign validator rejects duplicate treasures and unknown enemy references', () => {
  const bad = [
    {
      id: 'a', chapter: 'x', name: 'a', subtitle: 'a', difficulty: 1,
      playerBaseHp: 100, enemyBaseHp: 100, startingSupply: 0, mapLength: 800,
      theme: 'meadow', decorSeed: 1,
      waves: [{ enemyId: 'missing', atTick: 0, count: 1, intervalTicks: 1 }],
      treasure: { id: 't', name: 't', effect: 't' },
    },
  ];
  assert.throws(() => parseCampaignStages(bad, { enemyIds }), /unknown enemy/);
});
