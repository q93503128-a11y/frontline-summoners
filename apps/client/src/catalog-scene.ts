import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART, type UnitArtVariant } from './assets';
import { formatCombatTraits, formatDamageSpecialty } from './combat-trait-labels';
import { getPermanentRewardEffectText } from './permanent-reward-ui';
import {
  ALL_PLAYER_SLOTS,
  ENEMIES,
  SPECIAL_STAGES,
  STAGES,
  getSpecialStageNumber,
  getStageNumber,
} from './prototype';
import { getOwnedCharacterIds, loadGuestProgress, type GuestProgress } from './save';
import { isCompactMobileViewport } from './viewport';

const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], specialClearedStageIds: [], permanentRewardIds: [], discoveredEnemyIds: [] };
const ALLY_PAGE_SIZE = 5;
const ENEMY_PAGE_SIZE = 5;
const REWARD_PAGE_SIZE = 5;
const SPECIAL_PAGE_SIZE = 5;
const STORY_BADGE_COLOR = '#d7c79f';
const RARITY_BADGE_COLORS: Readonly<Record<string, string>> = {
  C: '#b4bbc5',
  B: '#7dc9a8',
  A: '#86bcea',
  S: '#c89be9',
  SS: '#ffd873',
};

type CatalogMode = 'ALLIES' | 'ENEMIES' | 'REWARDS' | 'SPECIAL';

interface CatalogReturnTarget {
  readonly scene: string;
  readonly data?: Record<string, unknown>;
}

interface CatalogSceneData {
  readonly mode?: CatalogMode;
  readonly focusEnemyId?: string;
  readonly returnTo?: CatalogReturnTarget;
}

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

function allyBadge(slot: (typeof ALL_PLAYER_SLOTS)[number]): { label: string; color: string } {
  if (slot.acquisitionClass === 'STORY') return { label: '스토리', color: STORY_BADGE_COLOR };
  const label = slot.rarity ?? '모집';
  return { label, color: RARITY_BADGE_COLORS[label] ?? '#d7c79f' };
}

function isCatalogMode(value: unknown): value is CatalogMode {
  return value === 'ALLIES' || value === 'ENEMIES' || value === 'REWARDS' || value === 'SPECIAL';
}

export class CatalogScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private mode: CatalogMode = 'ALLIES';
  private page = 0;
  private focusEnemyId: string | undefined;
  private returnTo: CatalogReturnTarget | undefined;
  private contentLayer?: Phaser.GameObjects.Container;
  private pageText?: Phaser.GameObjects.Text;
  private allyTab?: Phaser.GameObjects.Container;
  private enemyTab?: Phaser.GameObjects.Container;
  private rewardTab?: Phaser.GameObjects.Container;
  private specialTab?: Phaser.GameObjects.Container;

  constructor() {
    super('catalog');
  }

  init(data: CatalogSceneData = {}): void {
    this.progress = EMPTY_PROGRESS;
    this.mode = isCatalogMode(data.mode) ? data.mode : 'ALLIES';
    this.page = 0;
    this.focusEnemyId = typeof data.focusEnemyId === 'string' && ENEMIES.some((enemy) => enemy.enemyId === data.focusEnemyId)
      ? data.focusEnemyId
      : undefined;
    this.returnTo = data.returnTo;

    if (this.mode === 'ENEMIES' && this.focusEnemyId) {
      const index = ENEMIES.findIndex((enemy) => enemy.enemyId === this.focusEnemyId);
      if (index >= 0) this.page = Math.floor(index / ENEMY_PAGE_SIZE);
    }
  }

  create(): void {
    drawBackdrop(this);
    const compact = isCompactMobileViewport();
    const navigationHeight = compact ? 84 : 50;
    const tabHeight = compact ? 84 : 54;
    addText(this, 54, 34, '도 감', 44, '#fff4cf');
    if (!compact) addText(this, 56, 88, '획득 동료와 실제로 조우한 적만 상세 정보가 공개된다.', 18, '#b8c0ce');
    addButton(this, 1165, compact ? 70 : 62, 160, navigationHeight, this.returnTo ? '스테이지' : '메인', () => this.exitCatalog(), 0x586275);

    this.allyTab = addButton(this, 165, 135, 210, tabHeight, `동료 ${ALL_PLAYER_SLOTS.length}종`, () => this.setMode('ALLIES'), 0x6d91b5);
    this.enemyTab = addButton(this, 405, 135, 210, tabHeight, `적 ${ENEMIES.length}종`, () => this.setMode('ENEMIES'), 0xb56d72);
    this.rewardTab = addButton(this, 645, 135, 210, tabHeight, `영구 보상 ${STAGES.length}개`, () => this.setMode('REWARDS'), 0xb69755);
    this.specialTab = addButton(this, 885, 135, 210, tabHeight, `특수 기록 ${SPECIAL_STAGES.length}개`, () => this.setMode('SPECIAL'), 0x9569a5);
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

  private exitCatalog(): void {
    if (this.returnTo) {
      this.scene.start(this.returnTo.scene, this.returnTo.data ?? {});
      return;
    }
    this.scene.start('main-menu');
  }

  private setMode(mode: CatalogMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.page = 0;
    this.render();
  }

  private getPageCount(): number {
    if (this.mode === 'ALLIES') return Math.ceil(ALL_PLAYER_SLOTS.length / ALLY_PAGE_SIZE);
    if (this.mode === 'ENEMIES') return Math.ceil(ENEMIES.length / ENEMY_PAGE_SIZE);
    if (this.mode === 'REWARDS') return Math.ceil(STAGES.length / REWARD_PAGE_SIZE);
    return Math.ceil(SPECIAL_STAGES.length / SPECIAL_PAGE_SIZE);
  }

  private changePage(delta: number): void {
    this.page = Phaser.Math.Clamp(this.page + delta, 0, this.getPageCount() - 1);
    this.render();
  }

  private render(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = this.add.container(0, 0);
    this.page = Phaser.Math.Clamp(this.page, 0, Math.max(0, this.getPageCount() - 1));
    const modeLabel = this.mode === 'ALLIES'
      ? '동료'
      : this.mode === 'ENEMIES'
        ? '적'
        : this.mode === 'REWARDS'
          ? '영구 보상'
          : '특수 기록';
    this.pageText?.setText(`${modeLabel} · ${this.page + 1} / ${this.getPageCount()}`);
    this.allyTab?.setAlpha(this.mode === 'ALLIES' ? 1 : 0.62);
    this.enemyTab?.setAlpha(this.mode === 'ENEMIES' ? 1 : 0.62);
    this.rewardTab?.setAlpha(this.mode === 'REWARDS' ? 1 : 0.62);
    this.specialTab?.setAlpha(this.mode === 'SPECIAL' ? 1 : 0.62);

    if (this.mode === 'ALLIES') this.renderAllies();
    else if (this.mode === 'ENEMIES') this.renderEnemies();
    else if (this.mode === 'REWARDS') this.renderRewards();
    else this.renderSpecialRecords();
  }

  private renderAllies(): void {
    const compact = isCompactMobileViewport();
    const start = this.page * ALLY_PAGE_SIZE;
    const ownedIds = new Set(getOwnedCharacterIds(this.progress));
    const visible = ALL_PLAYER_SLOTS.slice(start, start + ALLY_PAGE_SIZE);

    visible.forEach((slot, localIndex) => {
      const x = 145 + localIndex * 247;
      const owned = ownedIds.has(slot.slotId);
      const badge = allyBadge(slot);
      const border = owned ? Phaser.Display.Color.HexStringToColor(badge.color).color : 0x46505e;
      const card = this.add.rectangle(x, 398, 220, 430, owned ? 0x252c3a : 0x1d222b, 0.98)
        .setStrokeStyle(3, border, owned ? 0.95 : 0.65);
      this.contentLayer!.add(card);

      const art = getArt(slot.definition.id);
      const portrait = this.add.sprite(x, compact ? 285 : 270, art.family.idle.key, 0);
      if (owned) {
        portrait.setTint(art.tint);
        portrait.setAlpha(1);
      } else {
        portrait.setTint(0x07080b);
        portrait.setTintFill();
        portrait.setAlpha(0.86);
      }
      portrait.setScale(((compact ? 132 : 145) / art.family.idle.frameHeight) * art.displayScale);
      this.contentLayer!.add(portrait);

      this.contentLayer!.add(addText(this, x - 96, 200, owned ? badge.label : '???', compact ? 20 : 15, owned ? badge.color : '#69727e'));
      this.contentLayer!.add(addText(this, x, compact ? 360 : 342, owned ? slot.displayName : '???', compact ? 27 : 22, owned ? '#ffffff' : '#747d89', 'center').setOrigin(0.5));

      if (owned) {
        this.contentLayer!.add(addText(this, x, compact ? 400 : 376, `${slot.role} · ${slot.cost} 보급`, compact ? 21 : 14, '#f2d37c', 'center').setOrigin(0.5));
        this.contentLayer!.add(addText(this, x, compact ? 438 : 402, formatCombatTraits(slot.definition), compact ? 19 : 13, '#9fcfff', 'center').setOrigin(0.5));
        const specialty = formatDamageSpecialty(slot.definition);
        if (specialty) this.contentLayer!.add(addText(this, x, compact ? 474 : 430, specialty, compact ? 19 : 13, '#ffd493', 'center').setOrigin(0.5));
        if (compact) {
          this.contentLayer!.add(addText(this, x, 532, `HP ${slot.definition.maxHp} · 공격 ${slot.definition.attackDamage}\n사거리 ${slot.definition.attackMaxRange}`, 18, '#aeb8c8', 'center').setOrigin(0.5).setWordWrapWidth(190));
        } else {
          this.contentLayer!.add(addText(this, x, specialty ? 466 : 440, slot.description, 13, '#bec7d5', 'center').setOrigin(0.5).setWordWrapWidth(188));
          this.contentLayer!.add(addText(this, x, 555, `HP ${slot.definition.maxHp}  ·  공격 ${slot.definition.attackDamage}\n사거리 ${slot.definition.attackMaxRange}  ·  재생산 ${(slot.rechargeFrames / 30).toFixed(1)}초`, 12, '#91a0b3', 'center').setOrigin(0.5).setWordWrapWidth(190));
        }
      } else {
        this.contentLayer!.add(addText(this, x, compact ? 425 : 415, '미획득', compact ? 22 : 15, '#707985', 'center').setOrigin(0.5));
        this.contentLayer!.add(addText(this, x, compact ? 486 : 470, '획득 후 정보 공개', compact ? 19 : 14, '#616b78', 'center').setOrigin(0.5));
      }
    });
  }

  private renderEnemies(): void {
    const compact = isCompactMobileViewport();
    const start = this.page * ENEMY_PAGE_SIZE;
    const discoveredIds = new Set(this.progress.discoveredEnemyIds ?? []);
    const visible = ENEMIES.slice(start, start + ENEMY_PAGE_SIZE);

    visible.forEach((enemy, localIndex) => {
      const x = 145 + localIndex * 247;
      const discovered = discoveredIds.has(enemy.enemyId);
      const focused = enemy.enemyId === this.focusEnemyId;
      const isBoss = (enemy.definition.combatTags ?? []).includes('BOSS');
      const border = focused ? 0xf0c967 : discovered ? (isBoss ? 0xc97772 : 0xa45f64) : 0x46505e;
      const card = this.add.rectangle(x, 398, 220, 430, discovered ? 0x30262a : 0x1d222b, 0.98)
        .setStrokeStyle(focused ? 5 : 3, border, focused ? 1 : discovered ? 0.95 : 0.65);
      this.contentLayer!.add(card);

      const art = getArt(enemy.definition.id);
      const portrait = this.add.sprite(x, compact ? 285 : 270, art.family.idle.key, 0);
      if (discovered) {
        portrait.setTint(art.tint);
        portrait.setAlpha(1);
      } else {
        portrait.setTint(0x07080b);
        portrait.setTintFill();
        portrait.setAlpha(0.86);
      }
      portrait.setScale(((compact ? 132 : 145) / art.family.idle.frameHeight) * art.displayScale);
      this.contentLayer!.add(portrait);

      const categoryLabel = discovered ? (isBoss ? 'BOSS' : 'ENEMY') : '???';
      this.contentLayer!.add(addText(this, x - 96, 200, focused ? `▶ ${categoryLabel}` : categoryLabel, compact ? 20 : 15, focused ? '#ffe39a' : discovered ? (isBoss ? '#ff9b92' : '#d5a0a4') : '#69727e'));
      this.contentLayer!.add(addText(this, x, compact ? 360 : 342, discovered ? enemy.displayName : '???', compact ? 27 : 22, discovered ? '#ffffff' : '#747d89', 'center').setOrigin(0.5));

      if (discovered) {
        this.contentLayer!.add(addText(this, x, compact ? 400 : 376, `처치 보급 +${enemy.rewardSupply}`, compact ? 21 : 14, '#f2d37c', 'center').setOrigin(0.5));
        this.contentLayer!.add(addText(this, x, compact ? 438 : 402, formatCombatTraits(enemy.definition), compact ? 19 : 13, '#ffb4ae', 'center').setOrigin(0.5));
        const specialty = formatDamageSpecialty(enemy.definition);
        if (specialty) this.contentLayer!.add(addText(this, x, compact ? 474 : 430, specialty, compact ? 19 : 13, '#ffd493', 'center').setOrigin(0.5));
        this.contentLayer!.add(addText(this, x, compact ? 532 : 520, `HP ${enemy.definition.maxHp} · 공격 ${enemy.definition.attackDamage}\n사거리 ${enemy.definition.attackMaxRange}`, compact ? 18 : 12, '#aeb8c8', 'center').setOrigin(0.5).setWordWrapWidth(190));
      } else {
        this.contentLayer!.add(addText(this, x, compact ? 425 : 415, '미발견', compact ? 22 : 15, '#707985', 'center').setOrigin(0.5));
        this.contentLayer!.add(addText(this, x, compact ? 486 : 470, '전투에서 조우하면 정보 공개', compact ? 19 : 14, '#616b78', 'center').setOrigin(0.5).setWordWrapWidth(188));
      }
    });
  }

  private renderRewards(): void {
    const compact = isCompactMobileViewport();
    const start = this.page * REWARD_PAGE_SIZE;
    const owned = new Set(this.progress.permanentRewardIds);
    const visible = STAGES.slice(start, start + REWARD_PAGE_SIZE);

    visible.forEach((stage, localIndex) => {
      const x = 145 + localIndex * 247;
      const stageNumber = getStageNumber(stage.id);
      const isOwned = !!stage.permanentRewardId && owned.has(stage.permanentRewardId);
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
      this.contentLayer!.add(addText(this, x, compact ? 382 : 365, `영구 보상 #${String(stageNumber).padStart(2, '0')}`, compact ? 24 : 20, isOwned ? '#ffe19a' : '#8b939e', 'center').setOrigin(0.5).setWordWrapWidth(190));
      this.contentLayer!.add(addText(this, x, compact ? 445 : 425, getPermanentRewardEffectText(stage.permanentRewardId), compact ? 19 : 15, isOwned ? '#dce6d7' : '#6f7885', 'center').setOrigin(0.5).setWordWrapWidth(188));
      this.contentLayer!.add(addText(this, x, compact ? 520 : 505, isOwned ? '획득 완료' : '미획득', compact ? 20 : 14, isOwned ? '#8ee3aa' : '#7b8591', 'center').setOrigin(0.5));
      if (!compact) this.contentLayer!.add(addText(this, x, 548, `${stage.name}\nNORMAL_CLEAR 첫 승리 시 확정`, 12, isOwned ? '#aab6c5' : '#687381', 'center').setOrigin(0.5).setWordWrapWidth(188));
    });
  }

  private renderSpecialRecords(): void {
    const compact = isCompactMobileViewport();
    const start = this.page * SPECIAL_PAGE_SIZE;
    const cleared = new Set(this.progress.specialClearedStageIds);
    const visible = SPECIAL_STAGES.slice(start, start + SPECIAL_PAGE_SIZE);

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
      this.contentLayer!.add(addText(this, x, compact ? 374 : 360, stage.name, compact ? 23 : 19, isCleared ? '#f1ceff' : '#8b939e', 'center').setOrigin(0.5).setWordWrapWidth(190));
      this.contentLayer!.add(addText(this, x, compact ? 435 : 418, '특수전 클리어 기록', compact ? 20 : 15, isCleared ? '#d8ddea' : '#737c89', 'center').setOrigin(0.5).setWordWrapWidth(188));
      this.contentLayer!.add(addText(this, x, compact ? 482 : 462, `난이도 ${stage.difficulty} / 12`, compact ? 19 : 14, isCleared ? '#efb6ff' : '#707886', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, compact ? 528 : 510, isCleared ? '도전 완료' : '미클리어', compact ? 20 : 14, isCleared ? '#8ee3aa' : '#7b8591', 'center').setOrigin(0.5));
      if (!compact) this.contentLayer!.add(addText(this, x, 548, '메인 영구 성장과 별도 기록', 12, isCleared ? '#aa9bb5' : '#687381', 'center').setOrigin(0.5));
    });
  }
}
