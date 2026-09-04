import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };

const ROOT='/assets/production/units';
interface RecruitmentArtUnit {readonly id:string;readonly rarity:'C'|'B'|'A'|'S'|'SS';readonly role:string;readonly seriesId:string;readonly attributes:readonly string[];readonly combatTags:readonly string[];readonly hitFrames:readonly number[];readonly cycleFrames:number;readonly backswingFrames:number;}
const ROSTER=recruitmentUnitsJson as readonly RecruitmentArtUnit[];
const FRAME_BY_RARITY={C:[6,8,6,4,6],B:[7,8,7,4,7],A:[7,8,8,4,7],S:[8,8,9,4,8],SS:[8,8,11,4,9]} as const;
interface Spec{readonly h:number;readonly c:number;readonly w:number;readonly fh:number;readonly f:readonly [number,number,number,number,number];readonly fx:AttackFxStyle;}
function fxFor(unit:RecruitmentArtUnit):AttackFxStyle{if(unit.attributes.includes('ANOMALY')||unit.attributes.includes('UNDEAD'))return'VOID';if(unit.attributes.includes('MACHINE')||unit.role==='결정타'||unit.role==='광역'||unit.role==='변칙')return'MAGIC';if(unit.role==='전열'||unit.role==='물량')return'SLASH';return'BLUNT';}
function specFor(unit:RecruitmentArtUnit):Spec{
  const frames=FRAME_BY_RARITY[unit.rarity];const giant=unit.combatTags.includes('GIANT'),structure=unit.combatTags.includes('STRUCTURE'),floating=unit.combatTags.includes('FLOATING');
  let w=unit.rarity==='C'?220:unit.rarity==='B'?235:unit.rarity==='A'?255:285;let h=unit.rarity==='C'?200:unit.rarity==='B'?220:unit.rarity==='A'?235:255;
  if(unit.seriesId==='series_02_primordial_titans'){w+=45;h+=25;}if(unit.seriesId==='series_03_zero_edge'){w+=25;h+=15;}if(giant){w+=45;h+=45;}if(structure){w+=55;h+=20;}if(floating){h+=20;}if(unit.rarity==='SS'){w=Math.max(w,350);h=Math.max(h,305);}w=Math.min(390,w);h=Math.min(330,h);
  const firstHit=unit.hitFrames[0]??1,activeWindow=Math.max(firstHit+1,unit.cycleFrames-unit.backswingFrames),contact=Math.max(1,Math.min(frames[2]-2,Math.round((firstHit/activeWindow)*(frames[2]-1))));return{h:h-18,c:contact,w,fh:h,f:frames,fx:fxFor(unit)};
}
const SPECS:Readonly<Record<string,Spec>>=Object.fromEntries(ROSTER.map((unit)=>[unit.id,specFor(unit)]));
const strip=(key:string,url:string,w:number,h:number,frames:number):SpriteStrip=>({key,url,frameWidth:w,frameHeight:h,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({id,displayHeight,attackContactFrame:contact,idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),knockback:strip(`${id}-kb`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4])});
const FAMILIES:Record<string,RuntimeArtFamily>={};const FX:Record<string,AttackFxStyle>={};for(const unit of ROSTER){const s=SPECS[unit.id];if(!s)continue;FAMILIES[unit.id]=family(`review-recruitment-${unit.id}`,s.h,s.c,unit.id,s.w,s.fh,s.f);FX[unit.id]=s.fx;}
const all=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
export function isRecruitmentProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='recruitment';}
export function getRecruitmentReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...all(f)]);}
function keyForUnit(id:string):string|undefined{return FAMILIES[id]?id:undefined;}
interface View{readonly sprite:Phaser.GameObjects.Sprite;readonly hpBg?:Phaser.GameObjects.Rectangle;readonly hp?:Phaser.GameObjects.Rectangle;readonly trait?:Phaser.GameObjects.Text;}
interface Host{state:PlayableBattleState;views:Map<number,View>;syncUnits():void;playAttackFx(unit:BattleUnit,view:View,style:AttackFxStyle):void;}
const MARK=Symbol('recruitment-production-review');type Installable=Phaser.Scene&Host&{[MARK]?:boolean};
function anchor(view:View,f:RuntimeArtFamily){const top=view.sprite.y-f.displayHeight*.5,hpY=Math.max(126,top-10);if(view.hpBg){view.hpBg.y=hpY;view.hpBg.setDepth(6);}if(view.hp){view.hp.y=hpY;view.hp.setDepth(7);}if(view.trait){view.trait.y=hpY-22;view.trait.setDepth(8);}}
export function installRecruitmentProductionReviewRuntime(scene:Phaser.Scene):void{
  if(!isRecruitmentProductionReviewMode())return;const host=scene as Installable;if(host[MARK])return;const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('recruitment review requires BattleScene hooks');host[MARK]=true;
  host.playAttackFx=(unit,view,style)=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?(FX[key]??style):style);};
  host.syncUnits=()=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!f||!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();anchor(view,f);}};
}
export function renderRecruitmentProductionReviewLayer(scene:Phaser.Scene):void{
  if(!isRecruitmentProductionReviewMode())return;scene.add.rectangle(640,137,1120,74,0x11131a,.92).setStrokeStyle(2,0xa58d58,.9).setDepth(190);
  scene.add.text(135,137,'RECRUITMENT\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#f2eee5',align:'center'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,128,'모집 캐릭터 · COMMON + SERIES 01/02/03',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'15px',color:'#eadfca'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,151,'33 모집 캐릭터 · 165 motion strips · 전장 신규 생성 없음',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#bbb4a7'}).setOrigin(.5).setDepth(191);
  scene.add.text(1080,137,'공용 15종\n시리즈 18종',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#dfc37f',align:'center'}).setOrigin(.5).setDepth(191);
}
