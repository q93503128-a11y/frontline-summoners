import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blitSource, ellipse, encodePng, fetchPinnedPng, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputRoot=resolve(root,'apps/client/public/assets/production/units');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/fifth-slice-late-wave-05.json'),'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)throw new Error('fifth-slice lifecycle drifted before human review');

const NQM='https://raw.githubusercontent.com/NQM765/IngeSoft1/84594e5d3da7472615660f453bdb457da13cca2f/Proyecto/Scrum%27s_Castle/Assets/Characters';
const MOTIONS=['idle','move','attack','knockback','death'];
const SOURCES={
  'evil-wizard-2':{fw:250,fh:250,counts:{idle:8,move:8,attack:8,knockback:3,death:7},urls:{idle:`${NQM}/EVil%20Wizard%202/Sprites/Idle.png`,move:`${NQM}/EVil%20Wizard%202/Sprites/Run.png`,attack:`${NQM}/EVil%20Wizard%202/Sprites/Attack1.png`,knockback:`${NQM}/EVil%20Wizard%202/Sprites/Take%20hit.png`,death:`${NQM}/EVil%20Wizard%202/Sprites/Death.png`}},
  'evil-wizard':{fw:150,fh:150,counts:{idle:8,move:8,attack:8,knockback:4,death:5},urls:{idle:`${NQM}/Evil%20Wizard/Sprites/Idle.png`,move:`${NQM}/Evil%20Wizard/Sprites/Move.png`,attack:`${NQM}/Evil%20Wizard/Sprites/Attack.png`,knockback:`${NQM}/Evil%20Wizard/Sprites/Take%20Hit.png`,death:`${NQM}/Evil%20Wizard/Sprites/Death.png`}},
};
const TARGETS={
  'heretic/heretic_f1':{assetId:'unit:heretic:heretic_f1',source:'evil-wizard-2',kind:'heretic',form:1,displayHeight:198,contact:5,w:310,h:260,dx:30,dy:5,palette:[78,72,78],counts:[8,8,8,3,7]},
  'heretic/heretic_f2':{assetId:'unit:heretic:heretic_f2',source:'evil-wizard-2',kind:'heretic',form:2,displayHeight:206,contact:5,w:330,h:270,dx:40,dy:8,palette:[70,65,72],counts:[8,8,8,3,7]},
  'heretic/heretic_f3':{assetId:'unit:heretic:heretic_f3',source:'evil-wizard-2',kind:'heretic',form:3,displayHeight:194,contact:5,w:290,h:245,dx:20,dy:0,palette:[85,77,78],counts:[8,8,8,3,7]},
  'enemy-cultist':{assetId:'unit:enemy-cultist',source:'evil-wizard',kind:'cultist',form:1,displayHeight:188,contact:4,w:260,h:200,dx:48,dy:18,palette:[66,60,61],counts:[8,8,8,4,5]},
  'enemy-sprinter':{assetId:'unit:enemy-sprinter',source:'project-authored-beast',kind:'sprinter',form:1,displayHeight:140,contact:2,w:210,h:130,dx:0,dy:0,palette:[91,72,59],counts:[6,8,6,4,6]},
};

const sheets=new Map();
for(const [id,s] of Object.entries(SOURCES)){
  const motions={};
  for(const motion of MOTIONS){const count=s.counts[motion];motions[motion]=(await fetchPinnedPng(s.urls[motion],s.fw*count,s.fh,`${id}/${motion}`)).png;}
  sheets.set(id,motions);
}

function assemble(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const a=y*w*4,b=a+w*4,d=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,d,a,b);}return out;}
function ring(out,w,h,cx,cy,rx,ry,color,alpha){const pts=[];for(let i=0;i<8;i++){const a=Math.PI*2*i/8;pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]);}for(let i=0;i<8;i++)line(out,w,h,pts[i][0],pts[i][1],pts[(i+1)%8][0],pts[(i+1)%8][1],color,3,alpha);line(out,w,h,cx-rx*.65,cy-ry*.55,cx+rx*.58,cy+ry*.68,color,2,alpha*.7);}
function shift(spec,motion,index,count){const p=index/Math.max(1,count-1);if(spec.kind==='heretic'){if(motion==='move')return spec.form===3?{x:index%2?2:-1,y:index%2?1:0}:{x:Math.round(p*2),y:index%2?0:-1};if(motion==='attack')return{x:spec.form===3&&index===spec.contact?7:0,y:index>spec.contact?1:0};if(motion==='knockback')return{x:-Math.round(p*6),y:Math.round(p*2)};if(motion==='death')return{x:0,y:Math.round(p*15)};}if(spec.kind==='cultist'){if(motion==='move')return{x:0,y:index%2?1:0};if(motion==='attack')return{x:index===spec.contact?2:0,y:0};if(motion==='knockback')return{x:-Math.round(p*7),y:Math.round(p*2)};if(motion==='death')return{x:0,y:Math.round(p*14)};}return{x:0,y:0};}
function drawHereticBack(out,spec,motion,index){const ink=[83,69,72,255],pale=[185,170,147,255];if(spec.form===2)ring(out,spec.w,spec.h,140,120,66,61,ink,.58);if(motion==='attack'){const t=Math.max(0,1-Math.abs(index-spec.contact)/Math.max(2,spec.contact)),x=spec.form===3?spec.w-46:spec.w-62;ring(out,spec.w,spec.h,x,108,12+19*t,9+14*t,pale,.25+.5*t);}}
function drawHereticFront(out,spec,motion,index,count){const mask=[207,196,174,255],ink=[55,50,52,255],paper=[184,156,118,255],seal=[121,64,57,255],metal=[118,112,106,255];const p=index/Math.max(1,count-1),cx=spec.form===2?165:145,drop=motion==='death'?Math.round(p*42):0,scatter=motion==='knockback'?Math.round(p*10):0;ellipse(out,spec.w,spec.h,cx-5,62,13,16,mask,.72);rect(out,spec.w,spec.h,cx-17,49,cx-6,74,ink,.88);const n=spec.form===2?4:2;for(let i=0;i<n;i++){const x=cx-37-i*7+(i%2?scatter:-scatter),y=92+i*13+drop;rect(out,spec.w,spec.h,x,y,x+7,y+24,paper,.85);line(out,spec.w,spec.h,x+2,y+7,x+5,y+17,seal,1,.8);}if(spec.form<3){const ex=spec.w-47,ey=spec.form===2?48:60;line(out,spec.w,spec.h,cx+17,111,ex,ey,metal,spec.form===2?5:4,.95);triangle(out,spec.w,spec.h,[ex,ey],[ex-9,ey+17],[ex+7,ey+13],ink,.88);}else{line(out,spec.w,spec.h,cx+10,105,cx+66,75,metal,4,.95);line(out,spec.w,spec.h,cx-3,108,cx+49,139,metal,4,.95);triangle(out,spec.w,spec.h,[cx+66,75],[cx+54,77],[cx+60,87],ink,.9);triangle(out,spec.w,spec.h,[cx+49,139],[cx+38,132],[cx+39,145],ink,.9);}}
function drawCultist(out,spec,motion,index,count){const pole=[84,66,55,255],flag=[39,38,42,255],edge=[133,105,82,255],ritual=[154,129,104,255];const p=index/Math.max(1,count-1),drop=motion==='death'?Math.round(p*35):0;line(out,spec.w,spec.h,105,55+drop,105,168+drop,pole,5,.95);triangle(out,spec.w,spec.h,[107,58+drop],[181,74+drop],[107,101+drop],flag,.96);line(out,spec.w,spec.h,112,65+drop,171,76+drop,edge,2,.65);if(motion==='attack'){const t=Math.max(0,1-Math.abs(index-spec.contact)/Math.max(2,spec.contact));ring(out,spec.w,spec.h,214,133,12+29*t,7+13*t,ritual,.25+.55*t);}}
function drawSprinter(out,spec,motion,index,count){const p=index/Math.max(1,count-1),fur=[104,76,58,255],dark=[56,49,44,255],belly=[141,111,82,255],eye=[216,178,93,255],tooth=[219,207,179,255];let ox=0,oy=0;if(motion==='idle')oy=index%3===1?-1:0;if(motion==='move'){ox=index%2?3:-2;oy=index%2?-2:1;}if(motion==='attack'){ox=index<spec.contact?-2+index*2:index===spec.contact?11:5;oy=index===spec.contact?-1:1;}if(motion==='knockback'){ox=-Math.round(p*15);oy=Math.round(p*3);}if(motion==='death'){ox=-Math.round(p*4);oy=Math.round(p*25);}const cx=104+ox,cy=75+oy;ellipse(out,spec.w,spec.h,cx,cy,43,24,fur,.98);ellipse(out,spec.w,spec.h,cx-5,cy+9,31,13,belly,.42);ellipse(out,spec.w,spec.h,cx+42,cy-10,22,18,fur,.98);triangle(out,spec.w,spec.h,[cx+30,cy-24],[cx+37,cy-43],[cx+47,cy-22],dark,.95);triangle(out,spec.w,spec.h,[cx+43,cy-25],[cx+55,cy-41],[cx+60,cy-17],dark,.92);ellipse(out,spec.w,spec.h,cx+52,cy-13,3,3,eye,.95);triangle(out,spec.w,spec.h,[cx+63,cy-6],[cx+73,cy-2],[cx+63,cy+2],tooth,.9);const stride=motion==='move'?(index%2?10:-10):motion==='attack'?8:0;line(out,spec.w,spec.h,cx-24,cy+17,cx-32-stride*.3,cy+42,dark,6,.95);line(out,spec.w,spec.h,cx+17,cy+17,cx+27+stride*.3,cy+42,dark,6,.95);line(out,spec.w,spec.h,cx-39,cy-3,cx-66-(motion==='move'?index%2*8:0),cy-17,dark,5,.9);if(motion==='attack'&&index===spec.contact){line(out,spec.w,spec.h,cx+55,cy-2,cx+82,cy-2,tooth,2,.7);ellipse(out,spec.w,spec.h,cx+80,cy,9,5,belly,.35);}}

const metadata={schemaVersion:1,sliceId:'fifth-slice-late-wave-05',generatorVersion:1,status:'UNREVIEWED_RUNTIME_FILES',humanReview:'PENDING',reviewer:null,reviewedAt:null,generativeAiUsed:false,normalRuntimeAuthoritative:false,targets:{}};
for(const [targetId,spec] of Object.entries(TARGETS)){
  const dir=resolve(outputRoot,targetId);await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  const t={assetId:spec.assetId,sourceFamily:spec.source,structuralRework:true,reviewStatus:'UNREVIEWED_RUNTIME_FILES',frameWidth:spec.w,frameHeight:spec.h,displayHeight:spec.displayHeight,attackContactFrame:spec.contact,motions:{}};
  for(let mi=0;mi<MOTIONS.length;mi++){
    const motion=MOTIONS[mi],count=spec.counts[mi],rendered=[];
    for(let index=0;index<count;index++){
      const out=Buffer.alloc(spec.w*spec.h*4);
      if(spec.kind==='sprinter')drawSprinter(out,spec,motion,index,count);else{const s=SOURCES[spec.source],sheet=sheets.get(spec.source)[motion],src=sourceFrame(sheet,s.fw,s.fh,Math.min(index,s.counts[motion]-1)),d=shift(spec,motion,index,count);if(spec.kind==='heretic')drawHereticBack(out,spec,motion,index);blitSource(out,spec.w,spec.h,src,s.fw,s.fh,spec.dx,spec.dy,spec.palette,d.x,d.y,spec.kind==='cultist'?.28:.24);if(spec.kind==='heretic')drawHereticFront(out,spec,motion,index,count);if(spec.kind==='cultist')drawCultist(out,spec,motion,index,count);}rendered.push(out);
    }
    const png=encodePng(spec.w*count,spec.h,assemble(rendered,spec.w,spec.h));await writeFile(resolve(dir,`${motion}.png`),png);
    t.motions[motion]={file:`apps/client/public/assets/production/units/${targetId}/${motion}.png`,frames:count,sha256:sha256(png)};
  }
  metadata.targets[targetId]=t;
}
await writeFile(resolve(outputRoot,'fifth-slice-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('[fifth-slice] materialized 5 targets / 25 motion strips');
