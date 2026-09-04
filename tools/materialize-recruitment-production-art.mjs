import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ellipse, encodePng, line, rect, sha256, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputRoot=resolve(root,'apps/client/public/assets/production/units');
const contract=JSON.parse(await readFile(resolve(root,'assets/raw/production/recruitment-production-01.json'),'utf8'));
const roster=JSON.parse(await readFile(resolve(root,'content/units/recruitment-01.json'),'utf8'));
const BATCH='recruitment-production-01';
const GENERATOR_VERSION=1;
const MOTIONS=['idle','move','attack','knockback','death'];

function assert(ok,msg){if(!ok)throw new Error(`[recruitment-production] ${msg}`);}
assert(contract.batchId===BATCH&&contract.scope==='RECRUITMENT_ROSTER','contract identity drift');
assert(contract.status==='AWAITING_ART'&&contract.reviewStatus==='PENDING','contract lifecycle drifted before human review');
assert(contract.normalRuntimeAuthoritative===false&&contract.generativeAiUsed===false,'contract runtime/AI policy drift');
assert(contract.sourcePolicy==='PROJECT_AUTHORED_DETERMINISTIC_ONLY','source policy drift');
assert(contract.reviewRoute==='?productionReview=recruitment','review route drift');
assert(contract.expectedTargetCount===33&&contract.targets.length===33,'expected 33 recruitment targets');
assert(roster.length===33,'canonical recruitment roster count drift');
const targetById=new Map(contract.targets.map((target)=>[target.unitId,target]));
const rosterIds=new Set(roster.map((unit)=>unit.id));
assert(rosterIds.size===33,'canonical recruitment ids must be unique');
for(const unit of roster)assert(targetById.has(unit.id),`canonical recruitment unit missing from contract: ${unit.id}`);
for(const target of contract.targets)assert(rosterIds.has(target.unitId),`contract target absent from canonical roster: ${target.unitId}`);

const FRAME_BY_RARITY={C:[6,8,6,4,6],B:[7,8,7,4,7],A:[7,8,8,4,7],S:[8,8,9,4,8],SS:[8,8,11,4,9]};
function specFor(unit,target){
  const frames=[...FRAME_BY_RARITY[unit.rarity]];
  const giant=unit.combatTags.includes('GIANT'),structure=unit.combatTags.includes('STRUCTURE'),floating=unit.combatTags.includes('FLOATING');
  let w=unit.rarity==='C'?220:unit.rarity==='B'?235:unit.rarity==='A'?255:285;
  let h=unit.rarity==='C'?200:unit.rarity==='B'?220:unit.rarity==='A'?235:255;
  if(unit.seriesId==='series_02_primordial_titans'){w+=45;h+=25;}
  if(unit.seriesId==='series_03_zero_edge'){w+=25;h+=15;}
  if(giant){w+=45;h+=45;}
  if(structure){w+=55;h+=20;}
  if(floating){h+=20;}
  if(unit.rarity==='SS'){w=Math.max(w,350);h=Math.max(h,305);}
  w=Math.min(390,w);h=Math.min(330,h);
  const firstHit=unit.hitFrames[0];
  const activeWindow=Math.max(firstHit+1,unit.cycleFrames-unit.backswingFrames);
  const contact=Math.max(1,Math.min(frames[2]-2,Math.round((firstHit/activeWindow)*(frames[2]-1))));
  return {family:target.sourceFamily,w,h,displayHeight:h-18,contact,frames,role:unit.role,rarity:unit.rarity,seriesId:unit.seriesId,attributes:unit.attributes,tags:unit.combatTags};
}
const SPECS=Object.fromEntries(roster.map((unit)=>[unit.id,specFor(unit,targetById.get(unit.id))]));

function assembleHorizontal(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function phase(i,n){return i/Math.max(1,n-1);}
function seedOf(id){let h=2166136261;for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function shift(spec,m,i,n){const t=phase(i,n);return{dx:m==='attack'&&i===spec.contact?7:m==='knockback'?-Math.round(t*14):0,dy:m==='move'?(i%2?-4:3):m==='idle'?(i%3===1?-2:0):m==='death'?Math.round(t*28):0,t};}
function palette(unit){
  const rarityAccent={C:[158,145,118,255],B:[91,147,185,255],A:[177,122,201,255],S:[229,188,91,255],SS:[247,216,119,255]}[unit.rarity];
  if(unit.seriesId==='series_01_starlight_order')return{dark:[39,43,63,255],mid:[105,113,149,255],light:[221,225,234,255],accent:rarityAccent,glow:[191,214,255,255]};
  if(unit.seriesId==='series_02_primordial_titans')return{dark:[50,50,39,255],mid:[101,105,69,255],light:[176,163,111,255],accent:rarityAccent,glow:[154,204,122,255]};
  if(unit.seriesId==='series_03_zero_edge')return{dark:[31,39,47,255],mid:[76,91,104,255],light:[176,194,202,255],accent:rarityAccent,glow:[92,205,237,255]};
  if(unit.attributes.includes('UNDEAD'))return{dark:[42,43,53,255],mid:[95,86,101,255],light:[177,170,174,255],accent:rarityAccent,glow:[136,205,215,255]};
  if(unit.attributes.includes('NATURE'))return{dark:[48,58,42,255],mid:[99,118,76,255],light:[174,165,110,255],accent:rarityAccent,glow:[144,205,117,255]};
  return{dark:[53,48,44,255],mid:[112,95,79,255],light:[194,176,142,255],accent:rarityAccent,glow:[225,198,125,255]};
}
function archetype(unit){const id=unit.id;if(id.includes('bell_crab'))return'crab';if(id.includes('lantern_moth')||id.includes('ink_raven')||id.includes('paper_dragon'))return'flyer';if(id.includes('moss_golem')||id.includes('meteor_cart')||id.includes('glass_keeper'))return'construct';if(unit.seriesId==='series_02_primordial_titans')return'beast';if(unit.seriesId==='series_03_zero_edge')return'machine';return'humanoid';}
function star(out,w,h,cx,cy,r,col,a=.8){for(let k=0;k<4;k++){const ang=Math.PI*.25+k*Math.PI*.5;triangle(out,w,h,[cx+Math.cos(ang)*r,cy+Math.sin(ang)*r],[cx+Math.cos(ang+2.25)*r*.35,cy+Math.sin(ang+2.25)*r*.35],[cx+Math.cos(ang-2.25)*r*.35,cy+Math.sin(ang-2.25)*r*.35],col,a);}}
function bodyHumanoid(out,s,p,cx,cy,step){ellipse(out,s.w,s.h,cx,cy-51,16,18,p.light,.98);rect(out,s.w,s.h,cx-23,cy-34,cx+25,cy+32,p.mid,.98);triangle(out,s.w,s.h,[cx-26,cy+15],[cx+28,cy+15],[cx+39,cy+58],p.dark,.93);line(out,s.w,s.h,cx-13,cy+29,cx-22-step,cy+77,p.dark,10,.95);line(out,s.w,s.h,cx+14,cy+29,cx+27+step,cy+77,p.dark,10,.95);}
function bodyBeast(out,s,p,cx,cy,step){ellipse(out,s.w,s.h,cx-5,cy+3,62,37,p.mid,.98);ellipse(out,s.w,s.h,cx+55,cy-12,31,26,p.light,.97);triangle(out,s.w,s.h,[cx+57,cy-35],[cx+70,cy-59],[cx+77,cy-31],p.accent,.88);triangle(out,s.w,s.h,[cx+39,cy-33],[cx+43,cy-58],[cx+55,cy-31],p.accent,.88);for(let k=0;k<3;k++)for(const side of [-1,1])line(out,s.w,s.h,cx-35+k*25,cy+28,cx-45+k*29+side*step,cy+76+(k%2)*4,p.dark,8,.95);line(out,s.w,s.h,cx-61,cy,cx-92-step*2,cy-20,p.dark,9,.92);}
function bodyMachine(out,s,p,cx,cy,step){rect(out,s.w,s.h,cx-45,cy-43,cx+48,cy+35,p.mid,.98);ellipse(out,s.w,s.h,cx,cy-5,18,18,p.glow,.8);rect(out,s.w,s.h,cx-33,cy-67,cx+31,cy-39,p.light,.94);for(const side of [-1,1]){line(out,s.w,s.h,cx+side*37,cy-20,cx+side*(68+step),cy+18,p.dark,10,.96);line(out,s.w,s.h,cx+side*24,cy+31,cx+side*(31+step),cy+78,p.dark,12,.96);}rect(out,s.w,s.h,cx-60,cy-25,cx-48,cy+18,p.accent,.8);rect(out,s.w,s.h,cx+49,cy-25,cx+61,cy+18,p.accent,.8);}
function bodyConstruct(out,s,p,cx,cy,step){rect(out,s.w,s.h,cx-58,cy-53,cx+58,cy+46,p.mid,.98);rect(out,s.w,s.h,cx-42,cy-38,cx+42,cy+26,p.dark,.92);ellipse(out,s.w,s.h,cx,cy-5,18,15,p.glow,.72);for(const side of [-1,1]){line(out,s.w,s.h,cx+side*48,cy+24,cx+side*(74+step),cy+69,p.dark,14,.95);ellipse(out,s.w,s.h,cx+side*(76+step),cy+72,19,8,p.light,.88);}}
function bodyCrab(out,s,p,cx,cy,step){ellipse(out,s.w,s.h,cx,cy+11,54,30,p.mid,.98);ellipse(out,s.w,s.h,cx,cy-8,37,27,p.light,.92);for(let k=0;k<3;k++)for(const side of [-1,1])line(out,s.w,s.h,cx+side*(23+k*9),cy+20,cx+side*(65+k*8),cy+55+(k%2?8:0)+step,p.dark,7,.96);line(out,s.w,s.h,cx-46,cy-6,cx-74,cy-28,p.dark,9,.95);line(out,s.w,s.h,cx+46,cy-6,cx+74,cy-28,p.dark,9,.95);}
function bodyFlyer(out,s,p,cx,cy,step,id){ellipse(out,s.w,s.h,cx,cy,25,35,p.mid,.96);triangle(out,s.w,s.h,[cx-15,cy-10],[cx-82-step,cy-43],[cx-52,cy+33],p.light,.76);triangle(out,s.w,s.h,[cx+15,cy-10],[cx+82+step,cy-43],[cx+52,cy+33],p.light,.76);ellipse(out,s.w,s.h,cx,cy+23,12,16,p.glow,.72);if(id.includes('raven')){for(let k=0;k<4;k++)triangle(out,s.w,s.h,[cx-64+k*36,cy-8+(k%2)*10],[cx-44+k*36,cy-30],[cx-29+k*36,cy+2],p.dark,.86);}if(id.includes('paper_dragon')){triangle(out,s.w,s.h,[cx+15,cy-32],[cx+61,cy-12],[cx+22,cy+7],p.accent,.78);}}
function decorate(out,unit,s,p,cx,cy,step,i){const id=unit.id;
  if(id.includes('turnip_rider')){ellipse(out,s.w,s.h,cx-4,cy+43,55,39,[135,105,143,255],.96);triangle(out,s.w,s.h,[cx-25,cy+9],[cx-8,cy-26],[cx+2,cy+12],[83,127,66,255],.9);triangle(out,s.w,s.h,[cx+3,cy+8],[cx+20,cy-23],[cx+29,cy+14],[83,127,66,255],.9);}
  if(id.includes('tin_squire')||id.includes('rxomega'))rect(out,s.w,s.h,cx-73,cy-45,cx-25,cy+52,p.light,.96);
  if(id.includes('slinger')){line(out,s.w,s.h,cx+22,cy-16,cx+67,cy-48,p.dark,4,.95);ellipse(out,s.w,s.h,cx+70,cy-51,7,7,p.accent,.9);}
  if(id.includes('bell_crab')){ellipse(out,s.w,s.h,cx,cy-10,44,42,p.light,.9);rect(out,s.w,s.h,cx-5,cy-55,cx+5,cy-37,p.accent,.9);}
  if(id.includes('lantern_moth'))ellipse(out,s.w,s.h,cx,cy+28,19,24,p.glow,.92);
  if(id.includes('lantern_witch')){ellipse(out,s.w,s.h,cx+54,cy+12,18,22,p.glow,.8);line(out,s.w,s.h,cx+29,cy-8,cx+54,cy-10,p.dark,4,.9);}
  if(id.includes('clockduck')){ellipse(out,s.w,s.h,cx+4,cy-50,22,18,p.light,.95);triangle(out,s.w,s.h,[cx+22,cy-53],[cx+44,cy-45],[cx+21,cy-40],p.accent,.9);line(out,s.w,s.h,cx-35,cy-27,cx-61,cy-49,p.dark,5,.95);line(out,s.w,s.h,cx-61,cy-49,cx-72,cy-36,p.dark,5,.95);}
  if(id.includes('coffin_merchant'))rect(out,s.w,s.h,cx-65,cy-65,cx-25,cy+57,p.dark,.92);
  if(id.includes('moss_golem'))for(let k=0;k<5;k++)ellipse(out,s.w,s.h,cx-42+k*18,cy-51+(k%2)*27,12,8,[77,123,70,255],.78);
  if(id.includes('glass_keeper')){rect(out,s.w,s.h,cx-17,cy-82,cx+18,cy+36,p.light,.68);ellipse(out,s.w,s.h,cx,cy-67,25,18,p.glow,.55);}
  if(id.includes('bonedrum'))ellipse(out,s.w,s.h,cx+35,cy+12,42,50,p.light,.88);
  if(id.includes('meteor_cart')){ellipse(out,s.w,s.h,cx-47,cy+59,18,18,p.dark,.96);ellipse(out,s.w,s.h,cx+47,cy+59,18,18,p.dark,.96);line(out,s.w,s.h,cx-20,cy-32,cx+50,cy-80,p.accent,12,.88);}
  if(id.includes('mirror_guide'))for(let k=0;k<3;k++){const a=(i*.18)+k*2.1;ellipse(out,s.w,s.h,cx+Math.cos(a)*63,cy-4+Math.sin(a)*37,15,22,p.glow,.42);}
  if(unit.seriesId==='series_01_starlight_order')star(out,s.w,s.h,cx,cy-20,unit.rarity==='SS'?42:24,p.accent,.48);
  if(unit.seriesId==='series_02_primordial_titans'){for(let k=0;k<3;k++)triangle(out,s.w,s.h,[cx-38+k*32,cy-31],[cx-25+k*32,cy-66-(k%2)*8],[cx-11+k*32,cy-30],p.accent,.72);}
  if(unit.seriesId==='series_03_zero_edge'){ellipse(out,s.w,s.h,cx,cy-4,13,13,p.glow,.9);for(const side of [-1,1])rect(out,s.w,s.h,cx+side*54-5,cy-37,cx+side*54+5,cy+13,p.accent,.82);}
  if(id.includes('elsia'))line(out,s.w,s.h,cx+17,cy-15,cx+105,cy-19,p.light,7,.97);
  if(id.includes('riena')){line(out,s.w,s.h,cx+18,cy-10,cx+72,cy-52,p.dark,10,.96);ellipse(out,s.w,s.h,cx+78,cy-58,26,24,p.light,.95);}
  if(id.includes('mireille')){line(out,s.w,s.h,cx+35,cy-45,cx+83,cy-3,p.glow,5,.9);line(out,s.w,s.h,cx+35,cy+39,cx+83,cy-3,p.glow,5,.9);line(out,s.w,s.h,cx+35,cy-45,cx+35,cy+39,p.light,4,.8);}
  if(id.includes('neria'))rect(out,s.w,s.h,cx-50,cy-47,cx-18,cy+40,p.dark,.96);
  if(id.includes('totoria')){ellipse(out,s.w,s.h,cx+78,cy+4,28,43,p.light,.86);line(out,s.w,s.h,cx+19,cy-42,cx+69,cy-34,p.glow,2,.55);line(out,s.w,s.h,cx+20,cy-22,cx+66,cy-7,p.glow,2,.55);}
  if(id.includes('arselia'))for(let k=0;k<4;k++){const a=i*.12+k*Math.PI*.5;star(out,s.w,s.h,cx+Math.cos(a)*70,cy+Math.sin(a)*43,13,p.glow,.6);}
  if(id.includes('zirka'))line(out,s.w,s.h,cx-50,cy+3,cx-105,cy-34,p.accent,13,.95);
  if(id.includes('mogu'))ellipse(out,s.w,s.h,cx,cy-48,68,43,p.light,.92);
  if(id.includes('gardo')){ellipse(out,s.w,s.h,cx+55,cy-3,55,39,p.dark,.94);for(let k=0;k<5;k++)triangle(out,s.w,s.h,[cx+26+k*15,cy-30],[cx+34+k*15,cy-8],[cx+42+k*15,cy-30],p.light,.9);}
  if(id.includes('kreik'))for(let k=0;k<3;k++)triangle(out,s.w,s.h,[cx-25+k*25,cy-34],[cx-14+k*25,cy-82-(k%2)*10],[cx-4+k*25,cy-34],p.glow,.8);
  if(id.includes('gormu')){rect(out,s.w,s.h,cx-67,cy-95,cx+49,cy-32,p.dark,.88);triangle(out,s.w,s.h,[cx-57,cy-95],[cx-5,cy-145],[cx+43,cy-95],p.light,.75);}
  if(id.includes('k17')){line(out,s.w,s.h,cx-47,cy-16,cx-93,cy-55,p.glow,9,.92);line(out,s.w,s.h,cx+49,cy-16,cx+95,cy-55,p.glow,9,.92);}
  if(id.includes('arc_railer'))rect(out,s.w,s.h,cx-6,cy-28,cx+118,cy-4,p.dark,.98);
  if(id.includes('nana04'))for(let k=0;k<4;k++){const a=k*Math.PI*.5+i*.08;ellipse(out,s.w,s.h,cx+Math.cos(a)*68,cy-12+Math.sin(a)*45,14,10,p.light,.9);}
  if(id.includes('blade_hound')){for(const side of [-1,1])line(out,s.w,s.h,cx+side*28,cy-16,cx+side*81,cy-52,p.glow,8,.9);}
  if(id.includes('overlay_astra'))for(let k=0;k<5;k++){const a=k*Math.PI*.4+i*.1;rect(out,s.w,s.h,cx+Math.cos(a)*75-5,cy+Math.sin(a)*48-20,cx+Math.cos(a)*75+5,cy+Math.sin(a)*48+20,p.glow,.78);}
}
function roleWeapon(out,unit,s,p,cx,cy,m,i){const q=m==='attack'?Math.min(1,i/Math.max(1,s.contact)):0,fire=m==='attack'&&i>=s.contact;
  if(unit.role==='물량'){line(out,s.w,s.h,cx+18,cy-19,cx+75+q*18,cy-23,p.light,6,.94);}
  else if(unit.role==='전열'){rect(out,s.w,s.h,cx-51,cy-29,cx-25,cy+36,p.dark,.83);line(out,s.w,s.h,cx+20,cy-18,cx+64+q*23,cy-45+q*29,p.light,7,.95);}
  else if(unit.role==='원거리'){line(out,s.w,s.h,cx+26,cy-18,cx+86,cy-24,p.dark,7,.94);if(fire)line(out,s.w,s.h,cx+84,cy-24,cx+128,cy-24,p.glow,5,.82);}
  else if(unit.role==='광역'){ellipse(out,s.w,s.h,cx+62,cy-10,17+q*8,17+q*8,p.accent,.68);if(fire)ellipse(out,s.w,s.h,cx+94,cy-5,29,19,p.glow,.35);}
  else if(unit.role==='변칙'){for(let k=0;k<3;k++){const a=k*2.1+i*.22;triangle(out,s.w,s.h,[cx+Math.cos(a)*55,cy+Math.sin(a)*36],[cx+Math.cos(a)*55+11,cy+Math.sin(a)*36+4],[cx+Math.cos(a)*55+2,cy+Math.sin(a)*36+15],p.glow,.55);}if(fire)line(out,s.w,s.h,cx+40,cy,cx+115,cy-8,p.glow,5,.7);}
  else {rect(out,s.w,s.h,cx+17,cy-31,cx+77,cy-2,p.dark,.95);ellipse(out,s.w,s.h,cx+77,cy-16,12+q*8,12+q*8,p.glow,.4+.4*q);if(fire)line(out,s.w,s.h,cx+82,cy-16,cx+140,cy-16,p.glow,8,.84);}
}
function drawUnit(out,unit,s,m,i,n){const p=palette(unit),{dx,dy}=shift(s,m,i,n),cx=Math.round(s.w*.45)+dx,cy=Math.round(s.h*.50)+dy,step=m==='move'?(i%2?5:-4):0;const type=archetype(unit);
  if(type==='humanoid')bodyHumanoid(out,s,p,cx,cy,step);else if(type==='beast')bodyBeast(out,s,p,cx,cy,step);else if(type==='machine')bodyMachine(out,s,p,cx,cy,step);else if(type==='construct')bodyConstruct(out,s,p,cx,cy,step);else if(type==='crab')bodyCrab(out,s,p,cx,cy,step);else bodyFlyer(out,s,p,cx,cy,step,unit.id);
  decorate(out,unit,s,p,cx,cy,step,i);roleWeapon(out,unit,s,p,cx,cy,m,i);
  const z=seedOf(unit.id);for(let k=0;k<3;k++){const ox=((z>>>(k*6))&23)-11,oy=((z>>>(k*7+2))&19)-9;rect(out,s.w,s.h,cx+ox-2,cy+oy-2,cx+ox+2,cy+oy+2,p.accent,.36);}
  if(m==='death'&&i>=Math.floor(n*.45))line(out,s.w,s.h,cx-72,cy-58,cx+70,cy+64,p.dark,8,.55);
}

const metadata={schemaVersion:2,batchId:BATCH,generator:'tools/materialize-recruitment-production-art.mjs',generatorVersion:GENERATOR_VERSION,status:'UNREVIEWED_RUNTIME_FILES',humanReview:'PENDING',normalRuntimeAuthoritative:false,generativeAiUsed:false,sourcePolicy:'PROJECT_AUTHORED_DETERMINISTIC_ONLY',targets:{}};
for(const unit of roster){
  const spec=SPECS[unit.id],target=targetById.get(unit.id),dir=resolve(outputRoot,unit.id);await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  const meta={assetId:`unit:${unit.id}`,displayName:unit.displayName,rarity:unit.rarity,seriesId:unit.seriesId,role:unit.role,sourceFamily:target.sourceFamily,projectAuthoredDeterministic:true,structuralRework:false,reviewStatus:'UNREVIEWED_RUNTIME_FILES',frameWidth:spec.w,frameHeight:spec.h,displayHeight:spec.displayHeight,attackContactFrame:spec.contact,simulationContactFrame:target.simulationContactFrame,motions:{}};
  for(let mi=0;mi<MOTIONS.length;mi++){
    const motion=MOTIONS[mi],count=spec.frames[mi],frames=[];for(let i=0;i<count;i++){const out=Buffer.alloc(spec.w*spec.h*4);drawUnit(out,unit,spec,motion,i,count);frames.push(out);}
    const strip=assembleHorizontal(frames,spec.w,spec.h),png=encodePng(spec.w*count,spec.h,strip),path=resolve(dir,`${motion}.png`);await writeFile(path,png);meta.motions[motion]={frames:count,bytes:png.length,sha256:sha256(png)};
  }
  metadata.targets[unit.id]=meta;
}
await mkdir(outputRoot,{recursive:true});
await writeFile(resolve(outputRoot,'recruitment-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[recruitment-production] materialized ${roster.length} targets / ${roster.length*MOTIONS.length} motion strips`);
