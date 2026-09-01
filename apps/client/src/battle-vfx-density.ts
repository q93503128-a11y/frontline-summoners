import Phaser from 'phaser';
import { getBattleFeedbackPolicy, type BattleFeedbackPolicy } from './battle-feedback-policy';

export interface BattleVfxDescriptor {
  readonly type: string;
  readonly depth: number;
  readonly fillAlpha?: number;
  readonly fillColor?: number;
  readonly strokeAlpha?: number;
}

export interface BattleVfxTreatment {
  readonly visible: boolean;
  readonly alphaMultiplier: number;
}

const EFFECT_DEPTH_MIN = 9;
const EFFECT_DEPTH_MAX = 20;
const EFFECT_SHAPE_TYPES = new Set(['Arc', 'Ellipse', 'Rectangle', 'Triangle', 'Line']);

function isBrightNeutral(color: number | undefined): boolean {
  if (color === undefined || !Number.isInteger(color)) return false;
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return max >= 238 && min >= 190 && max - min <= 68;
}

/**
 * Returns presentation-only treatment for short-lived combat shapes.
 * Unit/projectile containers, sprites, HP/UI layers and simulation state are intentionally outside this policy.
 */
export function resolveBattleVfxTreatment(
  descriptor: BattleVfxDescriptor,
  policy: BattleFeedbackPolicy = getBattleFeedbackPolicy(),
): BattleVfxTreatment | null {
  if (descriptor.depth < EFFECT_DEPTH_MIN || descriptor.depth > EFFECT_DEPTH_MAX) return null;
  if (!EFFECT_SHAPE_TYPES.has(descriptor.type)) return null;

  let visible = true;
  let alphaMultiplier = 1;
  const fillAlpha = descriptor.fillAlpha ?? 1;
  const strokeAlpha = descriptor.strokeAlpha ?? 0;

  if (policy.reducedDecorativeEffects) {
    if (descriptor.type === 'Ellipse' && fillAlpha <= 0.5) {
      visible = false;
    } else if (descriptor.type === 'Arc' && fillAlpha <= 0.5) {
      if (strokeAlpha > 0.1) alphaMultiplier *= 0.48;
      else visible = false;
    } else if (descriptor.type === 'Rectangle' && fillAlpha <= 0.5) {
      // Base-hit flashes remain readable, but their broad translucent wash is reduced.
      alphaMultiplier *= 0.55;
    }
  }

  if (visible && !policy.strongFlash && fillAlpha >= 0.7 && isBrightNeutral(descriptor.fillColor)) {
    // Preserve local hit/contact position while avoiding a high-luminance white core.
    alphaMultiplier *= 0.5;
  }

  return { visible, alphaMultiplier };
}

type ShapeLike = Phaser.GameObjects.GameObject & {
  readonly depth?: number;
  readonly alpha?: number;
  readonly fillAlpha?: number;
  readonly fillColor?: number;
  readonly strokeAlpha?: number;
  setAlpha?(value: number): unknown;
  setVisible?(value: boolean): unknown;
};

function describe(gameObject: ShapeLike): BattleVfxDescriptor | null {
  if (typeof gameObject.depth !== 'number') return null;
  return {
    type: gameObject.type,
    depth: gameObject.depth,
    ...(typeof gameObject.fillAlpha === 'number' ? { fillAlpha: gameObject.fillAlpha } : {}),
    ...(typeof gameObject.fillColor === 'number' ? { fillColor: gameObject.fillColor } : {}),
    ...(typeof gameObject.strokeAlpha === 'number' ? { strokeAlpha: gameObject.strokeAlpha } : {}),
  };
}

/**
 * Applies the authored LOW/battery VFX pass to newly-created battle shapes.
 * This runs after scene update so existing BattleScene FX code can stay deterministic and unchanged.
 */
export function installBattleVfxDensityPolicy(scene: Phaser.Scene): void {
  const processed = new WeakSet<Phaser.GameObjects.GameObject>();

  const apply = (): void => {
    const policy = getBattleFeedbackPolicy();
    for (const raw of scene.children.list) {
      if (processed.has(raw)) continue;
      processed.add(raw);
      const object = raw as ShapeLike;
      const descriptor = describe(object);
      if (!descriptor) continue;
      const treatment = resolveBattleVfxTreatment(descriptor, policy);
      if (!treatment) continue;
      if (!treatment.visible) {
        object.setVisible?.(false);
        continue;
      }
      if (treatment.alphaMultiplier < 1 && typeof object.setAlpha === 'function') {
        object.setAlpha((object.alpha ?? 1) * treatment.alphaMultiplier);
      }
    }
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, apply);
  });
}
