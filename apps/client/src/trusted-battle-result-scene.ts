import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { qualifiesStoryTenLateQuirk } from '@frontline/sim/achievement-quirks';
import { getProfileCosmetic, getSpecialStageProfileRewardIds } from '@frontline/sim/achievement-profile';
import {
  AccountRevisionConflictError,
  claimAuthenticatedTrustedBattle,
  completeAuthenticatedTrustedBattle,
} from './account-network.ts';
import { BATTLEFIELD_THEME_LABELS } from './battlefield';
import { getPermanentRewardEffectText } from './permanent-reward-ui';
import {
  STAGES,
  getSlotById,
  getSpecialStageNumber,
  getStage,
  getStageNumber,
  type PrototypeStage,
} from './prototype';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { getStageCollectionForStage } from './stage-navigation';
import { assertTrustedCompletionMatchesLocal, type TrustedBattleTerminalProof } from './trusted-battle-result.ts';
import { isCompactMobileViewport } from './viewport';

type TrustedRewardSummary = {
  readonly firstClear: boolean;
  readonly resourceReward: Readonly<Record<string, number | undefined>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function parseTrustedRewardSummary(value: unknown): TrustedRewardSummary | null {
  if (!isRecord(value) || typeof value.firstClear !== 'boolean' || !isRecord(value.resourceReward)) return null;
  const resourceReward: Record<string, number> = {};
  for (const [id, amount] of Object.entries(value.resourceReward)) {
    if (!Number.isInteger(amount) || (amount as number) < 0) return null;
    resourceReward[id] = amount as number;
  }
  return { firstClear: value.firstClear, resourceReward };
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
  return parts.length > 0 ? parts.join(' · ') : '추가 재화 보상 없음';
}

function formatSpecialProfileReward(stageId: string): string | undefined {
  const names = getSpecialStageProfileRewardIds(stageId).map((id) => getProfileCosmetic(id).name);
  return names.length > 0 ? `프로필 장식 해금 · ${names.join(' · ')}` : undefined;
}

export class TrustedBattleResultScene extends Phaser.Scene {
  private stage: PrototypeStage = STAGES[0]!;
  private proof!: TrustedBattleTerminalProof;
  private finalized = false;
  private finalizing = false;
  private statusText: Phaser.GameObjects.Text | undefined;
  private rewardText: Phaser.GameObjects.Text | undefined;
  private resultTitleText: Phaser.GameObjects.Text | undefined;
  private retryButton: Phaser.GameObjects.Container | undefined;

  constructor() { super('trusted-result'); }

  init(data: { readonly proof?: TrustedBattleTerminalProof } = {}): void {
    if (!data.proof) throw new Error('trusted result requires terminal proof');
    this.proof = data.proof;
    this.stage = getStage(this.proof.targetId);
    this.finalized = false;
    this.finalizing = false;
    this.statusText = undefined;
    this.rewardText = undefined;
    this.resultTitleText = undefined;
    this.retryButton = undefined;
  }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    const localVictory = this.proof.localWinner === 'PLAYER';
    const special = this.stage.stageType === 'SPECIAL';
    const collection = getStageCollectionForStage(this.stage.id);
    const stageLabel = special ? `SPECIAL ${getSpecialStageNumber(this.stage.id)}` : `STAGE ${getStageNumber(this.stage.id)}`;

    this.resultTitleText = addText(
      this,
      INTERNAL_WIDTH / 2,
      compact ? 70 : 86,
      localVictory ? '승 리 · 검 증 중' : this.proof.localWinner === 'DRAW' ? '무 승 부 · 검 증 중' : '패 배 · 검 증 중',
      compact ? 50 : 56,
      localVictory ? COLORS.gold : COLORS.red,
      'center',
    ).setOrigin(0.5);
    addText(this, INTERNAL_WIDTH / 2, compact ? 132 : 148, `${stageLabel} · ${this.stage.name}`, compact ? 28 : 25, '#e9edf4', 'center').setOrigin(0.5);

    this.add.rectangle(INTERNAL_WIDTH / 2, compact ? 345 : 355, compact ? 820 : 760, compact ? 360 : 320, 0x242b38, 0.98)
      .setStrokeStyle(3, localVictory ? 0xb99449 : 0x805151);
    addText(this, INTERNAL_WIDTH / 2, compact ? 214 : 236, 'SERVER TRUSTED COMPLETION', compact ? 24 : 20, '#9ccfff', 'center').setOrigin(0.5);
    addText(
      this,
      INTERNAL_WIDTH / 2,
      compact ? 260 : 284,
      `전투 ${this.proof.battleId.slice(0, 8)}… · ${this.proof.localClearFrames.toLocaleString()}F`,
      compact ? 21 : 17,
      '#b8c4d6',
      'center',
    ).setOrigin(0.5);
    this.rewardText = addText(this, INTERNAL_WIDTH / 2, compact ? 348 : 356, '서버가 command log를 재실행하는 중…', compact ? 22 : 18, '#f2d37c', 'center')
      .setOrigin(0.5).setWordWrapWidth(compact ? 720 : 680);
    this.statusText = addText(this, INTERNAL_WIDTH / 2, compact ? 432 : 430, 'winner · frames · final hash · 거점 HP 대조 중…', compact ? 20 : 16, '#8f9aac', 'center')
      .setOrigin(0.5).setWordWrapWidth(compact ? 760 : 700);

    if (!special && this.stage.permanentRewardId) {
      addText(this, INTERNAL_WIDTH / 2, compact ? 300 : 316, getPermanentRewardEffectText(this.stage.permanentRewardId), compact ? 18 : 15, '#ffe18a', 'center')
        .setOrigin(0.5).setWordWrapWidth(compact ? 720 : 680);
    }

    this.retryButton = addButton(
      this,
      INTERNAL_WIDTH / 2,
      compact ? 510 : 505,
      290,
      compact ? 78 : 54,
      '결과 검증 재시도',
      () => void this.finalizeTrustedResult(),
      0x6b7f9c,
    ).setVisible(false);

    const guarded = (action: () => void): void => { if (!this.finalized) return; action(); };
    const resultButtonHeight = compact ? 84 : 68;
    addButton(this, 380, compact ? 600 : 590, 260, resultButtonHeight, '다시 도전', () => guarded(() => this.scene.start('battle', { stageId: this.stage.id })), 0x6d88a7);
    addButton(this, 640, compact ? 600 : 590, 220, resultButtonHeight, '스테이지', () => guarded(() => this.scene.start('stage-select', { collectionId: collection.id })), special ? 0x80659b : 0x667185);
    addButton(this, 900, compact ? 600 : 590, 220, resultButtonHeight, '메인', () => guarded(() => this.scene.start('main-menu')), 0x667185);

    void this.finalizeTrustedResult();
  }

  private async claimWithOneRevisionRetry(): Promise<Awaited<ReturnType<typeof claimAuthenticatedTrustedBattle>>> {
    try {
      return await claimAuthenticatedTrustedBattle(this.proof.battleId);
    } catch (error) {
      if (!(error instanceof AccountRevisionConflictError)) throw error;
      return claimAuthenticatedTrustedBattle(this.proof.battleId);
    }
  }

  private async finalizeTrustedResult(): Promise<void> {
    if (this.finalized || this.finalizing) return;
    this.finalizing = true;
    this.retryButton?.setVisible(false);
    this.statusText?.setText('서버 전투 재실행·terminal fingerprint 검증 중…').setColor('#8f9aac');
    try {
      const completed = await completeAuthenticatedTrustedBattle(this.proof.battleId, this.proof.commands);
      assertTrustedCompletionMatchesLocal(this.proof, completed.result);
      if (!this.scene.isActive()) return;
      this.statusText?.setText('전투 검증 완료 · 계정 보상 claim 중…').setColor('#9ccfff');

      const claim = await this.claimWithOneRevisionRetry();
      assertTrustedCompletionMatchesLocal(this.proof, claim.completion);
      if (!this.scene.isActive()) return;
      const reward = claim.awarded ? parseTrustedRewardSummary(claim.result) : null;
      if (claim.awarded && !reward) throw new Error('trusted battle claim reward shape is invalid');

      const victory = claim.completion.winner === 'PLAYER';
      const special = this.stage.stageType === 'SPECIAL';
      const storyTenQuirk = victory && !special && qualifiesStoryTenLateQuirk(this.stage.id, stringArray(claim.snapshot.deckSlotIds));
      this.resultTitleText?.setText(victory ? '승 리' : claim.completion.winner === 'DRAW' ? '무 승 부' : '패 배')
        .setColor(victory ? COLORS.gold : COLORS.red);
      if (!claim.awarded) {
        this.rewardText?.setText(victory ? '서버 보상 없음' : '패배/무승부 · 보상 없음');
      } else if (reward) {
        const profileReward = special && reward.firstClear ? formatSpecialProfileReward(this.stage.id) : undefined;
        const storyTenText = storyTenQuirk ? '\n숨겨진 업적 · 열 명의 이야기' : '';
        this.rewardText?.setText(`${reward.firstClear ? '첫 클리어 · ' : '재클리어 · '}${formatResourceReward(reward.resourceReward)}${profileReward ? `\n${profileReward}` : ''}${storyTenText}`);
        if (!special && reward.firstClear && this.stage.unlockUnitId) {
          const slot = getSlotById(this.stage.unlockUnitId);
          if (slot) this.rewardText?.setText(`${this.rewardText.text}\n신규 동료 · ${slot.displayName}`);
        }
      }
      this.statusText?.setText(`서버 정본 저장 완료 · revision ${claim.revision}${claim.replayed ? ' · idempotent replay' : ''}`).setColor('#8ee3aa');
      this.finalized = true;
    } catch (error) {
      if (!this.scene.isActive()) return;
      const message = error instanceof Error ? error.message : 'trusted battle 결과 검증에 실패했습니다.';
      this.statusText?.setText(`검증/저장 실패 · ${message}`).setColor('#ff9a91');
      this.rewardText?.setText('보상은 서버 검증이 완료될 때까지 지급되지 않는다.');
      this.retryButton?.setVisible(true);
    } finally {
      this.finalizing = false;
    }
  }
}

export const __trustedBattleResultSceneTestOnly = {
  parseTrustedRewardSummary,
  formatResourceReward,
  formatSpecialProfileReward,
};
