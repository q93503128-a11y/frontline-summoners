import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('character portrait clean room keeps legacy silhouette installer inert', async () => {
  const [main, installer] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/story-silhouette-preview-scenes.ts'),
  ]);

  assert.match(main, /installStorySilhouetteScenePreviews\(\)/);
  assert.match(installer, /Character art is now an explicit clean room/);
  assert.doesNotMatch(installer, /createUnitSilhouettePresentation/);
  assert.doesNotMatch(installer, /insertOverlayAfterPortrait/);
  assert.doesNotMatch(installer, /Phaser\.GameObjects\.Graphics/);
  assert.doesNotMatch(installer, /addAt\(/);
});

test('command presentation wrappers never mutate character sprite presentation', async () => {
  const sources = await Promise.all([
    readSource('../src/recruitment-command-scene.ts'),
    readSource('../src/catalog-command-scene.ts'),
    readSource('../src/profile-command-scene.ts'),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(source, /Phaser\.GameObjects\.Sprite/);
    assert.doesNotMatch(source, /\.setTint\(/);
    assert.doesNotMatch(source, /\.setScale\([^\n]*scale[XY]\s*\*/);
  }
});
