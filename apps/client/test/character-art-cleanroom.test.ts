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

test('pve battle clean-room runtime never rescales character art and keeps chrome outside current bounds', async () => {
  const [battle, runtime] = await Promise.all([
    readSource('../src/accessible-battle-scene.ts'),
    readSource('../src/battle-character-cleanroom-runtime.ts'),
  ]);

  assert.match(battle, /installBattleCharacterCleanroomRuntime\(this\)/);
  assert.match(runtime, /BattleScene remains authoritative for every character-art property/);
  assert.match(runtime, /does not compensate for placeholder-art size or quality/);
  assert.match(runtime, /const displayedHeight = Math\.max\(1, view\.sprite\.displayHeight\);/);
  assert.match(runtime, /const hpY = view\.sprite\.y - displayedHeight \/ 2 - 10;/);
  assert.match(runtime, /const traitY = hpY - 18;/);
  assert.match(runtime, /const shadowY = view\.sprite\.y \+ displayedHeight \/ 2 \+ 8;/);
  assert.match(runtime, /view\.hpBg\.setPosition\(view\.sprite\.x, hpY\);/);
  assert.match(runtime, /view\.trait\.setPosition\(view\.sprite\.x, traitY\);/);
  assert.match(runtime, /view\.shadow\.setPosition\(view\.sprite\.x, shadowY\);/);
  assert.doesNotMatch(runtime, /PLACEHOLDER_BATTLE_SCALE|MIN_PLACEHOLDER_FRAME_HEIGHT|MAX_PLACEHOLDER_FRAME_HEIGHT/);
  assert.doesNotMatch(runtime, /familyForUnit|art\.source|targetHeight|factor/);
  assert.doesNotMatch(runtime, /view\.sprite\.set(?:Scale|Tint|Texture|Frame|Alpha|Angle|FlipX)/);
  assert.doesNotMatch(runtime, /createUnitSilhouettePresentation|addAt\(/);
});

test('battle summon cards reserve an unoccluded character zone', async () => {
  const source = await readSource('../src/battle-command-hud.ts');

  assert.match(source, /const portraitScale = \(portraitHeight \/ art\.family\.idle\.frameHeight\) \* art\.displayScale;/);
  assert.match(source, /const displayedHeight = art\.family\.idle\.frameHeight \* portraitScale;/);
  assert.match(source, /const portraitBottom = portraitY \+ displayedHeight \/ 2;/);
  assert.match(source, /const footerTop = Math\.max\(y \+ slotHeight \* 0\.03, portraitBottom \+ 6\);/);
  assert.match(source, /const shade = scene\.add\.rectangle\(x, footerTop \+ shadeHeight \/ 2, slotWidth - 8, shadeHeight,/);
  assert.doesNotMatch(source, /const shade = scene\.add\.rectangle\(x, y, slotWidth, slotHeight,/);
  assert.doesNotMatch(source, /topRail/);
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

test('deck roster text starts beyond the resolved character width and keeps card chrome in header/footer zones', async () => {
  const source = await readSource('../src/deck-command-scene.ts');

  assert.match(source, /const portraitScale = \(targetHeight \/ art\.family\.idle\.frameHeight\) \* art\.displayScale;/);
  assert.match(source, /const displayedWidth = art\.family\.idle\.frameWidth \* portraitScale;/);
  assert.match(source, /const portraitRight = portraitX \+ displayedWidth \/ 2;/);
  assert.match(source, /const infoX = Math\.max\(baseInfoX, portraitRight \+ 10\);/);
  assert.match(source, /const headerY = y - cardHeight \/ 2 \+ \(compact \? 13 : 12\);/);
  assert.match(source, /const favoriteStar = text\(scene, x \+ cardWidth \/ 2 - 13, headerY,/);
  assert.match(source, /const portrait = scene\.add\.sprite\(x, y, art\.family\.idle\.key, 0\)\.setTint\(art\.tint\);/);
  assert.match(source, /const name = text\(scene, x, y \+ height \/ 2 - 8,/);
  assert.doesNotMatch(source, /createUnitSilhouettePresentation|addAt\(/);
});

test('growth detail copy starts beyond the resolved character width', async () => {
  const source = await readSource('../src/growth-command-scene.ts');

  assert.match(source, /const portraitScale = \(targetHeight \/ art\.family\.idle\.frameHeight\) \* art\.displayScale;/);
  assert.match(source, /const displayedWidth = art\.family\.idle\.frameWidth \* portraitScale;/);
  assert.match(source, /const portraitRight = portraitX \+ displayedWidth \/ 2;/);
  assert.match(source, /const infoX = Math\.max\(594, portraitRight \+ 18\);/);
  assert.match(source, /portrait\.setScale\(portraitScale\);/);
  assert.match(source, /\.setTint\(art\.tint\)/);
  assert.doesNotMatch(source, /createUnitSilhouettePresentation|addAt\(/);
});

test('catalog ally and enemy dossiers start footer copy below resolved portrait bounds', async () => {
  const source = await readSource('../src/catalog-scene.ts');
  const portraitBottomMatches = source.match(/const portraitBottom = portraitY \+ displayedHeight \/ 2;/g) ?? [];
  const nameYMatches = source.match(/const nameY = Math\.max\(compact \? 360 : 342, portraitBottom \+ \(compact \? 22 : 18\)\);/g) ?? [];

  assert.equal(portraitBottomMatches.length, 2);
  assert.equal(nameYMatches.length, 2);
  assert.match(source, /const portraitScale = \(targetHeight \/ art\.family\.idle\.frameHeight\) \* art\.displayScale;/);
  assert.match(source, /portrait\.setScale\(portraitScale\);/);
  assert.match(source, /Discovery concealment is canonical catalog behavior/);
  assert.doesNotMatch(source, /x - 96, 200, owned \? badge\.label/);
  assert.doesNotMatch(source, /x - 96, 200, focused \?/);
});
