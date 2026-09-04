import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, ellipse, line, rect, sha256, sourceFrame, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot=resolve(root,'apps/client/public');
const unitsRoot=resolve(publicRoot,'assets/production/units');
const MOTIONS=['idle','move','attack','knockback','death'];
const BATCHES={
  'chapter-02-runtime-metadata.json':new Map([['boss_ch2_rootwidow','ROOTWIDOW']]),
  'chapter-03-runtime-metadata.json':new Map([['enemy_ch3_torn_mirror','TORN_MIRROR']]),
  'chapter-04-runtime-metadata.json':new Map([['boss_ch4_zero_engine','ZERO_ENGINE'],['enemy_ch4_void_lens','VOID_LENS'],['enemy_ch4_error_mass','ERROR_MASS']]),
  'special-content-runtime-metadata.json':new Map([
    ['enemy_sp_evo_mirror_seal','MIRROR_SEAL'],['boss_sp_soul_grand_forge','SOUL_FORGE'],['boss_sp_evo_gatekeeper','EVO_GATE'],
    ['boss_sp_unobservable','UNOBSERVABLE'],['boss_sp_walking_machine_castle','WALKING_CASTLE'],['boss_sp_gold_carrier','GOLD_CARRIER'],
    ['enemy_sp_evo_seal_guard','EVO_SEAL_GUARD'],['enemy_sp_gold_vault_golem','GOLD_VAULT'],['enemy_sp_gold_cart','GOLD_CART'],
    ['enemy_ev_ze_shield','ZE_SHIELD'],['enemy_sp_soul_armor','SOUL_ARMOR'],['boss_sp_glass_castle','GLASS_CASTLE'],
  ]),
  'sixth-slice-runtime-metadata.json':new Map([['enemy-boss-iron','IRON_BOSS']]),
  'second-slice-runtime-metadata.json':new Map([['guard/guard_f2','GUARD_F2'],['guard/guard_f3','GUARD_F3']]),
  'recruitment-runtime-metadata.json':new Map([['char_common_a_paper_dragon','PAPER_DRAGON'],['char_common_b_ink_raven','INK_RAVEN']]),
};
function assert(ok,msg){if(!ok)throw new Error(`[production-priority-03] ${msg}`);}
function assemble(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function phase(i,n){return i/Math.max(1,n-1);}
const P={d:[31,35,45,255],m:[87,100,117,255],a:[210,102,73,255],g:[104,203,225,255],l:[218,225,232,255],gold:[226,180,73,255],violet:[164,111,216,255],soul:[116,211,190,255]};
function draw(out,w,h,kind,motion,i,n){
  const t=phase(i,n),pulse=motion==='attack'?Math.sin(t*Math.PI):0,step=motion==='move'?(i%2?-1:1):0,cx=Math.round(w*.5),cy=Math.round(h*.52),X=(x)=>Math.max(8,Math.min(w-8,Math.round(x))),Y=(y)=>Math.max(8,Math.min(h-8,Math.round(y)));
  if(kind==='ZERO_ENGINE'){
    ellipse(out,w,h,cx,cy-18,Math.round(w*.30),Math.round(h*.24),P.d,.94);ellipse(out,w,h,cx,cy-18,Math.round(w*.22),Math.round(h*.16),P.g,.42);
    for(const s of [-1,1]){rect(out,w,h,cx+s*Math.round(w*.27)-12,cy-Math.round(h*.24),cx+s*Math.round(w*.27)+12,cy+Math.round(h*.18),P.m,.95);line(out,w,h,cx+s*Math.round(w*.18),cy-18,cx+s*Math.round(w*.31),cy-18,P.l,8,.93);}
    if(motion==='attack')for(let k=0;k<4;k++){const a=(k/4)*Math.PI*2,lineX=X(cx+Math.cos(a)*w*(.25+.08*pulse)),lineY=Y(cy-18+Math.sin(a)*h*(.22+.06*pulse));line(out,w,h,cx,cy-18,lineX,lineY,P.a,7,.92);}
  }else if(kind==='VOID_LENS'){
    ellipse(out,w,h,cx,cy-20,Math.round(w*.18),Math.round(h*.28),P.violet,.55);ellipse(out,w,h,cx,cy-20,Math.round(w*.09),Math.round(h*.18),P.d,.98);triangle(out,w,h,[cx-55,cy-88],[cx-8,cy-128],[cx-23,cy-55],P.l,.9);triangle(out,w,h,[cx+48,cy+58],[cx+83,cy+18],[cx+28,cy+31],P.g,.82);
  }else if(kind==='ERROR_MASS'){
    rect(out,w,h,cx-80,cy-40,cx-35,cy+35,P.d,.92);rect(out,w,h,cx+35,cy-65,cx+70,cy-10,P.a,.88);triangle(out,w,h,[cx-15,cy-78],[cx+20,cy-120],[cx+42,cy-58],P.g,.78);if(motion==='move'){rect(out,w,h,cx-88+step*7,cy+38,cx-40+step*7,cy+58,P.m,.9);rect(out,w,h,cx+18-step*7,cy+35,cx+72-step*7,cy+55,P.l,.86);}
  }else if(kind==='TORN_MIRROR'){
    triangle(out,w,h,[cx-65,cy+72],[cx-18,cy-110],[cx+3,cy+55],P.l,.92);triangle(out,w,h,[cx+18,cy+35],[cx+62,cy-84],[cx+80,cy+62],P.g,.52);ellipse(out,w,h,cx-92,cy-42,18,27,P.violet,.7);if(motion==='attack')line(out,w,h,cx-12,cy-36,X(cx+w*(.32+.07*pulse)),Y(cy-52),P.g,8,.88);
  }else if(kind==='MIRROR_SEAL'){
    rect(out,w,h,cx-72,cy-78,cx+72,cy+75,P.d,.9);ellipse(out,w,h,cx,cy-2,55,62,P.violet,.45);for(const s of [-1,1]){rect(out,w,h,cx+s*82-9,cy-58,cx+s*82+9,cy+58,P.g,.88);triangle(out,w,h,[cx+s*72,cy-78],[cx+s*105,cy-35],[cx+s*72,cy-18],P.l,.9);}
  }else if(kind==='SOUL_FORGE'){
    rect(out,w,h,cx-116,cy-35,cx+116,cy+66,P.d,.95);for(const x of [-78,0,78]){rect(out,w,h,cx+x-15,cy-105,cx+x+15,cy-28,P.m,.94);ellipse(out,w,h,cx+x,cy-112,20,14,P.soul,.75);}if(motion==='attack'){line(out,w,h,cx-70,cy-5,X(cx+90+45*pulse),Y(cy-60-22*pulse),P.gold,16,.95);ellipse(out,w,h,X(cx+92+45*pulse),Y(cy-62-22*pulse),34,28,P.a,.9);}
  }else if(kind==='EVO_GATE'){
    for(const s of [-1,1]){rect(out,w,h,cx+s*92-21,cy-118,cx+s*92+21,cy+72,P.d,.96);triangle(out,w,h,[cx+s*113,cy-118],[cx+s*92,cy-154],[cx+s*71,cy-118],P.g,.85);}ellipse(out,w,h,cx,cy-30,42,50,P.violet,.62);line(out,w,h,cx-70,cy-90,cx+70,cy-90,P.l,12,.9);
  }else if(kind==='UNOBSERVABLE'){
    ellipse(out,w,h,cx-52,cy-25,61,45,P.violet,.5);ellipse(out,w,h,cx+58,cy+18,48,60,P.g,.42);triangle(out,w,h,[cx-22,cy-102],[cx+33,cy-70],[cx-8,cy-26],P.d,.94);triangle(out,w,h,[cx+12,cy+42],[cx+86,cy+76],[cx+32,cy+91],P.l,.72);
  }else if(kind==='WALKING_CASTLE'){
    rect(out,w,h,cx-118,cy-88,cx+118,cy+35,P.d,.96);for(const x of [-88,-29,29,88])rect(out,w,h,cx+x-16,cy-122,cx+x+16,cy-80,P.m,.95);for(const s of [-1,1]){line(out,w,h,cx+s*72,cy+22,cx+s*(76+step*9),cy+112,P.l,18,.95);ellipse(out,w,h,cx+s*(77+step*9),cy+116,27,17,P.a,.86);}
  }else if(kind==='GOLD_CARRIER'){
    rect(out,w,h,cx-130,cy-45,cx+130,cy+42,P.d,.94);rect(out,w,h,cx-90,cy-85,cx+72,cy-46,P.gold,.9);for(const x of [-92,-30,32,94])ellipse(out,w,h,cx+x,cy+55,24,24,P.m,.96);if(motion==='attack')triangle(out,w,h,[cx+80,cy-65],[X(cx+145+30*pulse),cy-35],[cx+80,cy-5],P.g,.86);
  }else if(kind==='EVO_SEAL_GUARD'){
    rect(out,w,h,cx-82,cy-100,cx-42,cy+72,P.d,.96);triangle(out,w,h,[cx-88,cy-90],[cx-122,cy-25],[cx-86,cy+55],P.g,.82);line(out,w,h,cx+24,cy-32,X(cx+100+28*pulse),Y(cy-50),P.l,11,.94);
  }else if(kind==='GOLD_VAULT'){
    rect(out,w,h,cx-104,cy-94,cx+104,cy+78,P.d,.97);rect(out,w,h,cx-69,cy-63,cx+69,cy+48,P.gold,.85);ellipse(out,w,h,cx,cy-8,27,27,P.m,.98);for(const s of [-1,1])rect(out,w,h,cx+s*116-19,cy-54,cx+s*116+19,cy+44,P.l,.92);
  }else if(kind==='GOLD_CART'){
    rect(out,w,h,cx-102,cy-54,cx+82,cy+34,P.gold,.88);triangle(out,w,h,[cx-98,cy-56],[cx-56,cy-100],[cx+73,cy-56],P.l,.86);ellipse(out,w,h,cx-65+step*3,cy+50,25,25,P.d,.97);ellipse(out,w,h,cx+47+step*3,cy+50,25,25,P.d,.97);line(out,w,h,cx+80,cy-3,X(cx+126+20*pulse),cy-18,P.m,9,.94);
  }else if(kind==='ZE_SHIELD'){
    rect(out,w,h,cx-101,cy-98,cx-53,cy+84,P.d,.97);triangle(out,w,h,[cx-105,cy-87],[cx-139,cy],[cx-105,cy+72],P.g,.88);rect(out,w,h,cx+35,cy-61,cx+70,cy+35,P.m,.94);if(motion==='attack')line(out,w,h,cx+40,cy-25,X(cx+112+22*pulse),cy-25,P.a,10,.94);
  }else if(kind==='SOUL_ARMOR'){
    triangle(out,w,h,[cx-68,cy-54],[cx-88,cy-108],[cx-22,cy-75],P.soul,.78);triangle(out,w,h,[cx+68,cy-54],[cx+88,cy-108],[cx+22,cy-75],P.soul,.78);rect(out,w,h,cx-38,cy-92,cx+38,cy+68,P.d,.92);ellipse(out,w,h,cx,cy-82,25,21,P.g,.55);
  }else if(kind==='GLASS_CASTLE'){
    for(const x of [-92,-31,31,92])triangle(out,w,h,[cx+x-22,cy+65],[cx+x,cy-130],[cx+x+22,cy+65],P.g,.52);rect(out,w,h,cx-126,cy+45,cx+126,cy+76,P.l,.74);ellipse(out,w,h,cx,cy-26,39,54,P.violet,.4);
  }else if(kind==='IRON_BOSS'){
    rect(out,w,h,cx-76,cy-72,cx+76,cy+58,P.d,.96);for(const s of [-1,1])ellipse(out,w,h,cx+s*82,cy-48,34,31,P.m,.96);for(const s of [-1,1])line(out,w,h,cx+s*38,cy+48,cx+s*(42+step*12),cy+100,P.l,16,.95);if(motion==='attack')line(out,w,h,cx+45,cy-18,X(cx+118+36*pulse),Y(cy-42),P.a,14,.95);
  }else if(kind==='ROOTWIDOW'){
    for(let k=0;k<4;k++){const y=cy-45+k*28;line(out,w,h,cx-35,y,X(cx-w*(.25+.02*k)),Y(y+(k%2?-28:28)),P.d,10,.94);line(out,w,h,cx+35,y,X(cx+w*(.25+.02*k)),Y(y+(k%2?28:-28)),P.d,10,.94);}if(motion==='attack'){triangle(out,w,h,[cx-30,cy-45],[X(cx+120+38*pulse),cy-10],[cx-28,cy+25],P.a,.9);}
  }else if(kind==='GUARD_F2'||kind==='GUARD_F3'){
    const tall=kind==='GUARD_F3';rect(out,w,h,cx-68,cy-(tall?82:66),cx-38,cy+(tall?61:49),P.d,.96);triangle(out,w,h,[cx-72,cy-(tall?78:62)],[cx-101,cy-5],[cx-72,cy+(tall?52:43)],tall?P.gold:P.l,.9);line(out,w,h,cx+30,cy+24,cx+34+step*(tall?10:7),cy+78,P.m,tall?11:9,.94);
  }else if(kind==='PAPER_DRAGON'){
    triangle(out,w,h,[cx-90,cy],[cx-18,cy-92],[cx+5,cy+12],P.l,.8);triangle(out,w,h,[cx+5,cy+12],[cx+82,cy-62],[cx+96,cy+26],P.g,.58);line(out,w,h,cx-20,cy+8,X(cx+118+24*pulse),Y(cy+48),P.d,7,.92);
  }else if(kind==='INK_RAVEN'){
    triangle(out,w,h,[cx-82,cy-30],[cx-8,cy-84],[cx-28,cy+22],P.d,.95);triangle(out,w,h,[cx+12,cy-66],[cx+98,cy-20],[cx+20,cy+20],P.violet,.82);triangle(out,w,h,[cx+38,cy-20],[X(cx+118),cy-8],[cx+42,cy+8],P.a,.9);if(motion==='move')line(out,w,h,cx-42,cy+18,cx-78,cy+48+step*9,P.g,6,.82);
  }
}

let totalTargets=0;
for(const [file,targetKinds] of Object.entries(BATCHES)){
  const metadataPath=resolve(unitsRoot,file),metadata=JSON.parse(await readFile(metadataPath,'utf8'));let touched=0;
  assert(metadata.normalRuntimeAuthoritative===false||metadata.normalRuntimeAuthoritative===undefined,`${file} authority boundary drift`);
  const targets=metadata.targets??{};
  for(const [targetKey,kind] of targetKinds){const meta=targets[targetKey];assert(meta,`${file} missing target ${targetKey}`);touched++;totalTargets++;
    for(const motion of MOTIONS){const mm=meta.motions?.[motion];assert(mm,`${targetKey}/${motion} missing metadata`);const fw=mm.frameWidth??meta.frameWidth,fh=mm.frameHeight??meta.frameHeight;assert(Number.isInteger(fw)&&Number.isInteger(fh),`${targetKey}/${motion} frame dimensions missing`);let path;if(typeof mm.url==='string')path=resolve(publicRoot,mm.url.replace(/^\//,''));else{const base=meta.formId?resolve(unitsRoot,meta.unitId,meta.formId):resolve(unitsRoot,targetKey);path=resolve(base,`${motion}.png`);}const bytes=await readFile(path),png=decodePng(bytes,`${targetKey}/${motion}`);assert(png.width===fw*mm.frames&&png.height===fh,`${targetKey}/${motion} dimensions drift`);const frames=[];for(let i=0;i<mm.frames;i++){const frame=sourceFrame(png,fw,fh,i);draw(frame,fw,fh,kind,motion,i,mm.frames);frames.push(frame);}const encoded=encodePng(fw*mm.frames,fh,assemble(frames,fw,fh));await writeFile(path,encoded);mm.bytes=encoded.length;mm.sha256=sha256(encoded);}
    meta.visualPolishPriority03={version:1,kind:'CROSS_BATCH_IDENTITY_AND_MOTION_READABILITY',reviewStatus:'UNREVIEWED_RUNTIME_FILES'};
  }
  metadata.visualPolishPriority03={version:1,touchedTargets:touched,humanReview:'PENDING',normalRuntimeAuthoritative:false};await writeFile(metadataPath,`${JSON.stringify(metadata,null,2)}\n`);
}
console.log(`[production-priority-03] polished ${totalTargets} cross-batch targets; review authority remains pending`);
