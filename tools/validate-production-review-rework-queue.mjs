import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewRoot = resolve(root, 'apps/client/public/assets/production/review');
const htmlPath = resolve(reviewRoot, 'rework-queue.html');
const html = await readFile(htmlPath, 'utf8');

const EXPECTED = [
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
];

function assert(ok, message) {
  if (!ok) throw new Error(`[production-review-rework-queue] ${message}`);
}

for (const [id, metadataFile] of EXPECTED) {
  assert(html.includes(`\"${id}\"`) || html.includes(`'${id}'`), `missing mode ${id}`);
  assert(html.includes(metadataFile), `missing metadata mapping ${metadataFile}`);
}

for (const reason of ['silhouette', 'motion', 'attack-contact', 'scale-clipping', 'combat-readability', 'form-distinction', 'other']) {
  assert(html.includes(`'${reason}'`) || html.includes(`\"${reason}\"`), `missing rework reason ${reason}`);
}

assert(html.includes('UNAPPROVED · REWORK TRIAGE ONLY'), 'unapproved triage warning missing');
assert(html.includes('LOCAL_REWORK_TRIAGE_DRAFT'), 'rework draft kind missing');
assert(html.includes('humanApprovalAuthority:false'), 'human approval authority boundary missing');
assert(html.includes('canonicalWrite:false'), 'canonical write boundary missing');
assert(html.includes('approvalEvidence:false'), 'approval evidence boundary missing');
assert(html.includes('frontline-production-review-gallery-local-v1:'), 'gallery local-state reader missing');
assert(html.includes('frontline-production-review-rework-local-v1:'), 'triage local storage namespace missing');
assert(html.includes('localStorage'), 'local-only storage implementation missing');
assert(html.includes('navigator.clipboard.writeText'), 'copyable rework JSON draft missing');
assert(html.includes("cache:'no-store'"), 'metadata must be loaded fresh');
assert(html.includes('GALLERY REVISIT'), 'gallery revisit bridge missing');
assert(html.includes('NO LOCAL DISPOSITION'), 'neutral local disposition missing');
assert(html.includes('REVISIT'), 'revisit disposition missing');
assert(html.includes('BLOCKER'), 'blocker disposition missing');
assert(html.includes('OPEN MOTION GALLERY'), 'gallery launch link missing');
assert(html.includes('OPEN BATTLE REVIEW'), 'battle review launch link missing');
assert(!html.includes('reviewerId'), 'queue must not capture reviewer identity');
assert(!html.includes('reviewedAt'), 'queue must not capture review timestamps');
assert(!/\bAPPROVED\b/.test(html), 'queue must not claim approval state');
assert(!/\b(POST|PUT|PATCH|DELETE)\b/.test(html), 'queue must remain read-only toward canonical data');

const info = await stat(htmlPath);
assert(info.size > 10000, 'rework queue HTML unexpectedly small');
console.log(`[production-review-rework-queue] validated ${EXPECTED.length} modes / local-only issue triage / non-authoritative JSON draft`);
