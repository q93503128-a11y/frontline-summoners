import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const meta=JSON.parse(await readFile(resolve(root,'apps/client/public/assets/production/units/first-slice-runtime-metadata.json'),'utf8'));
const plan=JSON.parse(await readFile(resolve(root,'assets/raw/production/first-slice-rework-01.json'),'utf8'));
const slice=JSON.parse(await readFile(resolve(root,'assets/raw/production/vertical-slice-01.json'),'utf8'));
const motions=['idle','move','attack','knockback','death'];
const targetMap=new Map([
  ['militia/militia_f1','unit:militia:militia_f1'],['militia/militia_f2','unit:militia:militia_f2'],['militia/militia_f3','unit:militia:militia_f3'],['enemy-raider','unit:enemy-raider'],
]);
function fail(m){throw new Error(`[first-slice runtime] ${m}`)}
function dims(b){if(b.length<24||b[0]!==0x89||b[1]!==0x50||b[2]!==0x4e||b[3]!==0x47)fail('non-PNG runtime file');return [b.readUInt32BE(16),b.readUInt32BE(20)];}
if(meta.schemaVersion!==2||meta.generatorVersion!==2||meta.structuralRework!==true)fail('runtime metadata must identify structural CC0 rework generator v2');
if(meta.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail('materialization must not claim review');
const planById=new Map(plan.targets.map(x=>[x.assetId,x])); const sliceById=new Map(slice.units.map(x=>[x.assetId,x])); const hashes=new Set();
for(const [target,assetId] of targetMap){const targetMeta=meta.targets?.[target];const planTarget=planById.get(assetId);if(!targetMeta||!planTarget)fail(`${target} missing target metadata/contract`);if(targetMeta.sourceFamily!==planTarget.sourceFamily)fail(`${target} source family drift`);if(targetMeta.structuralRework!==true)fail(`${target} missing structural rework flag`);for(const motion of motions){const entry=targetMeta.motions?.[motion];if(!entry)fail(`${target}/${motion} missing metadata`);const b=await readFile(resolve(root,`apps/client/public${entry.url}`));const [w,h]=dims(b);if(w!==entry.frameWidth*entry.frames||h!==entry.frameHeight)fail(`${target}/${motion} dimension mismatch`);if(b.length<512)fail(`${target}/${motion} unexpectedly small`);const hash=createHash('sha256').update(b).digest('hex');if(hash!==entry.sha256)fail(`${target}/${motion} sha256 mismatch`);const key=`${motion}:${hash}`;if(hashes.has(key))fail(`${target}/${motion} duplicates another target strip`);hashes.add(key);}if(sliceById.get(assetId)?.status!=='AWAITING_ART')fail(`${assetId} advanced without capture/human review`);}
console.log(`[first-slice runtime] ${targetMap.size*motions.length} structurally reworked PNG strips validated; lifecycle intentionally remains AWAITING_ART`);
