import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, ellipse, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const metadataPath=resolve(unitsRoot,'recruitment-form-runtime-metadata.json');
const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
const MOTIONS=['idle','move','attack','knockback','death'];
const TARGET_FORMS=new Map([
  ['char_common_b_coffin_merchant_f2','COFFIN'],
  ['char_common_b_coffin_merchant_f3','COFFIN'],
  ['char_common_c_tin_squire_f3','TIN'],
  ['char_common_b_moss_golem_f2','MOSS'],
  ['char_s02_gormu_f2','GORMU'],
  ['char_s03_nana04_f2','NANA'],
  ['char_common_a_glass_keeper_f2','GLASS'],
]);
const EXPECTED_ROOTS=new Set([...TARGET_FORMS.keys()].map((formId)=>formId.replace(/_f[123]$/,'')));
function assert(ok,msg){if(!ok)throw new Error(`[recruitment-priority-04] ${msg}`);}
assert(metadata.formCount===99&&metadata.humanReview==='PENDING'&&metadata.normalRuntimeAuthoritative===false,'recruitment form boundary drift');
assert(TARGET_FORMS.size===7&&EXPECTED_ROOTS.size===6,'canonical priority-04 target set drift');
for(const formId of TARGET_FORMS.keys())assert(metadata.targets?.[formId],`canonical target missing: ${formId}`);
function assemble(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
const P={d:[35,39,47,255],m:[91,108,119,255],a:[202,112,72,255],g:[108,210,221,255],l:[221,226,231,255],green:[117,187,111,255],violet:[161,116,207,255],gold:[225,181,77,255]};
function draw(frame,w,h,meta,kind,motion,i,n){
  const cx=Math.round(w*.47),cy=Math.round(h*.5),t=i/Math.max(1,n-1),pulse=motion==='attack'?Math.sin(t*Math.PI):0,step=motion==='move'?(i%2?-1:1):0;
  const X=(x)=>Math.max(8,Math.min(w-8,Math.round(x))),Y=(y)=>Math.max(8,Math.min(h-8,Math.round(y)));
  if(kind==='COFFIN'&&meta.formOrder===2){rect(frame,w,h,cx-108,cy-86,cx-55,cy+76,P.d,.97);triangle(frame,w,h,[cx-108,cy-86],[cx-82,cy-126],[cx-55,cy-86],P.l,.94);line(frame,w,h,cx-82,cy-64,cx-82,cy+49,P.gold,8,.9);}
  if(kind==='COFFIN'&&meta.formOrder===3){rect(frame,w,h,cx+49,cy-104,cx+109,cy+80,P.d,.97);triangle(frame,w,h,[cx+49,cy-104],[cx+80,cy-147],[cx+109,cy-104],P.violet,.94);ellipse(frame,w,h,cx+79,cy-8,22,31,P.g,.75);if(motion==='attack')line(frame,w,h,cx+72,cy-5,X(cx+132+38*pulse),Y(cy-38),P.gold,11,.95);}
  if(kind==='TIN'){rect(frame,w,h,cx+43,cy-103,cx+91,cy+72,P.l,.97);triangle(frame,w,h,[cx+91,cy-94],[X(cx+128),cy-48],[cx+91,cy+20],P.d,.95);triangle(frame,w,h,[cx-25,cy-91],[cx,cy-137],[cx+25,cy-91],P.gold,.92);if(motion==='move')line(frame,w,h,cx+57,cy+62,cx+57+step*14,cy+102,P.d,11,.94);}
  if(kind==='MOSS'){for(const s of [-1,1]){line(frame,w,h,cx+s*34,cy-60,cx+s*82,cy-119,P.d,12,.95);triangle(frame,w,h,[cx+s*78,cy-121],[cx+s*108,cy-145],[cx+s*91,cy-94],P.green,.94);}ellipse(frame,w,h,cx-74,cy+21,30,24,P.green,.9);}
  if(kind==='GORMU'){rect(frame,w,h,cx-119,cy-58,cx-74,cy+64,P.d,.97);triangle(frame,w,h,[cx-119,cy-58],[cx-96,cy-112],[cx-72,cy-58],P.gold,.92);line(frame,w,h,cx-76,cy+20,X(cx-130),Y(cy+64),P.a,10,.92);if(motion==='attack')triangle(frame,w,h,[cx+38,cy-48],[X(cx+126+35*pulse),Y(cy-20)],[cx+43,cy+18],P.l,.94);}
  if(kind==='NANA'){line(frame,w,h,cx-42,cy-62,cx-94,cy-126,P.d,9,.94);line(frame,w,h,cx+18,cy-73,cx+84,cy-136,P.g,8,.9);ellipse(frame,w,h,cx-101,cy-134,19,16,P.a,.92);triangle(frame,w,h,[cx+72,cy-127],[cx+105,cy-151],[cx+91,cy-103],P.violet,.88);}
  if(kind==='GLASS'){triangle(frame,w,h,[cx-97,cy+70],[cx-55,cy-134],[cx-6,cy+54],P.g,.58);triangle(frame,w,h,[cx-62,cy+52],[cx-22,cy-104],[cx+13,cy+45],P.l,.72);ellipse(frame,w,h,cx-58,cy-27,19,30,P.violet,.64);if(motion==='attack')line(frame,w,h,cx-38,cy-45,X(cx+108+30*pulse),Y(cy-71),P.g,9,.86);}
}
let touched=0;
for(const [formId,kind] of TARGET_FORMS){
  const meta=metadata.targets[formId];
  const expectedRoot=formId.replace(/_f[123]$/,'');
  assert(meta.formId===formId&&meta.unitId===expectedRoot,`${formId} canonical identity drift`);
  touched++;
  for(const motion of MOTIONS){const mm=meta.motions[motion],path=resolve(unitsRoot,meta.unitId,formId,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${formId}/${motion}`);assert(png.width===meta.frameWidth*mm.frames&&png.height===meta.frameHeight,`${formId}/${motion} dimensions drift`);const frames=[];for(let i=0;i<mm.frames;i++){const frame=sourceFrame(png,meta.frameWidth,meta.frameHeight,i);draw(frame,meta.frameWidth,meta.frameHeight,meta,kind,motion,i,mm.frames);frames.push(frame);}const encoded=encodePng(meta.frameWidth*mm.frames,meta.frameHeight,assemble(frames,meta.frameWidth,meta.frameHeight));await writeFile(path,encoded);mm.bytes=encoded.length;mm.sha256=sha256(encoded);}
  meta.visualPolishPriority04={version:1,kind:'FINAL_EVOLUTION_WATCHLIST_DIFFERENTIATION',reviewStatus:'UNREVIEWED_RUNTIME_FILES'};
}
assert(touched===TARGET_FORMS.size,`expected ${TARGET_FORMS.size} canonical targets, got ${touched}`);
metadata.visualPolishPriority04={version:1,targetRoots:EXPECTED_ROOTS.size,touchedForms:touched,humanReview:'PENDING',normalRuntimeAuthoritative:false};
await writeFile(metadataPath,`${JSON.stringify(metadata,null,2)}\n`);
console.log(`[recruitment-priority-04] polished ${touched} canonical forms across ${EXPECTED_ROOTS.size} remaining WATCH roots`);
