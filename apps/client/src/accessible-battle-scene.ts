import { BattleScene } from './battle-scene';
import { installAccessibleBattleCameraFeedback } from './battle-camera-feedback';
import { installStorySilhouetteOverlayRuntime } from './battle-story-silhouette-runtime.ts';
import { installBattleVfxDensityPolicy } from './battle-vfx-density';
import {
  installFirstSliceProductionReviewAudio,
  startFirstSliceProductionReviewMusic,
} from './first-slice-production-review-audio.ts';
import { renderFirstSliceProductionReviewMeadowLayers } from './first-slice-production-review-meadow.ts';
import {
  installFirstSliceProductionReviewRuntime,
  isFirstSliceProductionReviewMode,
  renderFirstSliceProductionReviewLayer,
} from './first-slice-production-review-runtime.ts';

/**
 * Presentation-only bridge for legacy battle VFX that still call camera feedback directly.
 * Deterministic simulation and trusted command logging remain in BattleScene unchanged.
 */
export class AccessibleBattleScene extends BattleScene {
  override create(): void {
    installAccessibleBattleCameraFeedback(this);
    installBattleVfxDensityPolicy(this);
    if (isFirstSliceProductionReviewMode()) {
      installFirstSliceProductionReviewRuntime(this);
      installFirstSliceProductionReviewAudio(this);
    } else {
      installStorySilhouetteOverlayRuntime(this);
    }
    super.create();
    renderFirstSliceProductionReviewLayer(this);
    renderFirstSliceProductionReviewMeadowLayers(this);
    startFirstSliceProductionReviewMusic(this);
  }
}
