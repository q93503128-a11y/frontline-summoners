import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/series-two-s-source-reference');
const TARGET = 128;
const FRAME_COUNT = 4;
const CONTENT = 116;

const BARGA_REV = '413afe6ef1fda5fd7fd45c1338aa186020105721';
const ZIRKA_REV = '84414f2caf4a3072e3d59554339879c12f93413b';
const MOGU_REV = '45aa4a900641e0f20a9b8bacb6f2dfa899c4e970';
const GARDO_REV = 'a7ccf54dca83f4fd1cc20cca6b17815e5bead84d';
const ADMURIN_REV = '52a16508a9f1834aefc3a7b37a69a6e1a6f920f3';

function rawGithub(repo, revision, path) {
  const encodedPath = path.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `https://raw.githubusercontent.com/${repo}/${revision}/${encodedPath}`;
}

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const imageCache = new Map();

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

async function loadImage(url) {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const promise = fetchBytes(url).then((bytes) => decodePng(bytes, url));
  imageCache.set(url, promise);
  return promise;
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
  const scale = Math.min(CONTENT / bounds.width, CONTENT / bounds.height);
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
  await writeFile(target, encodeStrip(frames));
  console.log(`[s02-source] ${relativePath} ${TARGET * FRAME_COUNT}x${TARGET}`);
}

function sampleFour(frames) {
  if (frames.length === 0) throw new Error('source animation has no frames');
  if (frames.length === 1) return [frames[0], frames[0], frames[0], frames[0]];
  const last = frames.length - 1;
  return [0, 1, 2, 3].map((step) => frames[Math.round((last * step) / 3)]);
}

function horizontalSquareFrames(sheet) {
  if (sheet.height <= 0 || sheet.width % sheet.height !== 0) {
    throw new Error(`expected horizontal square-frame strip, got ${sheet.width}x${sheet.height}`);
  }
  const size = sheet.height;
  const count = sheet.width / size;
  return sampleFour(Array.from({ length: count }, (_, index) => crop(sheet, index * size, 0, size, size)));
}

function fixedGridFrames(sheet, columns, rows) {
  if (sheet.width % columns !== 0 || sheet.height % rows !== 0) {
    throw new Error(`expected ${columns}x${rows} frame grid, got ${sheet.width}x${sheet.height}`);
  }
  const frameWidth = sheet.width / columns;
  const frameHeight = sheet.height / rows;
  const frames = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      frames.push(crop(sheet, column * frameWidth, row * frameHeight, frameWidth, frameHeight));
    }
  }
  return sampleFour(frames);
}

function directionalRowFrames(sheet, rows = 4, rowIndex = 2) {
  if (sheet.height % rows !== 0) throw new Error(`expected ${rows} directional rows, got ${sheet.width}x${sheet.height}`);
  const cell = sheet.height / rows;
  if (sheet.width % cell !== 0) throw new Error(`directional sheet width is not a ${cell}px cell multiple: ${sheet.width}x${sheet.height}`);
  const columns = sheet.width / cell;
  if (rowIndex < 0 || rowIndex >= rows) throw new Error(`direction row ${rowIndex} outside 0..${rows - 1}`);
  return sampleFour(Array.from({ length: columns }, (_, column) => crop(sheet, column * cell, rowIndex * cell, cell, cell)));
}

async function frames(url, extractor) {
  return extractor(await loadImage(url));
}

async function writeForm(slug, form, sources, extractor) {
  const base = `${slug}/${form}`;
  await writeStrip(`${base}/idle.png`, await frames(sources.idle, extractor));
  await writeStrip(`${base}/run.png`, await frames(sources.run, extractor));
  await writeStrip(`${base}/attack.png`, await frames(sources.attack, extractor));
  await writeStrip(`${base}/hit.png`, await frames(sources.hit, extractor));
  await writeStrip(`${base}/death.png`, await frames(sources.death, extractor));
}

function bargaUrl(name) {
  return rawGithub('Nebulea-dev/Phelmattack', BARGA_REV, `Assets/Enemies/Golems/V5/${name}.png`);
}

async function writeBarga() {
  const common = { idle: bargaUrl('Idle'), run: bargaUrl('Run'), hit: bargaUrl('GetHit'), death: bargaUrl('Die') };
  for (const [form, attack] of [['f1', 'A1'], ['f2', 'A2'], ['f3', 'A3']]) {
    await writeForm('barga', form, { ...common, attack: bargaUrl(attack) }, (sheet) => fixedGridFrames(sheet, 4, 4));
  }
}

function zirkaUrl(name) {
  return rawGithub('rcbiscuitsbelfast-prog/dino-bundle', ZIRKA_REV, `Assets/download/male/doux/base/${name}.png`);
}

async function writeZirka() {
  const common = { idle: zirkaUrl('idle'), run: zirkaUrl('move'), hit: zirkaUrl('hurt'), death: zirkaUrl('dead') };
  for (const [form, attack] of [['f1', 'bite'], ['f2', 'kick'], ['f3', 'dash']]) {
    await writeForm('zirka', form, { ...common, attack: zirkaUrl(attack) }, horizontalSquareFrames);
  }
}

function moguUrl(name) {
  return rawGithub('Singingsnowbirdie/Platformer', MOGU_REV, `Assets/Sprites/Characters/Monsters/Mushroom/${name}.png`);
}

async function writeMogu() {
  const common = {
    idle: moguUrl('Idle'),
    run: moguUrl('Run'),
    hit: moguUrl('Take Hit'),
    death: moguUrl('Death'),
  };
  for (const [form, attack] of [['f1', 'Attack'], ['f2', 'Attack2'], ['f3', 'Attack3']]) {
    await writeForm('mogu', form, { ...common, attack: moguUrl(attack) }, horizontalSquareFrames);
  }
}

function gardoUrl(plant, motion) {
  const base = `Assets/craftpix-net-284465-free-predator-plant-mobs-pixel-art-pack/PNG/Plant${plant}/Without_shadow`;
  return rawGithub('Thaumonaut/alphabet-soup', GARDO_REV, `${base}/Plant${plant}_${motion}_without_shadow.png`);
}

async function writeGardo() {
  for (const [form, plant] of [['f1', 1], ['f2', 2], ['f3', 3]]) {
    await writeForm('gardo', form, {
      idle: gardoUrl(plant, 'Idle'),
      run: gardoUrl(plant, 'Run'),
      attack: gardoUrl(plant, 'Attack'),
      hit: gardoUrl(plant, 'Hurt'),
      death: gardoUrl(plant, 'Death'),
    }, (sheet) => directionalRowFrames(sheet, 4, 2));
  }
}

const ADMURIN_ROOT = 'TheCrownJewel/Assets/Enemy Galore 1 - Pixel Art/Sprites';
function admurinUrl(folder, name) {
  return rawGithub('AadiJo/The-Crown-Jewel', ADMURIN_REV, `${ADMURIN_ROOT}/${folder}/${name}.png`);
}

async function writeKreik() {
  const common = {
    idle: admurinUrl('Crab', 'Crab_Idle'),
    run: admurinUrl('Crab', 'Crab_Run'),
    hit: admurinUrl('Crab', 'Crab_Hit'),
    death: admurinUrl('Crab', 'Crab_Death'),
  };
  for (const [form, attack] of [['f1', 'Crab_AttackA'], ['f2', 'Crab_AttackB'], ['f3', 'Crab_AttackC']]) {
    await writeForm('kreik', form, { ...common, attack: admurinUrl('Crab', attack) }, horizontalSquareFrames);
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

await writeBarga();
await writeZirka();
await writeMogu();
await writeGardo();
await writeKreik();

await writeFile(resolve(outputRoot, 'ATTRIBUTION.txt'), `Series 2 S source-reference art\n\nThese assets are source references only and are not production-approved.\nThe vendoring script only selects, crops and nearest-neighbour scales authored source pixels. It does not recolour, AI-draw or kitbash evolution forms.\n\nBarga source reference\n- Kalponic Studio — Pixel Fantasy-Golem Character\n- https://kalponic-studio.itch.io/pixel-fantasy-golem-character\n- Author permits personal/commercial use and modification; standalone resale and trademark/logo use are restricted. The source page states no generative AI was used.\n- Pinned mirror: Nebulea-dev/Phelmattack@${BARGA_REV}\n\nZirka source reference\n- Arks / DemChing — Dino Characters / Dino Family\n- https://arks.itch.io/dino-characters\n- https://demching.itch.io/dino-family\n- License: CC BY 4.0. Attribution retained here.\n- Pinned mirror: rcbiscuitsbelfast-prog/dino-bundle@${ZIRKA_REV}\n\nMogu source reference\n- LuizMelo — Monsters Creatures Fantasy (Mushroom)\n- https://luizmelo.itch.io/monsters-creatures-fantasy\n- License: CC0 1.0. The official page states commercial/non-commercial use is allowed and no generative AI was used.\n- F1/F2/F3 use the authored Attack / Attack2 / Attack3 motions from the pinned mirror; no recolour is applied.\n- Pinned mirror: Singingsnowbirdie/Platformer@${MOGU_REV}\n\nGardo source reference\n- CraftPix — Free Predator Plant Mobs Pixel Art Pack\n- https://craftpix.net/freebies/free-predator-plant-mobs-pixel-art-pack/\n- The free pack is royalty-free for unlimited projects. The three authored predator-plant creatures are used as F1/F2/F3; no recolour is applied.\n- Pinned mirror: Thaumonaut/alphabet-soup@${GARDO_REV}\n\nKreik source reference\n- Admurin — Enemy Galore I (Crab)\n- https://opengameart.org/content/enemy-galore-i\n- Bundled license permits personal/commercial game use and modification; standalone asset resale/redistribution is prohibited; NFT use is prohibited; credit is appreciated but not required.\n- Pinned mirror: AadiJo/The-Crown-Jewel@${ADMURIN_REV}\n`);

console.log('[s02-source] vendored 5 S-rarity characters / 15 source-reference form families');
