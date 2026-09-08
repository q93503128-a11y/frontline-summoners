import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/boss-source-reference');
const SOURCE_REVISION = '9891cd33de14dab668e085599a2fe30463c7edcc';
const RAW_BASE = `https://raw.githubusercontent.com/WithinAmnesia/ARPG/${SOURCE_REVISION}`;
const rawUrl = (path) => `${RAW_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
const TARGET_CELL = 128;
const ARCHIVE = 'C.C.0. Assets Archive/Art/FoozleCC/Lucifer';

// Each selected Foozle/Lucifer pack has a colocated Readme.txt declaring CC0.
// This step only selects authored frames and nearest-neighbour normalizes their canvas.
// It does not draw, recolour, combine, or procedurally alter character silhouettes.
const source = (pack, file, label, sample = 'spread') => ({
  url: rawUrl(`${ARCHIVE}/${pack}/Left/Png/${file}`),
  label,
  sample,
});

const FAMILIES = [
  {
    output: 'cc0-boss-funeral-king',
    motions: {
      idle: source('Foozle_2DC0021_Lucifer_Skeleton_King_Pixel_Art', 'SkeletonKingLeftIdle.png',
        'Skeleton King authored idle'),
      move: source('Foozle_2DC0021_Lucifer_Skeleton_King_Pixel_Art', 'SkeletonKingLeftWalk.png',
        'Skeleton King authored walk'),
      attack: source('Foozle_2DC0021_Lucifer_Skeleton_King_Pixel_Art', 'SkeletonKingLeftAttack01.png',
        'Skeleton King authored attack'),
      hit: source('Foozle_2DC0021_Lucifer_Skeleton_King_Pixel_Art', 'SkeletonKingLeftHurt.png',
        'Skeleton King authored hurt'),
      death: source('Foozle_2DC0021_Lucifer_Skeleton_King_Pixel_Art', 'SkeletonKingLeftDeath.png',
        'Skeleton King authored death'),
    },
  },
  {
    output: 'cc0-boss-archmagus',
    motions: {
      // This pack has no dedicated idle strip. Hold its authored landing end-pose rather
      // than inventing or redrawing an idle animation.
      idle: source('Foozle_2DC0010_Lucifer_Necromancer_Pixel_Art', 'NecromancerLeftLand.png',
        'Necromancer authored landing end-pose', 'hold-last'),
      move: source('Foozle_2DC0010_Lucifer_Necromancer_Pixel_Art', 'NecromancerLeftRun.png',
        'Necromancer authored run'),
      attack: source('Foozle_2DC0010_Lucifer_Necromancer_Pixel_Art', 'NecromancerLeftAttack01.png',
        'Necromancer authored attack'),
      hit: source('Foozle_2DC0010_Lucifer_Necromancer_Pixel_Art', 'NecromancerLeftHurt.png',
        'Necromancer authored hurt'),
      death: source('Foozle_2DC0010_Lucifer_Necromancer_Pixel_Art', 'NecromancerLeftDeath.png',
        'Necromancer authored death'),
    },
  },
  {
    output: 'cc0-boss-belzar-beast',
    motions: {
      idle: source('Foozle_2DC0016_Lucifer_Goblin_Beast_Pixel_Art', 'GoblinBeastLeftIdle.png',
        'Goblin Beast authored idle'),
      move: source('Foozle_2DC0016_Lucifer_Goblin_Beast_Pixel_Art', 'GoblinBeastLeftWalk.png',
        'Goblin Beast authored walk'),
      attack: source('Foozle_2DC0016_Lucifer_Goblin_Beast_Pixel_Art', 'GoblinBeastLeftAttack01.png',
        'Goblin Beast authored attack'),
      hit: source('Foozle_2DC0016_Lucifer_Goblin_Beast_Pixel_Art', 'GoblinBeastLeftHurt.png',
        'Goblin Beast authored hurt'),
      death: source('Foozle_2DC0016_Lucifer_Goblin_Beast_Pixel_Art', 'GoblinBeastLeftDeath.png',
        'Goblin Beast authored death'),
    },
  },
];

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const assert = (ok, message) => {
  if (!ok) throw new Error(`[foozle-boss-source-reference] ${message}`);
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
  throw new Error(`[foozle-boss-source-reference] ${entry.label} download failed: ${String(lastError)}`);
}

function cellHasAlpha(sheet, cell, index) {
  const sourceX = index * cell;
  for (let y = 0; y < cell; y += 1) {
    const rowStart = (y * sheet.width + sourceX) * 4;
    for (let x = 0; x < cell; x += 1) {
      if (sheet.data[rowStart + x * 4 + 3] !== 0) return true;
    }
  }
  return false;
}

function sampleFour(indexes, entry) {
  assert(indexes.length > 0, `${entry.label} has no visible frames`);
  if (entry.sample === 'hold-last') {
    return Array.from({ length: 4 }, () => indexes[indexes.length - 1]);
  }
  return Array.from({ length: 4 }, (_, i) => indexes[Math.round((indexes.length - 1) * i / 3)]);
}

function composeNormalizedHorizontalStrip(sheet, entry) {
  const cell = sheet.height;
  assert(cell > 0 && cell <= TARGET_CELL, `${entry.label}: unsupported ${cell}px cell`);
  assert(sheet.width % cell === 0,
    `${entry.label}: expected a horizontal square-cell strip, got ${sheet.width}x${sheet.height}`);

  const columns = sheet.width / cell;
  const visible = Array.from({ length: columns }, (_, index) => index)
    .filter((index) => cellHasAlpha(sheet, cell, index));
  const frames = sampleFour(visible, entry);

  const scale = Math.max(1, Math.floor(TARGET_CELL / cell));
  const drawSize = cell * scale;
  const offset = Math.floor((TARGET_CELL - drawSize) / 2);
  const out = Buffer.alloc(TARGET_CELL * frames.length * TARGET_CELL * 4);

  frames.forEach((index, frame) => {
    for (let y = 0; y < cell; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const sourceIndex = (y * sheet.width + index * cell + x) * 4;
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
  const bytes = composeNormalizedHorizontalStrip(sheet, entry);
  const target = resolve(outputRoot, folder, `${motion}.png`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

for (const family of FAMILIES) {
  await rm(resolve(outputRoot, family.output), { recursive: true, force: true });
  for (const [motion, entry] of Object.entries(family.motions)) {
    await writeMotion(family.output, motion, entry);
  }
}
