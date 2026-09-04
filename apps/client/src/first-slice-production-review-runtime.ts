import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { AttackFxStyle, SpriteStrip } from './assets.ts';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import {
  playFirstSliceReviewContactFx,
  playFirstSliceReviewImpactFx,
  type FirstSliceReviewFamilyKey,
} from './first-slice-production-review-contact-vfx.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT = '/assets/production/units';
const REVIEW_QUERY_KEY = 'productionReview';
const REVIEW_QUERY_VALUE = 'first-slice';
const MILITIA_FORM_QUERY_KEY = 'militiaForm';
export const FIRST_SLICE_REVIEW_MEADOW_KEY = 'production-review-meadow';
export const FIRST_SLICE_REVIEW_MEADOW_URL = '/assets/production/battlefields/meadow/battlefield-base.svg';

type MilitiaReviewForm = 'militia_f1' | 'militia_f2' | 'militia_f3';

function strip(key: string, url: string, frameWidth: number, frameHeight: number, frames: number): SpriteStrip {
  return { key, url, frameWidth, frameHeight, frames };
}

const REVIEW_FAMILIES: Readonly<Record<FirstSliceReviewFamilyKey, RuntimeArtFamily>> = {
  militia_f1: {
    id: 'review-militia-f1', displayHeight: 174, attackContactFrame: 2,
    idle: strip('review-militia-f1-idle', `${ROOT}/militia/militia_f1/idle.png`, 135, 135, 10),
    run: strip('review-militia-f1-run', `${ROOT}/militia/militia_f1/move.png`, 135, 135, 6),
    attack: strip('review-militia-f1-attack', `${ROOT}/militia/militia_f1/attack.png`, 135, 135, 4),
    knockback: strip('review-militia-f1-knockback', `${ROOT}/militia/militia_f1/knockback.png`, 135, 135, 3),
    death: strip('review-militia-f1-death', `${ROOT}/militia/militia_f1/death.png`, 135, 135, 9),
  },
  militia_f2: {
    id: 'review-militia-f2', displayHeight: 184, attackContactFrame: 3,
    idle: strip('review-militia-f2-idle', `${ROOT}/militia/militia_f2/idle.png`, 140, 140, 11),
    run: strip('review-militia-f2-run', `${ROOT}/militia/militia_f2/move.png`, 140, 140, 8),
    attack: strip('review-militia-f2-attack', `${ROOT}/militia/militia_f2/attack.png`, 140, 140, 6),
    knockback: strip('review-militia-f2-knockback', `${ROOT}/militia/militia_f2/knockback.png`, 140, 140, 4),
    death: strip('review-militia-f2-death', `${ROOT}/militia/militia_f2/death.png`, 140, 140, 9),
  },
  militia_f3: {
    id: 'review-militia-f3', displayHeight: 176, attackContactFrame: 2,
    idle: strip('review-militia-f3-idle', `${ROOT}/militia/militia_f3/idle.png`, 184, 137, 6),
    run: strip('review-militia-f3-run', `${ROOT}/militia/militia_f3/move.png`, 184, 137, 8),
    attack: strip('review-militia-f3-attack', `${ROOT}/militia/militia_f3/attack.png`, 184, 137, 4),
    knockback: strip('review-militia-f3-knockback', `${ROOT}/militia/militia_f3/knockback.png`, 184, 137, 3),
    death: strip('review-militia-f3-death', `${ROOT}/militia/militia_f3/death.png`, 184, 137, 9),
  },
  'enemy-raider': {
    id: 'review-enemy-raider', displayHeight: 178, attackContactFrame: 2,
    idle: strip('review-enemy-raider-idle', `${ROOT}/enemy-raider/idle.png`, 150, 150, 8),
    run: strip('review-enemy-raider-run', `${ROOT}/enemy-raider/move.png`, 150, 150, 8),
    attack: strip('review-enemy-raider-attack', `${ROOT}/enemy-raider/attack.png`, 150, 150, 4),
    knockback: strip('review-enemy-raider-knockback', `${ROOT}/enemy-raider/knockback.png`, 150, 150, 4),
    death: strip('review-enemy-raider-death', `${ROOT}/enemy-raider/death.png`, 150, 150, 6),
  },
  'enemy-boss': {
    id: 'review-enemy-boss', displayHeight: 228, attackContactFrame: 5,
    idle: strip('review-enemy-boss-idle', `${ROOT}/enemy-boss/idle.png`, 150, 150, 8),
    run: strip('review-enemy-boss-run', `${ROOT}/enemy-boss/move.png`, 150, 150, 8),
    attack: strip('review-enemy-boss-attack', `${ROOT}/enemy-boss/attack.png`, 150, 150, 8),
    knockback: strip('review-enemy-boss-knockback', `${ROOT}/enemy-boss/knockback.png`, 150, 150, 4),
    death: strip('review-enemy-boss-death', `${ROOT}/enemy-boss/death.png`, 150, 150, 5),
  },
};

const REVIEW_ATTACK_FX: Readonly<Record<FirstSliceReviewFamilyKey, AttackFxStyle>> = {
  militia_f1: 'SLASH',
  militia_f2: 'PIERCE',
  militia_f3: 'PIERCE',
  'enemy-raider': 'SLASH',
  'enemy-boss': 'VOID',
};

function allStrips(family: RuntimeArtFamily): readonly SpriteStrip[] {
  return [family.idle, family.run, family.attack, ...(family.knockback ? [family.knockback] : []), ...(family.death ? [family.death] : [])];
}

function parseMilitiaReviewForm(value: string | null): MilitiaReviewForm | undefined {
  if (value === 'f1' || value === 'militia_f1') return 'militia_f1';
  if (value === 'f2' || value === 'militia_f2') return 'militia_f2';
  if (value === 'f3' || value === 'militia_f3') return 'militia_f3';
  return undefined;
}

let forcedMilitiaReviewForm: MilitiaReviewForm | undefined = typeof window === 'undefined'
  ? undefined
  : parseMilitiaReviewForm(new URLSearchParams(window.location.search).get(MILITIA_FORM_QUERY_KEY));

export function isFirstSliceProductionReviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(REVIEW_QUERY_KEY) === REVIEW_QUERY_VALUE;
}

export function getFirstSliceReviewSpriteStrips(): readonly SpriteStrip[] {
  return Object.values(REVIEW_FAMILIES).flatMap((family) => [...allStrips(family)]);
}

function reviewKeyForUnit(unitId: string): FirstSliceReviewFamilyKey | undefined {
  if (unitId === 'militia') return forcedMilitiaReviewForm ?? getActiveVisualFormId('militia') as MilitiaReviewForm | undefined ?? 'militia_f1';
  if (unitId === 'enemy-raider' || unitId === 'enemy-boss') return unitId;
  return undefined;
}

export function getReviewAttackFxStyle(unitId: string): AttackFxStyle | undefined {
  const key = reviewKeyForUnit(unitId);
  return key ? REVIEW_ATTACK_FX[key] : undefined;
}

function reviewFamilyForUnit(unitId: string): RuntimeArtFamily | undefined {
  const key = reviewKeyForUnit(unitId);
  return key ? REVIEW_FAMILIES[key] : undefined;
}

function activeUnitCount(host: ReviewHost): number {
  return (host.state?.battle?.units ?? []).filter((unit) => unit.hp > 0).length;
}

interface ReviewUnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
}

interface ReviewHost {
  state: PlayableBattleState;
  views: Map<number, ReviewUnitView>;
  syncUnits(): void;
  playAttackFx(unit: BattleUnit, view: ReviewUnitView, style: AttackFxStyle): void;
  playUnitImpactFx(unit: BattleUnit, view: ReviewUnitView, damage: number): void;
}

const INSTALL_MARKER = Symbol('first-slice-production-review-runtime');
type InstallableScene = Phaser.Scene & ReviewHost & { [INSTALL_MARKER]?: boolean };

export function installFirstSliceProductionReviewRuntime(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  const host = scene as InstallableScene;
  if (host[INSTALL_MARKER]) return;
  const originalSyncUnits = host.syncUnits;
  const originalPlayAttackFx = host.playAttackFx;
  const originalPlayUnitImpactFx = host.playUnitImpactFx;
  if (typeof originalSyncUnits !== 'function') throw new Error('first-slice review runtime requires BattleScene.syncUnits');
  if (typeof originalPlayAttackFx !== 'function') throw new Error('first-slice review runtime requires BattleScene.playAttackFx');
  if (typeof originalPlayUnitImpactFx !== 'function') throw new Error('first-slice review runtime requires BattleScene.playUnitImpactFx');
  host[INSTALL_MARKER] = true;

  host.playAttackFx = (unit: BattleUnit, view: ReviewUnitView, style: AttackFxStyle): void => {
    const key = reviewKeyForUnit(unit.definition.id);
    if (!key) {
      originalPlayAttackFx.call(scene, unit, view, style);
      return;
    }
    const direction: 1 | -1 = unit.team === 'PLAYER' ? 1 : -1;
    const distance = key === 'militia_f2' ? 46 : key === 'militia_f3' ? 34 : key === 'enemy-boss' ? 42 : 36;
    playFirstSliceReviewContactFx(
      scene,
      key,
      view.sprite.x + direction * distance,
      view.sprite.y - (key === 'enemy-boss' ? 34 : 8),
      direction,
      activeUnitCount(host),
    );
  };

  host.playUnitImpactFx = (unit: BattleUnit, view: ReviewUnitView, damage: number): void => {
    const key = reviewKeyForUnit(unit.definition.id);
    if (!key) {
      originalPlayUnitImpactFx.call(scene, unit, view, damage);
      return;
    }
    playFirstSliceReviewImpactFx(
      scene,
      key,
      view.sprite.x,
      view.sprite.y - 8,
      damage / Math.max(1, unit.definition.maxHp),
      activeUnitCount(host),
    );
  };

  host.syncUnits = (): void => {
    originalSyncUnits.call(scene);
    const tick = host.state?.battle?.tick ?? 0;
    for (const unit of host.state?.battle?.units ?? []) {
      const family = reviewFamilyForUnit(unit.definition.id);
      if (!family) continue;
      const view = host.views.get(unit.simulationId);
      if (!view?.sprite?.active) continue;
      const motion = selectRuntimeMotionStrip(family, unit.state);
      if (view.sprite.texture.key !== motion.key) view.sprite.setTexture(motion.key, 0);
      const frame = getRuntimeMotionFrame(family, motion, unit, tick);
      if (frame >= 0 && frame < motion.frames) view.sprite.setFrame(frame);
      view.sprite.setScale(family.displayHeight / motion.frameHeight);
      view.sprite.clearTint();
    }
  };
}

function formLabel(form: MilitiaReviewForm | undefined): string {
  return form === 'militia_f2' ? 'F2' : form === 'militia_f3' ? 'F3' : form === 'militia_f1' ? 'F1' : 'AUTO';
}

export function renderFirstSliceProductionReviewLayer(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  const stage = (scene as unknown as { stage?: { theme?: string } }).stage;
  if (stage?.theme === 'meadow' && scene.textures.exists(FIRST_SLICE_REVIEW_MEADOW_KEY)) {
    scene.add.image(640, 360, FIRST_SLICE_REVIEW_MEADOW_KEY).setDisplaySize(1280, 720).setDepth(0);
  }

  scene.add.rectangle(640, 24, 760, 38, 0x17120d, 0.9).setStrokeStyle(2, 0xf0c967, 0.9).setDepth(190);
  scene.add.text(430, 24, 'PRODUCTION ART REVIEW · UNAPPROVED', {
    fontFamily: '"Malgun Gothic", sans-serif', fontSize: '17px', color: '#ffe39a',
  }).setOrigin(0.5).setDepth(191);

  const current = scene.add.text(700, 24, `MILITIA ${formLabel(forcedMilitiaReviewForm)}`, {
    fontFamily: '"Malgun Gothic", sans-serif', fontSize: '14px', color: '#c9d8ea',
  }).setOrigin(0.5).setDepth(191);

  const choices: readonly [string, MilitiaReviewForm | undefined][] = [
    ['AUTO', undefined], ['F1', 'militia_f1'], ['F2', 'militia_f2'], ['F3', 'militia_f3'],
  ];
  choices.forEach(([label, value], index) => {
    const button = scene.add.text(810 + index * 58, 24, label, {
      fontFamily: '"Malgun Gothic", sans-serif', fontSize: '14px', color: '#fff1b6',
      backgroundColor: '#3b3120', padding: { x: 7, y: 3 },
    }).setOrigin(0.5).setDepth(192).setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      forcedMilitiaReviewForm = value;
      current.setText(`MILITIA ${formLabel(value)}`);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (value) url.searchParams.set(MILITIA_FORM_QUERY_KEY, value.replace('militia_', ''));
        else url.searchParams.delete(MILITIA_FORM_QUERY_KEY);
        window.history.replaceState(null, '', url);
      }
    });
  });
}
