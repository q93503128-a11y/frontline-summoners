import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ellipse, encodePng, line, rect, sha256, triangle } from './lib/production-png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/production/units');
const contractPath = resolve(root, 'assets/raw/production/chapter-02-production-01.json');
const BATCH = 'chapter-02-production-01';
const GENERATOR_VERSION = 1;
const MOTIONS = ['idle', 'move', 'attack', 'knockback', 'death'];

const TARGETS = {
  enemy_ch2_mossboar: { family:'project-authored-nature-beast', kind:'mossboar', w:230, h:170, displayHeight:176, contact:2, frames:[6,8,6,4,6] },
  enemy_ch2_umbrella: { family:'project-authored-nature-fungus', kind:'umbrella', w:190, h:180, displayHeight:164, contact:3, frames:[6,8,7,4,6] },
  enemy_ch2_vinerider: { family:'project-authored-nature-vine', kind:'vinerider', w:250, h:190, displayHeight:190, contact:3, frames:[6,8,7,4,6] },
  enemy_ch2_seedbattery: { family:'project-authored-nature-structure', kind:'seedbattery', w:250, h:200, displayHeight:188, contact:4, frames:[6,8,8,4,7] },
  enemy_ch2_bonewheel: { family:'project-authored-undead-wheel', kind:'bonewheel', w:180, h:160, displayHeight:152, contact:1, frames:[6,8,5,4,6] },
  enemy_ch2_coffinbug: { family:'project-authored-undead-insect', kind:'coffinbug', w:230, h:180, displayHeight:194, contact:2, frames:[6,8,6,4,7] },
  enemy_ch2_gravebell: { family:'project-authored-undead-bell', kind:'gravebell', w:230, h:220, displayHeight:204, contact:4, frames:[6,8,8,4,7] },
  enemy_ch2_revivedarmor: { family:'project-authored-undead-armor', kind:'revivedarmor', w:230, h:220, displayHeight:210, contact:2, frames:[6,8,6,4,8] },
  boss_ch2_rootwidow: { family:'project-authored-nature-boss', kind:'rootwidow', w:320, h:280, displayHeight:268, contact:4, frames:[8,8,8,4,8] },
  boss_ch2_funeral_king: { family:'project-authored-undead-boss', kind:'funeralking', w:330, h:290, displayHeight:276, contact:5, frames:[8,8,8,4,8] },
};

const contract = JSON.parse(await readFile(contractPath, 'utf8'));
if (contract.status !== 'AWAITING_ART' || contract.reviewStatus !== 'PENDING' || contract.normalRuntimeAuthoritative !== false) {
  throw new Error('chapter-two production lifecycle drifted before human review');
}
if (contract.generativeAiUsed !== false || contract.sourcePolicy !== 'PROJECT_AUTHORED_DETERMINISTIC_ONLY') {
  throw new Error('chapter-two source policy drifted');
}

function assembleHorizontal(frames, w, h) {
  const out = Buffer.alloc(w * frames.length * h * 4);
  for (let fi = 0; fi < frames.length; fi++) {
    for (let y = 0; y < h; y++) {
      const srcStart = y * w * 4;
      const dstStart = (y * w * frames.length + fi * w) * 4;
      frames[fi].copy(out, dstStart, srcStart, srcStart + w * 4);
    }
  }
  return out;
}

function p(index, count) { return index / Math.max(1, count - 1); }
function bob(motion, index) { return motion === 'move' ? (index % 2 ? -2 : 1) : motion === 'idle' ? (index % 3 === 1 ? -1 : 0) : 0; }

function drawMossBoar(out, s, motion, index, count) {
  const t = p(index, count), dx = motion === 'attack' && index === s.contact ? 12 : motion === 'knockback' ? -Math.round(t * 14) : 0, dy = bob(motion, index) + (motion === 'death' ? Math.round(t * 25) : 0);
  const bark=[83,69,48,255], moss=[76,111,67,255], fur=[93,77,60,255], dark=[49,45,39,255], tusk=[222,213,184,255];
  const cx=111+dx, cy=102+dy;
  ellipse(out,s.w,s.h,cx,cy,48,27,fur,.98); ellipse(out,s.w,s.h,cx+42,cy-10,24,20,fur,.98);
  line(out,s.w,s.h,cx-26,cy+19,cx-34,cy+50,dark,7,.95); line(out,s.w,s.h,cx+20,cy+18,cx+30,cy+49,dark,7,.95);
  triangle(out,s.w,s.h,[cx+57,cy-7],[cx+74,cy-1],[cx+59,cy+5],tusk,.95);
  rect(out,s.w,s.h,cx-20,cy-46,cx-10,cy-18,bark,.95); line(out,s.w,s.h,cx-15,cy-43,cx-36,cy-63,bark,5,.95); line(out,s.w,s.h,cx-15,cy-40,cx+7,cy-66,bark,5,.95);
  ellipse(out,s.w,s.h,cx-38,cy-66,19,12,moss,.92); ellipse(out,s.w,s.h,cx+5,cy-68,20,13,moss,.92); ellipse(out,s.w,s.h,cx-5,cy-57,24,12,moss,.9);
  if(motion==='attack'&&index>=s.contact-1) line(out,s.w,s.h,cx+50,cy+12,cx+86,cy+15,[126,101,70,255],4,.5);
  if(motion==='death'&&index>=4) line(out,s.w,s.h,cx-42,cy+27,cx+45,cy+30,dark,4,.55);
}

function drawUmbrella(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='knockback'?-Math.round(t*11):0, dy=bob(motion,index)+(motion==='death'?Math.round(t*27):0);
  const cap=[117,78,100,255], edge=[69,54,67,255], stem=[163,145,113,255], spore=[190,173,128,255];
  const cx=95+dx, cy=83+dy, pulse=motion==='attack'?Math.max(0,1-Math.abs(index-s.contact)/Math.max(1,s.contact)):0;
  ellipse(out,s.w,s.h,cx,cy,55+Math.round(pulse*8),27+Math.round(pulse*4),cap,.97); line(out,s.w,s.h,cx-49,cy+6,cx+49,cy+6,edge,4,.85);
  rect(out,s.w,s.h,cx-9,cy+12,cx+9,cy+54,stem,.92);
  for(let i=0;i<6;i++){const x=cx-31+i*12+(i%2?2:-2);line(out,s.w,s.h,x,cy+48,x+(i%2?5:-5),cy+75,edge,4,.92);}
  if(motion==='attack'&&index>=s.contact-1){for(let i=0;i<8;i++){const a=Math.PI*2*i/8;ellipse(out,s.w,s.h,cx+Math.cos(a)*(47+12*pulse),cy+20+Math.sin(a)*(24+8*pulse),4,3,spore,.35+.35*pulse);}}
  if(motion==='death'&&index>=3) line(out,s.w,s.h,cx-52,cy+24,cx+48,cy+42,edge,5,.6);
}

function drawVineRider(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='attack'&&index===s.contact?8:motion==='knockback'?-Math.round(t*13):0, dy=bob(motion,index)+(motion==='death'?Math.round(t*24):0);
  const vine=[61,106,62,255], leaf=[91,137,78,255], dark=[44,69,46,255], bud=[150,124,88,255];
  const cx=111+dx, cy=116+dy;
  ellipse(out,s.w,s.h,cx,cy,45,20,vine,.7); line(out,s.w,s.h,cx-33,cy+12,cx-45,cy+48,dark,6,.9); line(out,s.w,s.h,cx+20,cy+12,cx+34,cy+47,dark,6,.9);
  line(out,s.w,s.h,cx-8,cy-8,cx-4,cy-63,vine,8,.95); ellipse(out,s.w,s.h,cx-4,cy-69,13,16,leaf,.9);
  const reach=motion==='attack'?(index===s.contact?107:72):68; line(out,s.w,s.h,cx+2,cy-47,cx+reach,cy-35,dark,5,.95); triangle(out,s.w,s.h,[cx+reach,cy-35],[cx+reach-13,cy-42],[cx+reach-10,cy-29],bud,.9);
  line(out,s.w,s.h,cx-4,cy-39,cx-39,cy-20,vine,4,.8); line(out,s.w,s.h,cx-4,cy-48,cx+31,cy-71,vine,4,.8);
  for(let i=0;i<4;i++) ellipse(out,s.w,s.h,cx-28+i*19,cy-5-(i%2)*10,7,4,leaf,.85);
  if(motion==='attack'&&index===s.contact) line(out,s.w,s.h,cx+70,cy-31,cx+119,cy-26,leaf,3,.65);
}

function drawSeedBattery(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='knockback'?-Math.round(t*9):0, dy=bob(motion,index)+(motion==='death'?Math.round(t*23):0);
  const husk=[125,94,57,255], seam=[67,62,46,255], root=[72,82,49,255], seed=[184,153,79,255];
  const cx=114+dx, cy=103+dy, open=motion==='attack'?Math.min(1,index/Math.max(1,s.contact)):0;
  ellipse(out,s.w,s.h,cx,cy,45,50,husk,.98); line(out,s.w,s.h,cx,cy-43,cx+8+open*22,cy-72-open*8,seam,6,.95); line(out,s.w,s.h,cx,cy-43,cx-11-open*16,cy-71-open*7,seam,6,.95);
  for(let i=0;i<6;i++){const x=cx-34+i*13;line(out,s.w,s.h,x,cy+39,x+(i%2?10:-10),cy+72,root,5,.9);}
  rect(out,s.w,s.h,cx-11,cy-19,cx+15,cy+20,seam,.28);
  if(motion==='attack'&&index>=s.contact-1){const q=Math.max(0,index-s.contact+1);for(let i=0;i<3;i++) ellipse(out,s.w,s.h,cx+54+q*12+i*18,cy-25+i*8,6,4,seed,.85);}
  if(motion==='death'&&index>=4) line(out,s.w,s.h,cx-43,cy+18,cx+44,cy+31,seam,6,.55);
}

function drawBoneWheel(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='attack'&&index===s.contact?12:motion==='knockback'?-Math.round(t*18):0, dy=bob(motion,index)+(motion==='death'?Math.round(t*30):0);
  const bone=[210,201,172,255], dark=[73,68,61,255], eye=[113,80,72,255];
  const cx=88+dx, cy=82+dy, spin=(motion==='move'?index*.75:index*.16)+(motion==='attack'?index*.35:0);
  ellipse(out,s.w,s.h,cx,cy,49,49,dark,.45); ellipse(out,s.w,s.h,cx,cy,33,33,[0,0,0,0],0);
  for(let i=0;i<7;i++){const a=spin+Math.PI*2*i/7,x=cx+Math.cos(a)*39,y=cy+Math.sin(a)*39;ellipse(out,s.w,s.h,x,y,13,11,bone,.98);ellipse(out,s.w,s.h,x-4,y-1,2,2,eye,.9);ellipse(out,s.w,s.h,x+4,y-1,2,2,eye,.9);line(out,s.w,s.h,x-7,y+6,x+7,y+6,dark,2,.75);}
  for(let i=0;i<7;i++){const a=spin+Math.PI*2*i/7;line(out,s.w,s.h,cx+Math.cos(a)*16,cy+Math.sin(a)*16,cx+Math.cos(a)*31,cy+Math.sin(a)*31,bone,4,.85);}
  if(motion==='attack'&&index===s.contact) line(out,s.w,s.h,cx+46,cy,cx+76,cy,dark,5,.45);
}

function drawCoffinBug(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='attack'&&index===s.contact?7:motion==='knockback'?-Math.round(t*9):0, dy=bob(motion,index)+(motion==='death'?Math.round(t*25):0);
  const wood=[92,68,53,255], edge=[50,47,43,255], metal=[132,126,109,255], leg=[62,57,52,255];
  const cx=113+dx, cy=88+dy;
  rect(out,s.w,s.h,cx-38,cy-48,cx+38,cy+46,wood,.97); triangle(out,s.w,s.h,[cx-38,cy-48],[cx,cy-72],[cx+38,cy-48],wood,.97); line(out,s.w,s.h,cx-28,cy-32,cx+28,cy+26,edge,3,.55); line(out,s.w,s.h,cx+28,cy-32,cx-28,cy+26,edge,3,.55); rect(out,s.w,s.h,cx-6,cy-8,cx+6,cy+7,metal,.8);
  const crouch=motion==='attack'&&index<=s.contact?7:0;
  for(let i=0;i<4;i++){const y=cy-18+i*22;line(out,s.w,s.h,cx-38,y,cx-70-(i%2)*8,y+18+crouch,leg,5,.92);line(out,s.w,s.h,cx+38,y,cx+70+(i%2)*8,y+18+crouch,leg,5,.92);}
  if(motion==='death'&&index>=4){line(out,s.w,s.h,cx-45,cy+45,cx+52,cy+53,edge,6,.6);}
}

function drawGraveBell(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='knockback'?-Math.round(t*10):0, dy=bob(motion,index)+(motion==='death'?Math.round(t*28):0);
  const bone=[195,187,163,255], bell=[91,88,82,255], edge=[52,52,50,255], rope=[119,92,63,255];
  const cx=112+dx, cy=100+dy, swing=motion==='attack'?Math.sin(Math.min(1,index/Math.max(1,s.contact))*Math.PI)*28:0;
  triangle(out,s.w,s.h,[cx-32,cy-58],[cx+32,cy-58],[cx+43,cy-20],bell,.97); ellipse(out,s.w,s.h,cx,cy-18,43,10,edge,.88); line(out,s.w,s.h,cx,cy-55,cx,cy-6,rope,4,.9); ellipse(out,s.w,s.h,cx,cy-3,8,10,bell,.95);
  line(out,s.w,s.h,cx,cy+3,cx,cy+54,bone,8,.92); line(out,s.w,s.h,cx-4,cy+19,cx-46-swing,cy+52,bone,6,.9); line(out,s.w,s.h,cx+4,cy+19,cx+45+swing,cy+52,bone,6,.9); ellipse(out,s.w,s.h,cx-48-swing,cy+54,9,12,bell,.9); ellipse(out,s.w,s.h,cx+47+swing,cy+54,9,12,bell,.9);
  line(out,s.w,s.h,cx,cy+50,cx-22,cy+91,bone,6,.9);line(out,s.w,s.h,cx,cy+50,cx+22,cy+91,bone,6,.9);
  if(motion==='attack'&&index===s.contact){ellipse(out,s.w,s.h,cx,cy+34,77,31,bell,.12);ellipse(out,s.w,s.h,cx,cy+34,96,39,bell,.08);}
}

function drawRevivedArmor(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='attack'&&index===s.contact?7:motion==='knockback'?-Math.round(t*13):0, dy=bob(motion,index);
  const steel=[132,137,138,255], dark=[37,39,43,255], bind=[38,31,43,255], edge=[188,184,165,255];
  const scatter=motion==='death'?Math.round(t*34):0, cx=112+dx, cy=95+dy;
  ellipse(out,s.w,s.h,cx,cy-49-scatter*.3,22,16,steel,.95); rect(out,s.w,s.h,cx-30-scatter*.2,cy-28,cx+30+scatter*.2,cy+25,steel,.92); rect(out,s.w,s.h,cx-23,cy-18,cx+23,cy+16,dark,.46);
  const arm=motion==='attack'&&index===s.contact?18:0; rect(out,s.w,s.h,cx-55-scatter,cy-20,cx-36-scatter,cy+28,steel,.9); rect(out,s.w,s.h,cx+36+scatter,cy-20-arm*.3,cx+55+scatter+arm,cy+28-arm*.2,steel,.9);
  rect(out,s.w,s.h,cx-29-scatter*.4,cy+34,cx-10-scatter*.4,cy+87+scatter*.2,steel,.9); rect(out,s.w,s.h,cx+10+scatter*.4,cy+34,cx+29+scatter*.4,cy+87+scatter*.2,steel,.9);
  line(out,s.w,s.h,cx-40-scatter,cy-4,cx-18,cy+3,bind,4,.85);line(out,s.w,s.h,cx+18,cy+3,cx+43+scatter,cy-4,bind,4,.85);line(out,s.w,s.h,cx-13,cy+25,cx-19-scatter*.4,cy+40,bind,4,.85);line(out,s.w,s.h,cx+13,cy+25,cx+19+scatter*.4,cy+40,bind,4,.85);line(out,s.w,s.h,cx-13,cy-48-scatter*.3,cx+10,cy-48-scatter*.3,edge,2,.5);
}

function drawRootWidow(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='knockback'?-Math.round(t*11):0, dy=bob(motion,index)+(motion==='death'?Math.round(t*30):0);
  const trunk=[93,68,48,255], bark=[55,48,39,255], leaf=[74,105,61,255], hollow=[24,25,22,255], root=[77,61,46,255];
  const cx=157+dx, cy=124+dy, attackT=motion==='attack'?index/Math.max(1,count-1):0;
  rect(out,s.w,s.h,cx-42,cy-75,cx+42,cy+40,trunk,.97); ellipse(out,s.w,s.h,cx,cy-42,24,31,hollow,.96); ellipse(out,s.w,s.h,cx,cy-45,13,19,[5,8,6,255],.95);
  line(out,s.w,s.h,cx-32,cy-54,cx-77,cy-93,bark,10,.94);line(out,s.w,s.h,cx+31,cy-57,cx+83,cy-96,bark,10,.94);ellipse(out,s.w,s.h,cx-81,cy-101,34,18,leaf,.84);ellipse(out,s.w,s.h,cx+80,cy-102,37,20,leaf,.84);
  for(let i=0;i<8;i++){const a=(i-3.5)*.27, swing=motion==='move'?(index%2?7:-5):0;line(out,s.w,s.h,cx+(i-3.5)*9,cy+32,cx+Math.sin(a)*65+swing,cy+100+Math.abs(i-3.5)*5,root,10,.94);}
  if(motion==='attack'){
    if(index<=s.contact){const sweep=20+attackT*85;line(out,s.w,s.h,cx-35,cy+24,cx+sweep,cy+67,root,12,.95);}
    if(index>=s.contact){const reach=90+(index-s.contact)*30;line(out,s.w,s.h,cx+24,cy+18,cx+reach,cy+8,root,9,.96);triangle(out,s.w,s.h,[cx+reach,cy+8],[cx+reach-18,cy-3],[cx+reach-18,cy+19],bark,.9);}
  }
}

function drawFuneralKing(out, s, motion, index, count) {
  const t=p(index,count), dx=motion==='knockback'?-Math.round(t*9):0, dy=bob(motion,index)+(motion==='death'?Math.round(t*31):0);
  const bell=[82,85,82,255], edge=[45,47,47,255], coffin=[82,60,50,255], bone=[179,171,151,255], crack=[150,132,104,255];
  const cx=164+dx, cy=116+dy, toll=motion==='attack'?Math.sin(Math.min(1,index/Math.max(1,s.contact))*Math.PI):0;
  triangle(out,s.w,s.h,[cx-61,cy-76],[cx+61,cy-76],[cx+78,cy+9],bell,.98);ellipse(out,s.w,s.h,cx,cy+4,79,16,edge,.9);line(out,s.w,s.h,cx-18,cy-67,cx+4,cy-26,crack,4,.85);line(out,s.w,s.h,cx+4,cy-26,cx-10,cy-3,crack,3,.85);
  line(out,s.w,s.h,cx,cy-66,cx,cy+28,bone,5,.75);ellipse(out,s.w,s.h,cx,cy+31,12,15,bell,.9);
  for(let i=0;i<4;i++){const x=cx-66+i*44;rect(out,s.w,s.h,x-16,cy+26,x+16,cy+102,coffin,.95);triangle(out,s.w,s.h,[x-16,cy+26],[x,cy+10],[x+16,cy+26],coffin,.95);}
  const armReach=motion==='attack'?Math.round(toll*52):0;line(out,s.w,s.h,cx-46,cy-4,cx-91-armReach,cy+42,bone,8,.9);line(out,s.w,s.h,cx+46,cy-4,cx+90+armReach,cy+42,bone,8,.9);
  if(motion==='attack'&&index===s.contact){ellipse(out,s.w,s.h,cx,cy+20,112,47,bell,.14);ellipse(out,s.w,s.h,cx,cy+20,139,58,bell,.08);}
  if(motion==='death'&&index>=5) line(out,s.w,s.h,cx-82,cy+43,cx+84,cy+72,edge,8,.5);
}

const DRAW = { mossboar:drawMossBoar, umbrella:drawUmbrella, vinerider:drawVineRider, seedbattery:drawSeedBattery, bonewheel:drawBoneWheel, coffinbug:drawCoffinBug, gravebell:drawGraveBell, revivedarmor:drawRevivedArmor, rootwidow:drawRootWidow, funeralking:drawFuneralKing };
const metadata = { schemaVersion:1, batchId:BATCH, generatorVersion:GENERATOR_VERSION, status:'UNREVIEWED_RUNTIME_FILES', humanReview:'PENDING', reviewer:null, reviewedAt:null, generativeAiUsed:false, normalRuntimeAuthoritative:false, targets:{} };

for (const [unitId, spec] of Object.entries(TARGETS)) {
  const targetDir = resolve(outputRoot, unitId);
  await rm(targetDir, { recursive:true, force:true });
  await mkdir(targetDir, { recursive:true });
  const targetMeta = { assetId:`unit:${unitId}`, sourceFamily:spec.family, structuralRework:false, projectAuthoredDeterministic:true, reviewStatus:'UNREVIEWED_RUNTIME_FILES', frameWidth:spec.w, frameHeight:spec.h, displayHeight:spec.displayHeight, attackContactFrame:spec.contact, motions:{} };
  for (let mi=0; mi<MOTIONS.length; mi++) {
    const motion=MOTIONS[mi], count=spec.frames[mi], frames=[];
    for (let index=0; index<count; index++) {
      const out=Buffer.alloc(spec.w*spec.h*4);
      DRAW[spec.kind](out,spec,motion,index,count);
      frames.push(out);
    }
    const rgba=assembleHorizontal(frames,spec.w,spec.h);
    const png=encodePng(spec.w*count,spec.h,rgba);
    const file=resolve(targetDir,`${motion}.png`);
    await writeFile(file,png);
    targetMeta.motions[motion]={frames:count,bytes:png.length,sha256:sha256(png)};
  }
  metadata.targets[unitId]=targetMeta;
}

await writeFile(resolve(outputRoot,'chapter-02-runtime-metadata.json'), JSON.stringify(metadata,null,2)+'\n');
console.log(`[chapter-02] materialized ${Object.keys(TARGETS).length} targets / ${Object.keys(TARGETS).length*5} motion strips`);
