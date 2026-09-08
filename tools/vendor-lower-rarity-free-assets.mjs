import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/lower-rarity');
const ASSET_REVISION = 'e93aa129978daafda85f3c907eebc8f1807ec43f';
const JAM_BASE = `https://github.com/series-ai/jam-ready-assets/raw/${ASSET_REVISION}`;
const jamUrl = (path) => `${JAM_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
const FOOZLE_OUTPUT_CELL = 256;
const GRAFXKID_OUTPUT_CELL = 64;

// CC0 sources. Raw source files are fetched during dev/build and are not committed as standalone asset packs.
const SOURCES = {
  bird: 'https://opengameart.org/sites/default/files/bird_v001_blue_and_yellow.png',
  duck: 'https://opengameart.org/sites/default/files/duck_spritesheet.png',
  prehistoricBird: 'https://opengameart.org/sites/default/files/prehistoric-bird-spritesheet.png',
  foozleMagmaCrab: jamUrl('foozle-spire-enemies-ground/2D/fantasy/Ground/Spritesheets/Magma Crab.png'),
  foozleScorpion: jamUrl('foozle-spire-enemies-ground/2D/fantasy/Ground/Spritesheets/Scorpion.png'),
  foozleFirebug: jamUrl('foozle-spire-enemies-ground/2D/fantasy/Ground/Spritesheets/Firebug.png'),
  foozleVoidButterfly: jamUrl('foozle-spire-enemies-flying/2D/fantasy/Flying/Spritesheets/Voidbutterfly.png'),
  foozleFirewasp: jamUrl('foozle-spire-enemies-flying/2D/fantasy/Flying/Spritesheets/Firewasp.png'),
  foozleLeafbat: jamUrl('foozle-spire-enemies-flying/2D/fantasy/Flying/Spritesheets/Leafbat.png'),
  grafxBumpyIdle: jamUrl('grafxkid-sprite-pack-1/2D/platformer/2 - Bumpy the Robot/Idle (16 x 16).png'),
  grafxBumpyRun: jamUrl('grafxkid-sprite-pack-1/2D/platformer/2 - Bumpy the Robot/Running (16 x 16).png'),
  grafxBumpyAttack: jamUrl('grafxkid-sprite-pack-1/2D/platformer/2 - Bumpy the Robot/Pushing_Object (16 x 16).png'),
  grafxBumpyHit: jamUrl('grafxkid-sprite-pack-1/2D/platformer/2 - Bumpy the Robot/Taking_Damage (16 x 16).png'),
  grafxBumpyDeath: jamUrl('grafxkid-sprite-pack-1/2D/platformer/2 - Bumpy the Robot/Sitting (16 x 16).png'),
  grafxTotemIdle: jamUrl('grafxkid-sprite-pack-2/2D/platformer/6 - Robo Totem/Armored_Standing (16 x 32).png'),
  grafxTotemRun: jamUrl('grafxkid-sprite-pack-2/2D/platformer/6 - Robo Totem/Armored_Walking (16 x 32).png'),
  grafxTotemHit: jamUrl('grafxkid-sprite-pack-2/2D/platformer/6 - Robo Totem/Hurt (16 x 16).png'),
  grafxJ5Idle: jamUrl('grafxkid-sprite-pack-3/2D/platformer/3 - Robot J5/Idle (32 x 32).png'),
  grafxJ5Run: jamUrl('grafxkid-sprite-pack-3/2D/platformer/3 - Robot J5/Walking (32 x 32).png'),
  grafxJ5Attack: jamUrl('grafxkid-sprite-pack-3/2D/platformer/3 - Robot J5/Throw_Object (32 x 32).png'),
  grafxJ5Hit: jamUrl('grafxkid-sprite-pack-3/2D/platformer/3 - Robot J5/Hurt (32 x 32).png'),
  grafxJ5Death: jamUrl('grafxkid-sprite-pack-3/2D/platformer/3 - Robot J5/Burnt (32 x 32).png'),
};

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function fetchBytes(url, label, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'frontline-summoners-build/1.0' },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`[lower-rarity-free-art] ${label} download failed: ${String(lastError)}`);
}

async function fetchPng(url, label, attempts = 3) {
  return decodePng(await fetchBytes(url, label, attempts), label);
}

function assert(ok, message) {
  if (!ok) throw new Error(`[lower-rarity-free-art] ${message}`);
}

function composeStrip(sheet, cellWidth, cellHeight, indexes) {
  const columns = Math.floor(sheet.width / cellWidth);
  const rows = Math.floor(sheet.height / cellHeight);
  assert(columns > 0 && rows > 0, `invalid ${cellWidth}x${cellHeight} grid for ${sheet.width}x${sheet.height}`);
  const total = columns * rows;
  const out = Buffer.alloc(cellWidth * indexes.length * cellHeight * 4);
  indexes.forEach((index, frame) => {
    assert(index >= 0 && index < total, `frame ${index} outside ${columns}x${rows} grid`);
    const sourceColumn = index % columns;
    const sourceRow = Math.floor(index / columns);
    for (let y = 0; y < cellHeight; y += 1) {
      const sourceStart = ((sourceRow * cellHeight + y) * sheet.width + sourceColumn * cellWidth) * 4;
      const targetStart = (y * cellWidth * indexes.length + frame * cellWidth) * 4;
      sheet.data.copy(out, targetStart, sourceStart, sourceStart + cellWidth * 4);
    }
  });
  return encodePng(cellWidth * indexes.length, cellHeight, out);
}

function composePaddedStrip(sheet, sourceCell, indexes, targetCell = FOOZLE_OUTPUT_CELL) {
  assert(sourceCell <= targetCell, `Foozle source cell ${sourceCell}px exceeds normalized ${targetCell}px cell`);
  const columns = Math.floor(sheet.width / sourceCell);
  const rows = Math.floor(sheet.height / sourceCell);
  const total = columns * rows;
  const offset = Math.floor((targetCell - sourceCell) / 2);
  const out = Buffer.alloc(targetCell * indexes.length * targetCell * 4);
  indexes.forEach((index, frame) => {
    assert(index >= 0 && index < total, `Foozle frame ${index} outside ${columns}x${rows} grid`);
    const sourceColumn = index % columns;
    const sourceRow = Math.floor(index / columns);
    for (let y = 0; y < sourceCell; y += 1) {
      const sourceStart = ((sourceRow * sourceCell + y) * sheet.width + sourceColumn * sourceCell) * 4;
      const targetStart = ((offset + y) * targetCell * indexes.length + frame * targetCell + offset) * 4;
      sheet.data.copy(out, targetStart, sourceStart, sourceStart + sourceCell * 4);
    }
  });
  return encodePng(targetCell * indexes.length, targetCell, out);
}

function composeScaledStrip(sheet, sourceWidth, sourceHeight, indexes, targetCell = GRAFXKID_OUTPUT_CELL) {
  assert(sheet.width % sourceWidth === 0 && sheet.height % sourceHeight === 0,
    `invalid ${sourceWidth}x${sourceHeight} source grid for ${sheet.width}x${sheet.height}`);
  const columns = sheet.width / sourceWidth;
  const rows = sheet.height / sourceHeight;
  const total = columns * rows;
  const scale = Math.floor(Math.min(targetCell / sourceWidth, targetCell / sourceHeight));
  assert(scale >= 1, `source ${sourceWidth}x${sourceHeight} exceeds ${targetCell}px normalized cell`);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = Math.floor((targetCell - drawWidth) / 2);
  const offsetY = Math.floor((targetCell - drawHeight) / 2);
  const out = Buffer.alloc(targetCell * indexes.length * targetCell * 4);

  indexes.forEach((index, frame) => {
    assert(index >= 0 && index < total, `frame ${index} outside ${columns}x${rows} grid`);
    const sourceColumn = index % columns;
    const sourceRow = Math.floor(index / columns);
    for (let y = 0; y < sourceHeight; y += 1) {
      for (let x = 0; x < sourceWidth; x += 1) {
        const sourceIndex = (((sourceRow * sourceHeight) + y) * sheet.width + sourceColumn * sourceWidth + x) * 4;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const targetX = frame * targetCell + offsetX + x * scale + dx;
            const targetY = offsetY + y * scale + dy;
            const targetIndex = (targetY * targetCell * indexes.length + targetX) * 4;
            sheet.data.copy(out, targetIndex, sourceIndex, sourceIndex + 4);
          }
        }
      }
    }
  });

  return encodePng(targetCell * indexes.length, targetCell, out);
}

function cellHasAlpha(sheet, cell, index) {
  const columns = sheet.width / cell;
  const sourceColumn = index % columns;
  const sourceRow = Math.floor(index / columns);
  for (let y = 0; y < cell; y += 1) {
    const rowStart = ((sourceRow * cell + y) * sheet.width + sourceColumn * cell) * 4;
    for (let x = 0; x < cell; x += 1) {
      if (sheet.data[rowStart + x * 4 + 3] !== 0) return true;
    }
  }
  return false;
}

function rectCellHasAlpha(sheet, cellWidth, cellHeight, index) {
  const columns = sheet.width / cellWidth;
  const sourceColumn = index % columns;
  const sourceRow = Math.floor(index / columns);
  for (let y = 0; y < cellHeight; y += 1) {
    const rowStart = ((sourceRow * cellHeight + y) * sheet.width + sourceColumn * cellWidth) * 4;
    for (let x = 0; x < cellWidth; x += 1) {
      if (sheet.data[rowStart + x * 4 + 3] !== 0) return true;
    }
  }
  return false;
}

function sampleFour(indexes, label) {
  assert(indexes.length > 0, `${label} has no visible frames`);
  return Array.from({ length: 4 }, (_, i) => indexes[Math.round((indexes.length - 1) * i / 3)]);
}

function foozleAnimationGroups(sheet, label) {
  // Foozle Spire enemy sheets contain exactly idle, move and death animations. Prefer the
  // normal three-row export, but accept a one-row Aseprite export by splitting its frame run.
  if (sheet.height % 3 === 0) {
    const cell = sheet.height / 3;
    if (cell > 0 && cell <= FOOZLE_OUTPUT_CELL && sheet.width % cell === 0) {
      const columns = sheet.width / cell;
      const groups = [0, 1, 2].map((row) => Array.from({ length: columns }, (_, column) => row * columns + column)
        .filter((index) => cellHasAlpha(sheet, cell, index)));
      if (groups.every((group) => group.length > 0)) return { cell, groups };
    }
  }

  const cell = sheet.height;
  if (cell > 0 && cell <= FOOZLE_OUTPUT_CELL && sheet.width % cell === 0) {
    const columns = sheet.width / cell;
    const visible = Array.from({ length: columns }, (_, index) => index).filter((index) => cellHasAlpha(sheet, cell, index));
    if (visible.length >= 3) {
      const firstCut = Math.max(1, Math.round(visible.length / 3));
      const secondCut = Math.max(firstCut + 1, Math.round(visible.length * 2 / 3));
      return { cell, groups: [visible.slice(0, firstCut), visible.slice(firstCut, secondCut), visible.slice(secondCut)] };
    }
  }

  throw new Error(`[lower-rarity-free-art] cannot infer Foozle idle/move/death layout for ${label}: ${sheet.width}x${sheet.height}`);
}

async function writeStrip(folder, name, bytes) {
  const target = resolve(outputRoot, folder, `${name}.png`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

async function vendorFoozleFamily(folder, sourceKey, label) {
  const sheet = await fetchPng(SOURCES[sourceKey], label);
  const { cell, groups } = foozleAnimationGroups(sheet, label);
  const idle = sampleFour(groups[0], `${label} idle`);
  const move = sampleFour(groups[1], `${label} move`);
  const death = sampleFour(groups[2], `${label} death`);

  await writeStrip(folder, 'idle', composePaddedStrip(sheet, cell, idle));
  await writeStrip(folder, 'move', composePaddedStrip(sheet, cell, move));
  // These packs have no authored attack/hit tags. Reuse their own native motion instead of
  // drawing, recolouring, or kitbashing substitute frames.
  await writeStrip(folder, 'attack', composePaddedStrip(sheet, cell, move));
  await writeStrip(folder, 'hit', composePaddedStrip(sheet, cell, [...idle].reverse()));
  await writeStrip(folder, 'death', composePaddedStrip(sheet, cell, death));
}

async function vendorGrafxKidMotion(folder, motion, sourceKey, label, cellWidth, cellHeight) {
  const sheet = await fetchPng(SOURCES[sourceKey], label);
  assert(sheet.width % cellWidth === 0 && sheet.height % cellHeight === 0,
    `${label} changed: expected ${cellWidth}x${cellHeight} grid, got ${sheet.width}x${sheet.height}`);
  const columns = sheet.width / cellWidth;
  const rows = sheet.height / cellHeight;
  const visible = Array.from({ length: columns * rows }, (_, index) => index)
    .filter((index) => rectCellHasAlpha(sheet, cellWidth, cellHeight, index));
  await writeStrip(folder, motion, composeScaledStrip(sheet, cellWidth, cellHeight, sampleFour(visible, label)));
}

async function vendorGrafxKidTinSquire() {
  const forms = [
    ['cc0-tin-squire-f1', [
      ['idle', 'grafxBumpyIdle', 'CC0 GrafxKid Bumpy Robot idle', 16, 16],
      ['move', 'grafxBumpyRun', 'CC0 GrafxKid Bumpy Robot run', 16, 16],
      ['attack', 'grafxBumpyAttack', 'CC0 GrafxKid Bumpy Robot push', 16, 16],
      ['hit', 'grafxBumpyHit', 'CC0 GrafxKid Bumpy Robot damage', 16, 16],
      ['death', 'grafxBumpyDeath', 'CC0 GrafxKid Bumpy Robot sitting', 16, 16],
    ]],
    ['cc0-tin-squire-f2', [
      ['idle', 'grafxTotemIdle', 'CC0 GrafxKid Robo Totem armored idle', 16, 32],
      ['move', 'grafxTotemRun', 'CC0 GrafxKid Robo Totem armored walk', 16, 32],
      ['attack', 'grafxTotemRun', 'CC0 GrafxKid Robo Totem armored strike motion', 16, 32],
      ['hit', 'grafxTotemHit', 'CC0 GrafxKid Robo Totem hurt', 16, 16],
      ['death', 'grafxTotemHit', 'CC0 GrafxKid Robo Totem collapse pose', 16, 16],
    ]],
    ['cc0-tin-squire-f3', [
      ['idle', 'grafxJ5Idle', 'CC0 GrafxKid Robot J5 idle', 32, 32],
      ['move', 'grafxJ5Run', 'CC0 GrafxKid Robot J5 walk', 32, 32],
      ['attack', 'grafxJ5Attack', 'CC0 GrafxKid Robot J5 throw', 32, 32],
      ['hit', 'grafxJ5Hit', 'CC0 GrafxKid Robot J5 hurt', 32, 32],
      ['death', 'grafxJ5Death', 'CC0 GrafxKid Robot J5 burnt', 32, 32],
    ]],
  ];

  for (const [folder, motions] of forms) {
    for (const [motion, sourceKey, label, cellWidth, cellHeight] of motions) {
      await vendorGrafxKidMotion(folder, motion, sourceKey, label, cellWidth, cellHeight);
    }
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const bird = await fetchPng(SOURCES.bird, 'CC0 Bird by rmazanek');
assert(bird.width === 528 && bird.height === 256, `bird source changed: expected 528x256, got ${bird.width}x${bird.height}`);
const birdIndex = (row, column) => row * 11 + column;
const birdRow = (row, count = 11) => Array.from({ length: count }, (_, column) => birdIndex(row, column));

const ravenFamilies = [
  ['cc0-ink-raven-f1', 2, 6, 3],
  ['cc0-ink-raven-f2', 1, 6, 5],
  ['cc0-ink-raven-f3', 6, 6, 7],
];
for (const [folder, idleRow, moveRow, attackRow] of ravenFamilies) {
  await writeStrip(folder, 'idle', composeStrip(bird, 48, 32, birdRow(idleRow)));
  await writeStrip(folder, 'move', composeStrip(bird, 48, 32, birdRow(moveRow)));
  await writeStrip(folder, 'attack', composeStrip(bird, 48, 32, birdRow(attackRow)));
  await writeStrip(folder, 'hit', composeStrip(bird, 48, 32, birdRow(0, 3)));
  await writeStrip(folder, 'death', composeStrip(bird, 48, 32, birdRow(0)));
}

const duck = await fetchPng(SOURCES.duck, 'CC0 16x16 Duck by ARoachIFoundOnMyPillow');
assert(duck.width % 16 === 0 && duck.height % 16 === 0, `duck source is not a 16px grid: ${duck.width}x${duck.height}`);
const duckTotal = (duck.width / 16) * (duck.height / 16);
assert(duckTotal >= 4, `duck source has only ${duckTotal} frames`);
const duckFrames = [0, 1, 2, 3];
await writeStrip('cc0-clockduck-f1', 'idle', composeStrip(duck, 16, 16, [0, 1, 0, 1]));
await writeStrip('cc0-clockduck-f1', 'move', composeStrip(duck, 16, 16, duckFrames));
await writeStrip('cc0-clockduck-f1', 'attack', composeStrip(duck, 16, 16, [0, 1, 2, 1]));
await writeStrip('cc0-clockduck-f1', 'hit', composeStrip(duck, 16, 16, [2, 3]));
await writeStrip('cc0-clockduck-f1', 'death', composeStrip(duck, 16, 16, [3, 3, 3]));

const prehistoricBird = await fetchPng(SOURCES.prehistoricBird, 'CC0 Prehistoric Bird by ARoachIFoundOnMyPillow');
assert(prehistoricBird.width % 48 === 0 && prehistoricBird.height % 48 === 0,
  `prehistoric bird source is not a 48px grid: ${prehistoricBird.width}x${prehistoricBird.height}`);
const prehistoricTotal = (prehistoricBird.width / 48) * (prehistoricBird.height / 48);
assert(prehistoricTotal >= 3, `prehistoric bird source has only ${prehistoricTotal} frames`);
const peck = [0, 1, 2];

await writeStrip('cc0-clockduck-f3', 'idle', composeStrip(prehistoricBird, 48, 48, [0, 0, 1, 0]));
await writeStrip('cc0-clockduck-f3', 'move', composeStrip(prehistoricBird, 48, 48, [0, 1, 2, 1]));
await writeStrip('cc0-clockduck-f3', 'attack', composeStrip(prehistoricBird, 48, 48, peck));
await writeStrip('cc0-clockduck-f3', 'hit', composeStrip(prehistoricBird, 48, 48, [1, 0]));
await writeStrip('cc0-clockduck-f3', 'death', composeStrip(prehistoricBird, 48, 48, [2, 1, 0]));

// Six complete, creator-consistent CC0 creatures. Evolution readability comes from selecting
// different finished Foozle enemies, never from assistant-authored drawing or kitbashing.
await vendorFoozleFamily('cc0-bell-crab-f1', 'foozleMagmaCrab', 'CC0 Foozle Spire Magma Crab');
await vendorFoozleFamily('cc0-bell-crab-f2', 'foozleScorpion', 'CC0 Foozle Spire Scorpion');
await vendorFoozleFamily('cc0-bell-crab-f3', 'foozleFirebug', 'CC0 Foozle Spire Firebug');
await vendorFoozleFamily('cc0-lantern-moth-f1', 'foozleVoidButterfly', 'CC0 Foozle Spire Voidbutterfly');
await vendorFoozleFamily('cc0-lantern-moth-f2', 'foozleFirewasp', 'CC0 Foozle Spire Firewasp');
await vendorFoozleFamily('cc0-lantern-moth-f3', 'foozleLeafbat', 'CC0 Foozle Spire Leafbat');

// Tin-squire evolution uses three finished GrafxKid robot characters from the same CC0 creator.
// Only nearest-neighbour normalization is applied; no assistant-authored drawing, recolour, or kitbash.
await vendorGrafxKidTinSquire();

console.log('[lower-rarity-free-art] vendored CC0 clockduck, ink-raven, bell-crab, lantern-moth, and tin-squire source-reference families');
