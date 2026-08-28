import Phaser from 'phaser';
import { BattleScene } from './battle-scene';
import { getReplayConvenienceState, resolveBattleSpeed, scaleReplayDeltaMs, type BattleSpeedMultiplier } from './replay-convenience';
import { STAGES, getStage, type PrototypeStage } from './prototype';
import { loadGuestProgress } from './save';
import { addButton } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

/**
 * Adds NORMAL_CLEAR-gated replay speed without forking the combat simulation.
 * BattleScene remains the single source of truth for stepping, rendering and result flow.
 */
export class ReplayBattleScene extends BattleScene {
  private replayStage: PrototypeStage = STAGES[0]!;
  private replaySpeed: BattleSpeedMultiplier = 1;
  private speedUpUnlocked = false;
  private speedButton: Phaser.GameObjects.Container | undefined;

  override init(data: { stageId?: string }): void {
    super.init(data);
    this.replayStage = getStage(data.stageId ?? STAGES[0]!.id);
    this.replaySpeed = 1;
    this.speedUpUnlocked = false;
    this.speedButton = undefined;
  }

  override create(): void {
    super.create();
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      const convenience = getReplayConvenienceState(this.replayStage, progress);
      this.speedUpUnlocked = convenience.speedUpUnlocked;
      this.replaySpeed = resolveBattleSpeed(this.replaySpeed, convenience);
      this.renderSpeedButton();
    });
  }

  override update(time: number, delta: number): void {
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
