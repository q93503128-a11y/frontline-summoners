import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewRoot = resolve(root, 'apps/client/public/assets/production/review');
const unitsRoot = resolve(root, 'apps/client/public/assets/production/units');
const publicRoot = resolve(root, 'apps/client/public');
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
const MOTIONS = ['idle', 'move', 'attack', 'knockback', 'death'];
const PUBLIC_PREFIX = 'apps/client/public/';

function assert(ok, message) {
  if (!ok) throw new Error(`[production-review-gallery] ${message}`);
}

function publicUrlFromFile(file) {
  return typeof file === 'string' && file.startsWith(PUBLIC_PREFIX)
    ? `/${file.slice(PUBLIC_PREFIX.length)}`
    : null;
}

function assetUrlFallback(assetId, motionName) {
  return typeof assetId === 'string' && assetId.startsWith('unit:')
    ? `/assets/production/units/${assetId.slice(5).split(':').join('/')}/${motionName}.png`
    : null;
}

for (const [id, metadataFile] of EXPECTED) {
  assert(html.includes(`\"${id}\"`), `missing mode ${id}`);
  assert(html.includes(metadataFile), `missing metadata mapping ${metadataFile}`);
}

for (const motion of MOTIONS) {
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
assert(html.includes('COMPARE LAB'), 'comparison lab navigation missing');
assert(html.includes("modeId==='recruitment'"), 'recruitment runtime fallback resolver missing');
assert(html.includes("prefix='apps/client/public/'"), 'file-backed runtime resolver missing');
assert(html.includes("assetId.startsWith('unit:')"), 'asset-id runtime fallback resolver missing');
assert(html.includes('motion.url||fileUrl||recruitmentFallback||assetFallback'), 'runtime resolver precedence missing');
assert(html.includes("data-filter=\"pending\""), 'pending filter missing');
assert(html.includes("data-filter=\"revisit\""), 'revisit filter missing');
assert(html.includes("event.key.toLowerCase()"), 'keyboard review navigation missing');
assert(!html.includes('reviewerId'), 'gallery must not capture reviewer identity');
assert(!html.includes('reviewedAt'), 'gallery must not capture review timestamps');
assert(!/\bAPPROVED\b/.test(html), 'gallery must not claim approval state');
assert(!/\b(POST|PUT|PATCH|DELETE)\b/.test(html), 'gallery must remain read-only toward canonical data');

let targetCount = 0;
let stripCount = 0;
let fileBackedStrips = 0;
let recruitmentFallbackStrips = 0;
let assetFallbackStrips = 0;
const filesToCheck = [];
for (const [modeId, metadataFile] of EXPECTED) {
  const metadata = JSON.parse(await readFile(resolve(unitsRoot, metadataFile), 'utf8'));
  const entries = Object.entries(metadata.targets ?? {});
  targetCount += entries.length;
  for (const [targetKey, target] of entries) {
    for (const motionName of MOTIONS) {
      const motion = target.motions?.[motionName];
      assert(motion, `${modeId}:${targetKey} missing ${motionName}`);
      const fileUrl = publicUrlFromFile(motion.file);
      const recruitmentFallback = modeId === 'recruitment' && target.unitId && target.formId
        ? `/assets/production/units/${target.unitId}/${target.formId}/${motionName}.png`
        : null;
      const assetFallback = assetUrlFallback(target.assetId, motionName);
      const url = motion.url ?? fileUrl ?? recruitmentFallback ?? assetFallback;
      const frameWidth = Number(motion.frameWidth ?? target.frameWidth);
      const frameHeight = Number(motion.frameHeight ?? target.frameHeight);
      const frames = Number(motion.frames);
      assert(typeof url === 'string' && url.startsWith('/assets/production/units/'), `${modeId}:${targetKey}:${motionName} unresolved URL`);
      assert(Number.isFinite(frameWidth) && frameWidth > 0, `${modeId}:${targetKey}:${motionName} unresolved frameWidth`);
      assert(Number.isFinite(frameHeight) && frameHeight > 0, `${modeId}:${targetKey}:${motionName} unresolved frameHeight`);
      assert(Number.isInteger(frames) && frames > 0, `${modeId}:${targetKey}:${motionName} invalid frame count`);
      if (!motion.url && fileUrl) fileBackedStrips += 1;
      if (!motion.url && !fileUrl && recruitmentFallback) recruitmentFallbackStrips += 1;
      if (!motion.url && !fileUrl && !recruitmentFallback && assetFallback) assetFallbackStrips += 1;
      filesToCheck.push([`${modeId}:${targetKey}:${motionName}`, resolve(publicRoot, url.slice(1))]);
      stripCount += 1;
    }
    const attackFrames = Number(target.motions?.attack?.frames);
    assert(Number.isInteger(target.attackContactFrame) && target.attackContactFrame >= 0 && target.attackContactFrame < attackFrames, `${modeId}:${targetKey} invalid attackContactFrame`);
  }
}

assert(targetCount === 209, `expected 209 canonical review targets/forms, got ${targetCount}`);
assert(stripCount === 1045, `expected 1045 five-motion strips, got ${stripCount}`);
assert(fileBackedStrips > 0, 'expected at least one file-backed canonical runtime strip');
assert(recruitmentFallbackStrips === 495, `expected 495 recruitment derived runtime strips, got ${recruitmentFallbackStrips}`);
assert(assetFallbackStrips > 0, 'expected at least one asset-id derived canonical runtime strip');
await Promise.all(filesToCheck.map(async ([label, path]) => {
  const info = await stat(path);
  assert(info.isFile() && info.size > 0, `${label} runtime PNG missing or empty`);
}));

const info = await stat(htmlPath);
assert(info.size > 10000, 'gallery HTML unexpectedly small');
console.log(`[production-review-gallery] validated ${EXPECTED.length} modes / ${targetCount} targets/forms / ${stripCount} live strips / ${fileBackedStrips} file-backed / ${recruitmentFallbackStrips} recruitment derived / ${assetFallbackStrips} asset-id derived`);
