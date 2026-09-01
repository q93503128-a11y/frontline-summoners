import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { PERIODIC_REWARD_COLLECTION_IDS } from '@frontline/sim/periodic-special';
import { loadActiveProgress } from './active-progress';
import type { GuestProgress } from './save';
import {
  STAGE_COLLECTIONS,
  getCollectionClearedIds,
  getStageCollectionAvailabilityText,
  getStageCollectionPage,
  getStageCollectionPageCount,
  isStageCollectionAvailable,
  isStageCollectionUnlocked,
} from './stage-navigation';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  discoveredEnemyIds: [],
};
const PERIODIC_COLLECTION_IDS = new Set<string>(PERIODIC_REWARD_COLLECTION_IDS);

export class StageHubScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private page = 0;
  private collectionLayer?: Phaser.GameObjects.Container;
  private pageText?: Phaser.GameObjects.Text;
  private authorityText?: Phaser.GameObjects.Text;

  constructor() { super('stage-hub'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 38, '출 정', 46, COLORS.cream);
    addText(this, 56, 94, compact ? '전선을 고르고 출격한다.' : '장과 특수전 중 전선을 고른 뒤, 협동 가능 스테이지에서 혼자·친구·공개 협동을 선택한다.', compact ? 22 : 19, COLORS.muted);
    this.authorityText = addText(this, 56, 122, '', compact ? 17 : 14, '#8f9aac');
    addButton(this, 805, compact ? 70 : 65, 160, compact ? 84 : 50, '기록전', () => this.scene.start('record-hub'), 0x6a667f);
    addButton(this, 985, compact ? 70 : 65, 160, compact ? 84 : 50, '병기', () => this.scene.start('base-weapon'), 0x6d6b8e);
    addButton(this, 1165, compact ? 70 : 65, 160, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);

    addButton(this, 130, 655, 150, compact ? 82 : 52, '◀ 이전', () => this.changePage(-1), 0x586275);
    addButton(this, 1235, 655, 150, compact ? 82 : 52, '다음 ▶', () => this.changePage(1), 0x586275);
    this.pageText = addText(this, INTERNAL_WIDTH / 2, 650, '', compact ? 22 : 18, '#9ca9bb', 'center').setOrigin(0.5);

    this.renderCollections();
    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      this.authorityText?.setText(view.authority === 'GUEST_LOCAL'
        ? '게스트 로컬 진행'
        : view.authority === 'ACCOUNT_ONLINE'
          ? '로그인 계정 · 서버 진행'
          : '로그인 계정 · 오프라인 캐시 · 출정/재화 변경 불가');
      this.authorityText?.setColor(view.authority === 'ACCOUNT_ONLINE' ? '#8ee3aa' : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? '#f2d37c' : '#8f9aac');
      this.focusCurrentProgressPage();
      this.renderCollections();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.authorityText?.setText(error instanceof Error ? error.message : '진행 정보를 읽지 못했습니다.').setColor('#ff9a91');
    });
  }

  private changePage(delta: number): void {
    const pageCount = getStageCollectionPageCount();
    this.page = Math.max(0, Math.min(pageCount - 1, this.page + delta));
    this.renderCollections();
  }

  private focusCurrentProgressPage(): void {
    const pageCount = getStageCollectionPageCount();
    for (let page = 0; page < pageCount; page += 1) {
      const collections = getStageCollectionPage(page);
      if (collections.some((collection) => {
        if (!isStageCollectionUnlocked(collection, this.progress.clearedStageIds) || !isStageCollectionAvailable(collection)) return false;
        const cleared = getCollectionClearedIds(
          collection,
          this.progress.clearedStageIds,
          this.progress.specialClearedStageIds,
        ).length;
        return cleared < collection.stages.length;
      })) {
        this.page = page;
        return;
      }
    }
    this.page = Math.max(0, pageCount - 1);
  }

  private renderCollections(): void {
    this.collectionLayer?.destroy(true);
    this.collectionLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const pageCount = getStageCollectionPageCount();
    this.page = Math.max(0, Math.min(pageCount - 1, this.page));
    const collections = getStageCollectionPage(this.page);
    this.pageText?.setText(`${this.page + 1} / ${pageCount}`);

    const positions = collections.length === 1
      ? [INTERNAL_WIDTH / 2]
      : collections.map((_, index) => 380 + index * 520);

    collections.forEach((collection, index) => {
      const x = positions[index] ?? INTERNAL_WIDTH / 2;
      const progressionUnlocked = isStageCollectionUnlocked(collection, this.progress.clearedStageIds);
      const available = isStageCollectionAvailable(collection);
      const unlocked = progressionUnlocked && available;
      const availabilityText = getStageCollectionAvailabilityText(collection);
      const periodic = PERIODIC_COLLECTION_IDS.has(collection.id);
      const cleared = getCollectionClearedIds(
        collection,
        this.progress.clearedStageIds,
        this.progress.specialClearedStageIds,
      ).length;
      const special = collection.stageType === 'SPECIAL';
      const accent = periodic ? 0x8d7b4b : special ? 0x9066a6 : 0x6d8fb5;
      const card = this.add.rectangle(
        x,
        365,
        compact ? 430 : 440,
        390,
        unlocked ? (periodic ? 0x302c20 : special ? 0x2b2535 : 0x242c3a) : 0x1d222c,
        0.98,
      ).setStrokeStyle(4, unlocked ? accent : 0x3c4554, 1);
      this.collectionLayer!.add(card);
      const categoryLabel = periodic ? 'PERIODIC' : availabilityText ? 'EVENT' : special ? 'SPECIAL' : 'PROGRESSION';
      this.collectionLayer!.add(addText(this, x, 205, categoryLabel, compact ? 21 : 17, unlocked ? (periodic ? '#e4cf8f' : special ? '#d6b5e8' : '#a9caee') : '#69727e', 'center').setOrigin(0.5));
      this.collectionLayer!.add(addText(this, x, 252, collection.title, compact ? 31 : 30, unlocked ? '#ffffff' : '#747d89', 'center').setOrigin(0.5).setWordWrapWidth(380));
      this.collectionLayer!.add(addText(this, x, 315, collection.description, compact ? 22 : 18, unlocked ? '#c5cedb' : '#656e7a', 'center').setOrigin(0.5).setWordWrapWidth(380));
      this.collectionLayer!.add(addText(this, x, 382, `${cleared} / ${collection.stages.length} 클리어`, compact ? 24 : 21, unlocked ? '#8ee3aa' : '#6c7580', 'center').setOrigin(0.5));
      const difficulties = collection.stages.map((stage) => stage.difficulty);
      this.collectionLayer!.add(addText(this, x, 425, `난이도 ${Math.min(...difficulties)}~${Math.max(...difficulties)} / 12`, compact ? 21 : 17, unlocked ? COLORS.gold : '#6b6658', 'center').setOrigin(0.5));
      if (!unlocked) {
        const remaining = Math.max(0, collection.requiredProgressionClears - this.progress.clearedStageIds.length);
        const reason = !available && availabilityText ? availabilityText : `메인 진도 ${remaining}개 더 필요`;
        this.collectionLayer!.add(addText(this, x, 470, reason, compact ? 20 : 16, '#8b8290', 'center').setOrigin(0.5));
      }
      const lockedLabel = periodic && availabilityText ? '주기 대기' : availabilityText ? '기간 외' : '잠김';
      const button = addButton(this, x, compact ? 535 : 532, 250, compact ? 84 : 60, unlocked ? '스테이지 선택' : lockedLabel, () => {
        if (unlocked) this.scene.start('stage-select', { collectionId: collection.id });
      }, unlocked ? accent : 0x3f4855);
      if (!unlocked) button.setAlpha(0.62);
      this.collectionLayer!.add(button);
    });

    if (!compact) {
      this.collectionLayer.add(addText(
        this,
        INTERNAL_WIDTH / 2,
        605,
        `전선 묶음 ${STAGE_COLLECTIONS.length}개 · 메인 진행과 주기/이벤트 일정에 따라 새 전선이 열린다.`,
        16,
        '#8995a7',
        'center',
      ).setOrigin(0.5));
    }
  }
}
