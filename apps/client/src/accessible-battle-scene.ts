import Phaser from 'phaser';
import { BattleScene } from './battle-scene';
import { installAccessibleBattleCameraFeedback } from './battle-camera-feedback';
import { installBattleCommandFeedback } from './battle-command-feedback.ts';
import { installBattleCommandHud } from './battle-command-hud.ts';
import { installStorySilhouetteOverlayRuntime } from './battle-story-silhouette-runtime.ts';
import { installBattleVfxDensityPolicy } from './battle-vfx-density';
import { addText, COLORS } from './scene-ui.ts';
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

interface BattlePresentationCarrier extends Phaser.Scene {
  initializeBattle(loading: Phaser.GameObjects.Text): Promise<void>;
  syncHud(): void;
  buttons: Map<string, { readonly cooldown: Phaser.GameObjects.Text }>;
}

const PLAYER_FACING_BATTLE_PRESENTATION_INSTALLED = Symbol('frontline-player-facing-battle-presentation-installed');

function safeBattleStartError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('온라인 상태')) return '로그인 계정은 온라인 상태에서만 전투를 시작할 수 있습니다.';
  if (message.includes('ticket') || message.includes('revision') || message.includes('state hash')) {
    return '온라인 전투 상태를 확인하지 못했습니다. 다시 출정해 주세요.';
  }
  if (message.includes('로그인') || message.includes('계정')) {
    return '계정의 전투 준비 상태를 확인하지 못했습니다. 연결 상태를 확인해 주세요.';
  }
  return '출정 준비 중 문제가 발생했습니다. 다시 시도해 주세요.';
}

function installPlayerFacingBattlePresentation(scene: Phaser.Scene): void {
  const carrier = scene as unknown as BattlePresentationCarrier & { [PLAYER_FACING_BATTLE_PRESENTATION_INSTALLED]?: boolean };
  if (carrier[PLAYER_FACING_BATTLE_PRESENTATION_INSTALLED]) return;
  if (typeof carrier.initializeBattle !== 'function' || typeof carrier.syncHud !== 'function') return;
  carrier[PLAYER_FACING_BATTLE_PRESENTATION_INSTALLED] = true;

  const initializeBattle = carrier.initializeBattle.bind(carrier);
  carrier.initializeBattle = async (loading: Phaser.GameObjects.Text): Promise<void> => {
    loading.setVisible(false);
    const publicStatus = addText(carrier, 640, 330, '출정 준비를 확인하는 중…', 25, COLORS.cream, 'center')
      .setOrigin(0.5)
      .setDepth(90);
    try {
      await initializeBattle(loading);
    } catch (error) {
      if (publicStatus.active) publicStatus.destroy();
      if (loading.active) {
        loading.setText('');
        loading.setVisible(true);
      }
      throw new Error(safeBattleStartError(error));
    } finally {
      if (publicStatus.active) publicStatus.destroy();
    }
  };

  const syncHud = carrier.syncHud.bind(carrier);
  carrier.syncHud = (): void => {
    syncHud();
    for (const view of carrier.buttons.values()) {
      const label = view.cooldown.text;
      if (/^\d+(?:\.\d+)?s$/.test(label)) view.cooldown.setText(`${label.slice(0, -1)}초`);
    }
  };
}

/**
 * Presentation-only bridge for camera/VFX accessibility plus production review presentation.
 * Deterministic simulation, progression, and trusted command logging remain in BattleScene unchanged.
 */
export class AccessibleBattleScene extends BattleScene {
  override create(): void {
    installAccessibleBattleCameraFeedback(this);
    installBattleVfxDensityPolicy(this);
    installBattleCommandFeedback(this);
    installBattleCommandHud(this);
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
    installPlayerFacingBattlePresentation(this);
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
