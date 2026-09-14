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

test('battle character clean room keeps legacy silhouette runtime inert', async () => {
  const [battle, runtime] = await Promise.all([
    readSource('../src/accessible-battle-scene.ts'),
    readSource('../src/battle-story-silhouette-runtime.ts'),
  ]);

  assert.match(battle, /installStorySilhouetteOverlayRuntime\(this\)/);
  assert.match(runtime, /Character art is a strict clean room during UI\/UX work/);
  assert.doesNotMatch(runtime, /createUnitSilhouettePresentation/);
  assert.doesNotMatch(runtime, /createUnitView/);
  assert.doesNotMatch(runtime, /Phaser\.GameObjects\.(?:Sprite|Graphics)/);
  assert.doesNotMatch(runtime, /\.set(?:Scale|Tint|Depth|Angle|Alpha)\(/);
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

test('pvp battle chrome stays outside resolved character display bounds', async () => {
  const sources = await Promise.all([
    readSource('../src/pvp-command-match-scene.ts'),
    readSource('../src/pvp-friendly-command-scenes.ts'),
  ]);

  for (const source of sources) {
    assert.match(source, /const art = familyForUnit\(unit\.definitionId\);/);
    assert.match(source, /const displayedHeight = targetHeight \* art\.displayScale;/);
    assert.match(source, /const hpY = y - displayedHeight \/ 2 - 10;/);
    assert.match(source, /const shadowY = y \+ displayedHeight \/ 2 \+ 10;/);
    assert.match(source, /\.setTint\(art\.tint\)/);
    assert.match(source, /\.setScale\(\(targetHeight \/ art\.family\.idle\.frameHeight\) \* art\.displayScale\)/);
    assert.doesNotMatch(source, /scene\.add\.ellipse\(x, y \+ 31,/);
    assert.doesNotMatch(source, /scene\.add\.rectangle\(x, y - 40,/);
    assert.doesNotMatch(source, /createUnitSilhouettePresentation|addAt\(/);
  }
});

test('2v2 battle chrome and ownership marker stay outside resolved character display bounds', async () => {
  const source = await readSource('../src/pvp-2v2-command-scenes.ts');

  assert.match(source, /const art = familyForUnit\(unit\.definitionId\);/);
  assert.match(source, /const displayedHeight = targetHeight \* art\.displayScale;/);
  assert.match(source, /const hpY = y - displayedHeight \/ 2 - 10;/);
  assert.match(source, /const markerY = y \+ displayedHeight \/ 2 \+ 8;/);
  assert.match(source, /const shadowY = markerY \+ 9;/);
  assert.match(source, /scene\.add\.rectangle\(x, markerY, 24, 3,/);
  assert.match(source, /\.setTint\(art\.tint\)/);
  assert.match(source, /\.setScale\(\(targetHeight \/ art\.family\.idle\.frameHeight\) \* art\.displayScale\)/);
  assert.doesNotMatch(source, /scene\.add\.ellipse\(x, y \+ 31,/);
  assert.doesNotMatch(source, /scene\.add\.rectangle\(x, y - 39,/);
  assert.doesNotMatch(source, /scene\.add\.rectangle\(x, y \+ 39,/);
  assert.doesNotMatch(source, /createUnitSilhouettePresentation|addAt\(/);
});
