import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main menu progress summary uses active account or guest progress instead of guest-local state', async () => {
  const source = await readSource('../src/navigation-scenes.ts');
  const start = source.indexOf('export class MainMenuScene');
  assert.ok(start >= 0);
  const mainMenu = source.slice(start);
  assert.match(mainMenu, /loadActiveProgress\(\)/);
  assert.doesNotMatch(mainMenu, /loadGuestProgress\(\)/);
  assert.match(mainMenu, /계정 지휘관 · 서버/);
  assert.match(mainMenu, /계정 지휘관 · 오프라인/);
});

test('navigation core no longer contains legacy guest-only stage hub or selector implementations', async () => {
  const source = await readSource('../src/navigation-scenes.ts');
  assert.doesNotMatch(source, /export class StageHubScene/);
  assert.doesNotMatch(source, /export class StageSelectScene/);
  assert.doesNotMatch(source, /loadGuestProgress/);
  assert.doesNotMatch(source, /createPrototypeBattle/);
});

test('catalog reads active progress so account ownership, discovery and reward records cannot fall back to guest save', async () => {
  const catalog = await readSource('../src/catalog-scene.ts');
  assert.match(catalog, /loadActiveProgress\(\)/);
  assert.doesNotMatch(catalog, /loadGuestProgress\(\)/);
  assert.match(catalog, /계정 · 서버 기록/);
  assert.match(catalog, /계정 · 오프라인 기록/);
});

test('actual sortie hub and stage selector use active progress authority', async () => {
  const [hub, select, main] = await Promise.all([
    readSource('../src/stage-hub-scene.ts'),
    readSource('../src/stage-select-scene.ts'),
    readSource('../src/main.ts'),
  ]);
  assert.match(main, /import \{ StageHubScene \} from '\.\/stage-hub-scene'/);
  assert.match(main, /StoryStageSelectScene as StageSelectScene/);
  assert.match(hub, /loadActiveProgress\(\)/);
  assert.match(select, /loadActiveProgress\(\)/);
  assert.doesNotMatch(hub, /loadGuestProgress\(\)/);
  assert.doesNotMatch(select, /loadGuestProgress\(\)/);
});

test('direct node battle VFX test dependency uses explicit TypeScript extension', async () => {
  const source = await readSource('../src/battle-vfx-density.ts');
  assert.match(source, /from '\.\/battle-feedback-policy\.ts'/);
});
