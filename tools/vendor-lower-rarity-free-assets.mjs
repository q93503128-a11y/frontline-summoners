import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/lower-rarity');

// CC0 sources. Raw source files are fetched during dev/build and are not committed as standalone asset packs.
const SOURCES = {
  bird: 'https://opengameart.org/sites/default/files/bird_v001_blue_and_yellow.png',
  duck: 'https://opengameart.org/sites/default/files/duck_spritesheet.png',
  prehistoricBird: 'https://opengameart.org/sites/default/files/prehistoric-bird-spritesheet.png',
};

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function fetchPng(url, label, attempts = 3) {
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
      const bytes = Buffer.from(await response.arrayBuffer());
      return decodePng(bytes, label);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`[lower-rarity-free-art] ${label} download failed: ${String(lastError)}`);
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

async function writeStrip(folder, name, bytes) {
  const target = resolve(outputRoot, folder, `${name}.png`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const bird = await fetchPng(SOURCES.bird, 'CC0 Bird by rmazanek');
assert(bird.width === 528 && bird.height === 256, `bird source changed: expected 528x256, got ${bird.width}x${bird.height}`);
const birdIndex = (row, column) => row * 11 + column;
const birdRow = (row, count = 11) => Array.from({ length: count }, (_, column) => birdIndex(row, column));

// Three posture languages from the same CC0 bird sheet. These are source-reference art,
// not production approval: standing, hopping, and airborne forms remain visibly distinct.
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

// F3 intentionally changes body proportion as well as attack posture instead of being a recolor.
await writeStrip('cc0-clockduck-f3', 'idle', composeStrip(prehistoricBird, 48, 48, [0, 0, 1, 0]));
await writeStrip('cc0-clockduck-f3', 'move', composeStrip(prehistoricBird, 48, 48, [0, 1, 2, 1]));
await writeStrip('cc0-clockduck-f3', 'attack', composeStrip(prehistoricBird, 48, 48, peck));
await writeStrip('cc0-clockduck-f3', 'hit', composeStrip(prehistoricBird, 48, 48, [1, 0]));
await writeStrip('cc0-clockduck-f3', 'death', composeStrip(prehistoricBird, 48, 48, [2, 1, 0]));

console.log('[lower-rarity-free-art] vendored CC0 clockduck and ink-raven source-reference families');
