import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ellipse, encodePng, line, rect, sha256, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputRoot=resolve(root,'apps/client/public/assets/production/units');
const contractPath=resolve(root,'assets/raw/production/chapter-04-production-01.json');
const BATCH='chapter-04-production-01';
const GENERATOR_VERSION=1;
const MOTIONS=['idle','move','attack','knockback','death'];

const TARGETS={
  enemy_ch4_sawbird:{family:'project-authored-machine-sawbird',kind:'sawbird',w:220,h:180,displayHeight:164,contact:2,frames:[6,8,6,4,6]},
  enemy_ch4_magnet_spider:{family:'project-authored-machine-magnet-spider',kind:'magnetspider',w:240,h:190,displayHeight:176,contact:3,frames:[6,8,7,4,6]},
  enemy_ch4_railworm:{family:'project-authored-machine-rail-artillery',kind:'railworm',w:360,h:210,displayHeight:194,contact:6,frames:[6,7,9,4,7]},
  enemy_ch4_furnace_golem:{family:'project-authored-machine-furnace-golem',kind:'furnace',w:300,h:280,displayHeight:258,contact:4,frames:[7,8,8,4,8]},
  enemy_ch4_folded_soldier:{family:'project-authored-anomaly-folded-form',kind:'folded',w:230,h:240,displayHeight:220,contact:2,frames:[6,8,6,4,7]},
  enemy_ch4_error_mass:{family:'project-authored-anomaly-error-mass',kind:'errormass',w:260,h:220,displayHeight:204,contact:2,frames:[7,8,8,4,7]},
  enemy_ch4_void_lens:{family:'project-authored-anomaly-void-lens',kind:'voidlens',w:280,h:240,displayHeight:222,contact:5,frames:[7,8,8,4,7]},
  enemy_ch4_fusion_cavalry:{family:'project-authored-machine-anomaly-fusion',kind:'fusioncavalry',w:320,h:250,displayHeight:230,contact:2,frames:[7,8,7,4,8]},
  boss_ch4_moving_throne:{family:'project-authored-machine-throne-boss',kind:'throne',w:410,h:330,displayHeight:300,contact:5,frames:[8,8,9,4,8]},
  boss_ch4_zero_engine:{family:'project-authored-machine-anomaly-zero-engine',kind:'zeroengine',w:420,h:340,displayHeight:310,contact:4,frames:[8,8,11,4,9]},
};

const contract=JSON.parse(await readFile(contractPath,'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)throw new Error('chapter-four lifecycle drifted before human review');
if(contract.generativeAiUsed!==false||contract.sourcePolicy!=='PROJECT_AUTHORED_DETERMINISTIC_ONLY')throw new Error('chapter-four source policy drifted');

function assembleHorizontal(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function phase(i,n){return i/Math.max(1,n-1);}
function bob(m,i){return m==='move'?(i%2?-3:2):m==='idle'?(i%3===1?-1:0):0;}
function shift(spec,m,i,n){const t=phase(i,n);return{dx:m==='attack'&&i===spec.contact?8:m==='knockback'?-Math.round(t*14):0,dy:bob(m,i)+(m==='death'?Math.round(t*28):0),t};}
function gear(out,w,h,cx,cy,r,teeth,fill,edge,rot=0,a=.95){ellipse(out,w,h,cx,cy,r,r,fill,a);for(let k=0;k<teeth;k++){const ang=rot+Math.PI*2*k/teeth,x=cx+Math.cos(ang)*(r+7),y=cy+Math.sin(ang)*(r+7);rect(out,w,h,x-4,y-4,x+4,y+4,edge,.9);}ellipse(out,w,h,cx,cy,Math.max(3,r*.33),Math.max(3,r*.33),edge,.92);}

function drawSawbird(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=103+dx,cy=87+dy;const steel=[84,94,105,255],edge=[35,43,50,255],saw=[187,195,197,255],core=[230,125,64,255];const rot=(m==='move'?i*.35:i*.08)+(m==='attack'?i*.55:0);
  ellipse(out,s.w,s.h,cx,cy,25,17,steel,.98);ellipse(out,s.w,s.h,cx+3,cy,8,7,core,.95);gear(out,s.w,s.h,cx-41,cy-4,29,12,saw,edge,rot);gear(out,s.w,s.h,cx+42,cy-4,29,12,saw,edge,-rot);triangle(out,s.w,s.h,[cx+24,cy-7],[cx+53,cy+2],[cx+24,cy+8],edge,.96);
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));line(out,s.w,s.h,cx+49,cy+2,cx+72+q*24,cy+2,core,4,.55+.3*q);}
  if(m==='death'&&i>=3)line(out,s.w,s.h,cx-60,cy-28,cx+57,cy+33,edge,6,.55);
}
function drawMagnetSpider(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=113+dx,cy=93+dy;const metal=[72,83,96,255],edge=[31,38,47,255],magnet=[173,70,72,255],tip=[199,210,213,255],field=[91,171,209,255];
  ellipse(out,s.w,s.h,cx,cy,34,25,metal,.97);rect(out,s.w,s.h,cx-31,cy-29,cx-10,cy+7,magnet,.96);rect(out,s.w,s.h,cx+10,cy-29,cx+31,cy+7,magnet,.96);ellipse(out,s.w,s.h,cx,cy-28,22,12,edge,.9);rect(out,s.w,s.h,cx-31,cy-36,cx-10,cy-27,tip,.95);rect(out,s.w,s.h,cx+10,cy-36,cx+31,cy-27,tip,.95);
  for(let k=0;k<3;k++)for(const side of [-1,1]){const sy=cy-7+k*12,ex=cx+side*(57+k*7),ey=cy+37+k*9+(m==='move'?(i+k)%2*5:0);line(out,s.w,s.h,cx+side*27,sy,ex,ey,edge,6,.94);ellipse(out,s.w,s.h,ex,ey,8,4,metal,.85);}
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));for(let r=0;r<3;r++)ellipse(out,s.w,s.h,cx,cy-4,54+r*16+q*16,31+r*9+q*8,field,.08+.08*q);if(i>=s.contact)line(out,s.w,s.h,cx+53,cy-4,cx+103,cy-4,field,6,.55);}
  if(m==='death'&&i>=3)rect(out,s.w,s.h,cx-54,cy+39,cx+58,cy+46,edge,.5);
}
function drawRailworm(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=157+dx,cy=126+dy;const rail=[75,86,99,255],dark=[30,38,46,255],glow=[225,114,66,255],coil=[116,154,181,255];
  for(let k=0;k<5;k++){const x=cx-88+k*36,y=cy+12+Math.sin((i+k)*.8)*(m==='move'?4:1);ellipse(out,s.w,s.h,x,y,24,20,rail,.96);ellipse(out,s.w,s.h,x,y,10,8,dark,.9);}rect(out,s.w,s.h,cx-66,cy-20,cx+18,cy+8,rail,.97);rect(out,s.w,s.h,cx-18,cy-42,cx+133,cy-23,dark,.98);rect(out,s.w,s.h,cx+44,cy-47,cx+145,cy-18,rail,.92);ellipse(out,s.w,s.h,cx+143,cy-32,13,12,dark,.98);
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));for(let k=0;k<4;k++)ellipse(out,s.w,s.h,cx+29+k*30,cy-32,7+q*3,9+q*4,coil,.45+.1*q);ellipse(out,s.w,s.h,cx+143,cy-32,8+q*6,7+q*6,glow,.35+.45*q);if(i>=s.contact)line(out,s.w,s.h,cx+149,cy-32,cx+191,cy-32,glow,7,.82);}
  if(m==='death'&&i>=4)line(out,s.w,s.h,cx-105,cy+34,cx+144,cy+41,dark,8,.58);
}
function drawFurnace(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=142+dx,cy=137+dy;const armor=[78,78,74,255],edge=[39,42,40,255],hot=[221,98,45,255],bright=[245,183,74,255],pipe=[116,112,100,255];
  rect(out,s.w,s.h,cx-57,cy-75,cx+57,cy+55,armor,.98);ellipse(out,s.w,s.h,cx,cy-70,57,24,edge,.95);rect(out,s.w,s.h,cx-33,cy-34,cx+33,cy+26,edge,.96);rect(out,s.w,s.h,cx-25,cy-25,cx+25,cy+17,hot,.9);ellipse(out,s.w,s.h,cx,cy-4,15,12,bright,.8);for(const side of [-1,1]){line(out,s.w,s.h,cx+side*49,cy-35,cx+side*83,cy+42,armor,18,.96);line(out,s.w,s.h,cx+side*32,cy+45,cx+side*42,cy+103,edge,20,.98);ellipse(out,s.w,s.h,cx+side*42,cy+105,23,8,armor,.9);}line(out,s.w,s.h,cx-43,cy-76,cx-56,cy-112,pipe,13,.9);line(out,s.w,s.h,cx+40,cy-76,cx+55,cy-108,pipe,13,.9);
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));ellipse(out,s.w,s.h,cx,cy-4,20+q*16,16+q*10,bright,.25+.5*q);if(i>=s.contact)line(out,s.w,s.h,cx+54,cy-1,cx+120,cy+18,hot,12,.72);}
  if(m==='death'&&i>=4)line(out,s.w,s.h,cx-68,cy-65,cx+65,cy+72,edge,10,.55);
}
function drawFolded(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=107+dx,cy=116+dy;const shard=[100,105,125,255],edge=[45,41,59,255],voidc=[84,48,105,255],glitch=[182,94,191,255];const fold=m==='move'?(i%2?10:-8):0;
  triangle(out,s.w,s.h,[cx-19,cy-71],[cx+27+fold,cy-31],[cx-32,cy-4],shard,.95);triangle(out,s.w,s.h,[cx-31,cy-4],[cx+36,cy-31],[cx+13,cy+29],edge,.93);triangle(out,s.w,s.h,[cx+13,cy+29],[cx-39-fold,cy+58],[cx+27,cy+82],shard,.92);triangle(out,s.w,s.h,[cx-1,cy-84],[cx+20,cy-73],[cx+4,cy-55],voidc,.9);line(out,s.w,s.h,cx-19,cy-30,cx-67-fold,cy+2,edge,9,.93);line(out,s.w,s.h,cx+25,cy+10,cx+72+fold,cy-28,edge,9,.93);line(out,s.w,s.h,cx-13,cy+62,cx-41-fold,cy+105,edge,9,.93);line(out,s.w,s.h,cx+19,cy+67,cx+45+fold,cy+104,edge,9,.93);
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));line(out,s.w,s.h,cx+35,cy-24,cx+80+q*33,cy-54+q*38,glitch,7,.5+.3*q);if(i>=s.contact)triangle(out,s.w,s.h,[cx+91,cy-24],[cx+128,cy-1],[cx+89,cy+11],voidc,.65);}
  if(m==='death'&&i>=3){line(out,s.w,s.h,cx-75,cy-44,cx+69,cy+81,glitch,4,.45);line(out,s.w,s.h,cx+52,cy-67,cx-54,cy+90,glitch,4,.4);}
}
function drawErrorMass(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=121+dx,cy=108+dy;const dark=[47,39,61,255],a=[104,71,139,255],b=[71,126,147,255],c=[165,75,117,255],core=[227,193,222,255];const jitter=m==='move'?(i%2?5:-4):0;
  const pieces=[[-48,-18,31,24,a],[-11,-44,27,23,b],[31,-29,34,26,c],[-31,24,39,29,b],[20,30,37,31,a],[55,9,25,23,c]];for(let k=0;k<pieces.length;k++){const [ox,oy,rx,ry,col]=pieces[k],jx=((i+k)%3-1)*(m==='attack'?5:2);ellipse(out,s.w,s.h,cx+ox+jx+jitter,cy+oy-jx,rx,ry,col,.75);rect(out,s.w,s.h,cx+ox-rx/2+jx,cy+oy-ry/2,cx+ox+rx/2+jx,cy+oy+ry/2,dark,.35);}ellipse(out,s.w,s.h,cx,cy,19,18,core,.88);
  if(m==='attack'){const hits=[2,3,4,5];for(let k=0;k<hits.length;k++)if(i>=hits[k]){const ang=(k-.8)*.72,x=cx+Math.cos(ang)*83,y=cy+Math.sin(ang)*57;ellipse(out,s.w,s.h,x,y,13+k*2,9+k,core,.28+.1*k);line(out,s.w,s.h,cx,cy,x,y,core,k===3?7:4,.45);}}
  if(m==='death'&&i>=3)for(let k=0;k<5;k++)line(out,s.w,s.h,cx-59+k*26,cy+35,cx-84+k*41,cy+84,dark,5,.45);
}
function drawVoidLens(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=132+dx,cy=112+dy;const rim=[96,107,127,255],glass=[118,157,174,255],voidc=[20,22,31,255],glow=[154,98,188,255];const spin=(m==='move'?i*.12:i*.035)+(m==='attack'?i*.08:0);
  ellipse(out,s.w,s.h,cx,cy,73,73,rim,.3);ellipse(out,s.w,s.h,cx,cy,55,55,glass,.22);ellipse(out,s.w,s.h,cx,cy,30,30,voidc,.98);for(let k=0;k<4;k++){const ang=spin+Math.PI*k/2,x=cx+Math.cos(ang)*62,y=cy+Math.sin(ang)*62;ellipse(out,s.w,s.h,x,y,12,22,rim,.75);}
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));ellipse(out,s.w,s.h,cx,cy,34+q*18,34+q*18,glow,.14+.25*q);if(i>=s.contact){ellipse(out,s.w,s.h,cx+114,cy,28,46,glow,.24);line(out,s.w,s.h,cx+34,cy,cx+139,cy,glass,7,.72);}}
  if(m==='death'&&i>=3)line(out,s.w,s.h,cx-72,cy-68,cx+71,cy+69,rim,7,.55);
}
function drawFusionCavalry(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=145+dx,cy=135+dy;const metal=[69,78,89,255],edge=[30,37,46,255],rift=[127,70,161,255],glow=[191,118,215,255],steel=[151,157,164,255];const stride=m==='move'?(i%2?10:-8):0;
  ellipse(out,s.w,s.h,cx-18,cy,68,34,metal,.97);triangle(out,s.w,s.h,[cx+21,cy-28],[cx+87,cy-9],[cx+35,cy+13],edge,.95);ellipse(out,s.w,s.h,cx-15,cy-5,36,58,rift,.24);ellipse(out,s.w,s.h,cx-15,cy-5,19,42,edge,.85);for(const side of [-1,1]){line(out,s.w,s.h,cx-49,cy+24,cx-70+side*9,cy+78+stride*side,edge,10,.95);line(out,s.w,s.h,cx+11,cy+27,cx+35+side*8,cy+80-stride*side,edge,10,.95);}rect(out,s.w,s.h,cx-3,cy-70,cx+32,cy-13,steel,.92);triangle(out,s.w,s.h,[cx+14,cy-88],[cx+35,cy-66],[cx-1,cy-65],edge,.96);line(out,s.w,s.h,cx+29,cy-47,cx+93,cy-67,steel,8,.94);
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));ellipse(out,s.w,s.h,cx-15,cy-5,39+q*19,61+q*14,glow,.12+.2*q);line(out,s.w,s.h,cx+88,cy-66,cx+122+q*31,cy-66,glow,6,.55+.25*q);}
  if(m==='death'&&i>=4)line(out,s.w,s.h,cx-91,cy+50,cx+96,cy+68,edge,8,.56);
}
function drawThrone(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=194+dx,cy=168+dy;const armor=[74,78,77,255],edge=[34,38,39,255],gold=[175,143,72,255],seat=[84,57,54,255],gun=[123,126,122,255],hot=[219,111,54,255];const roll=m==='move'?i*.18:i*.04;
  rect(out,s.w,s.h,cx-116,cy-59,cx+94,cy+64,armor,.98);rect(out,s.w,s.h,cx-41,cy-120,cx+35,cy+23,seat,.94);triangle(out,s.w,s.h,[cx-47,cy-121],[cx-3,cy-158],[cx+40,cy-121],gold,.94);for(let k=0;k<4;k++)gear(out,s.w,s.h,cx-82+k*56,cy+71,27,10,edge,gold,roll+k*.3,.98);rect(out,s.w,s.h,cx+56,cy-45,cx+154,cy-18,gun,.96);ellipse(out,s.w,s.h,cx+151,cy-31,13,12,edge,.96);for(const x of [cx-95,cx+61]){line(out,s.w,s.h,x,cy+43,x,cy+102,edge,16,.96);rect(out,s.w,s.h,x-24,cy+93,x+24,cy+111,gold,.92);}
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));ellipse(out,s.w,s.h,cx+151,cy-31,8+q*8,8+q*8,hot,.3+.45*q);if(i>=s.contact)line(out,s.w,s.h,cx+160,cy-31,cx+199,cy-31,hot,8,.8);if(i>=Math.max(1,s.contact-2)){const press=Math.max(0,(i-(s.contact-2))/3);rect(out,s.w,s.h,cx-116,cy+62,cx+82,cy+75+press*18,edge,.38);}}
  if(m==='death'&&i>=4)line(out,s.w,s.h,cx-132,cy-76,cx+126,cy+93,edge,11,.58);
}
function drawZeroEngine(out,s,m,i,n){const {dx,dy}=shift(s,m,i,n),cx=202+dx,cy=165+dy;const machine=[66,72,82,255],edge=[26,30,38,255],rift=[100,57,134,255],glow=[191,119,220,255],core=[14,15,22,255],white=[222,220,231,255];const spin=(m==='move'?i*.09:i*.025)+(m==='attack'?i*.16:0);
  ellipse(out,s.w,s.h,cx,cy,116,116,machine,.22);for(let r=0;r<3;r++){const rx=54+r*29,ry=54+r*29;ellipse(out,s.w,s.h,cx,cy,rx,ry,r===1?rift:machine,.18+.08*r);}for(let k=0;k<8;k++){const a=spin+Math.PI*2*k/8,x=cx+Math.cos(a)*108,y=cy+Math.sin(a)*108;rect(out,s.w,s.h,x-9,y-15,x+9,y+15,machine,.92);}ellipse(out,s.w,s.h,cx,cy,35,35,core,.99);ellipse(out,s.w,s.h,cx,cy,12,12,glow,.88);
  if(m==='attack'){
    if(i<=4){const q=i/4;for(let r=0;r<3;r++)ellipse(out,s.w,s.h,cx,cy,96-r*20-q*(18+r*7),96-r*20-q*(18+r*7),glow,.12+.09*q);if(i===4)for(let k=0;k<3;k++)ellipse(out,s.w,s.h,cx,cy,48+k*34,48+k*34,white,.13);}
    else if(i<=7){const q=(i-5)/2;for(let k=0;k<4;k++){const a=Math.PI*2*k/4+spin,x1=cx+Math.cos(a)*47,y1=cy+Math.sin(a)*47,x2=cx+Math.cos(a)*(96+q*35),y2=cy+Math.sin(a)*(96+q*35);line(out,s.w,s.h,x1,y1,x2,y2,rift,8,.52);}}
    else{const q=(i-8)/2;for(let k=0;k<6;k++){const y=cy-60+k*24+((i+k)%2?5:-5);line(out,s.w,s.h,cx-108,y,cx+108,y+(k%2?9:-9),glow,k%2?4:6,.28+.12*q);}}
  }
  if(m==='death'&&i>=4){for(let k=0;k<8;k++){const a=Math.PI*2*k/8;line(out,s.w,s.h,cx+Math.cos(a)*38,cy+Math.sin(a)*38,cx+Math.cos(a)*(128+i*5),cy+Math.sin(a)*(128+i*5),edge,6,.45);}}
}

const DRAW={sawbird:drawSawbird,magnetspider:drawMagnetSpider,railworm:drawRailworm,furnace:drawFurnace,folded:drawFolded,errormass:drawErrorMass,voidlens:drawVoidLens,fusioncavalry:drawFusionCavalry,throne:drawThrone,zeroengine:drawZeroEngine};
const metadata={schemaVersion:2,batchId:BATCH,generator:'tools/materialize-chapter-04-production-art.mjs',generatorVersion:GENERATOR_VERSION,status:'UNREVIEWED_RUNTIME_FILES',humanReview:'PENDING',normalRuntimeAuthoritative:false,generativeAiUsed:false,sourcePolicy:'PROJECT_AUTHORED_DETERMINISTIC_ONLY',targets:{}};
for(const [unitId,spec] of Object.entries(TARGETS)){
  const dir=resolve(outputRoot,unitId);await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  const meta={assetId:`unit:${unitId}`,sourceFamily:spec.family,projectAuthoredDeterministic:true,structuralRework:false,reviewStatus:'UNREVIEWED_RUNTIME_FILES',frameWidth:spec.w,frameHeight:spec.h,displayHeight:spec.displayHeight,attackContactFrame:spec.contact,motions:{}};
  for(let mi=0;mi<MOTIONS.length;mi++){
    const motion=MOTIONS[mi],count=spec.frames[mi],frames=[];
    for(let i=0;i<count;i++){const out=Buffer.alloc(spec.w*spec.h*4);DRAW[spec.kind](out,spec,motion,i,count);frames.push(out);}
    const strip=assembleHorizontal(frames,spec.w,spec.h),png=encodePng(spec.w*count,spec.h,strip),path=resolve(dir,`${motion}.png`);await writeFile(path,png);meta.motions[motion]={frames:count,bytes:png.length,sha256:sha256(png)};
  }
  metadata.targets[unitId]=meta;
}
await mkdir(outputRoot,{recursive:true});await writeFile(resolve(outputRoot,'chapter-04-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[chapter-04-production] materialized ${Object.keys(TARGETS).length} targets / ${Object.keys(TARGETS).length*MOTIONS.length} motion strips`);
