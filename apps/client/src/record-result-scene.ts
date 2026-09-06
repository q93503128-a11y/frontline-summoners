import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { getProfileCosmetic } from '@frontline/sim/achievement-profile';
import { RECORD_PROFILE_HONORS } from '@frontline/sim/record-rewards';
import {
  claimAuthenticatedTrustedBattle,
  completeAuthenticatedTrustedBattle,
  getAccountClientState,
  refreshAuthenticatedAccount,
  type AccountTrustedBattleCommand,
  type AccountTrustedBattleCompletion,
} from './account-network.ts';
import { accountSnapshotToGuestProgress } from './active-progress.ts';
import { BOSS_RUSH_SEQUENCE, getRecordModeDefinition, type RecordModeId } from './record-content.ts';
import { recordGuestBossRushResult, recordGuestEndlessResult, type GuestRecordResult, type RecordModeProgress } from './save.ts';
import {
  addButton,
  addCommandPanel,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
  setButtonState,
} from './scene-ui.ts';
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

function formatRecordProfileHonors(modeId: RecordModeId, progress: RecordModeProgress): string | null {
  const expectedMode = modeId === 'record_endless_front' ? 'ENDLESS_FRONT' : 'BOSS_RUSH';
  const reached = RECORD_PROFILE_HONORS.filter((honor) => {
    if (honor.mode !== expectedMode) return false;
    return honor.mode === 'ENDLESS_FRONT'
      ? progress.endlessBestReachedMinute >= honor.threshold
      : progress.bossRushBestDefeated >= honor.threshold;
  });
  if (reached.length === 0) return null;
  const names = [...new Set(reached.map((honor) => getProfileCosmetic(honor.cosmeticId).name))];
  return `${modeId === 'record_endless_front' ? '고기록 명예' : '완주 명예'} · ${names.join(' · ')}`;
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

function safeRecordFailure(trusted: boolean): string {
  return trusted
    ? '계정 기록 확인에 실패했습니다. 연결 상태를 확인한 뒤 결과 재전송을 시도하세요.'
    : '기록 저장에 실패했습니다. 현재 탭에서는 이번 결과를 유지합니다.';
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
    const title = !endless && this.completed ? '전 구간 격파' : '기록 종료';
    const initialScore = endless
      ? `생존 ${formatDuration(this.survivalMs)} · ${Math.floor(this.survivalMs / 60000)}분 경계`
      : `${this.defeatedBosses} / ${BOSS_RUSH_SEQUENCE.length} 보스 격파`;
    const accent = endless ? 0x5f8ea4 : 0x9a687d;

    addText(this, INTERNAL_WIDTH / 2, compact ? 56 : 62, title, compact ? 46 : 50, this.completed ? COLORS.gold : COLORS.cream, 'center').setOrigin(0.5);
    addText(this, INTERNAL_WIDTH / 2, compact ? 106 : 110, mode.displayName, compact ? 23 : 20, '#dce4ef', 'center').setOrigin(0.5);
    addStatusPill(this, INTERNAL_WIDTH / 2, compact ? 145 : 142, this.trustedBattleId ? '계정 기록 정산' : '로컬 기록 정산', this.trustedBattleId ? 'online' : 'neutral').setDepth(3);

    addCommandPanel(this, INTERNAL_WIDTH / 2, 360, 1120, compact ? 370 : 350, accent, 0x182129, 0.95);
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x667383, 0.42).lineBetween(640, 210, 640, 508);

    addText(this, 110, 205, '이번 기록', compact ? 18 : 15, '#94a7ba');
    const scoreText = addText(this, 110, compact ? 250 : 258, initialScore, compact ? 34 : 31, '#f1d58a');
    const outcomeDetail = endless
      ? '거점이 버틴 시간과 도달한 분 경계를 기록합니다.'
      : this.completed
        ? '현재 보스 러시 전 구간을 완주했습니다.'
        : '이번 도전에서 격파한 구간까지 기록합니다.';
    addText(this, 110, compact ? 316 : 322, outcomeDetail, compact ? 18 : 15, '#bac7d5').setWordWrapWidth(455);
    addText(this, 110, compact ? 405 : 410, endless ? '다음 목표  한 분 더 버티기' : '다음 목표  한 보스 더 돌파', compact ? 18 : 15, '#9fc5b0');

    addText(this, 700, 205, '정산', compact ? 18 : 15, '#b8a77d');
    const bestText = addText(this, 700, compact ? 250 : 258, '최고기록 계산 중…', compact ? 22 : 19, '#a9caee').setWordWrapWidth(450);
    const rewardText = addText(this, 700, compact ? 330 : 332, '새 구간 보상 계산 중…', compact ? 19 : 16, '#f2d37c').setWordWrapWidth(450);
    const status = addText(
      this,
      700,
      compact ? 438 : 435,
      this.trustedBattleId ? '계정 기록을 확인하고 저장하는 중…' : '기록과 구간 보상을 저장하는 중…',
      compact ? 17 : 14,
      '#8f9aac',
    ).setWordWrapWidth(450);

    const buttonHeight = compact ? 82 : 62;
    const guarded = (action: () => void): void => { if (this.resultRecorded) action(); };
    const retryAction = addButton(this, 340, compact ? 624 : 610, 270, buttonHeight, '다시 도전', () => guarded(() => this.scene.start('record-battle', { modeId: this.modeId })), 0x6d88a7, { tone: 'primary' });
    const hubAction = addButton(this, 640, compact ? 624 : 610, 250, buttonHeight, '기록전으로', () => guarded(() => this.scene.start('record-hub')), 0x80659b, { tone: 'secondary' });
    const homeAction = addButton(this, 930, compact ? 624 : 610, 220, buttonHeight, '지휘소', () => guarded(() => this.scene.start('main-menu')), 0x667185, { tone: 'quiet' });
    const actions = [retryAction, hubAction, homeAction] as const;

    const setActionsLoading = (): void => {
      for (const action of actions) setButtonState(action, 'loading', '기록 정산이 완료되면 이동할 수 있습니다.');
    };
    const setActionsDisabled = (): void => {
      for (const action of actions) setButtonState(action, 'disabled', '계정 기록 확인이 완료된 뒤 이동할 수 있습니다.');
    };
    const unlockActions = (): void => {
      setButtonState(retryAction, 'default');
      setButtonState(hubAction, 'default');
      setButtonState(homeAction, 'default');
    };

    let resendButton: Phaser.GameObjects.Container | null = null;
    const submit = (): void => {
      this.resultRecorded = false;
      setActionsLoading();
      status.setText(this.trustedBattleId ? '계정 기록을 확인하고 저장하는 중…' : '기록과 구간 보상을 저장하는 중…').setColor('#8f9aac');
      resendButton?.setVisible(false);
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
      void recording.then((result) => {
        this.applyRecordedResult(result, scoreText, bestText, rewardText, status);
        unlockActions();
      }).catch(() => {
        if (!this.scene.isActive()) return;
        if (this.trustedBattleId) {
          this.resultRecorded = false;
          bestText.setText('계정 기록 확인 미완료');
          rewardText.setText('확인이 끝나기 전에는 계정 보상이 지급되지 않습니다.');
          status.setText(safeRecordFailure(true)).setColor(COLORS.red);
          setActionsDisabled();
          resendButton?.setVisible(true);
          return;
        }
        this.resultRecorded = true;
        bestText.setText('이번 기록은 현재 탭에 유지됩니다.');
        rewardText.setText('영구 저장에 실패해 새 구간 보상을 확정하지 못했습니다.');
        status.setText(safeRecordFailure(false)).setColor(COLORS.warning);
        unlockActions();
      });
    };

    if (this.trustedBattleId) {
      resendButton = addButton(this, 1030, compact ? 520 : 520, 220, compact ? 70 : 50, '결과 재전송', submit, 0x8d654f, { tone: 'secondary' });
      resendButton.setVisible(false);
    }
    submit();
  }

  private async recordAuthenticatedResult(
    battleId: string,
    commands: readonly AccountTrustedBattleCommand[],
  ): Promise<RecordedRecordResult> {
    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      await refreshAuthenticatedAccount();
      if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
        throw new Error('온라인 연결을 복구한 뒤 결과 재전송을 다시 시도하세요.');
      }
    }
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
    const resourceText = formatResourceReward(result.resourceReward);
    const honorText = formatRecordProfileHonors(this.modeId, record);
    rewardText.setText(honorText ? `${resourceText}\n${honorText}` : resourceText);
    if (result.serverVerified) {
      status.setText('계정 기록·도감·새 구간 보상 저장 완료').setColor(COLORS.green);
    } else if (result.persisted) {
      status.setText('기록·새 구간 보상 저장 완료').setColor(COLORS.green);
    } else {
      status.setText('브라우저 영구 저장 실패 · 현재 탭에서는 기록 유지').setColor(COLORS.warning);
    }
  }
}

export const __recordResultSceneTestOnly = {
  formatResourceReward,
  formatRecordProfileHonors,
};
