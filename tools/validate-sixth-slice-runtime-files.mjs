import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const units=resolve(root,'apps/client/public/assets/production/units');
const meta=JSON.parse(await readFile(resolve(units,'sixth-slice-runtime-metadata.json'),'utf8'));
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/sixth-slice-chapter-one-finale-06.json'),'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)throw new Error('sixth-slice approval lifecycle drift');
if(meta.sliceId!=='sixth-slice-chapter-one-finale-06'||meta.status!=='UNREVIEWED_RUNTIME_FILES'||meta.humanReview!=='PENDING'||meta.normalRuntimeAuthoritative!==false||meta.generativeAiUsed!==false)throw new Error('sixth-slice runtime metadata lifecycle drift');
const expected=['voidsage/voidsage_f1','voidsage/voidsage_f2','voidsage/voidsage_f3','enemy-boss-iron'];
if(JSON.stringify(Object.keys(meta.targets).sort())!==JSON.stringify([...expected].sort()))throw new Error('sixth-slice target set drift');
for(const id of expected){const t=meta.targets[id];if(!t)throw new Error(`missing metadata ${id}`);if(t.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')throw new Error(`review status drift ${id}`);if(id.startsWith('voidsage/')&&t.sourceFamily!=='project-authored-anomaly')throw new Error(`voidsage source drift ${id}`);if(id==='enemy-boss-iron'&&t.sourceFamily!=='hero-knight')throw new Error('iron boss source drift');if((id.startsWith('voidsage/')&&t.simulationContactFrame!==48)||(id==='enemy-boss-iron'&&t.simulationContactFrame!==52))throw new Error(`simulation contact drift ${id}`);for(const motion of ['idle','move','attack','knockback','death']){const m=t.motions[motion];if(!m||!Number.isInteger(m.frames)||m.frames<1)throw new Error(`bad motion metadata ${id}/${motion}`);const p=resolve(units,id,`${motion}.png`),bytes=await readFile(p),s=await stat(p);if(s.size!==m.bytes||sha256(bytes)!==m.sha256)throw new Error(`byte/hash drift ${id}/${motion}`);const png=decodePng(bytes,`${id}/${motion}`);if(png.width!==t.frameWidth*m.frames||png.height!==t.frameHeight)throw new Error(`PNG geometry drift ${id}/${motion}`);}}
if(contract.reusedBattlefields?.length!==2||contract.reusedBosses?.length!==1)throw new Error('finale reuse contract drift');
console.log('[sixth-slice] validated 4 targets / 20 motion strips / moon+fortress reuse / golden-mask reuse');
