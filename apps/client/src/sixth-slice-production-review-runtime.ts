import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT='/assets/production/units';
type VoidForm='voidsage_f1'|'voidsage_f2'|'voidsage_f3';
type FamilyKey=VoidForm|'enemy-boss'|'enemy-boss-iron';
const strip=(key:string,url:string,w:number,h:number,frames:number):SpriteStrip=>({key,url,frameWidth:w,frameHeight:h,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({id,displayHeight,attackContactFrame:contact,idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),knockback:strip(`${id}-kb`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4])});
const FAMILIES:Readonly<Record<FamilyKey,RuntimeArtFamily>>={
  voidsage_f1:family('review-voidsage-f1',198,5,'voidsage/voidsage_f1',270,220,[6,8,8,4,7]),
  voidsage_f2:family('review-voidsage-f2',204,5,'voidsage/voidsage_f2',300,230,[6,8,8,4,7]),
  voidsage_f3:family('review-voidsage-f3',214,5,'voidsage/voidsage_f3',330,240,[6,8,8,4,7]),
  'enemy-boss':family('review-finale-golden-mask',228,5,'enemy-boss',150,150,[8,8,8,4,5]),
  'enemy-boss-iron':family('review-iron-gate-general',244,4,'enemy-boss-iron',300,225,[11,8,7,4,11]),
};
const FX:Readonly<Record<FamilyKey,AttackFxStyle>>={voidsage_f1:'VOID',voidsage_f2:'VOID',voidsage_f3:'VOID','enemy-boss':'VOID','enemy-boss-iron':'BLUNT'};
const all=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
function parseVoid(value:string|null):VoidForm|undefined{if(value==='f1'||value==='voidsage_f1')return'voidsage_f1';if(value==='f2'||value==='voidsage_f2')return'voidsage_f2';if(value==='f3'||value==='voidsage_f3')return'voidsage_f3';return undefined;}
let forcedVoid=parseVoid(query().get('voidsageForm'));
export function isSixthSliceProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='sixth-slice';}
export function getSixthSliceReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...all(f)]);}
function keyForUnit(id:string):FamilyKey|undefined{if(id==='voidsage')return forcedVoid??parseVoid(getActiveVisualFormId('voidsage')??null)??'voidsage_f1';if(id==='enemy-boss'||id==='enemy-boss-iron')return id;return undefined;}
interface View{readonly sprite:Phaser.GameObjects.Sprite;readonly hpBg?:Phaser.GameObjects.Rectangle;readonly hp?:Phaser.GameObjects.Rectangle;readonly trait?:Phaser.GameObjects.Text;}
interface Host{state:PlayableBattleState;views:Map<number,View>;syncUnits():void;playAttackFx(unit:BattleUnit,view:View,style:AttackFxStyle):void;}
const MARK=Symbol('sixth-slice-production-review');type Installable=Phaser.Scene&Host&{[MARK]?:boolean};
function anchor(view:View,f:RuntimeArtFamily,key:FamilyKey){const top=view.sprite.y-f.displayHeight*.5,hpY=Math.max(126,top-(key.startsWith('enemy-boss')?14:10));if(view.hpBg){view.hpBg.y=hpY;view.hpBg.setDepth(8);}if(view.hp){view.hp.y=hpY;view.hp.setDepth(9);}if(view.trait){view.trait.y=hpY-22;view.trait.setDepth(10);}}
export function installSixthSliceProductionReviewRuntime(scene:Phaser.Scene):void{if(!isSixthSliceProductionReviewMode())return;const host=scene as Installable;if(host[MARK])return;const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('sixth-slice review requires BattleScene hooks');host[MARK]=true;host.playAttackFx=(unit,view,style)=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?FX[key]:style);};host.syncUnits=()=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const key=keyForUnit(unit.definition.id);if(!key)continue;const f=FAMILIES[key],view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();anchor(view,f,key);}};}
function setQuery(value:string){if(typeof window==='undefined')return;const url=new URL(window.location.href);url.searchParams.set('voidsageForm',value);window.history.replaceState(null,'',url);}
export function renderSixthSliceProductionReviewLayer(scene:Phaser.Scene):void{if(!isSixthSliceProductionReviewMode())return;scene.add.rectangle(640,137,1120,74,0x14161b,.92).setStrokeStyle(2,0x9ba4ac,.9).setDepth(190);scene.add.text(128,137,'CHAPTER 1 FINALE\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#e7e8e5',align:'center'}).setOrigin(.5).setDepth(191);const title=scene.add.text(640,126,`VOIDSAGE ${(forcedVoid??'voidsage_f1').replace('voidsage_','').toUpperCase()}`,{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'14px',color:'#d8dce0'}).setOrigin(.5).setDepth(191);(['f1','f2','f3'] as const).forEach((v,i)=>{const b=scene.add.text(582+i*58,151,v.toUpperCase(),{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#f0f0ec',backgroundColor:'#30343a',padding:{x:8,y:2}}).setOrigin(.5).setDepth(192).setInteractive({useHandCursor:true});b.on('pointerdown',()=>{forcedVoid=parseVoid(v);title.setText(`VOIDSAGE ${v.toUpperCase()}`);setQuery(v);});});scene.add.text(1055,137,'ST19 GOLDEN MASK\nST20 + IRON GATE',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#d0b776',align:'center'}).setOrigin(.5).setDepth(191);}
