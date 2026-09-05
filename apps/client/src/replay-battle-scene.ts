import Phaser from 'phaser';
import { loadActiveProgress } from './active-progress';
import { QuirkBattleScene as BattleScene } from './quirk-battle-scene';
import {
  getNextBattleSpeed,
  getReplayConvenienceState,
  resolveBattleSpeed,
  scaleReplayDeltaMs,
  type BattleSpeedMultiplier,
  type MaxBattleSpeedMultiplier,
} from './replay-convenience';
import { STAGES, getStage, type PrototypeStage } from './prototype';
import { isSortieStageUnlocked } from './stage-navigation';
import { addButton } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

/**
 * Standard direct battles expose 1×/2× immediately and add 3× after that stage's
 * NORMAL_CLEAR, without forking the authoritative combat simulation.
 * QuirkBattleScene wraps the same authoritative combat step with deterministic hidden-achievement observation.
 */
export class ReplayBattleScene extends BattleScene {
  private replayStage: PrototypeStage = STAGES[0]!;
  private replaySpeed: BattleSpeedMultiplier = 1;
  private maxReplaySpeed: MaxBattleSpeedMultiplier = 2;
  private tripleSpeedUnlocked = false;
  private speedButton: Phaser.GameObjects.Container | undefined;
  private battleCreateStarted = false;

  override init(data: { stageId?: string }): void {
    super.init(data);
    this.replayStage = getStage(data.stageId ?? STAGES[0]!.id);
    this.replaySpeed = 1;
    this.maxReplaySpeed = 2;
    this.tripleSpeedUnlocked = false;
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
      this.maxReplaySpeed = convenience.maxBattleSpeed;
      this.tripleSpeedUnlocked = convenience.tripleSpeedUnlocked;
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
    const convenience = {
      maxBattleSpeed: this.maxReplaySpeed,
      tripleSpeedUnlocked: this.tripleSpeedUnlocked,
      sweepUnlocked: false,
    } as const;
    this.replaySpeed = getNextBattleSpeed(this.replaySpeed, convenience);
    this.renderSpeedButton();
  }

  private renderSpeedButton(): void {
    this.speedButton?.destroy(true);
    const compact = isCompactMobileViewport();
    const button = addButton(
      this,
      510,
      55,
      compact ? 96 : 82,
      compact ? 84 : 42,
      `${this.replaySpeed}×`,
      () => this.toggleReplaySpeed(),
      this.tripleSpeedUnlocked ? 0x7d6aa6 : 0x6b94b7,
    ).setDepth(90);
    this.speedButton = button;
  }
}
