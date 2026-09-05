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
  addSectionHeading,
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

  constructor() { super('stage-hub'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 52, 28, '출 정', compact ? 46 : 48, COLORS.cream);
    addText(this, 54, 82, compact ? '전선을 고르고 다음 작전을 정한다.' : '진행선을 따라 메인·SPECIAL·기록 작전을 선택한다. 협동 여부는 스테이지에서 결정한다.', compact ? 21 : 18, COLORS.muted);

    addButton(this, 855, 58, 145, compact ? 82 : 50, '기록전', () => this.scene.start('record-hub'), 0x6d7087, { tone: 'quiet' });
    addButton(this, 1015, 58, 145, compact ? 82 : 50, '병기고', () => this.scene.start('base-weapon'), 0x6d7690, { tone: 'quiet' });
    addButton(this, 1175, 58, 145, compact ? 82 : 50, '지휘소', () => this.scene.start('main-menu'), 0x586779, { tone: 'quiet' });

    addSectionHeading(this, 56, 138, '작전 지도', 1168, 0x718671);
    addCommandPanel(this, INTERNAL_WIDTH / 2, 375, 1170, 430, 0x657866, 0x182126, 0.5);

    addButton(this, 110, 660, 160, compact ? 84 : 54, '◀ 이전 전선', () => this.changePage(-1), 0x596779, { tone: 'quiet' });
    addButton(this, 1170, 660, 160, compact ? 84 : 54, '다음 전선 ▶', () => this.changePage(1), 0x596779, { tone: 'quiet' });
    this.pageText = addText(this, INTERNAL_WIDTH / 2, 654, '', compact ? 21 : 17, '#a9b4c0', 'center').setOrigin(0.5);
    this.authorityLayer = this.add.container(0, 0);

    this.renderCollections();
    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      this.renderAuthority(view.authority);
      this.focusCurrentProgressPage();
      this.renderCollections();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.authorityLayer?.destroy(true);
      this.authorityLayer = this.add.container(0, 0);
      this.authorityLayer.add(addStatusPill(this, 610, 104, '진행 정보 오류', 'danger'));
      this.authorityLayer.add(addText(this, 770, 104, error instanceof Error ? error.message : '진행 정보를 읽지 못했습니다.', 15, COLORS.red).setOrigin(0, 0.5));
    });
  }

  private renderAuthority(authority: 'GUEST_LOCAL' | 'ACCOUNT_ONLINE' | 'ACCOUNT_OFFLINE_CACHE'): void {
    this.authorityLayer?.destroy(true);
    this.authorityLayer = this.add.container(0, 0);
    const label = authority === 'ACCOUNT_ONLINE' ? '계정 · 온라인' : authority === 'ACCOUNT_OFFLINE_CACHE' ? '계정 · 오프라인' : '게스트 · 로컬';
    const kind = authority === 'ACCOUNT_ONLINE' ? 'online' : authority === 'ACCOUNT_OFFLINE_CACHE' ? 'offline' : 'neutral';
    this.authorityLayer.add(addStatusPill(this, 54, 112, label, kind));
    if (authority === 'ACCOUNT_OFFLINE_CACHE') {
      this.authorityLayer.add(addText(this, 220, 112, '읽기 전용 · 전투와 보상 변경은 온라인 복구 후 가능', 14, COLORS.warning).setOrigin(0, 0.5));
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
    this.pageText?.setText(`작전군 ${this.page + 1} / ${pageCount}`);

    const positions = collections.length === 1
      ? [INTERNAL_WIDTH / 2]
      : collections.map((_, index) => 380 + index * 520);
    const route = this.add.graphics();
    route.lineStyle(6, 0x607560, 0.6);
    if (positions.length > 1) route.lineBetween(positions[0]! + 72, 318, positions[1]! - 72, 318);
    route.lineStyle(2, 0xc8b06b, 0.3);
    if (positions.length > 1) route.lineBetween(positions[0]! + 72, 313, positions[1]! - 72, 313);
    this.collectionLayer.add(route);

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
      const accent = periodic ? 0xb49a56 : special ? 0x9a72ad : 0x7096b8;
      const nodeFill = unlocked ? accent : 0x4b5562;
      const done = cleared >= collection.stages.length;

      const flagPole = this.add.rectangle(x, 260, 5, 110, unlocked ? 0xb7c1c9 : 0x616a76, 0.8);
      const flag = this.add.triangle(x + 5, 225, 0, 0, 76, 16, 0, 34, nodeFill, unlocked ? 0.95 : 0.55).setOrigin(0, 0.5);
      const nodeOuter = this.add.circle(x, 318, done ? 36 : 32, 0x111820, 0.96).setStrokeStyle(done ? 6 : 4, nodeFill, unlocked ? 1 : 0.5);
      const nodeInner = this.add.circle(x, 318, done ? 18 : 14, done ? 0xd2b866 : nodeFill, unlocked ? 0.9 : 0.35);
      this.collectionLayer!.add([flagPole, flag, nodeOuter, nodeInner]);

      const plate = addCommandPanel(this, x, 443, compact ? 430 : 420, 205, accent, unlocked ? 0x202a31 : 0x1b2027, unlocked ? 0.94 : 0.78);
      this.collectionLayer!.add(plate);
      this.collectionLayer!.add(addText(this, x - 182, 360, categoryName(periodic, special, availabilityText), compact ? 18 : 15, unlocked ? (periodic ? '#ead99d' : special ? '#ddbdec' : '#b8d6ef') : '#77808b'));
      this.collectionLayer!.add(addText(this, x - 182, 394, collection.title, compact ? 30 : 28, unlocked ? '#ffffff' : '#848b95').setWordWrapWidth(360));
      this.collectionLayer!.add(addText(this, x - 182, 438, collection.description, compact ? 18 : 15, unlocked ? '#c2cbd5' : '#717983').setWordWrapWidth(360));

      const difficulties = collection.stages.map((stage) => stage.difficulty);
      this.collectionLayer!.add(addText(this, x - 182, 492, `${cleared}/${collection.stages.length} 완료 · 난이도 ${Math.min(...difficulties)}~${Math.max(...difficulties)}/12`, compact ? 18 : 15, done ? COLORS.green : unlocked ? COLORS.gold : COLORS.dim));

      let reason: string | undefined;
      if (!unlocked) {
        const remaining = Math.max(0, collection.requiredProgressionClears - this.progress.clearedStageIds.length);
        reason = !available && availabilityText ? availabilityText : `메인 전선 ${remaining}개를 더 완료해야 열립니다.`;
        this.collectionLayer!.add(addText(this, x - 182, 522, reason, compact ? 17 : 14, COLORS.warning).setWordWrapWidth(360));
      }

      const button = addButton(this, x, 570, 260, compact ? 82 : 60, unlocked ? (done ? '전선 다시 보기' : '스테이지 선택') : '현재 이용 불가', () => {
        if (unlocked) this.scene.start('stage-select', { collectionId: collection.id });
      }, accent, { tone: unlocked ? 'primary' : 'quiet' });
      if (!unlocked) setButtonState(button, 'locked', reason);
      this.collectionLayer!.add(button);
    });

    if (collections.length === 0) {
      this.collectionLayer.add(addText(this, INTERNAL_WIDTH / 2, 380, '표시할 전선이 없습니다.', 24, COLORS.muted, 'center').setOrigin(0.5));
    }
  }
}
