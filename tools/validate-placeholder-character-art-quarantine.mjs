import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = resolve(root, 'package.json');
const clientPackagePath = resolve(root, 'apps/client/package.json');
const clientAssetsPath = resolve(root, 'apps/client/src/assets.ts');
const clientSrcRoot = resolve(root, 'apps/client/src');
const quarantinedRuntimeRoot = resolve(root, 'apps/client/public/assets/production/units');
const ciPath = resolve(root, '.github/workflows/ci.yml');

function assert(ok, message) {
  if (!ok) throw new Error(`[character-art-quarantine] ${message}`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectTextFiles(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) out.push(...await collectTextFiles(child));
    else if (['.ts', '.tsx', '.js', '.mjs'].includes(extname(entry.name))) out.push(child);
  }
  return out;
}

function isDeferredCharacterArtContractSource(path) {
  const file = relative(clientSrcRoot, path).replaceAll('\\', '/');
  return file === 'production-assets.ts' || file.endsWith('-production-review-runtime.ts');
}

const rootPackage = JSON.parse(await readFile(packagePath, 'utf8'));
const clientPackage = JSON.parse(await readFile(clientPackagePath, 'utf8'));
const ci = await readFile(ciPath, 'utf8');
const clientAssets = await readFile(clientAssetsPath, 'utf8');

assert(rootPackage.scripts?.['assets:production:check']?.includes('assets:production:character-placeholder:check'),
  'normal production check must enforce the character placeholder quarantine');
assert(rootPackage.scripts?.['assets:production:character-placeholder:check'] === 'node tools/validate-placeholder-character-art-quarantine.mjs',
  'character placeholder quarantine command drifted');

const normalProduction = `${rootPackage.scripts?.['assets:production:check'] ?? ''}\n${ci}`;
const bannedNormalHooks = [
  'materialize-first-slice-production-art.mjs',
  'polish-first-slice-unit-silhouettes.mjs',
  'polish-first-slice-unit-motion-language.mjs',
  'materialize-first-slice-boss.mjs',
  'materialize-second-slice-production-art.mjs',
  'polish-second-slice-priority-art.mjs',
  'materialize-third-slice-production-art.mjs',
  'assemble-third-slice-horizontal-strips.mjs',
  'materialize-fourth-slice-production-art.mjs',
  'materialize-fifth-slice-production-art.mjs',
  'materialize-sixth-slice-production-art.mjs',
  'materialize-chapter-02-production-art.mjs',
  'materialize-chapter-03-production-art.mjs',
  'materialize-chapter-04-production-art.mjs',
  'materialize-special-content-production-art.mjs',
  'materialize-recruitment-production-art.mjs',
  'materialize-recruitment-form-production-art.mjs',
  'polish-recruitment-form-silhouettes.mjs',
  'polish-recruitment-form-priority-02.mjs',
  'polish-recruitment-form-priority-03.mjs',
  'polish-recruitment-form-priority-04.mjs',
  'polish-production-art-priority-03.mjs',
  'polish-production-art-priority-03-motion-fix.mjs',
  'assets:production:review-hub:check',
];
for (const hook of bannedNormalHooks) {
  assert(!normalProduction.includes(hook), `normal build/CI must not invoke placeholder character art hook: ${hook}`);
}

assert(!ci.includes('apps/client/public/assets/production/units'),
  'CI must not persist quarantined production unit art');
assert(!ci.includes('apps/client/public/assets/production/review'),
  'CI must not persist character-art review surfaces while character art is deferred');
assert(!await exists(quarantinedRuntimeRoot),
  'public production unit art must stay absent until explicit character design work resumes');

const expectedClientVendor = 'node ../../tools/vendor-client-assets.mjs && node ../../tools/vendor-lower-rarity-free-assets.mjs';
assert(clientPackage.scripts?.predev === expectedClientVendor,
  'client predev must vendor the vetted free sprite families without restoring production-unit generators');
assert(clientPackage.scripts?.prebuild === expectedClientVendor,
  'client prebuild must vendor the vetted free sprite families without restoring production-unit generators');
assert(clientAssets.includes("const LOCAL = '/assets/characters';"),
  'normal runtime character art must stay on the free-sprite path');

for (const path of await collectTextFiles(clientSrcRoot)) {
  if (isDeferredCharacterArtContractSource(path)) continue;
  const source = await readFile(path, 'utf8');
  assert(!source.includes('/assets/production/units'),
    `player runtime source must not reference quarantined production unit art: ${path.slice(root.length + 1)}`);
}

console.log('[character-art-quarantine] placeholder production unit art is absent from player runtime and CI; vetted free source-reference families are allowed');
