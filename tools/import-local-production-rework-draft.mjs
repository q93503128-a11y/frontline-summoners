import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadProductionTargetIndex,
  normalizeLocalDraftToIntake,
} from './lib/production-rework-intake-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));

function fail(message) {
  throw new Error(`[production-rework-import] ${message}`);
}

if (!args.input) fail('missing --input=<local-draft.json>');
if (!args.output) fail('missing --output=<assets/raw/production/review/rework-intake/*.json>');

const inputPath = resolve(root, args.input);
const outputPath = resolve(root, args.output);
const allowedOutputRoot = resolve(root, 'assets/raw/production/review/rework-intake');
const outputRelative = relative(allowedOutputRoot, outputPath);
if (isAbsolute(outputRelative) || outputRelative.startsWith('..')) {
  fail('output must stay inside assets/raw/production/review/rework-intake');
}
if (!outputPath.endsWith('.json')) fail('output must be a .json file');

const draft = JSON.parse(await readFile(inputPath, 'utf8'));
const targetIndex = await loadProductionTargetIndex(root);
const intake = normalizeLocalDraftToIntake(draft, targetIndex);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(intake, null, 2)}\n`, { flag: 'wx' });
console.log(`[production-rework-import] wrote ${intake.itemCount} workbench items to ${args.output}`);
console.log('[production-rework-import] no runtime, provenance, review package, or approval state was modified');
