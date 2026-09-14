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
