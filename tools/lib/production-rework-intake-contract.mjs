import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const REQUIRED_MOTIONS = ['idle', 'move', 'attack', 'knockback', 'death'];
export const ALLOWED_REASONS = ['silhouette', 'motion', 'attack-contact', 'scale-clipping', 'combat-readability', 'form-distinction', 'other'];
export const MODES = [
  ['first-slice', 'first-slice-runtime-metadata.json'],
  ['second-slice', 'second-slice-runtime-metadata.json'],
  ['third-slice', 'third-slice-runtime-metadata.json'],
  ['fourth-slice', 'fourth-slice-runtime-metadata.json'],
  ['fifth-slice', 'fifth-slice-runtime-metadata.json'],
  ['sixth-slice', 'sixth-slice-runtime-metadata.json'],
  ['chapter-02', 'chapter-02-runtime-metadata.json'],
  ['chapter-03', 'chapter-03-runtime-metadata.json'],
  ['chapter-04', 'chapter-04-runtime-metadata.json'],
  ['special-content', 'special-content-runtime-metadata.json'],
  ['recruitment', 'recruitment-form-runtime-metadata.json'],
].map(([id, metadataFile]) => ({ id, metadataFile }));

const MODE_BY_ID = new Map(MODES.map((mode) => [mode.id, mode]));
const FORBIDDEN_KEYS = new Set([
  'reviewerId',
  'reviewer',
  'reviewedAt',
  'approval',
  'approvedAt',
  'provenance',
  'runtimeFiles',
  'evidence',
  'captures',
]);

function fail(message) {
  throw new Error(`[production-rework-intake] ${message}`);
}

function assertNoForbiddenClaims(value, path = 'draft') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) fail(`${path} must not contain ${key}`);
    assertNoForbiddenClaims(child, `${path}.${key}`);
  }
}

function normalizedReviewState(metadata) {
  if (metadata.humanReview === 'PENDING') return 'PENDING';
  if (metadata.reviewStatus === 'PENDING') return 'PENDING';
  if (metadata.reviewStatus === 'UNREVIEWED_RUNTIME_FILES') return 'UNREVIEWED_RUNTIME_FILES';
  if (metadata.status === 'UNREVIEWED_RUNTIME_FILES') return 'UNREVIEWED_RUNTIME_FILES';
  return metadata.humanReview ?? metadata.reviewStatus ?? metadata.status ?? 'UNSPECIFIED';
}

export async function loadProductionTargetIndex(root) {
  const unitsRoot = resolve(root, 'apps/client/public/assets/production/units');
  const index = new Map();
  for (const mode of MODES) {
    const metadata = JSON.parse(await readFile(resolve(unitsRoot, mode.metadataFile), 'utf8'));
    const reviewState = normalizedReviewState(metadata);
    if (reviewState !== 'PENDING' && reviewState !== 'UNREVIEWED_RUNTIME_FILES') {
      fail(`${mode.id} review state must remain pending/unreviewed, got ${reviewState}`);
    }
    if ((metadata.normalRuntimeAuthoritative ?? false) !== false) fail(`${mode.id} runtime authority drift`);
    if ((metadata.generativeAiUsed ?? false) !== false) fail(`${mode.id} generativeAiUsed drift`);

    for (const [targetKey, target] of Object.entries(metadata.targets ?? {})) {
      if (!target || typeof target !== 'object') fail(`${mode.id}/${targetKey} invalid target metadata`);
      if (typeof target.assetId !== 'string' || !target.assetId) fail(`${mode.id}/${targetKey} missing assetId`);
      for (const motion of REQUIRED_MOTIONS) {
        if (!target.motions?.[motion]) fail(`${mode.id}/${targetKey} missing ${motion}`);
      }
      const key = `${mode.id}:${targetKey}`;
      if (index.has(key)) fail(`duplicate target identity ${key}`);
      index.set(key, {
        modeId: mode.id,
        metadataFile: mode.metadataFile,
        targetKey,
        assetId: target.assetId,
        reviewState,
        normalRuntimeAuthoritative: false,
        generativeAiUsed: false,
      });
    }
  }
  return index;
}

export function validateLocalReworkDraft(draft, { requireEntries = true } = {}) {
  assertNoForbiddenClaims(draft);
  if (!draft || typeof draft !== 'object') fail('draft must be an object');
  if (draft.schemaVersion !== 1) fail('draft schemaVersion must be 1');
  if (draft.kind !== 'LOCAL_REWORK_TRIAGE_DRAFT') fail('unexpected draft kind');
  if (draft.humanApprovalAuthority !== false) fail('humanApprovalAuthority must be false');
  if (draft.canonicalWrite !== false) fail('canonicalWrite must be false');
  if (draft.approvalEvidence !== false) fail('approvalEvidence must be false');
  if (!Array.isArray(draft.entries)) fail('entries must be an array');
  if (requireEntries && draft.entries.length === 0) fail('cannot import an empty draft');

  const seen = new Set();
  for (const [i, entry] of draft.entries.entries()) {
    const path = `entries[${i}]`;
    if (!entry || typeof entry !== 'object') fail(`${path} must be an object`);
    if (!MODE_BY_ID.has(entry.modeId)) fail(`${path} unknown modeId ${entry.modeId}`);
    if (typeof entry.targetKey !== 'string' || !entry.targetKey) fail(`${path} missing targetKey`);
    if (typeof entry.assetId !== 'string' || !entry.assetId) fail(`${path} missing assetId`);
    if (entry.localDisposition !== 'REVISIT' && entry.localDisposition !== 'BLOCKER') {
      fail(`${path} needs explicit REVISIT or BLOCKER disposition before import`);
    }
    if (typeof entry.galleryChecked !== 'boolean') fail(`${path} galleryChecked must be boolean`);
    if (typeof entry.galleryRevisit !== 'boolean') fail(`${path} galleryRevisit must be boolean`);
    if (!Array.isArray(entry.reasons)) fail(`${path} reasons must be an array`);
    if (new Set(entry.reasons).size !== entry.reasons.length) fail(`${path} duplicate reason`);
    for (const reason of entry.reasons) {
      if (!ALLOWED_REASONS.includes(reason)) fail(`${path} unknown reason ${reason}`);
    }
    if (entry.note !== null && entry.note !== undefined) {
      if (typeof entry.note !== 'string') fail(`${path} note must be string or null`);
      if (entry.note.length > 1200) fail(`${path} note exceeds 1200 characters`);
    }
    const identity = `${entry.modeId}:${entry.targetKey}`;
    if (seen.has(identity)) fail(`${path} duplicate target ${identity}`);
    seen.add(identity);
  }
  return draft;
}

export function normalizeLocalDraftToIntake(draft, targetIndex) {
  validateLocalReworkDraft(draft);
  const items = draft.entries.map((entry) => {
    const identity = `${entry.modeId}:${entry.targetKey}`;
    const canonical = targetIndex.get(identity);
    if (!canonical) fail(`${identity} does not exist in current runtime metadata`);
    if (canonical.assetId !== entry.assetId) {
      fail(`${identity} assetId mismatch: draft=${entry.assetId}, current=${canonical.assetId}`);
    }
    return {
      modeId: entry.modeId,
      metadataFile: canonical.metadataFile,
      targetKey: entry.targetKey,
      assetId: canonical.assetId,
      disposition: entry.localDisposition,
      reasons: [...entry.reasons],
      note: entry.note?.trim() || null,
      reviewSignals: {
        galleryChecked: entry.galleryChecked,
        galleryRevisit: entry.galleryRevisit,
      },
      currentRuntimeBoundary: {
        reviewState: canonical.reviewState,
        normalRuntimeAuthoritative: false,
        generativeAiUsed: false,
      },
      requestedAction: 'REWORK_CANDIDATE_ONLY',
    };
  });

  return {
    schemaVersion: 1,
    kind: 'PRODUCTION_ART_REWORK_INTAKE',
    status: 'WORKBENCH',
    sourceKind: 'LOCAL_REWORK_TRIAGE_DRAFT',
    humanApprovalAuthority: false,
    canonicalWrite: false,
    approvalEvidence: false,
    promotionEligible: false,
    requiredMotions: [...REQUIRED_MOTIONS],
    itemCount: items.length,
    items,
    promotionGate: {
      requiresCommittedRuntimeFiles: true,
      requiresCommittedProvenance: true,
      requiresCommittedReviewEvidence: true,
      requiresExplicitHumanApproval: true,
    },
  };
}
