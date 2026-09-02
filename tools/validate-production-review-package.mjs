import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW_PATH = 'assets/raw/production/review-package-01.json';
const SLICE_PATH = 'assets/raw/production/vertical-slice-01.json';
const VALID_TARGET_STATUSES = new Set(['AWAITING_ART', 'READY_FOR_REVIEW', 'APPROVED']);
const VALID_REVIEW_STATUSES = new Set(['PENDING', 'IN_REVIEW', 'COMPLETE']);
const VALID_PRODUCTION_METHODS = new Set(['MANUAL', 'AI', 'MIXED']);

const EXPECTED_VIEWPORTS = new Map([
  ['desktop-1280x720', { deviceClass: 'desktop', sourceWidth: 1280, sourceHeight: 720, width: 1280, height: 720 }],
  ['mobile-390x844-landscape', { deviceClass: '390x844', sourceWidth: 390, sourceHeight: 844, width: 844, height: 390 }],
  ['mobile-360x640-landscape', { deviceClass: '360x640', sourceWidth: 360, sourceHeight: 640, width: 640, height: 360 }],
]);

const REQUIRED_PROFILE_CONTRACTS = {
  PLAYER_FORM: {
    evidence: ['turnaround-reference', 'silhouette-comparison', 'motion-key-poses', 'contact-board', 'scale-sheet', 'closest-three-differences'],
    captures: ['silhouette-comparison', 'mobile-wide-standard', 'mobile-small-standard', 'overlap-8-12', 'bright-background', 'dark-background', 'contact-alignment'],
    checks: ['silhouetteReadable', 'f1f2f3DistinctWithoutColor', 'nearestNeighborDistinct', 'motionReadable', 'contactAligned', 'knockbackDeathAuthored', 'mobileReadable', 'overlapReadable', 'brightDarkReadable'],
  },
  ENEMY: {
    evidence: ['turnaround-reference', 'silhouette-comparison', 'motion-key-poses', 'contact-board', 'scale-sheet', 'closest-three-differences'],
    captures: ['silhouette-comparison', 'mobile-wide-standard', 'mobile-small-standard', 'overlap-8-12', 'bright-background', 'dark-background', 'contact-alignment'],
    checks: ['silhouetteReadable', 'nearestNeighborDistinct', 'motionReadable', 'contactAligned', 'knockbackDeathAuthored', 'mobileReadable', 'overlapReadable', 'brightDarkReadable'],
  },
  BOSS: {
    evidence: ['turnaround-reference', 'silhouette-comparison', 'motion-key-poses', 'contact-board', 'scale-sheet', 'closest-three-differences'],
    captures: ['silhouette-comparison', 'mobile-wide-standard', 'mobile-small-standard', 'overlap-8-12', 'bright-background', 'dark-background', 'contact-alignment', 'boss-small-screen'],
    checks: ['silhouetteReadable', 'nearestNeighborDistinct', 'motionReadable', 'contactAligned', 'knockbackDeathAuthored', 'mobileReadable', 'overlapReadable', 'brightDarkReadable', 'bossMaskBodyReadable', 'warningReadable'],
  },
  BATTLEFIELD: {
    evidence: ['battlefield-base', 'foreground-low-density', 'background-landmarks', 'crop-guide', 'readability-board'],
    captures: ['mobile-wide-standard', 'mobile-small-standard', 'overlap-8-12', 'bright-background', 'dark-background'],
    checks: ['mobileReadable', 'overlapReadable', 'brightDarkReadable', 'combatLineLowDensity', 'backgroundDoesNotImplyCollision', 'hudReadable'],
  },
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sameSet(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && new Set(actual).size === actual.length
    && expected.every((value) => actual.includes(value));
}

function safeRelativeFile(relativeFile, label) {
  invariant(typeof relativeFile === 'string' && relativeFile.length > 0, `${label} must be a non-empty relative file path`);
  invariant(!path.isAbsolute(relativeFile) && !relativeFile.includes('..'), `${label} must stay inside reviewAssetRoot`);
  invariant(relativeFile.toLowerCase().endsWith('.png'), `${label} review evidence must be PNG`);
  const absolute = path.join(ROOT, review.reviewAssetRoot, relativeFile);
  invariant(fs.existsSync(absolute), `${label} file does not exist: ${absolute}`);
  return absolute;
}

function pngDimensions(filePath) {
  const data = fs.readFileSync(filePath);
  invariant(data.length >= 24, `PNG is too small: ${filePath}`);
  invariant(data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', `not a PNG file: ${filePath}`);
  invariant(data.subarray(12, 16).toString('ascii') === 'IHDR', `PNG missing IHDR: ${filePath}`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function expectedProfileForSliceTarget(target) {
  if (target.assetId.startsWith('battlefield:')) return 'BATTLEFIELD';
  if (target.kind === 'PLAYER_FORM') return 'PLAYER_FORM';
  if (target.kind === 'ENEMY') return 'ENEMY';
  if (target.kind === 'BOSS') return 'BOSS';
  throw new Error(`unknown slice target kind for ${target.assetId}`);
}

function validateProvenance(target) {
  const provenance = target.provenance;
  invariant(provenance && typeof provenance === 'object', `${target.assetId} reviewable target requires provenance`);
  invariant(typeof provenance.authorOrSource === 'string' && provenance.authorOrSource.trim().length > 0, `${target.assetId} provenance.authorOrSource required`);
  invariant(typeof provenance.rightsOrLicense === 'string' && provenance.rightsOrLicense.trim().length > 0, `${target.assetId} provenance.rightsOrLicense required`);
  invariant(VALID_PRODUCTION_METHODS.has(provenance.productionMethod), `${target.assetId} productionMethod must be MANUAL/AI/MIXED`);
  invariant(typeof provenance.modifications === 'string' && provenance.modifications.trim().length > 0, `${target.assetId} provenance.modifications required`);
  invariant(Array.isArray(provenance.masterFiles) && provenance.masterFiles.length > 0 && provenance.masterFiles.every((entry) => typeof entry === 'string' && entry.trim().length > 0), `${target.assetId} provenance.masterFiles required`);
  invariant(Array.isArray(provenance.runtimeFiles) && provenance.runtimeFiles.length > 0 && provenance.runtimeFiles.every((entry) => typeof entry === 'string' && entry.trim().length > 0), `${target.assetId} provenance.runtimeFiles required`);
}

function validateEvidence(target, profile) {
  invariant(target.evidence && typeof target.evidence === 'object' && !Array.isArray(target.evidence), `${target.assetId} reviewable target requires evidence object`);
  invariant(target.captures && typeof target.captures === 'object' && !Array.isArray(target.captures), `${target.assetId} reviewable target requires captures object`);

  for (const evidenceId of profile.requiredEvidence) {
    safeRelativeFile(target.evidence[evidenceId], `${target.assetId} evidence ${evidenceId}`);
  }
  for (const scenarioId of profile.requiredCaptures) {
    const absolute = safeRelativeFile(target.captures[scenarioId], `${target.assetId} capture ${scenarioId}`);
    const scenario = scenarioById.get(scenarioId);
    invariant(scenario, `${target.assetId} references unknown capture scenario ${scenarioId}`);
    const viewport = viewportById.get(scenario.viewportId);
    invariant(viewport, `${target.assetId} capture ${scenarioId} references unknown viewport`);
    const dimensions = pngDimensions(absolute);
    invariant(dimensions.width === viewport.cssViewport.width && dimensions.height === viewport.cssViewport.height,
      `${target.assetId} capture ${scenarioId} must be ${viewport.cssViewport.width}x${viewport.cssViewport.height}, got ${dimensions.width}x${dimensions.height}`);
  }
}

function validateHumanReview(target, profile, sliceTarget) {
  const humanReview = target.humanReview;
  invariant(humanReview && typeof humanReview === 'object', `${target.assetId} requires humanReview state`);
  invariant(VALID_REVIEW_STATUSES.has(humanReview.status), `${target.assetId} has invalid humanReview.status`);

  if (target.status === 'AWAITING_ART') {
    invariant(humanReview.status === 'PENDING', `${target.assetId} AWAITING_ART must keep human review PENDING`);
    invariant(humanReview.reviewer === null && humanReview.reviewedAt === null && humanReview.checklist === null,
      `${target.assetId} AWAITING_ART must not invent reviewer/checklist data`);
    return;
  }

  if (target.status === 'READY_FOR_REVIEW') {
    invariant(humanReview.status !== 'COMPLETE', `${target.assetId} completed human review must advance to APPROVED or be explicitly rejected outside this lifecycle`);
    return;
  }

  invariant(target.status === 'APPROVED', `${target.assetId} unexpected review lifecycle state`);
  invariant(humanReview.status === 'COMPLETE', `${target.assetId} APPROVED requires COMPLETE human review`);
  invariant(typeof humanReview.reviewer === 'string' && humanReview.reviewer.trim().length > 0, `${target.assetId} APPROVED requires reviewer`);
  invariant(typeof humanReview.reviewedAt === 'string' && !Number.isNaN(Date.parse(humanReview.reviewedAt)), `${target.assetId} APPROVED requires ISO-compatible reviewedAt`);
  invariant(humanReview.checklist && typeof humanReview.checklist === 'object' && !Array.isArray(humanReview.checklist), `${target.assetId} APPROVED requires checklist`);
  for (const checkId of profile.requiredChecks) {
    invariant(humanReview.checklist[checkId] === true, `${target.assetId} APPROVED requires ${checkId}=true`);
  }
  invariant(sliceTarget.humanReviewComplete === true, `${target.assetId} APPROVED must also set vertical-slice humanReviewComplete=true`);
}

const review = readJson(REVIEW_PATH);
const slice = readJson(SLICE_PATH);

invariant(review.id === 'frontline-production-review-package-01', 'unexpected production review package id');
invariant(review.status === 'DESIGN_TARGET', 'review package must remain DESIGN_TARGET until real submissions exist');
invariant(review.verticalSliceId === slice.id, 'review package must reference the current vertical slice id');
invariant(review.orientation === 'landscape', 'first production review package must be landscape');
invariant(review.reviewAssetRoot === 'assets/raw/production/review/vertical-slice-01', 'unexpected reviewAssetRoot');
invariant(Array.isArray(review.viewportProfiles) && review.viewportProfiles.length === EXPECTED_VIEWPORTS.size, 'review package must define exactly three first-slice viewport profiles');

const viewportById = new Map(review.viewportProfiles.map((viewport) => [viewport.id, viewport]));
invariant(viewportById.size === review.viewportProfiles.length, 'viewport profile ids must be unique');
for (const [id, expected] of EXPECTED_VIEWPORTS) {
  const viewport = viewportById.get(id);
  invariant(viewport, `missing required viewport profile: ${id}`);
  invariant(viewport.deviceClass === expected.deviceClass, `${id} deviceClass drifted`);
  invariant(viewport.sourceDevice?.width === expected.sourceWidth && viewport.sourceDevice?.height === expected.sourceHeight, `${id} sourceDevice dimensions drifted`);
  invariant(viewport.cssViewport?.width === expected.width && viewport.cssViewport?.height === expected.height, `${id} landscape CSS viewport must be ${expected.width}x${expected.height}`);
  invariant(viewport.cssViewport.width > viewport.cssViewport.height, `${id} must resolve to landscape orientation`);
}

invariant(Array.isArray(review.captureScenarios) && review.captureScenarios.length >= 8, 'review package needs the complete first-slice capture scenario set');
const scenarioById = new Map(review.captureScenarios.map((scenario) => [scenario.id, scenario]));
invariant(scenarioById.size === review.captureScenarios.length, 'capture scenario ids must be unique');
for (const scenario of review.captureScenarios) {
  invariant(viewportById.has(scenario.viewportId), `${scenario.id} references unknown viewport ${scenario.viewportId}`);
  invariant(typeof scenario.description === 'string' && scenario.description.trim().length > 0, `${scenario.id} needs a review description`);
  invariant(typeof scenario.grayscaleRequired === 'boolean', `${scenario.id} must state grayscaleRequired`);
}
invariant(scenarioById.get('silhouette-comparison')?.grayscaleRequired === true, 'silhouette comparison must be grayscale');
invariant(scenarioById.get('overlap-8-12')?.minimumVisibleUnits === 8 && scenarioById.get('overlap-8-12')?.maximumVisibleUnits === 12, 'overlap stress capture must require 8-12 visible units');
invariant(scenarioById.get('boss-small-screen')?.viewportId === 'mobile-360x640-landscape', 'boss small-screen capture must use the smallest viewport');

invariant(review.reviewProfiles && typeof review.reviewProfiles === 'object', 'reviewProfiles required');
for (const [profileId, contract] of Object.entries(REQUIRED_PROFILE_CONTRACTS)) {
  const profile = review.reviewProfiles[profileId];
  invariant(profile, `missing review profile: ${profileId}`);
  invariant(sameSet(profile.requiredEvidence, contract.evidence), `${profileId} requiredEvidence contract drifted`);
  invariant(sameSet(profile.requiredCaptures, contract.captures), `${profileId} requiredCaptures contract drifted`);
  invariant(sameSet(profile.requiredChecks, contract.checks), `${profileId} requiredChecks contract drifted`);
  invariant(profile.requiredCaptures.every((scenarioId) => scenarioById.has(scenarioId)), `${profileId} references unknown capture scenario`);
}

const sliceTargets = [...slice.units, ...slice.battlefields];
invariant(Array.isArray(review.targets) && review.targets.length === sliceTargets.length, 'review package target count must equal vertical-slice target count');
invariant(new Set(review.targets.map((target) => target.assetId)).size === review.targets.length, 'review target ids must be unique');

for (const sliceTarget of sliceTargets) {
  const target = review.targets.find((candidate) => candidate.assetId === sliceTarget.assetId);
  invariant(target, `review package missing vertical-slice target ${sliceTarget.assetId}`);
  invariant(VALID_TARGET_STATUSES.has(target.status), `${target.assetId} has invalid target status`);
  invariant(target.status === sliceTarget.status, `${target.assetId} review status must match vertical-slice status`);
  const expectedProfile = expectedProfileForSliceTarget(sliceTarget);
  invariant(target.reviewProfile === expectedProfile, `${target.assetId} must use ${expectedProfile} review profile`);
  const profile = review.reviewProfiles[target.reviewProfile];

  if (target.status === 'AWAITING_ART') {
    invariant(target.evidence === null && target.captures === null && target.provenance === null,
      `${target.assetId} AWAITING_ART must not contain fabricated evidence/provenance`);
  } else {
    validateEvidence(target, profile);
    validateProvenance(target);
  }
  validateHumanReview(target, profile, sliceTarget);
}

for (const target of review.targets) {
  invariant(sliceTargets.some((sliceTarget) => sliceTarget.assetId === target.assetId), `review package contains unknown target ${target.assetId}`);
}

console.log(`production review package OK: ${review.targets.length} targets, ${review.viewportProfiles.length} landscape viewports, ${review.captureScenarios.length} QA capture scenarios`);
