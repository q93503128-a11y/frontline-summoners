import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT='/assets/production/units';
type PyromancerForm='pyromancer_f1'|'pyromancer_f2'|'pyromancer_f3';
type RoyalForm='royal_f1'|'royal_f2'|'royal_f3';
type FamilyKey=PyromancerForm|RoyalForm|'enemy-berserker'|'enemy-knight';
const strip=(key:string,url:string,frameWidth:number,frameHeight:number,frames:number):SpriteStrip=>({key,url,frameWidth,frameHeight,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({
  id,displayHeight,attackContactFrame:contact,
  idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),
  run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),
  attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),
  knockback:strip(`${id}-knockback`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),
  death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4]),
});
const FAMILIES:Readonly<Record<FamilyKey,RuntimeArtFamily>>={
  pyromancer_f1:family('review-pyromancer-f1',192,5,'pyromancer/pyromancer_f1',300,260,[8,8,8,3,7]),
  pyromancer_f2:family('review-pyromancer-f2',202,5,'pyromancer/pyromancer_f2',310,260,[8,8,8,3,7]),
  pyromancer_f3:family('review-pyromancer-f3',214,5,'pyromancer/pyromancer_f3',330,270,[8,8,8,3,7]),
  royal_f1:family('review-royal-f1',212,4,'royal/royal_f1',250,205,[11,8,7,4,11]),
  royal_f2:family('review-royal-f2',220,4,'royal/royal_f2',255,210,[11,8,7,4,11]),
  royal_f3:family('review-royal-f3',216,4,'royal/royal_f3',265,205,[11,8,7,4,11]),
  'enemy-berserker':family('review-enemy-berserker',204,4,'enemy-berserker',255,185,[10,8,7,3,7]),
  'enemy-knight':family('review-enemy-knight',176,3,'enemy-knight',230,150,[6,8,6,4,6]),
};
const ATTACK_FX:Readonly<Record<FamilyKey,AttackFxStyle>>={
  pyromancer_f1:'FIRE',pyromancer_f2:'FIRE',pyromancer_f3:'FIRE',
  royal_f1:'SLASH',royal_f2:'SLASH',royal_f3:'SLASH',
  'enemy-berserker':'BLUNT','enemy-knight':'BLUNT',
};
const allStrips=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
function parseForm<T extends string>(value:string|null,prefix:string):T|undefined{if(value==='f1'||value===`${prefix}_f1`)return `${prefix}_f1` as T;if(value==='f2'||value===`${prefix}_f2`)return `${prefix}_f2` as T;if(value==='f3'||value===`${prefix}_f3`)return `${prefix}_f3` as T;return undefined;}
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
let forcedPyromancer=parseForm<PyromancerForm>(query().get('pyromancerForm'),'pyromancer');
let forcedRoyal=parseForm<RoyalForm>(query().get('royalForm'),'royal');
export function isFourthSliceProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='fourth-slice';}
export function getFourthSliceReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...allStrips(f)]);}
function keyForUnit(unitId:string):FamilyKey|undefined{
  if(unitId==='pyromancer')return forcedPyromancer??parseForm<PyromancerForm>(getActiveVisualFormId('pyromancer')??null,'pyromancer')??'pyromancer_f1';
  if(unitId==='royal')return forcedRoyal??parseForm<RoyalForm>(getActiveVisualFormId('royal')??null,'royal')??'royal_f1';
  if(unitId==='enemy-berserker'||unitId==='enemy-knight')return unitId;
  return undefined;
}
interface ReviewUnitView{readonly sprite:Phaser.GameObjects.Sprite;}
interface ReviewHost{state:PlayableBattleState;views:Map<number,ReviewUnitView>;syncUnits():void;playAttackFx(unit:BattleUnit,view:ReviewUnitView,style:AttackFxStyle):void;}
const INSTALL_MARKER=Symbol('fourth-slice-production-review-runtime');
type Installable=Phaser.Scene&ReviewHost&{[INSTALL_MARKER]?:boolean};
export function installFourthSliceProductionReviewRuntime(scene:Phaser.Scene):void{
  if(!isFourthSliceProductionReviewMode())return;const host=scene as Installable;if(host[INSTALL_MARKER])return;
  const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('fourth-slice review runtime requires BattleScene hooks');host[INSTALL_MARKER]=true;
  host.playAttackFx=(unit,view,style):void=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?ATTACK_FX[key]:style);};
  host.syncUnits=():void=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();}};
}
function setQuery(key:string,value:string):void{if(typeof window==='undefined')return;const url=new URL(window.location.href);url.searchParams.set(key,value);window.history.replaceState(null,'',url);}
function selector(scene:Phaser.Scene,label:string,prefix:'pyromancer'|'royal',x:number,current:()=>string,set:(value:string)=>void):void{
  const title=scene.add.text(x,126,`${label} ${current().toUpperCase()}`,{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'14px',color:'#d6e3ee'}).setOrigin(.5).setDepth(191);
  (['f1','f2','f3'] as const).forEach((short,index)=>{const b=scene.add.text(x-58+index*58,151,short.toUpperCase(),{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#fff1b6',backgroundColor:'#3b3120',padding:{x:8,y:2}}).setOrigin(.5).setDepth(192).setInteractive({useHandCursor:true});b.on('pointerdown',()=>{set(short);title.setText(`${label} ${short.toUpperCase()}`);setQuery(`${prefix}Form`,short);});});
}
export function renderFourthSliceProductionReviewLayer(scene:Phaser.Scene):void{
  if(!isFourthSliceProductionReviewMode())return;scene.add.rectangle(640,137,1120,74,0x171713,.91).setStrokeStyle(2,0xd2b76c,.9).setDepth(190);scene.add.text(112,137,'FOURTH SLICE\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#ffe39a',align:'center'}).setOrigin(.5).setDepth(191);
  selector(scene,'PYROMANCER','pyromancer',505,()=>forcedPyromancer?.replace('pyromancer_','')??'f1',(v)=>{forcedPyromancer=parseForm<PyromancerForm>(v,'pyromancer');});
  selector(scene,'ROYAL','royal',905,()=>forcedRoyal?.replace('royal_','')??'f1',(v)=>{forcedRoyal=parseForm<RoyalForm>(v,'royal');});
}
