import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadProductionTargetIndex,
  normalizeLocalDraftToIntake,
  validateLocalReworkDraft,
} from './lib/production-rework-intake-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetIndex = await loadProductionTargetIndex(root);
const reviewMaster = JSON.parse(await readFile(resolve(root, 'apps/client/public/assets/production/review/production-review-master.json'), 'utf8'));

function assert(ok, message) {
  if (!ok) throw new Error(`[production-rework-intake-contract] ${message}`);
}

function expectFail(label, fn) {
  let failed = false;
  try { fn(); } catch { failed = true; }
  assert(failed, `${label} must fail`);
}

const reviewSurfaceCount = reviewMaster.modes.reduce((sum, mode) => sum + mode.targetCount, 0);
assert(reviewMaster.modes.length === 11, `expected 11 review modes, got ${reviewMaster.modes.length}`);
assert(targetIndex.size === reviewSurfaceCount, `review surface mismatch: runtime index=${targetIndex.size}, hub=${reviewSurfaceCount}`);
assert(reviewSurfaceCount === 209, `current canonical review surface expected 209 targets/forms, got ${reviewSurfaceCount}`);
assert(reviewMaster.audit.summary.totalTargets === 242, `machine audit target count drift: ${reviewMaster.audit.summary.totalTargets}`);
assert(reviewMaster.audit.summary.totalTargets - reviewSurfaceCount === 33, 'expected 33 audited recruitment root/support targets outside canonical form queue');
assert(reviewMaster.audit.summary.healthy === reviewMaster.audit.summary.totalTargets, 'machine audit must remain fully healthy');

const first = targetIndex.get('first-slice:militia/militia_f1');
assert(first, 'first-slice test target missing');
const recruitmentEntry = [...targetIndex.values()].find((entry) => entry.modeId === 'recruitment');
assert(recruitmentEntry, 'recruitment test target missing');

const validDraft = {
  schemaVersion: 1,
  kind: 'LOCAL_REWORK_TRIAGE_DRAFT',
  humanApprovalAuthority: false,
  canonicalWrite: false,
  approvalEvidence: false,
  entries: [
    {
      modeId: first.modeId,
      targetKey: first.targetKey,
      assetId: first.assetId,
      galleryChecked: true,
      galleryRevisit: true,
      localDisposition: 'REVISIT',
      reasons: ['motion', 'attack-contact'],
      note: 'contact frame readability needs another authored pass',
    },
    {
      modeId: recruitmentEntry.modeId,
      targetKey: recruitmentEntry.targetKey,
      assetId: recruitmentEntry.assetId,
      galleryChecked: false,
      galleryRevisit: true,
      localDisposition: 'BLOCKER',
      reasons: ['form-distinction'],
      note: null,
    },
  ],
};

validateLocalReworkDraft(validDraft);
const intake = normalizeLocalDraftToIntake(validDraft, targetIndex);
assert(intake.kind === 'PRODUCTION_ART_REWORK_INTAKE', 'normalized intake kind drift');
assert(intake.status === 'WORKBENCH', 'normalized intake must remain WORKBENCH');
assert(intake.humanApprovalAuthority === false, 'intake must not gain human approval authority');
assert(intake.canonicalWrite === false, 'intake must not become a canonical writer');
assert(intake.approvalEvidence === false, 'intake must not become approval evidence');
assert(intake.promotionEligible === false, 'intake must not be promotion-eligible');
assert(intake.itemCount === 2 && intake.items.length === 2, 'normalized item count mismatch');
assert(intake.items[0].assetId === first.assetId, 'first target identity mismatch');
assert(intake.items[1].assetId === recruitmentEntry.assetId, 'recruitment target identity mismatch');
assert(intake.items.every((item) => item.requestedAction === 'REWORK_CANDIDATE_ONLY'), 'requested action boundary drift');
assert(intake.items.every((item) => item.currentRuntimeBoundary.normalRuntimeAuthoritative === false), 'runtime authority boundary drift');
assert(intake.items.every((item) => item.currentRuntimeBoundary.generativeAiUsed === false), 'AI policy boundary drift');

expectFail('null assetId', () => validateLocalReworkDraft({ ...validDraft, entries: [{ ...validDraft.entries[0], assetId: null }] }));
expectFail('neutral disposition', () => validateLocalReworkDraft({ ...validDraft, entries: [{ ...validDraft.entries[0], localDisposition: null }] }));
expectFail('unknown reason', () => validateLocalReworkDraft({ ...validDraft, entries: [{ ...validDraft.entries[0], reasons: ['made-up-reason'] }] }));
expectFail('duplicate target', () => validateLocalReworkDraft({ ...validDraft, entries: [validDraft.entries[0], validDraft.entries[0]] }));
expectFail('review identity claim', () => validateLocalReworkDraft({ ...validDraft, reviewerId: 'forbidden' }));
expectFail('review timestamp claim', () => validateLocalReworkDraft({ ...validDraft, reviewedAt: '2026-09-05T00:00:00Z' }));
expectFail('asset identity mismatch', () => normalizeLocalDraftToIntake({
  ...validDraft,
  entries: [{ ...validDraft.entries[0], assetId: 'unit:not-the-current-target' }],
}, targetIndex));
expectFail('unknown target', () => normalizeLocalDraftToIntake({
  ...validDraft,
  entries: [{ ...validDraft.entries[0], targetKey: 'missing-target' }],
}, targetIndex));

console.log(`[production-rework-intake-contract] validated ${targetIndex.size} canonical review targets/forms + 33 audit-only recruitment support targets + positive/negative import boundaries`);
