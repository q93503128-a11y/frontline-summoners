import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('stage briefing exposes an encounter-codex path without leaking undiscovered enemy identity', async () => {
  const source = await readSource('../src/stage-select-scene.ts');

  assert.match(source, /function getStageEnemyIds\(stage: PrototypeStage\)/);
  assert.match(source, /for \(const wave of stage\.waves\)/);
  assert.match(source, /if \(seen\.has\(wave\.spawn\.enemyId\)\) continue/);
  assert.match(source, /new Set\(this\.progress\.discoveredEnemyIds \?\? \[\]\)/);
  assert.match(source, /`출현 적 · 발견 \$\{discoveredCount\}\/\$\{enemyIds\.length\}`/);
  assert.match(source, /private showStageEnemies\(stage: PrototypeStage\): void/);
  assert.match(source, /discovered \? enemy\.displayName : '미발견'/);
  assert.match(source, /discovered \? \(boss \? '우두머리 · 도감 열기' : '발견됨 · 도감 열기'\) : '정보 비공개'/);
  assert.match(source, /if \(!discovered\) setButtonState\(enemyButton, 'locked'/);
});

test('stage encounter entries open the exact enemy codex card and return to the same stage page', async () => {
  const source = await readSource('../src/stage-select-scene.ts');

  assert.match(source, /this\.scene\.start\('catalog', \{[\s\S]*?mode: 'ENEMIES',[\s\S]*?focusEnemyId: enemyId,[\s\S]*?returnTo: \{ scene: 'stage-select', data: \{ collectionId: this\.collection\.id, page: this\.page \} \},[\s\S]*?\}\);/);
  assert.match(source, /init\(data: \{ collectionId\?: string; page\?: number \} = \{\}\)/);
  assert.match(source, /this\.requestedPage = Number\.isInteger\(data\.page\)/);
  assert.match(source, /this\.page = Math\.min\(this\.pageCount\(\) - 1, this\.requestedPage\)/);
});

test('catalog accepts focused enemy navigation while preserving undiscovered silhouettes and safe return navigation', async () => {
  const source = await readSource('../src/catalog-scene.ts');

  assert.match(source, /interface CatalogSceneData/);
  assert.match(source, /readonly mode\?: CatalogMode/);
  assert.match(source, /readonly focusEnemyId\?: string/);
  assert.match(source, /readonly returnTo\?: CatalogReturnTarget/);
  assert.match(source, /this\.mode = isCatalogMode\(data\.mode\) \? data\.mode : 'ALLIES'/);
  assert.match(source, /this\.page = Math\.floor\(index \/ ENEMY_PAGE_SIZE\)/);
  assert.match(source, /const focused = enemy\.enemyId === this\.focusEnemyId/);
  assert.match(source, /const border = focused \? 0xf0c967/);
  assert.match(source, /discovered \? enemy\.displayName : '\?\?\?'/);
  assert.match(source, /portrait\.setTint\(0x07080b\)/);
  assert.match(source, /portrait\.setTintFill\(\)/);
  assert.match(source, /this\.returnTo \? '스테이지' : '메인'/);
  assert.match(source, /this\.scene\.start\(this\.returnTo\.scene, this\.returnTo\.data \?\? \{\}\)/);
});
