import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('growth and catalog route through command pagination adapters with disabled edge states', async () => {
  const [main, adapter] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/meta-command-scenes.ts'),
  ]);

  assert.match(main, /import \{ CatalogScene, GrowthScene \} from '\.\/meta-command-scenes'/);
  assert.match(adapter, /'첫 번째 페이지입니다\.'/);
  assert.match(adapter, /'마지막 페이지입니다\.'/);
  assert.match(adapter, /setButtonState\(previous, page <= 0 \? 'disabled' : 'default'/);
  assert.match(adapter, /setButtonState\(next, page >= count - 1 \? 'disabled' : 'default'/);
});

test('guest coop post-story waits for persisted clear state instead of player-facing result copy', async () => {
  const [main, command] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/coop-command-battle-scenes.ts'),
  ]);

  assert.match(main, /from '\.\/coop-command-battle-scenes'/);
  assert.match(command, /loadGuestProgress\(\)/);
  assert.match(command, /progress\.clearedStageIds\.includes\(stageId\)/);
  assert.doesNotMatch(command, /text\.includes\('협동 NORMAL_CLEAR 저장 완료'\)/);
  assert.match(command, /협동 클리어 저장 완료/);
  assert.match(command, /저장에 실패해 이번 실행에서만 클리어가 유지됩니다/);
});

test('direct battle installs a presentation-only frontline pressure overlay without mutating simulation', async () => {
  const [replay, overlay] = await Promise.all([
    readSource('../src/replay-battle-scene.ts'),
    readSource('../src/battle-frontline-overlay.ts'),
  ]);

  assert.match(replay, /installBattleFrontlineOverlay\(this\)/);
  assert.match(overlay, /아군 전진/);
  assert.match(overlay, /적 압박/);
  assert.match(overlay, /교착/);
  assert.match(overlay, /전선 확보/);
  assert.match(overlay, /전선 붕괴/);
  assert.match(overlay, /state\.battle\.units\.filter/);
  assert.doesNotMatch(overlay, /stepPlayableBattle|trySpawnPlayerUnit|tryUpgradeSupply|tryFireBaseWeapon/);
});
