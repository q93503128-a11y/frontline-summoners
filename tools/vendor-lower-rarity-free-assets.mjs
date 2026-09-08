import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/lower-rarity');
const FOOZLE_REVISION = 'e93aa129978daafda85f3c907eebc8f1807ec43f';
const FOOZLE_BASE = `https://github.com/series-ai/jam-ready-assets/raw/${FOOZLE_REVISION}`;
const FOOZLE_OUTPUT_CELL = 256;

// CC0 sources. Raw source files are fetched during dev/build and are not committed as standalone asset packs.
const SOURCES = {
  bird: 'https://opengameart.org/sites/default/files/bird_v001_blue_and_yellow.png',
  duck: 'https://opengameart.org/sites/default/files/duck_spritesheet.png',
  prehistoricBird: 'https://opengameart.org/sites/default/files/prehistoric-bird-spritesheet.png',
  foozleMagmaCrab: `${FOOZLE_BASE}/foozle-spire-enemies-ground/2D/fantasy/Ground/Spritesheets/Magma%20Crab.png`,
  foozleScorpion: `${FOOZLE_BASE}/foozle-spire-enemies-ground/2D/fantasy/Ground/Spritesheets/Scorpion.png`,
  foozleFirebug: `${FOOZLE_BASE}/foozle-spire-enemies-ground/2D/fantasy/Ground/Spritesheets/Firebug.png`,
  foozleVoidButterfly: `${FOOZLE_BASE}/foozle-spire-enemies-flying/2D/fantasy/Flying/Spritesheets/Voidbutterfly.png`,
  foozleFirewasp: `${FOOZLE_BASE}/foozle-spire-enemies-flying/2D/fantasy/Flying/Spritesheets/Firewasp.png`,
  foozleLeafbat: `${FOOZLE_BASE}/foozle-spire-enemies-flying/2D/fantasy/Flying/Spritesheets/Leafbat.png`,
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
await writeStrip('cc0-clockduck-f1', 'hit', composeStrip(duck, 16, 16, [2, 3]));
await writeStrip('cc0-clockduck-f1', 'death', composeStrip(duck, 16, 16, [3, 3, 3]));

const prehistoricBird = await fetchPng(SOURCES.prehistoricBird, 'CC0 Prehistoric Bird by ARoachIFoundOnMyPillow');
assert(prehistoricBird.width % 48 === 0 && prehistoricBird.height % 48 === 0,
  `prehistoric bird source is not a 48px grid: ${prehistoricBird.width}x${prehistoricBird.height}`);
const prehistoricTotal = (prehistoricBird.width / 48) * (prehistoricBird.height / 48);
assert(prehistoricTotal >= 3, `prehistoric bird source has only ${prehistoricTotal} frames`);
const peck = [0, 1, 2];
await writeStrip('cc0-clockduck-f1', 'attack', composeStrip(prehistoricBird, 48, 48, peck));

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

console.log('[lower-rarity-free-art] vendored CC0 clockduck, ink-raven, bell-crab, and lantern-moth source-reference families');
