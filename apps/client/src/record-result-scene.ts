import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import {
  claimAuthenticatedTrustedBattle,
  completeAuthenticatedTrustedBattle,
  type AccountTrustedBattleCommand,
  type AccountTrustedBattleCompletion,
} from './account-network.ts';
import { accountSnapshotToGuestProgress } from './active-progress.ts';
import { BOSS_RUSH_SEQUENCE, getRecordModeDefinition, type RecordModeId } from './record-content.ts';
import { recordGuestBossRushResult, recordGuestEndlessResult, type GuestRecordResult, type RecordModeProgress } from './save.ts';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

interface RecordedRecordResult {
  readonly improved: boolean;
  readonly resourceReward: Readonly<Record<string, number | undefined>>;
  readonly recordModeProgress: RecordModeProgress;
  readonly persisted: boolean;
  readonly serverVerified: boolean;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatResourceReward(reward: Readonly<Record<string, number | undefined>>): string {
  const labels: Readonly<Record<string, string>> = {
    gold: '골드',
    evo_fragment: '진화 조각',
    evo_core: '진화 핵심',
    evo_crown: '진화 왕관',
    soul_essence: '혼의 파편',
    summon_crystal: '모집 결정',
    sweep_ticket: '소탕권',
  };
  const parts = Object.entries(reward)
    .filter(([, amount]) => typeof amount === 'number' && amount > 0)
    .map(([id, amount]) => `${labels[id] ?? id} +${amount!.toLocaleString('ko-KR')}`);
  return parts.length > 0 ? parts.join(' · ') : '새 구간 재화 보상 없음';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseResourceReward(value: unknown): Readonly<Record<string, number | undefined>> {
  if (!isRecord(value)) throw new Error('서버 기록 보상 형식이 올바르지 않습니다.');
  const result: Record<string, number> = {};
  for (const [id, amount] of Object.entries(value)) {
    if (!Number.isInteger(amount) || (amount as number) < 0) throw new Error('서버 기록 보상 수량이 올바르지 않습니다.');
    result[id] = amount as number;
  }
  return result;
}

function assertTrustedCompletion(modeId: RecordModeId, completion: AccountTrustedBattleCompletion): void {
  if (completion.kind !== 'RECORD' || completion.targetId !== modeId) throw new Error('서버 기록전 검증 대상이 현재 전투와 다릅니다.');
  const expectedMode = modeId === 'record_endless_front' ? 'ENDLESS_FRONT' : 'BOSS_RUSH';
  if (completion.recordMode !== expectedMode) throw new Error('서버 기록전 모드 검증이 일치하지 않습니다.');
}

export class RecordResultScene extends Phaser.Scene {
  private modeId: RecordModeId = 'record_endless_front';
  private survivalMs = 0;
  private defeatedBosses = 0;
  private completed = false;
  private trustedBattleId: string | null = null;
  private trustedCommands: readonly AccountTrustedBattleCommand[] = [];
  private resultRecorded = false;

  constructor() { super('record-result'); }

  init(data: {
    modeId?: RecordModeId;
    survivalMs?: number;
    defeatedBosses?: number;
    completed?: boolean;
    trustedBattleId?: string;
    trustedCommands?: readonly AccountTrustedBattleCommand[];
  }): void {
    this.modeId = data.modeId ?? 'record_endless_front';
    this.survivalMs = Math.max(0, Math.floor(data.survivalMs ?? 0));
    this.defeatedBosses = Math.max(0, Math.min(BOSS_RUSH_SEQUENCE.length, Math.floor(data.defeatedBosses ?? 0)));
    this.completed = Boolean(data.completed);
    this.trustedBattleId = typeof data.trustedBattleId === 'string' && data.trustedBattleId.length > 0 ? data.trustedBattleId : null;
    this.trustedCommands = Array.isArray(data.trustedCommands) ? [...data.trustedCommands] : [];
    this.resultRecorded = false;
  }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    const mode = getRecordModeDefinition(this.modeId);
    const endless = this.modeId === 'record_endless_front';
    const title = !endless && this.completed ? '전 부 격 파' : '기 록 종 료';
    const initialScore = endless
      ? `생존 ${formatDuration(this.survivalMs)} · ${Math.floor(this.survivalMs / 60000)}분 경계`
      : `${this.defeatedBosses} / ${BOSS_RUSH_SEQUENCE.length} 보스 격파`;

    addText(this, INTERNAL_WIDTH / 2, compact ? 70 : 82, title, compact ? 52 : 58, this.completed ? COLORS.gold : COLORS.cream, 'center').setOrigin(0.5);
    addText(this, INTERNAL_WIDTH / 2, compact ? 132 : 145, mode.displayName, compact ? 29 : 25, '#dce4ef', 'center').setOrigin(0.5);
    this.add.rectangle(INTERNAL_WIDTH / 2, compact ? 350 : 355, compact ? 860 : 780, compact ? 370 : 330, 0x242b38, 0.98).setStrokeStyle(3, this.completed ? 0xb99449 : 0x63758d);
    const scoreText = addText(this, INTERNAL_WIDTH / 2, compact ? 218 : 230, initialScore, compact ? 34 : 31, '#f1d58a', 'center').setOrigin(0.5);
    addText(this, INTERNAL_WIDTH / 2, compact ? 275 : 292, endless ? '플레이어 거점 파괴 시점까지의 기록' : this.completed ? '현재 1차 보스 러시 전 구간 완료' : '실패 전까지 새로 격파한 보스 구간도 기록', compact ? 21 : 18, '#b8c5d6', 'center').setOrigin(0.5);
    const bestText = addText(this, INTERNAL_WIDTH / 2, compact ? 340 : 350, '최고기록 계산 중…', compact ? 24 : 21, '#a9caee', 'center').setOrigin(0.5);
    const rewardText = addText(this, INTERNAL_WIDTH / 2, compact ? 400 : 405, '새 구간 보상 계산 중…', compact ? 21 : 18, '#f2d37c', 'center').setOrigin(0.5).setWordWrapWidth(compact ? 760 : 700);
    const status = addText(this, INTERNAL_WIDTH / 2, compact ? 462 : 460, this.trustedBattleId ? '서버 재생 검증·기록 저장 중…' : '기록·구간 보상 저장 중…', compact ? 20 : 16, '#8f9aac', 'center').setOrigin(0.5);

    let retryButton: Phaser.GameObjects.Container | null = null;
    const submit = (): void => {
      status.setText(this.trustedBattleId ? '서버 재생 검증·기록 저장 중…' : '기록·구간 보상 저장 중…').setColor('#8f9aac');
      retryButton?.setVisible(false);
      const recording: Promise<RecordedRecordResult> = this.trustedBattleId
        ? this.recordAuthenticatedResult(this.trustedBattleId, this.trustedCommands)
        : (endless ? recordGuestEndlessResult(this.survivalMs) : recordGuestBossRushResult(this.defeatedBosses))
            .then((result: GuestRecordResult) => ({
              improved: result.improved,
              resourceReward: result.resourceReward,
              recordModeProgress: result.recordModeProgress,
              persisted: result.persisted,
              serverVerified: false,
            }));
      void recording.then((result) => this.applyRecordedResult(result, scoreText, bestText, rewardText, status)).catch((error: unknown) => {
        if (!this.scene.isActive()) return;
        if (this.trustedBattleId) {
          this.resultRecorded = false;
          bestText.setText('서버 기록 검증 미완료');
          rewardText.setText('검증 완료 전에는 계정 보상이 지급되지 않음');
          status.setText(error instanceof Error ? error.message : '서버 기록전 결과 처리에 실패했습니다.').setColor('#ff9a91');
          retryButton?.setVisible(true);
          return;
        }
        this.resultRecorded = true;
        bestText.setText('기록 처리 실패');
        rewardText.setText('구간 보상 저장 실패');
        status.setText(error instanceof Error ? error.message : '기록전 결과 처리에 실패했습니다.').setColor('#ff9a91');
      });
    };

    if (this.trustedBattleId) {
      retryButton = addButton(this, INTERNAL_WIDTH / 2, compact ? 526 : 515, 230, compact ? 72 : 52, '결과 재전송', submit, 0x8d654f);
      retryButton.setVisible(false);
    }
    submit();

    const guarded = (action: () => void): void => { if (this.resultRecorded) action(); };
    const buttonHeight = compact ? 84 : 68;
    addButton(this, 370, compact ? 610 : 595, 260, buttonHeight, '다시 도전', () => guarded(() => this.scene.start('record-battle', { modeId: this.modeId })), 0x6d88a7);
    addButton(this, 650, compact ? 610 : 595, 240, buttonHeight, '기록전', () => guarded(() => this.scene.start('record-hub')), 0x80659b);
    addButton(this, 910, compact ? 610 : 595, 220, buttonHeight, '메인', () => guarded(() => this.scene.start('main-menu')), 0x667185);
  }

  private async recordAuthenticatedResult(
    battleId: string,
    commands: readonly AccountTrustedBattleCommand[],
  ): Promise<RecordedRecordResult> {
    const completed = await completeAuthenticatedTrustedBattle(battleId, commands);
    assertTrustedCompletion(this.modeId, completed.result);
    const claim = await claimAuthenticatedTrustedBattle(battleId);
    assertTrustedCompletion(this.modeId, claim.completion);
    if (!claim.awarded || !isRecord(claim.result)) throw new Error('서버 기록전 claim 결과가 올바르지 않습니다.');
    const expectedMode = this.modeId === 'record_endless_front' ? 'ENDLESS_FRONT' : 'BOSS_RUSH';
    if (claim.result.mode !== expectedMode || typeof claim.result.improved !== 'boolean') throw new Error('서버 기록전 보상 결과가 현재 모드와 다릅니다.');

    if (completed.result.recordMode === 'ENDLESS_FRONT') {
      this.survivalMs = Math.floor(completed.result.clearFrames * 1000 / 30);
    } else {
      this.defeatedBosses = Math.min(BOSS_RUSH_SEQUENCE.length, completed.result.defeatedBosses ?? 0);
      this.completed = Boolean(completed.result.recordCompleted);
    }
    const progress = accountSnapshotToGuestProgress(claim.snapshot);
    if (!progress.recordModeProgress) throw new Error('서버 계정 기록 상태가 누락되었습니다.');
    return {
      improved: claim.result.improved,
      resourceReward: parseResourceReward(claim.result.resourceReward),
      recordModeProgress: progress.recordModeProgress,
      persisted: true,
      serverVerified: true,
    };
  }

  private applyRecordedResult(
    result: RecordedRecordResult,
    scoreText: Phaser.GameObjects.Text,
    bestText: Phaser.GameObjects.Text,
    rewardText: Phaser.GameObjects.Text,
    status: Phaser.GameObjects.Text,
  ): void {
    this.resultRecorded = true;
    if (!this.scene.isActive()) return;
    const record = result.recordModeProgress;
    if (this.modeId === 'record_endless_front') {
      scoreText.setText(`생존 ${formatDuration(this.survivalMs)} · ${Math.floor(this.survivalMs / 60000)}분 경계`);
      bestText.setText(`${result.improved ? '신기록' : '기존 최고 유지'} · 최고 ${formatDuration(record.endlessBestTimeMs)} · ${record.endlessBestReachedMinute}분`);
    } else {
      scoreText.setText(`${this.defeatedBosses} / ${BOSS_RUSH_SEQUENCE.length} 보스 격파`);
      bestText.setText(`${result.improved ? '신기록' : '기존 최고 유지'} · 최고 ${record.bossRushBestDefeated} / ${BOSS_RUSH_SEQUENCE.length} 격파`);
    }
    rewardText.setText(formatResourceReward(result.resourceReward));
    if (result.serverVerified) {
      status.setText('서버 재생 검증 · 계정 기록/도감/새 구간 보상 저장 완료').setColor('#8ee3aa');
    } else if (result.persisted) {
      status.setText('기록·새 구간 보상 저장 완료').setColor('#8ee3aa');
    } else {
      status.setText('브라우저 영구 저장 실패 · 현재 탭에서는 기록 유지').setColor('#ffb37c');
    }
  }
}
