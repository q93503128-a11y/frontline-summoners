import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sourceFrame } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unitsRoot = resolve(root, 'apps/client/public/assets/production/units');
const reportPath = resolve(unitsRoot, 'production-art-quality-audit.json');
const MOTIONS = ['idle', 'move', 'attack'];
const GRID = 24;
const ALPHA = 20;

function assert(ok, message) {
  if (!ok) throw new Error(`[production-art-quality] ${message}`);
}

function round(value, digits = 4) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function motionDimensions(target, motion) {
  const meta = target.motions?.[motion];
  assert(meta, `missing ${motion} metadata for ${target.assetId ?? target.unitId ?? 'unknown target'}`);
  const frameWidth = meta.frameWidth ?? target.frameWidth;
  const frameHeight = meta.frameHeight ?? target.frameHeight;
  const frames = meta.frames;
  assert(Number.isInteger(frameWidth) && frameWidth > 0, `invalid ${motion} frameWidth`);
  assert(Number.isInteger(frameHeight) && frameHeight > 0, `invalid ${motion} frameHeight`);
  assert(Number.isInteger(frames) && frames > 0, `invalid ${motion} frames`);
  return { frameWidth, frameHeight, frames };
}

function relativePngPath(targetKey, target, motion) {
  const meta = target.motions?.[motion];
  if (typeof meta?.url === 'string' && meta.url.startsWith('/assets/production/units/')) {
    return meta.url.slice('/assets/production/units/'.length);
  }
  if (typeof target.unitId === 'string' && typeof target.formId === 'string') {
    return `${target.unitId}/${target.formId}/${motion}.png`;
  }
  if (typeof target.unitId === 'string') return `${target.unitId}/${motion}.png`;
  return `${targetKey}/${motion}.png`;
}

function maskForFrame(frame) {
  const mask = new Uint8Array(frame.length / 4);
  let opaque = 0;
  for (let i = 0, p = 0; i < frame.length; i += 4, p += 1) {
    if (frame[i + 3] > ALPHA) {
      mask[p] = 1;
      opaque += 1;
    }
  }
  return { mask, opaque };
}

function bboxOfMask(mask, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0;
  let sumX = 0, sumY = 0, edge = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mask[y * w + x]) continue;
      opaque += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) edge += 1;
    }
  }
  if (!opaque) return null;
  return {
    minX, minY, maxX, maxY, opaque,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centroidX: sumX / opaque,
    centroidY: sumY / opaque,
    edgeRatio: edge / opaque,
  };
}

function iou(a, b) {
  assert(a.length === b.length, 'mask dimension mismatch');
  let intersection = 0, union = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] || b[i]) union += 1;
    if (a[i] && b[i]) intersection += 1;
  }
  return union ? intersection / union : 1;
}

function normalizedSignature(mask, w, h) {
  const bbox = bboxOfMask(mask, w, h);
  if (!bbox) return new Uint8Array(GRID * GRID);
  const out = new Uint8Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy += 1) {
    const y0 = bbox.minY + Math.floor((gy * bbox.height) / GRID);
    const y1 = Math.min(bbox.maxY, bbox.minY + Math.ceil(((gy + 1) * bbox.height) / GRID) - 1);
    for (let gx = 0; gx < GRID; gx += 1) {
      const x0 = bbox.minX + Math.floor((gx * bbox.width) / GRID);
      const x1 = Math.min(bbox.maxX, bbox.minX + Math.ceil(((gx + 1) * bbox.width) / GRID) - 1);
      let hit = 0;
      for (let y = y0; y <= y1 && !hit; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (mask[y * w + x]) { hit = 1; break; }
        }
      }
      out[gy * GRID + gx] = hit;
    }
  }
  return out;
}

function rootUnitId(targetKey, target) {
  if (typeof target.unitId === 'string') return target.unitId;
  if (targetKey.includes('/')) return targetKey.split('/')[0];
  return targetKey;
}

async function analyzeMotion(targetKey, target, motion) {
  const { frameWidth, frameHeight, frames } = motionDimensions(target, motion);
  const rel = relativePngPath(targetKey, target, motion);
  const bytes = await readFile(resolve(unitsRoot, rel));
  const png = decodePng(bytes, `${targetKey}/${motion}`);
  assert(png.width === frameWidth * frames && png.height === frameHeight,
    `${targetKey}/${motion} expected ${frameWidth * frames}x${frameHeight}, got ${png.width}x${png.height}`);

  const frameMasks = [];
  const frameStats = [];
  for (let index = 0; index < frames; index += 1) {
    const frame = sourceFrame(png, frameWidth, frameHeight, index);
    const { mask, opaque } = maskForFrame(frame);
    assert(opaque > 0, `${targetKey}/${motion} frame ${index} is empty`);
    const bbox = bboxOfMask(mask, frameWidth, frameHeight);
    assert(bbox, `${targetKey}/${motion} frame ${index} has no visible bbox`);
    frameMasks.push(mask);
    frameStats.push({
      occupancy: opaque / (frameWidth * frameHeight),
      widthCoverage: bbox.width / frameWidth,
      heightCoverage: bbox.height / frameHeight,
      edgeRatio: bbox.edgeRatio,
      centroidX: bbox.centroidX / frameWidth,
      centroidY: bbox.centroidY / frameHeight,
    });
  }

  const deltas = [];
  for (let index = 1; index < frameMasks.length; index += 1) {
    deltas.push(1 - iou(frameMasks[index - 1], frameMasks[index]));
  }
  const avg = (items, key) => items.reduce((sum, item) => sum + item[key], 0) / items.length;
  return {
    path: rel,
    frames,
    frameWidth,
    frameHeight,
    occupancy: round(avg(frameStats, 'occupancy')),
    widthCoverage: round(avg(frameStats, 'widthCoverage')),
    heightCoverage: round(avg(frameStats, 'heightCoverage')),
    maxEdgeRatio: round(Math.max(...frameStats.map((item) => item.edgeRatio))),
    avgDelta: round(deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0),
    maxDelta: round(deltas.length ? Math.max(...deltas) : 0),
    firstSignature: normalizedSignature(frameMasks[0], frameWidth, frameHeight),
  };
}

const rootEntries = await readdir(unitsRoot, { withFileTypes: true });
const metadataFiles = rootEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith('-runtime-metadata.json'))
  .map((entry) => entry.name)
  .filter((name) => name !== 'production-art-quality-audit.json')
  .sort();
assert(metadataFiles.length >= 8, `expected broad production metadata coverage, got ${metadataFiles.length}`);

const recordsByPath = new Map();
for (const metadataFile of metadataFiles) {
  const metadata = JSON.parse(await readFile(resolve(unitsRoot, metadataFile), 'utf8'));
  if (!metadata?.targets || typeof metadata.targets !== 'object') continue;
  for (const [targetKey, target] of Object.entries(metadata.targets)) {
    if (!target?.motions) continue;
    let representativePath;
    try {
      representativePath = relativePngPath(targetKey, target, 'idle');
    } catch {
      continue;
    }
    if (recordsByPath.has(representativePath)) continue;
    recordsByPath.set(representativePath, {
      metadataFile,
      targetKey,
      target,
      rootUnitId: rootUnitId(targetKey, target),
    });
  }
}

const analyzed = [];
for (const record of recordsByPath.values()) {
  const motions = {};
  for (const motion of MOTIONS) motions[motion] = await analyzeMotion(record.targetKey, record.target, motion);
  const reasons = [];
  let score = 100;
  const allMotionStats = Object.values(motions);
  const maxEdgeRatio = Math.max(...allMotionStats.map((item) => item.maxEdgeRatio));
  const minOccupancy = Math.min(...allMotionStats.map((item) => item.occupancy));
  const maxOccupancy = Math.max(...allMotionStats.map((item) => item.occupancy));
  if (maxEdgeRatio > 0.08) { score -= 22; reasons.push(`clipping-risk:${round(maxEdgeRatio)}`); }
  else if (maxEdgeRatio > 0.025) { score -= 10; reasons.push(`edge-contact:${round(maxEdgeRatio)}`); }
  if (minOccupancy < 0.015) { score -= 14; reasons.push(`very-sparse:${round(minOccupancy)}`); }
  if (maxOccupancy > 0.72) { score -= 12; reasons.push(`overfilled:${round(maxOccupancy)}`); }
  if (motions.move.avgDelta < 0.018) { score -= 18; reasons.push(`weak-move:${motions.move.avgDelta}`); }
  else if (motions.move.avgDelta < 0.035) { score -= 8; reasons.push(`low-move:${motions.move.avgDelta}`); }
  if (motions.attack.maxDelta < 0.045) { score -= 24; reasons.push(`weak-attack:${motions.attack.maxDelta}`); }
  else if (motions.attack.avgDelta < 0.035) { score -= 10; reasons.push(`low-attack:${motions.attack.avgDelta}`); }
  analyzed.push({
    ...record,
    motions,
    signature: motions.idle.firstSignature,
    score,
    reasons,
  });
}

for (const current of analyzed) {
  let nearest = null;
  for (const other of analyzed) {
    if (other === current || other.rootUnitId === current.rootUnitId) continue;
    const similarity = iou(current.signature, other.signature);
    if (!nearest || similarity > nearest.similarity) nearest = { targetKey: other.targetKey, rootUnitId: other.rootUnitId, similarity };
  }
  current.nearestOther = nearest ? { ...nearest, similarity: round(nearest.similarity) } : null;
  if (nearest?.similarity > 0.94) { current.score -= 20; current.reasons.push(`near-duplicate:${round(nearest.similarity)}`); }
  else if (nearest?.similarity > 0.88) { current.score -= 9; current.reasons.push(`high-similarity:${round(nearest.similarity)}`); }
}

const recruitmentForms = analyzed.filter((item) => item.metadataFile === 'recruitment-form-runtime-metadata.json');
const recruitmentByUnit = new Map();
for (const item of recruitmentForms) {
  const unitId = item.target.unitId;
  const order = item.target.formOrder;
  if (typeof unitId !== 'string' || !Number.isInteger(order)) continue;
  if (!recruitmentByUnit.has(unitId)) recruitmentByUnit.set(unitId, new Map());
  recruitmentByUnit.get(unitId).set(order, item);
}
const recruitmentEvolution = [];
for (const [unitId, forms] of recruitmentByUnit.entries()) {
  const f1 = forms.get(1), f2 = forms.get(2), f3 = forms.get(3);
  assert(f1 && f2 && f3, `${unitId} missing F1/F2/F3 in quality audit`);
  const s12 = iou(f1.signature, f2.signature);
  const s23 = iou(f2.signature, f3.signature);
  const s13 = iou(f1.signature, f3.signature);
  const worst = Math.max(s12, s23, s13);
  let status = 'GOOD';
  if (worst > 0.9) status = 'WEAK';
  else if (worst > 0.82) status = 'WATCH';
  if (status !== 'GOOD') {
    const penalty = status === 'WEAK' ? 18 : 8;
    for (const item of [f1, f2, f3]) {
      item.score -= penalty;
      item.reasons.push(`weak-evolution-separation:${round(worst)}`);
    }
  }
  recruitmentEvolution.push({
    unitId,
    f1ToF2Similarity: round(s12),
    f2ToF3Similarity: round(s23),
    f1ToF3Similarity: round(s13),
    worstSimilarity: round(worst),
    status,
  });
}

for (const item of analyzed) item.score = Math.max(0, Math.round(item.score));
analyzed.sort((a, b) => a.score - b.score || a.targetKey.localeCompare(b.targetKey));
recruitmentEvolution.sort((a, b) => b.worstSimilarity - a.worstSimilarity || a.unitId.localeCompare(b.unitId));

const publicRecord = (item) => ({
  metadataFile: item.metadataFile,
  targetKey: item.targetKey,
  assetId: item.target.assetId ?? null,
  unitId: item.target.unitId ?? item.rootUnitId,
  formId: item.target.formId ?? null,
  formOrder: item.target.formOrder ?? null,
  score: item.score,
  reasons: item.reasons,
  nearestOther: item.nearestOther,
  motions: Object.fromEntries(MOTIONS.map((motion) => [motion, {
    frames: item.motions[motion].frames,
    frameWidth: item.motions[motion].frameWidth,
    frameHeight: item.motions[motion].frameHeight,
    occupancy: item.motions[motion].occupancy,
    widthCoverage: item.motions[motion].widthCoverage,
    heightCoverage: item.motions[motion].heightCoverage,
    maxEdgeRatio: item.motions[motion].maxEdgeRatio,
    avgDelta: item.motions[motion].avgDelta,
    maxDelta: item.motions[motion].maxDelta,
  }])),
});

const severe = analyzed.filter((item) => item.score < 55).length;
const atRisk = analyzed.filter((item) => item.score >= 55 && item.score < 75).length;
const weakEvolution = recruitmentEvolution.filter((entry) => entry.status === 'WEAK').length;
const watchEvolution = recruitmentEvolution.filter((entry) => entry.status === 'WATCH').length;
const clippingRisk = analyzed.filter((item) => item.reasons.some((reason) => reason.startsWith('clipping-risk:'))).length;
const report = {
  schemaVersion: 1,
  generatedBy: 'tools/audit-production-art-quality.mjs',
  auditKind: 'POLISH_PRIORITY_SELECTOR',
  humanApprovalAuthority: false,
  note: 'Scores prioritize visual polish; they do not approve or reject production art.',
  metadataFiles,
  summary: {
    totalTargets: analyzed.length,
    totalStripsAudited: analyzed.length * MOTIONS.length,
    motionsAuditedPerTarget: MOTIONS,
    severe,
    atRisk,
    healthy: analyzed.length - severe - atRisk,
    recruitmentEvolutionGroups: recruitmentEvolution.length,
    weakEvolution,
    watchEvolution,
    clippingRisk,
  },
  topPriorities: analyzed.slice(0, 40).map(publicRecord),
  recruitmentEvolution,
  targets: analyzed.map(publicRecord),
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`[production-art-quality] audited ${report.summary.totalTargets} targets / ${report.summary.totalStripsAudited} strips`);
console.log(`[production-art-quality] severe=${severe} atRisk=${atRisk} healthy=${report.summary.healthy} weakEvolution=${weakEvolution} watchEvolution=${watchEvolution} clippingRisk=${clippingRisk}`);
for (const item of analyzed.slice(0, 20)) console.log(`[production-art-quality] ${String(item.score).padStart(3)} ${item.targetKey} :: ${item.reasons.join(', ') || 'no flags'}`);
