import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/series-three-s');
const MIRROR_REVISION = 'ffe7111bf94a0aa2fc5f0505a618c8a3a335a4d3';
const RAW_ROOT = `https://raw.githubusercontent.com/Clique33/Gamelab-Cipher-Labs/${MIRROR_REVISION}/GameCore/Sprites`;
const CELL = 128;

// Foozle Sci-fi Lab Droids Pack 1 is CC0 and contains three separately authored droids.
// Canonical source/license: https://foozlecc.itch.io/sci-fi-lab-droids
// Pinned public mirror above is used only as a deterministic byte source for builds.
const CHARACTERS = [
  {
    slug: 'k17',
    folder: 'Droid02',
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
    folder: 'Droid01',
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
    folder: 'Droid03',
    files: {
      idle: 'Droid03Idle.png',
      move: 'Droid3Move.png',
      attack: 'Droid03Attack.png',
      hit: 'Droid03Hurt.png',
      death: 'Droid03Death.png',
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

function normalizeStrip(sheet, label) {
  assert(sheet.height === CELL, `${label} height changed: expected ${CELL}, got ${sheet.height}`);
  assert(sheet.width % CELL === 0, `${label} width is not a ${CELL}px strip: ${sheet.width}`);
  const frameCount = sheet.width / CELL;
  const indexes = sampleFour(frameCount);
  const out = Buffer.alloc(CELL * indexes.length * CELL * 4);
  indexes.forEach((sourceFrame, targetFrame) => {
    for (let y = 0; y < CELL; y += 1) {
      const sourceStart = (y * sheet.width + sourceFrame * CELL) * 4;
      const targetStart = (y * CELL * indexes.length + targetFrame * CELL) * 4;
      sheet.data.copy(out, targetStart, sourceStart, sourceStart + CELL * 4);
    }
  });
  return encodePng(CELL * indexes.length, CELL, out);
}

async function writeCharacter(character) {
  for (const [motion, filename] of Object.entries(character.files)) {
    const url = `${RAW_ROOT}/${character.folder}/${filename}`;
    const label = `${character.slug} ${motion}`;
    const sheet = decodePng(await fetchBytes(url, label), label);
    const target = resolve(outputRoot, character.slug, `${motion}.png`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, normalizeStrip(sheet, label));
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
for (const character of CHARACTERS) await writeCharacter(character);

console.log('[series-three-s-art] vendored dedicated CC0 droids for K-17, Arc Railer, and RX-Omega');
