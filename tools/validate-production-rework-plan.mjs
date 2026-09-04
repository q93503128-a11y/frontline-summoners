import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const plan = await readJson('assets/raw/production/first-slice-rework-01.json');
const slice = await readJson('assets/raw/production/vertical-slice-01.json');
const review = await readJson('assets/raw/production/review-package-01.json');

const REQUIRED = ['idle', 'move', 'attack', 'knockback', 'death'];
const EXPECTED = [
  'unit:militia:militia_f1',
  'unit:militia:militia_f2',
  'unit:militia:militia_f3',
  'unit:enemy-raider',
];

function fail(message) {
  throw new Error(`[production rework] ${message}`);
}

if (plan?.id !== 'frontline-first-slice-rework-01') fail('unexpected manifest id');
if (plan?.status !== 'WORKBENCH') fail('rework manifest must remain WORKBENCH until real production files exist');
if (JSON.stringify(plan.requiredMotions) !== JSON.stringify(REQUIRED)) fail('required motion set/order drifted');
if (!Array.isArray(plan.targets) || plan.targets.length !== EXPECTED.length) fail('first rework batch must contain exactly four targets');

const ids = plan.targets.map((target) => target.assetId);
if (new Set(ids).size !== ids.length) fail('duplicate rework target');
if (JSON.stringify([...ids].sort()) !== JSON.stringify([...EXPECTED].sort())) fail('rework target set drifted from the first character slice');

const sourceFamilies = new Set();
for (const target of plan.targets) {
  if (target.runtimeStatus !== 'AWAITING_ART') fail(`${target.assetId} must remain AWAITING_ART`);
  if (target.license !== 'CC0-1.0') fail(`${target.assetId} must use the verified CC0 source-reference pool`);
  if (target.sourceRole !== 'REWORK_BASE_AND_MOTION_REFERENCE') fail(`${target.assetId} source role is not rework-only`);
  if (typeof target.sourceFamily !== 'string' || target.sourceFamily.length === 0) fail(`${target.assetId} missing source family`);
  if (sourceFamilies.has(target.sourceFamily)) fail(`${target.assetId} reuses a first-slice source family; four-way body separation is required`);
  sourceFamilies.add(target.sourceFamily);
  if (!Array.isArray(target.mustReadWithoutColor) || target.mustReadWithoutColor.length < 3) fail(`${target.assetId} needs at least three grayscale differentiators`);
  if (!Array.isArray(target.mustNotReadAs) || target.mustNotReadAs.length < 3) fail(`${target.assetId} needs explicit anti-confusion constraints`);
  if (!target.motionLocks || typeof target.motionLocks !== 'object') fail(`${target.assetId} missing motion locks`);
  for (const motion of REQUIRED) {
    if (typeof target.motionLocks[motion] !== 'string' || target.motionLocks[motion].length < 12) fail(`${target.assetId} missing authored ${motion} direction`);
  }
  for (const forbiddenClaim of ['runtimeFiles', 'evidence', 'provenance', 'humanReview', 'reviewer', 'reviewedAt']) {
    if (Object.hasOwn(target, forbiddenClaim)) fail(`${target.assetId} workbench target must not invent ${forbiddenClaim}`);
  }
}

const sliceById = new Map(slice.units.map((entry) => [entry.assetId, entry]));
const reviewById = new Map(review.targets.map((entry) => [entry.assetId, entry]));
for (const id of EXPECTED) {
  const sliceTarget = sliceById.get(id);
  const reviewTarget = reviewById.get(id);
  if (!sliceTarget) fail(`${id} missing from vertical slice`);
  if (!reviewTarget) fail(`${id} missing from review package`);
  if (sliceTarget.status !== 'AWAITING_ART' || reviewTarget.status !== 'AWAITING_ART') fail(`${id} cannot advance before real files/evidence exist`);
  if (reviewTarget.evidence !== null || reviewTarget.captures !== null || reviewTarget.provenance !== null) fail(`${id} has fabricated review material while AWAITING_ART`);
  if (reviewTarget.humanReview?.status !== 'PENDING') fail(`${id} human review must remain pending`);
}

const gate = plan.promotionGate;
if (!gate || gate.minimumRuntimeFilesPerTarget < REQUIRED.length) fail('promotion gate requires at least one runtime file per required motion');
for (const key of ['requiresCommittedProvenance', 'requiresCommittedReviewEvidence', 'requiresHumanReviewForApproved', 'forbidTintOnlyFinal', 'forbidUnchangedSourceFinal']) {
  if (gate[key] !== true) fail(`promotion gate ${key} must remain true`);
}

console.log(`[production rework] ${plan.targets.length} targets validated; all remain AWAITING_ART with no fabricated evidence`);
