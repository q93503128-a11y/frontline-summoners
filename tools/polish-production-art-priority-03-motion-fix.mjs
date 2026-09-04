import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, ellipse, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(root, 'apps/client/public');
const unitsRoot = resolve(publicRoot, 'assets/production/units');
const metadataPath = resolve(unitsRoot, 'special-content-runtime-metadata.json');
const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
const TARGETS = new Set(['boss_sp_gold_carrier', 'enemy_sp_evo_mirror_seal', 'enemy_sp_gold_vault_golem']);
const MOTIONS = ['move', 'attack'];
const P = {
  d: [31, 35, 45, 255],
  m: [92, 104, 119, 255],
  a: [217, 106, 68, 255],
  g: [104, 207, 226, 255],
  l: [223, 228, 232, 255],
  gold: [229, 184, 72, 255],
  violet: [166, 111, 218, 255],
};

function assert(ok, msg) {
  if (!ok) throw new Error(`[production-priority-03-motion-fix] ${msg}`);
}

assert(metadata.humanReview === 'PENDING' && metadata.normalRuntimeAuthoritative === false,
  'special content review boundary drift');

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

function canonicalMotionPath(id, motion, motionMeta) {
  if (typeof motionMeta.url === 'string' && motionMeta.url.length > 0) {
    return resolve(publicRoot, motionMeta.url.replace(/^\//, ''));
  }
  return resolve(unitsRoot, id, `${motion}.png`);
}

function draw(frame, w, h, id, motion, i, n) {
  const t = i / Math.max(1, n - 1);
  const wave = Math.sin(t * Math.PI * 2);
  const pulse = Math.sin(t * Math.PI);
  const alt = i % 2 ? -1 : 1;
  const cx = Math.round(w * 0.5);
  const cy = Math.round(h * 0.5);
  const X = (x) => Math.max(10, Math.min(w - 10, Math.round(x)));
  const Y = (y) => Math.max(10, Math.min(h - 10, Math.round(y)));

  if (id === 'boss_sp_gold_carrier') {
    if (motion === 'move') {
      const dx = Math.round(w * 0.085 * alt);
      const dy = Math.round(h * 0.055 * wave);
      ellipse(frame, w, h, X(cx - 118 + dx), Y(cy + 91 + dy), 34, 25, P.d, 0.98);
      ellipse(frame, w, h, X(cx + 112 - dx), Y(cy + 91 - dy), 34, 25, P.d, 0.98);
      rect(frame, w, h, X(cx - 142 + dx), Y(cy - 8 + dy), X(cx - 102 + dx), Y(cy + 30 + dy), P.gold, 0.94);
      rect(frame, w, h, X(cx + 102 - dx), Y(cy - 8 - dy), X(cx + 142 - dx), Y(cy + 30 - dy), P.gold, 0.94);
    } else {
      const reach = X(cx + 95 + w * (0.19 + 0.18 * pulse));
      const reachY = Y(cy - 58 - h * 0.09 * pulse);
      triangle(frame, w, h, [cx + 55, cy - 72], [reach, reachY], [cx + 61, cy + 3], P.g, 0.92);
      ellipse(frame, w, h, reach, reachY, 32 + Math.round(28 * pulse), 26 + Math.round(20 * pulse), P.a, 0.92);
      line(frame, w, h, cx - 66, cy - 32, X(cx - 126 - w * 0.14 * pulse), Y(cy - 83 - h * 0.03 * pulse), P.gold, 13, 0.94);
      line(frame, w, h, cx + 44, cy + 18, X(cx + 118 + w * 0.12 * pulse), Y(cy + 68 + h * 0.04 * pulse), P.g, 10, 0.88);
    }
  } else if (id === 'enemy_sp_evo_mirror_seal') {
    if (motion === 'move') {
      const spread = Math.round(w * (0.08 + 0.055 * Math.abs(wave)));
      for (const s of [-1, 1]) {
        const x = X(cx + s * (88 + spread));
        triangle(frame, w, h, [X(cx + s * 64), cy - 76], [x, Y(cy - 118 + alt * 11)], [X(cx + s * 62), cy - 18], s < 0 ? P.g : P.violet, 0.88);
        ellipse(frame, w, h, x, Y(cy + 63 - alt * 13), 24, 19, P.l, 0.88);
      }
    } else {
      const spread = Math.round(w * (0.10 + 0.12 * pulse));
      for (const s of [-1, 1]) {
        const x = X(cx + s * (78 + spread));
        rect(frame, w, h, X(x - 15), Y(cy - 105 - 20 * pulse), X(x + 15), Y(cy + 68 + 18 * pulse), s < 0 ? P.g : P.violet, 0.88);
      }
      ellipse(frame, w, h, cx, cy - 12, 34 + Math.round(48 * pulse), 42 + Math.round(30 * pulse), P.a, 0.78);
    }
  } else if (id === 'enemy_sp_gold_vault_golem') {
    if (motion === 'move') {
      const dx = Math.round(w * 0.09 * alt);
      const lift = Math.round(h * 0.065 * wave);
      rect(frame, w, h, X(cx - 127 + dx), Y(cy + 22 + lift), X(cx - 82 + dx), Y(cy + 88 + lift), P.d, 0.98);
      rect(frame, w, h, X(cx + 82 - dx), Y(cy + 22 - lift), X(cx + 127 - dx), Y(cy + 88 - lift), P.d, 0.98);
      ellipse(frame, w, h, X(cx - 104 + dx), Y(cy + 94 + lift), 29, 22, P.gold, 0.94);
      ellipse(frame, w, h, X(cx + 104 - dx), Y(cy + 94 - lift), 29, 22, P.gold, 0.94);
    } else {
      const arm = X(cx + 82 + w * (0.20 + 0.10 * pulse));
      const armY = Y(cy - 15 - h * 0.08 * pulse);
      rect(frame, w, h, cx + 46, cy - 52, arm, armY + 33, P.gold, 0.94);
      ellipse(frame, w, h, arm, armY, 34 + Math.round(20 * pulse), 31 + Math.round(17 * pulse), P.a, 0.94);
      const left = X(cx - 82 - w * (0.13 + 0.08 * pulse));
      triangle(frame, w, h, [cx - 51, cy - 45], [left, Y(cy - 83)], [cx - 54, cy + 20], P.l, 0.90);
    }
  }
}

let touched = 0;
for (const id of TARGETS) {
  const meta = metadata.targets?.[id];
  assert(meta, `missing target ${id}`);
  touched += 1;

  for (const motion of MOTIONS) {
    const mm = meta.motions?.[motion];
    assert(mm, `missing motion metadata ${id}/${motion}`);
    const fw = mm.frameWidth ?? meta.frameWidth;
    const fh = mm.frameHeight ?? meta.frameHeight;
    const path = canonicalMotionPath(id, motion, mm);
    const bytes = await readFile(path);
    const png = decodePng(bytes, `${id}/${motion}`);
    assert(png.width === fw * mm.frames && png.height === fh, `${id}/${motion} dimensions drift`);

    const frames = [];
    for (let i = 0; i < mm.frames; i += 1) {
      const frame = sourceFrame(png, fw, fh, i);
      draw(frame, fw, fh, id, motion, i, mm.frames);
      frames.push(frame);
    }
    const encoded = encodePng(fw * mm.frames, fh, assemble(frames, fw, fh));
    await writeFile(path, encoded);
    mm.bytes = encoded.length;
    mm.sha256 = sha256(encoded);
  }

  meta.visualPolishPriority03MotionFix = {
    version: 2,
    kind: 'DYNAMIC_SILHOUETTE_RECOVERY',
    reviewStatus: 'UNREVIEWED_RUNTIME_FILES',
  };
}

metadata.visualPolishPriority03MotionFix = {
  version: 2,
  touchedTargets: touched,
  humanReview: 'PENDING',
  normalRuntimeAuthoritative: false,
};
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`[production-priority-03-motion-fix] restored dynamic readability for ${touched} special targets`);
