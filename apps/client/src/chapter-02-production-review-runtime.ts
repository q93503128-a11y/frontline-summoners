import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT='/assets/production/units';
type FamilyKey='enemy_ch2_mossboar'|'enemy_ch2_umbrella'|'enemy_ch2_vinerider'|'enemy_ch2_seedbattery'|'enemy_ch2_bonewheel'|'enemy_ch2_coffinbug'|'enemy_ch2_gravebell'|'enemy_ch2_revivedarmor'|'boss_ch2_rootwidow'|'boss_ch2_funeral_king';
const strip=(key:string,url:string,w:number,h:number,frames:number):SpriteStrip=>({key,url,frameWidth:w,frameHeight:h,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({id,displayHeight,attackContactFrame:contact,idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),knockback:strip(`${id}-kb`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4])});
const FAMILIES:Readonly<Record<FamilyKey,RuntimeArtFamily>>={
  enemy_ch2_mossboar:family('review-ch2-mossboar',176,2,'enemy_ch2_mossboar',230,170,[6,8,6,4,6]),
  enemy_ch2_umbrella:family('review-ch2-umbrella',164,3,'enemy_ch2_umbrella',190,180,[6,8,7,4,6]),
  enemy_ch2_vinerider:family('review-ch2-vinerider',190,3,'enemy_ch2_vinerider',250,190,[6,8,7,4,6]),
  enemy_ch2_seedbattery:family('review-ch2-seedbattery',188,4,'enemy_ch2_seedbattery',250,200,[6,8,8,4,7]),
  enemy_ch2_bonewheel:family('review-ch2-bonewheel',152,1,'enemy_ch2_bonewheel',180,160,[6,8,5,4,6]),
  enemy_ch2_coffinbug:family('review-ch2-coffinbug',194,2,'enemy_ch2_coffinbug',230,180,[6,8,6,4,7]),
  enemy_ch2_gravebell:family('review-ch2-gravebell',204,4,'enemy_ch2_gravebell',230,220,[6,8,8,4,7]),
  enemy_ch2_revivedarmor:family('review-ch2-revivedarmor',210,2,'enemy_ch2_revivedarmor',230,220,[6,8,6,4,8]),
  boss_ch2_rootwidow:family('review-ch2-rootwidow',268,4,'boss_ch2_rootwidow',320,280,[8,8,8,4,8]),
  boss_ch2_funeral_king:family('review-ch2-funeral-king',276,5,'boss_ch2_funeral_king',330,290,[8,8,8,4,8]),
};
const FX:Readonly<Record<FamilyKey,AttackFxStyle>>={
  enemy_ch2_mossboar:'BLUNT',enemy_ch2_umbrella:'MAGIC',enemy_ch2_vinerider:'PIERCE',enemy_ch2_seedbattery:'MAGIC',
  enemy_ch2_bonewheel:'BLUNT',enemy_ch2_coffinbug:'BLUNT',enemy_ch2_gravebell:'MAGIC',enemy_ch2_revivedarmor:'SLASH',
  boss_ch2_rootwidow:'PIERCE',boss_ch2_funeral_king:'BLUNT',
};
const all=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
const keys=new Set<FamilyKey>(Object.keys(FAMILIES) as FamilyKey[]);
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
export function isChapter02ProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='chapter-02';}
export function getChapter02ReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...all(f)]);}
function keyForUnit(id:string):FamilyKey|undefined{return keys.has(id as FamilyKey)?id as FamilyKey:undefined;}
interface View{readonly sprite:Phaser.GameObjects.Sprite;readonly hpBg?:Phaser.GameObjects.Rectangle;readonly hp?:Phaser.GameObjects.Rectangle;readonly trait?:Phaser.GameObjects.Text;}
interface Host{state:PlayableBattleState;views:Map<number,View>;syncUnits():void;playAttackFx(unit:BattleUnit,view:View,style:AttackFxStyle):void;}
const MARK=Symbol('chapter-02-production-review');type Installable=Phaser.Scene&Host&{[MARK]?:boolean};
function anchor(view:View,f:RuntimeArtFamily,key:FamilyKey){const boss=key.startsWith('boss_ch2_'),top=view.sprite.y-f.displayHeight*.5,hpY=Math.max(126,top-(boss?16:10));if(view.hpBg){view.hpBg.y=hpY;view.hpBg.setDepth(boss?9:6);}if(view.hp){view.hp.y=hpY;view.hp.setDepth(boss?10:7);}if(view.trait){view.trait.y=hpY-22;view.trait.setDepth(boss?11:8);}}
export function installChapter02ProductionReviewRuntime(scene:Phaser.Scene):void{
  if(!isChapter02ProductionReviewMode())return;const host=scene as Installable;if(host[MARK])return;
  const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('chapter-02 review requires BattleScene hooks');host[MARK]=true;
  host.playAttackFx=(unit,view,style)=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?FX[key]:style);};
  host.syncUnits=()=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();anchor(view,f,key);}};
}
export function renderChapter02ProductionReviewLayer(scene:Phaser.Scene):void{
  if(!isChapter02ProductionReviewMode())return;
  scene.add.rectangle(640,137,1120,74,0x111715,.92).setStrokeStyle(2,0x7f9b78,.9).setDepth(190);
  scene.add.text(135,137,'CHAPTER 2\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#e2eadf',align:'center'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,128,'뒤틀린 숲 · NATURE → UNDEAD',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'15px',color:'#d6e2ce'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,151,'10 신규 적/보스 · 50 motion strips · 기존 전장 5테마 재사용',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#aebda9'}).setOrigin(.5).setDepth(191);
  scene.add.text(1080,137,'ST10 뿌리과부\nST19~20 장의왕',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#c6b68f',align:'center'}).setOrigin(.5).setDepth(191);
}
