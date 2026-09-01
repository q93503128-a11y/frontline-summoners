import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main menu progress summary uses active account or guest progress instead of guest-local state', async () => {
  const source = await readSource('../src/navigation-scenes.ts');
  const start = source.indexOf('export class MainMenuScene');
  const end = source.indexOf('export class StageHubScene');
  assert.ok(start >= 0 && end > start);
  const mainMenu = source.slice(start, end);
  assert.match(mainMenu, /loadActiveProgress\(\)/);
  assert.doesNotMatch(mainMenu, /loadGuestProgress\(\)/);
  assert.match(mainMenu, /계정 지휘관 · 서버/);
  assert.match(mainMenu, /계정 지휘관 · 오프라인/);
});

test('catalog reads active progress so account ownership, discovery and reward records cannot fall back to guest save', async () => {
  const catalog = await readSource('../src/catalog-scene.ts');
  assert.match(catalog, /loadActiveProgress\(\)/);
  assert.doesNotMatch(catalog, /loadGuestProgress\(\)/);
  assert.match(catalog, /로그인 계정 · 서버 도감/);
  assert.match(catalog, /로그인 계정 · 오프라인 캐시 도감/);
});

test('actual sortie hub and stage selector already use active progress authority', async () => {
  const [hub, select] = await Promise.all([
    readSource('../src/stage-hub-scene.ts'),
    readSource('../src/stage-select-scene.ts'),
  ]);
  assert.match(hub, /loadActiveProgress\(\)/);
  assert.match(select, /loadActiveProgress\(\)/);
  assert.doesNotMatch(hub, /loadGuestProgress\(\)/);
  assert.doesNotMatch(select, /loadGuestProgress\(\)/);
});

test('direct node battle VFX test dependency uses explicit TypeScript extension', async () => {
  const source = await readSource('../src/battle-vfx-density.ts');
  assert.match(source, /from '\.\/battle-feedback-policy\.ts'/);
});
