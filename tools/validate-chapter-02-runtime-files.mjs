import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const battlefieldsRoot=resolve(root,'apps/client/public/assets/production/battlefields');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/chapter-02-production-01.json'),'utf8'));
const metadata=JSON.parse(await readFile(resolve(unitsRoot,'chapter-02-runtime-metadata.json'),'utf8'));
const motions=['idle','move','attack','knockback','death'];
const expected={
  enemy_ch2_mossboar:{family:'project-authored-nature-beast',w:230,h:170,displayHeight:176,contact:2,frames:[6,8,6,4,6]},
  enemy_ch2_umbrella:{family:'project-authored-nature-fungus',w:190,h:180,displayHeight:164,contact:3,frames:[6,8,7,4,6]},
  enemy_ch2_vinerider:{family:'project-authored-nature-vine',w:250,h:190,displayHeight:190,contact:3,frames:[6,8,7,4,6]},
  enemy_ch2_seedbattery:{family:'project-authored-nature-structure',w:250,h:200,displayHeight:188,contact:4,frames:[6,8,8,4,7]},
  enemy_ch2_bonewheel:{family:'project-authored-undead-wheel',w:180,h:160,displayHeight:152,contact:1,frames:[6,8,5,4,6]},
  enemy_ch2_coffinbug:{family:'project-authored-undead-insect',w:230,h:180,displayHeight:194,contact:2,frames:[6,8,6,4,7]},
  enemy_ch2_gravebell:{family:'project-authored-undead-bell',w:230,h:220,displayHeight:204,contact:4,frames:[6,8,8,4,7]},
  enemy_ch2_revivedarmor:{family:'project-authored-undead-armor',w:230,h:220,displayHeight:210,contact:2,frames:[6,8,6,4,8]},
  boss_ch2_rootwidow:{family:'project-authored-nature-boss',w:320,h:280,displayHeight:268,contact:4,frames:[8,8,8,4,8]},
  boss_ch2_funeral_king:{family:'project-authored-undead-boss',w:330,h:290,displayHeight:276,contact:5,frames:[8,8,8,4,8]},
};
function assert(ok,msg){if(!ok)throw new Error(`[chapter-02-runtime] ${msg}`);}
assert(contract.batchId==='chapter-02-production-01','contract batch id drift');
assert(contract.status==='AWAITING_ART'&&contract.reviewStatus==='PENDING','contract lifecycle must remain pending');
assert(contract.normalRuntimeAuthoritative===false&&contract.generativeAiUsed===false,'contract runtime/AI policy drift');
assert(contract.sourcePolicy==='PROJECT_AUTHORED_DETERMINISTIC_ONLY','source policy drift');
assert(contract.targets.length===10,'expected exactly 10 chapter-two targets');
assert(contract.battlefields.length===0,'chapter two must not create redundant battlefield themes');
assert(metadata.batchId==='chapter-02-production-01'&&metadata.generatorVersion===1,'metadata generator drift');
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
    const motion=motions[i],mm=meta.motions[motion];assert(mm,`${unitId}/${motion} metadata missing`);
    assert(mm.frames===spec.frames[i],`${unitId}/${motion} frame count mismatch`);
    const path=resolve(unitsRoot,unitId,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${unitId}/${motion}`);
    assert(png.width===spec.w*spec.frames[i]&&png.height===spec.h,`${unitId}/${motion} PNG dimensions mismatch`);
    assert(mm.bytes===bytes.length,`${unitId}/${motion} byte length mismatch`);
    const digest=sha256(bytes);assert(mm.sha256===digest,`${unitId}/${motion} sha mismatch`);
    assert(!seenSha.has(digest),`${unitId}/${motion} duplicates another chapter-two strip`);seenSha.add(digest);
  }
}
for(const theme of ['meadow','moon','ruins','canyon','fortress']){
  for(const file of ['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']){
    const info=await stat(resolve(battlefieldsRoot,theme,file));assert(info.size>80,`reused battlefield missing/empty ${theme}/${file}`);
  }
}
console.log(`[chapter-02-runtime] validated ${seenSha.size} unique strips / 10 targets / 5 reused battlefield themes`);
