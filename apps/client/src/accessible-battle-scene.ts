import { BattleScene } from './battle-scene';
import { installAccessibleBattleCameraFeedback } from './battle-camera-feedback';
import { installBattleVfxDensityPolicy } from './battle-vfx-density';

/**
 * Presentation-only bridge for legacy battle VFX that still call camera feedback directly.
 * Deterministic simulation and trusted command logging remain in BattleScene unchanged.
 */
export class AccessibleBattleScene extends BattleScene {
  override create(): void {
    installAccessibleBattleCameraFeedback(this);
    installBattleVfxDensityPolicy(this);
    super.create();
  }
}
