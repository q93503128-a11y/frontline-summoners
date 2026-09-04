import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/recruitment-production-01.json'),'utf8'));
const roster=JSON.parse(await readFile(resolve(root,'content/units/recruitment-01.json'),'utf8'));
const metadata=JSON.parse(await readFile(resolve(unitsRoot,'recruitment-form-runtime-metadata.json'),'utf8'));
const evolutionFiles=['content/evolution/recruitment-common-explicit-01.json','content/evolution/recruitment-series-01-explicit.json','content/evolution/recruitment-series-02-explicit.json','content/evolution/recruitment-series-03-explicit.json'];
const evolutionSources=[];for(const file of evolutionFiles)evolutionSources.push(...JSON.parse(await readFile(resolve(root,file),'utf8')));
const productionAssets=await readFile(resolve(root,'apps/client/src/production-assets.ts'),'utf8');
const motions=['idle','move','attack','knockback','death'];
function assert(ok,msg){if(!ok)throw new Error(`[recruitment-form-runtime] ${msg}`);}

assert(contract.batchId==='recruitment-production-01'&&contract.expectedTargetCount===33&&contract.targets.length===33,'root recruitment contract drift');
assert(contract.status==='AWAITING_ART'&&contract.reviewStatus==='PENDING'&&contract.normalRuntimeAuthoritative===false,'root review boundary drift');
assert(contract.generativeAiUsed===false&&contract.sourcePolicy==='PROJECT_AUTHORED_DETERMINISTIC_ONLY','source policy drift');
assert(roster.length===33&&evolutionSources.length===33,'expected 33 recruitment character roots');
assert(metadata.batchId==='recruitment-production-01-forms'&&metadata.rootContractId===contract.batchId&&metadata.generatorVersion===1,'form metadata identity drift');
assert(metadata.status==='UNREVIEWED_RUNTIME_FILES'&&metadata.humanReview==='PENDING'&&metadata.normalRuntimeAuthoritative===false&&metadata.generativeAiUsed===false,'form metadata review boundary drift');
assert(metadata.characterCount===33&&metadata.formCount===99,'metadata coverage count drift');
assert(!productionAssets.includes('char_common_')&&!productionAssets.includes('char_s01_')&&!productionAssets.includes('char_s02_')&&!productionAssets.includes('char_s03_'),'pending recruitment forms must not be promoted into normal production-art mapping');

const rosterById=new Map(roster.map((unit)=>[unit.id,unit]));const rootTargetById=new Map(contract.targets.map((target)=>[target.unitId,target]));const forms=[];
for(const entry of evolutionSources){const unit=rosterById.get(entry.characterId);assert(unit,`unknown evolution root: ${entry.characterId}`);assert(rootTargetById.has(entry.characterId),`missing root production target: ${entry.characterId}`);assert(Array.isArray(entry.forms)&&entry.forms.length===3,`${entry.characterId} must expose exactly 3 forms`);const orders=new Set(entry.forms.map((form)=>form.formOrder));assert(orders.size===3&&orders.has(1)&&orders.has(2)&&orders.has(3),`${entry.characterId} form orders must be 1/2/3`);for(const form of entry.forms)forms.push({characterId:entry.characterId,...form});}
assert(forms.length===99&&new Set(forms.map((form)=>form.formId)).size===99,'expected 99 unique canonical recruitment forms');
assert(Object.keys(metadata.targets).length===99,'metadata must cover all 99 forms');

const seenSha=new Set();
for(const form of forms){const unit=rosterById.get(form.characterId),rootTarget=rootTargetById.get(form.characterId),meta=metadata.targets[form.formId];assert(meta,`missing form metadata: ${form.formId}`);assert(meta.assetId===`unit:${unit.id}:${form.formId}`&&meta.unitId===unit.id&&meta.formId===form.formId&&meta.formOrder===form.formOrder,`${form.formId} canonical identity mismatch`);assert(meta.displayName===form.name&&meta.rarity===unit.rarity&&meta.seriesId===unit.seriesId&&meta.role===unit.role,`${form.formId} presentation identity mismatch`);assert(meta.sourceFamily===rootTarget.sourceFamily,`${form.formId} source family mismatch`);const timing=form.modifiers?.attackTiming,expectedFirstHit=timing?.hitFrames?.[0]??unit.hitFrames[0];assert(meta.simulationContactFrame===expectedFirstHit,`${form.formId} simulation contact mismatch`);assert(meta.projectAuthoredDeterministic===true&&meta.structuralRework===false&&meta.reviewStatus==='UNREVIEWED_RUNTIME_FILES',`${form.formId} review/authorship mismatch`);assert(Number.isInteger(meta.frameWidth)&&meta.frameWidth>=200&&meta.frameWidth<=410,`${form.formId} frame width invalid`);assert(Number.isInteger(meta.frameHeight)&&meta.frameHeight>=180&&meta.frameHeight<=350,`${form.formId} frame height invalid`);assert(Number.isInteger(meta.displayHeight)&&meta.displayHeight>0&&meta.displayHeight<=meta.frameHeight,`${form.formId} display height invalid`);assert(Number.isInteger(meta.attackContactFrame)&&meta.attackContactFrame>=1,`${form.formId} attack contact invalid`);for(const motion of motions){const mm=meta.motions[motion];assert(mm,`${form.formId}/${motion} metadata missing`);assert(Number.isInteger(mm.frames)&&mm.frames>=4&&mm.frames<=12,`${form.formId}/${motion} frame count invalid`);if(motion==='attack')assert(meta.attackContactFrame<mm.frames-1,`${form.formId} contact outside attack strip`);const path=resolve(unitsRoot,unit.id,form.formId,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${form.formId}/${motion}`);assert(png.width===meta.frameWidth*mm.frames&&png.height===meta.frameHeight,`${form.formId}/${motion} dimensions mismatch`);assert(mm.bytes===bytes.length,`${form.formId}/${motion} byte length mismatch`);const digest=sha256(bytes);assert(mm.sha256===digest,`${form.formId}/${motion} sha mismatch`);assert(!seenSha.has(digest),`${form.formId}/${motion} duplicates another recruitment form strip`);seenSha.add(digest);}}
assert(seenSha.size===495,'expected 495 unique recruitment form strips');
console.log(`[recruitment-form-runtime] validated 33 characters / 99 forms / ${seenSha.size} unique strips`);
