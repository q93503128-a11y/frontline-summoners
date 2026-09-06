import Phaser from 'phaser';
import { loadActiveProgress } from './active-progress';
import { installBattleFrontlineOverlay } from './battle-frontline-overlay';
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

function rewriteBattleLine(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '편성과 전장 불러오는 중…': '출정 준비 중…',
    '서버 전투 ticket 발급 중…': '계정 전투 준비 중…',
    '일 시 정 지': '일시정지',
    '계 속': '계속',
    '솔로 전투 정지 · 보급·쿨다운·적 스폰도 멈춤': '전투가 완전히 멈춥니다.',
    'P 또는 ESC로도 계속할 수 있습니다.': 'P / ESC로 계속',
  };
  if (direct[value]) return direct[value]!;
  if (/전투 ticket|revision|state hash|initialStateHash|trusted battle|terminal state/i.test(value)) {
    return '계정 전투 정보를 확인하지 못했습니다. 다시 출정해 주세요.';
  }
  if (/^출정 실패 ·/.test(value)) return value.replace(/^출정 실패 · .+$/, '출정 준비에 실패했습니다. 다시 시도해 주세요.');
  return value;
}

function rewriteBattleText(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(rewriteBattleLine) : rewriteBattleLine(value);
}

/**
 * Standard direct battles expose replay speed without changing the authoritative combat simulation.
 * This adapter also keeps server/debug vocabulary out of the player-facing battle surface.
 */
export class ReplayBattleScene extends BattleScene {
  private replayStage: PrototypeStage = STAGES[0]!;
  private replaySpeed: BattleSpeedMultiplier = 1;
  private maxReplaySpeed: MaxBattleSpeedMultiplier = 2;
  private tripleSpeedUnlocked = false;
  private speedButton: Phaser.GameObjects.Container | undefined;
  private battleCreateStarted = false;
  private restoreBattleText: (() => void) | undefined;

  override init(data: { stageId?: string }): void {
    super.init(data);
    this.replayStage = getStage(data.stageId ?? STAGES[0]!.id);
    this.replaySpeed = 1;
    this.maxReplaySpeed = 2;
    this.tripleSpeedUnlocked = false;
    this.speedButton = undefined;
    this.battleCreateStarted = false;
    this.restoreBattleText = undefined;
  }

  override create(): void {
    this.installBattleTextPresentation();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.restoreBattleText?.();
      this.restoreBattleText = undefined;
    });

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
      installBattleFrontlineOverlay(this);
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

  private installBattleTextPresentation(): void {
    const factory = this.add;
    const originalText = factory.text;
    factory.text = ((x, y, value, style) => {
      const target = originalText.call(factory, x, y, rewriteBattleText(value), style);
      const originalSetText = target.setText.bind(target);
      target.setText = ((next: string | string[]) => originalSetText(rewriteBattleText(next))) as typeof target.setText;
      return target;
    }) as typeof factory.text;
    this.restoreBattleText = () => { factory.text = originalText; };
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
      { tone: 'quiet' },
    ).setDepth(90).setAlpha(0.92);
    this.speedButton = button;
  }
}
