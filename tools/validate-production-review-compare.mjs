import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'apps/client/public/assets/production/review/compare.html');
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
  if (!ok) throw new Error(`[production-review-compare] ${message}`);
}

for (const [id, metadataFile] of EXPECTED) {
  assert(html.includes(`\"${id}\"`), `missing mode ${id}`);
  assert(html.includes(metadataFile), `missing metadata mapping ${metadataFile}`);
}
for (const motion of ['idle', 'move', 'attack', 'knockback', 'death']) {
  assert(html.includes(`<option>${motion}</option>`), `missing motion selector ${motion}`);
}

assert(html.includes('UNAPPROVED · READ-ONLY REVIEW AID'), 'read-only boundary warning missing');
assert(html.includes('RUNTIME HEIGHT'), 'runtime-height comparison mode missing');
assert(html.includes('FRAME FIT'), 'frame-fit comparison mode missing');
assert(html.includes('OVERLAY'), 'overlay comparison mode missing');
assert(html.includes('BLINK'), 'blink comparison mode missing');
assert(html.includes('normalized motion phase'), 'normalized phase explanation missing');
assert(html.includes('displayHeight'), 'runtime display-height scaling missing');
assert(html.includes('attackContactFrame'), 'attack contact comparison missing');
assert(html.includes("modeId==='recruitment'"), 'recruitment fallback resolution missing');
assert(html.includes("cache:'no-store'"), 'metadata must be loaded fresh');
assert(html.includes("history.replaceState"), 'deep-link synchronization missing');
assert(html.includes("pair.target.unitId===pairA.target.unitId"), 'recruitment same-unit related comparison missing');
assert(html.includes("event.key.toLowerCase()==='s'"), 'swap keyboard shortcut missing');
assert(!html.includes('localStorage'), 'comparison lab should not persist local review state');
assert(!html.includes('reviewerId'), 'comparison lab must not capture reviewer identity');
assert(!html.includes('reviewedAt'), 'comparison lab must not capture review timestamps');
assert(!/\bAPPROVED\b/.test(html), 'comparison lab must not claim approval state');
assert(!/\b(POST|PUT|PATCH|DELETE)\b/.test(html), 'comparison lab must remain read-only toward canonical data');

const info = await stat(htmlPath);
assert(info.size > 12000, 'comparison lab HTML unexpectedly small');
console.log(`[production-review-compare] validated ${EXPECTED.length} modes / synchronized five-motion A-B overlay-blink inspection / read-only authority boundary`);
