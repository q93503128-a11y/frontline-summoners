import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/lower-rarity');
const ASSET_REVISION = 'e93aa129978daafda85f3c907eebc8f1807ec43f';
const API_ROOT = 'https://api.github.com/repos/series-ai/jam-ready-assets/contents';
const TARGET_CELL = 64;

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');
const apiUrl = (path) => `${API_ROOT}/${encodePath(path)}?ref=${ASSET_REVISION}`;
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const A_FORMS = [
  // Glass Keeper: rigid/reflective silhouettes progress from compact alien to walking robot to circuit automaton.
  ['cc0-glass-keeper-f1', { collection: 'grafxkid-sprite-pack-4/2D/platformer', prefix: '2 - Martian_Red_', label: 'GrafxKid Martian Red' }],
  ['cc0-glass-keeper-f2', { collection: 'grafxkid-sprite-pack-4/2D/platformer', prefix: '5 - Robot_Walky_', label: 'GrafxKid Robot Walky' }],
  ['cc0-glass-keeper-f3', { collection: 'grafxkid-sprite-pack-4/2D/platformer', prefix: '9 - Mr._Circuit_', label: 'GrafxKid Mr Circuit' }],

  // Bonedrum: deliberately spindly, crawling and infernal finished source creatures.
  ['cc0-bonedrum-f1', { collection: 'grafxkid-sprite-pack-4/2D/platformer', prefix: '3 - Hermie_', label: 'GrafxKid Hermie' }],
  ['cc0-bonedrum-f2', { collection: 'grafxkid-sprite-pack-4/2D/platformer', prefix: '8 - Roach_', label: 'GrafxKid Roach' }],
  ['cc0-bonedrum-f3', { collection: 'grafxkid-sprite-pack-1/2D/platformer/5 - Devo the Devil', label: 'GrafxKid Devo the Devil' }],

  // Paper Dragon: three authored airborne silhouettes; no recolour or assistant-authored wings.
  ['cc0-paper-dragon-f1', { collection: 'grafxkid-sprite-pack-4/2D/platformer', prefix: '4 - Ballooney_', label: 'GrafxKid Ballooney' }],
  ['cc0-paper-dragon-f2', { collection: 'grafxkid-sprite-pack-4/2D/platformer', prefix: '7 - Orchid_Owl_', label: 'GrafxKid Orchid Owl' }],
  ['cc0-paper-dragon-f3', { collection: 'grafxkid-sprite-pack-1/2D/platformer/8 - Chi Chi the Bird', label: 'GrafxKid Chi Chi the Bird' }],

  // Meteor Cart: increasingly massive rolling / round / block-heavy silhouettes.
  ['cc0-meteor-cart-f1', { collection: 'grafxkid-sprite-pack-1/2D/platformer/6 - Rolling Nero', label: 'GrafxKid Rolling Nero' }],
  ['cc0-meteor-cart-f2', { collection: 'grafxkid-sprite-pack-2/2D/platformer/2 - Mr. Mochi', label: 'GrafxKid Mr Mochi' }],
  ['cc0-meteor-cart-f3', { collection: 'grafxkid-sprite-pack-1/2D/platformer/13 - Blocky Bub', label: 'GrafxKid Blocky Bub' }],

  // Mirror Guide: three distinct guide-scale finished characters, preserving readable upright silhouettes.
  ['cc0-mirror-guide-f1', { collection: 'grafxkid-sprite-pack-1/2D/platformer/1 - Mr. Man', label: 'GrafxKid Mr Man' }],
  ['cc0-mirror-guide-f2', { collection: 'grafxkid-sprite-pack-4/2D/platformer', prefix: '1 - Agent_Mike_', label: 'GrafxKid Agent Mike' }],
  ['cc0-mirror-guide-f3', { collection: 'grafxkid-sprite-pack-3/2D/platformer/1 - Gum Bot', label: 'GrafxKid Gum Bot' }],
];

const collectionCache = new Map();
const pngCache = new Map();

async function fetchJson(url, label, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'frontline-summoners-build/1.0',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`[a-common-art] ${label} listing failed: ${String(lastError)}`);
}

async function fetchPng(url, label, attempts = 3) {
  const cached = pngCache.get(url);
  if (cached) return cached;

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
      const decoded = decodePng(Buffer.from(await response.arrayBuffer()), label);
      pngCache.set(url, decoded);
      return decoded;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`[a-common-art] ${label} download failed: ${String(lastError)}`);
}

function assert(ok, message) {
  if (!ok) throw new Error(`[a-common-art] ${message}`);
}

function dimensionsFromName(name) {
  const match = name.match(/\((\d+)\s*x\s*(\d+)\)\.png$/i);
  return match ? [Number(match[1]), Number(match[2])] : undefined;
}

async function listSourceFiles(spec) {
  let listing = collectionCache.get(spec.collection);
  if (!listing) {
    listing = await fetchJson(apiUrl(spec.collection), spec.label);
    assert(Array.isArray(listing), `${spec.label} did not resolve to a file collection`);
    collectionCache.set(spec.collection, listing);
  }

  const files = listing
    .filter((entry) => entry.type === 'file' && typeof entry.name === 'string' && entry.name.toLowerCase().endsWith('.png'))
    .filter((entry) => !spec.prefix || entry.name.startsWith(spec.prefix))
    .map((entry) => {
      const dimensions = dimensionsFromName(entry.name);
      return dimensions && entry.download_url
        ? { name: entry.name, url: entry.download_url, cellWidth: dimensions[0], cellHeight: dimensions[1] }
        : undefined;
    })
    .filter(Boolean);

  assert(files.length > 0, `${spec.label} has no discoverable PNG motion sheets`);
  return files;
}

function normalizedName(file) {
  return file.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function pick(files, keywords, fallback) {
  for (const keyword of keywords) {
    const found = files.find((file) => normalizedName(file).includes(keyword));
    if (found) return found;
  }
  return fallback ?? files[0];
}

function chooseMotions(files) {
  const idle = pick(files, [' idle ', ' standing ', ' floating ', ' hiding ', ' pose '], files[0]);
  const move = pick(files, [' running ', ' walking ', ' movement ', ' flying ', ' crawling ', ' rolling ', ' hopping ', ' leaping '], idle);
  const attack = pick(files, [' attack ', ' shooting ', ' projectile ', ' punching ', ' punch ', ' pushing ', ' throw ', ' claw ', ' pinch ', ' jump ', ' peek '], move);
  const hit = pick(files, [' hurt ', ' damage ', ' falling '], idle);
  const death = pick(files, [' death ', ' dead ', ' sleeping ', ' falling ', ' burnt ', ' hurt '], hit);
  return { idle, move, attack, hit, death };
}

function cellHasAlpha(sheet, cellWidth, cellHeight, index) {
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

function composeNormalizedStrip(sheet, cellWidth, cellHeight, indexes) {
  assert(sheet.width % cellWidth === 0 && sheet.height % cellHeight === 0,
    `invalid ${cellWidth}x${cellHeight} grid for ${sheet.width}x${sheet.height}`);
  const columns = sheet.width / cellWidth;
  const rows = sheet.height / cellHeight;
  const scale = Math.floor(Math.min(TARGET_CELL / cellWidth, TARGET_CELL / cellHeight));
  assert(scale >= 1, `source ${cellWidth}x${cellHeight} exceeds ${TARGET_CELL}px target`);
  const drawWidth = cellWidth * scale;
  const drawHeight = cellHeight * scale;
  const offsetX = Math.floor((TARGET_CELL - drawWidth) / 2);
  const offsetY = Math.floor((TARGET_CELL - drawHeight) / 2);
  const out = Buffer.alloc(TARGET_CELL * indexes.length * TARGET_CELL * 4);

  indexes.forEach((index, frame) => {
    assert(index >= 0 && index < columns * rows, `frame ${index} outside ${columns}x${rows} grid`);
    const sourceColumn = index % columns;
    const sourceRow = Math.floor(index / columns);
    for (let y = 0; y < cellHeight; y += 1) {
      for (let x = 0; x < cellWidth; x += 1) {
        const sourceIndex = (((sourceRow * cellHeight) + y) * sheet.width + sourceColumn * cellWidth + x) * 4;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const targetX = frame * TARGET_CELL + offsetX + x * scale + dx;
            const targetY = offsetY + y * scale + dy;
            const targetIndex = (targetY * TARGET_CELL * indexes.length + targetX) * 4;
            sheet.data.copy(out, targetIndex, sourceIndex, sourceIndex + 4);
          }
        }
      }
    }
  });

  return encodePng(TARGET_CELL * indexes.length, TARGET_CELL, out);
}

async function writeMotion(folder, motion, file, label) {
  const sheet = await fetchPng(file.url, `${label} ${motion}`);
  assert(sheet.width % file.cellWidth === 0 && sheet.height % file.cellHeight === 0,
    `${label} ${motion} changed: expected ${file.cellWidth}x${file.cellHeight} grid, got ${sheet.width}x${sheet.height}`);
  const columns = sheet.width / file.cellWidth;
  const rows = sheet.height / file.cellHeight;
  const visible = Array.from({ length: columns * rows }, (_, index) => index)
    .filter((index) => cellHasAlpha(sheet, file.cellWidth, file.cellHeight, index));
  const bytes = composeNormalizedStrip(sheet, file.cellWidth, file.cellHeight, sampleFour(visible, `${label} ${motion}`));
  const target = resolve(outputRoot, folder, `${motion}.png`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

await mkdir(outputRoot, { recursive: true });
for (const [folder, spec] of A_FORMS) {
  const files = await listSourceFiles(spec);
  const motions = chooseMotions(files);
  for (const [motion, file] of Object.entries(motions)) {
    await writeMotion(folder, motion, file, spec.label);
  }
}

console.log(`[a-common-art] vendored ${A_FORMS.length} CC0 GrafxKid A-rarity form families`);
