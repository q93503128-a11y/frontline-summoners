import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/characters');

const VLEE = 'https://raw.githubusercontent.com/vlee489/AC31009-Client/71252f38c7bf4426ff84676cad517f66c3e6cb65/assets/Sprites';
const NQM = 'https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';

const files = [
  ['hero-knight/idle.png', `${VLEE}/HeroKnight/Idle.png`],
  ['hero-knight/run.png', `${VLEE}/HeroKnight/Run.png`],
  ['hero-knight/attack.png', `${VLEE}/HeroKnight/Attack1.png`],
  ['hero-knight-2/idle.png', `${NQM}/Hero%20Knight%202/Sprites/Idle.png`],
  ['hero-knight-2/run.png', `${NQM}/Hero%20Knight%202/Sprites/Run.png`],
  ['hero-knight-2/attack.png', `${NQM}/Hero%20Knight%202/Sprites/Attack.png`],
  ['fantasy-warrior/idle.png', `${NQM}/Fantasy%20Warrior/Sprites/Idle.png`],
  ['fantasy-warrior/run.png', `${NQM}/Fantasy%20Warrior/Sprites/Run.png`],
  ['fantasy-warrior/attack.png', `${NQM}/Fantasy%20Warrior/Sprites/Attack1.png`],
  ['wizard/idle.png', `${VLEE}/WizardPack/Idle.png`],
  ['wizard/run.png', `${VLEE}/WizardPack/Run.png`],
  ['wizard/attack.png', `${VLEE}/WizardPack/Attack1.png`],
  ['warrior/idle.png', `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Idle.png`],
  ['warrior/run.png', `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Run.png`],
  ['warrior/attack.png', `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Attack1.png`],
  ['huntress/idle.png', `${NQM}/Huntress/Sprites/Idle.png`],
  ['huntress/run.png', `${NQM}/Huntress/Sprites/Run.png`],
  ['huntress/attack.png', `${NQM}/Huntress/Sprites/Attack1.png`],
  ['evil-wizard/idle.png', `${NQM}/Evil%20Wizard/Sprites/Idle.png`],
  ['evil-wizard/run.png', `${NQM}/Evil%20Wizard/Sprites/Move.png`],
  ['evil-wizard/attack.png', `${NQM}/Evil%20Wizard/Sprites/Attack.png`],
];

async function download(relativePath, url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'frontline-summoners-build/1.0' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`asset download failed ${response.status}: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 128) throw new Error(`asset file is unexpectedly small: ${url}`);
  const target = resolve(outputRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return bytes.length;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

let totalBytes = 0;
for (const [relativePath, url] of files) {
  const bytes = await download(relativePath, url);
  totalBytes += bytes;
  console.log(`[asset] ${relativePath} ${bytes} bytes`);
}

console.log(`[asset] vendored ${files.length} sprite sheets (${totalBytes} bytes)`);
