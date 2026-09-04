import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const unitMetadataPath = resolve(root, 'apps/client/public/assets/production/units/first-slice-runtime-metadata.json');
const meadowMetadataPath = resolve(root, 'apps/client/public/assets/production/battlefields/meadow/meadow-runtime-metadata.json');
const reworkPath = resolve(root, 'assets/raw/production/first-slice-rework-01.json');
const outputPath = resolve(root, 'assets/raw/production/review/vertical-slice-01/preflight/provenance-draft.json');

const units = JSON.parse(await readFile(unitMetadataPath, 'utf8'));
const meadow = JSON.parse(await readFile(meadowMetadataPath, 'utf8'));
const rework = JSON.parse(await readFile(reworkPath, 'utf8'));
const reworkByAsset = new Map(rework.targets.map((target) => [target.assetId, target]));

function runtimePath(url) {
  return `apps/client/public${url}`;
}

const targets = {};
for (const target of Object.values(units.targets)) {
  const contract = reworkByAsset.get(target.assetId);
  if (!contract) throw new Error(`missing rework contract for ${target.assetId}`);
  const sourceUrls = [...new Set(Object.values(target.motions).map((motion) => motion.sourceUrl).filter(Boolean))];
  const runtimeFiles = Object.values(target.motions).map((motion) => runtimePath(motion.url));
  targets[target.assetId] = {
    status: 'DRAFT_NOT_CANONICAL_REVIEW_PROVENANCE',
    sourceFamily: target.sourceFamily,
    sourceUrls,
    promotableProvenance: {
      authorOrSource: `${target.sourceFamily} CC0 source family; pinned source URLs recorded alongside this draft`,
      rightsOrLicense: contract.license,
      productionMethod: 'MANUAL',
      modifications: `Deterministic non-generative structural rework in project tooling. Required silhouette reads: ${contract.mustReadWithoutColor.join('; ')}. Forbidden reads: ${contract.mustNotReadAs.join('; ')}.`,
      masterFiles: [
        'tools/materialize-first-slice-production-art.mjs',
        ...(target.assetId === 'unit:enemy-boss' ? ['tools/materialize-first-slice-boss.mjs'] : []),
        'assets/raw/production/first-slice-rework-01.json'
      ],
      runtimeFiles
    }
  };
}

targets['battlefield:meadow'] = {
  status: 'DRAFT_NOT_CANONICAL_REVIEW_PROVENANCE',
  sourceFamily: 'project-original-vector-composition',
  sourceUrls: [],
  promotableProvenance: {
    authorOrSource: 'Frontline Summoners project-authored vector composition',
    rightsOrLicense: 'PROJECT-OWNED ORIGINAL',
    productionMethod: 'MANUAL',
    modifications: `Original deterministic vector battlefield composition. AI generation not used. Runtime metadata revision ${meadow.revision ?? 1}.`,
    masterFiles: [
      'apps/client/public/assets/production/battlefields/meadow/battlefield-base.svg',
      'apps/client/public/assets/production/battlefields/meadow/meadow-runtime-metadata.json'
    ],
    runtimeFiles: ['apps/client/public/assets/production/battlefields/meadow/battlefield-base.svg']
  }
};

const draft = {
  schemaVersion: 1,
  status: 'PREFLIGHT_DRAFT_ONLY',
  note: 'Derived from committed runtime metadata and rework contracts. This file does not change review-package lifecycle state.',
  targets
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(draft, null, 2) + '\n');
console.log(`first-slice provenance preflight OK: ${Object.keys(targets).length} visual targets`);
