import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/boss-source-reference');
const SOURCE_REVISION = '9891cd33de14dab668e085599a2fe30463c7edcc';
const RAW_BASE = `https://raw.githubusercontent.com/WithinAmnesia/ARPG/${SOURCE_REVISION}`;
const rawUrl = (path) => `${RAW_BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
const TARGET_CELL = 128;
const ARCHIVE = 'C.C.0. Assets Archive/Art/FoozleCC/Lucifer';

const MECHA_MIRROR_REVISION = '153c7e48287eb37bf0ff3fcbe4457063b723c49c';
const MECHA_ARCHIVE_NAME = 'Foozle_2DC0008_Sci_Fi_Lab_Mecha_Boss_Plus_Drone.zip';
const MECHA_ARCHIVE_SHA256 = 'ad755ac11d83a99ecf2a14ef8fbcf1168abccb60f1be9a5cb129afa01fe1456d';
const MECHA_ARCHIVE_URL =
  `https://raw.githubusercontent.com/Devs-Noobs/The-Escape/${MECHA_MIRROR_REVISION}/${MECHA_ARCHIVE_NAME}`;

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
  throw new Error(`[foozle-boss-source-reference] ${label} download failed: ${String(lastError)}`);
}

async function fetchPng(entry) {
  return decodePng(await fetchBytes(entry.url, entry.label), entry.label);
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

function findEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.length - 0xffff - 22);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('[foozle-boss-source-reference] moving-throne archive has no ZIP central directory');
}

function readZipEntries(bytes) {
  const end = findEndOfCentralDirectory(bytes);
  const count = bytes.readUInt16LE(end + 10);
  let cursor = bytes.readUInt32LE(end + 16);
  const entries = [];

  for (let i = 0; i < count; i += 1) {
    assert(bytes.readUInt32LE(cursor) === 0x02014b50, `bad ZIP central entry ${i}`);
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');

    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function extractZipEntry(zip, entry) {
  const offset = entry.localOffset;
  assert(zip.readUInt32LE(offset) === 0x04034b50, `bad ZIP local header for ${entry.name}`);
  const nameLength = zip.readUInt16LE(offset + 26);
  const extraLength = zip.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = zip.subarray(start, start + entry.compressedSize);

  let output;
  if (entry.method === 0) output = Buffer.from(compressed);
  else if (entry.method === 8) output = inflateRawSync(compressed);
  else throw new Error(`[foozle-boss-source-reference] unsupported ZIP method ${entry.method} for ${entry.name}`);

  assert(output.length === entry.uncompressedSize,
    `${entry.name}: ZIP size mismatch ${output.length} != ${entry.uncompressedSize}`);
  return output;
}

function pickMechaEntry(entries, motion, patterns) {
  const pngs = entries.filter((entry) => {
    const lower = entry.name.toLowerCase();
    const base = lower.split('/').pop() ?? lower;
    return lower.endsWith('.png') && lower.includes('mecha') && !base.includes('drone') &&
      !lower.includes('/exploding_drone/');
  });

  for (const pattern of patterns) {
    const matches = pngs.filter((entry) => pattern.test(entry.name));
    if (matches.length > 0) {
      matches.sort((a, b) => a.name.localeCompare(b.name));
      return matches[0];
    }
  }
  throw new Error(`[foozle-boss-source-reference] moving-throne ${motion}: no authored Mecha PNG found`);
}

async function writeMovingThrone() {
  const zip = await fetchBytes(MECHA_ARCHIVE_URL, 'Foozle Sci-Fi Labs Mecha Boss archive');
  const digest = createHash('sha256').update(zip).digest('hex');
  assert(digest === MECHA_ARCHIVE_SHA256,
    `moving-throne archive SHA-256 mismatch: ${digest}`);

  const entries = readZipEntries(zip);
  const readmeEntry = entries.find((entry) => /readme\.txt$/i.test(entry.name));
  assert(readmeEntry, 'moving-throne archive is missing its Readme.txt');
  const readme = extractZipEntry(zip, readmeEntry).toString('utf8');
  assert(/creative commons zero|cc0/i.test(readme),
    'moving-throne source Readme does not declare CC0');

  const selected = {
    idle: pickMechaEntry(entries, 'idle', [/idle/i]),
    move: pickMechaEntry(entries, 'move', [/run/i]),
    attack: pickMechaEntry(entries, 'attack', [/heavy.*attack|attack.*heavy/i, /attack/i]),
    hit: pickMechaEntry(entries, 'hit', [/hurt/i, /hit/i]),
    death: pickMechaEntry(entries, 'death', [/death/i, /dead/i]),
  };

  const folder = 'cc0-boss-moving-throne';
  await rm(resolve(outputRoot, folder), { recursive: true, force: true });

  for (const [motion, entry] of Object.entries(selected)) {
    const sheet = decodePng(extractZipEntry(zip, entry), `Moving Throne ${motion}: ${entry.name}`);
    const bytes = composeNormalizedHorizontalStrip(sheet, {
      label: `Moving Throne authored ${motion}: ${entry.name}`,
      sample: 'spread',
    });
    const target = resolve(outputRoot, folder, `${motion}.png`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}

for (const family of FAMILIES) {
  await rm(resolve(outputRoot, family.output), { recursive: true, force: true });
  for (const [motion, entry] of Object.entries(family.motions)) {
    await writeMotion(family.output, motion, entry);
  }
}

await writeMovingThrone();
