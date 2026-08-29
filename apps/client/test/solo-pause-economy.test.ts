import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_SUPPLY_LEVELS } from '@frontline/sim/playable';
import { PLAYER_SLOTS, STAGES } from '../src/prototype.ts';
import enemiesJson from '../../../content/enemies/chapter-01.json' with { type: 'json' };

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('solo pause freezes the simulation and all direct battle actions', async () => {
  const source = await readSource('../src/battle-scene.ts');

  assert.match(source, /private manuallyPaused = false/);
  assert.match(source, /event\.code === 'KeyP' \|\| event\.code === 'Escape'/);
  assert.match(source, /this\.manuallyPaused \|\| isPortraitMobileViewport\(\)/);
  assert.match(source, /this\.tweens\.pauseAll\(\)/);
  assert.match(source, /this\.tweens\.resumeAll\(\)/);
  assert.match(source, /솔로 전투 정지 · 보급·쿨다운·적 스폰도 멈춤/);
  assert.match(source, /'일시정지', \(\) => this\.toggleManualPause\(\)/);

  assert.match(source, /private canAcceptBattleAction\(\): boolean \{[\s\S]*?!this\.manuallyPaused[\s\S]*?!isPortraitMobileViewport\(\)/);
  const guardedActions = source.match(/if \(!this\.canAcceptBattleAction\(\)\) return;/g) ?? [];
  assert.ok(guardedActions.length >= 4, 'keyboard, spawn, supply upgrade and base weapon input must share the centralized pause/action gate');
});

test('chapter one opens scarce while supply upgrades have meaningful investment value', () => {
  const first = STAGES[0]!;
  assert.equal(first.id, 'main_01_001');
  assert.equal(first.startingSupply, 50);
  assert.equal(first.playerBaseHp, 900);
  assert.equal(first.enemyBaseHp, 800);
  assert.deepEqual(DEFAULT_SUPPLY_LEVELS[0], { incomePerSecond: 12, maxSupply: 1000, upgradeCost: 0 });
  assert.deepEqual(DEFAULT_SUPPLY_LEVELS[1], { incomePerSecond: 20, maxSupply: 1400, upgradeCost: 160 });
  assert.ok(DEFAULT_SUPPLY_LEVELS[1]!.incomePerSecond > DEFAULT_SUPPLY_LEVELS[0]!.incomePerSecond * 1.5);

  const firstFive = STAGES.slice(0, 5);
  assert.deepEqual(firstFive.map((stage) => stage.startingSupply), [50, 55, 65, 70, 75]);
  assert.ok(firstFive.every((stage) => stage.playerBaseHp <= 1200));
  assert.ok(firstFive.every((stage) => stage.enemyBaseHp <= 1350));
});

test('the first roster and enemy line advance at a deliberate pace', () => {
  const starter = PLAYER_SLOTS.find((slot) => slot.slotId === 'militia');
  assert.ok(starter);
  assert.equal(starter.definition.moveSpeed, 3);
  assert.equal(starter.cost, 50);

  const enemies = enemiesJson as Array<{ id: string; moveSpeed: number }>;
  assert.equal(enemies.find((enemy) => enemy.id === 'enemy-raider')?.moveSpeed, 2);
  assert.equal(enemies.find((enemy) => enemy.id === 'enemy-sprinter')?.moveSpeed, 4);
  assert.ok(enemies.every((enemy) => enemy.moveSpeed <= 4));
  assert.ok(PLAYER_SLOTS.every((slot) => slot.definition.moveSpeed <= 3));
});

test('the ten story units remain the core roster while v1 main progression spans four chapters', () => {
  assert.equal(PLAYER_SLOTS.length, 10);
  assert.equal(STAGES.length, 80);
  assert.equal(STAGES[19]!.id, 'main_01_020');
  assert.equal(STAGES[20]!.id, 'main_02_001');
  assert.equal(STAGES[39]!.id, 'main_02_020');
  assert.equal(STAGES[40]!.id, 'main_03_001');
  assert.equal(STAGES[59]!.id, 'main_03_020');
  assert.equal(STAGES[60]!.id, 'main_04_001');
  assert.equal(STAGES[79]!.id, 'main_04_020');
});
