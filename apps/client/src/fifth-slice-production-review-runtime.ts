import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT='/assets/production/units';
type HereticForm='heretic_f1'|'heretic_f2'|'heretic_f3';
type FamilyKey=HereticForm|'enemy-cultist'|'enemy-sprinter';
const strip=(key:string,url:string,frameWidth:number,frameHeight:number,frames:number):SpriteStrip=>({key,url,frameWidth,frameHeight,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({id,displayHeight,attackContactFrame:contact,idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),knockback:strip(`${id}-knockback`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4])});
const FAMILIES:Readonly<Record<FamilyKey,RuntimeArtFamily>>={
  heretic_f1:family('review-heretic-f1',198,5,'heretic/heretic_f1',310,260,[8,8,8,3,7]),
  heretic_f2:family('review-heretic-f2',206,5,'heretic/heretic_f2',330,270,[8,8,8,3,7]),
  heretic_f3:family('review-heretic-f3',194,5,'heretic/heretic_f3',290,245,[8,8,8,3,7]),
  'enemy-cultist':family('review-enemy-cultist',188,4,'enemy-cultist',260,200,[8,8,8,4,5]),
  'enemy-sprinter':family('review-enemy-sprinter',140,2,'enemy-sprinter',210,130,[6,8,6,4,6]),
};
const ATTACK_FX:Readonly<Record<FamilyKey,AttackFxStyle>>={heretic_f1:'VOID',heretic_f2:'VOID',heretic_f3:'VOID','enemy-cultist':'VOID','enemy-sprinter':'BLUNT'};
const allStrips=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
function parseForm(value:string|null):HereticForm|undefined{if(value==='f1'||value==='heretic_f1')return'heretic_f1';if(value==='f2'||value==='heretic_f2')return'heretic_f2';if(value==='f3'||value==='heretic_f3')return'heretic_f3';return undefined;}
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
let forcedHeretic=parseForm(query().get('hereticForm'));
export function isFifthSliceProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='fifth-slice';}
export function getFifthSliceReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...allStrips(f)]);}
function keyForUnit(unitId:string):FamilyKey|undefined{if(unitId==='heretic')return forcedHeretic??parseForm(getActiveVisualFormId('heretic')??null)??'heretic_f1';if(unitId==='enemy-cultist'||unitId==='enemy-sprinter')return unitId;return undefined;}
interface ReviewUnitView{readonly sprite:Phaser.GameObjects.Sprite;}
interface ReviewHost{state:PlayableBattleState;views:Map<number,ReviewUnitView>;syncUnits():void;playAttackFx(unit:BattleUnit,view:ReviewUnitView,style:AttackFxStyle):void;}
const INSTALL_MARKER=Symbol('fifth-slice-production-review-runtime');
type Installable=Phaser.Scene&ReviewHost&{[INSTALL_MARKER]?:boolean};
export function installFifthSliceProductionReviewRuntime(scene:Phaser.Scene):void{if(!isFifthSliceProductionReviewMode())return;const host=scene as Installable;if(host[INSTALL_MARKER])return;const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('fifth-slice review runtime requires BattleScene hooks');host[INSTALL_MARKER]=true;host.playAttackFx=(unit,view,style):void=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?ATTACK_FX[key]:style);};host.syncUnits=():void=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();}};}
function setQuery(value:string):void{if(typeof window==='undefined')return;const url=new URL(window.location.href);url.searchParams.set('hereticForm',value);window.history.replaceState(null,'',url);}
export function renderFifthSliceProductionReviewLayer(scene:Phaser.Scene):void{if(!isFifthSliceProductionReviewMode())return;scene.add.rectangle(640,137,1020,74,0x171713,.91).setStrokeStyle(2,0xd2b76c,.9).setDepth(190);scene.add.text(150,137,'FIFTH SLICE · ST14–18\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#ffe39a',align:'center'}).setOrigin(.5).setDepth(191);const title=scene.add.text(700,126,`HERETIC ${(forcedHeretic?.replace('heretic_','')??'f1').toUpperCase()}`,{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'14px',color:'#d6e3ee'}).setOrigin(.5).setDepth(191);(['f1','f2','f3'] as const).forEach((short,index)=>{const b=scene.add.text(642+index*58,151,short.toUpperCase(),{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#fff1b6',backgroundColor:'#3b3120',padding:{x:8,y:2}}).setOrigin(.5).setDepth(192).setInteractive({useHandCursor:true});b.on('pointerdown',()=>{forcedHeretic=parseForm(short);title.setText(`HERETIC ${short.toUpperCase()}`);setQuery(short);});});scene.add.text(1020,137,'CULTIST + SPRINTER\n실전 모션 확인',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#b9c6d8',align:'center'}).setOrigin(.5).setDepth(191);}
