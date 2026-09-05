import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './lib/production-png.mjs';
import './polish-fourth-slice-pyromancer-f3-move.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unitsRoot = resolve(root, 'apps/client/public/assets/production/units');
const contract = JSON.parse(await readFile(resolve(root, 'assets/raw/production/fourth-slice-mid-wave-04.json'), 'utf8'));
const outPath = resolve(unitsRoot, 'fourth-slice-runtime-metadata.json');
const MOTIONS = ['idle', 'move', 'attack', 'knockback', 'death'];
const TARGET_PATHS = [
  'pyromancer/pyromancer_f1',
  'pyromancer/pyromancer_f2',
  'pyromancer/pyromancer_f3',
  'royal/royal_f1',
  'royal/royal_f2',
  'royal/royal_f3',
  'enemy-berserker',
  'enemy-knight',
];

function assert(ok, message) {
  if (!ok) throw new Error(`[fourth-slice-runtime-index] ${message}`);
}

assert(contract.sliceId === 'fourth-slice-mid-wave-04', 'contract slice drift');
assert(contract.status === 'AWAITING_ART' && contract.reviewStatus === 'PENDING', 'contract lifecycle drift');
assert(contract.normalRuntimeAuthoritative === false && contract.generativeAiUsed === false, 'contract authority/AI policy drift');
assert(contract.targets.length === TARGET_PATHS.length, 'contract target count drift');

const targets = {};
for (const relative of TARGET_PATHS) {
  const local = JSON.parse(await readFile(resolve(unitsRoot, relative, 'runtime-metadata.json'), 'utf8'));
  const contractTarget = contract.targets.find((target) => target.assetId === local.assetId);
  assert(contractTarget, `contract target missing for ${relative}`);
  assert(local.status === 'AWAITING_ART' && local.reviewStatus === 'UNREVIEWED_RUNTIME_FILES', `${relative} lifecycle drift`);
  assert(local.normalRuntimeAuthoritative === false && local.generativeAiUsed === false, `${relative} authority/AI policy drift`);

  const pathParts = relative.split('/');
  const nested = pathParts.length === 2;
  const unitId = contractTarget.unitId;
  const formId = nested ? pathParts[1] : null;
  const motions = {};
  for (const motion of MOTIONS) {
    const frames = local.motions?.[motion];
    const fileMeta = local.files?.[motion];
    assert(Number.isInteger(frames) && frames > 0, `${relative}/${motion} frame count missing`);
    assert(fileMeta?.sha256, `${relative}/${motion} file metadata missing`);
    const bytes = await readFile(resolve(unitsRoot, relative, `${motion}.png`));
    assert(sha256(bytes) === fileMeta.sha256, `${relative}/${motion} sha mismatch`);
    motions[motion] = {
      url: `/assets/production/units/${relative}/${motion}.png`,
      frameWidth: local.frameWidth,
      frameHeight: local.frameHeight,
      frames,
      bytes: bytes.length,
      sha256: fileMeta.sha256,
    };
  }

  targets[relative] = {
    assetId: local.assetId,
    unitId,
    ...(formId ? { formId, formOrder: contractTarget.form } : {}),
    sourceFamily: local.sourceFamily,
    projectAuthoredDeterministic: local.projectAuthored === true,
    structuralRework: local.structuralRework,
    reviewStatus: local.reviewStatus,
    frameWidth: local.frameWidth,
    frameHeight: local.frameHeight,
    displayHeight: local.displayHeight,
    attackContactFrame: local.attackContactFrame,
    motions,
  };
}

const aggregate = {
  schemaVersion: 1,
  sliceId: contract.sliceId,
  generator: 'tools/materialize-fourth-slice-runtime-index.mjs',
  generatorVersion: 1,
  status: 'UNREVIEWED_RUNTIME_FILES',
  humanReview: 'PENDING',
  normalRuntimeAuthoritative: false,
  generativeAiUsed: false,
  sourcePolicy: contract.sourcePolicy,
  targetCount: Object.keys(targets).length,
  stripCount: Object.keys(targets).length * MOTIONS.length,
  targets,
};

await writeFile(outPath, `${JSON.stringify(aggregate, null, 2)}\n`);
console.log(`[fourth-slice-runtime-index] materialized ${aggregate.targetCount} targets / ${aggregate.stripCount} strips for global audit/review indexing`);
