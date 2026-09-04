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
const contractPath=resolve(root,'assets/raw/production/fourth-slice-mid-wave-04.json');
const SLICE='fourth-slice-mid-wave-04';
const GENERATOR_VERSION=1;
const NQM='https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';
const VLEE='https://raw.githubusercontent.com/vlee489/AC31009-Client/71252f38c7bf4426ff84676cad517f66c3e6cb65/assets/Sprites';
const MOTIONS=['idle','move','attack','knockback','death'];

const SOURCES={
  'evil-wizard-2':{frameWidth:250,frameHeight:250,frames:{idle:8,move:8,attack:8,knockback:3,death:7},urls:{
    idle:`${NQM}/EVil%20Wizard%202/Sprites/Idle.png`,move:`${NQM}/EVil%20Wizard%202/Sprites/Run.png`,attack:`${NQM}/EVil%20Wizard%202/Sprites/Attack1.png`,knockback:`${NQM}/EVil%20Wizard%202/Sprites/Take%20hit.png`,death:`${NQM}/EVil%20Wizard%202/Sprites/Death.png`}},
  'hero-knight':{frameWidth:180,frameHeight:180,frames:{idle:11,move:8,attack:7,knockback:4,death:11},urls:{
    idle:`${VLEE}/HeroKnight/Idle.png`,move:`${VLEE}/HeroKnight/Run.png`,attack:`${VLEE}/HeroKnight/Attack1.png`,knockback:`${VLEE}/HeroKnight/Take%20Hit.png`,death:`${VLEE}/HeroKnight/Death.png`}},
  'fantasy-warrior':{frameWidth:162,frameHeight:162,frames:{idle:10,move:8,attack:7,knockback:3,death:7},urls:{
    idle:`${NQM}/Fantasy%20Warrior/Sprites/Idle.png`,move:`${NQM}/Fantasy%20Warrior/Sprites/Run.png`,attack:`${NQM}/Fantasy%20Warrior/Sprites/Attack1.png`,knockback:`${NQM}/Fantasy%20Warrior/Sprites/Take%20hit.png`,death:`${NQM}/Fantasy%20Warrior/Sprites/Death.png`}},
};

const TARGETS={
  'pyromancer/pyromancer_f1':{assetId:'unit:pyromancer:pyromancer_f1',sourceFamily:'evil-wizard-2',kind:'pyromancer',form:1,displayHeight:192,attackContactFrame:5,outW:300,outH:260,dx:20,dy:5,palette:[104,77,56],frames:[8,8,8,3,7]},
  'pyromancer/pyromancer_f2':{assetId:'unit:pyromancer:pyromancer_f2',sourceFamily:'evil-wizard-2',kind:'pyromancer',form:2,displayHeight:202,attackContactFrame:5,outW:310,outH:260,dx:18,dy:5,palette:[94,70,54],frames:[8,8,8,3,7]},
  'pyromancer/pyromancer_f3':{assetId:'unit:pyromancer:pyromancer_f3',sourceFamily:'evil-wizard-2',kind:'pyromancer',form:3,displayHeight:214,attackContactFrame:5,outW:330,outH:270,dx:32,dy:8,palette:[82,65,55],frames:[8,8,8,3,7]},
  'royal/royal_f1':{assetId:'unit:royal:royal_f1',sourceFamily:'hero-knight',kind:'royal',form:1,displayHeight:212,attackContactFrame:4,outW:250,outH:205,dx:24,dy:8,palette:[83,82,78],frames:[11,8,7,4,11]},
  'royal/royal_f2':{assetId:'unit:royal:royal_f2',sourceFamily:'hero-knight',kind:'royal',form:2,displayHeight:220,attackContactFrame:4,outW:255,outH:210,dx:28,dy:10,palette:[76,78,79],frames:[11,8,7,4,11]},
  'royal/royal_f3':{assetId:'unit:royal:royal_f3',sourceFamily:'hero-knight',kind:'royal',form:3,displayHeight:216,attackContactFrame:4,outW:265,outH:205,dx:34,dy:7,palette:[87,84,76],frames:[11,8,7,4,11]},
  'enemy-berserker':{assetId:'unit:enemy-berserker',sourceFamily:'fantasy-warrior',kind:'berserker',form:1,displayHeight:204,attackContactFrame:4,outW:255,outH:185,dx:30,dy:10,palette:[92,65,58],frames:[10,8,7,3,7]},
  'enemy-knight':{assetId:'unit:enemy-knight',sourceFamily:'project-authored-beast',kind:'boar',form:1,displayHeight:176,attackContactFrame:3,outW:230,outH:150,dx:0,dy:0,palette:[88,73,61],frames:[6,8,6,4,6]},
};

const contract=JSON.parse(await readFile(contractPath,'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)throw new Error('fourth-slice lifecycle drifted before human review');

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
  if(spec.kind==='pyromancer'){
    if(motion==='move')return{x:index%2?1:-1,y:(spec.form<3?2:0)+(index%2)};
    if(motion==='attack')return{x:index>=spec.attackContactFrame?2:0,y:index<3?1:0};
    if(motion==='knockback')return{x:-Math.round(p*6),y:Math.round(p*2)};
    if(motion==='death')return{x:0,y:Math.round(p*14)};
  }
  if(spec.kind==='royal'){
    if(motion==='move')return{x:0,y:index%2?1:0};
    if(motion==='attack')return{x:index===spec.attackContactFrame?(spec.form===3?8:4):0,y:spec.form===3?2:0};
    if(motion==='knockback')return{x:-Math.round(p*5),y:Math.round(p*2)};
    if(motion==='death')return{x:0,y:Math.round(p*13)};
  }
  if(spec.kind==='berserker'){
    if(motion==='attack')return{x:index<4?-Math.round((4-index)*1.5):index===4?7:2,y:index<4?2:0};
    if(motion==='knockback')return{x:-Math.round(p*7),y:Math.round(p*2)};
    if(motion==='death')return{x:0,y:Math.round(p*14)};
  }
  return{x:0,y:0};
}

function drawPyromancer(out,spec,motion,index,count){
  const iron=[72,64,58,255],hot=[228,121,45,255],ember=[245,190,92,255],ash=[56,50,47,255],rim=[147,118,88,255];
  const attack=motion==='attack',p=index/Math.max(1,count-1),contact=attack&&index===spec.attackContactFrame;
  const cx=spec.form===3?125:92,cy=118;
  if(spec.form===1){ellipse(out,spec.outW,spec.outH,cx,cy,29,46,iron,.96);rect(out,spec.outW,spec.outH,cx-22,cy-31,cx+22,cy+28,ash,.55);line(out,spec.outW,spec.outH,cx-18,cy-18,cx+18,cy-18,rim,3,.9);}
  if(spec.form===2){ellipse(out,spec.outW,spec.outH,cx+2,cy+12,42,37,iron,.97);rect(out,spec.outW,spec.outH,cx-34,cy-7,cx+38,cy+31,ash,.52);line(out,spec.outW,spec.outH,cx-31,cy+7,cx+34,cy+7,rim,4,.9);}
  if(spec.form===3){const open=attack?Math.min(1,.28+index/Math.max(1,spec.attackContactFrame)*.72):.34;const rx=58+18*open,ry=55+12*open;ellipse(out,spec.outW,spec.outH,cx,cy,rx,ry,ash,.30);line(out,spec.outW,spec.outH,cx-rx,cy,cx+rx,cy,iron,5,.82);line(out,spec.outW,spec.outH,cx,cy-ry,cx,cy+ry,iron,5,.82);line(out,spec.outW,spec.outH,cx-rx*.7,cy-ry*.72,cx+rx*.67,cy+ry*.74,rim,3,.75);line(out,spec.outW,spec.outH,cx+rx*.65,cy-ry*.74,cx-rx*.62,cy+ry*.7,rim,3,.75);}
  const flameX=spec.outW-66,flameY=103;
  if(attack){const t=Math.max(0,1-Math.abs(index-spec.attackContactFrame)/Math.max(2,spec.attackContactFrame));ellipse(out,spec.outW,spec.outH,flameX,flameY,6+18*t,6+13*t,hot,.45+.45*t);ellipse(out,spec.outW,spec.outH,flameX,flameY,3+7*t,3+5*t,ember,.85);if(contact){ellipse(out,spec.outW,spec.outH,flameX+22,flameY,28+(spec.form===3?12:0),20+(spec.form===3?8:0),hot,.28);line(out,spec.outW,spec.outH,flameX-10,flameY,flameX+43,flameY,ember,3,.75);}}
  if(motion==='knockback'&&index===1)ellipse(out,spec.outW,spec.outH,cx,cy,12,8,ash,.82);
  if(motion==='death'){const fade=1-p;ellipse(out,spec.outW,spec.outH,cx,cy-40*p,15+12*p,8+10*p,ash,.28+.35*fade);}
}

function drawRoyal(out,spec,motion,index,count){
  const steel=[185,189,188,255],dark=[54,57,59,255],gold=[183,149,75,255],cloth=[84,65,65,255];
  const attack=motion==='attack',contact=attack&&index===spec.attackContactFrame;
  const cx=126,headY=47;
  triangle(out,spec.outW,spec.outH,[cx-3,headY-4],[cx+2,headY-34],[cx+10,headY-5],gold,.95);
  if(spec.form===2){rect(out,spec.outW,spec.outH,cx-34,76,cx-12,105,steel,.72);rect(out,spec.outW,spec.outH,cx+12,76,cx+35,105,steel,.72);triangle(out,spec.outW,spec.outH,[cx-35,78],[cx-50,94],[cx-26,104],dark,.75);triangle(out,spec.outW,spec.outH,[cx+35,78],[cx+50,94],[cx+26,104],dark,.75);}
  const handX=136,handY=108;
  if(spec.form===2&&!attack){line(out,spec.outW,spec.outH,handX,handY,handX+2,37,dark,8,.98);triangle(out,spec.outW,spec.outH,[handX+2,36],[handX-9,54],[handX+13,54],steel,.98);}else{
    const endX=contact?(spec.form===3?252:236):(spec.form===3?226:214),endY=contact?(spec.form===3?78:143):(spec.form===3?84:120);
    line(out,spec.outW,spec.outH,handX,handY,endX,endY,dark,spec.form===3?5:8,.98);triangle(out,spec.outW,spec.outH,[endX,endY],[endX-17,endY-7],[endX-13,endY+10],steel,.98);
    if(contact&&spec.form===3)line(out,spec.outW,spec.outH,150,95,258,69,[225,223,211,255],2,.62);
  }
  rect(out,spec.outW,spec.outH,107,121,145,128,cloth,.38);
  if(motion==='knockback'&&index>=2)line(out,spec.outW,spec.outH,104,154,146,154,dark,4,.68);
}

function drawBerserker(out,spec,motion,index,count){
  const wood=[94,65,48,255],iron=[91,86,82,255],edge=[170,157,139,255],dust=[132,101,72,255];
  const attack=motion==='attack',contact=attack&&index===spec.attackContactFrame;
  const handX=128,handY=102;
  let endX=202,endY=61;
  if(attack){if(index<spec.attackContactFrame){endX=150+index*8;endY=48-index*4;}else{endX=218;endY=contact?143:118;}}
  line(out,spec.outW,spec.outH,handX,handY,endX,endY,wood,7,.98);ellipse(out,spec.outW,spec.outH,endX,endY,20,17,iron,.98);rect(out,spec.outW,spec.outH,endX-16,endY-10,endX+16,endY+10,iron,.96);for(const sx of [-1,1])triangle(out,spec.outW,spec.outH,[endX+sx*19,endY],[endX+sx*28,endY-7],[endX+sx*28,endY+7],edge,.88);
  if(contact){ellipse(out,spec.outW,spec.outH,endX,endY+15,42,10,dust,.32);line(out,spec.outW,spec.outH,endX-34,endY+12,endX+36,endY+17,dust,3,.65);}
}

function drawBoar(out,spec,motion,index,count){
  const p=index/Math.max(1,count-1),body=[102,72,58,255],dark=[59,54,50,255],armor=[91,96,95,255],edge=[169,162,145,255],tusk=[216,205,174,255],dust=[134,104,76,255];
  let x=109,y=92,tilt=0;
  if(motion==='move'){x+=index%2?3:-2;y+=index%2?1:0;}
  if(motion==='attack'){const prep=index<3?-Math.round((3-index)*4):Math.round((index-2)*9);x+=prep;y+=index<3?2:0;}
  if(motion==='knockback'){x-=Math.round(p*18);y+=Math.round(p*3);}
  if(motion==='death'){x+=Math.round(p*4);y+=Math.round(p*25);tilt=p;}
  ellipse(out,spec.outW,spec.outH,x,y,61,35,body,.98);
  ellipse(out,spec.outW,spec.outH,x+49,y-5,31,26,dark,.98);
  ellipse(out,spec.outW,spec.outH,x+58,y-2,18,13,body,.98);
  triangle(out,spec.outW,spec.outH,[x+68,y+3],[x+90,y-2],[x+70,y+13],tusk,.98);
  triangle(out,spec.outW,spec.outH,[x+64,y+9],[x+84,y+17],[x+64,y+18],tusk,.9);
  rect(out,spec.outW,spec.outH,x-44,y-31,x+20,y-7,armor,.94);line(out,spec.outW,spec.outH,x-35,y-26,x+12,y-26,edge,4,.8);line(out,spec.outW,spec.outH,x-27,y-9,x-27,y+17,armor,5,.82);line(out,spec.outW,spec.outH,x+5,y-9,x+5,y+18,armor,5,.82);
  for(const lx of [x-32,x+18,x+50]){line(out,spec.outW,spec.outH,lx,y+23,lx-(tilt?8:0),y+46,dark,8,.98);ellipse(out,spec.outW,spec.outH,lx-(tilt?8:0),y+47,9,5,dark,.98);}
  triangle(out,spec.outW,spec.outH,[x+38,y-24],[x+47,y-43],[x+53,y-19],dark,.96);ellipse(out,spec.outW,spec.outH,x+59,y-10,3,3,[230,181,98,255],.95);
  if(motion==='attack'&&index===spec.attackContactFrame){ellipse(out,spec.outW,spec.outH,x+70,y+39,54,10,dust,.32);line(out,spec.outW,spec.outH,x+25,y+35,x+104,y+35,dust,4,.62);}
  if(motion==='move'&&index%2===1)ellipse(out,spec.outW,spec.outH,x-32,y+48,16,5,dust,.25);
}

await Promise.all(Object.keys(TARGETS).map((relative)=>rm(resolve(outputRoot,relative),{recursive:true,force:true})));
for(const [relative,spec] of Object.entries(TARGETS)){
  const targetDir=resolve(outputRoot,relative);await mkdir(targetDir,{recursive:true});
  const source=spec.sourceFamily==='project-authored-beast'?null:SOURCES[spec.sourceFamily];
  const sheets=source?sourceSheets.get(spec.sourceFamily):null;
  const files={};
  for(let mi=0;mi<MOTIONS.length;mi++){
    const motion=MOTIONS[mi],count=spec.frames[mi],frames=[];
    for(let index=0;index<count;index++){
      const out=Buffer.alloc(spec.outW*spec.outH*4);
      if(source&&sheets){const sheet=sheets[motion],srcIndex=index%source.frames[motion],src=sourceFrame(sheet,source.frameWidth,source.frameHeight,srcIndex),shift=motionShift(spec,motion,index,count);blitSource(out,spec.outW,spec.outH,src,source.frameWidth,source.frameHeight,spec.dx,spec.dy,spec.palette,shift.x,shift.y,.18);}
      if(spec.kind==='pyromancer')drawPyromancer(out,spec,motion,index,count);
      else if(spec.kind==='royal')drawRoyal(out,spec,motion,index,count);
      else if(spec.kind==='berserker')drawBerserker(out,spec,motion,index,count);
      else drawBoar(out,spec,motion,index,count);
      frames.push(out);
    }
    const rgba=assembleHorizontal(frames,spec.outW,spec.outH),png=encodePng(spec.outW*count,spec.outH,rgba),path=resolve(targetDir,`${motion}.png`);await writeFile(path,png);files[motion]={frames:count,width:spec.outW*count,height:spec.outH,sha256:sha256(png)};
  }
  const metadata={schemaVersion:1,sliceId:SLICE,generatorVersion:GENERATOR_VERSION,assetId:spec.assetId,sourceFamily:spec.sourceFamily,projectAuthored:spec.sourceFamily==='project-authored-beast',structuralRework:true,generativeAiUsed:false,status:'AWAITING_ART',reviewStatus:'UNREVIEWED_RUNTIME_FILES',normalRuntimeAuthoritative:false,displayHeight:spec.displayHeight,attackContactFrame:spec.attackContactFrame,frameWidth:spec.outW,frameHeight:spec.outH,motions:Object.fromEntries(MOTIONS.map((m,i)=>[m,spec.frames[i]])),files};
  await writeFile(resolve(targetDir,'runtime-metadata.json'),`${JSON.stringify(metadata,null,2)}\n`);
  console.log(`[fourth-slice] ${relative} ${spec.frames.reduce((a,b)=>a+b,0)} frames`);
}
