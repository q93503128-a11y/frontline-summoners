import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewRoot = resolve(root, 'apps/client/public/assets/production/review');
const htmlPath = resolve(reviewRoot, 'gallery.html');
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
  if (!ok) throw new Error(`[production-review-gallery] ${message}`);
}

for (const [id, metadataFile] of EXPECTED) {
  assert(html.includes(`\"${id}\"`), `missing mode ${id}`);
  assert(html.includes(metadataFile), `missing metadata mapping ${metadataFile}`);
}

for (const motion of ['idle', 'move', 'attack', 'knockback', 'death']) {
  assert(html.includes(`'${motion}'`) || html.includes(`\"${motion}\"`), `missing motion ${motion}`);
}

assert(html.includes('UNAPPROVED · LOCAL REVIEW AID ONLY'), 'unapproved boundary warning missing');
assert(html.includes('LOCAL CHECKED'), 'local checked status missing');
assert(html.includes('REVISIT'), 'local revisit status missing');
assert(html.includes('frontline-production-review-gallery-local-v1:'), 'local storage namespace missing');
assert(html.includes('localStorage'), 'local-only storage implementation missing');
assert(html.includes('IntersectionObserver'), 'lazy animation loading missing');
assert(html.includes('canvas'), 'frame canvas preview missing');
assert(html.includes('attackContactFrame'), 'attack contact-frame review aid missing');
assert(html.includes("cache:'no-store'"), 'metadata must be loaded fresh');
assert(html.includes("data-filter=\"pending\""), 'pending filter missing');
assert(html.includes("data-filter=\"revisit\""), 'revisit filter missing');
assert(html.includes("event.key.toLowerCase()"), 'keyboard review navigation missing');
assert(!html.includes('reviewerId'), 'gallery must not capture reviewer identity');
assert(!html.includes('reviewedAt'), 'gallery must not capture review timestamps');
assert(!html.includes('APPROVED'), 'gallery must not claim approval state');
assert(!/\b(POST|PUT|PATCH|DELETE)\b/.test(html), 'gallery must remain read-only toward canonical data');

const info = await stat(htmlPath);
assert(info.size > 9000, 'gallery HTML unexpectedly small');
console.log(`[production-review-gallery] validated ${EXPECTED.length} modes / five-motion lazy canvas review / local-only progress`);
