import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'assets/raw/production/concept-candidates-01.json'), 'utf8'));
const slice = JSON.parse(readFileSync(path.join(ROOT, 'assets/raw/production/vertical-slice-01.json'), 'utf8'));
const review = JSON.parse(readFileSync(path.join(ROOT, 'assets/raw/production/review-package-01.json'), 'utf8'));
const targets = new Set([...slice.units, ...slice.battlefields].map((entry) => entry.assetId));

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function pngDimensions(buffer) {
  invariant(buffer.subarray(1, 4).toString('ascii') === 'PNG', 'candidate must be a PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

invariant(manifest.id === 'frontline-production-concept-candidates-01', 'unexpected concept candidate manifest id');
invariant(manifest.status === 'DESIGN_TARGET', 'concept candidate manifest must remain DESIGN_TARGET');
invariant(Array.isArray(manifest.candidates) && manifest.candidates.length > 0, 'at least one real concept candidate is required');
invariant(new Set(manifest.candidates.map((item) => item.candidateId)).size === manifest.candidates.length, 'candidate ids must be unique');

for (const candidate of manifest.candidates) {
  invariant(candidate.reviewDisposition === 'REVISION_REQUIRED' || candidate.reviewDisposition === 'REJECTED' || candidate.reviewDisposition === 'SELECTED_FOR_DEVELOPMENT', `${candidate.candidateId} has invalid disposition`);
  invariant(candidate.productionMethod === 'AI' || candidate.productionMethod === 'MANUAL' || candidate.productionMethod === 'MIXED', `${candidate.candidateId} needs production method`);
  invariant(candidate.mayBeRuntimeArt === false, `${candidate.candidateId} concept must not masquerade as runtime art`);
  invariant(candidate.maySatisfyReviewEvidence === false, `${candidate.candidateId} concept must not satisfy formal review evidence`);
  invariant(Array.isArray(candidate.targets) && candidate.targets.length > 0 && candidate.targets.every((id) => targets.has(id)), `${candidate.candidateId} references an unknown target`);
  invariant(Array.isArray(candidate.passed) && candidate.passed.length > 0, `${candidate.candidateId} needs recorded strengths`);
  invariant(Array.isArray(candidate.failed), `${candidate.candidateId} needs recorded failures`);
  if (candidate.reviewDisposition === 'REVISION_REQUIRED') invariant(candidate.failed.length > 0, `${candidate.candidateId} revision requires concrete failures`);
  const absolute = path.join(ROOT, candidate.file);
  invariant(existsSync(absolute), `${candidate.candidateId} file missing`);
  const buffer = readFileSync(absolute);
  const dimensions = pngDimensions(buffer);
  invariant(dimensions.width === candidate.width && dimensions.height === candidate.height, `${candidate.candidateId} dimensions drifted`);
  invariant(createHash('sha256').update(buffer).digest('hex') === candidate.sha256, `${candidate.candidateId} sha256 drifted`);
}

for (const target of review.targets) {
  invariant(target.status === 'AWAITING_ART', `concept candidates must not advance ${target.assetId} review status`);
}

console.log(`production concept candidates OK: ${manifest.candidates.length} candidate(s), runtime/review promotion blocked`);
