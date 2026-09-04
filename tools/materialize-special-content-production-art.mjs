import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ellipse, encodePng, line, rect, sha256, triangle } from './lib/production-png.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const outputRoot=resolve(root,'apps/client/public/assets/production/units');
const contractPath=resolve(root,'assets/raw/production/special-content-production-01.json');
const BATCH='special-content-production-01';
const GENERATOR_VERSION=1;
const MOTIONS=['idle','move','attack','knockback','death'];

const TARGETS={
  enemy_ev_sand_crab:{family:'project-authored-event-beast-crab',shape:'crab',w:200,h:150,displayHeight:138,contact:2,frames:[6,8,6,4,6]},
  enemy_ev_foodcart:{family:'project-authored-event-anomaly-cart',shape:'foodcart',w:280,h:220,displayHeight:202,contact:3,frames:[7,8,7,4,7]},
  enemy_ev_tailbeast:{family:'project-authored-event-beast-tail',shape:'tailbeast',w:280,h:210,displayHeight:194,contact:3,frames:[7,8,7,4,7]},
  enemy_ev_firework_jelly:{family:'project-authored-event-arcane-jelly',shape:'jelly',w:260,h:240,displayHeight:218,contact:5,frames:[7,8,9,4,7]},
  boss_ev_summer_kaiju:{family:'project-authored-event-kaiju-boss',shape:'kaiju',w:390,h:320,displayHeight:294,contact:3,frames:[8,8,10,4,9]},
  enemy_ev_ze_drone:{family:'project-authored-event-machine-drone',shape:'drone',w:210,h:170,displayHeight:156,contact:2,frames:[6,8,6,4,6]},
  enemy_ev_ze_scrap_blade:{family:'project-authored-event-machine-cutter',shape:'cutter',w:220,h:180,displayHeight:166,contact:2,frames:[6,8,6,4,6]},
  enemy_ev_ze_shield:{family:'project-authored-event-machine-barrier',shape:'shield',w:260,h:230,displayHeight:212,contact:3,frames:[7,8,7,4,7]},
  enemy_ev_ze_railpod:{family:'project-authored-event-machine-railpod',shape:'railpod',w:340,h:220,displayHeight:202,contact:5,frames:[6,7,9,4,7]},
  boss_ev_ze_testframe:{family:'project-authored-event-machine-frame-boss',shape:'testframe',w:400,h:330,displayHeight:302,contact:3,frames:[8,8,11,4,9]},
  enemy_sp_glutton_juvenile:{family:'project-authored-special-beast-juvenile',shape:'juvenile',w:280,h:230,displayHeight:212,contact:2,frames:[7,8,7,4,7]},
  boss_sp_glutton_drake:{family:'project-authored-special-beast-drake-boss',shape:'drake',w:410,h:340,displayHeight:312,contact:3,frames:[8,8,10,4,9]},
  boss_sp_undying_night:{family:'project-authored-special-undead-king-boss',shape:'nightking',w:360,h:330,displayHeight:302,contact:4,frames:[8,8,9,4,9]},
  boss_sp_glass_castle:{family:'project-authored-special-arcane-glass-castle',shape:'glasscastle',w:430,h:350,displayHeight:318,contact:4,frames:[8,8,10,4,9]},
  boss_sp_walking_machine_castle:{family:'project-authored-special-machine-castle',shape:'machinecastle',w:440,h:350,displayHeight:320,contact:4,frames:[8,8,10,4,9]},
  boss_sp_unobservable:{family:'project-authored-special-anomaly-unobservable',shape:'unobservable',w:370,h:330,displayHeight:300,contact:3,frames:[8,8,10,4,9]},
  enemy_sp_gold_porter:{family:'project-authored-special-gold-porter',shape:'porter',w:200,h:190,displayHeight:174,contact:2,frames:[6,8,6,4,6]},
  enemy_sp_gold_cart:{family:'project-authored-special-gold-cart',shape:'goldcart',w:270,h:200,displayHeight:184,contact:3,frames:[6,8,7,4,7]},
  enemy_sp_gold_guard:{family:'project-authored-special-gold-guard',shape:'goldguard',w:240,h:230,displayHeight:212,contact:3,frames:[7,8,7,4,7]},
  enemy_sp_gold_train:{family:'project-authored-special-gold-train',shape:'goldtrain',w:360,h:220,displayHeight:202,contact:4,frames:[7,8,8,4,7]},
  enemy_sp_gold_vault_golem:{family:'project-authored-special-gold-vault-golem',shape:'vaultgolem',w:310,h:290,displayHeight:266,contact:4,frames:[7,8,8,4,8]},
  boss_sp_gold_carrier:{family:'project-authored-special-gold-carrier-boss',shape:'goldcarrier',w:400,h:330,displayHeight:302,contact:3,frames:[8,8,10,4,9]},
  enemy_sp_soul_wisp:{family:'project-authored-special-soul-wisp',shape:'wisp',w:190,h:180,displayHeight:164,contact:1,frames:[6,8,5,4,6]},
  enemy_sp_soul_armor:{family:'project-authored-special-soul-armor',shape:'soularmor',w:250,h:240,displayHeight:220,contact:3,frames:[7,8,7,4,7]},
  enemy_sp_soul_hammer:{family:'project-authored-special-soul-hammer',shape:'soulhammer',w:270,h:230,displayHeight:212,contact:3,frames:[7,8,7,4,7]},
  enemy_sp_soul_chorus:{family:'project-authored-special-soul-chorus',shape:'chorus',w:280,h:220,displayHeight:202,contact:2,frames:[7,8,8,4,7]},
  enemy_sp_soul_furnace:{family:'project-authored-special-soul-furnace',shape:'soulfurnace',w:320,h:250,displayHeight:230,contact:3,frames:[7,8,9,4,8]},
  boss_sp_soul_grand_forge:{family:'project-authored-special-soul-forge-boss',shape:'grandforge',w:420,h:350,displayHeight:320,contact:4,frames:[8,8,11,4,9]},
  enemy_sp_evo_fragment:{family:'project-authored-special-evo-fragment',shape:'fragment',w:190,h:170,displayHeight:156,contact:2,frames:[6,8,6,4,6]},
  enemy_sp_evo_seal_guard:{family:'project-authored-special-evo-seal-guard',shape:'sealguard',w:260,h:250,displayHeight:230,contact:3,frames:[7,8,7,4,7]},
  enemy_sp_evo_keyeater:{family:'project-authored-special-evo-keyeater',shape:'keyeater',w:200,h:160,displayHeight:148,contact:1,frames:[6,8,5,4,6]},
  enemy_sp_evo_chain_seal:{family:'project-authored-special-evo-chain-seal',shape:'chainseal',w:270,h:240,displayHeight:220,contact:3,frames:[7,8,7,4,7]},
  enemy_sp_evo_mirror_seal:{family:'project-authored-special-evo-mirror-seal',shape:'mirrorseal',w:280,h:250,displayHeight:228,contact:4,frames:[7,8,8,4,7]},
  enemy_sp_evo_glyph_turret:{family:'project-authored-special-evo-glyph-turret',shape:'glyphturret',w:330,h:240,displayHeight:220,contact:5,frames:[7,8,9,4,7]},
  enemy_sp_evo_mid_guardian:{family:'project-authored-special-evo-mid-guardian',shape:'midguardian',w:330,h:300,displayHeight:276,contact:4,frames:[8,8,8,4,8]},
  boss_sp_evo_gatekeeper:{family:'project-authored-special-evo-gatekeeper-boss',shape:'gatekeeper',w:410,h:340,displayHeight:312,contact:3,frames:[8,8,11,4,9]},
  enemy_sp_rift_shardling:{family:'project-authored-special-rift-shardling',shape:'shardling',w:200,h:180,displayHeight:164,contact:2,frames:[6,8,6,4,6]},
  enemy_sp_rift_mirror_orb:{family:'project-authored-special-rift-mirror-orb',shape:'mirrororb',w:260,h:230,displayHeight:212,contact:3,frames:[7,8,8,4,7]},
  enemy_sp_rift_observer:{family:'project-authored-special-rift-observer',shape:'observer',w:300,h:260,displayHeight:238,contact:5,frames:[7,8,9,4,7]},
  boss_sp_rift_nightfall:{family:'project-authored-special-rift-nightfall-boss',shape:'nightfall',w:400,h:340,displayHeight:310,contact:3,frames:[8,8,11,4,9]},
};

const contract=JSON.parse(await readFile(contractPath,'utf8'));
if(contract.status!=='AWAITING_ART'||contract.reviewStatus!=='PENDING'||contract.normalRuntimeAuthoritative!==false)throw new Error('special-content lifecycle drifted before human review');
if(contract.generativeAiUsed!==false||contract.sourcePolicy!=='PROJECT_AUTHORED_DETERMINISTIC_ONLY')throw new Error('special-content source policy drifted');
if(contract.targets.length!==Object.keys(TARGETS).length)throw new Error('special-content target count drift');

function assembleHorizontal(frames,w,h){const out=Buffer.alloc(w*frames.length*h*4);for(let fi=0;fi<frames.length;fi++)for(let y=0;y<h;y++){const src=y*w*4,dst=(y*w*frames.length+fi*w)*4;frames[fi].copy(out,dst,src,src+w*4);}return out;}
function phase(i,n){return i/Math.max(1,n-1);}
function bob(m,i){return m==='move'?(i%2?-4:3):m==='idle'?(i%3===1?-2:0):0;}
function shift(spec,m,i,n){const t=phase(i,n);return{dx:m==='attack'&&i===spec.contact?8:m==='knockback'?-Math.round(t*15):0,dy:bob(m,i)+(m==='death'?Math.round(t*29):0),t};}
function seedOf(id){let h=2166136261;for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function gear(out,w,h,cx,cy,r,teeth,fill,edge,rot=0,a=.95){ellipse(out,w,h,cx,cy,r,r,fill,a);for(let k=0;k<teeth;k++){const ang=rot+Math.PI*2*k/teeth,x=cx+Math.cos(ang)*(r+6),y=cy+Math.sin(ang)*(r+6);rect(out,w,h,x-3,y-3,x+3,y+3,edge,.88);}ellipse(out,w,h,cx,cy,Math.max(3,r*.32),Math.max(3,r*.32),edge,.92);}
function ring(out,w,h,cx,cy,rx,ry,col,a=.35,th=3){ellipse(out,w,h,cx,cy,rx,ry,col,a);ellipse(out,w,h,cx,cy,Math.max(1,rx-th),Math.max(1,ry-th),[0,0,0,0],0);}
function palette(id){
  if(id.startsWith('enemy_ev_')||id.startsWith('boss_ev_')){
    if(id.includes('_ze_'))return{dark:[38,45,55,255],mid:[86,98,110,255],light:[180,194,199,255],accent:[210,77,61,255],glow:[106,187,225,255]};
    return{dark:[55,58,70,255],mid:[86,132,149,255],light:[219,198,142,255],accent:[221,91,82,255],glow:[246,190,82,255]};
  }
  if(id.includes('glutton'))return{dark:[54,43,40,255],mid:[119,72,57,255],light:[186,142,92,255],accent:[195,70,55,255],glow:[239,155,75,255]};
  if(id.includes('undying'))return{dark:[29,35,53,255],mid:[63,76,111,255],light:[151,170,197,255],accent:[92,108,193,255],glow:[117,209,234,255]};
  if(id.includes('glass'))return{dark:[43,55,72,255],mid:[95,137,158,255],light:[190,225,230,255],accent:[102,117,183,255],glow:[226,247,250,255]};
  if(id.includes('walking_machine'))return{dark:[39,43,47,255],mid:[83,91,94,255],light:[173,163,142,255],accent:[176,80,55,255],glow:[236,141,62,255]};
  if(id.includes('unobservable'))return{dark:[32,28,45,255],mid:[75,58,101,255],light:[151,128,179,255],accent:[132,70,164,255],glow:[208,177,236,255]};
  if(id.includes('_gold_'))return{dark:[66,54,35,255],mid:[145,112,54,255],light:[223,190,101,255],accent:[164,79,44,255],glow:[250,220,111,255]};
  if(id.includes('_soul_'))return{dark:[28,41,52,255],mid:[48,93,116,255],light:[129,184,194,255],accent:[70,121,181,255],glow:[116,226,238,255]};
  if(id.includes('_evo_'))return{dark:[42,40,58,255],mid:[81,86,123,255],light:[161,164,196,255],accent:[124,74,154,255],glow:[191,146,224,255]};
  return{dark:[31,31,49,255],mid:[67,74,107,255],light:[130,153,185,255],accent:[105,69,151,255],glow:[157,202,233,255]};
}
function sigil(out,s,id,cx,cy,p){const z=seedOf(id);for(let k=0;k<3;k++){const ox=((z>>>(k*5))&15)-7,oy=((z>>>(k*7+3))&15)-7;rect(out,s.w,s.h,cx+ox-2,cy+oy-2,cx+ox+2,cy+oy+2,p.light,.55);}}
function drawMotif(out,id,s,m,i,n){
  const p=palette(id),{dx,dy}=shift(s,m,i,n),cx=Math.round(s.w*.46)+dx,cy=Math.round(s.h*.50)+dy,step=m==='move'?(i%2?5:-4):0,rot=i*.16;
  switch(s.shape){
    case 'crab':
      ellipse(out,s.w,s.h,cx,cy+10,45,24,p.mid,.98);for(let k=0;k<3;k++)for(const side of [-1,1])line(out,s.w,s.h,cx+side*(20+k*9),cy+18,cx+side*(58+k*8),cy+44+(k%2?8:0)+step,p.dark,6,.95);for(let k=-2;k<=2;k++)triangle(out,s.w,s.h,[cx+k*17-5,cy-8],[cx+k*17,cy-30-Math.abs(k)*2],[cx+k*17+6,cy-8],p.light,.9);break;
    case 'foodcart':
      rect(out,s.w,s.h,cx-58,cy-40,cx+60,cy+35,p.mid,.96);triangle(out,s.w,s.h,[cx-64,cy-40],[cx,cy-76],[cx+66,cy-40],p.accent,.9);gear(out,s.w,s.h,cx-42,cy+49,18,10,p.dark,p.light,rot);gear(out,s.w,s.h,cx+43,cy+49,18,10,p.dark,p.light,-rot);ellipse(out,s.w,s.h,cx+53,cy-5,17,14,p.dark,.96);for(let k=0;k<4;k++)triangle(out,s.w,s.h,[cx+55+k*7,cy-9],[cx+65+k*7,cy-2],[cx+55+k*7,cy+4],p.light,.9);break;
    case 'tailbeast':
      ellipse(out,s.w,s.h,cx-12,cy,48,35,p.mid,.98);ellipse(out,s.w,s.h,cx-42,cy-25,26,23,p.dark,.95);for(let k=0;k<4;k++)triangle(out,s.w,s.h,[cx-20+k*20,cy-31],[cx-12+k*20,cy-55-(k%2)*7],[cx-3+k*20,cy-28],p.light,.85);line(out,s.w,s.h,cx+31,cy+8,cx+102,cy-30-step,p.mid,18,.96);ellipse(out,s.w,s.h,cx+105,cy-31-step,19,31,p.accent,.82);break;
    case 'jelly':
      ellipse(out,s.w,s.h,cx,cy-29,54,42,p.mid,.83);rect(out,s.w,s.h,cx-47,cy-27,cx+47,cy-5,p.mid,.82);for(let k=-3;k<=3;k++)line(out,s.w,s.h,cx+k*14,cy-5,cx+k*17,cy+72+(k%2?10:0)+step,p.dark,5,.8);for(let k=0;k<6;k++){const a=Math.PI*2*k/6;line(out,s.w,s.h,cx,cy-60,cx+Math.cos(a)*34,cy-60+Math.sin(a)*34,p.glow,3,.7);}break;
    case 'kaiju':
      ellipse(out,s.w,s.h,cx-5,cy+5,88,66,p.mid,.98);ellipse(out,s.w,s.h,cx-66,cy-45,46,38,p.dark,.96);for(let k=0;k<6;k++)triangle(out,s.w,s.h,[cx-38+k*25,cy-53],[cx-27+k*25,cy-91-(k%2)*9],[cx-15+k*25,cy-49],p.light,.87);line(out,s.w,s.h,cx+63,cy+20,cx+139,cy-12-step,p.mid,28,.97);triangle(out,s.w,s.h,[cx-101,cy-34],[cx-137,cy-15],[cx-98,cy-7],p.accent,.92);break;
    case 'drone':
      ellipse(out,s.w,s.h,cx,cy,31,21,p.mid,.97);ellipse(out,s.w,s.h,cx,cy,9,8,p.accent,.95);for(const side of [-1,1])for(const y of [-20,20]){line(out,s.w,s.h,cx+side*20,cy,cx+side*59,cy+y,p.dark,5,.92);ellipse(out,s.w,s.h,cx+side*61,cy+y,20,5,p.light,.8);}break;
    case 'cutter':
      ellipse(out,s.w,s.h,cx-18,cy+6,34,24,p.mid,.95);gear(out,s.w,s.h,cx+38,cy+4,40,15,p.light,p.dark,rot*3);line(out,s.w,s.h,cx-37,cy+20,cx-55,cy+58+step,p.dark,10,.92);line(out,s.w,s.h,cx+3,cy+22,cx-5,cy+62-step,p.dark,10,.92);break;
    case 'shield':
      rect(out,s.w,s.h,cx-62,cy-76,cx+42,cy+57,p.dark,.98);ellipse(out,s.w,s.h,cx-10,cy-10,53,68,p.mid,.9);rect(out,s.w,s.h,cx-33,cy-53,cx+14,cy+35,p.light,.62);for(const side of [-1,1])line(out,s.w,s.h,cx+side*28,cy+52,cx+side*37,cy+96+step,p.dark,12,.96);break;
    case 'railpod':
      rect(out,s.w,s.h,cx-55,cy+5,cx+55,cy+45,p.mid,.97);for(const side of [-1,1])line(out,s.w,s.h,cx+side*35,cy+40,cx+side*70,cy+78,p.dark,9,.93);rect(out,s.w,s.h,cx-15,cy-35,cx+135,cy-16,p.dark,.98);rect(out,s.w,s.h,cx+38,cy-43,cx+145,cy-8,p.mid,.92);ellipse(out,s.w,s.h,cx+143,cy-25,13,12,p.accent,.9);break;
    case 'testframe':
      ellipse(out,s.w,s.h,cx,cy,48,62,p.dark,.96);ellipse(out,s.w,s.h,cx,cy-22,19,23,p.light,.76);for(let k=0;k<3;k++){const a=rot+Math.PI*2*k/3,x=cx+Math.cos(a)*102,y=cy+Math.sin(a)*72;gear(out,s.w,s.h,x,y,25,10,p.mid,p.light,-rot*2);line(out,s.w,s.h,cx,cy,x,y,p.accent,4,.45);}for(const side of [-1,1])line(out,s.w,s.h,cx+side*28,cy+48,cx+side*49,cy+114+step,p.mid,12,.9);break;
    case 'juvenile':
      ellipse(out,s.w,s.h,cx,cy+8,59,37,p.mid,.98);ellipse(out,s.w,s.h,cx-55,cy-22,31,25,p.dark,.96);for(let k=0;k<4;k++)triangle(out,s.w,s.h,[cx-22+k*22,cy-27],[cx-12+k*22,cy-54-(k%2)*8],[cx-2+k*22,cy-25],p.accent,.86);for(const side of [-1,1])line(out,s.w,s.h,cx+side*27,cy+32,cx+side*39,cy+77+step,p.dark,10,.94);break;
    case 'drake':
      ellipse(out,s.w,s.h,cx,cy+7,78,52,p.mid,.98);ellipse(out,s.w,s.h,cx-69,cy-41,39,31,p.dark,.96);triangle(out,s.w,s.h,[cx-22,cy-35],[cx+6,cy-117],[cx+39,cy-24],p.accent,.75);triangle(out,s.w,s.h,[cx+16,cy-31],[cx+75,cy-107],[cx+78,cy-7],p.accent,.72);line(out,s.w,s.h,cx+65,cy+22,cx+142,cy-21-step,p.mid,25,.94);break;
    case 'nightking':
      triangle(out,s.w,s.h,[cx-54,cy+88],[cx,cy-76],[cx+57,cy+88],p.dark,.95);ellipse(out,s.w,s.h,cx,cy-63,25,27,p.mid,.92);for(let k=-2;k<=2;k++)triangle(out,s.w,s.h,[cx+k*13-7,cy-84],[cx+k*13,cy-116-Math.abs(k)*5],[cx+k*13+7,cy-84],p.light,.87);for(const side of [-1,1])ellipse(out,s.w,s.h,cx+side*80,cy-4+step,15,20,p.glow,.45);break;
    case 'glasscastle':
      rect(out,s.w,s.h,cx-104,cy-15,cx+104,cy+88,p.mid,.75);for(let k=-2;k<=2;k++){const x=cx+k*43,h=70+(k%2?25:0);rect(out,s.w,s.h,x-17,cy-h,x+17,cy+45,p.light,.55);triangle(out,s.w,s.h,[x-22,cy-h],[x,cy-h-43],[x+22,cy-h],p.accent,.68);line(out,s.w,s.h,x-17,cy-h,x+16,cy+44,p.dark,3,.65);}ellipse(out,s.w,s.h,cx,cy+30,30,46,p.dark,.45);break;
    case 'machinecastle':
      rect(out,s.w,s.h,cx-110,cy-66,cx+110,cy+62,p.mid,.98);for(let k=-2;k<=2;k++){const x=cx+k*43;rect(out,s.w,s.h,x-15,cy-102-(Math.abs(k)%2)*18,x+15,cy-50,p.dark,.98);gear(out,s.w,s.h,x,cy-48,18,10,p.light,p.dark,rot*(k+1));}for(const side of [-1,1]){line(out,s.w,s.h,cx+side*70,cy+52,cx+side*88,cy+124+step,p.dark,20,.96);ellipse(out,s.w,s.h,cx+side*88,cy+125+step,28,9,p.light,.8);}break;
    case 'unobservable':
      for(let k=0;k<7;k++){const a=rot*.4+Math.PI*2*k/7,r=52+(k%3)*18,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.7;triangle(out,s.w,s.h,[x-13,y+18],[x+2,y-23],[x+18,y+11],k%2?p.mid:p.light,.66);}ellipse(out,s.w,s.h,cx,cy,27,37,p.dark,.35);for(let r=0;r<3;r++)ellipse(out,s.w,s.h,cx,cy,54+r*24,31+r*14,p.accent,.09);break;
    case 'porter':
      ellipse(out,s.w,s.h,cx,cy+5,29,46,p.mid,.96);ellipse(out,s.w,s.h,cx,cy-51,18,18,p.dark,.95);rect(out,s.w,s.h,cx+20,cy-42,cx+68,cy+25,p.light,.9);for(const side of [-1,1])line(out,s.w,s.h,cx+side*14,cy+43,cx+side*21,cy+86+step,p.dark,8,.94);break;
    case 'goldcart':
      rect(out,s.w,s.h,cx-64,cy-39,cx+66,cy+34,p.mid,.96);for(const x of [cx-42,cx+42])gear(out,s.w,s.h,x,cy+51,18,10,p.light,p.dark,rot);for(let k=0;k<4;k++)ellipse(out,s.w,s.h,cx-31+k*21,cy-5,9,9,p.glow,.8);break;
    case 'goldguard':
      ellipse(out,s.w,s.h,cx,cy-15,30,47,p.dark,.95);ellipse(out,s.w,s.h,cx,cy-67,19,20,p.mid,.94);ellipse(out,s.w,s.h,cx-43,cy-8,28,46,p.light,.85);line(out,s.w,s.h,cx+27,cy-55,cx+74,cy+67,p.accent,7,.95);for(const side of [-1,1])line(out,s.w,s.h,cx+side*15,cy+29,cx+side*21,cy+91+step,p.dark,9,.94);break;
    case 'goldtrain':
      for(let k=0;k<4;k++){const x=cx-105+k*58;rect(out,s.w,s.h,x-27,cy-28,x+27,cy+31,k===3?p.mid:p.dark,.96);gear(out,s.w,s.h,x-14,cy+43,11,8,p.light,p.dark,rot);gear(out,s.w,s.h,x+15,cy+43,11,8,p.light,p.dark,rot);}rect(out,s.w,s.h,cx+55,cy-68,cx+145,cy-48,p.accent,.95);break;
    case 'vaultgolem':
      rect(out,s.w,s.h,cx-65,cy-78,cx+65,cy+54,p.dark,.98);ellipse(out,s.w,s.h,cx,cy-15,43,43,p.mid,.95);gear(out,s.w,s.h,cx,cy-15,27,12,p.light,p.dark,rot);for(const side of [-1,1])line(out,s.w,s.h,cx+side*47,cy+45,cx+side*57,cy+113+step,p.dark,18,.96);break;
    case 'goldcarrier':
      ellipse(out,s.w,s.h,cx-8,cy+8,83,55,p.mid,.98);for(const x of [cx-38,cx+8,cx+51])rect(out,s.w,s.h,x-20,cy-72,x+20,cy-17,p.light,.88);ellipse(out,s.w,s.h,cx-75,cy-34,38,30,p.dark,.96);line(out,s.w,s.h,cx+67,cy+15,cx+139,cy-12-step,p.mid,24,.94);break;
    case 'wisp':
      ellipse(out,s.w,s.h,cx,cy,23,33,p.glow,.55);triangle(out,s.w,s.h,[cx-22,cy+8],[cx,cy-62-step],[cx+24,cy+8],p.accent,.58);for(let k=0;k<3;k++)ellipse(out,s.w,s.h,cx-28+k*28,cy+33+(k%2)*11,8,16,p.mid,.45);break;
    case 'soularmor':
      rect(out,s.w,s.h,cx-42,cy-51,cx+42,cy+42,p.mid,.8);ellipse(out,s.w,s.h,cx,cy-68,28,26,p.dark,.9);ellipse(out,s.w,s.h,cx,cy-5,22,34,p.glow,.35);for(const side of [-1,1])line(out,s.w,s.h,cx+side*26,cy+39,cx+side*37,cy+98+step,p.dark,12,.94);break;
    case 'soulhammer':
      ellipse(out,s.w,s.h,cx-30,cy,27,34,p.glow,.42);line(out,s.w,s.h,cx+5,cy+25,cx+78,cy-57-step,p.dark,11,.95);rect(out,s.w,s.h,cx+55,cy-80-step,cx+112,cy-40-step,p.mid,.92);ellipse(out,s.w,s.h,cx+83,cy-60-step,15,14,p.accent,.65);break;
    case 'chorus':
      for(let k=0;k<5;k++){const a=Math.PI*2*k/5,x=cx+Math.cos(a)*56,y=cy+Math.sin(a)*39+step;ellipse(out,s.w,s.h,x,y,21,24,p.mid,.72);ellipse(out,s.w,s.h,x+5,y,8,5,p.glow,.65);}ellipse(out,s.w,s.h,cx,cy,15,17,p.dark,.65);break;
    case 'soulfurnace':
      rect(out,s.w,s.h,cx-63,cy-65,cx+63,cy+52,p.dark,.98);ellipse(out,s.w,s.h,cx,cy-4,36,39,p.mid,.92);ellipse(out,s.w,s.h,cx,cy-4,18,23,p.glow,.55);for(let k=-2;k<=2;k++)line(out,s.w,s.h,cx+k*24,cy-65,cx+k*29,cy-113-(k%2)*12,p.accent,9,.6);break;
    case 'grandforge':
      rect(out,s.w,s.h,cx-104,cy-50,cx+104,cy+72,p.dark,.98);ellipse(out,s.w,s.h,cx,cy-36,76,47,p.mid,.92);ellipse(out,s.w,s.h,cx,cy-38,39,27,p.glow,.45);for(const side of [-1,1]){rect(out,s.w,s.h,cx+side*120-18,cy-95,cx+side*120+18,cy+64,p.mid,.9);ring(out,s.w,s.h,cx+side*120,cy-58,28,38,p.glow,.22);}break;
    case 'fragment':
      for(let k=0;k<5;k++){const x=cx-42+k*21,y=cy+((k%2)*18);triangle(out,s.w,s.h,[x-13,y+31],[x,y-42-step],[x+15,y+29],k%2?p.mid:p.light,.86);}ellipse(out,s.w,s.h,cx,cy+8,12,14,p.glow,.58);break;
    case 'sealguard':
      rect(out,s.w,s.h,cx-54,cy-74,cx+54,cy+57,p.mid,.95);ellipse(out,s.w,s.h,cx,cy-11,31,39,p.dark,.85);ring(out,s.w,s.h,cx,cy-11,26,34,p.glow,.3,4);for(const side of [-1,1])line(out,s.w,s.h,cx+side*35,cy+50,cx+side*43,cy+106+step,p.dark,14,.95);break;
    case 'keyeater':
      ellipse(out,s.w,s.h,cx,cy,37,23,p.mid,.94);ellipse(out,s.w,s.h,cx+36,cy-2,18,16,p.dark,.95);for(let k=0;k<3;k++)for(const side of [-1,1])line(out,s.w,s.h,cx+side*(12+k*10),cy+14,cx+side*(27+k*14),cy+48+step,p.dark,4,.9);line(out,s.w,s.h,cx+51,cy-3,cx+83,cy-3,p.light,6,.9);ellipse(out,s.w,s.h,cx+84,cy-3,9,9,p.accent,.8);break;
    case 'chainseal':
      ellipse(out,s.w,s.h,cx,cy,42,49,p.mid,.88);ring(out,s.w,s.h,cx,cy,30,37,p.glow,.28,4);for(const side of [-1,1])for(let k=0;k<4;k++)ellipse(out,s.w,s.h,cx+side*(49+k*21),cy-24+k*17+step,10,14,p.light,.55);break;
    case 'mirrorseal': {
      const shards=[[0,-58,20,34],[-36,-18,18,30],[34,-17,20,32],[-22,31,17,29],[25,31,18,28],[0,65,15,25]];for(let k=0;k<shards.length;k++){const [ox,oy,rx,ry]=shards[k],x=cx+ox+Math.sin(rot+k)*4,y=cy+oy+Math.cos(rot+k)*4;triangle(out,s.w,s.h,[x-rx,y+ry],[x,y-ry],[x+rx,y+ry*.5],p.light,.73);line(out,s.w,s.h,x-rx,y+ry,x,y-ry,p.dark,3,.7);}ellipse(out,s.w,s.h,cx,cy,17,22,p.accent,.42);break;
    }
    case 'glyphturret':
      rect(out,s.w,s.h,cx-42,cy+10,cx+42,cy+56,p.dark,.95);for(let r=0;r<3;r++)ring(out,s.w,s.h,cx,cy-37,35+r*23,18+r*12,p.glow,.14+.05*r,4);rect(out,s.w,s.h,cx-9,cy-96,cx+11,cy-31,p.mid,.95);for(const side of [-1,1])line(out,s.w,s.h,cx+side*28,cy+48,cx+side*65,cy+96,p.dark,8,.9);break;
    case 'midguardian':
      rect(out,s.w,s.h,cx-58,cy-72,cx+58,cy+51,p.mid,.97);ellipse(out,s.w,s.h,cx,cy-88,31,28,p.dark,.92);for(const side of [-1,1]){line(out,s.w,s.h,cx+side*49,cy-27,cx+side*87,cy+52,p.mid,18,.95);line(out,s.w,s.h,cx+side*30,cy+44,cx+side*39,cy+119+step,p.dark,18,.96);}ring(out,s.w,s.h,cx,cy-15,29,36,p.glow,.25,4);break;
    case 'gatekeeper':
      rect(out,s.w,s.h,cx-77,cy-91,cx+77,cy+83,p.dark,.96);rect(out,s.w,s.h,cx-42,cy-54,cx+42,cy+80,[0,0,0,255],.45);for(const side of [-1,1]){rect(out,s.w,s.h,cx+side*112-17,cy-111,cx+side*112+17,cy+87,p.mid,.92);ring(out,s.w,s.h,cx+side*112,cy-51,24,35,p.glow,.24,4);}ellipse(out,s.w,s.h,cx,cy-12,21,27,p.accent,.62);break;
    case 'shardling':
      ellipse(out,s.w,s.h,cx,cy+24,36,19,p.dark,.82);for(let k=-2;k<=2;k++)triangle(out,s.w,s.h,[cx+k*17-9,cy+21],[cx+k*17,cy-49-Math.abs(k)*7-step],[cx+k*17+9,cy+22],k%2?p.mid:p.light,.84);break;
    case 'mirrororb':
      ellipse(out,s.w,s.h,cx,cy,46,46,p.dark,.72);for(let k=0;k<6;k++){const a=rot+Math.PI*2*k/6,x=cx+Math.cos(a)*59,y=cy+Math.sin(a)*46;triangle(out,s.w,s.h,[x-12,y+17],[x,y-20],[x+15,y+10],p.light,.66);}ellipse(out,s.w,s.h,cx,cy,19,22,p.glow,.4);break;
    case 'observer':
      ring(out,s.w,s.h,cx,cy,70,45,p.mid,.35,6);ellipse(out,s.w,s.h,cx,cy,39,30,p.dark,.95);ellipse(out,s.w,s.h,cx+6,cy,16,19,p.glow,.75);for(let k=0;k<4;k++){const a=rot+Math.PI*2*k/4;triangle(out,s.w,s.h,[cx+Math.cos(a)*80-10,cy+Math.sin(a)*58+15],[cx+Math.cos(a)*98,cy+Math.sin(a)*72-18],[cx+Math.cos(a)*80+10,cy+Math.sin(a)*58+15],p.light,.65);}break;
    case 'nightfall':
      ellipse(out,s.w,s.h,cx,cy-14,89,89,p.dark,.96);ellipse(out,s.w,s.h,cx+29,cy-29,66,66,p.mid,.74);ellipse(out,s.w,s.h,cx+37,cy-34,43,43,[12,13,24,255],.95);for(let k=0;k<7;k++){const a=rot*.3+Math.PI*2*k/7,x=cx+Math.cos(a)*123,y=cy-14+Math.sin(a)*88;triangle(out,s.w,s.h,[x-12,y+18],[x,y-23],[x+13,y+14],p.accent,.68);}break;
  }
  sigil(out,s,id,cx,cy,p);
  if(m==='attack')drawAttack(out,id,s,i,n,cx,cy,p);
  if(m==='death'&&i>=Math.max(2,Math.floor(n*.45))){line(out,s.w,s.h,cx-s.w*.22,cy-s.h*.16,cx+s.w*.23,cy+s.h*.23,p.dark,6,.52);line(out,s.w,s.h,cx+s.w*.18,cy-s.h*.2,cx-s.w*.19,cy+s.h*.25,p.accent,3,.38);}
}
const RANGED=new Set(['jelly','railpod','testframe','nightking','glasscastle','unobservable','goldtrain','chorus','soulfurnace','grandforge','mirrorseal','glyphturret','mirrororb','observer','nightfall']);
const MULTI=new Set(['testframe','chorus','soulfurnace','grandforge','nightfall']);
const HEAVY=new Set(['kaiju','drake','machinecastle','vaultgolem','goldcarrier','midguardian','gatekeeper','shield']);
function drawAttack(out,id,s,i,n,cx,cy,p){
  const q=Math.min(1,i/Math.max(1,s.contact));
  ellipse(out,s.w,s.h,cx+Math.round(s.w*.20),cy-8,8+q*12,7+q*10,p.glow,.20+.45*q);
  if(i<s.contact)return;
  if(RANGED.has(s.shape)){
    const reach=Math.min(s.w*.46,145),y=cy-8;
    line(out,s.w,s.h,cx+s.w*.19,y,cx+reach,y,p.glow,5+(HEAVY.has(s.shape)?3:0),.72);
    if(MULTI.has(s.shape)&&i>s.contact){line(out,s.w,s.h,cx+s.w*.14,cy+18,cx+reach*.92,cy+35,p.accent,4,.56);line(out,s.w,s.h,cx+s.w*.12,cy-28,cx+reach*.86,cy-48,p.light,3,.5);}
  }else if(HEAVY.has(s.shape)){
    line(out,s.w,s.h,cx+s.w*.12,cy-5,cx+s.w*.35,cy+31,p.accent,13,.72);ellipse(out,s.w,s.h,cx+s.w*.36,cy+31,17,12,p.glow,.48);
  }else{
    triangle(out,s.w,s.h,[cx+s.w*.12,cy-32],[cx+s.w*.40,cy],[cx+s.w*.12,cy+28],p.glow,.62);
  }
}
const metadata={schemaVersion:2,batchId:BATCH,generator:'tools/materialize-special-content-production-art.mjs',generatorVersion:GENERATOR_VERSION,status:'UNREVIEWED_RUNTIME_FILES',humanReview:'PENDING',normalRuntimeAuthoritative:false,generativeAiUsed:false,sourcePolicy:'PROJECT_AUTHORED_DETERMINISTIC_ONLY',targets:{}};
for(const [unitId,spec] of Object.entries(TARGETS)){
  const dir=resolve(outputRoot,unitId);await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
  const meta={assetId:`unit:${unitId}`,sourceFamily:spec.family,projectAuthoredDeterministic:true,structuralRework:false,reviewStatus:'UNREVIEWED_RUNTIME_FILES',frameWidth:spec.w,frameHeight:spec.h,displayHeight:spec.displayHeight,attackContactFrame:spec.contact,motions:{}};
  for(let mi=0;mi<MOTIONS.length;mi++){
    const motion=MOTIONS[mi],count=spec.frames[mi],frames=[];for(let i=0;i<count;i++){const out=Buffer.alloc(spec.w*spec.h*4);drawMotif(out,unitId,spec,motion,i,count);frames.push(out);}
    const strip=assembleHorizontal(frames,spec.w,spec.h),png=encodePng(spec.w*count,spec.h,strip),path=resolve(dir,`${motion}.png`);await writeFile(path,png);meta.motions[motion]={frames:count,bytes:png.length,sha256:sha256(png)};
  }
  metadata.targets[unitId]=meta;
}
await mkdir(outputRoot,{recursive:true});
await writeFile(resolve(outputRoot,'special-content-runtime-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(`[special-content-production] materialized ${Object.keys(TARGETS).length} targets / ${Object.keys(TARGETS).length*MOTIONS.length} motion strips`);
