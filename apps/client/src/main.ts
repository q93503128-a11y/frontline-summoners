import Phaser from 'phaser';
import { APP_NAME, INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { SIM_TICK_MS, UnitState, type BattleUnit } from '@frontline/sim';
import {
  getBaseWeaponCooldownRemaining,
  getCooldownRemaining,
  getCurrentSupplyLevel,
  getNextSupplyLevel,
  stepPlayableBattle,
  tryFireBaseWeapon,
  trySpawnPlayerUnit,
  tryUpgradeSupply,
  type PlayableBattleState,
} from '@frontline/sim/playable';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART, type ArtFamily, type AttackFxStyle, type SpriteStrip } from './assets';
import { BATTLEFIELD_THEME_LABELS, drawBattlefield, getBattlefieldBasePalette } from './battlefield';
import { showBossArrival } from './boss-warning';
import { CatalogScene } from './catalog-scene';
import { classifyImpact, getAttackSpriteFrame, getLoopingSpriteFrame } from './combat-visuals';
import { formatCombatTraits, formatCompactTraits, formatDamageSpecialty } from './combat-trait-labels';
import { getProjectileArcOffsetY, getProjectileTravelPlan, usesTravelProjectile } from './projectile-visuals';
import {
  PLAYER_SLOTS,
  STAGES,
  createPrototypeBattle,
  getSlotById,
  getStage,
  getStageNumber,
  getUnlockStageForSlot,
  getUnlockedPlayerSlots,
  getUnlockedSlotIds,
  isStageUnlocked,
  type PrototypeRosterSlot,
  type PrototypeStage,
} from './prototype';
import { loadGuestProgress, recordStageClear, type GuestProgress } from './save';

const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const COLORS = {
  ink: 0x14171f,
  panel: 0x242936,
  panel2: 0x303746,
  line: 0x657086,
  cream: '#fff4cf',
  gold: '#f5cf68',
  blue: '#7ec8ff',
  green: '#8ee3aa',
  red: '#ff8d86',
  muted: '#b8c0ce',
};

const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], treasureIds: [] };
const rarityColor: Record<string, string> = {
  C: '#b9c2cf', B: '#8bd6a3', A: '#79baff', S: '#d79aff', SS: '#ffd56f',
};

function addText(scene: Phaser.Scene, x: number, y: number, text: string, size = 28, color = '#ffffff', align: 'left' | 'center' | 'right' = 'left'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    align,
    stroke: '#11151d',
    strokeThickness: size >= 30 ? 4 : 0,
  });
}

function addButton(scene: Phaser.Scene, x: number, y: number, width: number, height: number, label: string, onClick: () => void, accent = 0x59677f): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, height, 0x252b38, 0.98).setStrokeStyle(3, accent, 1);
  const shine = scene.add.rectangle(0, -height / 2 + 4, width - 8, 5, accent, 0.45);
  const text = addText(scene, 0, 0, label, Math.max(18, Math.floor(height * 0.3)), '#ffffff', 'center').setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, shine, text]);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => bg.setFillStyle(0x343c4d, 1));
  bg.on('pointerout', () => bg.setFillStyle(0x252b38, 0.98));
  bg.on('pointerdown', () => container.setScale(0.98));
  bg.on('pointerup', () => { container.setScale(1); onClick(); });
  return container;
}

function drawBackdrop(scene: Phaser.Scene, variant: 'menu' | 'map' = 'menu'): void {
  scene.cameras.main.setBackgroundColor('#171c27');
  const g = scene.add.graphics();
  g.fillStyle(0x171c27).fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
  g.fillStyle(variant === 'map' ? 0x26344a : 0x20283a, 1).fillCircle(1080, 130, 240);
  g.fillStyle(0x263247, 1).fillTriangle(0, 570, 330, 250, 630, 570);
  g.fillStyle(0x222d40, 1).fillTriangle(430, 570, 760, 200, 1080, 570);
  g.fillStyle(0x1f2939, 1).fillTriangle(870, 570, 1110, 300, 1280, 570);
  g.fillStyle(0x111722).fillRect(0, 570, INTERNAL_WIDTH, 150);
  if (variant === 'map') {
    g.lineStyle(5, 0x53627a, 0.5);
    for (let i = 0; i < 9; i += 1) {
      const x = 100 + i * 145;
      g.lineBetween(x, 485 - (i % 3) * 24, x + 80, 450 - ((i + 1) % 3) * 24);
      g.fillStyle(i % 2 === 0 ? 0x788aa5 : 0x64758f, 0.6).fillCircle(x, 485 - (i % 3) * 24, 7);
    }
  }
}

function familyForUnit(unitId: string): { family: ArtFamily; tint: number; displayScale: number; attackFx: AttackFxStyle } {
  const variant = UNIT_ART[unitId] ?? { familyId: 'warrior', tint: 0xffffff, attackFx: 'SLASH' as const };
  const family = ART_BY_ID[variant.familyId] ?? ART_FAMILIES[0]!;
  return { family, tint: variant.tint, displayScale: variant.displayScale ?? 1, attackFx: variant.attackFx };
}

class BootScene extends Phaser.Scene {
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

class MainMenuScene extends Phaser.Scene {
  constructor() { super('main-menu'); }

  create(): void {
    drawBackdrop(this, 'menu');
    addText(this, 84, 84, '전선소환전', 70, COLORS.cream);
    addText(this, 88, 165, APP_NAME, 24, '#9fb0c6');
    addText(this, 88, 230, '별난 영웅들을 모아 전선을 밀어붙여라.', 29, '#e8edf6');
    addText(this, 88, 272, '첫 출정은 징집병 하나. 승리할수록 전선과 동료가 열린다.', 22, COLORS.muted);

    this.add.rectangle(1040, 105, 320, 110, 0x222936, 0.96).setStrokeStyle(2, 0x556077);
    addText(this, 900, 72, '게스트 지휘관', 26, '#ffffff');
    const progressText = addText(this, 900, 110, '진행도 불러오는 중…', 18, COLORS.muted);

    addButton(this, 230, 435, 310, 92, '출 정', () => this.scene.start('stage-select'), 0xc5a04c);
    addButton(this, 575, 435, 310, 92, '편 성', () => this.scene.start('deck'), 0x5f8fb8);
    addButton(this, 920, 435, 310, 92, '도 감', () => this.scene.start('catalog'), 0x8c7650);
    addText(this, 88, 628, '보물 첫 클리어 100% · 스테이지 순차 개방 · 에너지 제한 없음', 20, '#9cd6ad');
    addText(this, 1185, 675, 'PRE-ALPHA', 17, '#657086').setOrigin(1, 0.5);

    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      const unlocked = getUnlockedPlayerSlots(progress.clearedStageIds).length;
      progressText.setText(`클리어 ${progress.clearedStageIds.length}/${STAGES.length} · 보물 ${progress.treasureIds.length}/${STAGES.length} · 동료 ${unlocked}/${PLAYER_SLOTS.length}`);
    });
  }
}

class StageSelectScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private page = 0;
  private stageLayer?: Phaser.GameObjects.Container;
  private pageText?: Phaser.GameObjects.Text;

  constructor() { super('stage-select'); }

  create(): void {
    drawBackdrop(this, 'map');
    addText(this, 54, 38, '제1장 · 뒤집힌 국경', 42, COLORS.cream);
    addText(this, 56, 91, '20개 전장 · 5개씩 보기', 19, COLORS.muted);
    addButton(this, 1165, 65, 160, 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    addButton(this, 72, 655, 115, 52, '◀ 이전', () => { this.page = Math.max(0, this.page - 1); this.renderPage(); }, 0x586275);
    addButton(this, 1208, 655, 115, 52, '다음 ▶', () => { this.page = Math.min(Math.ceil(STAGES.length / 5) - 1, this.page + 1); this.renderPage(); }, 0x586275);
    this.pageText = addText(this, INTERNAL_WIDTH / 2, 640, '', 18, '#9ca9bb', 'center').setOrigin(0.5);

    this.renderPage();
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      const firstUncleared = STAGES.findIndex((stage) => !progress.clearedStageIds.includes(stage.id));
      if (firstUncleared >= 0) this.page = Math.floor(firstUncleared / 5);
      this.renderPage();
    });
  }

  private renderPage(): void {
    this.stageLayer?.destroy(true);
    this.stageLayer = this.add.container(0, 0);
    const start = this.page * 5;
    const visible = STAGES.slice(start, start + 5);
    this.pageText?.setText(`${this.page + 1} / ${Math.ceil(STAGES.length / 5)}`);

    visible.forEach((stage, localIndex) => {
      const index = start + localIndex;
      const x = 145 + localIndex * 247;
      const unlocked = isStageUnlocked(stage.id, this.progress.clearedStageIds);
      const cleared = this.progress.clearedStageIds.includes(stage.id);
      const treasureOwned = this.progress.treasureIds.includes(stage.treasure.id);
      const border = unlocked ? (index === STAGES.length - 1 ? 0xbf9252 : 0x596c86) : 0x3c4554;
      const card = this.add.rectangle(x, 360, 220, 445, unlocked ? 0x242b3a : 0x1d222c, 0.98).setStrokeStyle(3, border, 1);
      this.stageLayer!.add(card);
      this.stageLayer!.add(addText(this, x, 160, `STAGE ${index + 1}`, 16, unlocked ? '#8998ad' : '#5f6978', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, 202, stage.name, 25, unlocked ? '#ffffff' : '#747d89', 'center').setOrigin(0.5).setWordWrapWidth(195));
      const stars = '★'.repeat(stage.difficulty) + '☆'.repeat(Math.max(0, 5 - stage.difficulty));
      this.stageLayer!.add(addText(this, x, 246, stars, 17, unlocked ? COLORS.gold : '#5e6470', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, 282, BATTLEFIELD_THEME_LABELS[stage.theme], 16, unlocked ? '#9ec5d7' : '#606874', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, 310, `전장 ${stage.mapLength}m`, 14, unlocked ? '#aeb8c8' : '#59616d', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, 346, stage.subtitle, 14, unlocked ? '#c4cbd7' : '#626a76', 'center').setOrigin(0.5).setWordWrapWidth(194));
      this.stageLayer!.add(addText(this, x, 401, cleared ? '✓ 클리어' : unlocked ? '미클리어' : '잠김', 17, cleared ? '#8ee3aa' : unlocked ? '#a3adbb' : '#6b7480', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, 434, '확정 보물', 14, unlocked ? '#8dd9a8' : '#596a60', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, 458, treasureOwned ? `✓ ${stage.treasure.name}` : stage.treasure.name, 14, treasureOwned ? '#9fe4b5' : unlocked ? '#f2d37c' : '#6d6858', 'center').setOrigin(0.5).setWordWrapWidth(196));

      if (stage.unlockUnitId) {
        const slot = getSlotById(stage.unlockUnitId);
        if (slot) this.stageLayer!.add(addText(this, x, 503, `첫 클리어 동료 · ${slot.displayName}`, 14, cleared ? '#8ee3aa' : unlocked ? '#a8cfff' : '#59616d', 'center').setOrigin(0.5));
      }

      const button = addButton(this, x, 548, 174, 52, unlocked ? '전투 시작' : '이전 스테이지 필요', () => {
        if (unlocked) this.scene.start('battle', { stageId: stage.id });
        else this.cameras.main.shake(70, 0.0015);
      }, unlocked ? (index === STAGES.length - 1 ? 0xbf9252 : 0x5e7ea0) : 0x3f4855);
      if (!unlocked) button.setAlpha(0.62);
      this.stageLayer!.add(button);
    });
  }
}

class DeckScene extends Phaser.Scene {
  private cardsLayer?: Phaser.GameObjects.Container;
  private header?: Phaser.GameObjects.Text;

  constructor() { super('deck'); }

  create(): void {
    drawBackdrop(this, 'map');
    this.header = addText(this, 60, 42, '편성 불러오는 중…', 38, COLORS.cream);
    addText(this, 62, 92, '처음에는 징집병 1종만 보유한다. 캠페인 첫 클리어 보상으로 동료가 순서대로 합류한다.', 18, COLORS.muted);
    addButton(this, 1165, 65, 160, 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.renderRoster(progress);
    });
  }

  private renderRoster(progress: GuestProgress): void {
    this.cardsLayer?.destroy(true);
    this.cardsLayer = this.add.container(0, 0);
    const unlockedIds = new Set(getUnlockedSlotIds(progress.clearedStageIds));
    this.header?.setText(`현재 보유 · ${unlockedIds.size} / ${PLAYER_SLOTS.length}   ·   자동 편성 ${unlockedIds.size} / 10`);

    PLAYER_SLOTS.forEach((slot, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = 148 + col * 248;
      const y = 280 + row * 260;
      const unlocked = unlockedIds.has(slot.slotId);
      const border = unlocked ? Phaser.Display.Color.HexStringToColor(rarityColor[slot.rarity] ?? '#ffffff').color : 0x4a5260;
      const card = this.add.rectangle(x, y, 220, 244, unlocked ? 0x252c3a : 0x1d222b, 0.98).setStrokeStyle(3, border, unlocked ? 0.85 : 0.65);
      this.cardsLayer!.add(card);
      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x, y - 58, art.family.idle.key, 0).setTint(unlocked ? art.tint : 0x30343c).setAlpha(unlocked ? 1 : 0.5);
      portrait.setScale((152 / art.family.idle.frameHeight) * art.displayScale);
      this.cardsLayer!.add(portrait);
      this.cardsLayer!.add(addText(this, x - 94, y - 102, unlocked ? slot.rarity : 'LOCK', 15, unlocked ? (rarityColor[slot.rarity] ?? '#ffffff') : '#656d78'));
      this.cardsLayer!.add(addText(this, x, y + 4, unlocked ? slot.displayName : '미해금', 22, unlocked ? '#ffffff' : '#78818d', 'center').setOrigin(0.5));
      if (unlocked) {
        this.cardsLayer!.add(addText(this, x, y + 34, `${slot.role} · ${slot.cost} 보급`, 15, '#f2d37c', 'center').setOrigin(0.5));
        this.cardsLayer!.add(addText(this, x, y + 57, formatCombatTraits(slot.definition), 13, '#9fcfff', 'center').setOrigin(0.5));
        const specialty = formatDamageSpecialty(slot.definition);
        if (specialty) this.cardsLayer!.add(addText(this, x, y + 78, specialty, 12, '#ffd493', 'center').setOrigin(0.5));
        this.cardsLayer!.add(addText(this, x, y + (specialty ? 103 : 84), slot.description, 11, '#b9c2d0', 'center').setOrigin(0.5).setWordWrapWidth(190));
      } else {
        const unlockStage = getUnlockStageForSlot(slot.slotId);
        const requirement = unlockStage ? `STAGE ${getStageNumber(unlockStage.id)} 첫 클리어\n${unlockStage.name}` : '캠페인 진행으로 해금';
        this.cardsLayer!.add(addText(this, x, y + 46, requirement, 14, '#727c89', 'center').setOrigin(0.5).setWordWrapWidth(190));
      }
    });
  }
}

interface UnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly hpBg: Phaser.GameObjects.Rectangle;
  readonly hp: Phaser.GameObjects.Rectangle;
  readonly trait: Phaser.GameObjects.Text;
  stateKey: string;
  lastHp: number;
  lastAttackFxKey: string;
}

interface ProjectileView {
  readonly body: Phaser.GameObjects.Container;
  readonly style: AttackFxStyle;
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly startTick: number;
  readonly endTick: number;
}

interface UnitButtonView {
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly shade: Phaser.GameObjects.Rectangle;
  readonly cooldown: Phaser.GameObjects.Text;
  readonly cost: Phaser.GameObjects.Text;
}

class BattleScene extends Phaser.Scene {
  private state!: PlayableBattleState;
  private stage!: PrototypeStage;
  private activeSlots: readonly PrototypeRosterSlot[] = [];
  private accumulator = 0;
  private views = new Map<number, UnitView>();
  private buttons = new Map<string, UnitButtonView>();
  private projectiles: ProjectileView[] = [];
  private seenBossSimulationIds = new Set<number>();
  private supplyText!: Phaser.GameObjects.Text;
  private supplyBar!: Phaser.GameObjects.Rectangle;
  private supplyLevelText!: Phaser.GameObjects.Text;
  private supplyUpgradeText!: Phaser.GameObjects.Text;
  private baseWeaponText!: Phaser.GameObjects.Text;
  private baseWeaponBg!: Phaser.GameObjects.Rectangle;
  private playerBaseBar!: Phaser.GameObjects.Rectangle;
  private enemyBaseBar!: Phaser.GameObjects.Rectangle;
  private playerBaseText!: Phaser.GameObjects.Text;
  private enemyBaseText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private lastPlayerBaseHp = 0;
  private lastEnemyBaseHp = 0;
  private ready = false;
  private resolved = false;

  constructor() { super('battle'); }

  init(data: { stageId?: string }): void {
    this.stage = getStage(data.stageId ?? STAGES[0]!.id);
    this.accumulator = 0;
    this.ready = false;
    this.resolved = false;
    this.lastPlayerBaseHp = 0;
    this.lastEnemyBaseHp = 0;
    this.views.clear();
    this.buttons.clear();
    this.projectiles = [];
    this.seenBossSimulationIds.clear();
    this.activeSlots = [];
  }

  create(): void {
    drawBattlefield(this, this.stage);
    const loading = addText(this, INTERNAL_WIDTH / 2, 330, '편성과 전장 불러오는 중…', 25, '#ffffff', 'center').setOrigin(0.5);
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      if (!isStageUnlocked(this.stage.id, progress.clearedStageIds)) {
        this.scene.start('stage-select');
        return;
      }
      this.activeSlots = getUnlockedPlayerSlots(progress.clearedStageIds);
      this.state = createPrototypeBattle(this.stage.id, this.activeSlots.map((slot) => slot.slotId), progress.treasureIds);
      this.lastPlayerBaseHp = this.state.battle.bases.PLAYER.hp;
      this.lastEnemyBaseHp = this.state.battle.bases.ENEMY.hp;
      loading.destroy();
      this.drawHud();
      this.drawBases();
      this.drawUnitButtons();
      this.ready = true;
      this.syncHud();
    });
  }

  update(_: number, delta: number): void {
    if (!this.ready || this.resolved) return;
    this.accumulator += Math.min(delta, 120);
    while (this.accumulator >= SIM_TICK_MS && this.state.battle.winner === null) {
      this.syncProjectileLaunches();
      stepPlayableBattle(this.state);
      this.accumulator -= SIM_TICK_MS;
    }
    this.syncBossWarnings();
    this.syncProjectileViews();
    this.syncUnits();
    this.syncHud();
    if (this.state.battle.winner !== null) {
      this.resolved = true;
      this.time.delayedCall(700, () => this.scene.start('result', { stageId: this.stage.id, winner: this.state.battle.winner }));
    }
  }

  private syncBossWarnings(): void {
    for (const unit of this.state.battle.units) {
      if (unit.team !== 'ENEMY' || unit.state === UnitState.Dying) continue;
      if (!(unit.definition.traits ?? []).includes('BOSS')) continue;
      if (this.seenBossSimulationIds.has(unit.simulationId)) continue;
      this.seenBossSimulationIds.add(unit.simulationId);
      const enemy = this.state.enemies.find((candidate) => candidate.definition.id === unit.definition.id);
      showBossArrival(this, enemy?.displayName ?? '우두머리');
    }
  }

  private drawHud(): void {
    this.add.rectangle(INTERNAL_WIDTH / 2, 53, INTERNAL_WIDTH, 106, 0x151a24, 0.95);
    addText(this, 35, 16, this.stage.name, 28, '#ffffff');
    addText(this, 36, 56, `${this.stage.chapter} · ${BATTLEFIELD_THEME_LABELS[this.stage.theme]} · ${this.stage.mapLength}m`, 15, '#aeb8c8');
    this.timerText = addText(this, 625, 25, '0:00', 23, '#dbe2ee', 'center').setOrigin(0.5, 0);

    addText(this, 760, 18, '보급', 17, '#d7ddea');
    this.add.rectangle(930, 56, 300, 22, 0x0d1118).setStrokeStyle(2, 0x67738b);
    this.supplyBar = this.add.rectangle(782, 56, 1, 14, 0xe9c965).setOrigin(0, 0.5);
    this.supplyText = addText(this, 1084, 20, '', 21, '#f4d577', 'right').setOrigin(1, 0);
    this.supplyLevelText = addText(this, 760, 68, '', 17, '#b9c4d4');
  }

  private drawBases(): void {
    const palette = getBattlefieldBasePalette(this.stage);
    const g = this.add.graphics();
    g.fillStyle(palette.player).fillRect(42, 360, 92, 184);
    g.fillStyle(palette.playerRoof).fillTriangle(35, 360, 88, 310, 141, 360);
    g.fillStyle(0x36475e).fillRect(75, 476, 28, 68);
    g.fillStyle(palette.enemy).fillRect(1146, 360, 92, 184);
    g.fillStyle(palette.enemyRoof).fillTriangle(1139, 360, 1192, 310, 1245, 360);
    g.fillStyle(0x55383a).fillRect(1179, 476, 28, 68);

    if (this.stage.theme === 'fortress' || this.stage.theme === 'golden') {
      g.fillStyle(palette.playerRoof, 0.9).fillRect(50, 340, 18, 30).fillRect(108, 340, 18, 30);
      g.fillStyle(palette.enemyRoof, 0.9).fillRect(1154, 340, 18, 30).fillRect(1212, 340, 18, 30);
    }

    addText(this, 42, 286, '아군 거점', 16, '#cfe5ff');
    addText(this, 1238, 286, '적 거점', 16, '#ffd3cc', 'right').setOrigin(1, 0);
    this.add.rectangle(88, 328, 156, 16, 0x161b23).setStrokeStyle(2, 0x7990aa);
    this.add.rectangle(1192, 328, 156, 16, 0x161b23).setStrokeStyle(2, 0xaa716c);
    this.playerBaseBar = this.add.rectangle(12, 328, 152, 10, 0x74c7ff).setOrigin(0, 0.5);
    this.enemyBaseBar = this.add.rectangle(1116, 328, 152, 10, 0xff8f82).setOrigin(0, 0.5);
    this.playerBaseText = addText(this, 88, 340, '', 16, '#e8f5ff', 'center').setOrigin(0.5, 0);
    this.enemyBaseText = addText(this, 1192, 340, '', 16, '#ffe6e1', 'center').setOrigin(0.5, 0);
  }

  private drawUnitButtons(): void {
    this.add.rectangle(INTERNAL_WIDTH / 2, 630, INTERNAL_WIDTH, 180, 0x151a24, 0.98);
    const activeIds = new Set(this.activeSlots.map((slot) => slot.slotId));

    PLAYER_SLOTS.forEach((slot, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const x = 102 + col * 205;
      const y = 579 + row * 72;
      const unlocked = activeIds.has(slot.slotId);
      const border = unlocked ? Phaser.Display.Color.HexStringToColor(rarityColor[slot.rarity] ?? '#ffffff').color : 0x454e5b;
      const bg = this.add.rectangle(x, y, 188, 62, unlocked ? 0x28303e : 0x1c222c).setStrokeStyle(2, border, 0.85);
      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x - 69, y, art.family.idle.key, 0).setTint(unlocked ? art.tint : 0x343840).setAlpha(unlocked ? 1 : 0.45).setDepth(4);
      portrait.setScale((50 / art.family.idle.frameHeight) * art.displayScale);

      if (!unlocked) {
        addText(this, x - 43, y - 22, '미해금', 14, '#7c8490').setDepth(5);
        const unlockStage = getUnlockStageForSlot(slot.slotId);
        addText(this, x - 43, y + 2, unlockStage ? `ST.${getStageNumber(unlockStage.id)} 클리어` : '잠김', 12, '#626b77').setDepth(5);
        return;
      }

      bg.setInteractive({ useHandCursor: true });
      const shade = this.add.rectangle(x, y, 188, 62, 0x05070b, 0).setDepth(6);
      addText(this, x - 43, y - 25, `${slot.rarity} · ${slot.displayName}`, 14, '#ffffff').setDepth(5);
      const cost = addText(this, x - 43, y + 2, `${slot.cost} 보급`, 14, '#f2d37c').setDepth(5);
      const cooldown = addText(this, x + 82, y + 2, '', 13, '#d8e1ef', 'right').setOrigin(1, 0).setDepth(7);
      bg.on('pointerdown', () => {
        const result = trySpawnPlayerUnit(this.state, slot.slotId);
        if (!result.ok) this.cameras.main.shake(55, 0.0012);
      });
      this.buttons.set(slot.slotId, { bg, shade, cooldown, cost });
    });

    const upgradeBg = this.add.rectangle(1145, 580, 220, 60, 0x302a1c).setStrokeStyle(3, 0xc59d4b).setInteractive({ useHandCursor: true });
    this.supplyUpgradeText = addText(this, 1145, 570, '', 16, '#ffe29a', 'center').setOrigin(0.5);
    addText(this, 1145, 594, '보급소 강화', 15, '#ffffff', 'center').setOrigin(0.5);
    upgradeBg.on('pointerdown', () => {
      const result = tryUpgradeSupply(this.state);
      if (!result.ok) this.cameras.main.shake(55, 0.0012);
    });

    this.baseWeaponBg = this.add.rectangle(1145, 651, 220, 60, 0x26394a).setStrokeStyle(3, 0x72b7db).setInteractive({ useHandCursor: true });
    this.baseWeaponText = addText(this, 1145, 651, '전선포 · 발사 가능', 16, '#bfe8ff', 'center').setOrigin(0.5);
    this.baseWeaponBg.on('pointerdown', () => {
      const result = tryFireBaseWeapon(this.state);
      if (!result.ok) {
        this.cameras.main.shake(55, 0.0012);
        return;
      }
      this.playBaseWeaponFx();
    });
  }

  private playBaseWeaponFx(): void {
    const muzzle = this.add.circle(130, 452, 24, 0xffe69a, 0.9).setDepth(20);
    const beam = this.add.rectangle(650, 452, 1010, 16, 0xffe69a, 0.88).setDepth(19);
    const core = this.add.rectangle(650, 452, 1010, 5, 0xffffff, 0.95).setDepth(20);
    this.cameras.main.shake(110, 0.0024);
    this.tweens.add({
      targets: [muzzle, beam, core],
      alpha: 0,
      duration: 230,
      ease: 'Quad.easeOut',
      onComplete: () => { muzzle.destroy(); beam.destroy(); core.destroy(); },
    });
  }

  private toScreenX(anchorX: number): number {
    const left = 112;
    const right = 1168;
    return left + (anchorX / this.state.battle.mapLength) * (right - left);
  }

  private createUnitView(unit: BattleUnit): UnitView {
    const art = familyForUnit(unit.definition.id);
    const x = this.toScreenX(unit.anchorX);
    const shadow = this.add.ellipse(x, 524, 58 * Math.min(1.45, art.displayScale), 12, 0x101216, 0.34).setDepth(2);
    const sprite = this.add.sprite(x, 490, art.family.run.key, 0).setTint(art.tint).setDepth(3);
    sprite.setFlipX(unit.team === 'ENEMY');
    sprite.setScale((art.family.displayHeight / art.family.run.frameHeight) * art.displayScale);
    const hpBg = this.add.rectangle(sprite.x, 443, 54, 7, 0x161a21).setDepth(5);
    const hp = this.add.rectangle(sprite.x - 26, 443, 52, 5, unit.team === 'PLAYER' ? 0x78dca0 : 0xf1837c).setOrigin(0, 0.5).setDepth(6);
    const trait = addText(this, sprite.x, 425, unit.team === 'ENEMY' ? formatCompactTraits(unit.definition) : '', 11, '#ffd0c8', 'center').setOrigin(0.5).setDepth(7);

    const spawn = this.add.ellipse(x, 519, 34, 9, unit.team === 'PLAYER' ? 0x9cd7ff : 0xffa39b, 0.42).setDepth(2);
    this.tweens.add({
      targets: spawn,
      alpha: 0,
      scaleX: 2.1,
      scaleY: 1.5,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => spawn.destroy(),
    });

    return { sprite, shadow, hpBg, hp, trait, stateKey: '', lastHp: unit.hp, lastAttackFxKey: '' };
  }

  private getProjectileTargetScreenX(unit: BattleUnit): number {
    const direction = unit.team === 'PLAYER' ? 1 : -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestAnchor: number | null = null;
    for (const target of this.state.battle.units) {
      if (target.team === unit.team || target.state === UnitState.Dying || target.state === UnitState.NaturalKnockback) continue;
      const distance = direction * (target.anchorX - unit.anchorX);
      if (distance < unit.definition.attackMinRange || distance > unit.definition.attackMaxRange) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestAnchor = target.anchorX;
      }
    }
    const enemyBase = this.state.battle.bases[unit.team === 'PLAYER' ? 'ENEMY' : 'PLAYER'];
    const baseDistance = direction * (enemyBase.anchorX - unit.anchorX);
    if (enemyBase.hp > 0 && baseDistance >= unit.definition.attackMinRange && baseDistance <= unit.definition.attackMaxRange && baseDistance < bestDistance) {
      bestAnchor = enemyBase.anchorX;
    }
    if (bestAnchor === null) {
      const fallbackDistance = Math.max(unit.definition.attackMinRange, Math.min(unit.definition.standingRange, unit.definition.attackMaxRange));
      bestAnchor = Math.max(0, Math.min(this.state.battle.mapLength, unit.anchorX + direction * fallbackDistance));
    }
    return this.toScreenX(bestAnchor);
  }

  private createProjectileBody(style: AttackFxStyle, direction: 1 | -1, x: number, y: number): Phaser.GameObjects.Container {
    const body = this.add.container(x, y).setDepth(16);
    if (style === 'PIERCE') {
      body.add(this.add.rectangle(0, 0, 34, 4, 0xe8f9ff, 0.96));
      body.add(this.add.triangle(direction * 20, 0, -7 * direction, -6, -7 * direction, 6, 8 * direction, 0, 0xffffff, 0.98));
    } else if (style === 'FIRE') {
      body.add(this.add.circle(0, 0, 15, 0xff704f, 0.48));
      body.add(this.add.circle(direction * 2, 0, 8, 0xffdf78, 0.96));
    } else if (style === 'VOID') {
      body.add(this.add.circle(0, 0, 16, 0x4f3b82, 0.4).setStrokeStyle(3, 0xb99cff, 0.92));
      body.add(this.add.circle(0, 0, 6, 0xe4d8ff, 0.9));
    } else {
      body.add(this.add.circle(0, 0, 13, 0x70bfff, 0.35).setStrokeStyle(3, 0xccecff, 0.9));
      body.add(this.add.circle(0, 0, 5, 0xffffff, 0.96));
    }
    return body;
  }

  private syncProjectileLaunches(): void {
    for (const unit of this.state.battle.units) {
      if (unit.state !== UnitState.Foreswing) continue;
      const art = familyForUnit(unit.definition.id);
      if (!usesTravelProjectile(art.attackFx)) continue;
      let view = this.views.get(unit.simulationId);
      if (!view) {
        view = this.createUnitView(unit);
        this.views.set(unit.simulationId, view);
      }
      const firstHitFrame = unit.definition.attackTiming.hitFrames[0];
      if (firstHitFrame === undefined) continue;
      const direction: 1 | -1 = unit.team === 'PLAYER' ? 1 : -1;
      const startX = this.toScreenX(unit.anchorX) + direction * 28;
      const startY = 482;
      const endX = this.getProjectileTargetScreenX(unit);
      const endY = 482;
      const plan = getProjectileTravelPlan(art.attackFx, firstHitFrame, Math.abs(endX - startX));
      if (!plan || unit.stateFrame !== plan.launchFrame) continue;
      const launchKey = `projectile:${unit.nextAttackTick}:${plan.launchFrame}`;
      if (view.lastAttackFxKey === launchKey) continue;
      this.playAttackFx(unit, view, art.attackFx);
      const body = this.createProjectileBody(art.attackFx, direction, startX, startY);
      this.projectiles.push({
        body,
        style: art.attackFx,
        startX,
        startY,
        endX,
        endY,
        startTick: this.state.battle.tick,
        endTick: this.state.battle.tick + plan.travelTicks,
      });
      view.lastAttackFxKey = launchKey;
    }
  }

  private syncProjectileViews(): void {
    const active: ProjectileView[] = [];
    const fractionalTick = Math.max(0, Math.min(1, this.accumulator / SIM_TICK_MS));
    const renderTick = this.state.battle.tick + fractionalTick;
    for (const projectile of this.projectiles) {
      const span = Math.max(1, projectile.endTick - projectile.startTick);
      const progress = Math.max(0, Math.min(1, (renderTick - projectile.startTick) / span));
      projectile.body.x = projectile.startX + (projectile.endX - projectile.startX) * progress;
      projectile.body.y = projectile.startY + (projectile.endY - projectile.startY) * progress + getProjectileArcOffsetY(projectile.style, progress);
      projectile.body.setAlpha(progress > 0.88 ? Math.max(0.35, (1 - progress) / 0.12) : 1);
      if (progress >= 1) {
        projectile.body.destroy();
      } else {
        active.push(projectile);
      }
    }
    this.projectiles = active;
  }

  private playAttackFx(unit: BattleUnit, view: UnitView, style: AttackFxStyle): void {
    const direction = unit.team === 'PLAYER' ? 1 : -1;
    const x = view.sprite.x + direction * 38;
    const y = view.sprite.y - 8;

    if (style === 'SLASH') {
      const slashA = this.add.rectangle(x, y, 48, 5, 0xfff6d2, 0.9).setAngle(direction > 0 ? -36 : 36).setDepth(14);
      const slashB = this.add.rectangle(x + direction * 7, y + 7, 30, 3, 0xffffff, 0.72).setAngle(direction > 0 ? 24 : -24).setDepth(14);
      this.tweens.add({ targets: [slashA, slashB], alpha: 0, scaleX: 1.45, duration: 130, ease: 'Quad.easeOut', onComplete: () => { slashA.destroy(); slashB.destroy(); } });
      return;
    }

    if (style === 'PIERCE') {
      const line = this.add.rectangle(x + direction * 18, y, 72, 4, 0xdff7ff, 0.92).setDepth(14);
      const tip = this.add.triangle(x + direction * 57, y, -8 * direction, -7, -8 * direction, 7, 9 * direction, 0, 0xffffff, 0.95).setDepth(15);
      this.tweens.add({ targets: [line, tip], alpha: 0, scaleX: 1.3, duration: 120, ease: 'Quad.easeOut', onComplete: () => { line.destroy(); tip.destroy(); } });
      return;
    }

    if (style === 'BLUNT') {
      const shock = this.add.circle(x, y + 7, 18, 0xffe4a8, 0.26).setStrokeStyle(4, 0xfff0c9, 0.85).setDepth(14);
      const dust = this.add.ellipse(x, y + 24, 54, 13, 0xdcc9a6, 0.36).setDepth(13);
      this.tweens.add({ targets: [shock, dust], alpha: 0, scaleX: 1.8, scaleY: 1.45, duration: 165, ease: 'Quad.easeOut', onComplete: () => { shock.destroy(); dust.destroy(); } });
      return;
    }

    if (style === 'FIRE') {
      const core = this.add.circle(x + direction * 17, y - 2, 13, 0xffd071, 0.92).setDepth(15);
      const flame = this.add.circle(x + direction * 20, y - 2, 25, 0xff704f, 0.36).setDepth(14);
      const ember = this.add.circle(x + direction * 30, y - 18, 5, 0xfff0a0, 0.9).setDepth(15);
      this.tweens.add({ targets: [core, flame], alpha: 0, scaleX: 1.75, scaleY: 1.75, duration: 190, ease: 'Quad.easeOut', onComplete: () => { core.destroy(); flame.destroy(); } });
      this.tweens.add({ targets: ember, alpha: 0, y: ember.y - 24, x: ember.x + direction * 13, duration: 210, onComplete: () => ember.destroy() });
      return;
    }

    if (style === 'VOID') {
      const outer = this.add.circle(x + direction * 18, y - 3, 25, 0x4f3b82, 0.34).setStrokeStyle(4, 0xb99cff, 0.8).setDepth(14);
      const inner = this.add.circle(x + direction * 18, y - 3, 9, 0xe0d2ff, 0.82).setDepth(15);
      this.tweens.add({ targets: outer, alpha: 0, scaleX: 1.7, scaleY: 1.7, angle: direction * 45, duration: 220, ease: 'Quad.easeOut', onComplete: () => outer.destroy() });
      this.tweens.add({ targets: inner, alpha: 0, scaleX: 0.25, scaleY: 0.25, duration: 170, onComplete: () => inner.destroy() });
      return;
    }

    const ring = this.add.circle(x + direction * 20, y - 2, 18, 0x88cfff, 0.24).setStrokeStyle(3, 0xd8f0ff, 0.82).setDepth(14);
    const spark = this.add.circle(x + direction * 22, y - 2, 7, 0xffffff, 0.92).setDepth(15);
    this.tweens.add({ targets: [ring, spark], alpha: 0, scaleX: 1.8, scaleY: 1.8, duration: 180, ease: 'Quad.easeOut', onComplete: () => { ring.destroy(); spark.destroy(); } });
  }

  private playUnitImpactFx(unit: BattleUnit, view: UnitView, damage: number): void {
    const weight = classifyImpact(damage, unit.definition.maxHp);
    const radius = weight === 'HEAVY' ? 18 : weight === 'MEDIUM' ? 13 : 9;
    const duration = weight === 'HEAVY' ? 170 : weight === 'MEDIUM' ? 140 : 110;
    const flash = this.add.circle(view.sprite.x, view.sprite.y - 7, radius, 0xfff2c6, weight === 'HEAVY' ? 0.88 : 0.72).setDepth(12);
    const ring = this.add.circle(view.sprite.x, view.sprite.y - 6, radius + 3, 0xffffff, 0).setStrokeStyle(weight === 'HEAVY' ? 4 : 2, 0xffffff, 0.72).setDepth(13);
    this.tweens.add({
      targets: [flash, ring],
      alpha: 0,
      scaleX: 1.65,
      scaleY: 1.65,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => { flash.destroy(); ring.destroy(); },
    });
    if (weight === 'HEAVY') this.cameras.main.shake(45, 0.00075);
  }

  private playBaseImpactFx(team: 'PLAYER' | 'ENEMY', damage: number, maxHp: number): void {
    const x = team === 'PLAYER' ? 88 : 1192;
    const weight = classifyImpact(damage, maxHp);
    const flash = this.add.rectangle(x, 445, 104, 190, team === 'PLAYER' ? 0xaad9ff : 0xffa59d, weight === 'HEAVY' ? 0.38 : 0.25).setDepth(10);
    const dust = this.add.ellipse(x, 526, weight === 'HEAVY' ? 112 : 78, 20, 0xe8ddc8, 0.32).setDepth(9);
    this.tweens.add({
      targets: [flash, dust],
      alpha: 0,
      scaleX: weight === 'HEAVY' ? 1.45 : 1.2,
      scaleY: weight === 'HEAVY' ? 1.25 : 1.1,
      duration: weight === 'HEAVY' ? 220 : 160,
      ease: 'Quad.easeOut',
      onComplete: () => { flash.destroy(); dust.destroy(); },
    });
    if (weight !== 'LIGHT') this.cameras.main.shake(weight === 'HEAVY' ? 80 : 45, weight === 'HEAVY' ? 0.00125 : 0.0007);
  }

  private syncUnits(): void {
    const present = new Set<number>();
    for (const unit of this.state.battle.units) {
      present.add(unit.simulationId);
      let view = this.views.get(unit.simulationId);
      if (!view) {
        view = this.createUnitView(unit);
        this.views.set(unit.simulationId, view);
      }

      const damageTaken = Math.max(0, view.lastHp - unit.hp);
      if (damageTaken > 0) this.playUnitImpactFx(unit, view, damageTaken);
      view.lastHp = unit.hp;

      const art = familyForUnit(unit.definition.id);
      const hitFrames = unit.definition.attackTiming.hitFrames;
      const lastHit = hitFrames[hitFrames.length - 1] ?? -1;
      const impactMoment =
        (unit.state === UnitState.Foreswing && hitFrames.includes(unit.stateFrame)) ||
        (unit.state === UnitState.Backswing && unit.stateFrame === 0 && lastHit >= 0);
      if (impactMoment && !usesTravelProjectile(art.attackFx)) {
        const attackFxKey = `${this.state.battle.tick}:${unit.state}:${unit.stateFrame}`;
        if (view.lastAttackFxKey !== attackFxKey) {
          this.playAttackFx(unit, view, art.attackFx);
          view.lastAttackFxKey = attackFxKey;
        }
      }

      const strip = this.stripForState(art.family, unit);
      const stateKey = `${strip.key}:${unit.state}`;
      if (view.stateKey !== stateKey) {
        view.sprite.setTexture(strip.key, 0);
        view.stateKey = stateKey;
      }
      const frame = this.frameForState(art.family, strip, unit);
      if (frame >= 0 && frame < strip.frames) view.sprite.setFrame(frame);
      view.sprite.x = this.toScreenX(unit.anchorX);
      view.sprite.y = unit.state === UnitState.NaturalKnockback ? 486 : 490;
      view.sprite.setAlpha(unit.state === UnitState.Dying ? Math.max(0.15, 1 - unit.stateFrame / Math.max(1, unit.definition.deathFrames)) : 1);
      if (unit.state === UnitState.Dying) view.sprite.setAngle((unit.team === 'PLAYER' ? -1 : 1) * Math.min(70, unit.stateFrame * 5));
      else view.sprite.setAngle(0);
      view.shadow.x = view.sprite.x;
      view.shadow.setAlpha(unit.state === UnitState.Dying ? Math.max(0, 0.34 * (1 - unit.stateFrame / Math.max(1, unit.definition.deathFrames))) : unit.state === UnitState.NaturalKnockback ? 0.2 : 0.34);
      view.hpBg.x = view.sprite.x;
      view.hp.x = view.sprite.x - 26;
      view.trait.x = view.sprite.x;
      view.trait.setVisible(unit.team === 'ENEMY' && unit.state !== UnitState.Dying);
      view.hpBg.setVisible(unit.state !== UnitState.Dying);
      view.hp.setVisible(unit.state !== UnitState.Dying);
      view.hp.displayWidth = Math.max(1, 52 * Math.max(0, unit.hp / unit.definition.maxHp));
    }
    for (const [id, view] of this.views) {
      if (present.has(id)) continue;
      view.sprite.destroy();
      view.shadow.destroy();
      view.hpBg.destroy();
      view.hp.destroy();
      view.trait.destroy();
      this.views.delete(id);
    }
  }

  private stripForState(family: ArtFamily, unit: BattleUnit): SpriteStrip {
    if (unit.state === UnitState.Foreswing || unit.state === UnitState.Backswing) return family.attack;
    if (unit.state === UnitState.Moving) return family.run;
    return family.idle;
  }

  private frameForState(family: ArtFamily, strip: SpriteStrip, unit: BattleUnit): number {
    if (unit.state === UnitState.Foreswing || unit.state === UnitState.Backswing) {
      return getAttackSpriteFrame({
        frameCount: strip.frames,
        contactFrame: family.attackContactFrame,
        timing: unit.definition.attackTiming,
        state: unit.state,
        stateFrame: unit.stateFrame,
      });
    }
    return getLoopingSpriteFrame(strip.frames, this.state.battle.tick, unit.simulationId);
  }

  private syncHud(): void {
    const supplyLevel = getCurrentSupplyLevel(this.state);
    const supplyRatio = Math.min(1, this.state.supply / supplyLevel.maxSupply);
    this.supplyBar.displayWidth = Math.max(1, 296 * supplyRatio);
    this.supplyText.setText(`${this.state.supply.toLocaleString()} / ${supplyLevel.maxSupply.toLocaleString()}`);
    this.supplyLevelText.setText(`보급소 Lv.${this.state.supplyLevel}   +${supplyLevel.incomePerSecond}/초`);
    const next = getNextSupplyLevel(this.state);
    this.supplyUpgradeText.setText(next ? `Lv.${this.state.supplyLevel + 1} · ${next.upgradeCost} 보급` : 'MAX');
    this.timerText.setText(this.formatTime(this.state.battle.tick));

    const weaponCooldown = getBaseWeaponCooldownRemaining(this.state);
    if (weaponCooldown > 0) {
      this.baseWeaponText.setText(`전선포 · ${(weaponCooldown / 30).toFixed(1)}초`);
      this.baseWeaponText.setColor('#9aa9b8');
      this.baseWeaponBg.setFillStyle(0x25303a, 1);
    } else {
      this.baseWeaponText.setText('전선포 · 발사 가능');
      this.baseWeaponText.setColor('#bfe8ff');
      this.baseWeaponBg.setFillStyle(0x26394a, 1);
    }

    const pBase = this.state.battle.bases.PLAYER;
    const eBase = this.state.battle.bases.ENEMY;
    if (pBase.hp < this.lastPlayerBaseHp) this.playBaseImpactFx('PLAYER', this.lastPlayerBaseHp - pBase.hp, pBase.maxHp);
    if (eBase.hp < this.lastEnemyBaseHp) this.playBaseImpactFx('ENEMY', this.lastEnemyBaseHp - eBase.hp, eBase.maxHp);
    this.lastPlayerBaseHp = pBase.hp;
    this.lastEnemyBaseHp = eBase.hp;
    this.playerBaseBar.displayWidth = Math.max(1, 152 * Math.max(0, pBase.hp / pBase.maxHp));
    this.enemyBaseBar.displayWidth = Math.max(1, 152 * Math.max(0, eBase.hp / eBase.maxHp));
    this.playerBaseText.setText(`${pBase.hp.toLocaleString()} / ${pBase.maxHp.toLocaleString()}`);
    this.enemyBaseText.setText(`${eBase.hp.toLocaleString()} / ${eBase.maxHp.toLocaleString()}`);

    for (const slot of this.activeSlots) {
      const view = this.buttons.get(slot.slotId);
      if (!view) continue;
      const cooldown = getCooldownRemaining(this.state, slot.slotId);
      const affordable = this.state.supply >= slot.cost;
      view.shade.setAlpha(cooldown > 0 || !affordable ? 0.48 : 0);
      view.cooldown.setText(cooldown > 0 ? `${(cooldown / 30).toFixed(1)}s` : affordable ? '소환' : '부족');
      view.cooldown.setColor(cooldown > 0 ? '#b9c2cf' : affordable ? '#8ee3aa' : '#ff9a91');
    }
  }

  private formatTime(tick: number): string {
    const seconds = Math.floor(tick / 30);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
}

class ResultScene extends Phaser.Scene {
  private stage!: PrototypeStage;
  private winner: string | null = null;
  private progressionSaved = false;

  constructor() { super('result'); }

  init(data: { stageId?: string; winner?: string | null }): void {
    this.stage = getStage(data.stageId ?? STAGES[0]!.id);
    this.winner = data.winner ?? null;
    this.progressionSaved = false;
  }

  create(): void {
    drawBackdrop(this, 'menu');
    const victory = this.winner === 'PLAYER';
    this.progressionSaved = !victory;
    addText(this, INTERNAL_WIDTH / 2, 86, victory ? '승 리' : '패 배', 62, victory ? COLORS.gold : COLORS.red, 'center').setOrigin(0.5);
    addText(this, INTERNAL_WIDTH / 2, 148, `STAGE ${getStageNumber(this.stage.id)} · ${this.stage.name}`, 25, '#e9edf4', 'center').setOrigin(0.5);

    this.add.rectangle(INTERNAL_WIDTH / 2, 355, 760, 320, 0x242b38, 0.98).setStrokeStyle(3, victory ? 0xb99449 : 0x805151);
    if (victory) {
      addText(this, INTERNAL_WIDTH / 2, 238, '확정 보물 획득', 23, '#8ee3aa', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, 290, this.stage.treasure.name, 35, '#ffe18a', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, 342, this.stage.treasure.effect, 18, '#c8d0dc', 'center').setOrigin(0.5);
      const unlockSlot = this.stage.unlockUnitId ? getSlotById(this.stage.unlockUnitId) : undefined;
      const unlockText = addText(this, INTERNAL_WIDTH / 2, 395, unlockSlot ? `첫 클리어 동료 보상 · ${unlockSlot.displayName}` : '이번 스테이지는 동료 해금 없음', 20, unlockSlot ? '#9ccfff' : '#8f9aac', 'center').setOrigin(0.5);
      const status = addText(this, INTERNAL_WIDTH / 2, 447, '진행 저장 중… 잠시만 기다려 주세요', 16, '#8f9aac', 'center').setOrigin(0.5);
      void recordStageClear(this.stage.id, this.stage.treasure.id).then((result) => {
        this.progressionSaved = true;
        if (!this.scene.isActive()) return;
        status.setText(result.firstClear ? '첫 클리어 저장 완료 · 다음 스테이지 개방' : '재클리어 완료 · 보물 반복 파밍 불필요');
        if (unlockSlot) unlockText.setText(result.firstClear ? `신규 동료 합류 · ${unlockSlot.displayName}` : `보유 동료 · ${unlockSlot.displayName}`);
      });
    } else {
      addText(this, INTERNAL_WIDTH / 2, 310, '편성과 소환 타이밍을 바꿔 다시 도전해 보자.', 24, '#dce2ec', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, 370, '패배 시 보상 손실이나 에너지 소모는 없다.', 18, '#aeb8c7', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, 425, `현재 전장 · ${BATTLEFIELD_THEME_LABELS[this.stage.theme]} / ${this.stage.mapLength}m`, 17, '#8796aa', 'center').setOrigin(0.5);
    }

    const guarded = (action: () => void): void => {
      if (!this.progressionSaved) {
        this.cameras.main.shake(60, 0.0012);
        return;
      }
      action();
    };
    addButton(this, 380, 590, 260, 68, '다시 도전', () => guarded(() => this.scene.start('battle', { stageId: this.stage.id })), 0x6d88a7);
    addButton(this, 640, 590, 220, 68, '스테이지', () => guarded(() => this.scene.start('stage-select')), 0x667185);
    addButton(this, 900, 590, 220, 68, '메인', () => guarded(() => this.scene.start('main-menu')), 0x667185);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: INTERNAL_WIDTH,
  height: INTERNAL_HEIGHT,
  backgroundColor: '#111722',
  pixelArt: true,
  roundPixels: true,
  scene: [BootScene, MainMenuScene, StageSelectScene, DeckScene, CatalogScene, BattleScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});