import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { BATTLEFIELD_THEME_LABELS } from './battlefield';
import {
  STAGES,
  getSlotById,
  getSpecialStageNumber,
  getStage,
  getStageNumber,
  type PrototypeStage,
} from './prototype';
import { getPermanentRewardEffectText } from './permanent-reward-ui';
import { recordNormalStageClear, recordSpecialStageClear } from './save';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { getStageCollectionForStage } from './stage-navigation';
import { isCompactMobileViewport } from './viewport';

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

export class ResultScene extends Phaser.Scene {
  private stage!: PrototypeStage;
  private winner: string | null = null;
  private resultRecorded = false;

  constructor() { super('result'); }

  init(data: { stageId?: string; winner?: string | null }): void {
    this.stage = getStage(data.stageId ?? STAGES[0]!.id);
    this.winner = data.winner ?? null;
    this.resultRecorded = false;
  }

  create(): void {
    drawBackdrop(this, 'menu');
    const victory = this.winner === 'PLAYER';
    const compact = isCompactMobileViewport();
    const special = this.stage.stageType === 'SPECIAL';
    const collection = getStageCollectionForStage(this.stage.id);
    const stageLabel = special ? `SPECIAL ${getSpecialStageNumber(this.stage.id)}` : `STAGE ${getStageNumber(this.stage.id)}`;
    this.resultRecorded = !victory;
    addText(this, INTERNAL_WIDTH / 2, compact ? 70 : 86, victory ? '승 리' : '패 배', compact ? 56 : 62, victory ? COLORS.gold : COLORS.red, 'center').setOrigin(0.5);
    addText(this, INTERNAL_WIDTH / 2, compact ? 132 : 148, `${stageLabel} · ${this.stage.name}`, compact ? 28 : 25, '#e9edf4', 'center').setOrigin(0.5);

    this.add.rectangle(INTERNAL_WIDTH / 2, compact ? 345 : 355, compact ? 820 : 760, compact ? 360 : 320, 0x242b38, 0.98).setStrokeStyle(3, victory ? 0xb99449 : 0x805151);
    if (victory && special) {
      addText(this, INTERNAL_WIDTH / 2, compact ? 210 : 238, 'SPECIAL 클리어', compact ? 28 : 23, '#d8b4ef', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 264 : 290, this.stage.name, compact ? 38 : 35, '#f1ceff', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 322 : 342, this.stage.subtitle, compact ? 24 : 18, '#c8d0dc', 'center').setOrigin(0.5).setWordWrapWidth(compact ? 720 : 680);
      const rewardText = addText(this, INTERNAL_WIDTH / 2, compact ? 390 : 395, '보상 계산 중…', compact ? 22 : 18, '#f2d37c', 'center').setOrigin(0.5).setWordWrapWidth(compact ? 720 : 680);
      const status = addText(this, INTERNAL_WIDTH / 2, compact ? 446 : 447, compact ? 'SPECIAL 결과 저장 중…' : 'SPECIAL 클리어·재화 결과 저장 중…', compact ? 21 : 16, '#8f9aac', 'center').setOrigin(0.5);
      void recordSpecialStageClear(this.stage.id).then((result) => {
        this.resultRecorded = true;
        if (!this.scene.isActive()) return;
        rewardText.setText(`${result.firstClear ? '첫 클리어 · ' : '재클리어 · '}${formatResourceReward(result.resourceReward)}`);
        if (result.persisted) {
          status.setText(result.firstClear ? 'SPECIAL 첫 클리어 저장 완료' : 'SPECIAL 재클리어 보상 저장 완료');
          status.setColor('#8ee3aa');
        } else {
          status.setText(compact ? '영구 저장 실패 · 현재 탭 기록 유지' : '브라우저 영구 저장 실패 · 현재 탭에서는 결과 유지');
          status.setColor('#ffb37c');
        }
      }).catch((error: unknown) => {
        this.resultRecorded = true;
        if (!this.scene.isActive()) return;
        rewardText.setText('보상 저장 실패');
        status.setText(error instanceof Error ? error.message : 'SPECIAL 결과 처리에 실패했습니다.');
        status.setColor('#ff9a91');
      });
    } else if (victory) {
      addText(this, INTERNAL_WIDTH / 2, compact ? 202 : 224, 'NORMAL_CLEAR 보상', compact ? 28 : 23, '#8ee3aa', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 250 : 270, getPermanentRewardEffectText(this.stage.permanentRewardId), compact ? 23 : 18, '#ffe18a', 'center').setOrigin(0.5).setWordWrapWidth(compact ? 720 : 680);
      const unlockSlot = this.stage.unlockUnitId ? getSlotById(this.stage.unlockUnitId) : undefined;
      const unlockText = addText(this, INTERNAL_WIDTH / 2, compact ? 326 : 330, unlockSlot ? `동료 · ${unlockSlot.displayName}` : '동료 해금 없음', compact ? 22 : 18, unlockSlot ? '#9ccfff' : '#8f9aac', 'center').setOrigin(0.5);
      const rewardText = addText(this, INTERNAL_WIDTH / 2, compact ? 386 : 390, '일반 재화 계산 중…', compact ? 21 : 17, '#f2d37c', 'center').setOrigin(0.5).setWordWrapWidth(compact ? 720 : 680);
      const status = addText(this, INTERNAL_WIDTH / 2, compact ? 450 : 448, compact ? '진행 저장 중…' : 'NORMAL_CLEAR 진행·재화 저장 중…', compact ? 20 : 16, '#8f9aac', 'center').setOrigin(0.5);
      void recordNormalStageClear(this.stage.id, 'SOLO_BATTLE').then((result) => {
        this.resultRecorded = true;
        if (!this.scene.isActive()) return;
        rewardText.setText(`${result.firstClear ? '첫 클리어 · ' : '재클리어 · '}${formatResourceReward(result.resourceReward)}`);
        if (result.persisted) {
          status.setText(compact
            ? result.firstClear ? 'NORMAL_CLEAR · 다음 스테이지 개방' : '재클리어 보상 저장 완료'
            : result.firstClear ? 'NORMAL_CLEAR 저장 완료 · 다음 스테이지 개방' : '재클리어 보상 저장 완료 · 영구 보상 반복 획득 없음');
          status.setColor('#8ee3aa');
        } else {
          status.setText(compact ? '영구 저장 실패 · 현재 탭 진행 유지' : '브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지');
          status.setColor('#ffb37c');
        }
        if (unlockSlot) unlockText.setText(result.firstClear ? `신규 동료 · ${unlockSlot.displayName}` : `보유 동료 · ${unlockSlot.displayName}`);
      }).catch((error: unknown) => {
        this.resultRecorded = true;
        if (!this.scene.isActive()) return;
        rewardText.setText('보상 저장 실패');
        status.setText(error instanceof Error ? error.message : 'NORMAL_CLEAR 결과 처리에 실패했습니다.');
        status.setColor('#ff9a91');
      });
    } else {
      addText(this, INTERNAL_WIDTH / 2, compact ? 286 : 310, compact ? '소환 타이밍과 편성을 바꿔 다시 도전해 보자.' : '편성과 소환 타이밍을 바꿔 다시 도전해 보자.', compact ? 28 : 24, '#dce2ec', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 356 : 370, compact ? '패배해도 에너지나 보상을 잃지 않는다.' : '패배 시 보상 손실이나 에너지 소모는 없다.', compact ? 24 : 18, '#aeb8c7', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 420 : 425, compact ? `전장 ${BATTLEFIELD_THEME_LABELS[this.stage.theme]} · ${this.stage.mapLength}m` : `현재 전장 · ${BATTLEFIELD_THEME_LABELS[this.stage.theme]} / ${this.stage.mapLength}m`, compact ? 21 : 17, '#8796aa', 'center').setOrigin(0.5);
    }

    const guarded = (action: () => void): void => { if (!this.resultRecorded) return; action(); };
    const resultButtonHeight = compact ? 84 : 68;
    addButton(this, 380, compact ? 600 : 590, 260, resultButtonHeight, '다시 도전', () => guarded(() => this.scene.start('battle', { stageId: this.stage.id })), 0x6d88a7);
    addButton(this, 640, compact ? 600 : 590, 220, resultButtonHeight, '스테이지', () => guarded(() => this.scene.start('stage-select', { collectionId: collection.id })), special ? 0x80659b : 0x667185);
    addButton(this, 900, compact ? 600 : 590, 220, resultButtonHeight, '메인', () => guarded(() => this.scene.start('main-menu')), 0x667185);
  }
}
