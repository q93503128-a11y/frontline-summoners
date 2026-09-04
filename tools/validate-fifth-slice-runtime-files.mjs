import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, sha256 } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/fifth-slice-late-wave-05.json'),'utf8'));
const meta=JSON.parse(await readFile(resolve(root,'apps/client/public/assets/production/units/fifth-slice-runtime-metadata.json'),'utf8'));
const fail=(m)=>{throw new Error(`[fifth-slice runtime check] ${m}`);};
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)fail('contract lifecycle must remain AWAITING_ART/PENDING/non-authoritative');
if(contract.generativeAiUsed!==false||contract.reviewConstraints?.humanApprovalRequired!==true||contract.reviewConstraints?.automatedMaterializationIsNotReviewEvidence!==true)fail('review/provenance contract drift');
if(meta.status!=='UNREVIEWED_RUNTIME_FILES'||meta.humanReview!=='PENDING'||meta.reviewer!==null||meta.reviewedAt!==null||meta.generativeAiUsed!==false||meta.normalRuntimeAuthoritative!==false)fail('runtime metadata lifecycle drift');
const ids=['heretic/heretic_f1','heretic/heretic_f2','heretic/heretic_f3','enemy-cultist','enemy-sprinter'];
const motions=['idle','move','attack','knockback','death'];
for(const id of ids){
  const t=meta.targets?.[id];if(!t)fail(`missing target ${id}`);
  if(t.structuralRework!==true||t.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail(`${id} must remain structural-rework/unreviewed`);
  for(const motion of motions){const m=t.motions?.[motion];if(!m)fail(`missing ${id}/${motion}`);const bytes=await readFile(resolve(root,m.file));const png=decodePng(bytes,`${id}/${motion}`);if(png.width!==t.frameWidth*m.frames||png.height!==t.frameHeight)fail(`${id}/${motion} dimensions mismatch`);if(sha256(bytes)!==m.sha256)fail(`${id}/${motion} sha mismatch`);if(bytes.length<256)fail(`${id}/${motion} unexpectedly small`);}
}
if(Object.keys(meta.targets??{}).length!==ids.length)fail('unexpected fifth-slice target count');
if(meta.targets['enemy-sprinter']?.sourceFamily!=='project-authored-beast')fail('enemy-sprinter must remain project-authored beast');
if(contract.battlefields?.length!==0)fail('ST14-18 must not invent a new battlefield theme');
const expectedThemes=['burning','fortress','ruins','golden','meadow'];
for(const theme of expectedThemes){if(!contract.reusedBattlefields?.some((x)=>x.theme===theme))fail(`missing reused battlefield contract ${theme}`);for(const name of ['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']){const p=resolve(root,`apps/client/public/assets/production/battlefields/${theme}/${name}`);const info=await stat(p);if(info.size<250)fail(`${theme}/${name} unexpectedly small`);}}
console.log('[fifth-slice runtime check] 25 unit motion strips + 5 reused battlefield themes verified; lifecycle remains unapproved');
