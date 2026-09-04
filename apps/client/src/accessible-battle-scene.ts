import { BattleScene } from './battle-scene';
import { installAccessibleBattleCameraFeedback } from './battle-camera-feedback';
import { installStorySilhouetteOverlayRuntime } from './battle-story-silhouette-runtime.ts';
import { installBattleVfxDensityPolicy } from './battle-vfx-density';
import {
  installFirstSliceProductionReviewAudio,
  startFirstSliceProductionReviewMusic,
} from './first-slice-production-review-audio.ts';
import { installFirstSliceProductionReviewHud } from './first-slice-production-review-hud.ts';
import { renderFirstSliceProductionReviewMeadowLayers } from './first-slice-production-review-meadow.ts';
import {
  installFirstSliceProductionReviewRuntime,
  isFirstSliceProductionReviewMode,
  renderFirstSliceProductionReviewLayer,
} from './first-slice-production-review-runtime.ts';
import { renderSecondSliceProductionReviewBattlefields } from './second-slice-production-review-battlefields.ts';
import {
  installSecondSliceProductionReviewRuntime,
  isSecondSliceProductionReviewMode,
  renderSecondSliceProductionReviewLayer,
} from './second-slice-production-review-runtime.ts';
import { renderThirdSliceProductionReviewBattlefields } from './third-slice-production-review-battlefields.ts';
import {
  installThirdSliceProductionReviewRuntime,
  isThirdSliceProductionReviewMode,
  renderThirdSliceProductionReviewLayer,
} from './third-slice-production-review-runtime.ts';

/**
 * Presentation-only bridge for camera/VFX accessibility plus production review presentation.
 * Deterministic simulation, progression, and trusted command logging remain in BattleScene unchanged.
 */
export class AccessibleBattleScene extends BattleScene {
  override create(): void {
    installAccessibleBattleCameraFeedback(this);
    installBattleVfxDensityPolicy(this);
    if (isFirstSliceProductionReviewMode()) {
      installFirstSliceProductionReviewRuntime(this);
      installFirstSliceProductionReviewAudio(this);
      installFirstSliceProductionReviewHud(this);
    } else if (isSecondSliceProductionReviewMode()) {
      installSecondSliceProductionReviewRuntime(this);
    } else if (isThirdSliceProductionReviewMode()) {
      installThirdSliceProductionReviewRuntime(this);
    } else {
      installStorySilhouetteOverlayRuntime(this);
    }
    super.create();
    renderFirstSliceProductionReviewLayer(this);
    renderFirstSliceProductionReviewMeadowLayers(this);
    startFirstSliceProductionReviewMusic(this);
    renderSecondSliceProductionReviewLayer(this);
    renderSecondSliceProductionReviewBattlefields(this);
    renderThirdSliceProductionReviewLayer(this);
    renderThirdSliceProductionReviewBattlefields(this);
  }
}
