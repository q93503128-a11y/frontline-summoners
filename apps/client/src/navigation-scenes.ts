import Phaser from 'phaser';
import { APP_NAME, INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { ART_FAMILIES } from './assets';
import { BATTLEFIELD_THEME_LABELS } from './battlefield';
import {
  ALL_PLAYER_SLOTS,
  SPECIAL_STAGES,
  STAGES,
  createPrototypeBattle,
  getSlotById,
  getUnlockedSlotIds,
} from './prototype';
import { getOwnedCharacterIds, loadGuestProgress, type GuestProgress } from './save';
import {
  STAGE_COLLECTIONS,
  getCollectionClearedIds,
  getFirstUnclearedCollectionStageIndex,
  getStageCollection,
  isSortieStageUnlocked,
  isStageCollectionUnlocked,
  type StageCollection,
} from './stage-navigation';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], specialClearedStageIds: [], treasureIds: [] };

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void {
    drawBackdrop(this, 'menu');
    addText(this, INTERNAL_WIDTH / 2, 260, '전선소환전', 58, COLORS.cream, 'center').setOrigin(0.5);
    const status = addText(this, INTERNAL_WIDTH / 2, 350, '캐릭터 불러오는 중…', 24, COLORS.muted, 'center').setOrigin(0.5);
    this.add.rectangle(INTERNAL_WIDTH / 2, 410, 520, 20, 0x10141d).setStrokeStyle(2, 0x67738a);
    const bar = this.add.rectangle(INTERNAL_WIDTH / 2 - 256, 410, 1, 12, 0xf0c967).setOrigin(0, 0.5);
    this.load.setCORS('anonymous');
    for (const family of ART_FAMILIES) {
      for (const strip of [family.idle, family.run, family.attack]) {
        if (!this.textures.exists(strip.key)) this.load.spritesheet(strip.key, strip.url, { frameWidth: strip.frameWidth, frameHeight: strip.frameHeight });
      }
    }
    this.load.on('progress', (value: number) => bar.displayWidth = Math.max(1, 512 * value));
    this.load.on('loaderror', (file: { key?: string }) => status.setText(`일부 캐릭터 로드 실패 · 대체 표시 사용 예정 ${file.key ?? ''}`));
  }

  create(): void { this.scene.start('main-menu'); }
}

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('main-menu'); }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    addText(this, compact ? 70 : 84, compact ? 60 : 84, '전선소환전', compact ? 60 : 70, COLORS.cream);
    addText(this, compact ? 74 : 88, compact ? 132 : 165, APP_NAME, compact ? 22 : 24, '#9fb0c6');
    addText(this, compact ? 74 : 88, compact ? 188 : 230, compact ? '별난 영웅을 모아 전선을 밀어붙여라.' : '별난 영웅들을 모아 전선을 밀어붙여라.', compact ? 30 : 29, '#e8edf6');
    addText(this, compact ? 74 : 88, compact ? 238 : 272, compact ? '승리할수록 전선과 동료가 열린다.' : '첫 출정은 징집병 하나. 승리할수록 전선과 동료가 열린다.', compact ? 24 : 22, COLORS.muted);

    this.add.rectangle(compact ? 1020 : 1040, compact ? 120 : 105, compact ? 390 : 320, compact ? 145 : 110, 0x222936, 0.96).setStrokeStyle(2, 0x556077);
    addText(this, compact ? 850 : 900, compact ? 78 : 72, '게스트 지휘관', compact ? 28 : 26, '#ffffff');
    const progressText = addText(this, compact ? 850 : 900, compact ? 122 : 110, '진행도 불러오는 중…', compact ? 22 : 18, COLORS.muted);

    const menuButtonHeight = compact ? 108 : 92;
    addButton(this, 170, compact ? 425 : 435, 250, menuButtonHeight, '출 정', () => this.scene.start('stage-hub'), 0xc5a04c);
    addButton(this, 480, compact ? 425 : 435, 250, menuButtonHeight, '편 성', () => this.scene.start('deck'), 0x5f8fb8);
    addButton(this, 790, compact ? 425 : 435, 250, menuButtonHeight, '모 집', () => this.scene.start('recruitment'), 0x8b6fb5);
    addButton(this, 1100, compact ? 425 : 435, 250, menuButtonHeight, '도 감', () => this.scene.start('catalog'), 0x8c7650);
    addText(this, compact ? 74 : 88, compact ? 610 : 628, compact ? '보물 첫 클리어 100% · 에너지 제한 없음' : '출정에서 전선 묶음을 고른 뒤 스테이지로 진입 · 에너지 제한 없음', compact ? 24 : 20, '#9cd6ad');
    if (!compact) addText(this, 1185, 675, 'PRE-ALPHA', 17, '#657086').setOrigin(1, 0.5);

    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      const owned = getOwnedCharacterIds(progress).length;
      progressText.setText(compact
        ? `진도 ${progress.clearedStageIds.length}/${STAGES.length} · 특수 ${progress.specialClearedStageIds.length}/${SPECIAL_STAGES.length} · 동료 ${owned}`
        : `진도 ${progress.clearedStageIds.length}/${STAGES.length} · 특수 ${progress.specialClearedStageIds.length}/${SPECIAL_STAGES.length} · 보물 ${progress.treasureIds.length}/${STAGES.length} · 동료 ${owned}/${ALL_PLAYER_SLOTS.length}`);
    });
  }
}

export class StageHubScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private collectionLayer?: Phaser.GameObjects.Container;

  constructor() { super('stage-hub'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 38, '출 정', 46, COLORS.cream);
    addText(this, 56, 94, compact ? '전선을 고르고 출격한다.' : '진도·특수전처럼 목적이 다른 전선 묶음을 먼저 고른다.', compact ? 22 : 19, COLORS.muted);
    addButton(this, 1165, compact ? 70 : 65, 160, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);

    this.renderCollections();
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      this.renderCollections();
    });
  }

  private renderCollections(): void {
    this.collectionLayer?.destroy(true);
    this.collectionLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const positions = STAGE_COLLECTIONS.length === 1
      ? [INTERNAL_WIDTH / 2]
      : STAGE_COLLECTIONS.map((_, index) => 380 + index * 520);

    STAGE_COLLECTIONS.forEach((collection, index) => {
      const x = positions[index] ?? INTERNAL_WIDTH / 2;
      const unlocked = isStageCollectionUnlocked(collection, this.progress.clearedStageIds);
      const cleared = getCollectionClearedIds(collection, this.progress.clearedStageIds, this.progress.specialClearedStageIds).length;
      const special = collection.stageType === 'SPECIAL';
      const accent = special ? 0x9066a6 : 0x6d8fb5;
      const card = this.add.rectangle(x, 365, compact ? 430 : 440, 390, unlocked ? (special ? 0x2b2535 : 0x242c3a) : 0x1d222c, 0.98)
        .setStrokeStyle(4, unlocked ? accent : 0x3c4554, 1);
      this.collectionLayer!.add(card);
      this.collectionLayer!.add(addText(this, x, 205, special ? 'SPECIAL' : 'PROGRESSION', compact ? 21 : 17, unlocked ? (special ? '#d6b5e8' : '#a9caee') : '#69727e', 'center').setOrigin(0.5));
      this.collectionLayer!.add(addText(this, x, 252, collection.title, compact ? 31 : 30, unlocked ? '#ffffff' : '#747d89', 'center').setOrigin(0.5).setWordWrapWidth(380));
      this.collectionLayer!.add(addText(this, x, 315, collection.description, compact ? 22 : 18, unlocked ? '#c5cedb' : '#656e7a', 'center').setOrigin(0.5).setWordWrapWidth(380));
      this.collectionLayer!.add(addText(this, x, 382, `${cleared} / ${collection.stages.length} 클리어`, compact ? 24 : 21, unlocked ? '#8ee3aa' : '#6c7580', 'center').setOrigin(0.5));
      const difficulties = collection.stages.map((stage) => stage.difficulty);
      const difficultyText = `난이도 ${Math.min(...difficulties)}~${Math.max(...difficulties)} / 12`;
      this.collectionLayer!.add(addText(this, x, 425, difficultyText, compact ? 21 : 17, unlocked ? COLORS.gold : '#6b6658', 'center').setOrigin(0.5));
      if (!unlocked) {
        const remaining = Math.max(0, collection.requiredProgressionClears - this.progress.clearedStageIds.length);
        this.collectionLayer!.add(addText(this, x, 470, `진도 ${remaining}개 더 클리어 필요`, compact ? 20 : 16, '#8b8290', 'center').setOrigin(0.5));
      }
      const collectionButton = addButton(this, x, compact ? 535 : 532, 250, compact ? 84 : 60, unlocked ? '스테이지 선택' : '잠김', () => {
        if (unlocked) this.scene.start('stage-select', { collectionId: collection.id });
      }, unlocked ? accent : 0x3f4855);
      if (!unlocked) collectionButton.setAlpha(0.62);
      this.collectionLayer!.add(collectionButton);
    });

    if (!compact) {
      this.collectionLayer.add(addText(this, INTERNAL_WIDTH / 2, 632, '앞으로 제2장·외전·이벤트가 늘어나도 이 출정 허브에서 전선 묶음만 추가된다.', 16, '#8995a7', 'center').setOrigin(0.5));
    }
  }
}

export class StageSelectScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private collection: StageCollection = STAGE_COLLECTIONS[0]!;
  private page = 0;
  private stageLayer?: Phaser.GameObjects.Container;
  private pageText?: Phaser.GameObjects.Text;

  constructor() { super('stage-select'); }

  init(data: { collectionId?: string }): void {
    this.collection = getStageCollection(data.collectionId ?? STAGE_COLLECTIONS[0]!.id);
    this.page = 0;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 38, this.collection.title, 42, COLORS.cream);
    addText(this, 56, 91, compact
      ? `${this.collection.stages.length}개 전장`
      : `${this.collection.stages.length}개 전장 · 5개씩 보기 · ${this.collection.stageType === 'SPECIAL' ? '메인 진도와 별도 기록' : '순차 진도'}`,
    compact ? 22 : 19, COLORS.muted);
    addButton(this, 995, compact ? 70 : 65, 150, compact ? 84 : 50, '출정', () => this.scene.start('stage-hub'), 0x6a7790);
    addButton(this, 1165, compact ? 70 : 65, 160, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    addButton(this, 72, 655, 115, compact ? 84 : 52, '◀ 이전', () => { this.page = Math.max(0, this.page - 1); this.renderPage(); }, 0x586275);
    addButton(this, 1208, 655, 115, compact ? 84 : 52, '다음 ▶', () => { this.page = Math.min(this.pageCount() - 1, this.page + 1); this.renderPage(); }, 0x586275);
    this.pageText = addText(this, INTERNAL_WIDTH / 2, 640, '', compact ? 22 : 18, '#9ca9bb', 'center').setOrigin(0.5);

    this.renderPage();
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      const firstUncleared = getFirstUnclearedCollectionStageIndex(this.collection, progress.clearedStageIds, progress.specialClearedStageIds);
      if (firstUncleared >= 0) this.page = Math.floor(firstUncleared / 5);
      this.renderPage();
    });
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.collection.stages.length / 5));
  }

  private renderPage(): void {
    this.stageLayer?.destroy(true);
    this.stageLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const special = this.collection.stageType === 'SPECIAL';
    const start = this.page * 5;
    const visible = this.collection.stages.slice(start, start + 5);
    this.pageText?.setText(`${this.page + 1} / ${this.pageCount()}`);

    visible.forEach((stage, localIndex) => {
      const index = start + localIndex;
      const x = 145 + localIndex * 247;
      const unlocked = isSortieStageUnlocked(stage.id, this.progress.clearedStageIds);
      const cleared = special
        ? this.progress.specialClearedStageIds.includes(stage.id)
        : this.progress.clearedStageIds.includes(stage.id);
      const treasureOwned = !special && this.progress.treasureIds.includes(stage.treasure.id);
      const last = index === this.collection.stages.length - 1;
      const border = unlocked ? (special ? (last ? 0xc28bcb : 0x80659b) : (last ? 0xbf9252 : 0x596c86)) : 0x3c4554;
      const card = this.add.rectangle(x, 360, 220, 445, unlocked ? (special ? 0x2b2535 : 0x242b3a) : 0x1d222c, 0.98).setStrokeStyle(3, border, 1);
      this.stageLayer!.add(card);
      const stageNumber = index + 1;
      this.stageLayer!.add(addText(this, x, 160, special ? `SPECIAL ${stageNumber}` : `STAGE ${stageNumber}`, compact ? 20 : 16, unlocked ? (special ? '#bba4d0' : '#8998ad') : '#5f6978', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, compact ? 205 : 202, stage.name, compact ? 28 : 25, unlocked ? '#ffffff' : '#747d89', 'center').setOrigin(0.5).setWordWrapWidth(195));
      this.stageLayer!.add(addText(this, x, compact ? 252 : 246, `난이도 ${stage.difficulty} / 12`, compact ? 21 : 16, unlocked ? (special ? '#efb6ff' : COLORS.gold) : '#5e6470', 'center').setOrigin(0.5));

      if (compact) {
        this.stageLayer!.add(addText(this, x, 302, cleared ? '✓ 클리어' : unlocked ? (special ? '도전 가능' : '미클리어') : '잠김', 22, cleared ? '#8ee3aa' : unlocked ? '#a3adbb' : '#6b7480', 'center').setOrigin(0.5));
        if (special) {
          const effectiveCap = unlocked
            ? createPrototypeBattle(stage.id, getUnlockedSlotIds(this.progress.clearedStageIds), this.progress.treasureIds).playerUnitCap
            : stage.playerUnitCap;
          this.stageLayer!.add(addText(this, x, 350, unlocked ? `동시 출격 ${effectiveCap}기` : '제1장 완료 필요', 20, unlocked ? '#ffd493' : '#6d6858', 'center').setOrigin(0.5));
          this.stageLayer!.add(addText(this, x, 402, cleared ? `✓ ${stage.treasure.name}` : stage.treasure.name, 19, cleared ? '#9fe4b5' : unlocked ? '#e2ca8d' : '#6d6858', 'center').setOrigin(0.5).setWordWrapWidth(196));
        } else {
          this.stageLayer!.add(addText(this, x, 350, '확정 보물', 19, unlocked ? '#8dd9a8' : '#596a60', 'center').setOrigin(0.5));
          this.stageLayer!.add(addText(this, x, 386, treasureOwned ? `✓ ${stage.treasure.name}` : stage.treasure.name, 20, treasureOwned ? '#9fe4b5' : unlocked ? '#f2d37c' : '#6d6858', 'center').setOrigin(0.5).setWordWrapWidth(196));
        }
      } else {
        this.stageLayer!.add(addText(this, x, 282, BATTLEFIELD_THEME_LABELS[stage.theme], 16, unlocked ? (special ? '#bba8ca' : '#9ec5d7') : '#606874', 'center').setOrigin(0.5));
        this.stageLayer!.add(addText(this, x, 310, `전장 ${stage.mapLength}m`, 14, unlocked ? '#aeb8c8' : '#59616d', 'center').setOrigin(0.5));
        this.stageLayer!.add(addText(this, x, 346, stage.subtitle, 14, unlocked ? (special ? '#d0c6da' : '#c4cbd7') : '#626a76', 'center').setOrigin(0.5).setWordWrapWidth(194));
        this.stageLayer!.add(addText(this, x, 401, cleared ? '✓ 클리어' : unlocked ? (special ? '도전 가능' : '미클리어') : '잠김', 17, cleared ? '#8ee3aa' : unlocked ? '#a3adbb' : '#6b7480', 'center').setOrigin(0.5));
        if (special) {
          const effectiveCap = unlocked
            ? createPrototypeBattle(stage.id, getUnlockedSlotIds(this.progress.clearedStageIds), this.progress.treasureIds).playerUnitCap
            : stage.playerUnitCap;
          this.stageLayer!.add(addText(this, x, 432, unlocked ? `동시 출격 ${effectiveCap}기 · 적 최대 ${stage.enemyUnitCap}기` : '제1장 20스테이지 완료 후 개방', 14, unlocked ? '#ffd493' : '#666d78', 'center').setOrigin(0.5).setWordWrapWidth(196));
          this.stageLayer!.add(addText(this, x, 474, cleared ? `✓ ${stage.treasure.name}` : `첫 클리어 훈장 · ${stage.treasure.name}`, 13, cleared ? '#9fe4b5' : unlocked ? '#e2ca8d' : '#6d6858', 'center').setOrigin(0.5).setWordWrapWidth(196));
        } else {
          this.stageLayer!.add(addText(this, x, 434, '확정 보물', 14, unlocked ? '#8dd9a8' : '#596a60', 'center').setOrigin(0.5));
          this.stageLayer!.add(addText(this, x, 458, treasureOwned ? `✓ ${stage.treasure.name}` : stage.treasure.name, 14, treasureOwned ? '#9fe4b5' : unlocked ? '#f2d37c' : '#6d6858', 'center').setOrigin(0.5).setWordWrapWidth(196));
        }
      }

      if (!special && stage.unlockUnitId) {
        const slot = getSlotById(stage.unlockUnitId);
        if (slot) this.stageLayer!.add(addText(this, x, compact ? 445 : 503, compact ? `동료 · ${slot.displayName}` : `첫 클리어 동료 · ${slot.displayName}`, compact ? 19 : 14, cleared ? '#8ee3aa' : unlocked ? '#a8cfff' : '#59616d', 'center').setOrigin(0.5));
      }

      const lockedLabel = special ? '제1장 완료 필요' : '이전 스테이지 필요';
      const stageButton = addButton(this, x, compact ? 535 : 548, 174, compact ? 84 : 52, unlocked ? (special ? '도전 시작' : '전투 시작') : compact ? '잠김' : lockedLabel, () => {
        if (unlocked) this.scene.start('battle', { stageId: stage.id });
      }, unlocked ? border : 0x3f4855);
      if (!unlocked) stageButton.setAlpha(0.62);
      this.stageLayer!.add(stageButton);
    });
  }
}
