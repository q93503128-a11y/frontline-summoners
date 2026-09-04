import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT='/assets/production/units';
const SPECS={
  enemy_ev_sand_crab:{h:138,c:2,w:200,fh:150,f:[6,8,6,4,6],fx:'SLASH'},
  enemy_ev_foodcart:{h:202,c:3,w:280,fh:220,f:[7,8,7,4,7],fx:'BLUNT'},
  enemy_ev_tailbeast:{h:194,c:3,w:280,fh:210,f:[7,8,7,4,7],fx:'BLUNT'},
  enemy_ev_firework_jelly:{h:218,c:5,w:260,fh:240,f:[7,8,9,4,7],fx:'MAGIC'},
  boss_ev_summer_kaiju:{h:294,c:3,w:390,fh:320,f:[8,8,10,4,9],fx:'BLUNT'},
  enemy_ev_ze_drone:{h:156,c:2,w:210,fh:170,f:[6,8,6,4,6],fx:'MAGIC'},
  enemy_ev_ze_scrap_blade:{h:166,c:2,w:220,fh:180,f:[6,8,6,4,6],fx:'SLASH'},
  enemy_ev_ze_shield:{h:212,c:3,w:260,fh:230,f:[7,8,7,4,7],fx:'BLUNT'},
  enemy_ev_ze_railpod:{h:202,c:5,w:340,fh:220,f:[6,7,9,4,7],fx:'MAGIC'},
  boss_ev_ze_testframe:{h:302,c:3,w:400,fh:330,f:[8,8,11,4,9],fx:'MAGIC'},
  enemy_sp_glutton_juvenile:{h:212,c:2,w:280,fh:230,f:[7,8,7,4,7],fx:'SLASH'},
  boss_sp_glutton_drake:{h:312,c:3,w:410,fh:340,f:[8,8,10,4,9],fx:'BLUNT'},
  boss_sp_undying_night:{h:302,c:4,w:360,fh:330,f:[8,8,9,4,9],fx:'VOID'},
  boss_sp_glass_castle:{h:318,c:4,w:430,fh:350,f:[8,8,10,4,9],fx:'MAGIC'},
  boss_sp_walking_machine_castle:{h:320,c:4,w:440,fh:350,f:[8,8,10,4,9],fx:'BLUNT'},
  boss_sp_unobservable:{h:300,c:3,w:370,fh:330,f:[8,8,10,4,9],fx:'VOID'},
  enemy_sp_gold_porter:{h:174,c:2,w:200,fh:190,f:[6,8,6,4,6],fx:'BLUNT'},
  enemy_sp_gold_cart:{h:184,c:3,w:270,fh:200,f:[6,8,7,4,7],fx:'BLUNT'},
  enemy_sp_gold_guard:{h:212,c:3,w:240,fh:230,f:[7,8,7,4,7],fx:'SLASH'},
  enemy_sp_gold_train:{h:202,c:4,w:360,fh:220,f:[7,8,8,4,7],fx:'MAGIC'},
  enemy_sp_gold_vault_golem:{h:266,c:4,w:310,fh:290,f:[7,8,8,4,8],fx:'BLUNT'},
  boss_sp_gold_carrier:{h:302,c:3,w:400,fh:330,f:[8,8,10,4,9],fx:'BLUNT'},
  enemy_sp_soul_wisp:{h:164,c:1,w:190,fh:180,f:[6,8,5,4,6],fx:'VOID'},
  enemy_sp_soul_armor:{h:220,c:3,w:250,fh:240,f:[7,8,7,4,7],fx:'BLUNT'},
  enemy_sp_soul_hammer:{h:212,c:3,w:270,fh:230,f:[7,8,7,4,7],fx:'BLUNT'},
  enemy_sp_soul_chorus:{h:202,c:2,w:280,fh:220,f:[7,8,8,4,7],fx:'MAGIC'},
  enemy_sp_soul_furnace:{h:230,c:3,w:320,fh:250,f:[7,8,9,4,8],fx:'VOID'},
  boss_sp_soul_grand_forge:{h:320,c:4,w:420,fh:350,f:[8,8,11,4,9],fx:'MAGIC'},
  enemy_sp_evo_fragment:{h:156,c:2,w:190,fh:170,f:[6,8,6,4,6],fx:'MAGIC'},
  enemy_sp_evo_seal_guard:{h:230,c:3,w:260,fh:250,f:[7,8,7,4,7],fx:'BLUNT'},
  enemy_sp_evo_keyeater:{h:148,c:1,w:200,fh:160,f:[6,8,5,4,6],fx:'SLASH'},
  enemy_sp_evo_chain_seal:{h:220,c:3,w:270,fh:240,f:[7,8,7,4,7],fx:'BLUNT'},
  enemy_sp_evo_mirror_seal:{h:228,c:4,w:280,fh:250,f:[7,8,8,4,7],fx:'VOID'},
  enemy_sp_evo_glyph_turret:{h:220,c:5,w:330,fh:240,f:[7,8,9,4,7],fx:'MAGIC'},
  enemy_sp_evo_mid_guardian:{h:276,c:4,w:330,fh:300,f:[8,8,8,4,8],fx:'BLUNT'},
  boss_sp_evo_gatekeeper:{h:312,c:3,w:410,fh:340,f:[8,8,11,4,9],fx:'MAGIC'},
  enemy_sp_rift_shardling:{h:164,c:2,w:200,fh:180,f:[6,8,6,4,6],fx:'VOID'},
  enemy_sp_rift_mirror_orb:{h:212,c:3,w:260,fh:230,f:[7,8,8,4,7],fx:'VOID'},
  enemy_sp_rift_observer:{h:238,c:5,w:300,fh:260,f:[7,8,9,4,7],fx:'MAGIC'},
  boss_sp_rift_nightfall:{h:310,c:3,w:400,fh:340,f:[8,8,11,4,9],fx:'VOID'},
} as const;
type FamilyKey=keyof typeof SPECS;
const strip=(key:string,url:string,w:number,h:number,frames:number):SpriteStrip=>({key,url,frameWidth:w,frameHeight:h,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({id,displayHeight,attackContactFrame:contact,idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),knockback:strip(`${id}-kb`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4])});
const FAMILIES={} as Record<FamilyKey,RuntimeArtFamily>;
const FX={} as Record<FamilyKey,AttackFxStyle>;
for(const key of Object.keys(SPECS) as FamilyKey[]){const s=SPECS[key];FAMILIES[key]=family(`review-special-${key}`,s.h,s.c,key,s.w,s.fh,s.f);FX[key]=s.fx;}
const all=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
const keys=new Set<FamilyKey>(Object.keys(FAMILIES) as FamilyKey[]);
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
export function isSpecialContentProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='special-content';}
export function getSpecialContentReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...all(f)]);}
function keyForUnit(id:string):FamilyKey|undefined{return keys.has(id as FamilyKey)?id as FamilyKey:undefined;}
interface View{readonly sprite:Phaser.GameObjects.Sprite;readonly hpBg?:Phaser.GameObjects.Rectangle;readonly hp?:Phaser.GameObjects.Rectangle;readonly trait?:Phaser.GameObjects.Text;}
interface Host{state:PlayableBattleState;views:Map<number,View>;syncUnits():void;playAttackFx(unit:BattleUnit,view:View,style:AttackFxStyle):void;}
const MARK=Symbol('special-content-production-review');type Installable=Phaser.Scene&Host&{[MARK]?:boolean};
function anchor(view:View,f:RuntimeArtFamily,key:FamilyKey){const boss=key.startsWith('boss_'),top=view.sprite.y-f.displayHeight*.5,hpY=Math.max(126,top-(boss?17:10));if(view.hpBg){view.hpBg.y=hpY;view.hpBg.setDepth(boss?9:6);}if(view.hp){view.hp.y=hpY;view.hp.setDepth(boss?10:7);}if(view.trait){view.trait.y=hpY-22;view.trait.setDepth(boss?11:8);}}
export function installSpecialContentProductionReviewRuntime(scene:Phaser.Scene):void{
  if(!isSpecialContentProductionReviewMode())return;const host=scene as Installable;if(host[MARK])return;const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('special-content review requires BattleScene hooks');host[MARK]=true;
  host.playAttackFx=(unit,view,style)=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?FX[key]:style);};
  host.syncUnits=()=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();anchor(view,f,key);}};
}
export function renderSpecialContentProductionReviewLayer(scene:Phaser.Scene):void{
  if(!isSpecialContentProductionReviewMode())return;scene.add.rectangle(640,137,1120,74,0x11131a,.92).setStrokeStyle(2,0x8170a6,.9).setDepth(190);
  scene.add.text(135,137,'SPECIAL\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#eee9f6',align:'center'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,128,'특수 콘텐츠 · EVENT + PERMANENT',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'15px',color:'#e6dcf5'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,151,'40 전용 적/보스 · 200 motion strips · 기존 전장 7테마 재사용',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#bdb4cc'}).setOrigin(.5).setDepth(191);
  scene.add.text(1080,137,'이벤트 10종\n영구 특수 30종',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#d6bd82',align:'center'}).setOrigin(.5).setDepth(191);
}
