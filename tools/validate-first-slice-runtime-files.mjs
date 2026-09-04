import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const meta=JSON.parse(await readFile(resolve(root,'apps/client/public/assets/production/units/first-slice-runtime-metadata.json'),'utf8'));
const plan=JSON.parse(await readFile(resolve(root,'assets/raw/production/first-slice-rework-01.json'),'utf8'));
const slice=JSON.parse(await readFile(resolve(root,'assets/raw/production/vertical-slice-01.json'),'utf8'));
const motions=['idle','move','attack','knockback','death'];
const targets=['militia/militia_f1','militia/militia_f2','militia/militia_f3','enemy-raider'];
function fail(m){throw new Error(`[first-slice runtime] ${m}`)}
function dims(b){if(b.length<24||b[0]!==0x89||b[1]!==0x50||b[2]!==0x4e||b[3]!==0x47)fail('non-PNG runtime file');return [b.readUInt32BE(16),b.readUInt32BE(20)];}
if(meta.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail('materialization must not claim review');
for(const target of targets){for(const motion of motions){const entry=meta.targets?.[target]?.[motion];if(!entry)fail(`${target}/${motion} missing metadata`);const b=await readFile(resolve(root,`apps/client/public${entry.url}`));const [w,h]=dims(b);if(w!==entry.frameWidth*entry.frames||h!==entry.frameHeight)fail(`${target}/${motion} dimension mismatch`);if(b.length<256)fail(`${target}/${motion} unexpectedly small`);}}
const planIds=new Set(plan.targets.map(x=>x.assetId));
const sliceById=new Map(slice.units.map(x=>[x.assetId,x]));
for(const id of ['unit:militia:militia_f1','unit:militia:militia_f2','unit:militia:militia_f3','unit:enemy-raider']){if(!planIds.has(id))fail(`${id} absent from rework contract`);if(sliceById.get(id)?.status!=='AWAITING_ART')fail(`${id} advanced without capture/human review`);}
console.log(`[first-slice runtime] ${targets.length*motions.length} PNG strips validated; lifecycle intentionally remains AWAITING_ART`);
