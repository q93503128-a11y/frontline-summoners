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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(root, 'apps/client/public/assets/production/units');
const contractPath = resolve(root, 'assets/raw/production/third-slice-mid-wave-03.json');
const GENERATOR_VERSION = 1;
const NQM = 'https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';
const VLEE = 'https://raw.githubusercontent.com/vlee489/AC31009-Client/71252f38c7bf4426ff84676cad517f66c3e6cb65/assets/Sprites';

const SOURCES = {
  'martial-hero-2': {
    frameWidth: 200, frameHeight: 200,
    frames: { idle: 4, move: 8, attack: 4, knockback: 3, death: 7 },
    urls: {
      idle: `${NQM}/Martial%20Hero%202/Sprites/Idle.png`,
      move: `${NQM}/Martial%20Hero%202/Sprites/Run.png`,
      attack: `${NQM}/Martial%20Hero%202/Sprites/Attack1.png`,
      knockback: `${NQM}/Martial%20Hero%202/Sprites/Take%20hit.png`,
      death: `${NQM}/Martial%20Hero%202/Sprites/Death.png`,
    },
  },
  warrior: {
    frameWidth: 150, frameHeight: 150,
    frames: { idle: 8, move: 8, attack: 4, knockback: 4, death: 6 },
    urls: {
      idle: `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Idle.png`,
      move: `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Run.png`,
      attack: `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Attack1.png`,
      knockback: `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Take%20Hit.png`,
      death: `${NQM}/Medieval%20Warrior%20Pack%202/Sprites/Death.png`,
    },
  },
  wizard: {
    frameWidth: 231, frameHeight: 190,
    frames: { idle: 6, move: 8, attack: 8, knockback: 4, death: 7 },
    urls: {
      idle: `${VLEE}/WizardPack/Idle.png`,
      move: `${VLEE}/WizardPack/Run.png`,
      attack: `${VLEE}/WizardPack/Attack1.png`,
      knockback: `${VLEE}/WizardPack/Hit.png`,
      death: `${VLEE}/WizardPack/Death.png`,
    },
  },
  huntress: {
    frameWidth: 150, frameHeight: 150,
    frames: { idle: 8, move: 8, attack: 5, knockback: 3, death: 8 },
    urls: {
      idle: `${NQM}/Huntress/Sprites/Idle.png`,
      move: `${NQM}/Huntress/Sprites/Run.png`,
      attack: `${NQM}/Huntress/Sprites/Attack1.png`,
      knockback: `${NQM}/Huntress/Sprites/Take%20hit.png`,
      death: `${NQM}/Huntress/Sprites/Death.png`,
    },
  },
};

const TARGETS = {
  'duelist/duelist_f1': { assetId:'unit:duelist:duelist_f1', sourceFamily:'martial-hero-2', kind:'duelist', form:1, displayHeight:190, attackContactFrame:2, outW:230, outH:210, dx:14, dy:4, palette:[96,82,78] },
  'duelist/duelist_f2': { assetId:'unit:duelist:duelist_f2', sourceFamily:'martial-hero-2', kind:'duelist', form:2, displayHeight:194, attackContactFrame:2, outW:230, outH:210, dx:14, dy:4, palette:[88,74,73] },
  'duelist/duelist_f3': { assetId:'unit:duelist:duelist_f3', sourceFamily:'martial-hero-2', kind:'duelist', form:3, displayHeight:198, attackContactFrame:2, outW:230, outH:210, dx:14, dy:4, palette:[74,70,69] },
  'lancer/lancer_f1': { assetId:'unit:lancer:lancer_f1', sourceFamily:'warrior', kind:'lancer', form:1, displayHeight:190, attackContactFrame:2, outW:240, outH:170, dx:34, dy:10, palette:[66,83,102] },
  'lancer/lancer_f2': { assetId:'unit:lancer:lancer_f2', sourceFamily:'warrior', kind:'lancer', form:2, displayHeight:198, attackContactFrame:2, outW:250, outH:170, dx:34, dy:10, palette:[58,74,94] },
  'lancer/lancer_f3': { assetId:'unit:lancer:lancer_f3', sourceFamily:'warrior', kind:'lancer', form:3, displayHeight:194, attackContactFrame:2, outW:240, outH:170, dx:34, dy:10, palette:[55,69,88] },
  'battlemage/battlemage_f1': { assetId:'unit:battlemage:battlemage_f1', sourceFamily:'wizard', kind:'battlemage', form:1, displayHeight:184, attackContactFrame:4, outW:280, outH:205, dx:20, dy:8, palette:[90,88,78] },
  'battlemage/battlemage_f2': { assetId:'unit:battlemage:battlemage_f2', sourceFamily:'wizard', kind:'battlemage', form:2, displayHeight:190, attackContactFrame:4, outW:280, outH:205, dx:20, dy:8, palette:[83,84,78] },
  'battlemage/battlemage_f3': { assetId:'unit:battlemage:battlemage_f3', sourceFamily:'wizard', kind:'battlemage', form:3, displayHeight:202, attackContactFrame:4, outW:290, outH:210, dx:24, dy:10, palette:[75,80,79] },
  'enemy-sniper': { assetId:'unit:enemy-sniper', sourceFamily:'huntress', kind:'sniper', form:1, displayHeight:184, attackContactFrame:3, outW:255, outH:170, dx:28, dy:10, palette:[76,82,88] },
};

const MOTIONS = ['idle','move','attack','knockback','death'];
const contract = JSON.parse(await readFile(contractPath, 'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING')throw new Error('third-slice contract lifecycle drifted before human review');

const sourceSheets = new Map();
for(const [familyId,source] of Object.entries(SOURCES)){
  const motions={};
  for(const motion of MOTIONS){
    const frames=source.frames[motion];
    const result=await fetchPinnedPng(source.urls[motion], source.frameWidth*frames, source.frameHeight, `${familyId}/${motion}`);
    motions[motion]=result.png;
  }
  sourceSheets.set(familyId,motions);
}

function motionShift(spec,motion,index,count){
  const p=index/Math.max(1,count-1);
  if(spec.kind==='duelist'){
    if(motion==='attack'&&spec.form===3)return {x:index===2?9:index===3?3:-2,y:index<2?5:2};
    if(motion==='move')return {x:index%2?1:-1,y:spec.form===3?3:0};
    if(motion==='knockback')return {x:-Math.round(p*7),y:Math.round(p*2)};
    if(motion==='death')return {x:Math.round(p*2),y:Math.round(p*14)};
  }
  if(spec.kind==='lancer'){
    if(motion==='move')return {x:0,y:spec.form===2?4:(index%2)};
    if(motion==='attack')return {x:index===2?6:0,y:spec.form===2?3:0};
    if(motion==='knockback')return {x:-Math.round(p*6),y:1};
    if(motion==='death')return {x:0,y:Math.round(p*13)};
  }
  if(spec.kind==='battlemage'){
    if(motion==='attack')return {x:index>=4?2:0,y:0};
    if(motion==='knockback')return {x:-Math.round(p*5),y:Math.round(p*2)};
    if(motion==='death')return {x:0,y:Math.round(p*12)};
  }
  if(spec.kind==='sniper'){
    if(motion==='attack')return {x:index===3?2:0,y:0};
    if(motion==='knockback')return {x:-Math.round(p*6),y:0};
    if(motion==='death')return {x:0,y:Math.round(p*12)};
  }
  return {x:0,y:0};
}

function drawDuelist(out,spec,motion,index,count){
  const dark=[48,44,45,255],cloth=[75,67,69,255],steel=[207,211,207,255],accent=[132,99,85,255];
  const low=spec.form===3?5:0,attack=motion==='attack',contact=attack&&index===spec.attackContactFrame;
  const cx=118,hip=132+low;
  if(spec.form>=2){triangle(out,spec.outW,spec.outH,[cx-16,hip-6],[cx-30,178+low],[cx-4,160+low],cloth,.92);triangle(out,spec.outW,spec.outH,[cx+4,hip-4],[cx+18,177+low],[cx-2,160+low],dark,.92);}
  else triangle(out,spec.outW,spec.outH,[cx-8,hip],[cx-18,174],[cx+5,162],cloth,.82);
  if(spec.form===3)line(out,spec.outW,spec.outH,73,145,132,147,dark,4,.95);
  const handX=126+(contact?8:0),handY=105+low;
  const reach=spec.form===3?(contact?93:68):(contact?82:65);
  const endX=Math.min(spec.outW-8,handX+reach),endY=spec.form===3?handY-5:handY-2;
  line(out,spec.outW,spec.outH,handX,handY,endX,endY,steel,spec.form===3?3:2,.98);
  triangle(out,spec.outW,spec.outH,[endX,endY],[endX-10,endY-4],[endX-10,endY+4],steel,.98);
  if(spec.form===2)line(out,spec.outW,spec.outH,109,111,86,132,steel,2,.9);
  if(contact&&spec.form===3)line(out,spec.outW,spec.outH,112,94,220,82,[231,226,210,255],2,.72);
  rect(out,spec.outW,spec.outH,108,126+low,130,132+low,accent,.55);
}

function drawLancer(out,spec,motion,index,count){
  const shaft=[97,77,55,255],steel=[184,192,194,255],blue=[53,76,103,255],edge=[152,171,189,255];
  const attack=motion==='attack',contact=attack&&index===spec.attackContactFrame;
  const y=94+(spec.form===2?4:0),start=106,endBase=spec.form===2?242:spec.form===1?224:216,end=Math.min(spec.outW-5,endBase+(contact?7:0));
  line(out,spec.outW,spec.outH,start,y,end,y-(spec.form===3?4:1),shaft,4,.98);
  const blade=spec.form===3?18:spec.form===2?12:14;
  triangle(out,spec.outW,spec.outH,[end,y],[end-blade,y-10-(spec.form===3?3:0)],[end-blade,y+10+(spec.form===3?3:0)],steel,.98);
  line(out,spec.outW,spec.outH,96,56,98,126,shaft,3,.9);
  triangle(out,spec.outW,spec.outH,[98,59],[128,70],[98,82],blue,.95);
  if(spec.form===2)line(out,spec.outW,spec.outH,90,120,144,120,edge,3,.75);
  if(spec.form===3&&contact)line(out,spec.outW,spec.outH,156,81,225,110,edge,3,.55);
}

function drawBattlemage(out,spec,motion,index,count){
  const metal=[130,132,124,255],plate=[190,177,131,255],dark=[52,55,54,255],glow=[226,218,168,255];
  const attack=motion==='attack',contact=attack&&index===spec.attackContactFrame;
  rect(out,spec.outW,spec.outH,70,122,94,151,dark,.88);line(out,spec.outW,spec.outH,78,117,84,153,metal,3,.9);
  const staffX=150,staffY=110;line(out,spec.outW,spec.outH,staffX,staffY,205,92,metal,4,.95);ellipse(out,spec.outW,spec.outH,207,91,6,6,plate,.98);
  const plateCount=spec.form===1?1:spec.form===2?3:2;
  for(let i=0;i<plateCount;i++){const px=112+i*17,py=72+(i%2)*10;rect(out,spec.outW,spec.outH,px,py,px+11,py+17,metal,.88);line(out,spec.outW,spec.outH,px+3,py+4,px+8,py+12,plate,2,.8);}
  if(spec.form===3){const open=attack?Math.max(.22,1-Math.abs(index-spec.attackContactFrame)/4):.18;const cx=122,cy=96,rx=42+24*open,ry=30+18*open;ellipse(out,spec.outW,spec.outH,cx,cy,rx,ry,dark,.36);line(out,spec.outW,spec.outH,cx-rx,cy,cx+rx,cy,metal,3,.72);line(out,spec.outW,spec.outH,cx,cy-ry,cx,cy+ry,metal,3,.72);if(contact){ellipse(out,spec.outW,spec.outH,229,91,18,18,glow,.34);ellipse(out,spec.outW,spec.outH,229,91,7,7,glow,.95);}}
  else if(contact){ellipse(out,spec.outW,spec.outH,224,91,spec.form===2?14:11,spec.form===2?14:11,glow,.72);}
}

function drawSniper(out,spec,motion,index,count){
  const glass=[181,211,224,255],dark=[49,56,61,255],metal=[115,129,137,255],flash=[235,244,241,255];
  const attack=motion==='attack',contact=attack&&index===spec.attackContactFrame;
  const baseY=91,startX=95,endX=contact?246:228;
  line(out,spec.outW,spec.outH,startX,baseY,endX,baseY-2,glass,5,.93);
  line(out,spec.outW,spec.outH,startX+2,baseY+4,endX-3,baseY+2,dark,2,.8);
  rect(out,spec.outW,spec.outH,127,78,145,86,metal,.94);triangle(out,spec.outW,spec.outH,[145,78],[158,82],[145,87],glass,.9);
  line(out,spec.outW,spec.outH,112,96,99,126,dark,4,.92);
  if(contact){ellipse(out,spec.outW,spec.outH,endX,baseY-2,11,7,flash,.9);line(out,spec.outW,spec.outH,endX-2,baseY-2,254,baseY-2,flash,2,.62);}
  if(attack&&index<3)line(out,spec.outW,spec.outH,160,baseY-1,245,baseY-1,glass,1,.28);
}

function drawOverlay(out,spec,motion,index,count){
  if(spec.kind==='duelist')drawDuelist(out,spec,motion,index,count);
  else if(spec.kind==='lancer')drawLancer(out,spec,motion,index,count);
  else if(spec.kind==='battlemage')drawBattlemage(out,spec,motion,index,count);
  else drawSniper(out,spec,motion,index,count);
}

const metadata={schemaVersion:1,generator:'materialize-third-slice-production-art.mjs',generatorVersion:GENERATOR_VERSION,status:'UNREVIEWED_RUNTIME_FILES',humanReview:'PENDING',generativeAiUsed:false,contract:'assets/raw/production/third-slice-mid-wave-03.json',targets:{}};
for(const [relative,spec] of Object.entries(TARGETS)){
  const source=SOURCES[spec.sourceFamily],sheets=sourceSheets.get(spec.sourceFamily),targetDir=resolve(outputRoot,relative);
  await rm(targetDir,{recursive:true,force:true});await mkdir(targetDir,{recursive:true});
  const targetMeta={assetId:spec.assetId,sourceFamily:spec.sourceFamily,displayHeight:spec.displayHeight,attackContactFrame:spec.attackContactFrame,frameWidth:spec.outW,frameHeight:spec.outH,structuralRework:true,reviewStatus:'UNREVIEWED_RUNTIME_FILES',motions:{}};
  for(const motion of MOTIONS){
    const count=source.frames[motion],sheet=sheets[motion],strip=Buffer.alloc(spec.outW*spec.outH*4*count);
    for(let index=0;index<count;index++){
      const frame=Buffer.alloc(spec.outW*spec.outH*4),src=sourceFrame(sheet,source.frameWidth,source.frameHeight,index),shift=motionShift(spec,motion,index,count);
      blitSource(frame,spec.outW,spec.outH,src,source.frameWidth,source.frameHeight,spec.dx,spec.dy,spec.palette,shift.x,shift.y,.18);
      drawOverlay(frame,spec,motion,index,count);
      frame.copy(strip,index*spec.outW*spec.outH*4);
    }
    const png=encodePng(spec.outW*count,spec.outH,strip),file=`${motion}.png`;
    await writeFile(resolve(targetDir,file),png);
    targetMeta.motions[motion]={file:`apps/client/public/assets/production/units/${relative}/${file}`,frames:count,bytes:png.length,sha256:sha256(png),sourceUrl:source.urls[motion]};
  }
  metadata.targets[relative]=targetMeta;
}
await writeFile(resolve(outputRoot,'third-slice-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[third-slice] materialized ${Object.keys(TARGETS).length} targets / ${Object.keys(TARGETS).length*5} motion strips`);
