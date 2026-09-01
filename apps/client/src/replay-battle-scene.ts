import Phaser from 'phaser';
import { loadActiveProgress } from './active-progress';
import { QuirkBattleScene as BattleScene } from './quirk-battle-scene';
import { getReplayConvenienceState, resolveBattleSpeed, scaleReplayDeltaMs, type BattleSpeedMultiplier } from './replay-convenience';
import { STAGES, getStage, type PrototypeStage } from './prototype';
import { isSortieStageUnlocked } from './stage-navigation';
import { addButton } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

/**
 * Adds NORMAL_CLEAR-gated replay speed without forking the combat simulation.
 * QuirkBattleScene wraps the same authoritative combat step with deterministic hidden-achievement observation.
 */
export class ReplayBattleScene extends BattleScene {
  private replayStage: PrototypeStage = STAGES[0]!;
  private replaySpeed: BattleSpeedMultiplier = 1;
  private speedUpUnlocked = false;
  private speedButton: Phaser.GameObjects.Container | undefined;
  private battleCreateStarted = false;

  override init(data: { stageId?: string }): void {
    super.init(data);
    this.replayStage = getStage(data.stageId ?? STAGES[0]!.id);
    this.replaySpeed = 1;
    this.speedUpUnlocked = false;
    this.speedButton = undefined;
    this.battleCreateStarted = false;
  }

  override create(): void {
    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      if (view.authority === 'ACCOUNT_OFFLINE_CACHE') {
        this.scene.start('stage-hub');
        return;
      }
      const progress = view.progress;
      if (!isSortieStageUnlocked(this.replayStage.id, progress.clearedStageIds, progress.specialClearedStageIds)) {
        this.scene.start('stage-hub');
        return;
      }
      this.battleCreateStarted = true;
      super.create();
      const convenience = getReplayConvenienceState(this.replayStage, progress);
      this.speedUpUnlocked = convenience.speedUpUnlocked;
      this.replaySpeed = resolveBattleSpeed(this.replaySpeed, convenience);
      this.renderSpeedButton();
    }).catch(() => {
      if (this.scene.isActive()) this.scene.start('stage-hub');
    });
  }

  override update(time: number, delta: number): void {
    if (!this.battleCreateStarted) return;
    super.update(time, scaleReplayDeltaMs(delta, this.replaySpeed));
  }

  private toggleReplaySpeed(): void {
    if (!this.speedUpUnlocked) return;
    this.replaySpeed = this.replaySpeed === 1 ? 2 : 1;
    this.renderSpeedButton();
  }

  private renderSpeedButton(): void {
    this.speedButton?.destroy(true);
    const compact = isCompactMobileViewport();
    const label = this.speedUpUnlocked ? `${this.replaySpeed}×` : '1×';
    const button = addButton(
      this,
      510,
      55,
      compact ? 96 : 82,
      compact ? 84 : 42,
      label,
      () => this.toggleReplaySpeed(),
      this.speedUpUnlocked ? 0x6b94b7 : 0x485260,
    ).setDepth(90);
    if (!this.speedUpUnlocked) button.setAlpha(0.58);
    this.speedButton = button;
  }
}
