import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { qualifiesStoryTenLateQuirk } from '@frontline/sim/achievement-quirks';
import { getProfileCosmetic, getSpecialStageProfileRewardIds } from '@frontline/sim/achievement-profile';
import { loadGuestAchievementProfile, recordGuestAchievementFact } from './achievement-profile';
import { BATTLEFIELD_THEME_LABELS } from './battlefield';
import { getClientSettings } from './client-settings';
import { getPermanentRewardEffectText } from './permanent-reward-ui';
import {
  STAGES,
  getSlotById,
  getSpecialStageNumber,
  getStage,
  getStageNumber,
  type PrototypeStage,
} from './prototype';
import { getEffectiveDeckSlotIds, recordNormalStageClear, recordSpecialStageClear } from './save';
import {
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
  setButtonState,
} from './scene-ui';
import { getStageCollectionForStage } from './stage-navigation';
import { getPostStageStory } from './story-content';
import { shouldPresentStory } from './story-progress';
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

function formatSpecialProfileReward(stageId: string): string | undefined {
  const names = getSpecialStageProfileRewardIds(stageId).map((id) => getProfileCosmetic(id).name);
  return names.length > 0 ? `프로필 장식 해금 · ${names.join(' · ')}` : undefined;
}

export class ResultScene extends Phaser.Scene {
  private stage!: PrototypeStage;
  private winner: string | null = null;
  private resultRecorded = false;
  private postStoryId: string | undefined;
  private actionButtons: Phaser.GameObjects.Container[] = [];
  private settlementPill?: Phaser.GameObjects.Container;

  constructor() { super('result'); }

  init(data: { stageId?: string; winner?: string | null }): void {
    this.stage = getStage(data.stageId ?? STAGES[0]!.id);
    this.winner = data.winner ?? null;
    this.resultRecorded = false;
    this.postStoryId = undefined;
    this.actionButtons = [];
    this.settlementPill = undefined;
  }

  create(): void {
    drawBackdrop(this, 'menu');
    const victory = this.winner === 'PLAYER';
    const compact = isCompactMobileViewport();
    const special = this.stage.stageType === 'SPECIAL';
    const collection = getStageCollectionForStage(this.stage.id);
    const stageNumber = special ? getSpecialStageNumber(this.stage.id) : getStageNumber(this.stage.id);
    const stageLabel = special ? `특수 작전 ${stageNumber}` : `전장 ${stageNumber}`;
    this.resultRecorded = !victory;

    addText(this, 76, 48, victory ? '작전 성공' : '작전 실패', compact ? 50 : 55, victory ? COLORS.gold : COLORS.red);
    addText(this, 80, 112, `${stageLabel} · ${this.stage.name}`, compact ? 26 : 23, '#e6edf4');
    addText(this, 80, 150, this.stage.subtitle, compact ? 18 : 15, COLORS.muted).setWordWrapWidth(730);
    this.settlementPill = addStatusPill(this, 980, 74, victory ? '결과 정산 중' : '정산 없음', victory ? 'warning' : 'neutral');

    addSectionHeading(this, 76, 202, victory ? '전과 보고' : '재정비 보고', 1128, victory ? 0xb79852 : 0x8a5f62);
    addCommandPanel(this, 640, 390, 1120, 330, victory ? 0xb79852 : 0x8a5f62, victory ? 0x211f1b : 0x241d20, 0.95);

    if (victory && special) this.renderSpecialVictory();
    else if (victory) this.renderMainVictory();
    else this.renderDefeat();

    const buttonY = compact ? 630 : 620;
    const h = compact ? 86 : 64;
    const retry = addButton(this, 350, buttonY, 250, h, '다시 도전', () => {
      if (this.resultRecorded) this.leaveResult('battle', { stageId: this.stage.id });
    }, 0x668aa8, { tone: 'primary' });
    const stageButton = addButton(this, 640, buttonY, 240, h, '스테이지 선택', () => {
      if (this.resultRecorded) this.leaveResult('stage-select', { collectionId: collection.id });
    }, special ? 0x846598 : 0x66788d, { tone: 'secondary' });
    const home = addButton(this, 920, buttonY, 220, h, '지휘소', () => {
      if (this.resultRecorded) this.leaveResult('main-menu');
    }, 0x5c6878, { tone: 'quiet' });
    this.actionButtons = [retry, stageButton, home];
    this.updateActionStates();
  }

  private renderSpecialVictory(): void {
    const compact = isCompactMobileViewport();
    addText(this, 116, 270, '특수 작전 클리어', compact ? 27 : 24, '#dfbcef');
    addText(this, 116, 315, this.stage.name, compact ? 35 : 32, '#f4ddff');
    addText(this, 116, 365, '반복 보상', compact ? 18 : 15, '#b9c3cf');
    const rewardText = addText(this, 116, 400, '보상을 계산하고 있습니다…', compact ? 22 : 18, COLORS.gold).setWordWrapWidth(930);
    const status = addText(this, 116, 470, '클리어 기록과 보상을 저장하는 중…', compact ? 19 : 16, COLORS.muted).setWordWrapWidth(930);

    void recordSpecialStageClear(this.stage.id).then((result) => {
      this.resultRecorded = true;
      if (result.firstClear) loadGuestAchievementProfile(result.progress);
      if (!this.scene.isActive()) return;
      const profileReward = result.firstClear ? formatSpecialProfileReward(this.stage.id) : undefined;
      rewardText.setText(`${result.firstClear ? '첫 클리어 · ' : '재클리어 · '}${formatResourceReward(result.resourceReward)}${profileReward ? `\n${profileReward}` : ''}`);
      if (result.persisted) {
        status.setText(result.firstClear ? '첫 클리어와 보상을 저장했습니다.' : '재클리어 보상을 저장했습니다.').setColor(COLORS.green);
        this.replaceSettlementPill(result.firstClear ? '첫 클리어 저장됨' : '보상 저장됨', 'online');
      } else {
        status.setText('영구 저장에 실패했습니다. 현재 실행에서는 결과를 유지합니다.').setColor(COLORS.warning);
        this.replaceSettlementPill('저장 확인 필요', 'warning');
      }
      this.updateActionStates();
    }).catch((error: unknown) => {
      this.resultRecorded = true;
      if (!this.scene.isActive()) return;
      rewardText.setText('보상 저장에 실패했습니다.').setColor(COLORS.red);
      status.setText(error instanceof Error ? error.message : '특수 작전 결과 처리에 실패했습니다.').setColor(COLORS.red);
      this.replaceSettlementPill('정산 오류', 'danger');
      this.updateActionStates();
    });
  }

  private renderMainVictory(): void {
    const compact = isCompactMobileViewport();
    const rewardTitle = addText(this, 116, 270, '첫 직접 클리어 보상', compact ? 27 : 24, COLORS.green);
    addText(this, 116, 315, getPermanentRewardEffectText(this.stage.permanentRewardId), compact ? 23 : 19, '#ffe39a').setWordWrapWidth(930);
    const unlockSlot = this.stage.unlockUnitId ? getSlotById(this.stage.unlockUnitId) : undefined;
    const unlockText = addText(this, 116, 365, unlockSlot ? `동료 후보 · ${unlockSlot.displayName}` : '추가 동료 해금 없음', compact ? 20 : 17, unlockSlot ? '#a9d4f4' : '#8995a2');
    const rewardText = addText(this, 116, 405, '일반 보상을 계산하고 있습니다…', compact ? 20 : 17, COLORS.gold).setWordWrapWidth(930);
    const status = addText(this, 116, 470, '진행과 보상을 저장하는 중…', compact ? 19 : 16, COLORS.muted).setWordWrapWidth(930);

    void recordNormalStageClear(this.stage.id, 'SOLO_BATTLE').then((result) => {
      this.resultRecorded = true;
      const deckSlotIds = getEffectiveDeckSlotIds(result.progress);
      const storyTenQuirk = qualifiesStoryTenLateQuirk(this.stage.id, deckSlotIds);
      let storyTenNew = false;
      if (storyTenQuirk) {
        const beforeProfile = loadGuestAchievementProfile(result.progress);
        storyTenNew = !beforeProfile.factIds.includes('quirk_story_ten_late');
        recordGuestAchievementFact(result.progress, 'quirk_story_ten_late');
      }
      const postStory = result.firstClear && result.persisted ? getPostStageStory(this.stage.id) : undefined;
      if (postStory && shouldPresentStory(postStory, getClientSettings().autoSkipStory)) this.postStoryId = postStory.id;
      if (!this.scene.isActive()) return;

      rewardTitle.setText(result.firstClear ? '영구 보상 획득' : '재클리어 보상');
      const quirkText = storyTenQuirk ? `\n${storyTenNew ? '숨겨진 업적 달성' : '숨겨진 업적 조건 재달성'} · 열 명의 이야기` : '';
      rewardText.setText(`${result.firstClear ? '첫 클리어 · ' : '재클리어 · '}${formatResourceReward(result.resourceReward)}${quirkText}`);
      if (result.persisted) {
        status.setText(result.firstClear
          ? `진행 저장 완료 · 다음 전장 개방${this.postStoryId ? ' · 장 완료 이야기 예정' : ''}`
          : '재클리어 보상 저장 완료 · 영구 보상은 반복 지급되지 않습니다.').setColor(COLORS.green);
        this.replaceSettlementPill(result.firstClear ? '새 전선 개방' : '보상 저장됨', 'online');
      } else {
        status.setText('영구 저장에 실패했습니다. 현재 실행에서는 진행을 유지합니다.').setColor(COLORS.warning);
        this.replaceSettlementPill('저장 확인 필요', 'warning');
      }
      if (unlockSlot) unlockText.setText(result.firstClear ? `신규 동료 · ${unlockSlot.displayName}` : `보유 동료 · ${unlockSlot.displayName}`);
      this.updateActionStates();
    }).catch((error: unknown) => {
      this.resultRecorded = true;
      if (!this.scene.isActive()) return;
      rewardText.setText('보상 저장에 실패했습니다.').setColor(COLORS.red);
      status.setText(error instanceof Error ? error.message : '결과 처리에 실패했습니다.').setColor(COLORS.red);
      this.replaceSettlementPill('정산 오류', 'danger');
      this.updateActionStates();
    });
  }

  private renderDefeat(): void {
    const compact = isCompactMobileViewport();
    addText(this, 116, 285, '전선 재정비', compact ? 32 : 29, '#f1d3d0');
    addText(this, 116, 342, '편성과 소환 타이밍을 바꿔 다시 도전해 보세요.', compact ? 26 : 22, '#dce4ec');
    addText(this, 116, 395, '패배해도 에너지나 보상을 잃지 않습니다.', compact ? 21 : 18, '#abb6c3');
    addText(this, 116, 445, `현재 전장 · ${BATTLEFIELD_THEME_LABELS[this.stage.theme]} · ${this.stage.mapLength}m`, compact ? 19 : 16, '#8e9cac');
    addText(this, 116, 490, '추천: 전선이 밀리기 전에 보급소 투자와 저비용 유닛 생산 간격을 다시 확인하세요.', compact ? 17 : 14, '#9ca8b6').setWordWrapWidth(930);
    this.replaceSettlementPill('즉시 재도전 가능', 'neutral');
  }

  private replaceSettlementPill(label: string, kind: 'neutral' | 'online' | 'warning' | 'danger'): void {
    this.settlementPill?.destroy(true);
    this.settlementPill = addStatusPill(this, 980, 74, label, kind);
  }

  private updateActionStates(): void {
    for (const button of this.actionButtons) {
      if (this.resultRecorded) setButtonState(button, 'default');
      else setButtonState(button, 'loading', '결과 저장이 끝난 뒤 이동할 수 있습니다.');
    }
  }

  private leaveResult(nextScene: string, nextData?: object): void {
    if (this.postStoryId) {
      const storyId = this.postStoryId;
      this.postStoryId = undefined;
      this.scene.start('story', { storyId, nextScene, nextData });
      return;
    }
    this.scene.start(nextScene, nextData);
  }
}

export const __resultSceneTestOnly = { formatResourceReward, formatSpecialProfileReward };
