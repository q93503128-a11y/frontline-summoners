import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT='/assets/production/units';
type DuelistForm='duelist_f1'|'duelist_f2'|'duelist_f3';
type LancerForm='lancer_f1'|'lancer_f2'|'lancer_f3';
type BattlemageForm='battlemage_f1'|'battlemage_f2'|'battlemage_f3';
type FamilyKey=DuelistForm|LancerForm|BattlemageForm|'enemy-sniper';
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
  duelist_f1:family('review-duelist-f1',190,2,'duelist/duelist_f1',230,210,[4,8,4,3,7]),
  duelist_f2:family('review-duelist-f2',194,2,'duelist/duelist_f2',230,210,[4,8,4,3,7]),
  duelist_f3:family('review-duelist-f3',198,2,'duelist/duelist_f3',230,210,[4,8,4,3,7]),
  lancer_f1:family('review-lancer-f1',190,2,'lancer/lancer_f1',240,170,[8,8,4,4,6]),
  lancer_f2:family('review-lancer-f2',198,2,'lancer/lancer_f2',250,170,[8,8,4,4,6]),
  lancer_f3:family('review-lancer-f3',194,2,'lancer/lancer_f3',240,170,[8,8,4,4,6]),
  battlemage_f1:family('review-battlemage-f1',184,4,'battlemage/battlemage_f1',280,205,[6,8,8,4,7]),
  battlemage_f2:family('review-battlemage-f2',190,4,'battlemage/battlemage_f2',280,205,[6,8,8,4,7]),
  battlemage_f3:family('review-battlemage-f3',202,4,'battlemage/battlemage_f3',290,210,[6,8,8,4,7]),
  'enemy-sniper':family('review-enemy-sniper',184,3,'enemy-sniper',255,170,[8,8,5,3,8]),
};
const ATTACK_FX:Readonly<Record<FamilyKey,AttackFxStyle>>={duelist_f1:'SLASH',duelist_f2:'SLASH',duelist_f3:'SLASH',lancer_f1:'PIERCE',lancer_f2:'PIERCE',lancer_f3:'PIERCE',battlemage_f1:'VOID',battlemage_f2:'VOID',battlemage_f3:'VOID','enemy-sniper':'PIERCE'};
const allStrips=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
function parseForm<T extends string>(value:string|null,prefix:string):T|undefined{if(value==='f1'||value===`${prefix}_f1`)return `${prefix}_f1` as T;if(value==='f2'||value===`${prefix}_f2`)return `${prefix}_f2` as T;if(value==='f3'||value===`${prefix}_f3`)return `${prefix}_f3` as T;return undefined;}
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
let forcedDuelist=parseForm<DuelistForm>(query().get('duelistForm'),'duelist');
let forcedLancer=parseForm<LancerForm>(query().get('lancerForm'),'lancer');
let forcedBattlemage=parseForm<BattlemageForm>(query().get('battlemageForm'),'battlemage');
export function isThirdSliceProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='third-slice';}
export function getThirdSliceReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...allStrips(f)]);}
function keyForUnit(unitId:string):FamilyKey|undefined{
  if(unitId==='duelist')return forcedDuelist??parseForm<DuelistForm>(getActiveVisualFormId('duelist')??null,'duelist')??'duelist_f1';
  if(unitId==='lancer')return forcedLancer??parseForm<LancerForm>(getActiveVisualFormId('lancer')??null,'lancer')??'lancer_f1';
  if(unitId==='battlemage')return forcedBattlemage??parseForm<BattlemageForm>(getActiveVisualFormId('battlemage')??null,'battlemage')??'battlemage_f1';
  if(unitId==='enemy-sniper')return 'enemy-sniper';return undefined;
}
interface ReviewUnitView{readonly sprite:Phaser.GameObjects.Sprite;}
interface ReviewHost{state:PlayableBattleState;views:Map<number,ReviewUnitView>;syncUnits():void;playAttackFx(unit:BattleUnit,view:ReviewUnitView,style:AttackFxStyle):void;}
const INSTALL_MARKER=Symbol('third-slice-production-review-runtime');
type Installable=Phaser.Scene&ReviewHost&{[INSTALL_MARKER]?:boolean};
export function installThirdSliceProductionReviewRuntime(scene:Phaser.Scene):void{
  if(!isThirdSliceProductionReviewMode())return;const host=scene as Installable;if(host[INSTALL_MARKER])return;
  const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('third-slice review runtime requires BattleScene hooks');host[INSTALL_MARKER]=true;
  host.playAttackFx=(unit,view,style):void=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?ATTACK_FX[key]:style);};
  host.syncUnits=():void=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();}};
}
function setQuery(key:string,value:string):void{if(typeof window==='undefined')return;const url=new URL(window.location.href);url.searchParams.set(key,value);window.history.replaceState(null,'',url);}
function selector(scene:Phaser.Scene,label:string,prefix:'duelist'|'lancer'|'battlemage',x:number,current:()=>string,set:(value:string)=>void):void{
  const title=scene.add.text(x,126,`${label} ${current().toUpperCase()}`,{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#d6e3ee'}).setOrigin(.5).setDepth(191);
  (['f1','f2','f3'] as const).forEach((short,index)=>{const b=scene.add.text(x-54+index*54,151,short.toUpperCase(),{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#fff1b6',backgroundColor:'#3b3120',padding:{x:7,y:2}}).setOrigin(.5).setDepth(192).setInteractive({useHandCursor:true});b.on('pointerdown',()=>{set(short);title.setText(`${label} ${short.toUpperCase()}`);setQuery(`${prefix}Form`,short);});});
}
export function renderThirdSliceProductionReviewLayer(scene:Phaser.Scene):void{
  if(!isThirdSliceProductionReviewMode())return;scene.add.rectangle(640,137,1230,74,0x171713,.91).setStrokeStyle(2,0xd2b76c,.9).setDepth(190);scene.add.text(84,137,'THIRD SLICE\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#ffe39a',align:'center'}).setOrigin(.5).setDepth(191);
  selector(scene,'DUELIST','duelist',330,()=>forcedDuelist?.replace('duelist_','')??'f1',(v)=>{forcedDuelist=parseForm<DuelistForm>(v,'duelist');});
  selector(scene,'LANCER','lancer',650,()=>forcedLancer?.replace('lancer_','')??'f1',(v)=>{forcedLancer=parseForm<LancerForm>(v,'lancer');});
  selector(scene,'BATTLEMAGE','battlemage',1000,()=>forcedBattlemage?.replace('battlemage_','')??'f1',(v)=>{forcedBattlemage=parseForm<BattlemageForm>(v,'battlemage');});
}
