import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitRoot=resolve(root,'apps/client/public/assets/production/units');
const fieldRoot=resolve(root,'apps/client/public/assets/production/battlefields');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/fourth-slice-mid-wave-04.json'),'utf8'));
const fieldMeta=JSON.parse(await readFile(resolve(fieldRoot,'fourth-slice-battlefield-metadata.json'),'utf8'));
const aggregate=JSON.parse(await readFile(resolve(unitRoot,'fourth-slice-runtime-metadata.json'),'utf8'));
const fail=(m)=>{throw new Error(`[fourth-slice runtime check] ${m}`);};
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)fail('contract lifecycle must remain AWAITING_ART/PENDING/non-authoritative');
if(contract.generativeAiUsed!==false||contract.reviewConstraints?.humanApprovalRequired!==true||contract.reviewConstraints?.automatedMaterializationIsNotReviewEvidence!==true)fail('contract provenance/review guard drift');
const expected=['pyromancer/pyromancer_f1','pyromancer/pyromancer_f2','pyromancer/pyromancer_f3','royal/royal_f1','royal/royal_f2','royal/royal_f3','enemy-berserker','enemy-knight'];
const motions=['idle','move','attack','knockback','death'];
if(aggregate.sliceId!=='fourth-slice-mid-wave-04'||aggregate.generator!=='tools/materialize-fourth-slice-runtime-index.mjs'||aggregate.generatorVersion!==1)fail('aggregate runtime index drift');
if(aggregate.status!=='UNREVIEWED_RUNTIME_FILES'||aggregate.humanReview!=='PENDING'||aggregate.normalRuntimeAuthoritative!==false||aggregate.generativeAiUsed!==false)fail('aggregate lifecycle/provenance drift');
if(aggregate.targetCount!==8||aggregate.stripCount!==40||Object.keys(aggregate.targets??{}).length!==8)fail('aggregate target/strip count drift');
for(const relative of expected){
  const metadata=JSON.parse(await readFile(resolve(unitRoot,relative,'runtime-metadata.json'),'utf8'));
  const indexed=aggregate.targets?.[relative];
  if(!indexed)fail(`aggregate missing ${relative}`);
  if(metadata.sliceId!=='fourth-slice-mid-wave-04'||metadata.generatorVersion!==1)fail(`${relative} generator metadata drift`);
  if(metadata.status!=='AWAITING_ART'||metadata.reviewStatus!=='UNREVIEWED_RUNTIME_FILES'||metadata.normalRuntimeAuthoritative!==false)fail(`${relative} lifecycle drift`);
  if(metadata.generativeAiUsed!==false||metadata.structuralRework!==true)fail(`${relative} provenance drift`);
  if(indexed.assetId!==metadata.assetId||indexed.sourceFamily!==metadata.sourceFamily||indexed.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail(`${relative} aggregate identity drift`);
  if(indexed.frameWidth!==metadata.frameWidth||indexed.frameHeight!==metadata.frameHeight||indexed.displayHeight!==metadata.displayHeight||indexed.attackContactFrame!==metadata.attackContactFrame)fail(`${relative} aggregate dimensions/contact drift`);
  if(relative==='enemy-knight'){
    if(metadata.sourceFamily!=='project-authored-beast'||metadata.projectAuthored!==true)fail('enemy-knight must remain project-authored beast, not human-source substitution');
  }else if(metadata.projectAuthored!==false)fail(`${relative} projectAuthored flag drift`);
  for(const motion of motions){
    const fileMeta=metadata.files?.[motion];if(!fileMeta)fail(`missing ${relative}/${motion} file metadata`);
    const indexedMotion=indexed.motions?.[motion];if(!indexedMotion)fail(`aggregate missing ${relative}/${motion}`);
    const bytes=await readFile(resolve(unitRoot,relative,`${motion}.png`));const png=decodePng(bytes,`${relative}/${motion}`);
    if(png.width!==metadata.frameWidth*fileMeta.frames||png.height!==metadata.frameHeight)fail(`${relative}/${motion} dimensions mismatch`);
    const digest=sha256(bytes);if(digest!==fileMeta.sha256)fail(`${relative}/${motion} sha mismatch`);
    if(bytes.length<256)fail(`${relative}/${motion} unexpectedly small`);
    if(indexedMotion.frames!==metadata.motions[motion]||indexedMotion.frameWidth!==metadata.frameWidth||indexedMotion.frameHeight!==metadata.frameHeight)fail(`${relative}/${motion} aggregate frame metadata drift`);
    if(indexedMotion.bytes!==bytes.length||indexedMotion.sha256!==digest||indexedMotion.url!==`/assets/production/units/${relative}/${motion}.png`)fail(`${relative}/${motion} aggregate byte/sha/url drift`);
  }
}
if(fieldMeta.sliceId!=='fourth-slice-mid-wave-04'||fieldMeta.theme!=='golden'||fieldMeta.stageAnchor!=='main_01_011')fail('golden battlefield metadata drift');
if(fieldMeta.status!=='UNREVIEWED_RUNTIME_FILES'||fieldMeta.humanReview!=='PENDING'||fieldMeta.generativeAiUsed!==false)fail('golden battlefield lifecycle/provenance drift');
for(const name of ['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']){
  const path=resolve(fieldRoot,'golden',name),info=await stat(path);if(info.size<300)fail(`golden/${name} unexpectedly small`);
  const svg=await readFile(path,'utf8');if(!svg.includes('width="1280"')||!svg.includes('height="720"'))fail(`golden/${name} must remain 1280x720`);
}
const boar=contract.targets.find((target)=>target.unitId==='enemy-knight');if(boar?.sourceFamily!=='project-authored-beast')fail('contract must preserve project-authored BEAST source');
console.log('[fourth-slice runtime check] 40 unit motion strips + aggregate audit index + golden 3-layer battlefield verified; lifecycle remains unapproved');
