import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/boss-source-reference');
const ASSET_REVISION = 'e93aa129978daafda85f3c907eebc8f1807ec43f';
const JAM_BASE = `https://github.com/series-ai/jam-ready-assets/raw/${ASSET_REVISION}`;
const jamUrl = (path) => `${JAM_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
const TARGET_CELL = 128;

// Pixel-Boy Ninja Adventure is CC0-1.0 at the pinned revision:
// ninja-adventure/2D/top-down-rpg/LICENSE.txt
// This vendor step only selects authored directional frames and nearest-neighbour normalizes
// them. It does not draw, recolour, combine, or procedurally alter character silhouettes.
const source = (folder, file, rows, row, label) => ({
  url: jamUrl(`ninja-adventure/2D/top-down-rpg/Actor/Boss/${folder}/${file}`),
  rows,
  row,
  label,
});

const FAMILIES = [
  {
    output: 'cc0-boss-void-squid',
    motions: {
      idle: source('SquidRed', 'Idle.png', 4, 2, 'SquidRed idle side row'),
      move: source('SquidRed', 'Walk.png', 4, 2, 'SquidRed walk side row'),
      attack: source('SquidRed', 'Attack.png', 4, 2, 'SquidRed attack side row'),
      hit: source('SquidRed', 'Hit.png', 4, 2, 'SquidRed hit side row'),
      // The pack has no separate death strip for this boss. Reuse its authored hit reaction
      // unchanged rather than fabricating a new death pose.
      death: source('SquidRed', 'Hit.png', 4, 2, 'SquidRed hit-as-death side row'),
    },
  },
  {
    output: 'cc0-boss-iron-samurai',
    motions: {
      idle: source('GiantBlueSamurai', 'Idle.png', 4, 2, 'GiantBlueSamurai idle side row'),
      move: source('GiantBlueSamurai', 'Walk.png', 4, 2, 'GiantBlueSamurai walk side row'),
      attack: source('GiantBlueSamurai', 'AttackLeft.png', 1, 0, 'GiantBlueSamurai authored left attack'),
      hit: source('GiantBlueSamurai', 'Hit.png', 4, 2, 'GiantBlueSamurai hit side row'),
      death: source('GiantBlueSamurai', 'Hit.png', 4, 2, 'GiantBlueSamurai hit-as-death side row'),
    },
  },
  {
    output: 'cc0-boss-rootwidow',
    motions: {
      // Rootwidow's canonical identity is NATURE + GIANT. Use a purpose-built plant boss
      // silhouette instead of enlarging the 16px Foozle Spider normal enemy. This does not
      // claim spider anatomy; it is source-reference art for the root/giant gameplay read.
      idle: source('GiantBamboo', 'Idle.png', 4, 2, 'GiantBamboo idle side row'),
      move: source('GiantBamboo', 'Walk.png', 4, 2, 'GiantBamboo walk side row'),
      attack: source('GiantBamboo', 'Attack.png', 4, 2, 'GiantBamboo authored attack side row'),
      hit: source('GiantBamboo', 'Hit.png', 4, 2, 'GiantBamboo hit side row'),
      // The pack has no separate death strip. Keep the authored hit reaction unchanged
      // rather than drawing or synthesizing a death pose.
      death: source('GiantBamboo', 'Hit.png', 4, 2, 'GiantBamboo hit-as-death side row'),
    },
  },
];

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const assert = (ok, message) => {
  if (!ok) throw new Error(`[boss-source-reference] ${message}`);
};

async function fetchPng(entry, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(entry.url, {
        headers: { 'user-agent': 'frontline-summoners-build/1.0' },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return decodePng(Buffer.from(await response.arrayBuffer()), entry.label);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`[boss-source-reference] ${entry.label} download failed: ${String(lastError)}`);
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

function composeNormalizedSideStrip(sheet, entry) {
  assert(sheet.height % entry.rows === 0,
    `${entry.label}: height ${sheet.height} is not divisible by ${entry.rows} authored direction rows`);
  const cell = sheet.height / entry.rows;
  assert(cell > 0 && cell <= TARGET_CELL, `${entry.label}: unsupported ${cell}px cell`);
  assert(sheet.width % cell === 0,
    `${entry.label}: expected square frame grid, got ${sheet.width}x${sheet.height} with ${cell}px cells`);
  assert(entry.row >= 0 && entry.row < entry.rows, `${entry.label}: invalid direction row ${entry.row}`);

  const columns = sheet.width / cell;
  const rowStart = entry.row * columns;
  const visible = Array.from({ length: columns }, (_, column) => rowStart + column)
    .filter((index) => cellHasAlpha(sheet, cell, index));
  const frames = sampleFour(visible, entry.label);

  const scale = Math.max(1, Math.floor(TARGET_CELL / cell));
  const drawSize = cell * scale;
  const offset = Math.floor((TARGET_CELL - drawSize) / 2);
  const out = Buffer.alloc(TARGET_CELL * frames.length * TARGET_CELL * 4);

  frames.forEach((index, frame) => {
    const sourceColumn = index % columns;
    const sourceRow = Math.floor(index / columns);
    for (let y = 0; y < cell; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const sourceIndex = ((sourceRow * cell + y) * sheet.width + sourceColumn * cell + x) * 4;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const targetX = frame * TARGET_CELL + offset + x * scale + dx;
            const targetY = offset + y * scale + dy;
            const targetIndex = (targetY * TARGET_CELL * frames.length + targetX) * 4;
            sheet.data.copy(out, targetIndex, sourceIndex, sourceIndex + 4);
          }
        }
      }
    }
  });

  return encodePng(TARGET_CELL * frames.length, TARGET_CELL, out);
}

async function writeMotion(folder, motion, entry) {
  const sheet = await fetchPng(entry);
  const bytes = composeNormalizedSideStrip(sheet, entry);
  const target = resolve(outputRoot, folder, `${motion}.png`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

await rm(outputRoot, { recursive: true, force: true });
for (const family of FAMILIES) {
  for (const [motion, entry] of Object.entries(family.motions)) {
    await writeMotion(family.output, motion, entry);
  }
}
