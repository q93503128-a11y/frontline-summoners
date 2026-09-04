import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT = '/assets/production/units';
const REVIEW_QUERY_KEY = 'productionReview';
const REVIEW_QUERY_VALUE = 'second-slice';
const GUARD_FORM_QUERY_KEY = 'guardForm';
const HUNTER_FORM_QUERY_KEY = 'hunterForm';

type GuardForm = 'guard_f1' | 'guard_f2' | 'guard_f3';
type HunterForm = 'hunter_f1' | 'hunter_f2' | 'hunter_f3';
type SecondSliceFamilyKey = GuardForm | HunterForm | 'enemy-spearman' | 'enemy-shield';

function strip(key: string, url: string, frameWidth: number, frameHeight: number, frames: number): SpriteStrip {
  return { key, url, frameWidth, frameHeight, frames };
}

const FAMILIES: Readonly<Record<SecondSliceFamilyKey, RuntimeArtFamily>> = {
  guard_f1: {
    id: 'review-guard-f1', displayHeight: 184, attackContactFrame: 3,
    idle: strip('review-guard-f1-idle', `${ROOT}/guard/guard_f1/idle.png`, 210, 190, 11),
    run: strip('review-guard-f1-run', `${ROOT}/guard/guard_f1/move.png`, 210, 190, 8),
    attack: strip('review-guard-f1-attack', `${ROOT}/guard/guard_f1/attack.png`, 210, 190, 7),
    knockback: strip('review-guard-f1-knockback', `${ROOT}/guard/guard_f1/knockback.png`, 210, 190, 4),
    death: strip('review-guard-f1-death', `${ROOT}/guard/guard_f1/death.png`, 210, 190, 11),
  },
  guard_f2: {
    id: 'review-guard-f2', displayHeight: 192, attackContactFrame: 3,
    idle: strip('review-guard-f2-idle', `${ROOT}/guard/guard_f2/idle.png`, 210, 190, 11),
    run: strip('review-guard-f2-run', `${ROOT}/guard/guard_f2/move.png`, 210, 190, 8),
    attack: strip('review-guard-f2-attack', `${ROOT}/guard/guard_f2/attack.png`, 210, 190, 7),
    knockback: strip('review-guard-f2-knockback', `${ROOT}/guard/guard_f2/knockback.png`, 210, 190, 4),
    death: strip('review-guard-f2-death', `${ROOT}/guard/guard_f2/death.png`, 210, 190, 11),
  },
  guard_f3: {
    id: 'review-guard-f3', displayHeight: 202, attackContactFrame: 3,
    idle: strip('review-guard-f3-idle', `${ROOT}/guard/guard_f3/idle.png`, 210, 190, 11),
    run: strip('review-guard-f3-run', `${ROOT}/guard/guard_f3/move.png`, 210, 190, 8),
    attack: strip('review-guard-f3-attack', `${ROOT}/guard/guard_f3/attack.png`, 210, 190, 7),
    knockback: strip('review-guard-f3-knockback', `${ROOT}/guard/guard_f3/knockback.png`, 210, 190, 4),
    death: strip('review-guard-f3-death', `${ROOT}/guard/guard_f3/death.png`, 210, 190, 11),
  },
  hunter_f1: {
    id: 'review-hunter-f1', displayHeight: 180, attackContactFrame: 3,
    idle: strip('review-hunter-f1-idle', `${ROOT}/hunter/hunter_f1/idle.png`, 190, 120, 10),
    run: strip('review-hunter-f1-run', `${ROOT}/hunter/hunter_f1/move.png`, 190, 120, 8),
    attack: strip('review-hunter-f1-attack', `${ROOT}/hunter/hunter_f1/attack.png`, 190, 120, 6),
    knockback: strip('review-hunter-f1-knockback', `${ROOT}/hunter/hunter_f1/knockback.png`, 190, 120, 3),
    death: strip('review-hunter-f1-death', `${ROOT}/hunter/hunter_f1/death.png`, 190, 120, 10),
  },
  hunter_f2: {
    id: 'review-hunter-f2', displayHeight: 184, attackContactFrame: 3,
    idle: strip('review-hunter-f2-idle', `${ROOT}/hunter/hunter_f2/idle.png`, 190, 120, 10),
    run: strip('review-hunter-f2-run', `${ROOT}/hunter/hunter_f2/move.png`, 190, 120, 8),
    attack: strip('review-hunter-f2-attack', `${ROOT}/hunter/hunter_f2/attack.png`, 190, 120, 6),
    knockback: strip('review-hunter-f2-knockback', `${ROOT}/hunter/hunter_f2/knockback.png`, 190, 120, 3),
    death: strip('review-hunter-f2-death', `${ROOT}/hunter/hunter_f2/death.png`, 190, 120, 10),
  },
  hunter_f3: {
    id: 'review-hunter-f3', displayHeight: 188, attackContactFrame: 3,
    idle: strip('review-hunter-f3-idle', `${ROOT}/hunter/hunter_f3/idle.png`, 190, 120, 10),
    run: strip('review-hunter-f3-run', `${ROOT}/hunter/hunter_f3/move.png`, 190, 120, 8),
    attack: strip('review-hunter-f3-attack', `${ROOT}/hunter/hunter_f3/attack.png`, 190, 120, 6),
    knockback: strip('review-hunter-f3-knockback', `${ROOT}/hunter/hunter_f3/knockback.png`, 190, 120, 3),
    death: strip('review-hunter-f3-death', `${ROOT}/hunter/hunter_f3/death.png`, 190, 120, 10),
  },
  'enemy-spearman': {
    id: 'review-enemy-spearman', displayHeight: 188, attackContactFrame: 3,
    idle: strip('review-enemy-spearman-idle', `${ROOT}/enemy-spearman/idle.png`, 230, 175, 10),
    run: strip('review-enemy-spearman-run', `${ROOT}/enemy-spearman/move.png`, 230, 175, 8),
    attack: strip('review-enemy-spearman-attack', `${ROOT}/enemy-spearman/attack.png`, 230, 175, 7),
    knockback: strip('review-enemy-spearman-knockback', `${ROOT}/enemy-spearman/knockback.png`, 230, 175, 3),
    death: strip('review-enemy-spearman-death', `${ROOT}/enemy-spearman/death.png`, 230, 175, 7),
  },
  'enemy-shield': {
    id: 'review-enemy-shield', displayHeight: 190, attackContactFrame: 2,
    idle: strip('review-enemy-shield-idle', `${ROOT}/enemy-shield/idle.png`, 200, 130, 8),
    run: strip('review-enemy-shield-run', `${ROOT}/enemy-shield/move.png`, 200, 130, 8),
    attack: strip('review-enemy-shield-attack', `${ROOT}/enemy-shield/attack.png`, 200, 130, 4),
    knockback: strip('review-enemy-shield-knockback', `${ROOT}/enemy-shield/knockback.png`, 200, 130, 4),
    death: strip('review-enemy-shield-death', `${ROOT}/enemy-shield/death.png`, 200, 130, 6),
  },
};

const ATTACK_FX: Readonly<Record<SecondSliceFamilyKey, AttackFxStyle>> = {
  guard_f1: 'SLASH', guard_f2: 'SLASH', guard_f3: 'SLASH',
  hunter_f1: 'PIERCE', hunter_f2: 'PIERCE', hunter_f3: 'PIERCE',
  'enemy-spearman': 'PIERCE', 'enemy-shield': 'SLASH',
};

function allStrips(family: RuntimeArtFamily): readonly SpriteStrip[] {
  return [family.idle, family.run, family.attack, ...(family.knockback ? [family.knockback] : []), ...(family.death ? [family.death] : [])];
}
function parseGuard(value: string | null): GuardForm | undefined { return value === 'f1'||value==='guard_f1'?'guard_f1':value==='f2'||value==='guard_f2'?'guard_f2':value==='f3'||value==='guard_f3'?'guard_f3':undefined; }
function parseHunter(value: string | null): HunterForm | undefined { return value === 'f1'||value==='hunter_f1'?'hunter_f1':value==='f2'||value==='hunter_f2'?'hunter_f2':value==='f3'||value==='hunter_f3'?'hunter_f3':undefined; }
let forcedGuard: GuardForm | undefined = typeof window === 'undefined' ? undefined : parseGuard(new URLSearchParams(window.location.search).get(GUARD_FORM_QUERY_KEY));
let forcedHunter: HunterForm | undefined = typeof window === 'undefined' ? undefined : parseHunter(new URLSearchParams(window.location.search).get(HUNTER_FORM_QUERY_KEY));

export function isSecondSliceProductionReviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(REVIEW_QUERY_KEY) === REVIEW_QUERY_VALUE;
}
export function getSecondSliceReviewSpriteStrips(): readonly SpriteStrip[] { return Object.values(FAMILIES).flatMap((family) => [...allStrips(family)]); }
function keyForUnit(unitId: string): SecondSliceFamilyKey | undefined {
  if (unitId === 'guard') return forcedGuard ?? parseGuard(getActiveVisualFormId('guard') ?? null) ?? 'guard_f1';
  if (unitId === 'hunter') return forcedHunter ?? parseHunter(getActiveVisualFormId('hunter') ?? null) ?? 'hunter_f1';
  if (unitId === 'enemy-spearman' || unitId === 'enemy-shield') return unitId;
  return undefined;
}
function familyForUnit(unitId: string): RuntimeArtFamily | undefined { const key=keyForUnit(unitId); return key ? FAMILIES[key] : undefined; }

interface ReviewUnitView { readonly sprite: Phaser.GameObjects.Sprite; }
interface ReviewHost {
  state: PlayableBattleState;
  views: Map<number, ReviewUnitView>;
  syncUnits(): void;
  playAttackFx(unit: BattleUnit, view: ReviewUnitView, style: AttackFxStyle): void;
}
const INSTALL_MARKER=Symbol('second-slice-production-review-runtime');
type InstallableScene=Phaser.Scene & ReviewHost & { [INSTALL_MARKER]?: boolean };

export function installSecondSliceProductionReviewRuntime(scene: Phaser.Scene): void {
  if (!isSecondSliceProductionReviewMode()) return;
  const host=scene as InstallableScene;if(host[INSTALL_MARKER])return;
  const originalSync=host.syncUnits,originalAttack=host.playAttackFx;
  if(typeof originalSync!=='function'||typeof originalAttack!=='function')throw new Error('second-slice review runtime requires BattleScene sync/attack hooks');
  host[INSTALL_MARKER]=true;
  host.playAttackFx=(unit,view,style):void=>{const key=keyForUnit(unit.definition.id);originalAttack.call(scene,unit,view,key?ATTACK_FX[key]:style);};
  host.syncUnits=():void=>{
    originalSync.call(scene);const tick=host.state?.battle?.tick??0;
    for(const unit of host.state?.battle?.units??[]){const family=familyForUnit(unit.definition.id);if(!family)continue;const view=host.views.get(unit.simulationId);if(!view?.sprite?.active)continue;const motion=selectRuntimeMotionStrip(family,unit.state);if(view.sprite.texture.key!==motion.key)view.sprite.setTexture(motion.key,0);const frame=getRuntimeMotionFrame(family,motion,unit,tick);if(frame>=0&&frame<motion.frames)view.sprite.setFrame(frame);view.sprite.setScale(family.displayHeight/motion.frameHeight);view.sprite.clearTint();}
  };
}

function setQuery(key:string,value:string|undefined):void { if(typeof window==='undefined')return;const url=new URL(window.location.href);if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);window.history.replaceState(null,'',url); }
export function renderSecondSliceProductionReviewLayer(scene: Phaser.Scene): void {
  if(!isSecondSliceProductionReviewMode())return;
  scene.add.rectangle(640,126,1020,44,0x171713,.91).setStrokeStyle(2,0xd2b76c,.9).setDepth(190);
  scene.add.text(174,126,'SECOND SLICE · UNAPPROVED',{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'15px',color:'#ffe39a'}).setOrigin(.5).setDepth(191);
  const guardLabel=scene.add.text(395,126,`GUARD ${(forcedGuard??'guard_f1').replace('guard_','').toUpperCase()}`,{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'14px',color:'#d6e3ee'}).setOrigin(.5).setDepth(191);
  const hunterLabel=scene.add.text(805,126,`HUNTER ${(forcedHunter??'hunter_f1').replace('hunter_','').toUpperCase()}`,{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'14px',color:'#d6e3ee'}).setOrigin(.5).setDepth(191);
  (['f1','f2','f3'] as const).forEach((short,index)=>{
    const g=scene.add.text(500+index*54,126,short.toUpperCase(),{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#fff1b6',backgroundColor:'#3b3120',padding:{x:7,y:3}}).setOrigin(.5).setDepth(192).setInteractive({useHandCursor:true});
    g.on('pointerdown',()=>{forcedGuard=parseGuard(short);guardLabel.setText(`GUARD ${short.toUpperCase()}`);setQuery(GUARD_FORM_QUERY_KEY,short);});
    const h=scene.add.text(910+index*54,126,short.toUpperCase(),{fontFamily:'"Malgun Gothic", sans-serif',fontSize:'13px',color:'#fff1b6',backgroundColor:'#3b3120',padding:{x:7,y:3}}).setOrigin(.5).setDepth(192).setInteractive({useHandCursor:true});
    h.on('pointerdown',()=>{forcedHunter=parseHunter(short);hunterLabel.setText(`HUNTER ${short.toUpperCase()}`);setQuery(HUNTER_FORM_QUERY_KEY,short);});
  });
}
