import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const battlefieldsRoot=resolve(root,'apps/client/public/assets/production/battlefields');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/chapter-04-production-01.json'),'utf8'));
const metadata=JSON.parse(await readFile(resolve(unitsRoot,'chapter-04-runtime-metadata.json'),'utf8'));
const motions=['idle','move','attack','knockback','death'];
const expected={
  enemy_ch4_sawbird:{family:'project-authored-machine-sawbird',w:220,h:180,displayHeight:164,contact:2,frames:[6,8,6,4,6]},
  enemy_ch4_magnet_spider:{family:'project-authored-machine-magnet-spider',w:240,h:190,displayHeight:176,contact:3,frames:[6,8,7,4,6]},
  enemy_ch4_railworm:{family:'project-authored-machine-rail-artillery',w:360,h:210,displayHeight:194,contact:6,frames:[6,7,9,4,7]},
  enemy_ch4_furnace_golem:{family:'project-authored-machine-furnace-golem',w:300,h:280,displayHeight:258,contact:4,frames:[7,8,8,4,8]},
  enemy_ch4_folded_soldier:{family:'project-authored-anomaly-folded-form',w:230,h:240,displayHeight:220,contact:2,frames:[6,8,6,4,7]},
  enemy_ch4_error_mass:{family:'project-authored-anomaly-error-mass',w:260,h:220,displayHeight:204,contact:2,frames:[7,8,8,4,7]},
  enemy_ch4_void_lens:{family:'project-authored-anomaly-void-lens',w:280,h:240,displayHeight:222,contact:5,frames:[7,8,8,4,7]},
  enemy_ch4_fusion_cavalry:{family:'project-authored-machine-anomaly-fusion',w:320,h:250,displayHeight:230,contact:2,frames:[7,8,7,4,8]},
  boss_ch4_moving_throne:{family:'project-authored-machine-throne-boss',w:410,h:330,displayHeight:300,contact:5,frames:[8,8,9,4,8]},
  boss_ch4_zero_engine:{family:'project-authored-machine-anomaly-zero-engine',w:420,h:340,displayHeight:310,contact:4,frames:[8,8,11,4,9]},
};
function assert(ok,msg){if(!ok)throw new Error(`[chapter-04-runtime] ${msg}`);}
assert(contract.batchId==='chapter-04-production-01','contract batch id drift');
assert(contract.status==='AWAITING_ART'&&contract.reviewStatus==='PENDING','contract lifecycle must remain pending');
assert(contract.normalRuntimeAuthoritative===false&&contract.generativeAiUsed===false,'contract runtime/AI policy drift');
assert(contract.sourcePolicy==='PROJECT_AUTHORED_DETERMINISTIC_ONLY','source policy drift');
assert(contract.targets.length===10,'expected exactly 10 chapter-four targets');
assert(contract.battlefields.length===0,'chapter four must not create redundant battlefield themes');
assert(new Set(contract.targets.map((item)=>item.unitId)).size===10,'chapter-four target ids must be unique');
assert(metadata.batchId==='chapter-04-production-01'&&metadata.generatorVersion===1,'metadata generator drift');
assert(metadata.status==='UNREVIEWED_RUNTIME_FILES'&&metadata.humanReview==='PENDING','metadata review state drift');
assert(metadata.normalRuntimeAuthoritative===false&&metadata.generativeAiUsed===false,'metadata runtime/AI policy drift');
assert(metadata.sourcePolicy==='PROJECT_AUTHORED_DETERMINISTIC_ONLY','metadata source policy drift');
assert(Object.keys(metadata.targets).length===10,'metadata target count drift');
const seenSha=new Set();
for(const [unitId,spec] of Object.entries(expected)){
  const meta=metadata.targets[unitId];assert(meta,`missing metadata ${unitId}`);
  assert(meta.assetId===`unit:${unitId}`,`${unitId} asset id mismatch`);
  assert(meta.sourceFamily===spec.family,`${unitId} source family mismatch`);
  assert(meta.projectAuthoredDeterministic===true&&meta.structuralRework===false,`${unitId} authorship contract mismatch`);
  assert(meta.reviewStatus==='UNREVIEWED_RUNTIME_FILES',`${unitId} review state drift`);
  assert(meta.frameWidth===spec.w&&meta.frameHeight===spec.h&&meta.displayHeight===spec.displayHeight,`${unitId} dimensions mismatch`);
  assert(meta.attackContactFrame===spec.contact,`${unitId} contact frame mismatch`);
  for(let i=0;i<motions.length;i++){
    const motion=motions[i],mm=meta.motions[motion];assert(mm,`${unitId}/${motion} metadata missing`);assert(mm.frames===spec.frames[i],`${unitId}/${motion} frame count mismatch`);
    const path=resolve(unitsRoot,unitId,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${unitId}/${motion}`);
    assert(png.width===spec.w*spec.frames[i]&&png.height===spec.h,`${unitId}/${motion} PNG dimensions mismatch`);assert(mm.bytes===bytes.length,`${unitId}/${motion} byte length mismatch`);
    const digest=sha256(bytes);assert(mm.sha256===digest,`${unitId}/${motion} sha mismatch`);assert(!seenSha.has(digest),`${unitId}/${motion} duplicates another chapter-four strip`);seenSha.add(digest);
  }
}
for(const theme of ['canyon','fortress','ruins','burning','moon','golden'])for(const file of ['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']){const info=await stat(resolve(battlefieldsRoot,theme,file));assert(info.size>80,`reused battlefield missing/empty ${theme}/${file}`);}
assert(seenSha.size===50,'expected exactly 50 unique chapter-four strips');
console.log(`[chapter-04-runtime] validated ${seenSha.size} unique strips / 10 targets / 6 reused battlefield themes`);
