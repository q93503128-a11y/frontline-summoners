import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unitsRoot = resolve(root, 'apps/client/public/assets/production/units');
const reviewRoot = resolve(root, 'apps/client/public/assets/production/review');
const manifest = JSON.parse(await readFile(resolve(reviewRoot, 'production-review-master.json'), 'utf8'));
const html = await readFile(resolve(reviewRoot, 'index.html'), 'utf8');

const EXPECTED = [
  ['first-slice', 'first-slice-runtime-metadata.json', 'apps/client/src/first-slice-production-review-runtime.ts'],
  ['second-slice', 'second-slice-runtime-metadata.json', 'apps/client/src/second-slice-production-review-runtime.ts'],
  ['third-slice', 'third-slice-runtime-metadata.json', 'apps/client/src/third-slice-production-review-runtime.ts'],
  ['fourth-slice', 'fourth-slice-runtime-metadata.json', 'apps/client/src/fourth-slice-production-review-runtime.ts'],
  ['fifth-slice', 'fifth-slice-runtime-metadata.json', 'apps/client/src/fifth-slice-production-review-runtime.ts'],
  ['sixth-slice', 'sixth-slice-runtime-metadata.json', 'apps/client/src/sixth-slice-production-review-runtime.ts'],
  ['chapter-02', 'chapter-02-runtime-metadata.json', 'apps/client/src/chapter-02-production-review-runtime.ts'],
  ['chapter-03', 'chapter-03-runtime-metadata.json', 'apps/client/src/chapter-03-production-review-runtime.ts'],
  ['chapter-04', 'chapter-04-runtime-metadata.json', 'apps/client/src/chapter-04-production-review-runtime.ts'],
  ['special-content', 'special-content-runtime-metadata.json', 'apps/client/src/special-content-production-review-runtime.ts'],
  ['recruitment', 'recruitment-form-runtime-metadata.json', 'apps/client/src/recruitment-production-review-runtime.ts'],
];
const MOTIONS = ['idle', 'move', 'attack', 'knockback', 'death'];

function assert(ok, message) {
  if (!ok) throw new Error(`[production-review-hub] ${message}`);
}

function stripCount(metadata) {
  let total = 0;
  for (const target of Object.values(metadata.targets ?? {})) total += Object.keys(target.motions ?? {}).length;
  return total;
}

assert(manifest.schemaVersion === 1, 'manifest schema drift');
assert(manifest.generatedBy === 'tools/materialize-production-review-hub.mjs', 'manifest generator drift');
assert(manifest.reviewHubPath === '/assets/production/review/index.html', 'hub path drift');
assert(manifest.humanApprovalAuthority === false, 'review hub must never have approval authority');
assert(Array.isArray(manifest.modes) && manifest.modes.length === EXPECTED.length, `expected ${EXPECTED.length} review modes`);
assert(manifest.audit?.humanApprovalAuthority === false, 'machine audit must not claim approval authority');

const audit = manifest.audit?.summary;
assert(audit, 'missing machine audit summary');
for (const key of ['severe', 'atRisk', 'weakEvolution', 'watchEvolution', 'clippingRisk']) {
  assert(audit[key] === 0, `human-review readiness requires machine ${key}=0, got ${audit[key]}`);
}
assert(audit.healthy === audit.totalTargets, 'all audited targets must be healthy before review hub publication');

const seenRoutes = new Set();
const byId = new Map(manifest.modes.map((mode) => [mode.id, mode]));
for (const [id, metadataFile, runtimeFile] of EXPECTED) {
  const mode = byId.get(id);
  assert(mode, `missing review mode ${id}`);
  assert(mode.route === `?productionReview=${id}`, `${id} route drift`);
  assert(mode.metadataFile === metadataFile, `${id} metadata mapping drift`);
  assert(mode.runtimeFile === runtimeFile, `${id} runtime mapping drift`);
  assert(!seenRoutes.has(mode.route), `duplicate review route ${mode.route}`);
  seenRoutes.add(mode.route);

  const metadata = JSON.parse(await readFile(resolve(unitsRoot, metadataFile), 'utf8'));
  const targetEntries = Object.entries(metadata.targets ?? {});
  assert(targetEntries.length > 0, `${id} has no targets`);
  assert(mode.targetCount === targetEntries.length, `${id} target count mismatch`);
  assert(mode.stripCount === stripCount(metadata), `${id} strip count mismatch`);
  assert(mode.reviewState === 'PENDING' || mode.reviewState === 'UNREVIEWED_RUNTIME_FILES', `${id} review state must remain pending/unreviewed`);
  assert(mode.normalRuntimeAuthoritative === false, `${id} must remain non-authoritative`);
  assert(mode.generativeAiUsed === false, `${id} must remain generativeAiUsed:false`);

  for (const [targetKey, target] of targetEntries) {
    assert(target && typeof target === 'object', `${id}/${targetKey} invalid target metadata`);
    for (const motion of MOTIONS) assert(target.motions?.[motion], `${id}/${targetKey} missing ${motion}`);
  }

  if ('normalRuntimeAuthoritative' in metadata) assert(metadata.normalRuntimeAuthoritative === false, `${id} metadata authority drift`);
  if ('generativeAiUsed' in metadata) assert(metadata.generativeAiUsed === false, `${id} metadata AI policy drift`);
  if ('humanReview' in metadata) assert(metadata.humanReview === 'PENDING', `${id} metadata human review drift`);
  if ('reviewStatus' in metadata) assert(metadata.reviewStatus !== 'APPROVED' && metadata.reviewStatus !== 'FINAL', `${id} metadata review status drift`);

  const runtime = await readFile(resolve(root, runtimeFile), 'utf8');
  assert(runtime.includes('productionReview'), `${id} runtime no longer checks productionReview`);
  assert(runtime.includes(`'${id}'`) || runtime.includes(`\"${id}\"`), `${id} runtime route value missing`);
  assert(html.includes(`productionReview=${id}`), `${id} launch link missing from hub HTML`);
}

assert(html.includes('UNAPPROVED · HUMAN REVIEW REQUIRED'), 'unapproved warning missing');
assert(html.includes('NOT APPROVAL EVIDENCE'), 'approval-evidence boundary warning missing');
assert(html.includes('localStorage'), 'local-only checklist implementation missing');
assert(html.includes('frontline-production-review-local-v1:'), 'local checklist namespace missing');
assert(!html.includes('reviewedAt'), 'hub must not write reviewedAt');
assert(!html.includes('reviewerId'), 'hub must not write reviewer identity');

const htmlInfo = await stat(resolve(reviewRoot, 'index.html'));
const manifestInfo = await stat(resolve(reviewRoot, 'production-review-master.json'));
assert(htmlInfo.size > 4000, 'hub HTML unexpectedly small');
assert(manifestInfo.size > 1000, 'hub manifest unexpectedly small');
console.log(`[production-review-hub] validated ${manifest.modes.length} routes / ${manifest.modes.reduce((sum, mode) => sum + mode.targetCount, 0)} listed targets/forms / human approval authority=false`);
