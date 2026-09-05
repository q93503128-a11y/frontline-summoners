import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'apps/client/public/assets/production/review/rework-queue.html');
const html = await readFile(htmlPath, 'utf8');

function assert(ok, message) {
  if (!ok) throw new Error(`[production-review-rework-export] ${message}`);
}

assert(html.includes("card.dataset.assetId=target.assetId||''"), 'card assetId capture missing');
assert(html.includes('assetId:card.dataset.assetId||null'), 'draft assetId export missing');
assert(!html.includes('assetId:null,galleryChecked'), 'draft export still hardcodes null asset identity');
assert(html.includes("kind:'LOCAL_REWORK_TRIAGE_DRAFT'"), 'local draft kind missing');
assert(html.includes('canonicalWrite:false'), 'canonical-write boundary missing');
assert(html.includes('approvalEvidence:false'), 'approval-evidence boundary missing');
console.log('[production-review-rework-export] validated target asset identity survives local draft copy');
