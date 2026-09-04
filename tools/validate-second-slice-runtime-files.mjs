import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/second-slice-early-wave-02.json'),'utf8'));
const meta=JSON.parse(await readFile(resolve(root,'apps/client/public/assets/production/units/second-slice-runtime-metadata.json'),'utf8'));
const motions=['idle','move','attack','knockback','death'];
const targetMap=new Map(contract.targets.map((target)=>[target.runtimePath,target]));
function fail(message){throw new Error(`[second-slice runtime] ${message}`);}
function dims(bytes){if(bytes.length<24||bytes[0]!==0x89||bytes[1]!==0x50||bytes[2]!==0x4e||bytes[3]!==0x47)fail('non-PNG runtime file');return[bytes.readUInt32BE(16),bytes.readUInt32BE(20)];}

if(contract.status!=='AWAITING_ART'||contract.reviewLifecycle!=='UNREVIEWED_RUNTIME_CANDIDATES_ONLY')fail('contract lifecycle advanced without review');
if(contract.sourcePolicy?.generativeAiAllowed!==false)fail('second-slice generative AI policy drifted');
const deferred=contract.deferred?.find((entry)=>entry.assetId==='unit:enemy-sprinter');
if(!deferred||!String(deferred.reason).includes('BEAST'))fail('enemy-sprinter must remain explicitly deferred for honest BEAST sourcing');
if(meta.schemaVersion!==1||meta.batchId!==contract.batchId||meta.generator!=='tools/materialize-second-slice-production-art.mjs'||meta.generatorVersion!==1)fail('second-slice generator metadata missing');
if(meta.reviewStatus!=='UNREVIEWED_RUNTIME_FILES'||meta.structuralRework!==true)fail('materializer must remain unreviewed structural rework');
if(targetMap.size!==8)fail(`expected 8 second-slice targets, got ${targetMap.size}`);

const hashes=new Set();
for(const [runtimePath,target] of targetMap){
  if(target.status!=='AWAITING_ART')fail(`${target.assetId} advanced without human review`);
  const targetMeta=meta.targets?.[runtimePath];if(!targetMeta)fail(`${runtimePath} missing runtime metadata`);
  if(targetMeta.assetId!==target.assetId||targetMeta.sourceFamily!==target.sourceFamily)fail(`${runtimePath} identity/source drift`);
  if(targetMeta.displayHeight!==target.displayHeight||targetMeta.attackContactFrame!==target.attackContactFrame)fail(`${runtimePath} display/contact drift`);
  if(targetMeta.reviewStatus!=='UNREVIEWED_RUNTIME_FILES'||targetMeta.structuralRework!==true)fail(`${runtimePath} claimed review or lost structural rework flag`);
  for(const motion of motions){
    const entry=targetMeta.motions?.[motion];if(!entry)fail(`${runtimePath}/${motion} missing metadata`);
    if(typeof entry.sourceUrl!=='string'||!entry.sourceUrl.startsWith('https://raw.githubusercontent.com/'))fail(`${runtimePath}/${motion} missing pinned source URL`);
    if(typeof entry.sourceLocalPath!=='string'||!entry.sourceLocalPath.startsWith('/assets/characters/'))fail(`${runtimePath}/${motion} missing local source reference`);
    const bytes=await readFile(resolve(root,`apps/client/public${entry.url}`));const[w,h]=dims(bytes);
    if(w!==entry.frameWidth*entry.frames||h!==entry.frameHeight)fail(`${runtimePath}/${motion} dimensions mismatch`);
    if(bytes.length<700)fail(`${runtimePath}/${motion} unexpectedly small`);
    const hash=createHash('sha256').update(bytes).digest('hex');if(hash!==entry.sha256)fail(`${runtimePath}/${motion} sha256 mismatch`);
    const key=`${motion}:${hash}`;if(hashes.has(key))fail(`${runtimePath}/${motion} duplicates another second-slice strip`);hashes.add(key);
  }
}

for(const battlefield of contract.battlefields){
  if(battlefield.status!=='AWAITING_ART')fail(`${battlefield.assetId} advanced without human review`);
  const theme=battlefield.assetId.includes(':canyon:')?'canyon':battlefield.assetId.includes(':ruins:')?'ruins':undefined;if(!theme)fail(`${battlefield.assetId} unsupported theme`);
  const metadata=JSON.parse(await readFile(resolve(root,`apps/client/public/assets/production/battlefields/${theme}/${theme}-runtime-metadata.json`),'utf8'));
  if(metadata.assetId!==battlefield.assetId||metadata.reviewStatus!=='UNREVIEWED_RUNTIME_FILES'||metadata.generativeAiUsed!==false)fail(`${theme} battlefield metadata drift`);
  if(metadata.humanReview?.status!=='PENDING'||metadata.captures!==null)fail(`${theme} battlefield falsely claims review evidence`);
  for(const file of ['battlefield-base.svg','background-landmarks.svg','foreground-low-density.svg']){
    const text=await readFile(resolve(root,`apps/client/public/assets/production/battlefields/${theme}/${file}`),'utf8');
    if(!text.includes('<svg')||text.length<500)fail(`${theme}/${file} invalid or unexpectedly small`);
  }
}

console.log(`[second-slice runtime] ${targetMap.size*motions.length} PNG strips + ${contract.battlefields.length} layered battlefields validated; lifecycle remains AWAITING_ART`);
