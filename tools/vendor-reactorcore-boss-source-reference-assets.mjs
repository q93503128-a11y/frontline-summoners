import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters/boss-source-reference');
const outputFolder = 'cc0-boss-zero-engine';
const TARGET_CELL = 128;

const SOURCE_PAGE = 'https://opengameart.org/content/core-reactor-machines';
const SOURCE_SHEET = 'https://opengameart.org/sites/default/files/all_machines.png';
const EXPECTED_WIDTH = 512;
const EXPECTED_HEIGHT = 512;
const TOP_ROW_SCAN_HEIGHT = 104;
const EXPECTED_AUTHORED_STATES = 6;

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const assert = (ok, message) => {
  if (!ok) throw new Error(`[reactorcore-boss-source-reference] ${message}`);
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
  throw new Error(`[reactorcore-boss-source-reference] ${label} download failed: ${String(lastError)}`);
}

async function verifyCc0SourcePage() {
  const html = (await fetchBytes(SOURCE_PAGE, 'Core Reactor Machines source page')).toString('utf8');
  assert(/Core Reactor Machines/i.test(html), 'source page title changed');
  assert(/CC0|creativecommons\.org\/publicdomain\/zero/i.test(html),
    'source page no longer declares CC0');
}

function columnHasAlpha(sheet, x) {
  const maxY = Math.min(sheet.height, TOP_ROW_SCAN_HEIGHT);
  for (let y = 0; y < maxY; y += 1) {
    if (sheet.data[(y * sheet.width + x) * 4 + 3] !== 0) return true;
  }
  return false;
}

function findTopRowGroups(sheet) {
  const groups = [];
  let start = null;

  for (let x = 0; x <= sheet.width; x += 1) {
    const occupied = x < sheet.width && columnHasAlpha(sheet, x);
    if (occupied && start === null) start = x;
    if (!occupied && start !== null) {
      const end = x - 1;
      if (end - start + 1 >= 24) groups.push({ x0: start, x1: end });
      start = null;
    }
  }

  assert(groups.length === EXPECTED_AUTHORED_STATES,
    `expected ${EXPECTED_AUTHORED_STATES} authored top-row states, found ${groups.length}`);
  return groups.map((group, index) => {
    let y0 = TOP_ROW_SCAN_HEIGHT;
    let y1 = -1;
    for (let y = 0; y < TOP_ROW_SCAN_HEIGHT; y += 1) {
      for (let x = group.x0; x <= group.x1; x += 1) {
        if (sheet.data[(y * sheet.width + x) * 4 + 3] !== 0) {
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
    assert(y1 >= y0, `authored state ${index} has no visible pixels`);
    const width = group.x1 - group.x0 + 1;
    const height = y1 - y0 + 1;
    assert(width >= 48 && width <= 84, `authored state ${index} width ${width}px drifted`);
    assert(height >= 48 && height <= 92, `authored state ${index} height ${height}px drifted`);
    return { ...group, y0, y1 };
  });
}

function drawFrame(out, sheet, box, frameIndex) {
  const sourceWidth = box.x1 - box.x0 + 1;
  const sourceHeight = box.y1 - box.y0 + 1;
  const scale = Math.max(1, Math.floor(Math.min((TARGET_CELL - 12) / sourceWidth, (TARGET_CELL - 12) / sourceHeight)));
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = frameIndex * TARGET_CELL + Math.floor((TARGET_CELL - drawWidth) / 2);
  const offsetY = Math.floor((TARGET_CELL - drawHeight) / 2);
  const stripWidth = TARGET_CELL * 4;

  for (let sy = 0; sy < sourceHeight; sy += 1) {
    for (let sx = 0; sx < sourceWidth; sx += 1) {
      const sourceIndex = ((box.y0 + sy) * sheet.width + box.x0 + sx) * 4;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const targetX = offsetX + sx * scale + dx;
          const targetY = offsetY + sy * scale + dy;
          const targetIndex = (targetY * stripWidth + targetX) * 4;
          sheet.data.copy(out, targetIndex, sourceIndex, sourceIndex + 4);
        }
      }
    }
  }
}

function composeStrip(sheet, boxes, sequence) {
  assert(sequence.length === 4, 'runtime strip must contain exactly four frames');
  const out = Buffer.alloc(TARGET_CELL * 4 * TARGET_CELL * 4);
  sequence.forEach((sourceFrame, frameIndex) => drawFrame(out, sheet, boxes[sourceFrame], frameIndex));
  return encodePng(TARGET_CELL * 4, TARGET_CELL, out);
}

await verifyCc0SourcePage();
const sheet = decodePng(await fetchBytes(SOURCE_SHEET, 'Core Reactor Machines authored sheet'),
  'Core Reactor Machines all_machines.png');
assert(sheet.width === EXPECTED_WIDTH && sheet.height === EXPECTED_HEIGHT,
  `source sheet dimensions drifted: ${sheet.width}x${sheet.height}`);
const boxes = findTopRowGroups(sheet);

// Reactorcore authored six progressive states of the same square core machine in the first row.
// We only select and reorder those authored states to express runtime timing. No pixels are drawn,
// recoloured, kitbashed, mirrored, or procedurally redesigned.
const motions = {
  idle: [0, 1, 0, 1],
  move: [1, 2, 1, 2],
  attack: [2, 3, 4, 5],
  hit: [5, 4, 5, 4],
  death: [5, 3, 1, 0],
};

await rm(resolve(outputRoot, outputFolder), { recursive: true, force: true });
for (const [motion, sequence] of Object.entries(motions)) {
  const target = resolve(outputRoot, outputFolder, `${motion}.png`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, composeStrip(sheet, boxes, sequence));
}
