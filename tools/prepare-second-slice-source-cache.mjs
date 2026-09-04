import { mkdir, writeFile } from 'node:fs/promises';
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
  ['hero-knight/hit.png', `${VLEE}/HeroKnight/Take%20Hit.png`, 720, 180],
  ['hero-knight/death.png', `${VLEE}/HeroKnight/Death.png`, 1980, 180],
  ['huntress-2/idle.png', `${NQM}/Huntress%202/Sprites/Character/Idle.png`, 1000, 100],
  ['huntress-2/run.png', `${NQM}/Huntress%202/Sprites/Character/Run.png`, 800, 100],
  ['huntress-2/attack.png', `${NQM}/Huntress%202/Sprites/Character/Attack.png`, 600, 100],
  ['huntress-2/hit.png', `${NQM}/Huntress%202/Sprites/Character/Get%20Hit.png`, 300, 100],
  ['huntress-2/death.png', `${NQM}/Huntress%202/Sprites/Character/Death.png`, 1000, 100],
  ['fantasy-warrior/idle.png', `${NQM}/Fantasy%20Warrior/Sprites/Idle.png`, 1620, 162],
  ['fantasy-warrior/run.png', `${NQM}/Fantasy%20Warrior/Sprites/Run.png`, 1296, 162],
  ['fantasy-warrior/attack.png', `${NQM}/Fantasy%20Warrior/Sprites/Attack1.png`, 1134, 162],
  ['fantasy-warrior/hit.png', `${NQM}/Fantasy%20Warrior/Sprites/Take%20hit.png`, 486, 162],
  ['fantasy-warrior/death.png', `${NQM}/Fantasy%20Warrior/Sprites/Death.png`, 1134, 162],
  ['king-2/idle.png', `${NQM}/Medieval%20King%20Pack%202/Sprites/Idle.png`, 1280, 111],
  ['king-2/run.png', `${NQM}/Medieval%20King%20Pack%202/Sprites/Run.png`, 1280, 111],
  ['king-2/attack.png', `${NQM}/Medieval%20King%20Pack%202/Sprites/Attack1.png`, 640, 111],
  ['king-2/hit.png', `${NQM}/Medieval%20King%20Pack%202/Sprites/Take%20Hit.png`, 640, 111],
  ['king-2/death.png', `${NQM}/Medieval%20King%20Pack%202/Sprites/Death.png`, 960, 111],
];

function pngDimensions(bytes, label) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    throw new Error(`[second-slice source cache] ${label} is not PNG`);
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
async function fetchBytes(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'frontline-summoners-second-slice/1.0' },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(350 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`[second-slice source cache] download failed ${url}: ${String(lastError)}`);
}

let totalBytes = 0;
for (const [relativePath, url, expectedWidth, expectedHeight] of files) {
  const bytes = await fetchBytes(url);
  const { width, height } = pngDimensions(bytes, relativePath);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`[second-slice source cache] ${relativePath} dimensions changed: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height}`);
  }
  const target = resolve(outputRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  totalBytes += bytes.length;
}

console.log(`[second-slice source cache] prepared ${files.length} pinned CC0 source sheets (${totalBytes} bytes); cache is build input only`);
