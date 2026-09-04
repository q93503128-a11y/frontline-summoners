import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ellipse, encodePng, line, rect, sha256, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputRoot=resolve(root,'apps/client/public/assets/production/units');
const contractPath=resolve(root,'assets/raw/production/chapter-03-production-01.json');
const BATCH='chapter-03-production-01';
const GENERATOR_VERSION=1;
const MOTIONS=['idle','move','attack','knockback','death'];

const TARGETS={
  enemy_ch3_glasseye:{family:'project-authored-arcane-eye',kind:'glasseye',w:210,h:200,displayHeight:182,contact:3,frames:[6,8,7,4,6]},
  enemy_ch3_spellbug:{family:'project-authored-arcane-insect',kind:'spellbug',w:180,h:150,displayHeight:142,contact:1,frames:[6,8,5,4,6]},
  enemy_ch3_floating_library:{family:'project-authored-arcane-floating-structure',kind:'library',w:300,h:240,displayHeight:222,contact:5,frames:[7,8,8,4,7]},
  enemy_ch3_inkdemon:{family:'project-authored-demon-ink',kind:'inkdemon',w:210,h:160,displayHeight:154,contact:3,frames:[6,8,7,4,6]},
  enemy_ch3_chain_demon:{family:'project-authored-demon-chain',kind:'chaindemon',w:260,h:230,displayHeight:214,contact:4,frames:[6,8,8,4,7]},
  enemy_ch3_contract_enforcer:{family:'project-authored-demon-contract-armor',kind:'enforcer',w:270,h:250,displayHeight:232,contact:3,frames:[7,8,7,4,8]},
  enemy_ch3_arcane_battery:{family:'project-authored-arcane-structure',kind:'battery',w:330,h:240,displayHeight:218,contact:5,frames:[6,8,8,4,7]},
  enemy_ch3_torn_mirror:{family:'project-authored-arcane-demon-mirror',kind:'mirror',w:280,h:250,displayHeight:226,contact:3,frames:[7,8,8,4,7]},
  boss_ch3_archmagus:{family:'project-authored-arcane-boss',kind:'archmagus',w:380,h:320,displayHeight:296,contact:6,frames:[8,8,9,4,8]},
  boss_ch3_belzar:{family:'project-authored-demon-boss',kind:'belzar',w:360,h:310,displayHeight:288,contact:4,frames:[8,8,8,4,8]},
};

const contract=JSON.parse(await readFile(contractPath,'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)throw new Error('chapter-three lifecycle drifted before human review');
if(contract.generativeAiUsed!==false||contract.sourcePolicy!=='PROJECT_AUTHORED_DETERMINISTIC_ONLY')throw new Error('chapter-three source policy drifted');

function assembleHorizontal(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function p(i,n){return i/Math.max(1,n-1);}function bob(m,i){return m==='move'?(i%2?-3:2):m==='idle'?(i%3===1?-1:0):0;}
function shift(spec,m,i,n){const t=p(i,n);return{dx:m==='attack'&&i===spec.contact?8:m==='knockback'?-Math.round(t*14):0,dy:bob(m,i)+(m==='death'?Math.round(t*30):0),t};}

function drawGlassEye(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=103+dx,cy=91+dy;const glass=[147,211,229,255],rim=[74,107,133,255],iris=[95,76,180,255],dark=[31,37,54,255],spark=[220,241,255,255];
  ellipse(out,s.w,s.h,cx,cy,42,33,rim,.94);ellipse(out,s.w,s.h,cx,cy,33,25,glass,.78);ellipse(out,s.w,s.h,cx+7,cy,13,17,iris,.95);ellipse(out,s.w,s.h,cx+10,cy-4,4,6,dark,.98);ellipse(out,s.w,s.h,cx+4,cy-9,3,3,spark,.9);
  for(let k=0;k<3;k++){const x=cx-26+k*26;line(out,s.w,s.h,x,cy+27,x+(k-1)*13,cy+75,dark,5,.92);ellipse(out,s.w,s.h,x+(k-1)*13,cy+75,6,3,rim,.85);}
  if(m==='attack'){const charge=Math.min(1,i/Math.max(1,s.contact));ellipse(out,s.w,s.h,cx+48+charge*15,cy,7+charge*5,7+charge*5,iris,.35+.4*charge);if(i>=s.contact)line(out,s.w,s.h,cx+50,cy,cx+96,cy,spark,4,.8);}
  if(m==='death'&&i>=3)line(out,s.w,s.h,cx-34,cy-26,cx+30,cy+29,dark,4,.7);
}
function drawSpellBug(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=82+dx,cy=91+dy;const shell=[92,72,126,255],paper=[220,210,180,255],ink=[48,43,62,255],tooth=[231,226,201,255];
  ellipse(out,s.w,s.h,cx,cy,29,20,shell,.96);ellipse(out,s.w,s.h,cx+25,cy-2,18,15,ink,.96);triangle(out,s.w,s.h,[cx+33,cy-7],[cx+53,cy-1],[cx+34,cy+3],tooth,.95);triangle(out,s.w,s.h,[cx+34,cy+3],[cx+51,cy+10],[cx+32,cy+10],tooth,.9);
  for(let k=0;k<3;k++){line(out,s.w,s.h,cx-18+k*17,cy+13,cx-28+k*18,cy+37+(k%2?5:0),ink,4,.9);}
  rect(out,s.w,s.h,cx-34,cy-25,cx+4,cy-12,paper,.9);line(out,s.w,s.h,cx-30,cy-21,cx-3,cy-17,ink,2,.5);
  if(m==='attack'&&i>=s.contact){ellipse(out,s.w,s.h,cx+51,cy+3,8,5,[174,116,201,255],.55);}
  if(m==='move')line(out,s.w,s.h,cx-42,cy+4,cx-60-(i%2)*5,cy+7,ink,3,.35);if(m==='death'&&i>=3)rect(out,s.w,s.h,cx-30,cy+17,cx+34,cy+22,ink,.55);
}
function drawLibrary(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=147+dx,cy=116+dy;const wood=[102,76,68,255],edge=[47,48,61,255],page=[214,207,190,255],arc=[116,153,210,255],seat=[73,63,73,255];const spin=(m==='move'?i*.15:i*.04)+(m==='attack'?i*.09:0);
  ellipse(out,s.w,s.h,cx,cy,25,15,seat,.7);rect(out,s.w,s.h,cx-18,cy-5,cx+18,cy+20,seat,.9);
  for(let k=0;k<6;k++){const a=spin+Math.PI*2*k/6,x=cx+Math.cos(a)*82,y=cy+Math.sin(a)*55;rect(out,s.w,s.h,x-18,y-31,x+18,y+31,wood,.92);line(out,s.w,s.h,x-13,y-16,x+13,y-16,page,3,.8);line(out,s.w,s.h,x-13,y,x+13,y,page,3,.8);line(out,s.w,s.h,x-13,y+16,x+13,y+16,page,3,.8);}
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));ellipse(out,s.w,s.h,cx,cy,46+q*18,28+q*10,arc,.18+.22*q);if(i>=s.contact)for(let k=0;k<5;k++)triangle(out,s.w,s.h,[cx+52+k*18,cy-18+k*5],[cx+68+k*18,cy-12+k*5],[cx+55+k*18,cy-4+k*5],page,.85);}
  if(m==='death'&&i>=4)line(out,s.w,s.h,cx-95,cy-48,cx+91,cy+58,edge,6,.45);
}
function drawInkDemon(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=99+dx,cy=113+dy;const ink=[35,31,48,255],shine=[90,72,118,255],eye=[191,112,173,255];
  ellipse(out,s.w,s.h,cx,cy+18,65,18,ink,.92);ellipse(out,s.w,s.h,cx-10,cy,30,31,ink,.96);triangle(out,s.w,s.h,[cx-29,cy-22],[cx-42,cy-51],[cx-14,cy-31],ink,.97);triangle(out,s.w,s.h,[cx+6,cy-23],[cx+25,cy-48],[cx+24,cy-13],ink,.97);ellipse(out,s.w,s.h,cx-16,cy-4,4,3,eye,.9);ellipse(out,s.w,s.h,cx+4,cy-5,4,3,eye,.9);
  const reach=m==='attack'?35+Math.min(i,s.contact)*10:31;line(out,s.w,s.h,cx-24,cy+4,cx-reach,cy-10+(i%2)*7,ink,10,.92);line(out,s.w,s.h,cx+16,cy+4,cx+reach,cy-8-(i%2)*5,ink,10,.92);
  if(m==='attack'&&i>=2){for(let k=0;k<3;k++)ellipse(out,s.w,s.h,cx+38+k*13,cy-4+k*5,7,4,shine,.35);}
  if(m==='death'&&i>=3)ellipse(out,s.w,s.h,cx,cy+27,82,11,ink,.65);
}
function drawChainDemon(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=118+dx,cy=112+dy;const skin=[109,62,81,255],bone=[179,151,144,255],chain=[113,119,127,255],dark=[46,38,48,255];
  ellipse(out,s.w,s.h,cx,cy,24,45,skin,.96);ellipse(out,s.w,s.h,cx,cy-49,18,19,skin,.96);triangle(out,s.w,s.h,[cx-15,cy-61],[cx-28,cy-84],[cx-4,cy-66],bone,.9);triangle(out,s.w,s.h,[cx+13,cy-61],[cx+29,cy-82],[cx+5,cy-65],bone,.9);line(out,s.w,s.h,cx-11,cy+38,cx-17,cy+87,dark,7,.9);line(out,s.w,s.h,cx+10,cy+38,cx+18,cy+87,dark,7,.9);
  const reach=m==='attack'?54+Math.min(i,s.contact)*13:57;for(const side of [-1,1]){const sx=cx+side*18,ex=cx+side*reach,ey=cy-7+(i%2)*5;line(out,s.w,s.h,sx,cy-21,ex,ey,chain,5,.94);ellipse(out,s.w,s.h,ex,ey,12,16,chain,.55);ellipse(out,s.w,s.h,ex,ey,6,10,dark,.9);}
  if(m==='attack'&&i===s.contact)line(out,s.w,s.h,cx+62,cy-5,cx+119,cy-15,chain,4,.65);if(m==='death'&&i>=4)line(out,s.w,s.h,cx-36,cy+68,cx+45,cy+75,dark,6,.5);
}
function drawEnforcer(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=130+dx,cy=122+dy;const paper=[182,164,137,255],edge=[74,57,56,255],seal=[135,45,55,255],body=[66,52,61,255],metal=[119,105,102,255];
  ellipse(out,s.w,s.h,cx,cy+7,38,52,body,.98);ellipse(out,s.w,s.h,cx,cy-51,20,21,body,.98);rect(out,s.w,s.h,cx-53,cy-48,cx-23,cy+48,paper,.96);rect(out,s.w,s.h,cx+24,cy-48,cx+54,cy+48,paper,.96);line(out,s.w,s.h,cx-51,cy-43,cx-26,cy+40,edge,4,.7);line(out,s.w,s.h,cx+51,cy-43,cx+27,cy+40,edge,4,.7);ellipse(out,s.w,s.h,cx-38,cy+4,8,8,seal,.9);ellipse(out,s.w,s.h,cx+39,cy+4,8,8,seal,.9);line(out,s.w,s.h,cx-18,cy+45,cx-24,cy+95,metal,9,.92);line(out,s.w,s.h,cx+18,cy+45,cx+25,cy+95,metal,9,.92);
  const slam=m==='attack'?Math.min(1,i/Math.max(1,s.contact)):0;line(out,s.w,s.h,cx+34,cy-24,cx+72+slam*26,cy-5+slam*24,edge,10,.95);rect(out,s.w,s.h,cx+67+slam*26,cy-20+slam*24,cx+94+slam*26,cy+16+slam*24,paper,.9);
  if(m==='death'&&i>=4)line(out,s.w,s.h,cx-57,cy+50,cx+58,cy+59,edge,7,.55);
}
function drawBattery(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=151+dx,cy=126+dy;const metal=[75,81,101,255],arc=[111,169,225,255],core=[189,218,244,255],dark=[37,41,53,255];
  ellipse(out,s.w,s.h,cx,cy,43,28,metal,.96);for(let k=0;k<4;k++){const side=k<2?-1:1,x=cx+side*(30+(k%2)*20);line(out,s.w,s.h,x,cy+13,x+side*20,cy+69+(k%2)*8,dark,8,.92);ellipse(out,s.w,s.h,x+side*20,cy+70+(k%2)*8,10,5,metal,.85);}
  const q=m==='attack'?Math.min(1,i/Math.max(1,s.contact)):0;for(let r=0;r<3;r++)ellipse(out,s.w,s.h,cx+4,cy-28,35+r*18+q*8,15+r*8,arc,.16+.08*r);rect(out,s.w,s.h,cx-8,cy-89,cx+14,cy-29,metal,.95);ellipse(out,s.w,s.h,cx+3,cy-91,20+q*9,12+q*5,core,.8);
  if(m==='attack'&&i>=s.contact)line(out,s.w,s.h,cx+18,cy-91,cx+155,cy-91,core,7,.8);if(m==='death'&&i>=4)line(out,s.w,s.h,cx-64,cy+20,cx+70,cy+43,dark,7,.6);
}
function drawMirror(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=132+dx,cy=116+dy;const glass=[166,205,222,255],edge=[71,86,112,255],voidc=[74,47,92,255],spark=[227,242,247,255];const drift=m==='move'?i*.12:m==='attack'?i*.08:0;
  const shards=[[0,-58,20,34],[-35,-20,18,30],[32,-18,20,32],[-22,29,17,29],[24,31,18,28],[0,64,15,25]];
  for(let k=0;k<shards.length;k++){const [ox,oy,rx,ry]=shards[k],a=drift+(k%2?-.08:.08),x=cx+ox+Math.sin(a+k)*5,y=cy+oy+Math.cos(a+k)*4;triangle(out,s.w,s.h,[x-rx,y+ry],[x,y-ry],[x+rx,y+ry*.5],glass,.82);line(out,s.w,s.h,x-rx,y+ry,x,y-ry,edge,3,.8);}
  ellipse(out,s.w,s.h,cx,cy,16,22,voidc,.55);
  if(m==='attack'){const q=Math.min(1,i/Math.max(1,s.contact));ellipse(out,s.w,s.h,cx+84,cy-8,17+q*12,27+q*10,glass,.35+.25*q);if(i>=s.contact)line(out,s.w,s.h,cx+33,cy,cx+118,cy-10,spark,4,.75);if(i>=s.contact+1)line(out,s.w,s.h,cx-30,cy+5,cx-111,cy+19,voidc,5,.6);}
  if(m==='death'&&i>=3)for(let k=0;k<4;k++)line(out,s.w,s.h,cx-45+k*28,cy+28,cx-70+k*36,cy+73,edge,3,.5);
}
function drawArchmagus(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=183+dx,cy=154+dy;const arc=[101,142,223,255],core=[208,226,255,255],spire=[65,72,107,255],voidc=[39,38,63,255],gold=[198,169,96,255];const spin=(m==='move'?i*.07:i*.02);
  ellipse(out,s.w,s.h,cx,cy,42,54,voidc,.9);ellipse(out,s.w,s.h,cx,cy-15,21,25,core,.7);ellipse(out,s.w,s.h,cx,cy,67,38,arc,.16);
  const lit=m==='attack'?Math.min(7,Math.floor((i/Math.max(1,s.contact))*7)):0;for(let k=0;k<7;k++){const a=spin+Math.PI*2*k/7,x=cx+Math.cos(a)*106,y=cy+Math.sin(a)*72;triangle(out,s.w,s.h,[x-13,y+32],[x,y-38],[x+13,y+32],spire,.96);ellipse(out,s.w,s.h,x,y-24,6+(k<lit?5:0),6+(k<lit?5:0),k<lit?core:gold,k<lit?.85:.55);}
  if(m==='attack'&&i>=s.contact){line(out,s.w,s.h,cx+55,cy-17,cx+177,cy-17,core,7,.82);if(i>s.contact)line(out,s.w,s.h,cx+60,cy+18,cx+155,cy+30,arc,4,.7);}
  if(m==='death'&&i>=4)for(let k=0;k<7;k++){const a=Math.PI*2*k/7;line(out,s.w,s.h,cx+Math.cos(a)*65,cy+Math.sin(a)*45,cx+Math.cos(a)*135,cy+Math.sin(a)*98,spire,4,.45);}
}
function drawBelzar(out,s,m,i,n){const {dx,dy,t}=shift(s,m,i,n),cx=169+dx,cy=151+dy;const armor=[86,55,69,255],edge=[154,110,111,255],seal=[191,73,88,255],blade=[185,184,194,255],dark=[43,36,46,255];
  ellipse(out,s.w,s.h,cx,cy,47,63,armor,.98);ellipse(out,s.w,s.h,cx,cy-69,25,27,dark,.98);triangle(out,s.w,s.h,[cx-21,cy-84],[cx-43,cy-115],[cx-8,cy-91],edge,.9);triangle(out,s.w,s.h,[cx+21,cy-84],[cx+46,cy-112],[cx+8,cy-91],edge,.9);rect(out,s.w,s.h,cx-33,cy-34,cx+33,cy+25,[143,121,105,255],.82);ellipse(out,s.w,s.h,cx,cy-5,12,12,seal,.95);line(out,s.w,s.h,cx-25,cy+54,cx-32,cy+118,dark,11,.95);line(out,s.w,s.h,cx+25,cy+54,cx+33,cy+118,dark,11,.95);
  const q=m==='attack'?Math.min(1,i/Math.max(1,s.contact)):0;for(let k=0;k<3;k++){const oy=-34+k*32,reach=64+q*(35+k*9);line(out,s.w,s.h,cx+37,cy+oy,cx+reach,cy+oy-18+k*9,blade,8,.95);triangle(out,s.w,s.h,[cx+reach,cy+oy-24+k*9],[cx+reach+28,cy+oy-18+k*9],[cx+reach,cy+oy-8+k*9],edge,.9);}
  if(m==='attack'&&i>=s.contact)line(out,s.w,s.h,cx+71,cy+28,cx+139,cy+44,seal,5,.6);if(m==='death'&&i>=4)line(out,s.w,s.h,cx-64,cy+72,cx+68,cy+83,dark,8,.55);
}

const DRAW={glasseye:drawGlassEye,spellbug:drawSpellBug,library:drawLibrary,inkdemon:drawInkDemon,chaindemon:drawChainDemon,enforcer:drawEnforcer,battery:drawBattery,mirror:drawMirror,archmagus:drawArchmagus,belzar:drawBelzar};
const metadata={schemaVersion:2,batchId:BATCH,generator:'tools/materialize-chapter-03-production-art.mjs',generatorVersion:GENERATOR_VERSION,status:'UNREVIEWED_RUNTIME_FILES',humanReview:'PENDING',normalRuntimeAuthoritative:false,generativeAiUsed:false,sourcePolicy:'PROJECT_AUTHORED_DETERMINISTIC_ONLY',targets:{}};
for(const [unitId,spec] of Object.entries(TARGETS)){
  const dir=resolve(outputRoot,unitId);await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  const meta={assetId:`unit:${unitId}`,sourceFamily:spec.family,projectAuthoredDeterministic:true,structuralRework:false,reviewStatus:'UNREVIEWED_RUNTIME_FILES',frameWidth:spec.w,frameHeight:spec.h,displayHeight:spec.displayHeight,attackContactFrame:spec.contact,motions:{}};
  for(let mi=0;mi<MOTIONS.length;mi++){
    const motion=MOTIONS[mi],count=spec.frames[mi],frames=[];for(let i=0;i<count;i++){const out=Buffer.alloc(spec.w*spec.h*4);DRAW[spec.kind](out,spec,motion,i,count);frames.push(out);}const strip=assembleHorizontal(frames,spec.w,spec.h),png=encodePng(spec.w*count,spec.h,strip),path=resolve(dir,`${motion}.png`);await writeFile(path,png);meta.motions[motion]={frames:count,bytes:png.length,sha256:sha256(png)};
  }
  metadata.targets[unitId]=meta;
}
await mkdir(outputRoot,{recursive:true});await writeFile(resolve(outputRoot,'chapter-03-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[chapter-03-production] materialized ${Object.keys(TARGETS).length} targets / ${Object.values(TARGETS).reduce((n,s)=>n+s.frames.length,0)} motion families`);
