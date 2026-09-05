import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { loadActiveProgress } from './active-progress';
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
import { getOwnedCharacterIds, type GuestProgress } from './save';
import {
  addButton,
  addText,
  COLORS,
  drawBackdrop,
  setButtonState,
} from './scene-ui';
import { isCompactMobileViewport } from './viewport';

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

function addDossierCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: number,
  accent: number,
  active: boolean,
): Phaser.GameObjects.Container {
  const shadow = scene.add.rectangle(4, 5, width, height, 0x070a0f, 0.3);
  const paper = scene.add.rectangle(0, 0, width, height, fill, active ? 0.98 : 0.84);
  const spine = scene.add.rectangle(-width / 2 + 3, 0, 5, height - 14, accent, active ? 0.92 : 0.45);
  const rule = scene.add.rectangle(0, -height / 2 + 3, width - 12, 2, accent, active ? 0.5 : 0.24);
  return scene.add.container(x, y, [shadow, paper, spine, rule]);
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
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    const navigationHeight = compact ? 84 : 50;
    const tabHeight = compact ? 84 : 54;
    addText(this, 54, 34, '도 감', 44, COLORS.cream);
    if (!compact) addText(this, 56, 88, '획득한 동료와 실제로 조우한 적, 확보한 전과만 기록된다.', 18, COLORS.muted);
    const authorityText = addText(this, compact ? 1040 : 910, compact ? 112 : 102, '진행 불러오는 중…', compact ? 17 : 14, COLORS.dim, 'right').setOrigin(1, 0.5);
    addButton(this, 1165, compact ? 70 : 62, 160, navigationHeight, this.returnTo ? '스테이지' : '지휘소', () => this.exitCatalog(), 0x586275, { tone: 'quiet' });

    this.allyTab = addButton(this, 165, 135, 210, tabHeight, `동료 ${ALL_PLAYER_SLOTS.length}종`, () => this.setMode('ALLIES'), 0x6d91b5, { tone: 'quiet' });
    this.enemyTab = addButton(this, 405, 135, 210, tabHeight, `적 ${ENEMIES.length}종`, () => this.setMode('ENEMIES'), 0xb56d72, { tone: 'quiet' });
    this.rewardTab = addButton(this, 645, 135, 210, tabHeight, `영구 보상 ${STAGES.length}개`, () => this.setMode('REWARDS'), 0xb69755, { tone: 'quiet' });
    this.specialTab = addButton(this, 885, 135, 210, tabHeight, `특수 기록 ${SPECIAL_STAGES.length}개`, () => this.setMode('SPECIAL'), 0x9569a5, { tone: 'quiet' });
    addButton(this, 92, compact ? 660 : 664, 140, navigationHeight, '◀ 이전', () => this.changePage(-1), 0x586275, { tone: 'quiet' });
    addButton(this, 1188, compact ? 660 : 664, 140, navigationHeight, '다음 ▶', () => this.changePage(1), 0x586275, { tone: 'quiet' });
    this.pageText = addText(this, INTERNAL_WIDTH / 2, 652, '', compact ? 22 : 18, '#aab4c3', 'center').setOrigin(0.5);

    this.render();
    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      authorityText.setText(view.authority === 'GUEST_LOCAL'
        ? '게스트 · 로컬 기록'
        : view.authority === 'ACCOUNT_ONLINE'
          ? '계정 · 서버 기록'
          : '계정 · 오프라인 기록');
      authorityText.setColor(view.authority === 'ACCOUNT_ONLINE' ? COLORS.green : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : COLORS.dim);
      this.render();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      authorityText.setText(error instanceof Error ? error.message : '도감 진행을 읽지 못했습니다.').setColor(COLORS.red);
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
      ? '동료 명부'
      : this.mode === 'ENEMIES'
        ? '조우 기록'
        : this.mode === 'REWARDS'
          ? '영구 전과'
          : '특수 작전 기록';
    this.pageText?.setText(`${modeLabel} · ${this.page + 1} / ${this.getPageCount()}`);
    if (this.allyTab) setButtonState(this.allyTab, this.mode === 'ALLIES' ? 'selected' : 'default');
    if (this.enemyTab) setButtonState(this.enemyTab, this.mode === 'ENEMIES' ? 'selected' : 'default');
    if (this.rewardTab) setButtonState(this.rewardTab, this.mode === 'REWARDS' ? 'selected' : 'default');
    if (this.specialTab) setButtonState(this.specialTab, this.mode === 'SPECIAL' ? 'selected' : 'default');

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
      this.contentLayer!.add(addDossierCard(this, x, 398, 220, 430, owned ? 0x252c3a : 0x1d222b, border, owned));

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
        this.contentLayer!.add(addText(this, x, compact ? 400 : 376, `${slot.role} · ${slot.cost} 보급`, compact ? 21 : 14, COLORS.gold, 'center').setOrigin(0.5));
        this.contentLayer!.add(addText(this, x, compact ? 438 : 402, formatCombatTraits(slot.definition), compact ? 19 : 13, COLORS.blue, 'center').setOrigin(0.5));
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
      this.contentLayer!.add(addDossierCard(this, x, 398, 220, 430, discovered ? 0x30262a : 0x1d222b, border, discovered || focused));

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

      const categoryLabel = discovered ? (isBoss ? '우두머리' : '적') : '???';
      this.contentLayer!.add(addText(this, x - 96, 200, focused ? `▶ ${categoryLabel}` : categoryLabel, compact ? 20 : 15, focused ? '#ffe39a' : discovered ? (isBoss ? '#ff9b92' : '#d5a0a4') : '#69727e'));
      this.contentLayer!.add(addText(this, x, compact ? 360 : 342, discovered ? enemy.displayName : '???', compact ? 27 : 22, discovered ? '#ffffff' : '#747d89', 'center').setOrigin(0.5));

      if (discovered) {
        this.contentLayer!.add(addText(this, x, compact ? 400 : 376, `처치 보급 +${enemy.rewardSupply}`, compact ? 21 : 14, COLORS.gold, 'center').setOrigin(0.5));
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
      this.contentLayer!.add(addDossierCard(this, x, 398, 220, 430, isOwned ? 0x2a302f : 0x1d222b, isOwned ? 0xb79958 : 0x46505e, isOwned));

      const seal = this.add.circle(x, compact ? 290 : 280, compact ? 58 : 64, isOwned ? 0xd4aa58 : 0x39414d, isOwned ? 0.92 : 0.7)
        .setStrokeStyle(5, isOwned ? 0xffe0a0 : 0x5c6572, 0.9);
      const core = this.add.circle(x, compact ? 290 : 280, compact ? 25 : 28, isOwned ? 0x6c5130 : 0x242a34, 0.95);
      this.contentLayer!.add(seal);
      this.contentLayer!.add(core);
      this.contentLayer!.add(addText(this, x, compact ? 290 : 280, isOwned ? '✓' : '?', compact ? 36 : 34, isOwned ? '#fff1bd' : '#747e8b', 'center').setOrigin(0.5));

      this.contentLayer!.add(addText(this, x, 205, `전장 ${stageNumber}`, compact ? 20 : 15, isOwned ? '#d7bd82' : '#6f7987', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, compact ? 382 : 365, `영구 보상 #${String(stageNumber).padStart(2, '0')}`, compact ? 24 : 20, isOwned ? '#ffe19a' : '#8b939e', 'center').setOrigin(0.5).setWordWrapWidth(190));
      this.contentLayer!.add(addText(this, x, compact ? 445 : 425, getPermanentRewardEffectText(stage.permanentRewardId), compact ? 19 : 15, isOwned ? '#dce6d7' : '#6f7885', 'center').setOrigin(0.5).setWordWrapWidth(188));
      this.contentLayer!.add(addText(this, x, compact ? 520 : 505, isOwned ? '획득 완료' : '미획득', compact ? 20 : 14, isOwned ? COLORS.green : '#7b8591', 'center').setOrigin(0.5));
      if (!compact) this.contentLayer!.add(addText(this, x, 548, `${stage.name}\n첫 직접 클리어 시 확정`, 12, isOwned ? '#aab6c5' : '#687381', 'center').setOrigin(0.5).setWordWrapWidth(188));
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
      this.contentLayer!.add(addDossierCard(this, x, 398, 220, 430, isCleared ? 0x30283a : 0x1d222b, isCleared ? 0xa879ba : 0x46505e, isCleared));

      const outer = this.add.circle(x, compact ? 290 : 280, compact ? 58 : 64, isCleared ? 0x8f60a4 : 0x39414d, isCleared ? 0.92 : 0.7)
        .setStrokeStyle(5, isCleared ? 0xe4b7f2 : 0x5c6572, 0.9);
      const inner = this.add.circle(x, compact ? 290 : 280, compact ? 27 : 30, isCleared ? 0x493554 : 0x242a34, 0.95);
      this.contentLayer!.add(outer);
      this.contentLayer!.add(inner);
      this.contentLayer!.add(addText(this, x, compact ? 290 : 280, isCleared ? '★' : '?', compact ? 34 : 32, isCleared ? '#f3d5ff' : '#747e8b', 'center').setOrigin(0.5));

      this.contentLayer!.add(addText(this, x, 205, `특수 작전 ${specialNumber}`, compact ? 20 : 15, isCleared ? '#d6b5e3' : '#6f7987', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, compact ? 374 : 360, stage.name, compact ? 23 : 19, isCleared ? '#f1ceff' : '#8b939e', 'center').setOrigin(0.5).setWordWrapWidth(190));
      this.contentLayer!.add(addText(this, x, compact ? 435 : 418, '특수 작전 클리어 기록', compact ? 20 : 15, isCleared ? '#d8ddea' : '#737c89', 'center').setOrigin(0.5).setWordWrapWidth(188));
      this.contentLayer!.add(addText(this, x, compact ? 482 : 462, `난이도 ${stage.difficulty} / 12`, compact ? 19 : 14, isCleared ? '#efb6ff' : '#707886', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, compact ? 528 : 510, isCleared ? '도전 완료' : '미클리어', compact ? 20 : 14, isCleared ? COLORS.green : '#7b8591', 'center').setOrigin(0.5));
      if (!compact) this.contentLayer!.add(addText(this, x, 548, '메인 영구 성장과 별도 기록', 12, isCleared ? '#aa9bb5' : '#687381', 'center').setOrigin(0.5));
    });
  }
}
