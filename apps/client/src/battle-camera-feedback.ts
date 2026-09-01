import Phaser from 'phaser';
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
  return typeof value === 'number' ? value * factor : value;
}

/**
 * Installs a per-camera compatibility gate for authored battle feedback.
 * The wrapper never observes or mutates deterministic simulation state.
 */
export function installAccessibleBattleCameraFeedback(scene: Phaser.Scene): void {
  const camera = scene.cameras.main as AccessibleFeedbackCamera;
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
