import Phaser from 'phaser';
import { BattleScene } from './battle-scene';
import { getBattleFeedbackPolicy } from './battle-feedback-policy';

type CameraShake = Phaser.Cameras.Scene2D.Camera['shake'];
type CameraShakeArgs = Parameters<CameraShake>;

const ACCESSIBLE_SHAKE_INSTALLED: unique symbol = Symbol('frontline-accessible-battle-shake-installed');
const ACCESSIBLE_SHAKE_ORIGINAL: unique symbol = Symbol('frontline-accessible-battle-shake-original');

interface AccessibleShakeCamera extends Phaser.Cameras.Scene2D.Camera {
  [ACCESSIBLE_SHAKE_INSTALLED]?: boolean;
  [ACCESSIBLE_SHAKE_ORIGINAL]?: CameraShake;
}

function scaleShakeArgument(value: CameraShakeArgs[1], factor: number): CameraShakeArgs[1] {
  if (typeof value === 'number') return value * factor;
  if (!value || factor === 1) return value;
  return new Phaser.Math.Vector2(value.x * factor, value.y * factor) as CameraShakeArgs[1];
}

/**
 * Compatibility layer for battle VFX that still call Camera.shake directly.
 * It is deliberately presentation-only: the deterministic battle state and
 * trusted command recorder remain untouched.
 */
export class AccessibleBattleScene extends BattleScene {
  override create(): void {
    this.installAccessibleCameraShake();
    super.create();
  }

  private installAccessibleCameraShake(): void {
    const camera = this.cameras.main as AccessibleShakeCamera;
    if (camera[ACCESSIBLE_SHAKE_INSTALLED]) return;

    const originalShake = camera.shake.bind(camera) as CameraShake;
    camera[ACCESSIBLE_SHAKE_INSTALLED] = true;
    camera[ACCESSIBLE_SHAKE_ORIGINAL] = originalShake;

    camera.shake = ((...args: CameraShakeArgs) => {
      const policy = getBattleFeedbackPolicy();
      if (policy.screenShakeFactor <= 0) return camera;
      const scaledArgs = [...args] as CameraShakeArgs;
      scaledArgs[1] = scaleShakeArgument(scaledArgs[1], policy.screenShakeFactor);
      return originalShake(...scaledArgs);
    }) as CameraShake;
  }
}
