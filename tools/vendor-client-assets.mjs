import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters');

const VLEE = 'https://raw.githubusercontent.com/vlee489/AC31009-Client/71252f38c7bf4426ff84676cad517f66c3e6cb65/assets/Sprites';
const NQM = 'https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';

const files = [
  ['hero-knight/idle.png', `${VLEE}/HeroKnight/Idle.png`, 1980, 180],
  ['hero-knight/run.png', `${VLEE}/HeroKnight/Run.png`, 1440, 180],
  ['hero-knight/attack.png', `${VLEE}/HeroKnight/Attack1.png`, 1260, 180],
  ['hero-knight-2/idle.png', `${NQM}/Hero%20Knight%202/Sprites/Idle.png`, 1540, 140],
  ['hero-knight-2/run.png', `${NQM}/Hero%20Knight%202/Sprites/Run.png`, 1120, 140],
  ['hero-knight-2/attack.png', `${NQM}/Hero%20Knight%202/Sprites/Attack.png`, 840, 140],
  ['fantasy-warrior/idle.png', `${NQM}/Fantasy%20Warrior/Sprites/Idle.png`, 1620, 162],
  ['fantasy-warrior/run.png', `${NQM}/Fantasy%20Warrior/Sprites/Run.png`, 1296, 162],
  ['fantasy-warrior/attack.png', `${NQM}/Fantasy%20Warrior/Sprites/Attack1.png`, 1134, 162],
  ['wizard/idle.png', `${VLEE}/WizardPack/Idle.png`, 1386, 190],
  ['wizard/run.png', `${VLEE}/WizardPack/Run.png`, 1848, 190],
  ['wizard/attack.png', `${VLEE}/WizardPack/Attack1.png`, 1848, 190],
  ['warrior/idle.png', `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Idle.png`, 1200, 150],
  ['warrior/run.png', `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Run.png`, 1200, 150],
  ['warrior/attack.png', `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Attack1.png`, 600, 150],
  ['huntress/idle.png', `${NQM}/Huntress/Sprites/Idle.png`, 1200, 150],
  ['huntress/run.png', `${NQM}/Huntress/Sprites/Run.png`, 1200, 150],
  ['huntress/attack.png', `${NQM}/Huntress/Sprites/Attack1.png`, 750, 150],
  ['evil-wizard/idle.png', `${NQM}/Evil%20Wizard/Sprites/Idle.png`, 1200, 150],
  ['evil-wizard/run.png', `${NQM}/Evil%20Wizard/Sprites/Move.png`, 1200, 150],
  ['evil-wizard/attack.png', `${NQM}/Evil%20Wizard/Sprites/Attack.png`, 1200, 150],
];

function pngDimensions(bytes, url) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    throw new Error(`asset is not a PNG: ${url}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function fetchWithRetry(url, attempts = 3) {
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
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`asset download failed after ${attempts} attempts: ${url}; ${String(lastError)}`);
}

async function download(relativePath, url, expectedWidth, expectedHeight) {
  const response = await fetchWithRetry(url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 128) throw new Error(`asset file is unexpectedly small: ${url}`);
  const { width, height } = pngDimensions(bytes, url);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`asset dimensions changed for ${relativePath}: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height}`);
  }
  const target = resolve(outputRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return bytes.length;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

let totalBytes = 0;
for (const [relativePath, url, expectedWidth, expectedHeight] of files) {
  const bytes = await download(relativePath, url, expectedWidth, expectedHeight);
  totalBytes += bytes;
  console.log(`[asset] ${relativePath} ${expectedWidth}x${expectedHeight} ${bytes} bytes`);
}

console.log(`[asset] vendored ${files.length} verified sprite sheets (${totalBytes} bytes)`);
