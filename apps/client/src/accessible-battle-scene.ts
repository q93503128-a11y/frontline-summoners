import Phaser from 'phaser';
import { BattleScene } from './battle-scene';
import { getBattleFeedbackPolicy } from './battle-feedback-policy';

type CameraShake = Phaser.Cameras.Scene2D.Camera['shake'];
type CameraShakeArgs = Parameters<CameraShake>;
type CameraFlash = Phaser.Cameras.Scene2D.Camera['flash'];
type CameraFlashArgs = Parameters<CameraFlash>;

const ACCESSIBLE_FEEDBACK_INSTALLED: unique symbol = Symbol('frontline-accessible-battle-feedback-installed');
const ACCESSIBLE_SHAKE_ORIGINAL: unique symbol = Symbol('frontline-accessible-battle-shake-original');
const ACCESSIBLE_FLASH_ORIGINAL: unique symbol = Symbol('frontline-accessible-battle-flash-original');

interface AccessibleFeedbackCamera extends Phaser.Cameras.Scene2D.Camera {
  [ACCESSIBLE_FEEDBACK_INSTALLED]?: boolean;
  [ACCESSIBLE_SHAKE_ORIGINAL]?: CameraShake;
  [ACCESSIBLE_FLASH_ORIGINAL]?: CameraFlash;
}

function scaleShakeArgument(value: CameraShakeArgs[1], factor: number): CameraShakeArgs[1] {
  if (typeof value === 'number') return value * factor;
  if (!value || factor === 1) return value;
  return new Phaser.Math.Vector2(value.x * factor, value.y * factor) as CameraShakeArgs[1];
}

/**
 * Compatibility layer for battle VFX that still call Camera.shake / Camera.flash directly.
 * It is deliberately presentation-only: the deterministic battle state and
 * trusted command recorder remain untouched.
 */
export class AccessibleBattleScene extends BattleScene {
  override create(): void {
    this.installAccessibleCameraFeedback();
    super.create();
  }

  private installAccessibleCameraFeedback(): void {
    const camera = this.cameras.main as AccessibleFeedbackCamera;
    if (camera[ACCESSIBLE_FEEDBACK_INSTALLED]) return;

    const originalShake = camera.shake.bind(camera) as CameraShake;
    const originalFlash = camera.flash.bind(camera) as CameraFlash;
    camera[ACCESSIBLE_FEEDBACK_INSTALLED] = true;
    camera[ACCESSIBLE_SHAKE_ORIGINAL] = originalShake;
    camera[ACCESSIBLE_FLASH_ORIGINAL] = originalFlash;

    camera.shake = ((...args: CameraShakeArgs) => {
      const policy = getBattleFeedbackPolicy();
      if (policy.screenShakeFactor <= 0) return camera;
      const scaledArgs = [...args] as CameraShakeArgs;
      scaledArgs[1] = scaleShakeArgument(scaledArgs[1], policy.screenShakeFactor);
      return originalShake(...scaledArgs);
    }) as CameraShake;

    camera.flash = ((...args: CameraFlashArgs) => {
      if (!getBattleFeedbackPolicy().strongFlash) return camera;
      return originalFlash(...args);
    }) as CameraFlash;
  }
}
