import Phaser from 'phaser';
import { APP_NAME, INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { SIM_TICK_MS, UnitState, type BattleUnit } from '@frontline/sim';
import {
  getCooldownRemaining,
  getCurrentSupplyLevel,
  getNextSupplyLevel,
  stepPlayableBattle,
  trySpawnPlayerUnit,
  tryUpgradeSupply,
  type PlayableBattleState,
} from '@frontline/sim/playable';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART, type ArtFamily, type SpriteStrip } from './assets';
import { PLAYER_SLOTS, STAGES, createPrototypeBattle, getStage, type PrototypeStage } from './prototype';
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
  const text = addText(scene, 0, 0, label, Math.max(20, Math.floor(height * 0.3)), '#ffffff', 'center').setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, shine, text]);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => bg.setFillStyle(0x343c4d, 1));
  bg.on('pointerout', () => bg.setFillStyle(0x252b38, 0.98));
  bg.on('pointerdown', () => container.setScale(0.98));
  bg.on('pointerup', () => { container.setScale(1); onClick(); });
  return container;
}

function drawBackdrop(scene: Phaser.Scene, variant: 'menu' | 'map' | 'battle' = 'menu'): void {
  scene.cameras.main.setBackgroundColor(variant === 'battle' ? '#9fc7cf' : '#171c27');
  const g = scene.add.graphics();
  if (variant !== 'battle') {
    g.fillStyle(0x171c27).fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
    g.fillStyle(0x20283a, 1).fillCircle(1080, 130, 240);
    g.fillStyle(0x263247, 1).fillTriangle(0, 570, 330, 250, 630, 570);
    g.fillStyle(0x222d40, 1).fillTriangle(430, 570, 760, 200, 1080, 570);
    g.fillStyle(0x1f2939, 1).fillTriangle(870, 570, 1110, 300, 1280, 570);
    g.fillStyle(0x111722).fillRect(0, 570, INTERNAL_WIDTH, 150);
    return;
  }
  g.fillStyle(0xb9dce2).fillRect(0, 0, INTERNAL_WIDTH, 430);
  g.fillStyle(0xe9d89d, 0.7).fillCircle(1050, 105, 54);
  g.fillStyle(0x7997a0).fillTriangle(0, 440, 280, 250, 540, 440);
  g.fillStyle(0x78918a).fillTriangle(300, 440, 650, 230, 980, 440);
  g.fillStyle(0x6f857d).fillTriangle(760, 440, 1040, 290, 1280, 440);
  g.fillStyle(0x78985f).fillRect(0, 430, INTERNAL_WIDTH, 88);
  g.fillStyle(0x556a48).fillRect(0, 510, INTERNAL_WIDTH, 22);
  g.fillStyle(0x40382f).fillRect(0, 532, INTERNAL_WIDTH, 188);
}

function familyForUnit(unitId: string): { family: ArtFamily; tint: number; displayScale: number } {
  const variant = UNIT_ART[unitId] ?? { familyId: 'warrior', tint: 0xffffff };
  const family = ART_BY_ID[variant.familyId] ?? ART_FAMILIES[0]!;
  return { family, tint: variant.tint, displayScale: variant.displayScale ?? 1 };
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
    this.load.on('loaderror', (file: { key?: string }) => status.setText(`일부 캐릭터 로드 재시도 중… ${file.key ?? ''}`));
  }

  create(): void { this.scene.start('main-menu'); }
}

class MainMenuScene extends Phaser.Scene {
  private progress: GuestProgress = { clearedStageIds: [], treasureIds: [] };
  constructor() { super('main-menu'); }

  create(): void {
    drawBackdrop(this, 'menu');
    addText(this, 84, 84, '전선소환전', 70, COLORS.cream);
    addText(this, 88, 165, APP_NAME, 24, '#9fb0c6');
    addText(this, 88, 230, '별난 영웅들을 모아 전선을 밀어붙여라.', 29, '#e8edf6');
    addText(this, 88, 272, '소환은 단순하게, 덱과 타이밍은 깊게.', 22, COLORS.muted);

    this.add.rectangle(1040, 105, 320, 110, 0x222936, 0.96).setStrokeStyle(2, 0x556077);
    addText(this, 900, 72, '게스트 지휘관', 26, '#ffffff');
    const progressText = addText(this, 900, 110, '진행도 불러오는 중…', 19, COLORS.muted);

    addButton(this, 230, 435, 310, 92, '출 정', () => this.scene.start('stage-select'), 0xc5a04c);
    addButton(this, 575, 435, 310, 92, '편 성', () => this.scene.start('deck'), 0x5f8fb8);
    addButton(this, 920, 435, 310, 92, '도 감  ·  준비 중', () => undefined, 0x56606f).setAlpha(0.72);
    addText(this, 88, 628, '보물은 첫 클리어 시 100% 획득 · 에너지 제한 없음', 20, '#9cd6ad');
    addText(this, 1185, 675, 'PRE-ALPHA', 17, '#657086').setOrigin(1, 0.5);

    void loadGuestProgress().then((progress) => {
      this.progress = progress;
      progressText.setText(`클리어 ${progress.clearedStageIds.length}/${STAGES.length}   ·   보물 ${progress.treasureIds.length}/${STAGES.length}`);
    });
  }
}

class StageSelectScene extends Phaser.Scene {
  private progress: GuestProgress = { clearedStageIds: [], treasureIds: [] };
  constructor() { super('stage-select'); }

  create(): void {
    drawBackdrop(this, 'map');
    addText(this, 70, 55, '제1장 · 뒤집힌 국경', 44, COLORS.cream);
    addText(this, 72, 112, '스테이지 선택', 22, COLORS.muted);
    addButton(this, 1135, 74, 190, 56, '메인으로', () => this.scene.start('main-menu'), 0x586275);

    const cards: Array<{ stage: PrototypeStage; clear: Phaser.GameObjects.Text; treasure: Phaser.GameObjects.Text }> = [];
    STAGES.forEach((stage, index) => {
      const x = 250 + index * 390;
      this.add.rectangle(x, 365, 330, 410, 0x242b3a, 0.97).setStrokeStyle(3, index === STAGES.length - 1 ? 0xbf9252 : 0x55657c);
      addText(this, x, 205, `STAGE ${index + 1}`, 18, '#8291a6', 'center').setOrigin(0.5);
      addText(this, x, 250, stage.name, 34, '#ffffff', 'center').setOrigin(0.5);
      addText(this, x, 300, '★'.repeat(stage.difficulty) + '☆'.repeat(3 - stage.difficulty), 23, COLORS.gold, 'center').setOrigin(0.5);
      addText(this, x, 340, stage.subtitle, 17, '#c4cbd7', 'center').setOrigin(0.5);
      const clear = addText(this, x, 390, '미클리어', 19, '#98a2b2', 'center').setOrigin(0.5);
      addText(this, x, 438, '확정 보물', 17, '#8dd9a8', 'center').setOrigin(0.5);
      const treasure = addText(this, x, 468, stage.treasure.name, 18, '#f2d37c', 'center').setOrigin(0.5);
      addButton(this, x, 535, 230, 62, '전투 시작', () => this.scene.start('battle', { stageId: stage.id }), index === STAGES.length - 1 ? 0xbf9252 : 0x5e7ea0);
      cards.push({ stage, clear, treasure });
    });

    void loadGuestProgress().then((progress) => {
      this.progress = progress;
      for (const card of cards) {
        const cleared = progress.clearedStageIds.includes(card.stage.id);
        card.clear.setText(cleared ? '✓ 클리어' : '미클리어').setColor(cleared ? '#8ee3aa' : '#98a2b2');
        if (progress.treasureIds.includes(card.stage.treasure.id)) card.treasure.setText(`✓ ${card.stage.treasure.name}`).setColor('#9fe4b5');
      }
    });
  }
}

class DeckScene extends Phaser.Scene {
  constructor() { super('deck'); }
  create(): void {
    drawBackdrop(this, 'map');
    addText(this, 70, 48, '현재 편성 · 10 / 10', 42, COLORS.cream);
    addText(this, 72, 100, '희귀도는 강함의 서열이 아니다. 역할과 비용을 섞어 전선을 설계한다.', 20, COLORS.muted);
    addButton(this, 1135, 70, 190, 56, '메인으로', () => this.scene.start('main-menu'), 0x586275);

    PLAYER_SLOTS.forEach((slot, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = 148 + col * 248;
      const y = 280 + row * 260;
      this.add.rectangle(x, y, 220, 224, 0x252c3a, 0.98).setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(rarityColor[slot.rarity] ?? '#ffffff').color, 0.85);
      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x, y - 58, art.family.idle.key, 0).setTint(art.tint);
      const scale = (152 / art.family.idle.frameHeight) * art.displayScale;
      portrait.setScale(scale);
      addText(this, x - 94, y - 102, slot.rarity, 17, rarityColor[slot.rarity] ?? '#ffffff');
      addText(this, x, y + 4, slot.displayName, 23, '#ffffff', 'center').setOrigin(0.5);
      addText(this, x, y + 38, `${slot.role} · ${slot.cost} 보급`, 17, '#f2d37c', 'center').setOrigin(0.5);
      addText(this, x, y + 72, slot.description, 14, '#b9c2d0', 'center').setOrigin(0.5).setWordWrapWidth(190);
    });
  }
}

interface UnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly hpBg: Phaser.GameObjects.Rectangle;
  readonly hp: Phaser.GameObjects.Rectangle;
  stateKey: string;
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
  private accumulator = 0;
  private views = new Map<number, UnitView>();
  private buttons = new Map<string, UnitButtonView>();
  private supplyText!: Phaser.GameObjects.Text;
  private supplyBar!: Phaser.GameObjects.Rectangle;
  private supplyLevelText!: Phaser.GameObjects.Text;
  private supplyUpgradeText!: Phaser.GameObjects.Text;
  private playerBaseBar!: Phaser.GameObjects.Rectangle;
  private enemyBaseBar!: Phaser.GameObjects.Rectangle;
  private playerBaseText!: Phaser.GameObjects.Text;
  private enemyBaseText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private resolved = false;

  constructor() { super('battle'); }

  init(data: { stageId?: string }): void {
    this.stage = getStage(data.stageId ?? STAGES[0]!.id);
    this.state = createPrototypeBattle(this.stage.id);
    this.accumulator = 0;
    this.resolved = false;
    this.views.clear();
    this.buttons.clear();
  }

  create(): void {
    drawBackdrop(this, 'battle');
    this.drawHud();
    this.drawBases();
    this.drawUnitButtons();
  }

  update(_: number, delta: number): void {
    if (this.resolved) return;
    this.accumulator += Math.min(delta, 120);
    while (this.accumulator >= SIM_TICK_MS && this.state.battle.winner === null) {
      stepPlayableBattle(this.state);
      this.accumulator -= SIM_TICK_MS;
    }
    this.syncUnits();
    this.syncHud();
    if (this.state.battle.winner !== null) {
      this.resolved = true;
      this.time.delayedCall(700, () => this.scene.start('result', { stageId: this.stage.id, winner: this.state.battle.winner }));
    }
  }

  private drawHud(): void {
    this.add.rectangle(INTERNAL_WIDTH / 2, 53, INTERNAL_WIDTH, 106, 0x151a24, 0.95);
    addText(this, 35, 19, this.stage.name, 30, '#ffffff');
    addText(this, 36, 60, this.stage.chapter, 16, '#aeb8c8');
    this.timerText = addText(this, 625, 25, '0:00', 23, '#dbe2ee', 'center').setOrigin(0.5, 0);

    addText(this, 760, 18, '보급', 17, '#d7ddea');
    this.add.rectangle(930, 56, 300, 22, 0x0d1118).setStrokeStyle(2, 0x67738b);
    this.supplyBar = this.add.rectangle(782, 56, 1, 14, 0xe9c965).setOrigin(0, 0.5);
    this.supplyText = addText(this, 1084, 20, '', 21, '#f4d577', 'right').setOrigin(1, 0);
    this.supplyLevelText = addText(this, 760, 68, '', 17, '#b9c4d4');
  }

  private drawBases(): void {
    const g = this.add.graphics();
    g.fillStyle(0x627fa0).fillRect(42, 360, 92, 184);
    g.fillStyle(0x7894b5).fillTriangle(35, 360, 88, 310, 141, 360);
    g.fillStyle(0x36475e).fillRect(75, 476, 28, 68);
    g.fillStyle(0x9b625d).fillRect(1146, 360, 92, 184);
    g.fillStyle(0xb4776c).fillTriangle(1139, 360, 1192, 310, 1245, 360);
    g.fillStyle(0x55383a).fillRect(1179, 476, 28, 68);

    addText(this, 42, 288, '아군 거점', 17, '#cfe5ff');
    addText(this, 1238, 288, '적 거점', 17, '#ffd3cc', 'right').setOrigin(1, 0);
    this.add.rectangle(88, 330, 156, 16, 0x161b23).setStrokeStyle(2, 0x7990aa);
    this.add.rectangle(1192, 330, 156, 16, 0x161b23).setStrokeStyle(2, 0xaa716c);
    this.playerBaseBar = this.add.rectangle(12, 330, 152, 10, 0x74c7ff).setOrigin(0, 0.5);
    this.enemyBaseBar = this.add.rectangle(1116, 330, 152, 10, 0xff8f82).setOrigin(0, 0.5);
    this.playerBaseText = addText(this, 88, 342, '', 16, '#e8f5ff', 'center').setOrigin(0.5, 0);
    this.enemyBaseText = addText(this, 1192, 342, '', 16, '#ffe6e1', 'center').setOrigin(0.5, 0);
  }

  private drawUnitButtons(): void {
    this.add.rectangle(INTERNAL_WIDTH / 2, 630, INTERNAL_WIDTH, 180, 0x151a24, 0.98);
    PLAYER_SLOTS.forEach((slot, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const x = 102 + col * 205;
      const y = 579 + row * 72;
      const border = Phaser.Display.Color.HexStringToColor(rarityColor[slot.rarity] ?? '#ffffff').color;
      const bg = this.add.rectangle(x, y, 188, 62, 0x28303e).setStrokeStyle(2, border, 0.85).setInteractive({ useHandCursor: true });
      const shade = this.add.rectangle(x, y, 188, 62, 0x05070b, 0).setDepth(6);
      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x - 69, y, art.family.idle.key, 0).setTint(art.tint).setDepth(4);
      portrait.setScale((50 / art.family.idle.frameHeight) * art.displayScale);
      addText(this, x - 43, y - 25, `${slot.rarity} · ${slot.displayName}`, 14, '#ffffff').setDepth(5);
      const cost = addText(this, x - 43, y + 2, `${slot.cost} 보급`, 14, '#f2d37c').setDepth(5);
      const cooldown = addText(this, x + 82, y + 2, '', 13, '#d8e1ef', 'right').setOrigin(1, 0).setDepth(7);
      bg.on('pointerdown', () => {
        const result = trySpawnPlayerUnit(this.state, slot.slotId);
        if (!result.ok) this.cameras.main.shake(55, 0.0012);
      });
      this.buttons.set(slot.slotId, { bg, shade, cooldown, cost });
    });

    const upgradeBg = this.add.rectangle(1145, 615, 220, 134, 0x302a1c).setStrokeStyle(3, 0xc59d4b).setInteractive({ useHandCursor: true });
    this.supplyUpgradeText = addText(this, 1145, 594, '', 19, '#ffe29a', 'center').setOrigin(0.5);
    addText(this, 1145, 636, '보급소 강화', 18, '#ffffff', 'center').setOrigin(0.5);
    upgradeBg.on('pointerdown', () => {
      const result = tryUpgradeSupply(this.state);
      if (!result.ok) this.cameras.main.shake(55, 0.0012);
    });
  }

  private toScreenX(anchorX: number): number {
    const left = 112;
    const right = 1168;
    return left + (anchorX / this.state.battle.mapLength) * (right - left);
  }

  private createUnitView(unit: BattleUnit): UnitView {
    const art = familyForUnit(unit.definition.id);
    const sprite = this.add.sprite(this.toScreenX(unit.anchorX), 490, art.family.run.key, 0).setTint(art.tint).setDepth(3);
    sprite.setFlipX(unit.team === 'ENEMY');
    const scale = (art.family.displayHeight / art.family.run.frameHeight) * art.displayScale;
    sprite.setScale(scale);
    const hpBg = this.add.rectangle(sprite.x, 443, 54, 7, 0x161a21).setDepth(5);
    const hp = this.add.rectangle(sprite.x - 26, 443, 52, 5, unit.team === 'PLAYER' ? 0x78dca0 : 0xf1837c).setOrigin(0, 0.5).setDepth(6);
    return { sprite, hpBg, hp, stateKey: '' };
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
      const art = familyForUnit(unit.definition.id);
      const strip = this.stripForState(art.family, unit);
      const stateKey = `${strip.key}:${unit.state}`;
      if (view.stateKey !== stateKey) {
        view.sprite.setTexture(strip.key, 0);
        view.stateKey = stateKey;
      }
      const frame = this.frameForState(strip, unit);
      if (frame >= 0 && frame < strip.frames) view.sprite.setFrame(frame);
      view.sprite.x = this.toScreenX(unit.anchorX);
      view.sprite.y = unit.state === UnitState.NaturalKnockback ? 486 : 490;
      view.sprite.setAlpha(unit.state === UnitState.Dying ? Math.max(0.15, 1 - unit.stateFrame / Math.max(1, unit.definition.deathFrames)) : 1);
      if (unit.state === UnitState.Dying) view.sprite.setAngle((unit.team === 'PLAYER' ? -1 : 1) * Math.min(70, unit.stateFrame * 5));
      else view.sprite.setAngle(0);
      view.hpBg.x = view.sprite.x;
      view.hp.x = view.sprite.x - 26;
      view.hpBg.setVisible(unit.state !== UnitState.Dying);
      view.hp.setVisible(unit.state !== UnitState.Dying);
      view.hp.displayWidth = Math.max(1, 52 * Math.max(0, unit.hp / unit.definition.maxHp));
    }
    for (const [id, view] of this.views) {
      if (present.has(id)) continue;
      view.sprite.destroy(); view.hpBg.destroy(); view.hp.destroy(); this.views.delete(id);
    }
  }

  private stripForState(family: ArtFamily, unit: BattleUnit): SpriteStrip {
    if (unit.state === UnitState.Foreswing || unit.state === UnitState.Backswing) return family.attack;
    if (unit.state === UnitState.Moving) return family.run;
    return family.idle;
  }

  private frameForState(strip: SpriteStrip, unit: BattleUnit): number {
    if (unit.state === UnitState.Foreswing || unit.state === UnitState.Backswing) {
      const lastHit = unit.definition.attackTiming.hitFrames[unit.definition.attackTiming.hitFrames.length - 1] ?? 1;
      const attackSpan = Math.max(1, lastHit + unit.definition.attackTiming.backswingFrames);
      const elapsed = unit.state === UnitState.Foreswing ? unit.stateFrame : lastHit + unit.stateFrame;
      return Math.min(strip.frames - 1, Math.floor((elapsed / attackSpan) * strip.frames));
    }
    return Math.floor((this.state.battle.tick / 4) % strip.frames);
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

    const pBase = this.state.battle.bases.PLAYER;
    const eBase = this.state.battle.bases.ENEMY;
    this.playerBaseBar.displayWidth = Math.max(1, 152 * Math.max(0, pBase.hp / pBase.maxHp));
    this.enemyBaseBar.displayWidth = Math.max(1, 152 * Math.max(0, eBase.hp / eBase.maxHp));
    this.playerBaseText.setText(`${pBase.hp.toLocaleString()} / ${pBase.maxHp.toLocaleString()}`);
    this.enemyBaseText.setText(`${eBase.hp.toLocaleString()} / ${eBase.maxHp.toLocaleString()}`);

    for (const slot of PLAYER_SLOTS) {
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
  constructor() { super('result'); }

  init(data: { stageId?: string; winner?: string | null }): void {
    this.stage = getStage(data.stageId ?? STAGES[0]!.id);
    this.winner = data.winner ?? null;
  }

  create(): void {
    drawBackdrop(this, 'menu');
    const victory = this.winner === 'PLAYER';
    addText(this, INTERNAL_WIDTH / 2, 105, victory ? '승 리' : '패 배', 64, victory ? COLORS.gold : COLORS.red, 'center').setOrigin(0.5);
    addText(this, INTERNAL_WIDTH / 2, 172, this.stage.name, 28, '#e9edf4', 'center').setOrigin(0.5);

    this.add.rectangle(INTERNAL_WIDTH / 2, 360, 720, 280, 0x242b38, 0.98).setStrokeStyle(3, victory ? 0xb99449 : 0x805151);
    if (victory) {
      addText(this, INTERNAL_WIDTH / 2, 270, '확정 보물 획득', 24, '#8ee3aa', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, 325, this.stage.treasure.name, 38, '#ffe18a', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, 382, this.stage.treasure.effect, 20, '#c8d0dc', 'center').setOrigin(0.5);
      const status = addText(this, INTERNAL_WIDTH / 2, 430, '저장 중…', 17, '#8f9aac', 'center').setOrigin(0.5);
      void recordStageClear(this.stage.id, this.stage.treasure.id).then((result) => {
        status.setText(result.treasureNew ? '첫 획득 완료 · 다시 파밍할 필요 없음' : '이미 획득한 보물 · 드랍 등급 RNG 없음');
      });
    } else {
      addText(this, INTERNAL_WIDTH / 2, 328, '편성과 소환 타이밍을 바꿔 다시 도전해 보자.', 25, '#dce2ec', 'center').setOrigin(0.5);
      addText(this, INTERNAL_WIDTH / 2, 382, '패배 시 보상 손실이나 에너지 소모는 없다.', 19, '#aeb8c7', 'center').setOrigin(0.5);
    }

    addButton(this, 380, 585, 260, 68, '다시 도전', () => this.scene.start('battle', { stageId: this.stage.id }), 0x6d88a7);
    addButton(this, 640, 585, 220, 68, '스테이지', () => this.scene.start('stage-select'), 0x667185);
    addButton(this, 900, 585, 220, 68, '메인', () => this.scene.start('main-menu'), 0x667185);
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
  scene: [BootScene, MainMenuScene, StageSelectScene, DeckScene, BattleScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
