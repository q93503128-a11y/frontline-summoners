import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const battlefieldsRoot=resolve(root,'apps/client/public/assets/production/battlefields');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/chapter-03-production-01.json'),'utf8'));
const metadata=JSON.parse(await readFile(resolve(unitsRoot,'chapter-03-runtime-metadata.json'),'utf8'));
const motions=['idle','move','attack','knockback','death'];
const expected={
  enemy_ch3_glasseye:{family:'project-authored-arcane-eye',w:210,h:200,displayHeight:182,contact:3,frames:[6,8,7,4,6]},
  enemy_ch3_spellbug:{family:'project-authored-arcane-insect',w:180,h:150,displayHeight:142,contact:1,frames:[6,8,5,4,6]},
  enemy_ch3_floating_library:{family:'project-authored-arcane-floating-structure',w:300,h:240,displayHeight:222,contact:5,frames:[7,8,8,4,7]},
  enemy_ch3_inkdemon:{family:'project-authored-demon-ink',w:210,h:160,displayHeight:154,contact:3,frames:[6,8,7,4,6]},
  enemy_ch3_chain_demon:{family:'project-authored-demon-chain',w:260,h:230,displayHeight:214,contact:4,frames:[6,8,8,4,7]},
  enemy_ch3_contract_enforcer:{family:'project-authored-demon-contract-armor',w:270,h:250,displayHeight:232,contact:3,frames:[7,8,7,4,8]},
  enemy_ch3_arcane_battery:{family:'project-authored-arcane-structure',w:330,h:240,displayHeight:218,contact:5,frames:[6,8,8,4,7]},
  enemy_ch3_torn_mirror:{family:'project-authored-arcane-demon-mirror',w:280,h:250,displayHeight:226,contact:3,frames:[7,8,8,4,7]},
  boss_ch3_archmagus:{family:'project-authored-arcane-boss',w:380,h:320,displayHeight:296,contact:6,frames:[8,8,9,4,8]},
  boss_ch3_belzar:{family:'project-authored-demon-boss',w:360,h:310,displayHeight:288,contact:4,frames:[8,8,8,4,8]},
};
function assert(ok,msg){if(!ok)throw new Error(`[chapter-03-runtime] ${msg}`);}
assert(contract.batchId==='chapter-03-production-01','contract batch id drift');
assert(contract.status==='AWAITING_ART'&&contract.reviewStatus==='PENDING','contract lifecycle must remain pending');
assert(contract.normalRuntimeAuthoritative===false&&contract.generativeAiUsed===false,'contract runtime/AI policy drift');
assert(contract.sourcePolicy==='PROJECT_AUTHORED_DETERMINISTIC_ONLY','source policy drift');
assert(contract.targets.length===10,'expected exactly 10 chapter-three targets');
assert(contract.battlefields.length===0,'chapter three must not create redundant battlefield themes');
assert(metadata.batchId==='chapter-03-production-01'&&metadata.generatorVersion===1,'metadata generator drift');
assert(metadata.status==='UNREVIEWED_RUNTIME_FILES'&&metadata.humanReview==='PENDING','metadata review state drift');
assert(metadata.normalRuntimeAuthoritative===false&&metadata.generativeAiUsed===false,'metadata runtime/AI policy drift');
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
    const digest=sha256(bytes);assert(mm.sha256===digest,`${unitId}/${motion} sha mismatch`);assert(!seenSha.has(digest),`${unitId}/${motion} duplicates another chapter-three strip`);seenSha.add(digest);
  }
}
for(const theme of ['golden','ruins','moon','fortress','canyon','burning'])for(const file of ['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']){const info=await stat(resolve(battlefieldsRoot,theme,file));assert(info.size>80,`reused battlefield missing/empty ${theme}/${file}`);}
console.log(`[chapter-03-runtime] validated ${seenSha.size} unique strips / 10 targets / 6 reused battlefield themes`);
