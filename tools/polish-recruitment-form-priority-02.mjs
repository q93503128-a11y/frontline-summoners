import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, ellipse, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const metadataPath=resolve(unitsRoot,'recruitment-form-runtime-metadata.json');
const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
const MOTIONS=['idle','move','attack','knockback','death'];
const TARGETS=new Set([
  'char_s03_arc_railer','char_s03_rxomega','char_s02_gormu','char_s02_barga','char_common_c_turnip_rider',
  'char_common_b_clockduck','char_common_b_lantern_witch','char_s01_riena','char_s01_totoria',
]);
function assert(ok,msg){if(!ok)throw new Error(`[recruitment-priority-02] ${msg}`);}
assert(metadata.formCount===99&&metadata.humanReview==='PENDING'&&metadata.normalRuntimeAuthoritative===false,'recruitment form boundary drift');
function assemble(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function phase(i,n){return i/Math.max(1,n-1);}
function movement(motion,i,n){const t=phase(i,n);return{bob:motion==='move'?(i%2?-3:3):motion==='idle'?(i%3===1?-2:0):motion==='death'?Math.round(t*15):0,pulse:motion==='attack'?Math.sin(t*Math.PI):0,alt:i%2?-1:1};}
function pal(unitId){if(unitId.startsWith('char_s03_'))return{d:[29,37,47,255],m:[72,94,112,255],a:[209,74,66,255],g:[87,211,241,255],l:[183,203,213,255]};if(unitId.startsWith('char_s02_'))return{d:[47,53,38,255],m:[98,113,70,255],a:[178,122,65,255],g:[144,204,116,255],l:[187,174,118,255]};if(unitId.startsWith('char_s01_'))return{d:[38,44,65,255],m:[105,117,157,255],a:[204,168,89,255],g:[176,211,248,255],l:[224,230,239,255]};return{d:[53,48,44,255],m:[112,96,80,255],a:[168,111,69,255],g:[225,193,124,255],l:[197,178,143,255]};}
function draw(out,w,h,meta,motion,i,n){
  const id=meta.unitId,o=meta.formOrder,p=pal(id),{bob,pulse,alt}=movement(motion,i,n),cx=Math.round(w*.46),cy=Math.round(h*.50)+bob,R=(x)=>Math.min(w-8,Math.round(x));
  if(id==='char_s02_barga'){
    if(o===2){triangle(out,w,h,[cx+28,cy-35],[R(cx+95+24*pulse),cy-20],[cx+31,cy+2],p.l,.93);rect(out,w,h,cx-78,cy-48,cx-55,cy+42,p.d,.91);}
    if(o===3){triangle(out,w,h,[cx-75,cy-30],[cx-105,cy-66],[cx-82,cy+20],p.a,.92);triangle(out,w,h,[cx+45,cy-38],[R(cx+115+26*pulse),cy-9],[cx+47,cy+18],p.l,.93);ellipse(out,w,h,cx-8,cy-74,38,22,p.g,.46);}
  }else if(id==='char_s02_gormu'){
    if(o===2){rect(out,w,h,cx-93,cy-66,cx-66,cy+8,p.d,.95);triangle(out,w,h,[cx-96,cy-66],[cx-79,cy-103],[cx-61,cy-66],p.l,.9);line(out,w,h,cx+45,cy-15,R(cx+91+24*pulse),cy-29,p.a,10,.9);}
    if(o===3){rect(out,w,h,cx-104,cy-73,cx-73,cy+13,p.d,.96);rect(out,w,h,cx+50,cy-64,cx+79,cy+2,p.m,.94);triangle(out,w,h,[cx-107,cy-73],[cx-90,cy-118],[cx-70,cy-73],p.l,.9);triangle(out,w,h,[cx+48,cy-64],[cx+65,cy-110],[cx+82,cy-64],p.g,.72);line(out,w,h,cx+38,cy+8,R(cx+101+31*pulse),cy+29,p.a,12,.9);}
  }else if(id==='char_common_c_turnip_rider'){
    if(o===2){triangle(out,w,h,[cx-34,cy-54],[cx-12,cy-96],[cx+2,cy-50],p.g,.86);}
    if(o===3){triangle(out,w,h,[cx-44,cy-55],[cx-22,cy-109],[cx-2,cy-51],p.g,.92);triangle(out,w,h,[cx-2,cy-52],[cx+25,cy-103],[cx+34,cy-45],p.l,.85);line(out,w,h,cx+28,cy-3,R(cx+85+33*pulse),cy-14,p.d,9,.95);triangle(out,w,h,[R(cx+83+33*pulse),cy-15],[R(cx+103+35*pulse),cy-11],[R(cx+84+33*pulse),cy-4],p.a,.92);}
  }else if(id==='char_s03_arc_railer'){
    if(o===2){rect(out,w,h,cx-67,cy-91,cx+52,cy-70,p.d,.94);line(out,w,h,cx+12,cy-79,R(cx+111+18*pulse),cy-79,p.g,9,.85);triangle(out,w,h,[cx-60,cy-91],[cx-42,cy-120],[cx-19,cy-91],p.a,.84);}
    if(o===3){rect(out,w,h,cx-75,cy-102,cx+61,cy-75,p.d,.95);line(out,w,h,cx+4,cy-86,R(cx+126+24*pulse),cy-86,p.g,12,.9);triangle(out,w,h,[cx-74,cy-101],[cx-52,cy-137],[cx-25,cy-100],p.l,.85);triangle(out,w,h,[cx+23,cy-101],[cx+48,cy-136],[cx+65,cy-99],p.a,.86);}
  }else if(id==='char_s03_rxomega'){
    if(o===2){rect(out,w,h,cx-87,cy-65,cx-43,cy+58,p.l,.96);rect(out,w,h,cx-80,cy-56,cx-50,cy+49,p.d,.94);}
    if(o===3){rect(out,w,h,cx-103,cy-73,cx-40,cy+70,p.l,.97);rect(out,w,h,cx-95,cy-64,cx-49,cy+60,p.d,.95);triangle(out,w,h,[cx-103,cy-73],[cx-78,cy-108],[cx-48,cy-73],p.g,.72);rect(out,w,h,cx+46,cy-49,cx+71,cy+47,p.m,.92);}
  }else if(id==='char_common_b_clockduck'&&o===2){
    ellipse(out,w,h,cx+42,cy-55,28,21,p.l,.96);triangle(out,w,h,[cx+65,cy-58],[R(cx+103),cy-46],[cx+65,cy-38],p.a,.94);line(out,w,h,cx-42,cy-23,cx-76,cy-54,p.d,7,.95);line(out,w,h,cx-76,cy-54,cx-91,cy-34,p.d,7,.95);
  }else if(id==='char_common_b_lantern_witch'&&o===2){
    line(out,w,h,cx+42,cy-63,cx+72,cy+55,p.d,7,.94);ellipse(out,w,h,cx+73,cy+45,23+4*alt,30,p.g,.7);triangle(out,w,h,[cx-33,cy-63],[cx-8,cy-103],[cx+8,cy-58],p.a,.84);
  }else if(id==='char_s01_riena'&&o===2){
    line(out,w,h,cx+28,cy-8,R(cx+91+20*pulse),cy+31,p.d,13,.95);ellipse(out,w,h,R(cx+94+20*pulse),cy+33,28,25,p.l,.94);line(out,w,h,R(cx+82+20*pulse),cy+22,R(cx+106+20*pulse),cy+44,p.a,6,.88);
  }else if(id==='char_s01_totoria'&&o===2){
    line(out,w,h,cx-39,cy-64,cx-69,cy+27,p.d,6,.92);line(out,w,h,cx+29,cy-64,cx+73,cy+19,p.d,6,.92);ellipse(out,w,h,cx+79,cy+25,31,38,p.m,.93);line(out,w,h,cx+72,cy+49,cx+91,cy+75,p.l,8,.9);line(out,w,h,cx+85,cy+47,cx+110,cy+69,p.l,8,.9);
  }
}

let touched=0;
for(const [formId,meta] of Object.entries(metadata.targets)){
  if(!TARGETS.has(meta.unitId))continue;touched+=1;
  for(const motion of MOTIONS){const mm=meta.motions[motion],path=resolve(unitsRoot,meta.unitId,formId,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${formId}/${motion}`);assert(png.width===meta.frameWidth*mm.frames&&png.height===meta.frameHeight,`${formId}/${motion} dimensions drift`);const frames=[];for(let i=0;i<mm.frames;i++){const frame=sourceFrame(png,meta.frameWidth,meta.frameHeight,i);draw(frame,meta.frameWidth,meta.frameHeight,meta,motion,i,mm.frames);frames.push(frame);}const encoded=encodePng(meta.frameWidth*mm.frames,meta.frameHeight,assemble(frames,meta.frameWidth,meta.frameHeight));await writeFile(path,encoded);mm.bytes=encoded.length;mm.sha256=sha256(encoded);}
  meta.visualPolishPriority02={version:1,kind:'TARGETED_DIFFERENTIATION_AND_ATTACK_READABILITY',reviewStatus:'UNREVIEWED_RUNTIME_FILES'};
}
metadata.visualPolishPriority02={version:1,targetRoots:TARGETS.size,touchedForms:touched,humanReview:'PENDING',normalRuntimeAuthoritative:false};
await writeFile(metadataPath,`${JSON.stringify(metadata,null,2)}\n`);
console.log(`[recruitment-priority-02] polished ${touched} forms across ${TARGETS.size} targeted recruitment roots`);
