import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/lower-rarity');
const ASSET_REVISION = 'e93aa129978daafda85f3c907eebc8f1807ec43f';
const JAM_BASE = `https://github.com/series-ai/jam-ready-assets/raw/${ASSET_REVISION}`;
const jamUrl = (path) => `${JAM_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
const TARGET_CELL = 64;

const source = (path, cellWidth, cellHeight, label) => ({ url: jamUrl(path), cellWidth, cellHeight, label });

// GrafxKid packs are CC0 in the pinned jam-ready-assets revision. Each evolution form uses a
// finished source character; this script only crops and nearest-neighbour normalizes frames.
const SOURCES = {
  onionIdle: source('grafxkid-sprite-pack-2/2D/platformer/1 - Onion Lad/Idle (16 x 16).png', 16, 16, 'GrafxKid Onion Lad idle'),
  onionMove: source('grafxkid-sprite-pack-2/2D/platformer/1 - Onion Lad/Run_&_Jump (16 x 16).png', 16, 16, 'GrafxKid Onion Lad move'),
  onionAttack: source('grafxkid-sprite-pack-2/2D/platformer/1 - Onion Lad/Standing_&_Jump_Punching (16 x 16).png', 16, 16, 'GrafxKid Onion Lad attack'),
  onionHurt: source('grafxkid-sprite-pack-2/2D/platformer/1 - Onion Lad/Hurt (16 x 16).png', 16, 16, 'GrafxKid Onion Lad hurt'),
  daikonMove: source('grafxkid-sprite-pack-2/2D/platformer/5 - Daikon/Hopping (16 x 32).png', 16, 32, 'GrafxKid Daikon hopping'),
  daikonHurt: source('grafxkid-sprite-pack-2/2D/platformer/5 - Daikon/Hurt (16 x 32).png', 16, 32, 'GrafxKid Daikon hurt'),
  cherryMove: source('grafxkid-sprite-pack-2/2D/platformer/7 - Rocket Cherry/Hopping (16 x 32).png', 16, 32, 'GrafxKid Rocket Cherry hopping'),
  cherryAttack: source('grafxkid-sprite-pack-2/2D/platformer/7 - Rocket Cherry/Flying (16 x 32).png', 16, 32, 'GrafxKid Rocket Cherry flying'),
  cherryHurt: source('grafxkid-sprite-pack-2/2D/platformer/7 - Rocket Cherry/Hurt (16 x 32).png', 16, 32, 'GrafxKid Rocket Cherry hurt'),
  cherryDeath: source('grafxkid-sprite-pack-2/2D/platformer/7 - Rocket Cherry/Hurt_Falling (16 x 32).png', 16, 32, 'GrafxKid Rocket Cherry falling'),

  seraIdle: source('grafxkid-sprite-pack-1/2D/platformer/3 - Princess Sera/Idle (16 x 32).png', 16, 32, 'GrafxKid Princess Sera idle'),
  seraMove: source('grafxkid-sprite-pack-1/2D/platformer/3 - Princess Sera/Running (16 x 32).png', 16, 32, 'GrafxKid Princess Sera run'),
  seraAttack: source('grafxkid-sprite-pack-1/2D/platformer/3 - Princess Sera/Shooting_Projectile_Standing (16 x 32).png', 16, 32, 'GrafxKid Princess Sera projectile'),
  seraHurt: source('grafxkid-sprite-pack-1/2D/platformer/3 - Princess Sera/Hurt (16 x 32).png', 16, 32, 'GrafxKid Princess Sera hurt'),
  seraDeath: source('grafxkid-sprite-pack-1/2D/platformer/3 - Princess Sera/Falling (16 x 32).png', 16, 32, 'GrafxKid Princess Sera falling'),
  tommyIdle: source('grafxkid-sprite-pack-3/2D/platformer/4 - Tommy/Idle_Poses (32 x 32).png', 32, 32, 'GrafxKid Tommy idle'),
  tommyMove: source('grafxkid-sprite-pack-3/2D/platformer/4 - Tommy/Running (32 x 32).png', 32, 32, 'GrafxKid Tommy run'),
  tommyAttack: source('grafxkid-sprite-pack-3/2D/platformer/4 - Tommy/Throw_Object (32 x 32).png', 32, 32, 'GrafxKid Tommy throw'),
  tommyHurt: source('grafxkid-sprite-pack-3/2D/platformer/4 - Tommy/Hurt (32 x 32).png', 32, 32, 'GrafxKid Tommy hurt'),
  tommyDeath: source('grafxkid-sprite-pack-3/2D/platformer/4 - Tommy/Sleeping (32 x 32).png', 32, 32, 'GrafxKid Tommy down'),
  geraltIdle: source('grafxkid-sprite-pack-3/2D/platformer/5 - Geralt/Idle (32 x 32).png', 32, 32, 'GrafxKid Geralt idle'),
  geraltMove: source('grafxkid-sprite-pack-3/2D/platformer/5 - Geralt/Running (32 x 32).png', 32, 32, 'GrafxKid Geralt run'),
  geraltAttack: source('grafxkid-sprite-pack-3/2D/platformer/5 - Geralt/Pushing_Object (32 x 32).png', 32, 32, 'GrafxKid Geralt heavy cast'),
  geraltHurt: source('grafxkid-sprite-pack-3/2D/platformer/5 - Geralt/Hurt (32 x 32).png', 32, 32, 'GrafxKid Geralt hurt'),
  geraltDeath: source('grafxkid-sprite-pack-3/2D/platformer/5 - Geralt/Sleeping (32 x 32).png', 32, 32, 'GrafxKid Geralt down'),

  blankeyFloat: source('grafxkid-sprite-pack-4/2D/platformer/10 - Blankey_Floating (32 x 32).png', 32, 32, 'GrafxKid Blankey floating'),
  blankeyHurt: source('grafxkid-sprite-pack-4/2D/platformer/10 - Blankey_Hurt (32 x 32).png', 32, 32, 'GrafxKid Blankey hurt'),
  pumpkinIdle: source('grafxkid-sprite-pack-2/2D/platformer/4 - Robo Pumpkin/Standing (16 x 16).png', 16, 16, 'GrafxKid Robo Pumpkin idle'),
  pumpkinMove: source('grafxkid-sprite-pack-2/2D/platformer/4 - Robo Pumpkin/Walking (16 x 16).png', 16, 16, 'GrafxKid Robo Pumpkin walk'),
  pumpkinHurt: source('grafxkid-sprite-pack-2/2D/platformer/4 - Robo Pumpkin/Hurt (16 x 16).png', 16, 16, 'GrafxKid Robo Pumpkin hurt'),
  hearseMove: source('grafxkid-sprite-pack-2/2D/platformer/8 - Comrade Cheese Puff/Tank_Movement (32 x 32).png', 32, 32, 'GrafxKid Cheese Puff tank'),
  hearseHurt: source('grafxkid-sprite-pack-2/2D/platformer/8 - Comrade Cheese Puff/Hurt (16 x 16).png', 16, 16, 'GrafxKid Cheese Puff hurt'),

  bushIdle: source('grafxkid-sprite-pack-1/2D/platformer/4 - Bushly/Idle (16 x 16).png', 16, 16, 'GrafxKid Bushly idle'),
  bushMove: source('grafxkid-sprite-pack-1/2D/platformer/4 - Bushly/Running (16 x 16).png', 16, 16, 'GrafxKid Bushly run'),
  bushAttack: source('grafxkid-sprite-pack-1/2D/platformer/4 - Bushly/Jumping (16 x 16).png', 16, 16, 'GrafxKid Bushly attack'),
  bushHurt: source('grafxkid-sprite-pack-1/2D/platformer/4 - Bushly/Hurt (16 x 16).png', 16, 16, 'GrafxKid Bushly hurt'),
  bushDeath: source('grafxkid-sprite-pack-1/2D/platformer/4 - Bushly/Falling (16 x 16).png', 16, 16, 'GrafxKid Bushly falling'),
  twigIdle: source('grafxkid-sprite-pack-3/2D/platformer/2 - Twiggy/Idle (32 x 32).png', 32, 32, 'GrafxKid Twiggy idle'),
  twigMove: source('grafxkid-sprite-pack-3/2D/platformer/2 - Twiggy/Running (32 x 32).png', 32, 32, 'GrafxKid Twiggy run'),
  twigAttack: source('grafxkid-sprite-pack-3/2D/platformer/2 - Twiggy/Touch_Ground (32 x 32).png', 32, 32, 'GrafxKid Twiggy slam'),
  twigHurt: source('grafxkid-sprite-pack-3/2D/platformer/2 - Twiggy/Hurt_&_Recovery (32 x 32).png', 32, 32, 'GrafxKid Twiggy hurt'),
  twigDeath: source('grafxkid-sprite-pack-3/2D/platformer/2 - Twiggy/Sleeping_&_Wakeup (32 x 32).png', 32, 32, 'GrafxKid Twiggy down'),
  lumpyIdle: source('grafxkid-sprite-pack-4/2D/platformer/6 - Jumpy_Lumpy_Idle (32 x 32).png', 32, 32, 'GrafxKid Jumpy Lumpy idle'),
  lumpyMove: source('grafxkid-sprite-pack-4/2D/platformer/6 - Jumpy_Lumpy_Leaping_&_Falling (32 x 32).png', 32, 32, 'GrafxKid Jumpy Lumpy leap'),
  lumpyHurt: source('grafxkid-sprite-pack-4/2D/platformer/6 - Jumpy_Lumpy_Hurt (32 x 32).png', 32, 32, 'GrafxKid Jumpy Lumpy hurt'),
};

const FORMS = [
  ['cc0-turnip-rider-f1', { idle: 'onionIdle', move: 'onionMove', attack: 'onionAttack', hit: 'onionHurt', death: 'onionHurt' }],
  ['cc0-turnip-rider-f2', { idle: 'daikonMove', move: 'daikonMove', attack: 'daikonMove', hit: 'daikonHurt', death: 'daikonHurt' }],
  ['cc0-turnip-rider-f3', { idle: 'cherryMove', move: 'cherryMove', attack: 'cherryAttack', hit: 'cherryHurt', death: 'cherryDeath' }],
  ['cc0-slinger-f1', { idle: 'seraIdle', move: 'seraMove', attack: 'seraAttack', hit: 'seraHurt', death: 'seraDeath' }],
  ['cc0-slinger-f2', { idle: 'tommyIdle', move: 'tommyMove', attack: 'tommyAttack', hit: 'tommyHurt', death: 'tommyDeath' }],
  ['cc0-slinger-f3', { idle: 'geraltIdle', move: 'geraltMove', attack: 'geraltAttack', hit: 'geraltHurt', death: 'geraltDeath' }],
  ['cc0-coffin-merchant-f1', { idle: 'blankeyFloat', move: 'blankeyFloat', attack: 'blankeyFloat', hit: 'blankeyHurt', death: 'blankeyHurt' }],
  ['cc0-coffin-merchant-f2', { idle: 'pumpkinIdle', move: 'pumpkinMove', attack: 'pumpkinMove', hit: 'pumpkinHurt', death: 'pumpkinHurt' }],
  ['cc0-coffin-merchant-f3', { idle: 'hearseMove', move: 'hearseMove', attack: 'hearseMove', hit: 'hearseHurt', death: 'hearseHurt' }],
  ['cc0-moss-golem-f1', { idle: 'bushIdle', move: 'bushMove', attack: 'bushAttack', hit: 'bushHurt', death: 'bushDeath' }],
  ['cc0-moss-golem-f2', { idle: 'twigIdle', move: 'twigMove', attack: 'twigAttack', hit: 'twigHurt', death: 'twigDeath' }],
  ['cc0-moss-golem-f3', { idle: 'lumpyIdle', move: 'lumpyMove', attack: 'lumpyMove', hit: 'lumpyHurt', death: 'lumpyHurt' }],
];

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

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
  throw new Error(`[remaining-common-art] ${entry.label} download failed: ${String(lastError)}`);
}

function assert(ok, message) {
  if (!ok) throw new Error(`[remaining-common-art] ${message}`);
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
        const sourceIndex = (((sourceRow * cellHeight + y) * sheet.width) + sourceColumn * cellWidth + x) * 4;
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

async function writeMotion(folder, motion, sourceKey) {
  const entry = SOURCES[sourceKey];
  assert(entry, `unknown source key ${sourceKey}`);
  const sheet = await fetchPng(entry);
  assert(sheet.width % entry.cellWidth === 0 && sheet.height % entry.cellHeight === 0,
    `${entry.label} changed: expected ${entry.cellWidth}x${entry.cellHeight} grid, got ${sheet.width}x${sheet.height}`);
  const columns = sheet.width / entry.cellWidth;
  const rows = sheet.height / entry.cellHeight;
  const visible = Array.from({ length: columns * rows }, (_, index) => index)
    .filter((index) => cellHasAlpha(sheet, entry.cellWidth, entry.cellHeight, index));
  const bytes = composeNormalizedStrip(sheet, entry.cellWidth, entry.cellHeight, sampleFour(visible, entry.label));
  const target = resolve(outputRoot, folder, `${motion}.png`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

await mkdir(outputRoot, { recursive: true });
for (const [folder, motions] of FORMS) {
  for (const [motion, sourceKey] of Object.entries(motions)) {
    await writeMotion(folder, motion, sourceKey);
  }
}

console.log(`[remaining-common-art] vendored ${FORMS.length} CC0 GrafxKid form families`);
