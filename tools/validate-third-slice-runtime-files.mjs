import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/third-slice-mid-wave-03.json'),'utf8'));
const unitMeta=JSON.parse(await readFile(resolve(root,'apps/client/public/assets/production/units/third-slice-runtime-metadata.json'),'utf8'));
const fieldMeta=JSON.parse(await readFile(resolve(root,'apps/client/public/assets/production/battlefields/third-slice-battlefield-metadata.json'),'utf8'));
const fail=(m)=>{throw new Error(`[third-slice runtime check] ${m}`);};
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING')fail('contract lifecycle must remain AWAITING_ART/PENDING');
if(contract.lifecycle?.normalRuntimeAuthority!==false||contract.lifecycle?.humanReview!=='PENDING'||contract.lifecycle?.reviewer!==null||contract.lifecycle?.reviewedAt!==null)fail('human review lifecycle drift');
if(unitMeta.status!=='UNREVIEWED_RUNTIME_FILES'||unitMeta.humanReview!=='PENDING'||unitMeta.generativeAiUsed!==false)fail('unit metadata lifecycle/provenance drift');
if(fieldMeta.status!=='UNREVIEWED_RUNTIME_FILES'||fieldMeta.humanReview!=='PENDING'||fieldMeta.generativeAiUsed!==false)fail('battlefield metadata lifecycle/provenance drift');
const expectedTargets=['duelist/duelist_f1','duelist/duelist_f2','duelist/duelist_f3','lancer/lancer_f1','lancer/lancer_f2','lancer/lancer_f3','battlemage/battlemage_f1','battlemage/battlemage_f2','battlemage/battlemage_f3','enemy-sniper'];
const expectedMotions=['idle','move','attack','knockback','death'];
for(const id of expectedTargets){
  const target=unitMeta.targets?.[id];if(!target)fail(`missing target metadata ${id}`);
  if(target.structuralRework!==true||target.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail(`target ${id} must remain structural-rework/unreviewed`);
  for(const motion of expectedMotions){
    const m=target.motions?.[motion];if(!m)fail(`missing ${id}/${motion}`);
    const bytes=await readFile(resolve(root,m.file));const png=decodePng(bytes,`${id}/${motion}`);
    if(png.width!==target.frameWidth*m.frames||png.height!==target.frameHeight)fail(`${id}/${motion} dimensions mismatch`);
    if(bytes.length<256)fail(`${id}/${motion} unexpectedly small`);
  }
}
if(Object.keys(unitMeta.targets??{}).length!==expectedTargets.length)fail('unexpected target count');
for(const theme of ['fortress','burning','moon']){
  const entry=fieldMeta.themes?.[theme];if(!entry)fail(`missing battlefield metadata ${theme}`);
  for(const name of ['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']){
    const path=resolve(root,`apps/client/public/assets/production/battlefields/${theme}/${name}`);const info=await stat(path);if(info.size<250)fail(`${theme}/${name} unexpectedly small`);
    const svg=await readFile(path,'utf8');if(!svg.includes('width="1280"')||!svg.includes('height="720"'))fail(`${theme}/${name} must be 1280x720 SVG`);
  }
}
if(!contract.scope?.deferred?.some((entry)=>entry.id==='enemy-sprinter'))fail('enemy-sprinter BEAST defer contract must remain explicit');
console.log('[third-slice runtime check] 50 unit motion strips + 9 battlefield layers verified; lifecycle remains unapproved');
