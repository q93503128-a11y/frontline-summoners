import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blitSource, ellipse, encodePng, fetchPinnedPng, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputRoot=resolve(root,'apps/client/public/assets/production/units');
const contractPath=resolve(root,'assets/raw/production/sixth-slice-chapter-one-finale-06.json');
const SLICE='sixth-slice-chapter-one-finale-06';
const VLEE='https://raw.githubusercontent.com/vlee489/AC31009-Client/71252f38c7bf4426ff84676cad517f66c3e6cb65/assets/Sprites';
const MOTIONS=['idle','move','attack','knockback','death'];
const knight={frameWidth:180,frameHeight:180,frames:{idle:11,move:8,attack:7,knockback:4,death:11},urls:{idle:`${VLEE}/HeroKnight/Idle.png`,move:`${VLEE}/HeroKnight/Run.png`,attack:`${VLEE}/HeroKnight/Attack1.png`,knockback:`${VLEE}/HeroKnight/Take%20Hit.png`,death:`${VLEE}/HeroKnight/Death.png`}};
const TARGETS={
  'voidsage/voidsage_f1':{assetId:'unit:voidsage:voidsage_f1',sourceFamily:'project-authored-anomaly',kind:'voidsage',form:1,displayHeight:198,attackContactFrame:5,simulationContactFrame:48,outW:270,outH:220,frames:[6,8,8,4,7]},
  'voidsage/voidsage_f2':{assetId:'unit:voidsage:voidsage_f2',sourceFamily:'project-authored-anomaly',kind:'voidsage',form:2,displayHeight:204,attackContactFrame:5,simulationContactFrame:48,outW:300,outH:230,frames:[6,8,8,4,7]},
  'voidsage/voidsage_f3':{assetId:'unit:voidsage:voidsage_f3',sourceFamily:'project-authored-anomaly',kind:'voidsage',form:3,displayHeight:214,attackContactFrame:5,simulationContactFrame:48,outW:330,outH:240,frames:[6,8,8,4,7]},
  'enemy-boss-iron':{assetId:'unit:enemy-boss-iron',sourceFamily:'hero-knight',kind:'iron',form:1,displayHeight:244,attackContactFrame:4,simulationContactFrame:52,outW:300,outH:225,frames:[11,8,7,4,11]},
};
const contract=JSON.parse(await readFile(contractPath,'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)throw new Error('sixth-slice lifecycle drifted');

const knightSheets={};
for(const motion of MOTIONS){const count=knight.frames[motion];knightSheets[motion]=(await fetchPinnedPng(knight.urls[motion],knight.frameWidth*count,knight.frameHeight,`hero-knight/${motion}`)).png;}

function assembleHorizontal(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const a=y*w*4,b=a+w*4,d=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,d,a,b);}return out;}
function plate(out,w,h,cx,cy,s,rot,color,alpha=.9){const dx=Math.cos(rot)*s,dy=Math.sin(rot)*s;const px=-Math.sin(rot)*s*.45,py=Math.cos(rot)*s*.45;triangle(out,w,h,[cx-dx+px,cy-dy+py],[cx+dx,cy+dy],[cx-dx-px,cy-dy-py],color,alpha);line(out,w,h,cx-dx*.7,cy-dy*.7,cx+dx*.65,cy+dy*.65,[204,205,196,255],2,alpha*.55);}
function drawVoidsage(out,spec,motion,index,count){
  const p=index/Math.max(1,count-1),dark=[42,44,48,255],cloth=[77,78,82,255],skin=[172,166,151,255],edge=[202,204,198,255],rift=[113,122,132,255];
  let ox=0,oy=0;if(motion==='move'){ox=index%2?2:-1;oy=index%2?-1:1;}if(motion==='knockback'){ox=-Math.round(p*8);}if(motion==='death'){oy=Math.round(p*22);}
  const cx=Math.round(spec.outW*.48)+ox,cy=112+oy;
  ellipse(out,spec.outW,spec.outH,cx,cy-48,13,16,skin,.72);triangle(out,spec.outW,spec.outH,[cx-22,cy-30],[cx+20,cy-30],[cx+12,cy+45],cloth,.94);rect(out,spec.outW,spec.outH,cx-8,cy+38,cx+6,cy+62,dark,.86);
  const n=spec.form===1?3:spec.form===2?5:7;const orbitX=spec.form===1?62:spec.form===2?82:104,orbitY=spec.form===1?47:spec.form===2?55:64;
  const contact=motion==='attack'&&index===spec.attackContactFrame;const gather=motion==='attack'?Math.max(.18,1-Math.abs(index-spec.attackContactFrame)/5):0;
  for(let i=0;i<n;i++){
    const base=Math.PI*2*i/n+(motion==='idle'||motion==='move'?index*.18*(i%2?1:-1):0);
    const collapse=motion==='attack'?(1-gather*.72):1;
    const x=cx+Math.cos(base)*orbitX*collapse,y=cy-12+Math.sin(base)*orbitY*collapse;
    const size=(spec.form===3?18:15)+(i%2?3:0);plate(out,spec.outW,spec.outH,x,y,size,base*.55+(i%2?.35:-.25),dark,.86);
  }
  if(motion==='attack'){
    const gx=spec.outW-54,gy=101;const q=Math.max(0,1-Math.abs(index-spec.attackContactFrame)/Math.max(2,spec.attackContactFrame));
    ellipse(out,spec.outW,spec.outH,gx,gy,8+28*q,6+22*q,rift,.18+.25*q);line(out,spec.outW,spec.outH,gx-24*q,gy,gx+25*q,gy,edge,2,.35+.45*q);
    if(contact){ellipse(out,spec.outW,spec.outH,gx,gy,37,28,dark,.44);line(out,spec.outW,spec.outH,gx-28,gy-18,gx+26,gy+17,edge,3,.72);line(out,spec.outW,spec.outH,gx+24,gy-19,gx-20,gy+19,edge,2,.62);}
  }
  if(motion==='knockback'&&index>=2){for(let i=0;i<3;i++)plate(out,spec.outW,spec.outH,cx+34+i*15,cy-25+i*10,8,.3*i,rift,.45);}
  if(motion==='death'){const fade=1-p;ellipse(out,spec.outW,spec.outH,cx,cy+26,35+25*p,8+5*p,dark,.22+.25*fade);}
}
function drawIron(out,spec,motion,index,count){
  const p=index/Math.max(1,count-1),iron=[81,86,88,255],edge=[158,158,149,255],dark=[46,49,51,255],rust=[111,76,57,255];
  const attack=motion==='attack',contact=attack&&index===spec.attackContactFrame;let dx=28,dy=17;if(motion==='move')dx+=index%2?1:0;if(motion==='knockback')dx-=Math.round(p*7);if(motion==='death')dy+=Math.round(p*17);
  const srcIndex=Math.min(index,knight.frames[motion]-1),src=sourceFrame(knightSheets[motion],knight.frameWidth,knight.frameHeight,srcIndex);blitSource(out,spec.outW,spec.outH,src,180,180,dx,dy,[72,76,78],0,0,.24);
  const gateX=attack?(contact?168:152):146,gateY=112+(motion==='death'?Math.round(p*24):0),gw=contact?78:70,gh=96;
  rect(out,spec.outW,spec.outH,gateX-gw/2,gateY-gh/2,gateX+gw/2,gateY+gh/2,iron,.97);rect(out,spec.outW,spec.outH,gateX-gw/2+7,gateY-gh/2+8,gateX+gw/2-7,gateY+gh/2-8,dark,.36);
  for(let y=gateY-gh/2+16;y<gateY+gh/2;y+=19)line(out,spec.outW,spec.outH,gateX-gw/2+4,y,gateX+gw/2-4,y,edge,3,.78);
  for(const x of [gateX-gw*.25,gateX,gateX+gw*.25])line(out,spec.outW,spec.outH,x,gateY-gh/2+5,x,gateY+gh/2-5,edge,4,.72);
  triangle(out,spec.outW,spec.outH,[gateX-gw/2,gateY-gh/2],[gateX,gateY-gh/2-21],[gateX+gw/2,gateY-gh/2],rust,.78);
  if(contact){ellipse(out,spec.outW,spec.outH,gateX+51,gateY+34,48,12,rust,.27);line(out,spec.outW,spec.outH,gateX+15,gateY+7,gateX+74,gateY+27,edge,4,.64);}
  if(motion==='knockback'&&index>=2)line(out,spec.outW,spec.outH,gateX-30,gateY+55,gateX+22,gateY+58,rust,4,.52);
  if(motion==='death'&&index>=Math.floor(count*.45))line(out,spec.outW,spec.outH,gateX-28,gateY-7,gateX+31,gateY+25,dark,5,.66);
}

const metadata={schemaVersion:1,sliceId:SLICE,generatorVersion:1,status:'UNREVIEWED_RUNTIME_FILES',humanReview:'PENDING',reviewer:null,reviewedAt:null,generativeAiUsed:false,normalRuntimeAuthoritative:false,targets:{}};
for(const [targetId,spec] of Object.entries(TARGETS)){
  const dir=resolve(outputRoot,targetId);await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  const tm={assetId:spec.assetId,sourceFamily:spec.sourceFamily,reviewStatus:'UNREVIEWED_RUNTIME_FILES',frameWidth:spec.outW,frameHeight:spec.outH,displayHeight:spec.displayHeight,attackContactFrame:spec.attackContactFrame,simulationContactFrame:spec.simulationContactFrame,motions:{}};
  for(let mi=0;mi<MOTIONS.length;mi++){
    const motion=MOTIONS[mi],count=spec.frames[mi],frames=[];
    for(let i=0;i<count;i++){const out=Buffer.alloc(spec.outW*spec.outH*4);spec.kind==='voidsage'?drawVoidsage(out,spec,motion,i,count):drawIron(out,spec,motion,i,count);frames.push(out);}
    const rgba=assembleHorizontal(frames,spec.outW,spec.outH),png=encodePng(spec.outW*count,spec.outH,rgba),path=resolve(dir,`${motion}.png`);await writeFile(path,png);tm.motions[motion]={frames:count,bytes:png.length,sha256:sha256(png)};
  }
  metadata.targets[targetId]=tm;
}
await writeFile(resolve(outputRoot,'sixth-slice-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[sixth-slice] materialized ${Object.keys(TARGETS).length} targets / ${Object.keys(TARGETS).length*5} motion strips`);
