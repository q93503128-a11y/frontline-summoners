import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/recruitment-production-01.json'),'utf8'));
const metadata=JSON.parse(await readFile(resolve(unitsRoot,'recruitment-runtime-metadata.json'),'utf8'));
const roster=JSON.parse(await readFile(resolve(root,'content/units/recruitment-01.json'),'utf8'));
const productionAssets=await readFile(resolve(root,'apps/client/src/production-assets.ts'),'utf8');
const motions=['idle','move','attack','knockback','death'];
function assert(ok,msg){if(!ok)throw new Error(`[recruitment-runtime] ${msg}`);}

assert(contract.batchId==='recruitment-production-01'&&contract.scope==='RECRUITMENT_ROSTER','contract identity drift');
assert(contract.status==='AWAITING_ART'&&contract.reviewStatus==='PENDING','contract lifecycle must remain pending');
assert(contract.normalRuntimeAuthoritative===false&&contract.generativeAiUsed===false,'contract runtime/AI policy drift');
assert(contract.sourcePolicy==='PROJECT_AUTHORED_DETERMINISTIC_ONLY','source policy drift');
assert(contract.reviewRoute==='?productionReview=recruitment','review route drift');
assert(contract.expectedTargetCount===33&&contract.targets.length===33,'expected exactly 33 recruitment targets');
assert(contract.battlefields.length===0,'recruitment batch must not create battlefield themes');
assert(metadata.batchId===contract.batchId&&metadata.generatorVersion===1,'metadata generator drift');
assert(metadata.status==='UNREVIEWED_RUNTIME_FILES'&&metadata.humanReview==='PENDING','metadata review state drift');
assert(metadata.normalRuntimeAuthoritative===false&&metadata.generativeAiUsed===false,'metadata runtime/AI policy drift');
assert(roster.length===33,'canonical recruitment roster count drift');
assert(!productionAssets.includes('char_common_')&&!productionAssets.includes('char_s01_')&&!productionAssets.includes('char_s02_')&&!productionAssets.includes('char_s03_'),'pending recruitment candidates must not be promoted into normal runtime mapping');

const rosterById=new Map(roster.map((unit)=>[unit.id,unit]));
const contractIds=new Set(contract.targets.map((target)=>target.unitId));
assert(rosterById.size===33&&contractIds.size===33,'recruitment ids must be unique');
for(const id of rosterById.keys())assert(contractIds.has(id),`canonical recruitment unit missing from contract: ${id}`);
for(const id of contractIds)assert(rosterById.has(id),`contract target absent from canonical roster: ${id}`);
assert(Object.keys(metadata.targets).length===33,'metadata target count drift');

const seenSha=new Set();
for(const target of contract.targets){
  const id=target.unitId,unit=rosterById.get(id),meta=metadata.targets[id];
  assert(unit&&meta,`missing canonical unit or metadata: ${id}`);
  assert(meta.assetId===`unit:${id}`,`${id} asset id mismatch`);
  assert(meta.displayName===unit.displayName&&meta.rarity===unit.rarity&&meta.seriesId===unit.seriesId&&meta.role===unit.role,`${id} canonical identity mismatch`);
  assert(meta.sourceFamily===target.sourceFamily,`${id} source family mismatch`);
  assert(meta.simulationContactFrame===target.simulationContactFrame&&meta.simulationContactFrame===unit.hitFrames[0],`${id} simulation contact mismatch`);
  assert(meta.projectAuthoredDeterministic===true&&meta.structuralRework===false,`${id} authorship contract mismatch`);
  assert(meta.reviewStatus==='UNREVIEWED_RUNTIME_FILES',`${id} review state drift`);
  assert(Number.isInteger(meta.frameWidth)&&meta.frameWidth>=200&&meta.frameWidth<=400,`${id} frame width invalid`);
  assert(Number.isInteger(meta.frameHeight)&&meta.frameHeight>=180&&meta.frameHeight<=340,`${id} frame height invalid`);
  assert(Number.isInteger(meta.displayHeight)&&meta.displayHeight>0&&meta.displayHeight<=meta.frameHeight,`${id} display height invalid`);
  assert(Number.isInteger(meta.attackContactFrame)&&meta.attackContactFrame>=1,`${id} attack contact invalid`);
  for(const motion of motions){
    const mm=meta.motions[motion];assert(mm,`${id}/${motion} metadata missing`);assert(Number.isInteger(mm.frames)&&mm.frames>=4&&mm.frames<=12,`${id}/${motion} frame count invalid`);
    if(motion==='attack')assert(meta.attackContactFrame<mm.frames-1,`${id} contact frame outside attack strip`);
    const path=resolve(unitsRoot,id,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${id}/${motion}`);
    assert(png.width===meta.frameWidth*mm.frames&&png.height===meta.frameHeight,`${id}/${motion} PNG dimensions mismatch`);
    assert(mm.bytes===bytes.length,`${id}/${motion} byte length mismatch`);
    const digest=sha256(bytes);assert(mm.sha256===digest,`${id}/${motion} sha mismatch`);assert(!seenSha.has(digest),`${id}/${motion} duplicates another recruitment strip`);seenSha.add(digest);
  }
}
assert(seenSha.size===165,'expected 165 unique recruitment strips');
console.log(`[recruitment-runtime] validated ${seenSha.size} unique strips / 33 recruitment targets`);
