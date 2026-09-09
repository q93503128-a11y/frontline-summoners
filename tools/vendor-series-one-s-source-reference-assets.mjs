import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/series-one-s-source-reference');
const TARGET = 128;
const FRAME_COUNT = 4;
const CONTENT = 116;

const LOST_CARD_REV = '8d1ee8fb358ab3ceab5aff31d068d0dcaaec954b';
const TOTORIA_REV = 'bf84490414e09eb0e1c27c4f4bc8e9bf5189a15c';
const RIENA_REV = 'f959776d9b2ef57bf6cdef696b72d2ae0ebfb443';
const MIREILLE_REV = '950515267f4d5b54b9738962c74672193f5e57a3';
const NERIA_REV = '703e4630abc01f2e3ed752fa93b776f84689c2af';

function rawGithub(repo, revision, path) {
  const encodedPath = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `https://raw.githubusercontent.com/${repo}/${revision}/${encodedPath}`;
}

const ELSIA_SHEET = rawGithub(
  'ThanakornMix/Lost_Card_RPG',
  LOST_CARD_REV,
  'graphics/Spearwoman/Spearwoman(lightning spear)-Sheet.png',
);
const ELSIA_RUN = rawGithub(
  'MasterSacid/Space-war',
  '0751279ed43f0776623b8eb9feb11baf533346ac',
  'animations/charachters/spearwoman/woman_run.png',
);
const TOTORIA_SHEET = rawGithub(
  'Yatchanek/Platformer',
  TOTORIA_REV,
  'graphics/spritesheets/Necromancer_creativekind-Sheet.png',
);

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function fetchBytes(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
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
  throw new Error(`asset download failed: ${url}; ${String(lastError)}`);
}

function crop(sheet, x0, y0, width, height) {
  if (x0 < 0 || y0 < 0 || x0 + width > sheet.width || y0 + height > sheet.height) {
    throw new Error(`source crop ${x0},${y0},${width},${height} exceeds ${sheet.width}x${sheet.height}`);
  }
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((y0 + y) * sheet.width + x0) * 4;
    sheet.data.copy(out, y * width * 4, sourceStart, sourceStart + width * 4);
  }
  return { width, height, data: out };
}

function alphaBounds(frame) {
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const alpha = frame.data[(y * frame.width + x) * 4 + 3];
      if (alpha < 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return { x: 0, y: 0, width: frame.width, height: frame.height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function normalizeFrame(frame) {
  const bounds = alphaBounds(frame);
  const scale = Math.min(CONTENT / bounds.width, CONTENT / bounds.height, 1);
  const out = Buffer.alloc(TARGET * TARGET * 4);
  const drawWidth = Math.max(1, Math.round(bounds.width * scale));
  const drawHeight = Math.max(1, Math.round(bounds.height * scale));
  const left = Math.floor((TARGET - drawWidth) / 2);
  const top = TARGET - 6 - drawHeight;

  for (let y = 0; y < drawHeight; y += 1) {
    const sy = bounds.y + Math.min(bounds.height - 1, Math.floor(y / scale));
    for (let x = 0; x < drawWidth; x += 1) {
      const sx = bounds.x + Math.min(bounds.width - 1, Math.floor(x / scale));
      const sourceIndex = (sy * frame.width + sx) * 4;
      const targetIndex = ((top + y) * TARGET + left + x) * 4;
      frame.data.copy(out, targetIndex, sourceIndex, sourceIndex + 4);
    }
  }
  return out;
}

function encodeStrip(frames) {
  if (frames.length !== FRAME_COUNT) throw new Error(`expected ${FRAME_COUNT} source frames, got ${frames.length}`);
  const pixels = Buffer.alloc(TARGET * FRAME_COUNT * TARGET * 4);
  for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
    const normalized = normalizeFrame(frames[frameIndex]);
    for (let y = 0; y < TARGET; y += 1) {
      const srcStart = y * TARGET * 4;
      const dstStart = (y * TARGET * FRAME_COUNT + frameIndex * TARGET) * 4;
      normalized.copy(pixels, dstStart, srcStart, srcStart + TARGET * 4);
    }
  }
  return encodePng(TARGET * FRAME_COUNT, TARGET, pixels);
}

async function writeStrip(relativePath, frames) {
  const target = resolve(outputRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  const bytes = encodeStrip(frames);
  await writeFile(target, bytes);
  console.log(`[s01-source] ${relativePath} ${TARGET * FRAME_COUNT}x${TARGET}`);
}

async function framesFromUrls(urls) {
  return Promise.all(urls.map(async (url) => decodePng(await fetchBytes(url), url)));
}

function numberedFrameUrls(repo, revision, basePath, stem) {
  return [1, 2, 3, 4].map((index) => rawGithub(repo, revision, `${basePath}/${stem}_${index}.png`));
}

async function writeChieritCharacter({ slug, repo, revision, basePath, folders }) {
  const common = {
    idle: numberedFrameUrls(repo, revision, `${basePath}/${folders.idle}`, folders.idleStem),
    run: numberedFrameUrls(repo, revision, `${basePath}/${folders.run}`, folders.runStem),
    hit: numberedFrameUrls(repo, revision, `${basePath}/${folders.hit}`, folders.hitStem),
    death: numberedFrameUrls(repo, revision, `${basePath}/${folders.death}`, folders.deathStem),
  };
  await writeStrip(`${slug}/idle.png`, await framesFromUrls(common.idle));
  await writeStrip(`${slug}/run.png`, await framesFromUrls(common.run));
  await writeStrip(`${slug}/hit.png`, await framesFromUrls(common.hit));
  await writeStrip(`${slug}/death.png`, await framesFromUrls(common.death));
  for (const [form, folder, stem] of [
    ['f1', folders.attack1, folders.attack1Stem],
    ['f2', folders.attack2, folders.attack2Stem],
    ['f3', folders.attack3, folders.attack3Stem],
  ]) {
    const urls = numberedFrameUrls(repo, revision, `${basePath}/${folder}`, stem);
    await writeStrip(`${slug}/attack-${form}.png`, await framesFromUrls(urls));
  }
}

async function writeElsia() {
  const sheet = decodePng(await fetchBytes(ELSIA_SHEET), ELSIA_SHEET);
  const row = (y, indices) => indices.map((index) => crop(sheet, index * 128, y, 128, 115));
  await writeStrip('elsia/idle.png', row(0, [0, 2, 4, 6]));

  const runSheet = decodePng(await fetchBytes(ELSIA_RUN), ELSIA_RUN);
  if (runSheet.width % 8 !== 0) throw new Error(`Elsia authored run strip no longer has 8 frames: ${runSheet.width}x${runSheet.height}`);
  const runFrameWidth = runSheet.width / 8;
  await writeStrip('elsia/run.png', [0, 2, 4, 6].map((index) => crop(runSheet, index * runFrameWidth, 0, runFrameWidth, runSheet.height)));

  await writeStrip('elsia/attack-f1.png', row(1380, [0, 1, 3, 5]));
  await writeStrip('elsia/attack-f2.png', row(1495, [0, 4, 8, 13]));
  await writeStrip('elsia/attack-f3.png', row(1725, [0, 7, 14, 21]));
  await writeStrip('elsia/hit.png', row(2645, [0, 1, 2, 3]));
  await writeStrip('elsia/death.png', row(2760, [0, 3, 6, 8]));
}

async function writeTotoria() {
  const sheet = decodePng(await fetchBytes(TOTORIA_SHEET), TOTORIA_SHEET);
  const SOURCE_FRAME = 128;
  const SOURCE_COLUMNS = 17;
  const SOURCE_ROWS = 7;
  if (sheet.width !== SOURCE_COLUMNS * SOURCE_FRAME || sheet.height !== SOURCE_ROWS * SOURCE_FRAME) {
    throw new Error(`Totoria source sheet layout changed: expected 2176x896, got ${sheet.width}x${sheet.height}`);
  }
  const row = (rowIndex, indices) => indices.map((index) => crop(
    sheet,
    index * SOURCE_FRAME,
    rowIndex * SOURCE_FRAME,
    SOURCE_FRAME,
    SOURCE_FRAME,
  ));

  await writeStrip('totoria/idle.png', row(0, [0, 2, 4, 6]));
  await writeStrip('totoria/run.png', row(1, [0, 2, 4, 6]));
  await writeStrip('totoria/attack-f1.png', row(2, [0, 4, 8, 12]));
  await writeStrip('totoria/attack-f2.png', row(3, [0, 4, 8, 12]));
  await writeStrip('totoria/attack-f3.png', row(4, [0, 5, 10, 16]));
  await writeStrip('totoria/hit.png', row(5, [0, 1, 3, 4]));
  await writeStrip('totoria/death.png', row(6, [0, 3, 6, 9]));
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

await writeElsia();
await writeTotoria();
await writeChieritCharacter({
  slug: 'riena',
  repo: 'Mathatou/Gamejam',
  revision: RIENA_REV,
  basePath: 'Elementals_water_priestess_FREE_v1.1/png',
  folders: {
    idle: '01_idle', idleStem: 'idle',
    run: '02_walk', runStem: 'walk',
    attack1: '07_1_atk', attack1Stem: '1_atk',
    attack2: '08_2_atk', attack2Stem: '2_atk',
    attack3: '09_3_atk', attack3Stem: '3_atk',
    hit: '13_take_hit', hitStem: 'take_hit',
    death: '14_death', deathStem: 'death',
  },
});
await writeChieritCharacter({
  slug: 'mireille',
  repo: 'DawnSouther/godot-demo',
  revision: MIREILLE_REV,
  basePath: '资源/Elementals_Leaf_ranger_Free_v1.0/animations/PNG',
  folders: {
    idle: 'idle', idleStem: 'idle',
    run: 'run', runStem: 'run',
    attack1: '1_atk', attack1Stem: '1_atk',
    attack2: '2_atk', attack2Stem: '2_atk',
    attack3: '3_atk', attack3Stem: '3_atk',
    hit: 'take_hit', hitStem: 'take_hit',
    death: 'death', deathStem: 'death',
  },
});
await writeChieritCharacter({
  slug: 'neria',
  repo: 'Mohammed2372/Elemental-Showdown',
  revision: NERIA_REV,
  basePath: 'elemental-showdown/Assets/Players/Elementals_metal_bladekeeper/PNG animations',
  folders: {
    idle: '01_idle', idleStem: '01_idle',
    run: '02_run', runStem: '02_run',
    attack1: '07_1_atk', attack1Stem: '07_1_atk',
    attack2: '08_2_atk', attack2Stem: '08_2_atk',
    attack3: '09_3_atk', attack3Stem: '09_3_atk',
    hit: '12_take_hit', hitStem: '12_take_hit',
    death: '13_death', deathStem: '13_death',
  },
});

await writeFile(resolve(outputRoot, 'ATTRIBUTION.txt'), `Series 1 S source-reference art\n\nThese assets are source references only and are not production-approved.\nNo recolouring, AI drawing, or kitbashing is performed by the vendoring script; it only crops/scales authored pixels with nearest-neighbour sampling.\n\nElsia source reference\n- Dreamir — Spearwoman\n- https://dreamir.itch.io/spearwoman\n- Free/commercial use permitted by the author; credit appreciated but not required.\n- Pinned mirrors: ThanakornMix/Lost_Card_RPG@${LOST_CARD_REV}, MasterSacid/Space-war@0751279ed43f0776623b8eb9feb11baf533346ac\n\nTotoria source reference\n- CreativeKind — Necromancer (Free)\n- https://creativekind.itch.io/necromancer-free\n- Free for commercial and non-commercial use; modification permitted; redistribution/resale prohibited.\n- Pinned mirror: Yatchanek/Platformer@${TOTORIA_REV}\n\nRiena / Mireille / Neria source references\n- chierit — Elementals: Water Priestess / Leaf Ranger / Metal Bladekeeper\n- https://chierit.itch.io/elementals-water-priestess\n- https://chierit.itch.io/elementals-leaf-ranger\n- https://chierit.itch.io/elementals-metal-bladekeeper\n- License: CC BY 4.0. Credit: chierit.\n- Pinned mirrors: Mathatou/Gamejam@${RIENA_REV}, DawnSouther/godot-demo@${MIREILLE_REV}, Mohammed2372/Elemental-Showdown@${NERIA_REV}\n`);

console.log('[s01-source] vendored 5 S-rarity characters / 15 source-reference form families');
