import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const battlefieldsRoot=resolve(root,'apps/client/public/assets/production/battlefields');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/special-content-production-01.json'),'utf8'));
const metadata=JSON.parse(await readFile(resolve(unitsRoot,'special-content-runtime-metadata.json'),'utf8'));
const eventDefs=JSON.parse(await readFile(resolve(root,'content/enemies/special-event-enemies.json'),'utf8'));
const permanentDefs=JSON.parse(await readFile(resolve(root,'content/enemies/special-permanent-bosses.json'),'utf8'));
const motions=['idle','move','attack','knockback','death'];
function assert(ok,msg){if(!ok)throw new Error(`[special-content-runtime] ${msg}`);}

assert(contract.batchId==='special-content-production-01','contract batch id drift');
assert(contract.scope==='SPECIAL_CONTENT','contract scope drift');
assert(contract.status==='AWAITING_ART'&&contract.reviewStatus==='PENDING','contract lifecycle must remain pending');
assert(contract.normalRuntimeAuthoritative===false&&contract.generativeAiUsed===false,'contract runtime/AI policy drift');
assert(contract.sourcePolicy==='PROJECT_AUTHORED_DETERMINISTIC_ONLY','source policy drift');
assert(contract.reviewRoute==='?productionReview=special-content','review route drift');
assert(contract.targets.length===40,'expected exactly 40 special-content targets');
assert(contract.battlefields.length===0,'special content must not create redundant battlefield themes');
assert(metadata.batchId===contract.batchId&&metadata.generatorVersion===1,'metadata generator drift');
assert(metadata.status==='UNREVIEWED_RUNTIME_FILES'&&metadata.humanReview==='PENDING','metadata review state drift');
assert(metadata.normalRuntimeAuthoritative===false&&metadata.generativeAiUsed===false,'metadata runtime/AI policy drift');

const sourceIds=new Set([...eventDefs,...permanentDefs].map((x)=>x.id));
const contractIds=new Set(contract.targets.map((x)=>x.unitId));
assert(sourceIds.size===40,'canonical special enemy definition count drift');
assert(contractIds.size===40,'contract target ids must be unique');
for(const id of sourceIds)assert(contractIds.has(id),`canonical special enemy missing from contract: ${id}`);
for(const id of contractIds)assert(sourceIds.has(id),`contract target absent from canonical enemy data: ${id}`);
assert(Object.keys(metadata.targets).length===40,'metadata target count drift');

const seenSha=new Set();
for(const target of contract.targets){
  const id=target.unitId,meta=metadata.targets[id];
  assert(meta,`missing metadata ${id}`);
  assert(meta.assetId===`unit:${id}`,`${id} asset id mismatch`);
  assert(meta.sourceFamily===target.sourceFamily,`${id} source family mismatch`);
  assert(meta.projectAuthoredDeterministic===true&&meta.structuralRework===false,`${id} authorship contract mismatch`);
  assert(meta.reviewStatus==='UNREVIEWED_RUNTIME_FILES',`${id} review state drift`);
  assert(Number.isInteger(meta.frameWidth)&&meta.frameWidth>=160&&meta.frameWidth<=460,`${id} frame width invalid`);
  assert(Number.isInteger(meta.frameHeight)&&meta.frameHeight>=140&&meta.frameHeight<=370,`${id} frame height invalid`);
  assert(Number.isInteger(meta.displayHeight)&&meta.displayHeight>0&&meta.displayHeight<=meta.frameHeight,`${id} display height invalid`);
  assert(Number.isInteger(meta.attackContactFrame)&&meta.attackContactFrame>=0,`${id} contact frame invalid`);
  for(const motion of motions){
    const mm=meta.motions[motion];assert(mm,`${id}/${motion} metadata missing`);assert(Number.isInteger(mm.frames)&&mm.frames>=4&&mm.frames<=12,`${id}/${motion} frame count invalid`);
    if(motion==='attack')assert(meta.attackContactFrame<mm.frames,`${id} contact frame outside attack strip`);
    const path=resolve(unitsRoot,id,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${id}/${motion}`);
    assert(png.width===meta.frameWidth*mm.frames&&png.height===meta.frameHeight,`${id}/${motion} PNG dimensions mismatch`);
    assert(mm.bytes===bytes.length,`${id}/${motion} byte length mismatch`);
    const digest=sha256(bytes);assert(mm.sha256===digest,`${id}/${motion} sha mismatch`);assert(!seenSha.has(digest),`${id}/${motion} duplicates another special-content strip`);seenSha.add(digest);
  }
}
assert(seenSha.size===200,'expected 200 unique special-content strips');
for(const theme of ['meadow','golden','canyon','ruins','fortress','burning','moon'])for(const file of ['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']){const info=await stat(resolve(battlefieldsRoot,theme,file));assert(info.size>80,`reused battlefield missing/empty ${theme}/${file}`);}
console.log(`[special-content-runtime] validated ${seenSha.size} unique strips / 40 targets / 7 reused battlefield themes`);
