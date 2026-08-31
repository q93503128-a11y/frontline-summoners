import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { SIM_TICK_MS, UnitState, type BattleUnit } from '@frontline/sim';
import {
  getBaseWeaponCooldownRemaining,
  getCooldownRemaining,
  getCurrentSupplyLevel,
  getNextSupplyLevel,
  tryFireBaseWeapon,
  trySpawnPlayerUnit,
  tryUpgradeSupply,
  type PlayableBattleState,
} from '@frontline/sim/playable';
import {
  getEndlessRecordReachedMinute,
  getEndlessRecordSurvivalMs,
  stepBossRushRecordBattle,
  stepEndlessRecordBattle,
  type BossRushRecordState,
  type EndlessRecordState,
} from '@frontline/sim/record-playable';
import { type ArtFamily, type SpriteStrip } from './assets.ts';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress.ts';
import {
  startAuthenticatedTrustedBattle,
  type AccountTrustedBattleCommand,
} from './account-network.ts';
import { BASE_WEAPON_UNLOCKS } from './base-weapon-progression.ts';
import { drawBattlefield, getBattlefieldBasePalette } from './battlefield.ts';
import { showBossArrival } from './boss-warning.ts';
import { getAttackSpriteFrame, getLoopingSpriteFrame } from './combat-visuals.ts';
import { formatCompactTraits } from './combat-trait-labels.ts';
import { buildGuestDeckSlots } from './player-loadout.ts';
import {
  BOSS_RUSH_SEQUENCE,
  createGuestBossRushRecordBattle,
  createGuestEndlessRecordBattle,
  getRecordModeDefinition,
  isRecordModeUnlocked,
  type RecordModeId,
} from './record-content.ts';
import { getStage, type PrototypeRosterSlot, type PrototypeStage } from './prototype.ts';
import { recordGuestEnemyDiscoveries } from './save.ts';
import {
  BATTLE_UNIT_HOTKEY_CODES,
  COLORS,
  addButton,
  addText,
  battleUiFontSize,
  familyForUnit,
  getUnitHotkeyLabel,
} from './scene-ui.ts';
import { isCompactMobileViewport, isPortraitMobileViewport } from './viewport.ts';

interface RecordUnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly hpBg: Phaser.GameObjects.Rectangle;
  readonly hp: Phaser.GameObjects.Rectangle;
  readonly trait: Phaser.GameObjects.Text;
  stateKey: string;
}

interface RecordUnitButtonView {
  readonly shade: Phaser.GameObjects.Rectangle;
  readonly cooldown: Phaser.GameObjects.Text;
}

type RecordRuntime = EndlessRecordState | BossRushRecordState;

function formatTimeFromTicks(tick: number): string {
  const seconds = Math.floor(tick / 30);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export class RecordBattleScene extends Phaser.Scene {
  private modeId: RecordModeId = 'record_endless_front';
  private runtime!: RecordRuntime;
  private presentationStage!: PrototypeStage;
  private activeSlots: readonly PrototypeRosterSlot[] = [];
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private trustedBattleId: string | null = null;
  private trustedCommands: AccountTrustedBattleCommand[] = [];
  private accumulator = 0;
  private ready = false;
  private resolved = false;
  private manuallyPaused = false;
  private pauseOverlay: Phaser.GameObjects.Container | undefined;
  private views = new Map<number, RecordUnitView>();
  private buttons = new Map<string, RecordUnitButtonView>();
  private seenBossSimulationIds = new Set<number>();
  private discoveredEnemyIds = new Set<string>();
  private enemyDiscoveryWrite: Promise<void> = Promise.resolve();
  private supplyBar!: Phaser.GameObjects.Rectangle;
  private supplyText!: Phaser.GameObjects.Text;
  private supplyLevelText!: Phaser.GameObjects.Text;
  private supplyUpgradeText!: Phaser.GameObjects.Text;
  private baseWeaponBg!: Phaser.GameObjects.Rectangle;
  private baseWeaponText!: Phaser.GameObjects.Text;
  private playerBaseBar!: Phaser.GameObjects.Rectangle;
  private playerBaseText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private recordText!: Phaser.GameObjects.Text;

  constructor() { super('record-battle'); }

  init(data: { modeId?: RecordModeId }): void {
    this.modeId = data.modeId ?? 'record_endless_front';
    const source = getStage(this.modeId === 'record_endless_front' ? 'main_03_020' : 'main_04_020');
    const mode = getRecordModeDefinition(this.modeId);
    this.presentationStage = {
      ...source,
      id: this.modeId,
      name: mode.displayName,
      subtitle: mode.description,
      chapter: '기록 SPECIAL',
      mapLength: this.modeId === 'record_endless_front' ? 2600 : 2850,
    };
    this.activeSlots = [];
    this.authority = 'GUEST_LOCAL';
    this.trustedBattleId = null;
    this.trustedCommands = [];
    this.accumulator = 0;
    this.ready = false;
    this.resolved = false;
    this.manuallyPaused = false;
    this.pauseOverlay = undefined;
    this.views.clear();
    this.buttons.clear();
    this.seenBossSimulationIds.clear();
    this.discoveredEnemyIds.clear();
    this.enemyDiscoveryWrite = Promise.resolve();
  }

  create(): void {
    drawBattlefield(this, this.presentationStage);
    const loading = addText(this, INTERNAL_WIDTH / 2, 330, '기록전 편성과 전장 불러오는 중…', 25, '#ffffff', 'center').setOrigin(0.5);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.handleHotkey(event));
    void loadActiveProgress().then(async (view) => {
      if (!this.scene.isActive()) return;
      if (view.authority === 'ACCOUNT_OFFLINE_CACHE') {
        this.scene.start('record-hub');
        return;
      }
      const progress = view.progress;
      if (!isRecordModeUnlocked(this.modeId, progress.clearedStageIds)) {
        this.scene.start('record-hub');
        return;
      }
      this.authority = view.authority;
      this.discoveredEnemyIds = new Set(progress.discoveredEnemyIds ?? []);
      this.activeSlots = buildGuestDeckSlots(progress);
      this.runtime = this.modeId === 'record_endless_front'
        ? createGuestEndlessRecordBattle(progress)
        : createGuestBossRushRecordBattle(progress);

      if (this.authority === 'ACCOUNT_ONLINE') {
        const ticket = await startAuthenticatedTrustedBattle('RECORD', this.modeId);
        if (ticket.kind !== 'RECORD' || ticket.targetId !== this.modeId) throw new Error('trusted record ticket target mismatch');
        if (ticket.initialStateHash !== this.runtime.battle.stateHash) throw new Error('trusted record initial state hash mismatch');
        this.trustedBattleId = ticket.battleId;
      }

      if (!this.scene.isActive()) return;
      loading.destroy();
      this.drawHud();
      this.drawBases();
      this.drawUnitButtons();
      this.ready = true;
      this.syncEnemyDiscoveries();
      this.syncUnits();
      this.syncHud();
    }).catch(() => {
      if (this.scene.isActive()) this.scene.start('record-hub');
    });
  }

  update(_: number, delta: number): void {
    if (!this.ready || this.resolved || this.manuallyPaused || isPortraitMobileViewport()) return;
    this.accumulator += Math.min(delta, 120);
    while (this.accumulator >= SIM_TICK_MS && !this.runtime.ended) {
      if (this.runtime.mode === 'ENDLESS_FRONT') stepEndlessRecordBattle(this.runtime);
      else stepBossRushRecordBattle(this.runtime);
      this.accumulator -= SIM_TICK_MS;
    }
    this.syncEnemyDiscoveries();
    this.syncBossWarnings();
    this.syncUnits();
    this.syncHud();
    if (this.runtime.ended) this.finishRecord();
  }

  private battleState(): PlayableBattleState { return this.runtime.battle; }

  private canAcceptAction(): boolean {
    return this.ready && !this.resolved && !this.manuallyPaused && !this.runtime.ended && !isPortraitMobileViewport();
  }

  private handleHotkey(event: KeyboardEvent): void {
    if (event.code === 'KeyP' || event.code === 'Escape') {
      this.togglePause();
      return;
    }
    if (!this.canAcceptAction()) return;
    const index = BATTLE_UNIT_HOTKEY_CODES.indexOf(event.code);
    if (index >= 0) {
      const slot = this.activeSlots[index];
      if (slot) this.trySpawn(slot.slotId);
      return;
    }
    if (event.code === 'KeyQ') {
      this.tryUpgradeSupplyInput();
      return;
    }
    if (event.code === 'KeyE') this.tryFireBaseWeaponInput();
  }

  private appendTrustedCommand(command: AccountTrustedBattleCommand): void {
    if (this.authority === 'ACCOUNT_ONLINE') this.trustedCommands.push(command);
  }

  private trySpawn(slotId: string): void {
    if (!this.canAcceptAction()) return;
    const tick = this.battleState().battle.tick;
    const result = trySpawnPlayerUnit(this.battleState(), slotId);
    if (result.ok) this.appendTrustedCommand({ tick, type: 'SPAWN', slotId });
  }

  private tryUpgradeSupplyInput(): void {
    if (!this.canAcceptAction()) return;
    const tick = this.battleState().battle.tick;
    const result = tryUpgradeSupply(this.battleState());
    if (result.ok) this.appendTrustedCommand({ tick, type: 'UPGRADE_SUPPLY' });
  }

  private tryFireBaseWeaponInput(): void {
    if (!this.canAcceptAction()) return;
    const tick = this.battleState().battle.tick;
    const result = tryFireBaseWeapon(this.battleState());
    if (result.ok) {
      this.appendTrustedCommand({ tick, type: 'FIRE_BASE_WEAPON' });
      this.playBaseWeaponFx();
    }
  }

  private togglePause(): void {
    if (!this.ready || this.resolved) return;
    this.setPaused(!this.manuallyPaused);
  }

  private setPaused(paused: boolean): void {
    if (this.manuallyPaused === paused) return;
    this.manuallyPaused = paused;
    if (!paused) {
      this.pauseOverlay?.destroy(true);
      this.pauseOverlay = undefined;
      this.tweens.resumeAll();
      return;
    }
    this.tweens.pauseAll();
    const blocker = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x0b0f16, 0.78).setInteractive();
    const panel = this.add.rectangle(INTERNAL_WIDTH / 2, 330, 500, 250, 0x202735, 0.98).setStrokeStyle(3, 0x71809a);
    const title = addText(this, INTERNAL_WIDTH / 2, 264, '기 록 전 일 시 정 지', 34, COLORS.cream, 'center').setOrigin(0.5);
    const detail = addText(this, INTERNAL_WIDTH / 2, 316, '1× 기록 시간 · 보급 · 쿨다운 · 적 스폰 모두 정지', battleUiFontSize(17, 23), '#b8c5d6', 'center').setOrigin(0.5);
    const shortcut = addText(this, INTERNAL_WIDTH / 2, 352, 'P 또는 ESC로 계속', battleUiFontSize(15, 21), '#8f9bae', 'center').setOrigin(0.5);
    const resume = addButton(this, INTERNAL_WIDTH / 2, 414, 220, isCompactMobileViewport() ? 84 : 58, '계 속', () => this.setPaused(false), 0x6b94b7);
    this.pauseOverlay = this.add.container(0, 0, [blocker, panel, title, detail, shortcut, resume]).setDepth(100);
  }

  private drawHud(): void {
    const compact = isCompactMobileViewport();
    const mode = getRecordModeDefinition(this.modeId);
    this.add.rectangle(INTERNAL_WIDTH / 2, 53, INTERNAL_WIDTH, 106, 0x151a24, 0.95);
    addText(this, 35, 14, mode.displayName, battleUiFontSize(27, 34), '#ffffff');
    addText(this, 36, 55, this.authority === 'ACCOUNT_ONLINE' ? '기록 SPECIAL · 서버 검증 · SOLO_ONLY' : '기록 SPECIAL · SOLO_ONLY', battleUiFontSize(16, 22), '#aeb8c8');
    this.timerText = addText(this, 430, 22, '0:00', battleUiFontSize(24, 31), '#dbe2ee', 'center').setOrigin(0.5, 0);
    this.recordText = addText(this, 565, 24, '', battleUiFontSize(17, 22), '#f1d58a', 'center').setOrigin(0.5, 0);
    addText(this, 675, 27, '1× 고정', battleUiFontSize(17, 22), '#9dcdb1', 'center').setOrigin(0.5, 0);
    addButton(this, 760, 55, 108, compact ? 84 : 42, '일시정지', () => this.togglePause(), 0x65758d);
    addText(this, 830, 16, '보급', battleUiFontSize(17, 22), '#d7ddea');
    this.add.rectangle(990, 56, 260, 22, 0x0d1118).setStrokeStyle(2, 0x67738b);
    this.supplyBar = this.add.rectangle(862, 56, 1, 14, 0xe9c965).setOrigin(0, 0.5);
    this.supplyText = addText(this, 1245, 19, '', battleUiFontSize(19, 25), '#f4d577', 'right').setOrigin(1, 0);
    this.supplyLevelText = addText(this, 830, 68, '', battleUiFontSize(16, 21), '#b9c4d4');
  }

  private drawBases(): void {
    const palette = getBattlefieldBasePalette(this.presentationStage);
    const g = this.add.graphics();
    g.fillStyle(palette.player).fillRect(42, 360, 92, 184);
    g.fillStyle(palette.playerRoof).fillTriangle(35, 360, 88, 310, 141, 360);
    g.fillStyle(0x36475e).fillRect(75, 476, 28, 68);
    g.fillStyle(palette.enemy).fillRect(1146, 360, 92, 184);
    g.fillStyle(palette.enemyRoof).fillTriangle(1139, 360, 1192, 310, 1245, 360);
    g.fillStyle(0x55383a).fillRect(1179, 476, 28, 68);
    addText(this, 42, 286, '아군 거점', battleUiFontSize(18, 23), '#cfe5ff');
    addText(this, 1238, 286, '기록전 생성원', battleUiFontSize(18, 23), '#ffd3cc', 'right').setOrigin(1, 0);
    this.add.rectangle(88, 328, 156, 16, 0x161b23).setStrokeStyle(2, 0x7990aa);
    this.playerBaseBar = this.add.rectangle(12, 328, 152, 10, 0x74c7ff).setOrigin(0, 0.5);
    this.playerBaseText = addText(this, 88, 340, '', battleUiFontSize(18, 22), '#e8f5ff', 'center').setOrigin(0.5, 0);
    addText(this, 1192, 325, '파괴 불가', battleUiFontSize(18, 22), '#ffd8d1', 'center').setOrigin(0.5, 0);
  }

  private drawUnitButtons(): void {
    this.add.rectangle(INTERNAL_WIDTH / 2, 630, INTERNAL_WIDTH, 180, 0x151a24, 0.98);
    const compact = isCompactMobileViewport();
    const buttonHeight = compact ? 84 : 62;
    this.activeSlots.slice(0, BATTLE_UNIT_HOTKEY_CODES.length).forEach((slot, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const x = 102 + col * 205;
      const y = compact ? 582 + row * 84 : 579 + row * 72;
      const bg = this.add.rectangle(x, y, 188, buttonHeight, 0x28303e).setStrokeStyle(2, 0x6f8196, 0.9).setInteractive({ useHandCursor: true });
      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x - 69, y, art.family.idle.key, 0).setTint(art.tint).setDepth(4);
      portrait.setScale(((compact ? 60 : 50) / art.family.idle.frameHeight) * art.displayScale);
      if (!compact) addText(this, x + 82, y - 25, getUnitHotkeyLabel(index), 14, '#9fb3ca', 'right').setOrigin(1, 0).setDepth(7);
      addText(this, x - 43, y - 26, slot.displayName, battleUiFontSize(15, 22), '#ffffff').setDepth(5);
      addText(this, x - 43, y + 5, `${slot.cost} 보급`, battleUiFontSize(15, 21), '#f2d37c').setDepth(5);
      const shade = this.add.rectangle(x, y, 188, buttonHeight, 0x05070b, 0).setDepth(6);
      const cooldown = addText(this, x + 82, y + 5, '', battleUiFontSize(15, 21), '#d8e1ef', 'right').setOrigin(1, 0).setDepth(7);
      bg.on('pointerdown', () => this.trySpawn(slot.slotId));
      this.buttons.set(slot.slotId, { shade, cooldown });
    });

    const controlHeight = compact ? 84 : 60;
    const upgradeY = compact ? 582 : 580;
    const weaponY = compact ? 666 : 651;
    const upgradeBg = this.add.rectangle(1145, upgradeY, 220, controlHeight, 0x302a1c).setStrokeStyle(3, 0xc59d4b).setInteractive({ useHandCursor: true });
    this.supplyUpgradeText = addText(this, 1145, compact ? 568 : 570, '', battleUiFontSize(17, 22), '#ffe29a', 'center').setOrigin(0.5);
    addText(this, 1145, compact ? 598 : 594, compact ? '보급소 강화' : 'Q · 보급소 강화', battleUiFontSize(16, 21), '#ffffff', 'center').setOrigin(0.5);
    upgradeBg.on('pointerdown', () => this.tryUpgradeSupplyInput());
    this.baseWeaponBg = this.add.rectangle(1145, weaponY, 220, controlHeight, 0x26394a).setStrokeStyle(3, 0x72b7db).setInteractive({ useHandCursor: true });
    this.baseWeaponText = addText(this, 1145, weaponY, '', battleUiFontSize(16, 20), '#bfe8ff', 'center').setOrigin(0.5);
    this.baseWeaponBg.on('pointerdown', () => this.tryFireBaseWeaponInput());
  }

  private toScreenX(anchorX: number): number {
    return 112 + (anchorX / this.battleState().battle.mapLength) * (1168 - 112);
  }

  private createUnitView(unit: BattleUnit): RecordUnitView {
    const art = familyForUnit(unit.definition.id);
    const x = this.toScreenX(unit.anchorX);
    const shadow = this.add.ellipse(x, 524, 58 * Math.min(1.45, art.displayScale), 12, 0x101216, 0.34).setDepth(2);
    const sprite = this.add.sprite(x, 490, art.family.run.key, 0).setTint(art.tint).setDepth(3);
    sprite.setFlipX(unit.team === 'ENEMY');
    sprite.setScale((art.family.displayHeight / art.family.run.frameHeight) * art.displayScale);
    const hpBg = this.add.rectangle(x, 443, 54, 7, 0x161a21).setDepth(5);
    const hp = this.add.rectangle(x - 26, 443, 52, 5, unit.team === 'PLAYER' ? 0x78dca0 : 0xf1837c).setOrigin(0, 0.5).setDepth(6);
    const trait = addText(this, x, 422, unit.team === 'ENEMY' ? formatCompactTraits(unit.definition) : '', battleUiFontSize(13, 17), '#ffd0c8', 'center').setOrigin(0.5).setDepth(7);
    return { sprite, shadow, hpBg, hp, trait, stateKey: '' };
  }

  private syncUnits(): void {
    const present = new Set<number>();
    for (const unit of this.battleState().battle.units) {
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
      const frame = this.frameForState(art.family, strip, unit);
      if (frame >= 0 && frame < strip.frames) view.sprite.setFrame(frame);
      view.sprite.x = this.toScreenX(unit.anchorX);
      view.sprite.y = unit.state === UnitState.NaturalKnockback ? 486 : 490;
      view.sprite.setAlpha(unit.state === UnitState.Dying ? Math.max(0.15, 1 - unit.stateFrame / Math.max(1, unit.definition.deathFrames)) : 1);
      view.sprite.setAngle(unit.state === UnitState.Dying ? (unit.team === 'PLAYER' ? -1 : 1) * Math.min(70, unit.stateFrame * 5) : 0);
      view.shadow.x = view.sprite.x;
      view.hpBg.x = view.sprite.x;
      view.hp.x = view.sprite.x - 26;
      view.hp.displayWidth = Math.max(1, 52 * Math.max(0, unit.hp / unit.definition.maxHp));
      view.hpBg.setVisible(unit.state !== UnitState.Dying);
      view.hp.setVisible(unit.state !== UnitState.Dying);
      view.trait.x = view.sprite.x;
      view.trait.setVisible(unit.team === 'ENEMY' && unit.state !== UnitState.Dying && (unit.definition.combatTags ?? []).includes('BOSS'));
    }
    for (const [simulationId, view] of this.views) {
      if (present.has(simulationId)) continue;
      view.sprite.destroy();
      view.shadow.destroy();
      view.hpBg.destroy();
      view.hp.destroy();
      view.trait.destroy();
      this.views.delete(simulationId);
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
    return getLoopingSpriteFrame(strip.frames, this.battleState().battle.tick, unit.simulationId);
  }

  private syncEnemyDiscoveries(): void {
    const newlySeen = [...new Set(this.battleState().battle.units
      .filter((unit) => unit.team === 'ENEMY')
      .map((unit) => unit.definition.id)
      .filter((enemyId) => !this.discoveredEnemyIds.has(enemyId)))];
    if (newlySeen.length === 0) return;
    for (const enemyId of newlySeen) this.discoveredEnemyIds.add(enemyId);
    if (this.authority !== 'GUEST_LOCAL') return;
    this.enemyDiscoveryWrite = this.enemyDiscoveryWrite
      .then(async () => {
        const result = await recordGuestEnemyDiscoveries(newlySeen);
        for (const enemyId of result.discoveredEnemyIds) this.discoveredEnemyIds.add(enemyId);
      })
      .catch(() => undefined);
  }

  private syncBossWarnings(): void {
    for (const unit of this.battleState().battle.units) {
      if (unit.team !== 'ENEMY' || unit.state === UnitState.Dying) continue;
      if (!(unit.definition.combatTags ?? []).includes('BOSS')) continue;
      if (this.seenBossSimulationIds.has(unit.simulationId)) continue;
      this.seenBossSimulationIds.add(unit.simulationId);
      const enemy = this.battleState().enemies.find((candidate) => candidate.definition.id === unit.definition.id);
      showBossArrival(this, enemy?.displayName ?? '우두머리');
    }
  }

  private syncHud(): void {
    const state = this.battleState();
    const supplyLevel = getCurrentSupplyLevel(state);
    const supplyRatio = Math.min(1, state.supply / supplyLevel.maxSupply);
    this.supplyBar.displayWidth = Math.max(1, 256 * supplyRatio);
    this.supplyText.setText(`${state.supply.toLocaleString()} / ${supplyLevel.maxSupply.toLocaleString()}`);
    this.supplyLevelText.setText(`보급소 Lv.${state.supplyLevel} · +${supplyLevel.incomePerSecond}/초`);
    const next = getNextSupplyLevel(state);
    this.supplyUpgradeText.setText(next ? `Lv.${state.supplyLevel + 1} · ${next.upgradeCost}` : 'MAX');
    this.timerText.setText(formatTimeFromTicks(state.battle.tick));
    this.recordText.setText(this.runtime.mode === 'ENDLESS_FRONT'
      ? `${getEndlessRecordReachedMinute(this.runtime)}분 경계`
      : `${this.runtime.defeatedBosses} / ${BOSS_RUSH_SEQUENCE.length} 격파`);

    const weaponId = state.baseWeapon.id ?? 'base_weapon_front_cannon';
    const weaponName = BASE_WEAPON_UNLOCKS.find((weapon) => weapon.id === weaponId)?.displayName ?? '거점 병기';
    const weaponCooldown = getBaseWeaponCooldownRemaining(state);
    const weaponPrefix = isCompactMobileViewport() ? weaponName : `E · ${weaponName}`;
    if (weaponCooldown > 0) {
      this.baseWeaponText.setText(`${weaponPrefix} · ${(weaponCooldown / 30).toFixed(1)}초`);
      this.baseWeaponText.setColor('#9aa9b8');
      this.baseWeaponBg.setFillStyle(0x25303a, 1);
    } else {
      this.baseWeaponText.setText(`${weaponPrefix} · 사용 가능`);
      this.baseWeaponText.setColor('#bfe8ff');
      this.baseWeaponBg.setFillStyle(0x26394a, 1);
    }

    const playerBase = state.battle.bases.PLAYER;
    this.playerBaseBar.displayWidth = Math.max(1, 152 * Math.max(0, playerBase.hp / playerBase.maxHp));
    this.playerBaseText.setText(`${playerBase.hp.toLocaleString()} / ${playerBase.maxHp.toLocaleString()}`);
    for (const slot of this.activeSlots) {
      const view = this.buttons.get(slot.slotId);
      if (!view) continue;
      const cooldown = getCooldownRemaining(state, slot.slotId);
      const affordable = state.supply >= slot.cost;
      view.shade.setAlpha(cooldown > 0 || !affordable ? 0.48 : 0);
      view.cooldown.setText(cooldown > 0 ? `${(cooldown / 30).toFixed(1)}s` : affordable ? '소환' : '부족');
      view.cooldown.setColor(cooldown > 0 ? '#b9c2cf' : affordable ? '#8ee3aa' : '#ff9a91');
    }
  }

  private playBaseWeaponFx(): void {
    const kind = this.battleState().baseWeapon.kind ?? 'FRONT_CANNON';
    if (kind === 'AEGIS_EMITTER') {
      const shield = this.add.rectangle(590, 466, 900, 130, 0x79c9ff, 0.12).setStrokeStyle(4, 0xaee4ff, 0.8).setDepth(18);
      this.tweens.add({ targets: shield, alpha: 0, scaleY: 1.18, duration: 380, onComplete: () => shield.destroy() });
      return;
    }
    if (kind === 'SUPPLY_DROP') {
      const crate = this.add.rectangle(180, 250, 44, 44, 0xd9b65f, 0.95).setStrokeStyle(4, 0xffe49a).setDepth(20);
      const pulse = this.add.circle(180, 490, 28, 0xffdc7a, 0.2).setStrokeStyle(4, 0xffe9aa, 0.8).setDepth(19);
      this.tweens.add({ targets: crate, y: 475, duration: 320, ease: 'Quad.easeIn', onComplete: () => crate.destroy() });
      this.tweens.add({ targets: pulse, alpha: 0, scaleX: 2.2, scaleY: 2.2, duration: 520, onComplete: () => pulse.destroy() });
      return;
    }
    const muzzle = this.add.circle(130, 452, 24, 0xffe69a, 0.9).setDepth(20);
    const beam = this.add.rectangle(650, 452, 1010, 16, 0xffe69a, 0.88).setDepth(19);
    this.tweens.add({ targets: [muzzle, beam], alpha: 0, duration: 230, onComplete: () => { muzzle.destroy(); beam.destroy(); } });
  }

  private finishRecord(): void {
    if (this.resolved) return;
    this.resolved = true;
    const score = this.runtime.mode === 'ENDLESS_FRONT'
      ? { modeId: this.modeId, survivalMs: getEndlessRecordSurvivalMs(this.runtime) }
      : { modeId: this.modeId, defeatedBosses: this.runtime.defeatedBosses, completed: this.runtime.completed };
    const proof = this.authority === 'ACCOUNT_ONLINE' && this.trustedBattleId
      ? { trustedBattleId: this.trustedBattleId, trustedCommands: [...this.trustedCommands] }
      : {};
    this.time.delayedCall(550, () => this.scene.start('record-result', { ...score, ...proof }));
  }
}
