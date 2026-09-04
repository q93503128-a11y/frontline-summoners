import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { SpriteStrip } from './assets.ts';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import { getRuntimeMotionFrame, selectRuntimeMotionStrip } from './production-motion.ts';
import type { RuntimeArtFamily } from './production-assets.ts';

const ROOT = '/assets/production/units';
const REVIEW_QUERY_KEY = 'productionReview';
const REVIEW_QUERY_VALUE = 'first-slice';
export const FIRST_SLICE_REVIEW_MEADOW_KEY = 'production-review-meadow';
export const FIRST_SLICE_REVIEW_MEADOW_URL = '/assets/production/battlefields/meadow/battlefield-base.svg';

function strip(key: string, url: string, frameWidth: number, frameHeight: number, frames: number): SpriteStrip {
  return { key, url, frameWidth, frameHeight, frames };
}

const REVIEW_FAMILIES: Readonly<Record<string, RuntimeArtFamily>> = {
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

function allStrips(family: RuntimeArtFamily): readonly SpriteStrip[] {
  return [family.idle, family.run, family.attack, ...(family.knockback ? [family.knockback] : []), ...(family.death ? [family.death] : [])];
}

export function isFirstSliceProductionReviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(REVIEW_QUERY_KEY) === REVIEW_QUERY_VALUE;
}

export function getFirstSliceReviewSpriteStrips(): readonly SpriteStrip[] {
  return Object.values(REVIEW_FAMILIES).flatMap((family) => [...allStrips(family)]);
}

function reviewFamilyForUnit(unitId: string): RuntimeArtFamily | undefined {
  if (unitId === 'militia') {
    return REVIEW_FAMILIES[getActiveVisualFormId('militia') ?? 'militia_f1'] ?? REVIEW_FAMILIES.militia_f1;
  }
  return REVIEW_FAMILIES[unitId];
}

interface ReviewUnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
  stateKey: string;
}

interface ReviewHost {
  state: PlayableBattleState;
  views: Map<number, ReviewUnitView>;
  syncUnits(): void;
}

const INSTALL_MARKER = Symbol('first-slice-production-review-runtime');
type InstallableScene = Phaser.Scene & ReviewHost & { [INSTALL_MARKER]?: boolean };

export function installFirstSliceProductionReviewRuntime(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  const host = scene as InstallableScene;
  if (host[INSTALL_MARKER]) return;
  const original = host.syncUnits;
  if (typeof original !== 'function') throw new Error('first-slice review runtime requires BattleScene.syncUnits');
  host[INSTALL_MARKER] = true;
  host.syncUnits = (): void => {
    original.call(scene);
    const tick = host.state?.battle?.tick ?? 0;
    for (const unit of host.state?.battle?.units ?? []) {
      const family = reviewFamilyForUnit(unit.definition.id);
      if (!family) continue;
      const view = host.views.get(unit.simulationId);
      if (!view?.sprite?.active) continue;
      const motion = selectRuntimeMotionStrip(family, unit.state);
      const stateKey = `review:${motion.key}:${unit.state}`;
      if (view.stateKey !== stateKey) {
        view.sprite.setTexture(motion.key, 0);
        view.stateKey = stateKey;
      }
      const frame = getRuntimeMotionFrame(family, motion, unit as BattleUnit, tick);
      if (frame >= 0 && frame < motion.frames) view.sprite.setFrame(frame);
      view.sprite.setScale(family.displayHeight / motion.frameHeight);
    }
  };
}

export function renderFirstSliceProductionReviewLayer(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  const stage = (scene as unknown as { stage?: { theme?: string } }).stage;
  if (stage?.theme === 'meadow' && scene.textures.exists(FIRST_SLICE_REVIEW_MEADOW_KEY)) {
    scene.add.image(640, 360, FIRST_SLICE_REVIEW_MEADOW_KEY).setDisplaySize(1280, 720).setDepth(0);
  }
  scene.add.rectangle(640, 24, 560, 36, 0x17120d, 0.88).setStrokeStyle(2, 0xf0c967, 0.9).setDepth(190);
  scene.add.text(640, 24, 'PRODUCTION ART REVIEW · UNAPPROVED', {
    fontFamily: '"Malgun Gothic", sans-serif', fontSize: '17px', color: '#ffe39a',
  }).setOrigin(0.5).setDepth(191);
}
