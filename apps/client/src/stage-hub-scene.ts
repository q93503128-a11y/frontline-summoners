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
import {
  addButton,
  addCommandPanel,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
  setButtonState,
} from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  discoveredEnemyIds: [],
};
const PERIODIC_COLLECTION_IDS = new Set<string>(PERIODIC_REWARD_COLLECTION_IDS);

function categoryName(periodic: boolean, special: boolean, availabilityText: string | undefined): string {
  if (periodic) return '주기 작전';
  if (availabilityText) return '기간 작전';
  return special ? '특수 전선' : '메인 전선';
}

export class StageHubScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private page = 0;
  private collectionLayer?: Phaser.GameObjects.Container;
  private pageText?: Phaser.GameObjects.Text;
  private authorityLayer?: Phaser.GameObjects.Container;
  private previousButton?: Phaser.GameObjects.Container;
  private nextButton?: Phaser.GameObjects.Container;

  constructor() { super('stage-hub'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 52, 28, '전선 지도', compact ? 44 : 46, COLORS.cream);
    addText(this, 54, 77, '진행할 작전군을 고르고 전장으로 이동합니다.', compact ? 18 : 15, COLORS.muted);

    addButton(this, 855, 56, 145, compact ? 80 : 50, '기록전', () => this.scene.start('record-hub'), 0x6d7087, { tone: 'quiet' });
    addButton(this, 1015, 56, 145, compact ? 80 : 50, '병기고', () => this.scene.start('base-weapon'), 0x6d7690, { tone: 'quiet' });
    addButton(this, 1175, 56, 145, compact ? 80 : 50, '지휘소', () => this.scene.start('main-menu'), 0x586779, { tone: 'quiet' });

    this.pageText = addText(this, INTERNAL_WIDTH / 2, 128, '', compact ? 19 : 15, '#a9b4c0', 'center').setOrigin(0.5);
    this.previousButton = addButton(this, 120, 666, 180, compact ? 82 : 54, '◀ 이전 작전군', () => this.changePage(-1), 0x596779, { tone: 'quiet' });
    this.nextButton = addButton(this, 1160, 666, 180, compact ? 82 : 54, '다음 작전군 ▶', () => this.changePage(1), 0x596779, { tone: 'quiet' });
    this.authorityLayer = this.add.container(0, 0);

    this.renderCollections();
    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      this.renderAuthority(view.authority);
      this.focusCurrentProgressPage();
      this.renderCollections();
    }).catch(() => {
      if (!this.scene.isActive()) return;
      this.authorityLayer?.destroy(true);
      this.authorityLayer = this.add.container(0, 0);
      this.authorityLayer.add(addStatusPill(this, 54, 108, '진행 정보 오류', 'danger'));
      this.authorityLayer.add(addText(this, 214, 108, '진행 정보를 읽지 못했습니다. 다시 시도해 주세요.', compact ? 16 : 13, COLORS.red).setOrigin(0, 0.5));
    });
  }

  private renderAuthority(authority: 'GUEST_LOCAL' | 'ACCOUNT_ONLINE' | 'ACCOUNT_OFFLINE_CACHE'): void {
    this.authorityLayer?.destroy(true);
    this.authorityLayer = this.add.container(0, 0);
    const label = authority === 'ACCOUNT_ONLINE' ? '계정 · 온라인' : authority === 'ACCOUNT_OFFLINE_CACHE' ? '계정 · 오프라인' : '게스트 · 로컬';
    const kind = authority === 'ACCOUNT_ONLINE' ? 'online' : authority === 'ACCOUNT_OFFLINE_CACHE' ? 'offline' : 'neutral';
    this.authorityLayer.add(addStatusPill(this, 54, 108, label, kind));
    if (authority === 'ACCOUNT_OFFLINE_CACHE') {
      this.authorityLayer.add(addText(this, 214, 108, '읽기 전용 · 전투와 보상 변경은 온라인 복구 후 가능합니다.', 13, COLORS.warning).setOrigin(0, 0.5));
    }
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
        const cleared = getCollectionClearedIds(collection, this.progress.clearedStageIds, this.progress.specialClearedStageIds).length;
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
    this.pageText?.setText(`작전군 ${this.page + 1} / ${pageCount}`);
    if (this.previousButton) setButtonState(this.previousButton, this.page <= 0 ? 'disabled' : 'default', this.page <= 0 ? '첫 번째 작전군입니다.' : undefined);
    if (this.nextButton) setButtonState(this.nextButton, this.page >= pageCount - 1 ? 'disabled' : 'default', this.page >= pageCount - 1 ? '마지막 작전군입니다.' : undefined);

    if (collections.length === 0) {
      this.collectionLayer.add(addText(this, INTERNAL_WIDTH / 2, 390, '표시할 전선이 없습니다.', compact ? 26 : 22, COLORS.muted, 'center').setOrigin(0.5));
      return;
    }

    const positions = collections.length === 1 ? [INTERNAL_WIDTH / 2] : collections.map((_, index) => 360 + index * 560);
    const route = this.add.graphics();
    route.lineStyle(8, 0x182028, 0.84);
    if (positions.length > 1) route.lineBetween(positions[0]! + 54, 240, positions[1]! - 54, 240);
    route.lineStyle(3, 0x74836d, 0.44);
    if (positions.length > 1) route.lineBetween(positions[0]! + 54, 240, positions[1]! - 54, 240);
    this.collectionLayer.add(route);

    collections.forEach((collection, index) => {
      const x = positions[index] ?? INTERNAL_WIDTH / 2;
      const progressionUnlocked = isStageCollectionUnlocked(collection, this.progress.clearedStageIds);
      const available = isStageCollectionAvailable(collection);
      const unlocked = progressionUnlocked && available;
      const availabilityText = getStageCollectionAvailabilityText(collection);
      const periodic = PERIODIC_COLLECTION_IDS.has(collection.id);
      const cleared = getCollectionClearedIds(collection, this.progress.clearedStageIds, this.progress.specialClearedStageIds).length;
      const special = collection.stageType === 'SPECIAL';
      const accent = periodic ? 0xb49a56 : special ? 0x9a72ad : 0x7096b8;
      const done = cleared >= collection.stages.length;
      const nodeColor = unlocked ? (done ? 0x86b78c : accent) : 0x4b5562;

      this.collectionLayer!.add(this.add.circle(x, 240, 34, 0x111820, 0.96).setStrokeStyle(done ? 6 : 4, nodeColor, unlocked ? 1 : 0.5));
      this.collectionLayer!.add(this.add.circle(x, 240, done ? 15 : 11, done ? 0x98d3a0 : nodeColor, unlocked ? 0.92 : 0.35));

      this.collectionLayer!.add(addCommandPanel(this, x, 430, 500, 300, accent, unlocked ? 0x1c252d : 0x191f26, unlocked ? 0.95 : 0.8));
      this.collectionLayer!.add(addStatusPill(this, x - 205, 304, categoryName(periodic, special, availabilityText), unlocked ? (done ? 'online' : 'neutral') : 'warning'));
      this.collectionLayer!.add(addText(this, x - 210, 342, collection.title, compact ? 30 : 27, unlocked ? '#ffffff' : '#858d97').setWordWrapWidth(420));
      this.collectionLayer!.add(addText(this, x - 210, 392, collection.description, compact ? 17 : 14, unlocked ? '#bec9d5' : '#737b86').setWordWrapWidth(420));

      const difficulties = collection.stages.map((stage) => stage.difficulty);
      this.collectionLayer!.add(addText(this, x - 210, 468, `${cleared}/${collection.stages.length} 완료`, compact ? 18 : 15, done ? COLORS.green : unlocked ? COLORS.gold : COLORS.dim));
      this.collectionLayer!.add(addText(this, x + 210, 468, `난이도 ${Math.min(...difficulties)}~${Math.max(...difficulties)}/12`, compact ? 17 : 14, unlocked ? '#9fb1c2' : '#6f7781', 'right').setOrigin(1, 0));

      let reason: string | undefined;
      if (!unlocked) {
        const remaining = Math.max(0, collection.requiredProgressionClears - this.progress.clearedStageIds.length);
        reason = !available && availabilityText ? availabilityText : `메인 전선 ${remaining}개를 더 완료해야 열립니다.`;
        this.collectionLayer!.add(addText(this, x, 510, reason, compact ? 16 : 13, COLORS.warning, 'center').setOrigin(0.5).setWordWrapWidth(420));
      }

      const button = addButton(this, x, 566, 280, compact ? 82 : 58, unlocked ? (done ? '전선 다시 보기' : '스테이지 선택') : '잠김', () => {
        if (unlocked) this.scene.start('stage-select', { collectionId: collection.id });
      }, accent, { tone: unlocked ? 'primary' : 'quiet' });
      if (!unlocked) setButtonState(button, 'locked', reason);
      this.collectionLayer!.add(button);
    });
  }
}
