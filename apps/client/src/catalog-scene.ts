import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART, type UnitArtVariant } from './assets';
import { formatCombatTraits, formatDamageSpecialty } from './combat-trait-labels';
import {
  PLAYER_SLOTS,
  SPECIAL_STAGES,
  STAGES,
  getSpecialStageNumber,
  getStageNumber,
  getUnlockStageForSlot,
  getUnlockedSlotIds,
} from './prototype';
import { loadGuestProgress, type GuestProgress } from './save';
import { isCompactMobileViewport } from './viewport';

const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], specialClearedStageIds: [], treasureIds: [] };
const ALLY_PAGE_SIZE = 5;
const TREASURE_PAGE_SIZE = 5;
const MEDAL_PAGE_SIZE = 5;

type CatalogMode = 'ALLIES' | 'TREASURES' | 'MEDALS';

const rarityColor: Record<string, string> = {
  C: '#b9c2cf',
  B: '#8bd6a3',
  A: '#79baff',
  S: '#d79aff',
  SS: '#ffd56f',
};

function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 24,
  color = '#ffffff',
  align: 'left' | 'center' | 'right' = 'left',
): Phaser.GameObjects.Text {
  const renderedSize = isCompactMobileViewport() ? Math.max(size, 16) : size;
  return scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${renderedSize}px`,
    color,
    align,
  });
}

function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  accent = 0x657086,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, height, 0x252b38, 0.98).setStrokeStyle(3, accent, 1);
  const text = addText(scene, 0, 0, label, isCompactMobileViewport() ? 26 : 18, '#ffffff', 'center').setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => bg.setFillStyle(0x343c4d, 1));
  bg.on('pointerout', () => {
    bg.setFillStyle(0x252b38, 0.98);
    container.setScale(1);
  });
  bg.on('pointerdown', () => container.setScale(0.98));
  bg.on('pointerupoutside', () => container.setScale(1));
  bg.on('pointerup', () => {
    container.setScale(1);
    onClick();
  });
  return container;
}

function drawBackdrop(scene: Phaser.Scene): void {
  scene.cameras.main.setBackgroundColor('#171c27');
  const g = scene.add.graphics();
  g.fillStyle(0x171c27).fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
  g.fillStyle(0x25334a, 1).fillCircle(1110, 105, 230);
  g.fillStyle(0x283348, 1).fillTriangle(0, 585, 330, 260, 650, 585);
  g.fillStyle(0x222d40, 1).fillTriangle(430, 585, 790, 205, 1120, 585);
  g.fillStyle(0x111722).fillRect(0, 585, INTERNAL_WIDTH, 135);
}

function getArt(slotId: string) {
  const variant: UnitArtVariant = UNIT_ART[slotId] ?? {
    familyId: 'warrior',
    tint: 0xffffff,
    attackFx: 'SLASH',
  };
  const family = ART_BY_ID[variant.familyId] ?? ART_FAMILIES[0]!;
  return { family, tint: variant.tint, displayScale: variant.displayScale ?? 1 };
}

export class CatalogScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private mode: CatalogMode = 'ALLIES';
  private page = 0;
  private contentLayer?: Phaser.GameObjects.Container;
  private pageText?: Phaser.GameObjects.Text;
  private allyTab?: Phaser.GameObjects.Container;
  private treasureTab?: Phaser.GameObjects.Container;
  private medalTab?: Phaser.GameObjects.Container;

  constructor() {
    super('catalog');
  }

  create(): void {
    drawBackdrop(this);
    const compact = isCompactMobileViewport();
    const navigationHeight = compact ? 84 : 50;
    const tabHeight = compact ? 84 : 54;
    addText(this, 54, 34, '도 감', 44, '#fff4cf');
    if (!compact) addText(this, 56, 88, '동료, 제1장 확정 보물, 특수전 훈장을 한곳에서 확인한다.', 18, '#b8c0ce');
    addButton(this, 1165, compact ? 70 : 62, 160, navigationHeight, '메인', () => this.scene.start('main-menu'), 0x586275);

    this.allyTab = addButton(this, 210, 135, 230, tabHeight, '동료 10종', () => this.setMode('ALLIES'), 0x6d91b5);
    this.treasureTab = addButton(this, 465, 135, 230, tabHeight, '보물 20종', () => this.setMode('TREASURES'), 0xb69755);
    this.medalTab = addButton(this, 720, 135, 230, tabHeight, '훈장 5종', () => this.setMode('MEDALS'), 0x9569a5);
    addButton(this, 92, compact ? 660 : 664, 140, navigationHeight, '◀ 이전', () => this.changePage(-1), 0x586275);
    addButton(this, 1188, compact ? 660 : 664, 140, navigationHeight, '다음 ▶', () => this.changePage(1), 0x586275);
    this.pageText = addText(this, INTERNAL_WIDTH / 2, 652, '', compact ? 22 : 18, '#aab4c3', 'center').setOrigin(0.5);

    this.render();
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      this.render();
    });
  }

  private setMode(mode: CatalogMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.page = 0;
    this.render();
  }

  private getPageCount(): number {
    if (this.mode === 'ALLIES') return Math.ceil(PLAYER_SLOTS.length / ALLY_PAGE_SIZE);
    if (this.mode === 'TREASURES') return Math.ceil(STAGES.length / TREASURE_PAGE_SIZE);
    return Math.ceil(SPECIAL_STAGES.length / MEDAL_PAGE_SIZE);
  }

  private changePage(delta: number): void {
    this.page = Phaser.Math.Clamp(this.page + delta, 0, this.getPageCount() - 1);
    this.render();
  }

  private render(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = this.add.container(0, 0);
    this.page = Phaser.Math.Clamp(this.page, 0, Math.max(0, this.getPageCount() - 1));
    const modeLabel = this.mode === 'ALLIES' ? '동료' : this.mode === 'TREASURES' ? '보물' : '훈장';
    this.pageText?.setText(`${modeLabel} · ${this.page + 1} / ${this.getPageCount()}`);
    this.allyTab?.setAlpha(this.mode === 'ALLIES' ? 1 : 0.62);
    this.treasureTab?.setAlpha(this.mode === 'TREASURES' ? 1 : 0.62);
    this.medalTab?.setAlpha(this.mode === 'MEDALS' ? 1 : 0.62);

    if (this.mode === 'ALLIES') this.renderAllies();
    else if (this.mode === 'TREASURES') this.renderTreasures();
    else this.renderMedals();
  }

  private renderAllies(): void {
    const compact = isCompactMobileViewport();
    const start = this.page * ALLY_PAGE_SIZE;
    const unlockedIds = new Set(getUnlockedSlotIds(this.progress.clearedStageIds));
    const visible = PLAYER_SLOTS.slice(start, start + ALLY_PAGE_SIZE);

    visible.forEach((slot, localIndex) => {
      const x = 145 + localIndex * 247;
      const unlocked = unlockedIds.has(slot.slotId);
      const border = unlocked
        ? Phaser.Display.Color.HexStringToColor(rarityColor[slot.rarity] ?? '#ffffff').color
        : 0x46505e;
      const card = this.add.rectangle(x, 398, 220, 430, unlocked ? 0x252c3a : 0x1d222b, 0.98)
        .setStrokeStyle(3, border, unlocked ? 0.95 : 0.65);
      this.contentLayer!.add(card);

      const art = getArt(slot.definition.id);
      const portrait = this.add.sprite(x, compact ? 285 : 270, art.family.idle.key, 0)
        .setTint(unlocked ? art.tint : 0x30343c)
        .setAlpha(unlocked ? 1 : 0.5);
      portrait.setScale(((compact ? 132 : 145) / art.family.idle.frameHeight) * art.displayScale);
      this.contentLayer!.add(portrait);

      this.contentLayer!.add(addText(this, x - 96, 200, unlocked ? slot.rarity : 'LOCK', compact ? 20 : 15, unlocked ? rarityColor[slot.rarity] ?? '#ffffff' : '#69727e'));
      this.contentLayer!.add(addText(this, x, compact ? 360 : 342, slot.displayName, compact ? 27 : 22, unlocked ? '#ffffff' : '#7b8591', 'center').setOrigin(0.5));

      if (unlocked) {
        this.contentLayer!.add(addText(this, x, compact ? 400 : 376, `${slot.role} · ${slot.cost} 보급`, compact ? 21 : 14, '#f2d37c', 'center').setOrigin(0.5));
        this.contentLayer!.add(addText(this, x, compact ? 438 : 402, formatCombatTraits(slot.definition), compact ? 19 : 13, '#9fcfff', 'center').setOrigin(0.5));
        const specialty = formatDamageSpecialty(slot.definition);
        if (specialty) {
          this.contentLayer!.add(addText(this, x, compact ? 474 : 430, specialty, compact ? 19 : 13, '#ffd493', 'center').setOrigin(0.5));
        }
        if (compact) {
          this.contentLayer!.add(addText(this, x, 532, `HP ${slot.definition.maxHp} · 공격 ${slot.definition.attackDamage}\n사거리 ${slot.definition.attackMaxRange}`, 18, '#aeb8c8', 'center').setOrigin(0.5).setWordWrapWidth(190));
        } else {
          this.contentLayer!.add(addText(this, x, specialty ? 466 : 440, slot.description, 13, '#bec7d5', 'center').setOrigin(0.5).setWordWrapWidth(188));
          this.contentLayer!.add(addText(this, x, 555, `HP ${slot.definition.maxHp}  ·  공격 ${slot.definition.attackDamage}\n사거리 ${slot.definition.attackMaxRange}  ·  재생산 ${(slot.rechargeFrames / 30).toFixed(1)}초`, 12, '#91a0b3', 'center').setOrigin(0.5).setWordWrapWidth(190));
        }
      } else {
        const unlockStage = getUnlockStageForSlot(slot.slotId);
        const requirement = unlockStage
          ? `STAGE ${getStageNumber(unlockStage.id)} 첫 클리어\n${unlockStage.name}`
          : '캠페인 진행으로 합류';
        this.contentLayer!.add(addText(this, x, compact ? 420 : 410, compact ? '미합류' : '아직 합류하지 않은 동료', compact ? 22 : 14, '#727c89', 'center').setOrigin(0.5));
        this.contentLayer!.add(addText(this, x, compact ? 482 : 470, requirement, compact ? 19 : 14, '#8290a1', 'center').setOrigin(0.5).setWordWrapWidth(190));
        if (!compact) this.contentLayer!.add(addText(this, x, 552, '능력치는 합류 후 공개', 12, '#616b78', 'center').setOrigin(0.5));
      }
    });
  }

  private renderTreasures(): void {
    const compact = isCompactMobileViewport();
    const start = this.page * TREASURE_PAGE_SIZE;
    const owned = new Set(this.progress.treasureIds);
    const visible = STAGES.slice(start, start + TREASURE_PAGE_SIZE);

    visible.forEach((stage, localIndex) => {
      const x = 145 + localIndex * 247;
      const stageNumber = getStageNumber(stage.id);
      const isOwned = owned.has(stage.treasure.id);
      const card = this.add.rectangle(x, 398, 220, 430, isOwned ? 0x2a302f : 0x1d222b, 0.98)
        .setStrokeStyle(3, isOwned ? 0xb79958 : 0x46505e, isOwned ? 0.95 : 0.65);
      this.contentLayer!.add(card);

      const seal = this.add.circle(x, compact ? 290 : 280, compact ? 58 : 64, isOwned ? 0xd4aa58 : 0x39414d, isOwned ? 0.92 : 0.7)
        .setStrokeStyle(5, isOwned ? 0xffe0a0 : 0x5c6572, 0.9);
      const core = this.add.circle(x, compact ? 290 : 280, compact ? 25 : 28, isOwned ? 0x6c5130 : 0x242a34, 0.95);
      this.contentLayer!.add(seal);
      this.contentLayer!.add(core);
      this.contentLayer!.add(addText(this, x, compact ? 290 : 280, isOwned ? '✓' : '?', compact ? 36 : 34, isOwned ? '#fff1bd' : '#747e8b', 'center').setOrigin(0.5));

      this.contentLayer!.add(addText(this, x, 205, `STAGE ${stageNumber}`, compact ? 20 : 15, isOwned ? '#d7bd82' : '#6f7987', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, compact ? 382 : 365, stage.treasure.name, compact ? 24 : 20, isOwned ? '#ffe19a' : '#8b939e', 'center').setOrigin(0.5).setWordWrapWidth(190));
      this.contentLayer!.add(addText(this, x, compact ? 445 : 425, stage.treasure.effect, compact ? 19 : 15, isOwned ? '#dce6d7' : '#6f7885', 'center').setOrigin(0.5).setWordWrapWidth(188));
      this.contentLayer!.add(addText(this, x, compact ? 520 : 505, isOwned ? '획득 완료' : '미획득', compact ? 20 : 14, isOwned ? '#8ee3aa' : '#7b8591', 'center').setOrigin(0.5));
      if (!compact) {
        this.contentLayer!.add(addText(this, x, 548, `${stage.name}\n첫 클리어 100% 확정`, 12, isOwned ? '#aab6c5' : '#687381', 'center').setOrigin(0.5).setWordWrapWidth(188));
      }
    });
  }

  private renderMedals(): void {
    const compact = isCompactMobileViewport();
    const start = this.page * MEDAL_PAGE_SIZE;
    const cleared = new Set(this.progress.specialClearedStageIds);
    const visible = SPECIAL_STAGES.slice(start, start + MEDAL_PAGE_SIZE);

    visible.forEach((stage, localIndex) => {
      const x = 145 + localIndex * 247;
      const specialNumber = getSpecialStageNumber(stage.id);
      const isCleared = cleared.has(stage.id);
      const card = this.add.rectangle(x, 398, 220, 430, isCleared ? 0x30283a : 0x1d222b, 0.98)
        .setStrokeStyle(3, isCleared ? 0xa879ba : 0x46505e, isCleared ? 0.95 : 0.65);
      this.contentLayer!.add(card);

      const outer = this.add.circle(x, compact ? 290 : 280, compact ? 58 : 64, isCleared ? 0x8f60a4 : 0x39414d, isCleared ? 0.92 : 0.7)
        .setStrokeStyle(5, isCleared ? 0xe4b7f2 : 0x5c6572, 0.9);
      const inner = this.add.circle(x, compact ? 290 : 280, compact ? 27 : 30, isCleared ? 0x493554 : 0x242a34, 0.95);
      this.contentLayer!.add(outer);
      this.contentLayer!.add(inner);
      this.contentLayer!.add(addText(this, x, compact ? 290 : 280, isCleared ? '★' : '?', compact ? 34 : 32, isCleared ? '#f3d5ff' : '#747e8b', 'center').setOrigin(0.5));

      this.contentLayer!.add(addText(this, x, 205, `SPECIAL ${specialNumber}`, compact ? 20 : 15, isCleared ? '#d6b5e3' : '#6f7987', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, compact ? 374 : 360, stage.treasure.name, compact ? 23 : 19, isCleared ? '#f1ceff' : '#8b939e', 'center').setOrigin(0.5).setWordWrapWidth(190));
      this.contentLayer!.add(addText(this, x, compact ? 435 : 418, stage.name, compact ? 20 : 15, isCleared ? '#d8ddea' : '#737c89', 'center').setOrigin(0.5).setWordWrapWidth(188));
      this.contentLayer!.add(addText(this, x, compact ? 482 : 462, `난이도 ${stage.difficulty} / 12`, compact ? 19 : 14, isCleared ? '#efb6ff' : '#707886', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, compact ? 528 : 510, isCleared ? '도전 완료' : '미획득', compact ? 20 : 14, isCleared ? '#8ee3aa' : '#7b8591', 'center').setOrigin(0.5));
      if (!compact) {
        this.contentLayer!.add(addText(this, x, 548, '전투 능력치 보너스 없음', 12, isCleared ? '#aa9bb5' : '#687381', 'center').setOrigin(0.5));
      }
    });
  }
}
