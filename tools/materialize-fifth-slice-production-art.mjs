import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blitSource,
  ellipse,
  encodePng,
  fetchPinnedPng,
  line,
  rect,
  sha256,
  sourceFrame,
  triangle,
} from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputRoot=resolve(root,'apps/client/public/assets/production/units');
const contractPath=resolve(root,'assets/raw/production/fifth-slice-late-wave-05.json');
const SLICE='fifth-slice-late-wave-05';
const GENERATOR_VERSION=1;
const NQM='https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';
const MOTIONS=['idle','move','attack','knockback','death'];

const SOURCES={
  'evil-wizard-2':{frameWidth:250,frameHeight:250,frames:{idle:8,move:8,attack:8,knockback:3,death:7},urls:{
    idle:`${NQM}/EVil%20Wizard%202/Sprites/Idle.png`,move:`${NQM}/EVil%20Wizard%202/Sprites/Run.png`,attack:`${NQM}/EVil%20Wizard%202/Sprites/Attack1.png`,knockback:`${NQM}/EVil%20Wizard%202/Sprites/Take%20hit.png`,death:`${NQM}/EVil%20Wizard%202/Sprites/Death.png`}},
  'evil-wizard':{frameWidth:150,frameHeight:150,frames:{idle:8,move:8,attack:8,knockback:4,death:5},urls:{
    idle:`${NQM}/Evil%20Wizard/Sprites/Idle.png`,move:`${NQM}/Evil%20Wizard/Sprites/Move.png`,attack:`${NQM}/Evil%20Wizard/Sprites/Attack.png`,knockback:`${NQM}/Evil%20Wizard/Sprites/Take%20Hit.png`,death:`${NQM}/Evil%20Wizard/Sprites/Death.png`}},
};

const TARGETS={
  'heretic/heretic_f1':{assetId:'unit:heretic:heretic_f1',sourceFamily:'evil-wizard-2',kind:'heretic',form:1,displayHeight:198,attackContactFrame:5,outW:310,outH:260,dx:30,dy:5,palette:[78,72,78],frames:[8,8,8,3,7]},
  'heretic/heretic_f2':{assetId:'unit:heretic:heretic_f2',sourceFamily:'evil-wizard-2',kind:'heretic',form:2,displayHeight:206,attackContactFrame:5,outW:330,outH:270,dx:40,dy:8,palette:[70,65,72],frames:[8,8,8,3,7]},
  'heretic/heretic_f3':{assetId:'unit:heretic:heretic_f3',sourceFamily:'evil-wizard-2',kind:'heretic',form:3,displayHeight:194,attackContactFrame:5,outW:290,outH:245,dx:20,dy:0,palette:[85,77,78],frames:[8,8,8,3,7]},
  'enemy-cultist':{assetId:'unit:enemy-cultist',sourceFamily:'evil-wizard',kind:'cultist',form:1,displayHeight:188,attackContactFrame:4,outW:260,outH:200,dx:48,dy:18,palette:[66,60,61],frames:[8,8,8,4,5]},
  'enemy-sprinter':{assetId:'unit:enemy-sprinter',sourceFamily:'project-authored-beast',kind:'sprinter',form:1,displayHeight:140,attackContactFrame:2,outW:210,outH:130,dx:0,dy:0,palette:[91,72,59],frames:[6,8,6,4,6]},
};

const contract=JSON.parse(await readFile(contractPath,'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)throw new Error('fifth-slice lifecycle drifted before human review');

const sourceSheets=new Map();
for(const [familyId,source] of Object.entries(SOURCES)){
  const motions={};
  for(const motion of MOTIONS){
    const count=source.frames[motion];
    motions[motion]=(await fetchPinnedPng(source.urls[motion],source.frameWidth*count,source.frameHeight,`${familyId}/${motion}`)).png;
  }
  sourceSheets.set(familyId,motions);
}

function assembleHorizontal(frames,w,h){
  const out=Buffer.alloc(w*frames.length*h*4);
  for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){
    const srcStart=y*w*4,srcEnd=srcStart+w*4,dstStart=(y*w*frames.length+fi*w)*4;
    frames[fi].copy(out,dstStart,srcStart,srcEnd);
  }
  return out;
}

function motionShift(spec,motion,index,count){
  const p=index/Math.max(1,count-1);
  if(spec.kind==='heretic'){
    if(motion==='move')return spec.form===3?{x:index%2?2:-1,y:index%2?1:0}:{x:Math.round(p*2),y:index%2?0:-1};
    if(motion==='attack')return{x:spec.form===3&&index===spec.attackContactFrame?7:0,y:index<spec.attackContactFrame?0:1};
    if(motion==='knockback')return{x:-Math.round(p*6),y:Math.round(p*2)};
    if(motion==='death')return{x:0,y:Math.round(p*15)};
  }
  if(spec.kind==='cultist'){
    if(motion==='move')return{x:0,y:index%2?1:0};
    if(motion==='attack')return{x:index===spec.attackContactFrame?2:0,y:0};
    if(motion==='knockback')return{x:-Math.round(p*7),y:Math.round(p*2)};
    if(motion==='death')return{x:0,y:Math.round(p*14)};
  }
  return{x:0,y:0};
}

function ritualRing(out,w,h,cx,cy,rx,ry,color,alpha){
  const pts=[];for(let i=0;i<8;i++){const a=Math.PI*2*i/8;pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}
  for(let i=0;i<8;i++)line(out,w,h,pts[i][0],pts[i][1],pts[(i+1)%8][0],pts[(i+1)%8][1],color,3,alpha);
  line(out,w,h,cx-rx*.72,cy-ry*.55,cx+rx*.55,cy+ry*.72,color,2,alpha*.75);
  line(out,w,h,cx+rx*.66,cy-ry*.62,cx-rx*.48,cy+ry*.68,color,2,alpha*.75);
}

function drawHereticBehind(out,spec,motion,index,count){
  const ink=[83,69,72,255],pale=[185,170,147,255];
  if(spec.form===2){const pulse=motion==='attack'?Math.min(1,.45+index/Math.max(1,spec.attackContactFrame)*.55):.48;ritualRing(out,spec.outW,spec.outH,138,120,62+8*pulse,58+7*pulse,ink,.52+.22*pulse);}
  if(motion==='attack'){
    const t=Math.max(0,1-Math.abs(index-spec.attackContactFrame)/Math.max(2,spec.attackContactFrame));
    const gx=spec.form===3?spec.outW-48:spec.outW-62,gy=108;
    ritualRing(out,spec.outW,spec.outH,gx,gy,13+18*t,10+13*t,pale,.25+.5*t);
  }
}

function drawHereticFront(out,spec,motion,index,count){
  const mask=[207,196,174,255],ink=[55,50,52,255],paper=[184,156,118,255],seal=[121,64,57,255],metal=[118,112,106,255];
  const p=index/Math.max(1,count-1),cx=spec.form===2?165:145;
  ellipse(out,spec.outW,spec.outH,cx-5,62,13,16,mask,.72);rect(out,spec.outW,spec.outH,cx-17,49,cx-6,74,ink,.88);
  const drop=motion==='death'?Math.round(p*42):0,scatter=motion==='knockback'?Math.round(p*12):0;
  const talismanCount=spec.form===1?2:spec.form===2?4:2;
  for(let i=0;i<talismanCount;i++){
    const x=cx-37-i*7-scatter*(i%2?1:-1),y=92+i*13+drop;
    rect(out,spec.outW,spec.outH,x,y,x+7,y+24,paper,.85);line(out,spec.outW,spec.outH,x+2,y+7,x+5,y+17,seal,1,.8);
  }
  if(spec.form<3){const endX=spec.outW-47,endY=spec.form===2?48:60;line(out,spec.outW,spec.outH,cx+17,111,endX,endY,metal,spec.form===2?5:4,.95);triangle(out,spec.outW,spec.outH,[endX,endY],[endX-9,endY+17],[endX+7,endY+13],ink,.88);}
  else{
    line(out,spec.outW,spec.outH,cx+10,105,cx+66,75,metal,4,.95);line(out,spec.outW,spec.outH,cx-3,108,cx+49,139,metal,4,.95);
    triangle(out,spec.outW,spec.outH,[cx+66,75],[cx+54,77],[cx+60,87],ink,.9);triangle(out,spec.outW,spec.outH,[cx+49,139],[cx+38,132],[cx+39,145],ink,.9);
  }
  if(motion==='death'&&index>=Math.floor(count/2))line(out,spec.outW,spec.outH,cx-55,154+drop,cx-20,160+drop,ink,2,.5);
}

function drawCultist(out,spec,motion,index,count){
  const pole=[84,66,55,255],flag=[39,38,42,255],edge=[133,105,82,255],ritual=[154,129,104,255];
  const p=index/Math.max(1,count-1),drop=motion==='death'?Math.round(p*35):0;
  line(out,spec.outW,spec.outH,105,55+drop,105,168+drop,pole,5,.95);
  triangle(out,spec.outW,spec.outH,[107,58+drop],[181,74+drop],[107,101+drop],flag,.96);
  line(out,spec.outW,spec.outH,112,65+drop,171,76+drop,edge,2,.65);
  if(motion==='attack'){
    const t=Math.max(0,1-Math.abs(index-spec.attackContactFrame)/Math.max(2,spec.attackContactFrame));
    ritualRing(out,spec.outW,spec.outH,214,133,12+29*t,7+13*t,ritual,.25+.55*t);
    if(index===spec.attackContactFrame)line(out,spec.outW,spec.outH,184,133,242,133,ritual,3,.72);
  }
}

function drawSprinter(out,spec,motion,index,count){
  const p=index/Math.max(1,count-1),fur=[104,76,58,255],dark=[56,49,44,255],belly=[141,111,82,255],eye=[216,178,93,255],tooth=[219,207,179,255];
  let ox=0,oy=0;
  if(motion==='idle')oy=index%3===1?-1:0;
  if(motion==='move'){ox=index%2?3:-2;oy=index%2?-2:1;}
  if(motion==='attack'){ox=index<spec.attackContactFrame?-2+index*2:index===spec.attackContactFrame?11:5;oy=index===spec.attackContactFrame?-1:1;}
  if(motion==='knockback'){ox=-Math.round(p*15);oy=Math.round(p*3);}
  if(motion==='death'){ox=-Math.round(p*4);oy=Math.round(p*25);}
  const cx=104+ox,cy=75+oy;
  ellipse(out,spec.outW,spec.outH,cx,cy,43,24,fur,.98);ellipse(out,spec.outW,spec.outH,cx-5,cy+9,31,13,belly,.42);
  ellipse(out,spec.outW,spec.outH,cx+42,cy-10,22,18,fur,.98);triangle(out,spec.outW,spec.outH,[cx+30,cy-24],[cx+37,cy-43],[cx+47,cy-22],dark,.95);triangle(out,spec.outW,spec.outH,[cx+43,cy-25],[cx+55,cy-41],[cx+60,cy-17],dark,.92);
  ellipse(out,spec.outW,spec.outH,cx+52,cy-13,3,3,eye,.95);triangle(out,spec.outW,spec.outH,[cx+63,cy-6],[cx+73,cy-2],[cx+63,cy+2],tooth,.9);
  const stride=motion==='move'?(index%2?10:-10):motion==='attack'?8:0;
  line(out,spec.outW,spec.outH,cx-24,cy+17,cx-32-stride*.3,cy+42,dark,6,.95);line(out,spec.outW,spec.outH,cx+17,cy+17,cx+27+stride*.3,cy+42,dark,6,.95);
  line(out,spec.outW,spec.outH,cx-39,cy-3,cx-66-(motion==='move'?index%2*8:0),cy-17,dark,5,.9);
  if(motion==='attack'&&index===spec.attackContactFrame){line(out,spec.outW,spec.outH,cx+55,cy-2,cx+82,cy-2,tooth,2,.7);ellipse(out,spec.outW,spec.outH,cx+80,cy,9,5,belly,.35);}
  if(motion==='death'&&index>=3){line(out,spec.outW,spec.outH,cx-35,cy+30,cx+38,cy+31,dark,4,.55);}
}

const metadata={schemaVersion:1,sliceId:SLICE,generatorVersion:GENERATOR_VERSION,status:'UNREVIEWED_RUNTIME_FILES',humanReview:'PENDING',reviewer:null,reviewedAt:null,generativeAiUsed:false,normalRuntimeAuthoritative:false,targets:{}};

for(const [targetId,spec] of Object.entries(TARGETS)){
  const targetDir=resolve(outputRoot,targetId);await rm(targetDir,{recursive:true,force:true});await mkdir(targetDir,{recursive:true});
  const targetMeta={assetId:spec.assetId,sourceFamily:spec.sourceFamily,structuralRework:true,reviewStatus:'UNREVIEWED_RUNTIME_FILES',frameWidth:spec.outW,frameHeight:spec.outH,displayHeight:spec.displayHeight,attackContactFrame:spec.attackContactFrame,motions:{}};
  for(let mi=0;mi<MOTIONS.length;mi++){
    const motion=MOTIONS[mi],count=spec.frames[mi],frames=[];
    for(let index=0;index<count;index++){
      const out=Buffer.alloc(spec.outW*spec.outH*4);
      if(spec.kind==='sprinter')drawSprinter(out,spec,motion,index,count);
      else{
        const source=SOURCES[spec.sourceFamily],sheet=sourceSheets.get(spec.sourceFamily)[motion],sourceIndex=Math.min(index,source.frames[motion]-1),src=sourceFrame(sheet,source.frameWidth,source.frameHeight,sourceIndex),shift=motionShift(spec,motion,index,count);
        if(spec.kind==='heretic')drawHereticBehind(out,spec,motion,index,count);
        blitSource(out,spec.outW,spec.outH,src,source.frameWidth,source.frameHeight,spec.dx,spec.dy,spec.palette,shift.x,shift.y,spec.kind==='cultist'?.28:.24);
        if(spec.kind==='heretic')drawHereticFront(out,spec,motion,index,count);
        if(spec.kind==='cultist')drawCultist(out,spec,motion,index,count);
      }
      frames.push(out);
    }
    const rgba=assembleHorizontal(frames,spec.outW,spec.outH),png=encodePng(spec.outW*count,spec.outH,rgba),file=resolve(targetDir,`${motion}.png`);await writeFile(file,png);
    targetMeta.motions[motion]={file:`apps/client/public/assets/production/units/${targetId}/${motion}.png`,frames,sha256:sha256(png)};
  }
  metadata.targets[targetId]=targetMeta;
}

await writeFile(resolve(outputRoot,'fifth-slice-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[fifth-slice] materialized ${Object.keys(TARGETS).length} targets / ${Object.keys(TARGETS).length*5} motion strips`);
