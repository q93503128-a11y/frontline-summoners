import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodePng,
  ellipse,
  encodePng,
  line,
  sha256,
  sourceFrame,
  triangle,
} from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetRoot = resolve(
  root,
  'apps/client/public/assets/production/units/pyromancer/pyromancer_f3',
);
const metadataPath = resolve(targetRoot, 'runtime-metadata.json');
const movePath = resolve(targetRoot, 'move.png');

function assert(ok, message) {
  if (!ok) throw new Error(`[fourth-slice-pyromancer-f3-move] ${message}`);
}

function assemble(frames, w, h) {
  const out = Buffer.alloc(w * frames.length * h * 4);
  for (let fi = 0; fi < frames.length; fi += 1) {
    for (let y = 0; y < h; y += 1) {
      const src = y * w * 4;
      const dst = (y * w * frames.length + fi * w) * 4;
      frames[fi].copy(out, dst, src, src + w * 4);
    }
  }
  return out;
}

const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
assert(metadata.assetId === 'unit:pyromancer:pyromancer_f3', 'target identity drift');
assert(metadata.status === 'AWAITING_ART', 'lifecycle status drift');
assert(metadata.reviewStatus === 'UNREVIEWED_RUNTIME_FILES', 'review boundary drift');
assert(metadata.normalRuntimeAuthoritative === false, 'runtime authority drift');
assert(metadata.generativeAiUsed === false, 'AI provenance boundary drift');

const frames = metadata.motions?.move;
const fw = metadata.frameWidth;
const fh = metadata.frameHeight;
assert(Number.isInteger(frames) && frames >= 4, 'move frame count missing');
assert(Number.isInteger(fw) && fw > 0 && Number.isInteger(fh) && fh > 0, 'frame geometry missing');

const sourceBytes = await readFile(movePath);
const png = decodePng(sourceBytes, 'pyromancer/pyromancer_f3/move');
assert(png.width === fw * frames && png.height === fh, 'move strip dimensions drift');

const hot = [228, 121, 45, 255];
const ember = [245, 190, 92, 255];
const iron = [72, 64, 58, 255];
const outFrames = [];

for (let i = 0; i < frames; i += 1) {
  const frame = sourceFrame(png, fw, fh, i);
  const fireRight = i % 2 === 1;
  const phase = i % 4;
  const lift = [-8, 5, -2, 9][phase];
  const tipX = fireRight ? 286 : 24;
  const rootX = fireRight ? 192 : 64;
  const tipY = 169 + lift;
  const rootTopY = 145 - Math.round(lift * 0.3);
  const rootBottomY = 193 + Math.round(lift * 0.25);

  // F3 is a floating calamity furnace. Its move read is an alternating lateral
  // exhaust kick rather than a tiny whole-body bob. The appendage swaps sides
  // every frame so adjacent silhouettes differ materially without changing the
  // idle/attack identity or touching the frame edges.
  triangle(
    frame,
    fw,
    fh,
    [rootX, rootTopY],
    [tipX, tipY],
    [rootX, rootBottomY],
    hot,
    0.88,
  );
  ellipse(frame, fw, fh, tipX, tipY, 18, 24, ember, 0.94);
  line(frame, fw, fh, rootX, 169, tipX, tipY, iron, 5, 0.82);

  const counterX = fireRight ? 55 : 222;
  const counterY = 207 - lift;
  ellipse(frame, fw, fh, counterX, counterY, 15, 11, hot, 0.84);

  outFrames.push(frame);
}

const encoded = encodePng(fw * frames, fh, assemble(outFrames, fw, fh));
await writeFile(movePath, encoded);
metadata.files.move.sha256 = sha256(encoded);
metadata.visualPolishPyromancerF3Move = {
  version: 1,
  kind: 'ALTERNATING_LATERAL_FURNACE_EXHAUST',
  reviewStatus: 'UNREVIEWED_RUNTIME_FILES',
  normalRuntimeAuthoritative: false,
};
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(`[fourth-slice-pyromancer-f3-move] polished ${frames} move frames; approval state unchanged`);
