import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, ellipse, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const metadataPath=resolve(unitsRoot,'recruitment-form-runtime-metadata.json');
const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
const MOTIONS=['idle','move','attack','knockback','death'];
const WATCH_ROOTS=[
  'char_s01_neria','char_common_c_tin_squire','char_s02_mogu','char_common_b_moss_golem',
  'char_common_b_coffin_merchant','char_common_a_glass_keeper','char_common_b_ink_raven','char_common_a_meteor_cart',
  'char_s02_zirka','char_s02_gormu','char_s02_gardo','char_s02_kreik','char_s03_nana04','char_s03_k17',
  'char_common_a_bonedrum','char_common_a_mirror_guide','char_s03_blade_hound','char_s03_rxomega',
];
const TARGETS=new Map(WATCH_ROOTS.map((id,index)=>[id,index]));
function assert(ok,msg){if(!ok)throw new Error(`[recruitment-priority-03] ${msg}`);}
assert(metadata.formCount===99&&metadata.humanReview==='PENDING'&&metadata.normalRuntimeAuthoritative===false,'recruitment form boundary drift');
function assemble(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function phase(i,n){return i/Math.max(1,n-1);}
function palette(index){const families=[
  {d:[35,38,49,255],m:[90,105,132,255],a:[221,142,78,255],g:[116,208,229,255],l:[218,226,236,255]},
  {d:[44,37,35,255],m:[119,88,72,255],a:[196,88,73,255],g:[230,185,101,255],l:[217,199,164,255]},
  {d:[34,48,42,255],m:[77,116,91,255],a:[166,112,74,255],g:[132,218,155,255],l:[204,221,192,255]},
  {d:[47,39,57,255],m:[111,83,134,255],a:[194,105,165,255],g:[119,207,228,255],l:[219,207,235,255]},
];return families[index%families.length];}
function drawSignature(out,w,h,meta,motion,i,n,index){
  const order=meta.formOrder;if(order===1)return;
  const p=palette(index),t=phase(i,n),pulse=motion==='attack'?Math.sin(t*Math.PI):0,bob=motion==='move'?(i%2?-3:3):0;
  const cx=Math.round(w*(.46+((index%3)-1)*.015)),cy=Math.round(h*.50)+bob;
  const sx=8+(index%5)*3,sy=10+(index%4)*4,mode=index%6;
  const clampX=(x)=>Math.max(8,Math.min(w-8,Math.round(x)));
  const clampY=(y)=>Math.max(8,Math.min(h-8,Math.round(y)));
  if(order===2){
    const left=cx-Math.round(w*(.20+(index%4)*.018));
    const top=cy-Math.round(h*(.20+(index%3)*.025));
    if(mode===0||mode===3){triangle(out,w,h,[left,cy-8],[clampX(left-sx*2.4),clampY(top-sy)],[left+sx,cy+22],p.l,.94);line(out,w,h,left+4,cy-2,cx-26,cy+10,p.d,6,.95);}
    else if(mode===1||mode===4){rect(out,w,h,left-sx,top-sy,left+sx,cy+28,p.d,.95);triangle(out,w,h,[left-sx,top],[left,clampY(top-sy*2.2)],[left+sx,top],p.g,.88);}
    else{ellipse(out,w,h,left,top+sy,22+sx,14+sy,p.m,.95);triangle(out,w,h,[left-18,top+7],[left,clampY(top-sy*1.7)],[left+18,top+7],p.a,.9);}
    if(motion==='attack')line(out,w,h,cx+18,cy-8,clampX(cx+w*(.20+.05*pulse)),clampY(cy-24-sy*pulse),p.a,7+index%4,.94);
  }else if(order===3){
    const right=cx+Math.round(w*(.16+(index%4)*.015));
    const crestY=cy-Math.round(h*(.24+(index%3)*.02));
    if(mode===0||mode===4){line(out,w,h,right,cy-8,clampX(right+w*.19),clampY(cy-28),p.d,9+index%5,.96);triangle(out,w,h,[clampX(right+w*.17),cy-36],[clampX(right+w*.25),cy-25],[clampX(right+w*.17),cy-14],p.a,.94);}
    else if(mode===1||mode===5){triangle(out,w,h,[right-10,cy+10],[clampX(right+w*.18),clampY(cy+h*.15)],[right+12,cy-30],p.l,.93);ellipse(out,w,h,right+8,crestY,18+sx,13+sy,p.g,.74);}
    else{rect(out,w,h,right-8,crestY,right+18,cy+36,p.m,.95);triangle(out,w,h,[right-15,crestY+5],[right+5,clampY(crestY-h*.14)],[right+23,crestY+5],p.l,.92);line(out,w,h,right+16,cy,clampX(right+w*.18),clampY(cy+18),p.a,8,.94);}
    triangle(out,w,h,[cx-24,crestY+12],[cx,clampY(crestY-h*(.10+(index%3)*.018))],[cx+24,crestY+12],p.g,.86);
    if(motion==='attack'){
      const reach=clampX(cx+w*(.30+.08*pulse));
      line(out,w,h,cx+18,cy-4,reach,clampY(cy-22-18*pulse),p.l,8+index%5,.96);
      triangle(out,w,h,[reach-5,clampY(cy-34-18*pulse)],[clampX(reach+18),clampY(cy-21-18*pulse)],[reach-5,clampY(cy-8-18*pulse)],p.a,.95);
    }
  }
}

let touched=0;
for(const [formId,meta] of Object.entries(metadata.targets)){
  const index=TARGETS.get(meta.unitId);if(index===undefined)continue;touched+=1;
  for(const motion of MOTIONS){
    const mm=meta.motions[motion],path=resolve(unitsRoot,meta.unitId,formId,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${formId}/${motion}`);
    assert(png.width===meta.frameWidth*mm.frames&&png.height===meta.frameHeight,`${formId}/${motion} dimensions drift`);
    const frames=[];for(let i=0;i<mm.frames;i++){const frame=sourceFrame(png,meta.frameWidth,meta.frameHeight,i);drawSignature(frame,meta.frameWidth,meta.frameHeight,meta,motion,i,mm.frames,index);frames.push(frame);}
    const encoded=encodePng(meta.frameWidth*mm.frames,meta.frameHeight,assemble(frames,meta.frameWidth,meta.frameHeight));await writeFile(path,encoded);mm.bytes=encoded.length;mm.sha256=sha256(encoded);
  }
  meta.visualPolishPriority03={version:1,kind:'WATCH_EVOLUTION_SEPARATION_AND_ATTACK_READABILITY',reviewStatus:'UNREVIEWED_RUNTIME_FILES'};
}
assert(touched===WATCH_ROOTS.length*3,`expected ${WATCH_ROOTS.length*3} touched forms, got ${touched}`);
metadata.visualPolishPriority03={version:1,targetRoots:WATCH_ROOTS.length,touchedForms:touched,humanReview:'PENDING',normalRuntimeAuthoritative:false};
await writeFile(metadataPath,`${JSON.stringify(metadata,null,2)}\n`);
console.log(`[recruitment-priority-03] polished ${touched} forms across ${WATCH_ROOTS.length} WATCH recruitment roots`);
