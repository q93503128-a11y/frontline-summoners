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
import { recordSpecialStageClear, recordStageClear } from './save';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { getStageCollectionForStage } from './stage-navigation';
import { isCompactMobileViewport } from './viewport';

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
      addText(this, INTERNAL_WIDTH / 2, compact ? 210 : 238, '특수전 훈장 획득', compact ? 28 : 23, '#d8b4ef', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 264 : 290, this.stage.treasure.name, compact ? 38 : 35, '#f1ceff', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 322 : 342, this.stage.subtitle, compact ? 24 : 18, '#c8d0dc', 'center').setOrigin(0.5).setWordWrapWidth(compact ? 720 : 680);
      addText(this, INTERNAL_WIDTH / 2, compact ? 390 : 395, '메인 진도와 별도 기록 · 반복 파밍 필요 없음', compact ? 24 : 20, '#b9a5c8', 'center').setOrigin(0.5);
      const status = addText(this, INTERNAL_WIDTH / 2, compact ? 446 : 447, compact ? '특수전 기록 저장 중…' : '특수전 클리어 기록 저장 중…', compact ? 21 : 16, '#8f9aac', 'center').setOrigin(0.5);
      void recordSpecialStageClear(this.stage.id).then((result) => {
        this.resultRecorded = true;
        if (!this.scene.isActive()) return;
        if (result.persisted) {
          status.setText(result.firstClear ? '특수전 첫 클리어 저장 완료' : '특수전 재클리어 기록 완료');
          status.setColor('#8ee3aa');
        } else {
          status.setText(compact ? '영구 저장 실패 · 현재 탭 기록 유지' : '브라우저 영구 저장 실패 · 현재 탭에서는 특수전 기록 유지');
          status.setColor('#ffb37c');
        }
      });
    } else if (victory) {
      addText(this, INTERNAL_WIDTH / 2, compact ? 210 : 238, '확정 보물 획득', compact ? 28 : 23, '#8ee3aa', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 264 : 290, this.stage.treasure.name, compact ? 38 : 35, '#ffe18a', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 322 : 342, this.stage.treasure.effect, compact ? 24 : 18, '#c8d0dc', 'center').setOrigin(0.5).setWordWrapWidth(compact ? 720 : 680);
      const unlockSlot = this.stage.unlockUnitId ? getSlotById(this.stage.unlockUnitId) : undefined;
      const unlockText = addText(this, INTERNAL_WIDTH / 2, compact ? 390 : 395, unlockSlot ? (compact ? `동료 · ${unlockSlot.displayName}` : `첫 클리어 동료 보상 · ${unlockSlot.displayName}`) : compact ? '동료 해금 없음' : '이번 스테이지는 동료 해금 없음', compact ? 24 : 20, unlockSlot ? '#9ccfff' : '#8f9aac', 'center').setOrigin(0.5);
      const status = addText(this, INTERNAL_WIDTH / 2, compact ? 446 : 447, compact ? '진행 저장 중…' : '진행 저장 중… 잠시만 기다려 주세요', compact ? 21 : 16, '#8f9aac', 'center').setOrigin(0.5);
      void recordStageClear(this.stage.id, this.stage.treasure.id).then((result) => {
        this.resultRecorded = true;
        if (!this.scene.isActive()) return;
        if (result.persisted) {
          status.setText(compact
            ? result.firstClear ? '저장 완료 · 다음 스테이지 개방' : '재클리어 저장 완료'
            : result.firstClear ? '첫 클리어 저장 완료 · 다음 스테이지 개방' : '재클리어 저장 완료 · 보물 반복 파밍 불필요');
          status.setColor('#8ee3aa');
        } else {
          status.setText(compact ? '영구 저장 실패 · 현재 탭 진행 유지' : '브라우저 영구 저장 실패 · 현재 탭에서는 진행 유지');
          status.setColor('#ffb37c');
        }
        if (unlockSlot) unlockText.setText(result.firstClear ? `신규 동료 · ${unlockSlot.displayName}` : `보유 동료 · ${unlockSlot.displayName}`);
      });
    } else {
      addText(this, INTERNAL_WIDTH / 2, compact ? 286 : 310, compact ? '소환 타이밍과 편성을 바꿔 다시 도전해 보자.' : '편성과 소환 타이밍을 바꿔 다시 도전해 보자.', compact ? 28 : 24, '#dce2ec', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 356 : 370, compact ? '패배해도 에너지나 보상을 잃지 않는다.' : '패배 시 보상 손실이나 에너지 소모는 없다.', compact ? 24 : 18, '#aeb8c7', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, compact ? 420 : 425, compact ? `전장 ${BATTLEFIELD_THEME_LABELS[this.stage.theme]} · ${this.stage.mapLength}m` : `현재 전장 · ${BATTLEFIELD_THEME_LABELS[this.stage.theme]} / ${this.stage.mapLength}m`, compact ? 21 : 17, '#8796aa', 'center').setOrigin(0.5);
    }

    const guarded = (action: () => void): void => {
      if (!this.resultRecorded) return;
      action();
    };
    const resultButtonHeight = compact ? 84 : 68;
    addButton(this, 380, compact ? 600 : 590, 260, resultButtonHeight, '다시 도전', () => guarded(() => this.scene.start('battle', { stageId: this.stage.id })), 0x6d88a7);
    addButton(this, 640, compact ? 600 : 590, 220, resultButtonHeight, '스테이지', () => guarded(() => this.scene.start('stage-select', { collectionId: collection.id })), special ? 0x80659b : 0x667185);
    addButton(this, 900, compact ? 600 : 590, 220, resultButtonHeight, '메인', () => guarded(() => this.scene.start('main-menu')), 0x667185);
  }
}
