import { BattleScene } from './battle-scene';
import { installAccessibleBattleCameraFeedback } from './battle-camera-feedback';

/**
 * Presentation-only bridge for legacy battle VFX that still call camera feedback directly.
 * Deterministic simulation and trusted command logging remain in BattleScene unchanged.
 */
export class AccessibleBattleScene extends BattleScene {
  override create(): void {
    installAccessibleBattleCameraFeedback(this);
    super.create();
  }
}
