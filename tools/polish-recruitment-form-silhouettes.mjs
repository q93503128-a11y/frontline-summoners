import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, ellipse, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const unitsRoot=resolve(root,'apps/client/public/assets/production/units');
const metadataPath=resolve(unitsRoot,'recruitment-form-runtime-metadata.json');
const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
const roster=JSON.parse(await readFile(resolve(root,'content/units/recruitment-01.json'),'utf8'));
const evolutionFiles=['content/evolution/recruitment-common-explicit-01.json','content/evolution/recruitment-series-01-explicit.json','content/evolution/recruitment-series-02-explicit.json','content/evolution/recruitment-series-03-explicit.json'];
const evolution=[];for(const file of evolutionFiles)evolution.push(...JSON.parse(await readFile(resolve(root,file),'utf8')));
const MOTIONS=['idle','move','attack','knockback','death'];
function assert(ok,msg){if(!ok)throw new Error(`[recruitment-form-polish] ${msg}`);}
assert(metadata.batchId==='recruitment-production-01-forms'&&metadata.formCount===99,'recruitment form metadata identity drift');
assert(metadata.humanReview==='PENDING'&&metadata.normalRuntimeAuthoritative===false&&metadata.generativeAiUsed===false,'review boundary drift');
const rosterById=new Map(roster.map((unit)=>[unit.id,unit]));
const formById=new Map();for(const entry of evolution)for(const form of entry.forms??[])formById.set(form.formId,{characterId:entry.characterId,...form});
assert(formById.size===99,'expected 99 canonical recruitment forms');

function assemble(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function seedOf(id){let h=2166136261;for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function palette(unit){
  if(unit.seriesId==='series_01_starlight_order')return{dark:[41,47,70,255],mid:[104,119,158,255],light:[222,229,239,255],accent:[207,172,92,255],glow:[171,207,246,255]};
  if(unit.seriesId==='series_02_primordial_titans')return{dark:[47,52,38,255],mid:[97,112,70,255],light:[181,169,116,255],accent:[176,120,66,255],glow:[143,202,119,255]};
  if(unit.seriesId==='series_03_zero_edge')return{dark:[31,39,48,255],mid:[73,91,108,255],light:[177,197,207,255],accent:[195,74,67,255],glow:[85,206,239,255]};
  if(unit.attributes?.includes('NATURE'))return{dark:[48,60,42,255],mid:[92,118,73,255],light:[170,164,111,255],accent:[153,107,70,255],glow:[135,200,114,255]};
  if(unit.attributes?.includes('UNDEAD'))return{dark:[42,42,53,255],mid:[88,83,103,255],light:[178,170,180,255],accent:[128,92,143,255],glow:[128,199,213,255]};
  return{dark:[54,49,45,255],mid:[111,96,80,255],light:[197,178,143,255],accent:[166,112,70,255],glow:[222,193,124,255]};
}
function motionOffset(motion,index,count){const t=index/Math.max(1,count-1);return{bob:motion==='move'?(index%2?-3:3):motion==='idle'?(index%3===1?-2:0):motion==='death'?Math.round(t*18):0,attack:motion==='attack'?Math.sin(Math.min(1,t)*Math.PI):0,t};}
function modifiers(form){return form.modifiers??{};}
function growthSignals(form){const m=modifiers(form);return{hp:(m.maxHpPermille??1000)/1000,damage:(m.attackDamagePermille??1000)/1000,move:m.moveSpeedDelta??0,range:Math.max(m.standingRangeDelta??0,m.attackMaxRangeDelta??0,m.attackMinRangeDelta??0),cost:(m.costPermille??1000)/1000};}
function identityProfile(unitId){const seed=seedOf(unitId);return{seed,kind:seed%7,lean:((seed>>>5)%13)-6,span:18+((seed>>>9)%17),crown:8+((seed>>>14)%13),side:(seed&1)?1:-1};}
function drawBaseIdentity(out,w,h,unit,form,motion,index,count){
  const p=palette(unit),profile=identityProfile(unit.id),{bob,attack}=motionOffset(motion,index,count),cx=Math.round(w*.46),cy=Math.round(h*.50)+bob,order=form.formOrder,side=profile.side;
  const span=profile.span+(order-1)*5;
  switch(profile.kind){
    case 0:
      line(out,w,h,cx-side*38,cy-34,cx-side*(60+span),cy-66+profile.lean,p.dark,7,.96);
      triangle(out,w,h,[cx-side*(58+span),cy-67+profile.lean],[cx-side*(77+span),cy-45],[cx-side*(51+span),cy-37],p.accent,.88);break;
    case 1:
      rect(out,w,h,cx-18,cy-82-profile.crown,cx+18,cy-57,p.dark,.94);
      triangle(out,w,h,[cx-17,cy-81-profile.crown],[cx,cy-105-profile.crown],[cx+5,cy-80-profile.crown],p.light,.86);
      triangle(out,w,h,[cx+4,cy-80-profile.crown],[cx+25,cy-100-profile.crown],[cx+18,cy-73-profile.crown],p.accent,.82);break;
    case 2:
      line(out,w,h,cx-50,cy+3,cx-86-span,cy+24+profile.lean,p.dark,10,.96);
      triangle(out,w,h,[cx-85-span,cy+23+profile.lean],[cx-66-span,cy+7],[cx-70-span,cy+39],p.light,.86);break;
    case 3:
      line(out,w,h,cx+42,cy-17,cx+82+span+Math.round(attack*14),cy-34+profile.lean,p.dark,8,.96);
      triangle(out,w,h,[cx+80+span+Math.round(attack*14),cy-35+profile.lean],[cx+102+span+Math.round(attack*18),cy-31],[cx+82+span,cy-22],p.accent,.9);break;
    case 4:
      ellipse(out,w,h,cx-55,cy-24,22+order*2,16+order,p.dark,.92);ellipse(out,w,h,cx+54,cy-24,20+order*2,15+order,p.mid,.92);
      triangle(out,w,h,[cx-66,cy-37],[cx-80-order*5,cy-58],[cx-43,cy-37],p.light,.82);break;
    case 5:
      rect(out,w,h,cx-68,cy+35,cx-27,cy+55+order*5,p.dark,.94);ellipse(out,w,h,cx-49,cy+58+order*4,23+order*2,10+order,p.light,.82);
      rect(out,w,h,cx+30,cy+39,cx+69,cy+54+order*4,p.mid,.9);break;
    default:
      triangle(out,w,h,[cx-47,cy-45],[cx-75-order*5,cy-76-profile.crown],[cx-21,cy-52],p.dark,.94);
      triangle(out,w,h,[cx+39,cy-43],[cx+64+order*6,cy-68],[cx+23,cy-53],p.accent,.84);break;
  }
}
function drawEvolutionStructure(out,w,h,unit,form,motion,index,count){
  if(form.formOrder===1)return;
  const p=palette(unit),g=growthSignals(form),{bob,attack}=motionOffset(motion,index,count),cx=Math.round(w*.46),cy=Math.round(h*.50)+bob,order=form.formOrder;
  const armor=Math.max(0,g.hp-1),power=Math.max(0,g.damage-1),range=Math.max(0,g.range),rush=Math.max(0,g.move),weight=Math.max(0,g.cost-1);
  if(armor>.12||weight>.12){
    const pad=10+Math.round(Math.min(1.5,armor+weight)*12)+(order===3?6:0);
    rect(out,w,h,cx-61-pad,cy-38,cx-42,cy+24,p.dark,.9);rect(out,w,h,cx+41,cy-38,cx+61+pad,cy+24,p.mid,.9);
    triangle(out,w,h,[cx-58-pad,cy-39],[cx-45-pad,cy-61-pad*.25],[cx-35,cy-38],p.light,.82);
  }
  if(range>10){
    const reach=Math.min(82,24+range*.62)+(order===3?18:0)+Math.round(attack*14);
    line(out,w,h,cx+28,cy-5,cx+Math.min(w*.47,reach),cy-18,p.dark,7,.95);
    triangle(out,w,h,[cx+Math.min(w*.47,reach),cy-18],[cx+Math.min(w*.48,reach+20),cy-15],[cx+Math.min(w*.47,reach),cy-7],p.accent,.9);
  }
  if(power>.28){
    const r=13+Math.round(Math.min(1.8,power)*8)+(order===3?5:0);
    ellipse(out,w,h,cx+45,cy-13,r,r*.72,p.accent,.88);ellipse(out,w,h,cx+45,cy-13,Math.max(4,r*.38),Math.max(3,r*.3),p.glow,.74);
  }
  if(rush>.05){
    const sweep=26+Math.round(Math.min(2,rush)*13)+(order===3?10:0);
    triangle(out,w,h,[cx-40,cy+12],[cx-40-sweep,cy-3],[cx-31,cy+33],p.accent,.82);
    triangle(out,w,h,[cx-22,cy+37],[cx-42-sweep*.65,cy+61],[cx-7,cy+48],p.dark,.78);
  }
  if(order===3){
    const seed=seedOf(form.formId),variant=seed%4;
    if(variant===0){triangle(out,w,h,[cx-14,cy-66],[cx-2,cy-103],[cx+9,cy-64],p.glow,.75);}
    else if(variant===1){line(out,w,h,cx-46,cy-44,cx-75,cy-82,p.light,7,.83);line(out,w,h,cx+43,cy-42,cx+69,cy-78,p.light,7,.83);}
    else if(variant===2){ellipse(out,w,h,cx-62,cy-8,17,29,p.glow,.45);ellipse(out,w,h,cx+66,cy-3,14,25,p.glow,.4);}
    else{triangle(out,w,h,[cx-54,cy+22],[cx-92,cy+4],[cx-64,cy+48],p.light,.76);triangle(out,w,h,[cx+53,cy+21],[cx+91,cy+2],[cx+65,cy+47],p.accent,.76);}
  }
}
function drawKnownIdentity(out,w,h,unit,form,motion,index,count){
  const p=palette(unit),{bob,attack}=motionOffset(motion,index,count),cx=Math.round(w*.46),cy=Math.round(h*.50)+bob,order=form.formOrder;
  if(unit.id==='char_s02_barga'){
    ellipse(out,w,h,cx-25,cy-20,72+order*7,54+order*5,p.dark,.9);
    for(let k=0;k<4;k++)triangle(out,w,h,[cx-70+k*30,cy-58],[cx-60+k*30,cy-86-order*5-(k%2)*8],[cx-44+k*30,cy-55],p.light,.83);
  }else if(unit.id==='char_s02_gormu'){
    const lift=order*5;triangle(out,w,h,[cx-80,cy-34],[cx-45,cy-105-lift],[cx-10,cy-38],p.dark,.94);triangle(out,w,h,[cx-34,cy-38],[cx+5,cy-121-lift],[cx+42,cy-36],p.mid,.92);triangle(out,w,h,[cx+10,cy-38],[cx+45,cy-94-lift],[cx+73,cy-34],p.light,.82);
  }else if(unit.id==='char_s03_k17'){
    const reach=78+order*12+Math.round(attack*18);line(out,w,h,cx+25,cy-20,cx+reach,cy-48,p.glow,10,.86);line(out,w,h,cx+24,cy+8,cx+reach-6,cy+38,p.accent,9,.86);triangle(out,w,h,[cx+reach,cy-48],[cx+reach+24,cy-48],[cx+reach,cy-37],p.light,.78);
  }else if(unit.id==='char_s03_blade_hound'){
    const tail=88+order*10;line(out,w,h,cx-34,cy+17,cx-tail,cy-6,p.dark,13,.94);triangle(out,w,h,[cx-tail,cy-6],[cx-tail-28,cy-21],[cx-tail-8,cy+10],p.accent,.88);for(let k=0;k<3;k++)triangle(out,w,h,[cx-30+k*25,cy-45],[cx-21+k*25,cy-76-order*3],[cx-10+k*25,cy-43],p.light,.82);
  }
}

for(const [formId,meta] of Object.entries(metadata.targets)){
  const form=formById.get(formId),unit=rosterById.get(meta.unitId);assert(form&&unit,`canonical data missing for ${formId}`);
  for(const motion of MOTIONS){
    const mm=meta.motions[motion];assert(mm,`${formId}/${motion} metadata missing`);
    const path=resolve(unitsRoot,unit.id,formId,`${motion}.png`),bytes=await readFile(path),png=decodePng(bytes,`${formId}/${motion}`);assert(png.width===meta.frameWidth*mm.frames&&png.height===meta.frameHeight,`${formId}/${motion} dimensions drift`);
    const frames=[];for(let i=0;i<mm.frames;i++){const frame=sourceFrame(png,meta.frameWidth,meta.frameHeight,i);drawBaseIdentity(frame,meta.frameWidth,meta.frameHeight,unit,form,motion,i,mm.frames);drawEvolutionStructure(frame,meta.frameWidth,meta.frameHeight,unit,form,motion,i,mm.frames);drawKnownIdentity(frame,meta.frameWidth,meta.frameHeight,unit,form,motion,i,mm.frames);frames.push(frame);}
    const polished=encodePng(meta.frameWidth*mm.frames,meta.frameHeight,assemble(frames,meta.frameWidth,meta.frameHeight));await writeFile(path,polished);mm.bytes=polished.length;mm.sha256=sha256(polished);
  }
  meta.visualPolish={version:1,kind:'RECRUITMENT_FORM_SILHOUETTE_DIFFERENTIATION_PASS',reviewStatus:'UNREVIEWED_RUNTIME_FILES',normalRuntimeAuthoritative:false};
}
metadata.visualPolish={version:1,kind:'RECRUITMENT_FORM_SILHOUETTE_DIFFERENTIATION_PASS',targetCount:99,humanReview:'PENDING',normalRuntimeAuthoritative:false};
await writeFile(metadataPath,`${JSON.stringify(metadata,null,2)}\n`);
console.log('[recruitment-form-polish] polished 99 canonical recruitment forms / 495 motion strips');
