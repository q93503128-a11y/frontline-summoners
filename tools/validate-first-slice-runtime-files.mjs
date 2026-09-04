import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const meta=JSON.parse(await readFile(resolve(root,'apps/client/public/assets/production/units/first-slice-runtime-metadata.json'),'utf8'));
const plan=JSON.parse(await readFile(resolve(root,'assets/raw/production/first-slice-rework-01.json'),'utf8'));
const slice=JSON.parse(await readFile(resolve(root,'assets/raw/production/vertical-slice-01.json'),'utf8'));
const motions=['idle','move','attack','knockback','death'];
const targetMap=new Map([
  ['militia/militia_f1','unit:militia:militia_f1'],['militia/militia_f2','unit:militia:militia_f2'],['militia/militia_f3','unit:militia:militia_f3'],['enemy-raider','unit:enemy-raider'],['enemy-boss','unit:enemy-boss'],
]);
const motionLanguageTargets=new Set(['militia/militia_f2','militia/militia_f3','enemy-raider']);
function fail(m){throw new Error(`[first-slice runtime] ${m}`)}
function dims(b){if(b.length<24||b[0]!==0x89||b[1]!==0x50||b[2]!==0x4e||b[3]!==0x47)fail('non-PNG runtime file');return [b.readUInt32BE(16),b.readUInt32BE(20)];}
if(meta.schemaVersion!==2||meta.generatorVersion!==2||meta.structuralRework!==true)fail('runtime metadata must identify structural CC0 rework generator v2');
if(meta.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail('materialization must not claim review');
if(meta.motionLanguagePipeline?.generator!=='tools/polish-first-slice-unit-motion-language.mjs'||meta.motionLanguagePipeline?.version!==1||meta.motionLanguagePipeline?.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail('first-slice unit motion-language pipeline v1 missing');
if(meta.bossGenerator?.generator!=='tools/materialize-first-slice-boss.mjs'||meta.bossGenerator?.generatorVersion!==4||meta.bossGenerator?.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail('golden-mask boss generator v4 missing');
const planById=new Map(plan.targets.map(x=>[x.assetId,x])); const sliceById=new Map(slice.units.map(x=>[x.assetId,x])); const hashes=new Set();
for(const [target,assetId] of targetMap){
  const targetMeta=meta.targets?.[target];const planTarget=planById.get(assetId);if(!targetMeta||!planTarget)fail(`${target} missing target metadata/contract`);
  if(targetMeta.sourceFamily!==planTarget.sourceFamily)fail(`${target} source family drift`);
  if(targetMeta.structuralRework!==true)fail(`${target} missing structural rework flag`);
  if(motionLanguageTargets.has(target)){
    if(targetMeta.motionLanguage?.version!==1||targetMeta.motionLanguage?.kind!=='FIRST_SLICE_CHARACTER_MOTION_PASS'||targetMeta.motionLanguage?.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail(`${target} motion-language contract missing`);
    if(!Array.isArray(targetMeta.motionLanguage.emphasis)||targetMeta.motionLanguage.emphasis.length<3)fail(`${target} motion-language emphasis incomplete`);
  }
  if(target==='enemy-boss'){
    if(targetMeta.visualPolish?.version!==4||targetMeta.visualPolish?.kind!=='GOLDEN_MASK_MOTION_LANGUAGE_PASS'||targetMeta.visualPolish?.reviewStatus!=='UNREVIEWED_RUNTIME_FILES')fail('enemy-boss v4 motion-language metadata missing');
    const emphasis=targetMeta.visualPolish?.emphasis;if(!Array.isArray(emphasis)||!emphasis.includes('BODY_LEADS_KNOCKBACK')||!emphasis.includes('MASK_DELAYED_FOLLOW')||!emphasis.includes('MASK_FAILS_BEFORE_BODY_COLLAPSE'))fail('enemy-boss motion hierarchy incomplete');
  }
  for(const motion of motions){
    const entry=targetMeta.motions?.[motion];if(!entry)fail(`${target}/${motion} missing metadata`);
    const b=await readFile(resolve(root,`apps/client/public${entry.url}`));const [w,h]=dims(b);
    if(w!==entry.frameWidth*entry.frames||h!==entry.frameHeight)fail(`${target}/${motion} dimension mismatch`);
    if(b.length<512)fail(`${target}/${motion} unexpectedly small`);
    const hash=createHash('sha256').update(b).digest('hex');if(hash!==entry.sha256)fail(`${target}/${motion} sha256 mismatch`);
    const key=`${motion}:${hash}`;if(hashes.has(key))fail(`${target}/${motion} duplicates another target strip`);hashes.add(key);
  }
  if(sliceById.get(assetId)?.status!=='AWAITING_ART')fail(`${assetId} advanced without capture/human review`);
}
console.log(`[first-slice runtime] ${targetMap.size*motions.length} structurally reworked PNG strips validated with motion-language contracts; lifecycle intentionally remains AWAITING_ART`);
