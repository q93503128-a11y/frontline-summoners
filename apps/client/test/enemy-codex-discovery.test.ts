import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ENEMIES } from '../src/prototype.ts';
import { normalizeGuestProgress } from '../src/save.ts';

test('enemy discovery keeps only canonical enemy ids and de-duplicates them', () => {
  const enemyId = ENEMIES[0]!.enemyId;
  const normalized = normalizeGuestProgress({
    clearedStageIds: [],
    specialClearedStageIds: [],
    permanentRewardIds: [],
    discoveredEnemyIds: [enemyId, 'legacy-unknown-enemy', enemyId],
  });
  assert.deepEqual(normalized.discoveredEnemyIds, [enemyId]);
});

test('battle discovery is driven by enemy units that actually enter the simulation', async () => {
  const source = await readFile(new URL('../src/battle-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /filter\(\(unit\) => unit\.team === 'ENEMY'\)/);
  assert.match(source, /map\(\(unit\) => unit\.definition\.id\)/);
  assert.match(source, /recordGuestEnemyDiscoveries\(newlySeen\)/);
  assert.doesNotMatch(source, /this\.stage\.waves[^;]*recordGuestEnemyDiscoveries/s);
});

test('enemy catalog hides undiscovered identity and combat information behind a silhouette', async () => {
  const source = await readFile(new URL('../src/catalog-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /type CatalogMode = 'ALLIES' \| 'ENEMIES' \| 'REWARDS' \| 'SPECIAL'/);
  assert.match(source, /new Set\(this\.progress\.discoveredEnemyIds \?\? \[\]\)/);
  assert.match(source, /discovered \? enemy\.displayName : '\?\?\?'/);
  assert.match(source, /portrait\.setTint\(0x07080b\)/);
  assert.match(source, /portrait\.setTintFill\(\)/);
  assert.match(source, /전투에서 조우하면 정보 공개/);
});
