import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT='/assets/production/units';
type FamilyKey='enemy_ch4_sawbird'|'enemy_ch4_magnet_spider'|'enemy_ch4_railworm'|'enemy_ch4_furnace_golem'|'enemy_ch4_folded_soldier'|'enemy_ch4_error_mass'|'enemy_ch4_void_lens'|'enemy_ch4_fusion_cavalry'|'boss_ch4_moving_throne'|'boss_ch4_zero_engine';
const strip=(key:string,url:string,w:number,h:number,frames:number):SpriteStrip=>({key,url,frameWidth:w,frameHeight:h,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({id,displayHeight,attackContactFrame:contact,idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),knockback:strip(`${id}-kb`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4])});
const FAMILIES:Readonly<Record<FamilyKey,RuntimeArtFamily>>={
  enemy_ch4_sawbird:family('review-ch4-sawbird',164,2,'enemy_ch4_sawbird',220,180,[6,8,6,4,6]),
  enemy_ch4_magnet_spider:family('review-ch4-magnet-spider',176,3,'enemy_ch4_magnet_spider',240,190,[6,8,7,4,6]),
  enemy_ch4_railworm:family('review-ch4-railworm',194,6,'enemy_ch4_railworm',360,210,[6,7,9,4,7]),
  enemy_ch4_furnace_golem:family('review-ch4-furnace-golem',258,4,'enemy_ch4_furnace_golem',300,280,[7,8,8,4,8]),
  enemy_ch4_folded_soldier:family('review-ch4-folded-soldier',220,2,'enemy_ch4_folded_soldier',230,240,[6,8,6,4,7]),
  enemy_ch4_error_mass:family('review-ch4-error-mass',204,2,'enemy_ch4_error_mass',260,220,[7,8,8,4,7]),
  enemy_ch4_void_lens:family('review-ch4-void-lens',222,5,'enemy_ch4_void_lens',280,240,[7,8,8,4,7]),
  enemy_ch4_fusion_cavalry:family('review-ch4-fusion-cavalry',230,2,'enemy_ch4_fusion_cavalry',320,250,[7,8,7,4,8]),
  boss_ch4_moving_throne:family('review-ch4-moving-throne',300,5,'boss_ch4_moving_throne',410,330,[8,8,9,4,8]),
  boss_ch4_zero_engine:family('review-ch4-zero-engine',310,4,'boss_ch4_zero_engine',420,340,[8,8,11,4,9]),
};
const FX:Readonly<Record<FamilyKey,AttackFxStyle>>={
  enemy_ch4_sawbird:'SLASH',enemy_ch4_magnet_spider:'MAGIC',enemy_ch4_railworm:'MAGIC',enemy_ch4_furnace_golem:'BLUNT',enemy_ch4_folded_soldier:'SLASH',enemy_ch4_error_mass:'VOID',enemy_ch4_void_lens:'VOID',enemy_ch4_fusion_cavalry:'SLASH',boss_ch4_moving_throne:'BLUNT',boss_ch4_zero_engine:'VOID',
};
const all=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
const keys=new Set<FamilyKey>(Object.keys(FAMILIES) as FamilyKey[]);
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
export function isChapter04ProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='chapter-04';}
export function getChapter04ReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...all(f)]);}
function keyForUnit(id:string):FamilyKey|undefined{return keys.has(id as FamilyKey)?id as FamilyKey:undefined;}
interface View{readonly sprite:Phaser.GameObjects.Sprite;readonly hpBg?:Phaser.GameObjects.Rectangle;readonly hp?:Phaser.GameObjects.Rectangle;readonly trait?:Phaser.GameObjects.Text;}
interface Host{state:PlayableBattleState;views:Map<number,View>;syncUnits():void;playAttackFx(unit:BattleUnit,view:View,style:AttackFxStyle):void;}
const MARK=Symbol('chapter-04-production-review');type Installable=Phaser.Scene&Host&{[MARK]?:boolean};
function anchor(view:View,f:RuntimeArtFamily,key:FamilyKey){const boss=key.startsWith('boss_ch4_'),top=view.sprite.y-f.displayHeight*.5,hpY=Math.max(126,top-(boss?17:10));if(view.hpBg){view.hpBg.y=hpY;view.hpBg.setDepth(boss?9:6);}if(view.hp){view.hp.y=hpY;view.hp.setDepth(boss?10:7);}if(view.trait){view.trait.y=hpY-22;view.trait.setDepth(boss?11:8);}}
export function installChapter04ProductionReviewRuntime(scene:Phaser.Scene):void{
  if(!isChapter04ProductionReviewMode())return;const host=scene as Installable;if(host[MARK])return;const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('chapter-04 review requires BattleScene hooks');host[MARK]=true;
  host.playAttackFx=(unit,view,style)=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?FX[key]:style);};
  host.syncUnits=()=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();anchor(view,f,key);}};
}
export function renderChapter04ProductionReviewLayer(scene:Phaser.Scene):void{
  if(!isChapter04ProductionReviewMode())return;scene.add.rectangle(640,137,1120,74,0x101318,.92).setStrokeStyle(2,0x8d744d,.9).setDepth(190);
  scene.add.text(135,137,'CHAPTER 4\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#ece6da',align:'center'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,128,'기어 제국의 균열 · MACHINE ↔ ANOMALY',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'15px',color:'#ead9b8'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,151,'10 신규 적/보스 · 50 motion strips · 기존 전장 6테마 재사용',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#bbb2a0'}).setOrigin(.5).setDepth(191);
  scene.add.text(1080,137,'ST10/18 이동왕좌\nST19~20 공허엔진 제로',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#dfbd76',align:'center'}).setOrigin(.5).setDepth(191);
}
