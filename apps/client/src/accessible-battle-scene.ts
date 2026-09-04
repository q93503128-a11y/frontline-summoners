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
import { renderFourthSliceProductionReviewBattlefields } from './fourth-slice-production-review-battlefields.ts';
import {
  installFourthSliceProductionReviewRuntime,
  isFourthSliceProductionReviewMode,
  renderFourthSliceProductionReviewLayer,
} from './fourth-slice-production-review-runtime.ts';
import { renderFifthSliceProductionReviewBattlefields } from './fifth-slice-production-review-battlefields.ts';
import {
  installFifthSliceProductionReviewRuntime,
  isFifthSliceProductionReviewMode,
  renderFifthSliceProductionReviewLayer,
} from './fifth-slice-production-review-runtime.ts';
import { renderSixthSliceProductionReviewBattlefields } from './sixth-slice-production-review-battlefields.ts';
import {
  installSixthSliceProductionReviewRuntime,
  isSixthSliceProductionReviewMode,
  renderSixthSliceProductionReviewLayer,
} from './sixth-slice-production-review-runtime.ts';
import { renderChapter02ProductionReviewBattlefields } from './chapter-02-production-review-battlefields.ts';
import {
  installChapter02ProductionReviewRuntime,
  isChapter02ProductionReviewMode,
  renderChapter02ProductionReviewLayer,
} from './chapter-02-production-review-runtime.ts';
import { renderChapter03ProductionReviewBattlefields } from './chapter-03-production-review-battlefields.ts';
import {
  installChapter03ProductionReviewRuntime,
  isChapter03ProductionReviewMode,
  renderChapter03ProductionReviewLayer,
} from './chapter-03-production-review-runtime.ts';
import { renderChapter04ProductionReviewBattlefields } from './chapter-04-production-review-battlefields.ts';
import {
  installChapter04ProductionReviewRuntime,
  isChapter04ProductionReviewMode,
  renderChapter04ProductionReviewLayer,
} from './chapter-04-production-review-runtime.ts';
import { renderSpecialContentProductionReviewBattlefields } from './special-content-production-review-battlefields.ts';
import {
  installSpecialContentProductionReviewRuntime,
  isSpecialContentProductionReviewMode,
  renderSpecialContentProductionReviewLayer,
} from './special-content-production-review-runtime.ts';
import {
  installRecruitmentProductionReviewRuntime,
  isRecruitmentProductionReviewMode,
  renderRecruitmentProductionReviewLayer,
} from './recruitment-production-review-runtime.ts';

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
    } else if (isFourthSliceProductionReviewMode()) {
      installFourthSliceProductionReviewRuntime(this);
    } else if (isFifthSliceProductionReviewMode()) {
      installFifthSliceProductionReviewRuntime(this);
    } else if (isSixthSliceProductionReviewMode()) {
      installSixthSliceProductionReviewRuntime(this);
    } else if (isChapter02ProductionReviewMode()) {
      installChapter02ProductionReviewRuntime(this);
    } else if (isChapter03ProductionReviewMode()) {
      installChapter03ProductionReviewRuntime(this);
    } else if (isChapter04ProductionReviewMode()) {
      installChapter04ProductionReviewRuntime(this);
    } else if (isSpecialContentProductionReviewMode()) {
      installSpecialContentProductionReviewRuntime(this);
    } else if (isRecruitmentProductionReviewMode()) {
      installRecruitmentProductionReviewRuntime(this);
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
    renderFourthSliceProductionReviewLayer(this);
    renderFourthSliceProductionReviewBattlefields(this);
    renderFifthSliceProductionReviewLayer(this);
    renderFifthSliceProductionReviewBattlefields(this);
    renderSixthSliceProductionReviewLayer(this);
    renderSixthSliceProductionReviewBattlefields(this);
    renderChapter02ProductionReviewLayer(this);
    renderChapter02ProductionReviewBattlefields(this);
    renderChapter03ProductionReviewLayer(this);
    renderChapter03ProductionReviewBattlefields(this);
    renderChapter04ProductionReviewLayer(this);
    renderChapter04ProductionReviewBattlefields(this);
    renderSpecialContentProductionReviewLayer(this);
    renderSpecialContentProductionReviewBattlefields(this);
    renderRecruitmentProductionReviewLayer(this);
  }
}
