import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'apps/client/public/assets/production/review/rework-queue.html');
let html = await readFile(htmlPath, 'utf8');

const before = "card.dataset.mode=mode.id;card.dataset.target=targetKey;card.dataset.search=";
const after = "card.dataset.mode=mode.id;card.dataset.target=targetKey;card.dataset.assetId=target.assetId||'';card.dataset.search=";
const occurrences = html.split(before).length - 1;
if (occurrences !== 1) {
  throw new Error(`[production-review-rework-export] expected one card identity assignment, found ${occurrences}`);
}
html = html.replace(before, after);
await writeFile(htmlPath, html);
console.log('[production-review-rework-export] patched card assetId identity into copied draft payload');
