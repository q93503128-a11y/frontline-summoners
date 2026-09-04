import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import commonEvolutionJson from '../../../content/evolution/recruitment-common-explicit-01.json' with { type: 'json' };
import seriesOneEvolutionJson from '../../../content/evolution/recruitment-series-01-explicit.json' with { type: 'json' };
import seriesTwoEvolutionJson from '../../../content/evolution/recruitment-series-02-explicit.json' with { type: 'json' };
import seriesThreeEvolutionJson from '../../../content/evolution/recruitment-series-03-explicit.json' with { type: 'json' };

const ROOT='/assets/production/units';
interface RecruitmentArtUnit {readonly id:string;readonly rarity:'C'|'B'|'A'|'S'|'SS';readonly role:string;readonly seriesId:string;readonly attributes:readonly string[];readonly combatTags:readonly string[];readonly hitFrames:readonly number[];readonly cycleFrames:number;readonly backswingFrames:number;}
interface RecruitmentFormTiming {readonly cycleFrames:number;readonly hitFrames:readonly number[];readonly backswingFrames:number;}
interface RecruitmentForm {readonly formId:string;readonly formOrder:1|2|3;readonly name:string;readonly modifiers?:{readonly attackTiming?:RecruitmentFormTiming};}
interface RecruitmentEvolutionEntry {readonly characterId:string;readonly forms:readonly RecruitmentForm[];}
const ROSTER=recruitmentUnitsJson as readonly RecruitmentArtUnit[];
const EVOLUTION_ENTRIES=[...commonEvolutionJson,...seriesOneEvolutionJson,...seriesTwoEvolutionJson,...seriesThreeEvolutionJson] as readonly RecruitmentEvolutionEntry[];
const UNIT_BY_ID=new Map(ROSTER.map((unit)=>[unit.id,unit] as const));
const FORM_BY_ID=new Map<string,{readonly unit:RecruitmentArtUnit;readonly form:RecruitmentForm}>();
const F1_FORM_BY_CHARACTER=new Map<string,string>();
for(const entry of EVOLUTION_ENTRIES){const unit=UNIT_BY_ID.get(entry.characterId);if(!unit)continue;for(const form of entry.forms){FORM_BY_ID.set(form.formId,{unit,form});if(form.formOrder===1)F1_FORM_BY_CHARACTER.set(unit.id,form.formId);}}

const FRAME_BY_RARITY={C:[6,8,6,4,6],B:[7,8,7,4,7],A:[7,8,8,4,7],S:[8,8,9,4,8],SS:[8,8,11,4,9]} as const;
interface Spec{readonly h:number;readonly c:number;readonly w:number;readonly fh:number;readonly f:readonly [number,number,number,number,number];readonly fx:AttackFxStyle;}
function fxFor(unit:RecruitmentArtUnit):AttackFxStyle{if(unit.attributes.includes('ANOMALY')||unit.attributes.includes('UNDEAD'))return'VOID';if(unit.attributes.includes('MACHINE')||unit.role==='결정타'||unit.role==='광역'||unit.role==='변칙')return'MAGIC';if(unit.role==='전열'||unit.role==='물량')return'SLASH';return'BLUNT';}
function specFor(unit:RecruitmentArtUnit,form:RecruitmentForm):Spec{
  const baseFrames=FRAME_BY_RARITY[unit.rarity];const frames:[number,number,number,number,number]=[...baseFrames];if(form.formOrder===3)frames[2]=Math.min(12,frames[2]+1);
  const giant=unit.combatTags.includes('GIANT'),structure=unit.combatTags.includes('STRUCTURE'),floating=unit.combatTags.includes('FLOATING');
  let w=unit.rarity==='C'?220:unit.rarity==='B'?235:unit.rarity==='A'?255:285;let h=unit.rarity==='C'?200:unit.rarity==='B'?220:unit.rarity==='A'?235:255;
  if(unit.seriesId==='series_02_primordial_titans'){w+=45;h+=25;}if(unit.seriesId==='series_03_zero_edge'){w+=25;h+=15;}if(giant){w+=45;h+=45;}if(structure){w+=55;h+=20;}if(floating)h+=20;if(unit.rarity==='SS'){w=Math.max(w,350);h=Math.max(h,305);}w=Math.min(400,w+form.formOrder*4);h=Math.min(340,h+form.formOrder*3);
  const firstHit=form.modifiers?.attackTiming?.hitFrames?.[0]??unit.hitFrames[0]??1,cycle=form.modifiers?.attackTiming?.cycleFrames??unit.cycleFrames,backswing=form.modifiers?.attackTiming?.backswingFrames??unit.backswingFrames,activeWindow=Math.max(firstHit+1,cycle-backswing),contact=Math.max(1,Math.min(frames[2]-2,Math.round((firstHit/activeWindow)*(frames[2]-1))));
  return{h:h-18,c:contact,w,fh:h,f:frames,fx:fxFor(unit)};
}
const strip=(key:string,url:string,w:number,h:number,frames:number):SpriteStrip=>({key,url,frameWidth:w,frameHeight:h,frames});
const family=(id:string,displayHeight:number,contact:number,base:string,w:number,h:number,frames:readonly [number,number,number,number,number]):RuntimeArtFamily=>({id,displayHeight,attackContactFrame:contact,idle:strip(`${id}-idle`,`${ROOT}/${base}/idle.png`,w,h,frames[0]),run:strip(`${id}-run`,`${ROOT}/${base}/move.png`,w,h,frames[1]),attack:strip(`${id}-attack`,`${ROOT}/${base}/attack.png`,w,h,frames[2]),knockback:strip(`${id}-kb`,`${ROOT}/${base}/knockback.png`,w,h,frames[3]),death:strip(`${id}-death`,`${ROOT}/${base}/death.png`,w,h,frames[4])});
const FAMILIES:Record<string,RuntimeArtFamily>={};const FX_BY_UNIT:Record<string,AttackFxStyle>={};
for(const [formId,pair] of FORM_BY_ID){const s=specFor(pair.unit,pair.form);FAMILIES[formId]=family(`review-recruitment-${formId}`,s.h,s.c,`${pair.unit.id}/${formId}`,s.w,s.fh,s.f);FX_BY_UNIT[pair.unit.id]=s.fx;}
const all=(f:RuntimeArtFamily):readonly SpriteStrip[]=>[f.idle,f.run,f.attack,...(f.knockback?[f.knockback]:[]),...(f.death?[f.death]:[])];
function query(){return typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);}
export function isRecruitmentProductionReviewMode():boolean{return typeof window!=='undefined'&&query().get('productionReview')==='recruitment';}
export function getRecruitmentReviewSpriteStrips():readonly SpriteStrip[]{return Object.values(FAMILIES).flatMap((f)=>[...all(f)]);}
function formForUnit(id:string):string|undefined{if(!UNIT_BY_ID.has(id))return undefined;const active=getActiveVisualFormId(id);return active&&FORM_BY_ID.has(active)?active:F1_FORM_BY_CHARACTER.get(id);}
interface View{readonly sprite:Phaser.GameObjects.Sprite;readonly hpBg?:Phaser.GameObjects.Rectangle;readonly hp?:Phaser.GameObjects.Rectangle;readonly trait?:Phaser.GameObjects.Text;}
interface Host{state:PlayableBattleState;views:Map<number,View>;syncUnits():void;playAttackFx(unit:BattleUnit,view:View,style:AttackFxStyle):void;}
const MARK=Symbol('recruitment-production-review');type Installable=Phaser.Scene&Host&{[MARK]?:boolean};
function anchor(view:View,f:RuntimeArtFamily){const top=view.sprite.y-f.displayHeight*.5,hpY=Math.max(126,top-10);if(view.hpBg){view.hpBg.y=hpY;view.hpBg.setDepth(6);}if(view.hp){view.hp.y=hpY;view.hp.setDepth(7);}if(view.trait){view.trait.y=hpY-22;view.trait.setDepth(8);}}
export function installRecruitmentProductionReviewRuntime(scene:Phaser.Scene):void{
  if(!isRecruitmentProductionReviewMode())return;const host=scene as Installable;if(host[MARK])return;const originalSync=host.syncUnits,originalAttack=host.playAttackFx;if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('recruitment review requires BattleScene hooks');host[MARK]=true;
  host.playAttackFx=(unit,view,style)=>{const formId=formForUnit(unit.definition.id);originalAttack.call(scene,unit,view,formId?(FX_BY_UNIT[unit.definition.id]??style):style);};
  host.syncUnits=()=>{originalSync.call(scene);const tick=host.state?.battle?.tick??0;for(const unit of host.state?.battle?.units??[]){const formId=formForUnit(unit.definition.id);if(!formId)continue;const f=FAMILIES[formId],view=host.views.get(unit.simulationId);if(!f||!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(f,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(f,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(f.displayHeight/motion.frameHeight);view.sprite.clearTint();anchor(view,f);}};
}
export function renderRecruitmentProductionReviewLayer(scene:Phaser.Scene):void{
  if(!isRecruitmentProductionReviewMode())return;scene.add.rectangle(640,137,1120,74,0x11131a,.92).setStrokeStyle(2,0xa58d58,.9).setDepth(190);
  scene.add.text(135,137,'RECRUITMENT\nUNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#f2eee5',align:'center'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,128,'모집 캐릭터 · COMMON + SERIES 01/02/03',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'15px',color:'#eadfca'}).setOrigin(.5).setDepth(191);
  scene.add.text(640,151,'33 캐릭터 · 99 진화폼 · 495 canonical form motion strips',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#bbb4a7'}).setOrigin(.5).setDepth(191);
  scene.add.text(1080,137,'F1/F2/F3 전수\n인간 승인 대기',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'12px',color:'#dfc37f',align:'center'}).setOrigin(.5).setDepth(191);
}
