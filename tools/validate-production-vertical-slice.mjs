import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'assets/raw/production/vertical-slice-01.json');
const REQUIRED_MOTIONS = ['idle', 'move', 'attack', 'knockback', 'death'];
const VALID_STATUSES = new Set(['AWAITING_ART', 'READY_FOR_REVIEW', 'APPROVED']);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function expectedRuntimeRoot(unit) {
  return unit.formId
    ? `apps/client/public/assets/production/units/${unit.unitId}/${unit.formId}`
    : `apps/client/public/assets/production/units/${unit.unitId}`;
}

function pngDimensions(filePath) {
  const data = fs.readFileSync(filePath);
  invariant(data.length >= 24, `PNG is too small: ${filePath}`);
  const signature = '89504e470d0a1a0a';
  invariant(data.subarray(0, 8).toString('hex') === signature, `not a PNG file: ${filePath}`);
  invariant(data.subarray(12, 16).toString('ascii') === 'IHDR', `PNG missing IHDR header: ${filePath}`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function validateRuntimeSpriteFiles(unit) {
  const runtime = unit.runtime;
  invariant(runtime && typeof runtime === 'object', `${unit.assetId} ${unit.status} requires runtime metadata`);
  invariant(Number.isFinite(runtime.displayHeight) && runtime.displayHeight > 0, `${unit.assetId} requires positive runtime.displayHeight`);
  invariant(Number.isInteger(runtime.attackContactFrame) && runtime.attackContactFrame >= 0, `${unit.assetId} requires non-negative runtime.attackContactFrame`);
  invariant(runtime.strips && typeof runtime.strips === 'object', `${unit.assetId} requires runtime.strips`);

  for (const motion of REQUIRED_MOTIONS) {
    const strip = runtime.strips[motion];
    invariant(strip && typeof strip === 'object', `${unit.assetId} missing runtime strip: ${motion}`);
    invariant(typeof strip.file === 'string' && strip.file.length > 0, `${unit.assetId}/${motion} missing file`);
    invariant(Number.isInteger(strip.frameWidth) && strip.frameWidth > 0, `${unit.assetId}/${motion} invalid frameWidth`);
    invariant(Number.isInteger(strip.frameHeight) && strip.frameHeight > 0, `${unit.assetId}/${motion} invalid frameHeight`);
    invariant(Number.isInteger(strip.frames) && strip.frames > 0, `${unit.assetId}/${motion} invalid frames`);
    invariant(!path.isAbsolute(strip.file) && !strip.file.includes('..'), `${unit.assetId}/${motion} file must stay inside runtimeRoot`);
    const absolute = path.join(ROOT, unit.runtimeRoot, strip.file);
    invariant(fs.existsSync(absolute), `${unit.assetId}/${motion} runtime file does not exist: ${absolute}`);
    const dimensions = pngDimensions(absolute);
    invariant(dimensions.width === strip.frameWidth * strip.frames,
      `${unit.assetId}/${motion} sheet width ${dimensions.width} != frameWidth*frames ${strip.frameWidth * strip.frames}`);
    invariant(dimensions.height === strip.frameHeight,
      `${unit.assetId}/${motion} sheet height ${dimensions.height} != frameHeight ${strip.frameHeight}`);
  }

  invariant(runtime.attackContactFrame < runtime.strips.attack.frames,
    `${unit.assetId} attackContactFrame must fit attack sprite frames`);
  if (unit.status === 'APPROVED') {
    invariant(unit.humanReviewComplete === true, `${unit.assetId} cannot be APPROVED before humanReviewComplete=true`);
  }
}

const manifest = readJson('assets/raw/production/vertical-slice-01.json');
const storyUnits = readJson('content/units/chapter-01.json');
const storyEvolution = readJson('content/evolution/story-01-overrides.json');
const enemies = readJson('content/enemies/main-01-02.json');
const chapterOneStages = readJson('content/stages/chapter-01.json');

invariant(manifest.id === 'frontline-production-vertical-slice-01', 'unexpected production vertical-slice id');
invariant(manifest.status === 'DESIGN_TARGET', 'vertical slice must remain DESIGN_TARGET until real reviewed assets exist');
invariant(manifest.runtimePublicRoot === 'apps/client/public/assets/production', 'runtimePublicRoot must match Vite public production path');
invariant(Array.isArray(manifest.units), 'manifest.units must be an array');
invariant(Array.isArray(manifest.battlefields), 'manifest.battlefields must be an array');

const militiaBase = storyUnits.find((unit) => unit.id === 'militia');
const militiaEvolution = storyEvolution.find((entry) => entry.id === 'militia');
const raider = enemies.find((enemy) => enemy.id === 'enemy-raider');
const chapterOneBoss = enemies.find((enemy) => enemy.id === 'enemy-boss');
const firstStage = chapterOneStages[0];
invariant(militiaBase && militiaEvolution && raider && chapterOneBoss && firstStage, 'canonical source data for vertical slice is incomplete');

const expectedUnits = [
  {
    assetId: 'unit:militia:militia_f1', kind: 'PLAYER_FORM', unitId: 'militia', formId: 'militia_f1',
    displayName: militiaBase.displayName, hitFrames: militiaBase.hitFrames,
  },
  ...militiaEvolution.forms.filter((form) => form.formOrder > 1).map((form) => ({
    assetId: `unit:militia:${form.formId}`, kind: 'PLAYER_FORM', unitId: 'militia', formId: form.formId,
    displayName: form.name, hitFrames: form.modifiers.attackTiming.hitFrames,
  })),
  {
    assetId: 'unit:enemy-raider', kind: 'ENEMY', unitId: 'enemy-raider', displayName: raider.displayName, hitFrames: raider.hitFrames,
  },
  {
    assetId: 'unit:enemy-boss', kind: 'BOSS', unitId: 'enemy-boss', displayName: chapterOneBoss.displayName, hitFrames: chapterOneBoss.hitFrames,
  },
];

invariant(manifest.units.length === expectedUnits.length,
  `vertical slice must contain exactly ${expectedUnits.length} unit targets`);
invariant(new Set(manifest.units.map((unit) => unit.assetId)).size === manifest.units.length, 'vertical-slice unit asset ids must be unique');

for (const expected of expectedUnits) {
  const unit = manifest.units.find((candidate) => candidate.assetId === expected.assetId);
  invariant(unit, `missing vertical-slice unit: ${expected.assetId}`);
  invariant(VALID_STATUSES.has(unit.status), `${unit.assetId} has invalid status: ${unit.status}`);
  invariant(unit.kind === expected.kind, `${unit.assetId} kind drifted from canonical target`);
  invariant(unit.unitId === expected.unitId, `${unit.assetId} unitId drifted from canonical target`);
  invariant((unit.formId ?? undefined) === (expected.formId ?? undefined), `${unit.assetId} formId drifted from canonical target`);
  invariant(unit.displayName === expected.displayName, `${unit.assetId} displayName drifted from canonical source`);
  invariant(unit.runtimeRoot === expectedRuntimeRoot(unit), `${unit.assetId} runtimeRoot does not match production path contract`);
  invariant(sameArray(unit.requiredMotions, REQUIRED_MOTIONS), `${unit.assetId} must require exactly idle/move/attack/knockback/death`);
  invariant(sameArray(unit.simHitFrames, expected.hitFrames),
    `${unit.assetId} simHitFrames ${JSON.stringify(unit.simHitFrames)} != runtime ${JSON.stringify(expected.hitFrames)}`);
  invariant(Array.isArray(unit.silhouetteHooks) && unit.silhouetteHooks.length >= 3, `${unit.assetId} needs at least three silhouette hooks`);
  invariant(Array.isArray(unit.differentiationAxes) && unit.differentiationAxes.length >= 2, `${unit.assetId} needs at least two differentiation axes`);
  invariant(unit.motionDirection && REQUIRED_MOTIONS.every((motion) => typeof unit.motionDirection[motion] === 'string' && unit.motionDirection[motion].length > 0),
    `${unit.assetId} must define direction for all five motions`);
  if (unit.status !== 'AWAITING_ART') validateRuntimeSpriteFiles(unit);
}

const meadow = manifest.battlefields.find((entry) => entry.assetId === `battlefield:${firstStage.theme}`);
invariant(manifest.battlefields.length === 1, 'first vertical slice must contain exactly one battlefield target');
invariant(meadow, `missing first-stage battlefield target: ${firstStage.theme}`);
invariant(meadow.themeId === firstStage.theme, 'battlefield theme drifted from main_01_001');
invariant(meadow.stageAnchor === firstStage.id, 'battlefield stageAnchor drifted from first progression stage');
invariant(meadow.runtimeRoot === `apps/client/public/assets/production/battlefields/${firstStage.theme}`, 'battlefield runtimeRoot is invalid');
invariant(VALID_STATUSES.has(meadow.status), 'battlefield has invalid review status');
invariant(Array.isArray(meadow.visualDirection) && meadow.visualDirection.length >= 4, 'battlefield needs explicit readability direction');
invariant(Array.isArray(meadow.requiredDeliverables) && meadow.requiredDeliverables.length >= 4, 'battlefield needs explicit deliverables');
if (meadow.status !== 'AWAITING_ART') {
  invariant(Array.isArray(meadow.files) && meadow.files.length > 0, 'reviewable battlefield requires files[]');
  for (const relativeFile of meadow.files) {
    invariant(typeof relativeFile === 'string' && relativeFile.length > 0 && !path.isAbsolute(relativeFile) && !relativeFile.includes('..'), 'invalid battlefield file path');
    invariant(fs.existsSync(path.join(ROOT, meadow.runtimeRoot, relativeFile)), `battlefield runtime file does not exist: ${relativeFile}`);
  }
  if (meadow.status === 'APPROVED') invariant(meadow.humanReviewComplete === true, 'battlefield cannot be APPROVED before human review');
}

console.log(`production vertical slice OK: ${manifest.units.length} units + ${manifest.battlefields.length} battlefield, all intake contracts aligned with runtime data`);
