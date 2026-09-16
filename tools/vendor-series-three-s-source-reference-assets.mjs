import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/series-three-s');
const DROID_MIRROR_REVISION = 'ffe7111bf94a0aa2fc5f0505a618c8a3a335a4d3';
const DROID_RAW_ROOT = `https://raw.githubusercontent.com/Clique33/Gamelab-Cipher-Labs/${DROID_MIRROR_REVISION}/GameCore/Sprites`;
const CYBORG_MIRROR_REVISION = '96e2572cc356c16628a1bf49cc4cf129ce99cb7c';
const CYBORG_RAW_ROOT = `https://raw.githubusercontent.com/Tyger8540/substance-zero/${CYBORG_MIRROR_REVISION}/substance-zero/sprites/bosses/World2_cyborg`;
const TARGET_CELL = 128;

const encodedUrl = (rootUrl, path) => `${rootUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;

// Foozle Sci-fi Lab Droids Pack 1 and Sci-fi Lab Cyborg are CC0 authored character packs.
// Canonical source/licenses:
//   https://foozlecc.itch.io/sci-fi-lab-droids
//   https://foozlecc.itch.io/sci-fi-lab-cyborg
// Pinned public mirrors are deterministic byte sources only. We select/crop existing frames and
// nearest-neighbour normalize their canvas; no recolour, drawing, or runtime kitbashing occurs.
const CHARACTERS = [
  {
    slug: 'k17',
    root: DROID_RAW_ROOT,
    folder: 'Droid02',
    sourceCell: 128,
    files: {
      idle: 'Droid02Idle.png',
      move: 'Droid02Move.png',
      attack: 'Droid02Attack.png',
      hit: 'Droid02Hurt.png',
      death: 'Droid02Death.png',
    },
  },
  {
    slug: 'arc-railer',
    root: DROID_RAW_ROOT,
    folder: 'Droid01',
    sourceCell: 128,
    files: {
      idle: 'Droid01Idle.png',
      move: 'Droid01Move.png',
      attack: 'Droid01Shoot.png',
      hit: 'Droid01Hurt.png',
      death: 'Droid01Death.png',
    },
  },
  {
    slug: 'rxomega',
    root: DROID_RAW_ROOT,
    folder: 'Droid03',
    sourceCell: 128,
    files: {
      idle: 'Droid03Idle.png',
      move: 'Droid3Move.png',
      attack: 'Droid03Attack.png',
      hit: 'Droid03Hurt.png',
      death: 'Droid03Death.png',
    },
  },
  {
    slug: 'blade-hound',
    root: CYBORG_RAW_ROOT,
    folder: '',
    sourceCell: 32,
    files: {
      idle: 'cyber prisoner idle-Sheet.png',
      move: 'cyber prisoner run cycle-Sheet.png',
      attack: 'cyber prisoner Light attack slash-Sheet.png',
      hit: 'cyber prisoner hurt-Sheet.png',
      death: 'cyber prisoner death-Sheet.png',
    },
  },
];

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
  throw new Error(`[series-three-s-art] ${label} download failed: ${String(lastError)}`);
}

function assert(ok, message) {
  if (!ok) throw new Error(`[series-three-s-art] ${message}`);
}

function sampleFour(frameCount) {
  assert(frameCount > 0, 'source strip has no frames');
  return Array.from({ length: 4 }, (_, index) => Math.round((frameCount - 1) * index / 3));
}

function normalizeStrip(sheet, label, sourceCell) {
  assert(sheet.height === sourceCell, `${label} height changed: expected ${sourceCell}, got ${sheet.height}`);
  assert(sheet.width % sourceCell === 0, `${label} width is not a ${sourceCell}px strip: ${sheet.width}`);
  const frameCount = sheet.width / sourceCell;
  const indexes = sampleFour(frameCount);
  const scale = Math.floor(TARGET_CELL / sourceCell);
  assert(scale >= 1 && sourceCell * scale <= TARGET_CELL,
    `${label} cannot normalize ${sourceCell}px cells into ${TARGET_CELL}px`);
  const drawSize = sourceCell * scale;
  const offset = Math.floor((TARGET_CELL - drawSize) / 2);
  const out = Buffer.alloc(TARGET_CELL * indexes.length * TARGET_CELL * 4);

  indexes.forEach((sourceFrame, targetFrame) => {
    for (let y = 0; y < sourceCell; y += 1) {
      for (let x = 0; x < sourceCell; x += 1) {
        const sourceIndex = (y * sheet.width + sourceFrame * sourceCell + x) * 4;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const targetX = targetFrame * TARGET_CELL + offset + x * scale + dx;
            const targetY = offset + y * scale + dy;
            const targetIndex = (targetY * TARGET_CELL * indexes.length + targetX) * 4;
            sheet.data.copy(out, targetIndex, sourceIndex, sourceIndex + 4);
          }
        }
      }
    }
  });
  return encodePng(TARGET_CELL * indexes.length, TARGET_CELL, out);
}

async function writeCharacter(character) {
  for (const [motion, filename] of Object.entries(character.files)) {
    const relative = character.folder ? `${character.folder}/${filename}` : filename;
    const url = encodedUrl(character.root, relative);
    const label = `${character.slug} ${motion}`;
    const sheet = decodePng(await fetchBytes(url, label), label);
    const target = resolve(outputRoot, character.slug, `${motion}.png`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, normalizeStrip(sheet, label, character.sourceCell));
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const character of CHARACTERS) await writeCharacter(character);

console.log('[series-three-s-art] vendored distinct CC0 source-reference art for K-17, Arc Railer, RX-Omega, and Blade Hound');
