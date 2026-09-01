import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main menu coop shortcut cannot bypass active-progress stage flow into guest lobby', async () => {
  const main = await readSource('../src/main.ts');
  assert.match(main, /'협동 출정', \(\) => this\.scene\.start\('stage-hub'\)/);
  assert.doesNotMatch(main, /'2인 협동', \(\) => this\.scene\.start\('coop-lobby'\)/);
});

test('sortie hub no longer exposes a stage-agnostic public coop shortcut', async () => {
  const hub = await readSource('../src/stage-hub-scene.ts');
  assert.doesNotMatch(hub, /this\.scene\.start\('public-coop-matchmaking'\)/);
  assert.match(hub, /협동 가능 스테이지에서 혼자·친구·공개 협동을 선택한다/);
});

test('stage context remains the single player-facing authority for coop mode selection', async () => {
  const sortie = await readSource('../src/stage-sortie-mode-scene.ts');
  assert.match(sortie, /'혼자 시작'/);
  assert.match(sortie, /'친구 초대'/);
  assert.match(sortie, /'공개 협동'/);
  assert.match(sortie, /createFriendCoopInvite\(this\.stage\.id, profile\.friendCode\)/);
  assert.match(sortie, /joinPublicCoopMatchmaking\(this\.stage\.id\)/);
  assert.match(sortie, /this\.scene\.start\('coop-lobby', \{ preferredStageId: this\.stage\.id \}\)/);
});

test('guest coop runtime stays registered only as the guest code-coop implementation, not a universal account entry', async () => {
  const main = await readSource('../src/main.ts');
  const adapter = await readSource('../src/coop-story-scenes.ts');
  assert.match(main, /game\.scene\.add\('coop-lobby', CoopLobbyScene, false\)/);
  assert.match(adapter, /preferredStageId/);
  assert.match(adapter, /loadGuestProgress\(\)/);
  assert.doesNotMatch(main, /this\.scene\.start\('coop-lobby'\)/);
});
