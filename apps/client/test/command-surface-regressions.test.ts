import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('growth and catalog route through focused presentations with disabled edge states', async () => {
  const [main, growth, catalog] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/growth-command-scene.ts'),
    readSource('../src/catalog-command-scene.ts'),
  ]);

  assert.match(main, /import \{ CatalogScene \} from '\.\/catalog-command-scene'/);
  assert.match(main, /import \{ GrowthScene \} from '\.\/growth-command-scene'/);
  assert.match(growth, /setButtonState\(this\.previousButton, this\.page <= 0 \? 'disabled' : 'default'/);
  assert.match(growth, /setButtonState\(this\.nextButton, this\.page >= this\.pageCount - 1 \? 'disabled' : 'default'/);
  assert.match(catalog, /'첫 번째 기록 묶음입니다\.'/);
  assert.match(catalog, /'마지막 기록 묶음입니다\.'/);
  assert.match(catalog, /function catalogCompletion\(/);
  assert.match(catalog, /getOwnedCharacterIds\(progress\)\.length/);
  assert.match(catalog, /pageText\.setText\(`\$\{base\} · \$\{noun\} \$\{current\}\/\$\{total\}`\)/);
  assert.match(catalog, /updateArchiveProgress\(this, carrier, progressGuide\)/);
});

test('profile and account keep progression identity while separating utility and risk', async () => {
  const [main, profile, account] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/profile-command-scene.ts'),
    readSource('../src/account-refined-scene.ts'),
  ]);

  assert.match(main, /import \{ ProfileScene \} from '\.\/profile-command-scene'/);
  assert.match(main, /import \{ AccountScene \} from '\.\/account-refined-scene'/);
  assert.match(profile, /import \{ ACHIEVEMENTS \}/);
  assert.match(profile, /drawAchievementProgress\(\)/);
  assert.match(profile, /completed \/ total/);
  assert.match(profile, /'대표 장식과 전과를 정리하고 업적 진행을 확인합니다\.'/);
  assert.match(account, /'현재 진행의 저장 위치와 계정 연결 상태를 확인합니다\.'/);
  assert.match(account, /drawAccountGuides\(\)/);
  assert.match(account, /label === '로그아웃' \|\| label === '로컬 진행 초기화'/);
  assert.match(account, /label === '테스트 도구'/);
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
