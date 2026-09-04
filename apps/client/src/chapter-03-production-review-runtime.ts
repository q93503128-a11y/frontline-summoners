import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT='/assets/production/units';
type FamilyKey='enemy_ch3_glasseye'|'enemy_ch3_spellbug'|'enemy_ch3_floating_library'|'enemy_ch3_inkdemon'|'enemy_ch3_chain_demon'|'enemy_ch3_contract_enforcer'|'enemy_ch3_arcane_battery'|'enemy_ch3_torn_mirror'|'boss_ch3_archmagus'|'boss_ch3_belzar';
const strip=(key:string,url:string,w:number,h:number,frames:number):SpriteStrip=>({key,url,frameWidth:w,frameHeight:h,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({id,displayHeight,attackContactFrame:contact,idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),knockback:strip(`${id}-kb`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4])});
const FAMILIES:Readonly<Record<FamilyKey,RuntimeArtFamily>>={
  enemy_ch3_glasseye:family('review-ch3-glasseye',182,3,'enemy_ch3_glasseye',210,200,[6,8,7,4,6]),
  enemy_ch3_spellbug:family('review-ch3-spellbug',142,1,'enemy_ch3_spellbug',180,150,[6,8,5,4,6]),
  enemy_ch3_floating_library:family('review-ch3-floating-library',222,5,'enemy_ch3_floating_library',300,240,[7,8,8,4,7]),
  enemy_ch3_inkdemon:family('review-ch3-inkdemon',154,3,'enemy_ch3_inkdemon',210,160,[6,8,7,4,6]),
  enemy_ch3_chain_demon:family('review-ch3-chain-demon',214,4,'enemy_ch3_chain_demon',260,230,[6,8,8,4,7]),
  enemy_ch3_contract_enforcer:family('review-ch3-contract-enforcer',232,3,'enemy_ch3_contract_enforcer',270,250,[7,8,7,4,8]),
  enemy_ch3_arcane_battery:family('review-ch3-arcane-battery',218,5,'enemy_ch3_arcane_battery',330,240,[6,8,8,4,7]),
  enemy_ch3_torn_mirror:family('review-ch3-torn-mirror',226,3,'enemy_ch3_torn_mirror',280,250,[7,8,8,4,7]),
  boss_ch3_archmagus:family('review-ch3-archmagus',296,6,'boss_ch3_archmagus',380,320,[8,8,9,4,8]),
  boss_ch3_belzar:family('review-ch3-belzar',288,4,'boss_ch3_belzar',360,310,[8,8,8,4,8]),
};
const FX:Readonly<Record<FamilyKey,AttackFxStyle>>={
  enemy_ch3_glasseye:'MAGIC',enemy_ch3_spellbug:'SLASH',enemy_ch3_floating_library:'MAGIC',enemy_ch3_inkdemon:'VOID',enemy_ch3_chain_demon:'BLUNT',enemy_ch3_contract_enforcer:'BLUNT',enemy_ch3_arcane_battery:'MAGIC',enemy_ch3_torn_mirror:'VOID',boss_ch3_archmagus:'MAGIC',boss_ch3_belzar:'SLASH',
};
const all=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
const keys=new Set<FamilyKey>(Object.keys(FAMILIES) as FamilyKey[]);
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
export function isChapter03ProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='chapter-03';}
export function getChapter03ReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...all(f)]);}
function keyForUnit(id:string):FamilyKey|undefined{return keys.has(id as FamilyKey)?id as FamilyKey:undefined;}
interface View{readonly sprite:Phaser.GameObjects.Sprite;readonly hpBg?:Phaser.GameObjects.Rectangle;readonly hp?:Phaser.GameObjects.Rectangle;readonly trait?:Phaser.GameObjects.Text;}
interface Host{state:PlayableBattleState;views:Map<number,View>;syncUnits():void;playAttackFx(unit:BattleUnit,view:View,style:AttackFxStyle):void;}
const MARK=Symbol('chapter-03-production-review');type Installable=Phaser.Scene&Host&{[MARK]?:boolean};
function anchor(view:View,f:RuntimeArtFamily,key:FamilyKey){const boss=key.startsWith('boss_ch3_'),top=view.sprite.y-f.displayHeight*.5,hpY=Math.max(126,top-(boss?17:10));if(view.hpBg){view.hpBg.y=hpY;view.hpBg.setDepth(boss?9:6);}if(view.hp){view.hp.y=hpY;view.hp.setDepth(boss?10:7);}if(view.trait){view.trait.y=hpY-22;view.trait.setDepth(boss?11:8);}}
export function installChapter03ProductionReviewRuntime(scene:Phaser.Scene):void{
  if(!isChapter03ProductionReviewMode())return;const host=scene as Installable;if(host[MARK])return;const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('chapter-03 review requires BattleScene hooks');host[MARK]=true;
  host.playAttackFx=(unit,view,style)=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?FX[key]:style);};
  host.syncUnits=()=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();anchor(view,f,key);}};
}
export function renderChapter03ProductionReviewLayer(scene:Phaser.Scene):void{
  if(!isChapter03ProductionReviewMode())return;scene.add.rectangle(640,137,1120,74,0x11131a,.92).setStrokeStyle(2,0x7e86b8,.9).setDepth(190);
  scene.add.text(135,137,'CHAPTER 3\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#e2e5f2',align:'center'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,128,'마도도시 세라페 · ARCANE ↔ DEMON',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'15px',color:'#d9ddf3'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,151,'10 신규 적/보스 · 50 motion strips · 기존 전장 6테마 재사용',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#adb3cf'}).setOrigin(.5).setDepth(191);
  scene.add.text(1080,137,'ST10 대마도장\nST18~20 벨자르',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#d2bd91',align:'center'}).setOrigin(.5).setDepth(191);
}
