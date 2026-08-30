import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
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
import { accountSnapshotToGuestProgress, loadActiveProgress } from './active-progress';
import {
  getAccountClientState,
  startAuthenticatedTrustedBattle,
  type AccountTrustedBattleStart,
} from './account-network';
import { type ArtFamily, type AttackFxStyle, type SpriteStrip } from './assets';
import { BASE_WEAPON_UNLOCKS } from './base-weapon-progression';
import { BATTLEFIELD_THEME_LABELS, drawBattlefield, getBattlefieldBasePalette } from './battlefield';
import { showBossArrival } from './boss-warning';
import { classifyImpact, getAttackSpriteFrame, getLoopingSpriteFrame } from './combat-visuals';
import { formatCompactTraits } from './combat-trait-labels';
import { buildGuestDeckSlots, createGuestPrototypeBattle } from './player-loadout';
import { getProjectileArcOffsetY, getProjectileTravelPlan, usesTravelProjectile } from './projectile-visuals';
import { STAGES, getStage, type PrototypeRosterSlot, type PrototypeStage } from './prototype';
import { recordGuestEnemyDiscoveries } from './save';
import {
  BATTLE_UNIT_HOTKEY_CODES,
  COLORS,
  addButton,
  addText,
  battleUiFontSize,
  familyForUnit,
  getUnitHotkeyLabel,
  rarityColor,
} from './scene-ui';
import { isSortieStageUnlocked } from './stage-navigation';
import { selectVisibleTraitLabelIds } from './trait-label-visibility';
import { TrustedBattleCommandRecorder } from './trusted-battle-command-recorder';
import type { TrustedBattleTerminalProof } from './trusted-battle-result';
import { isCompactMobileViewport, isPortraitMobileViewport } from './viewport';

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

const STORY_BADGE_COLOR = '#d7c79f';
const SPECIAL_BADGE_COLOR = '#9fd7d0';

type BattleAuthority = 'GUEST_LOCAL' | 'ACCOUNT_TRUSTED';

function getSlotBadge(slot: PrototypeRosterSlot): { readonly label: string; readonly color: string } {
  if (slot.rarity) return { label: slot.rarity, color: rarityColor[slot.rarity] ?? '#ffffff' };
  if (slot.acquisitionClass === 'STORY') return { label: '스토리', color: STORY_BADGE_COLOR };
  if (slot.acquisitionClass === 'SPECIAL') return { label: '특수', color: SPECIAL_BADGE_COLOR };
  return { label: '동료', color: '#ffffff' };
}

function getBaseWeaponDisplayName(state: PlayableBattleState): string {
  const id = state.baseWeapon.id;
  return BASE_WEAPON_UNLOCKS.find((weapon) => weapon.id === id)?.displayName
    ?? (state.baseWeapon.kind === 'AEGIS_EMITTER' ? '결계발진기' : state.baseWeapon.kind === 'SUPPLY_DROP' ? '보급낙하기' : '전선포격기');
}

export class BattleScene extends Phaser.Scene {
  private state!: PlayableBattleState;
  private stage!: PrototypeStage;
  private activeSlots: readonly PrototypeRosterSlot[] = [];
  private accumulator = 0;
  private views = new Map<number, UnitView>();
  private buttons = new Map<string, UnitButtonView>();
  private projectiles: ProjectileView[] = [];
  private seenBossSimulationIds = new Set<number>();
  private discoveredEnemyIds = new Set<string>();
  private enemyDiscoveryWrite: Promise<void> = Promise.resolve();
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
  private manuallyPaused = false;
  private pauseOverlay: Phaser.GameObjects.Container | undefined;
  private battleAuthority: BattleAuthority = 'GUEST_LOCAL';
  private trustedStart: AccountTrustedBattleStart | undefined;
  private trustedRecorder: TrustedBattleCommandRecorder | undefined;

  constructor() { super('battle'); }

  init(data: { stageId?: string }): void {
    this.stage = getStage(data.stageId ?? STAGES[0]!.id);
    this.accumulator = 0;
    this.ready = false;
    this.resolved = false;
    this.manuallyPaused = false;
    this.pauseOverlay = undefined;
    this.lastPlayerBaseHp = 0;
    this.lastEnemyBaseHp = 0;
    this.views.clear();
    this.buttons.clear();
    this.projectiles = [];
    this.seenBossSimulationIds.clear();
    this.discoveredEnemyIds.clear();
    this.enemyDiscoveryWrite = Promise.resolve();
    this.activeSlots = [];
    this.battleAuthority = 'GUEST_LOCAL';
    this.trustedStart = undefined;
    this.trustedRecorder = undefined;
  }

  create(): void {
    drawBattlefield(this, this.stage);
    const loading = addText(this, INTERNAL_WIDTH / 2, 330, '편성과 전장 불러오는 중…', 25, '#ffffff', 'center').setOrigin(0.5);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.handleBattleHotkey(event));
    void this.initializeBattle(loading).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      loading.setText(error instanceof Error ? `출정 실패 · ${error.message}` : '출정 준비에 실패했습니다.').setColor('#ff9a91');
      this.time.delayedCall(900, () => { if (this.scene.isActive()) this.scene.start('stage-hub'); });
    });
  }

  private async initializeBattle(loading: Phaser.GameObjects.Text): Promise<void> {
    const view = await loadActiveProgress();
    if (!this.scene.isActive()) return;
    if (view.authority === 'ACCOUNT_OFFLINE_CACHE') throw new Error('로그인 계정은 온라인 상태에서만 전투를 시작할 수 있습니다.');

    let progress = view.progress;
    if (!isSortieStageUnlocked(this.stage.id, progress.clearedStageIds, progress.specialClearedStageIds)) {
      this.scene.start('stage-hub');
      return;
    }

    if (view.authority === 'ACCOUNT_ONLINE') {
      loading.setText('서버 전투 ticket 발급 중…');
      const kind = this.stage.stageType === 'SPECIAL' ? 'SPECIAL' : 'MAIN';
      const start = await startAuthenticatedTrustedBattle(kind, this.stage.id);
      if (!this.scene.isActive()) return;
      const accountState = getAccountClientState();
      if (accountState.kind !== 'AUTHENTICATED_ONLINE' || accountState.remote.revision !== start.startRevision) {
        throw new Error('전투 ticket과 현재 계정 revision이 일치하지 않습니다.');
      }
      progress = accountSnapshotToGuestProgress(accountState.remote.snapshot);
      this.battleAuthority = 'ACCOUNT_TRUSTED';
      this.trustedStart = start;
      this.trustedRecorder = new TrustedBattleCommandRecorder();
    }

    this.discoveredEnemyIds = new Set(progress.discoveredEnemyIds ?? []);
    this.activeSlots = buildGuestDeckSlots(progress);
    this.state = createGuestPrototypeBattle(this.stage.id, progress);
    if (this.trustedStart && this.state.stateHash !== this.trustedStart.initialStateHash) {
      throw new Error('서버와 로컬의 초기 전투 state hash가 일치하지 않습니다.');
    }
    this.lastPlayerBaseHp = this.state.battle.bases.PLAYER.hp;
    this.lastEnemyBaseHp = this.state.battle.bases.ENEMY.hp;
    loading.destroy();
    this.drawHud();
    this.drawBases();
    this.drawUnitButtons();
    this.ready = true;
    this.syncEnemyDiscoveries();
    this.syncHud();
  }

  update(_: number, delta: number): void {
    if (!this.ready || this.resolved || this.manuallyPaused || isPortraitMobileViewport()) return;
    this.accumulator += Math.min(delta, 120);
    while (this.accumulator >= SIM_TICK_MS && this.state.battle.winner === null) {
      this.syncProjectileLaunches();
      stepPlayableBattle(this.state);
      this.accumulator -= SIM_TICK_MS;
    }
    this.syncEnemyDiscoveries();
    this.syncBossWarnings();
    this.syncProjectileViews();
    this.syncUnits();
    this.syncHud();
    if (this.state.battle.winner !== null) {
      this.resolved = true;
      const winner = this.state.battle.winner;
      if (this.battleAuthority === 'ACCOUNT_TRUSTED') {
        const start = this.trustedStart;
        const recorder = this.trustedRecorder;
        if (!start || !recorder) throw new Error('trusted battle terminal state is missing ticket or recorder');
        const proof: TrustedBattleTerminalProof = {
          battleId: start.battleId,
          kind: start.kind,
          targetId: start.targetId,
          commands: recorder.seal(),
          localWinner: winner,
          localClearFrames: this.state.battle.tick,
          localFinalStateHash: this.state.stateHash,
          localPlayerBaseHp: this.state.battle.bases.PLAYER.hp,
          localEnemyBaseHp: this.state.battle.bases.ENEMY.hp,
        };
        this.time.delayedCall(700, () => this.scene.start('trusted-result', { proof }));
      } else {
        this.time.delayedCall(700, () => this.scene.start('result', { stageId: this.stage.id, winner }));
      }
    }
  }

  private canAcceptBattleAction(): boolean {
    return this.ready && !this.resolved && !this.manuallyPaused && !isPortraitMobileViewport();
  }

  private handleBattleHotkey(event: KeyboardEvent): void {
    if (event.code === 'KeyP' || event.code === 'Escape') {
      this.toggleManualPause();
      return;
    }
    if (!this.canAcceptBattleAction()) return;

    const slotIndex = BATTLE_UNIT_HOTKEY_CODES.indexOf(event.code);
    if (slotIndex >= 0) {
      const slot = this.activeSlots[slotIndex];
      if (slot) this.trySpawnSlot(slot.slotId);
      return;
    }
    if (event.code === 'KeyQ') {
      this.tryUpgradeSupplyInput();
      return;
    }
    if (event.code === 'KeyE') this.tryFireBaseWeaponInput();
  }

  private trySpawnSlot(slotId: string): void {
    if (!this.canAcceptBattleAction()) return;
    const tick = this.state.battle.tick;
    const result = trySpawnPlayerUnit(this.state, slotId);
    this.trustedRecorder?.recordSpawn(tick, slotId, result.ok);
  }

  private tryUpgradeSupplyInput(): void {
    if (!this.canAcceptBattleAction()) return;
    const tick = this.state.battle.tick;
    const result = tryUpgradeSupply(this.state);
    this.trustedRecorder?.recordSupplyUpgrade(tick, result.ok);
  }

  private tryFireBaseWeaponInput(): void {
    if (!this.canAcceptBattleAction()) return;
    const tick = this.state.battle.tick;
    const result = tryFireBaseWeapon(this.state);
    this.trustedRecorder?.recordBaseWeapon(tick, result.ok);
    if (result.ok) this.playBaseWeaponFx();
  }

  private toggleManualPause(): void {
    if (!this.ready || this.resolved) return;
    this.setManualPaused(!this.manuallyPaused);
  }

  private setManualPaused(paused: boolean): void {
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
    const panel = this.add.rectangle(INTERNAL_WIDTH / 2, 330, 480, 250, 0x202735, 0.98).setStrokeStyle(3, 0x71809a);
    const title = addText(this, INTERNAL_WIDTH / 2, 266, '일 시 정 지', 40, COLORS.cream, 'center').setOrigin(0.5);
    const detail = addText(this, INTERNAL_WIDTH / 2, 316, '솔로 전투 정지 · 보급·쿨다운·적 스폰도 멈춤', battleUiFontSize(17, 24), '#b8c5d6', 'center').setOrigin(0.5);
    const shortcut = addText(this, INTERNAL_WIDTH / 2, 352, 'P 또는 ESC로도 계속할 수 있습니다.', battleUiFontSize(15, 22), '#8f9bae', 'center').setOrigin(0.5);
    const resume = addButton(this, INTERNAL_WIDTH / 2, 414, 220, isCompactMobileViewport() ? 84 : 58, '계 속', () => this.setManualPaused(false), 0x6b94b7);
    this.pauseOverlay = this.add.container(0, 0, [blocker, panel, title, detail, shortcut, resume]).setDepth(100);
  }

  private syncEnemyDiscoveries(): void {
    const newlySeen = [...new Set(this.state.battle.units
      .filter((unit) => unit.team === 'ENEMY')
      .map((unit) => unit.definition.id)
      .filter((enemyId) => !this.discoveredEnemyIds.has(enemyId)))];
    if (newlySeen.length === 0) return;
    for (const enemyId of newlySeen) this.discoveredEnemyIds.add(enemyId);
    if (this.battleAuthority !== 'GUEST_LOCAL') return;
    this.enemyDiscoveryWrite = this.enemyDiscoveryWrite
      .then(async () => {
        const result = await recordGuestEnemyDiscoveries(newlySeen);
        for (const enemyId of result.discoveredEnemyIds) this.discoveredEnemyIds.add(enemyId);
      })
      .catch(() => undefined);
  }

  private syncBossWarnings(): void {
    for (const unit of this.state.battle.units) {
      if (unit.team !== 'ENEMY' || unit.state === UnitState.Dying) continue;
      if (!(unit.definition.combatTags ?? []).includes('BOSS')) continue;
      if (this.seenBossSimulationIds.has(unit.simulationId)) continue;
      this.seenBossSimulationIds.add(unit.simulationId);
      const enemy = this.state.enemies.find((candidate) => candidate.definition.id === unit.definition.id);
      showBossArrival(this, enemy?.displayName ?? '우두머리');
    }
  }

  private drawHud(): void {
    const compact = isCompactMobileViewport();
    this.add.rectangle(INTERNAL_WIDTH / 2, 53, INTERNAL_WIDTH, 106, 0x151a24, 0.95);
    addText(this, 35, 16, this.stage.name, battleUiFontSize(28, 34), '#ffffff');
    addText(this, 36, 56, `${this.stage.chapter} · ${BATTLEFIELD_THEME_LABELS[this.stage.theme]} · ${this.stage.mapLength}m`, battleUiFontSize(17, 23), '#aeb8c8');
    this.timerText = addText(this, 585, 25, '0:00', battleUiFontSize(23, 30), '#dbe2ee', 'center').setOrigin(0.5, 0);
    addButton(this, 690, 55, 108, compact ? 84 : 42, '일시정지', () => this.toggleManualPause(), 0x65758d);

    addText(this, 760, 18, '보급', battleUiFontSize(18, 23), '#d7ddea');
    this.add.rectangle(930, 56, 300, 22, 0x0d1118).setStrokeStyle(2, 0x67738b);
    this.supplyBar = this.add.rectangle(782, 56, 1, 14, 0xe9c965).setOrigin(0, 0.5);
    this.supplyText = addText(this, 1084, 20, '', battleUiFontSize(21, 28), '#f4d577', 'right').setOrigin(1, 0);
    this.supplyLevelText = addText(this, 760, 68, '', battleUiFontSize(18, 23), '#b9c4d4');
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

    addText(this, 42, 286, '아군 거점', battleUiFontSize(18, 23), '#cfe5ff');
    addText(this, 1238, 286, '적 거점', battleUiFontSize(18, 23), '#ffd3cc', 'right').setOrigin(1, 0);
    this.add.rectangle(88, 328, 156, 16, 0x161b23).setStrokeStyle(2, 0x7990aa);
    this.add.rectangle(1192, 328, 156, 16, 0x161b23).setStrokeStyle(2, 0xaa716c);
    this.playerBaseBar = this.add.rectangle(12, 328, 152, 10, 0x74c7ff).setOrigin(0, 0.5);
    this.enemyBaseBar = this.add.rectangle(1116, 328, 152, 10, 0xff8f82).setOrigin(0, 0.5);
    this.playerBaseText = addText(this, 88, 340, '', battleUiFontSize(18, 22), '#e8f5ff', 'center').setOrigin(0.5, 0);
    this.enemyBaseText = addText(this, 1192, 340, '', battleUiFontSize(18, 22), '#ffe6e1', 'center').setOrigin(0.5, 0);
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
      const hotkeyLabel = getUnitHotkeyLabel(index);
      const badge = getSlotBadge(slot);
      const border = Phaser.Display.Color.HexStringToColor(badge.color).color;
      const bg = this.add.rectangle(x, y, 188, buttonHeight, 0x28303e).setStrokeStyle(2, border, 0.85);
      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x - 69, y, art.family.idle.key, 0).setTint(art.tint).setDepth(4);
      portrait.setScale(((compact ? 60 : 50) / art.family.idle.frameHeight) * art.displayScale);
      if (!compact) addText(this, x + 82, y - 25, hotkeyLabel, 14, '#9fb3ca', 'right').setOrigin(1, 0).setDepth(7);

      bg.setInteractive({ useHandCursor: true });
      const shade = this.add.rectangle(x, y, 188, buttonHeight, 0x05070b, 0).setDepth(6);
      const unitButtonName = compact ? slot.displayName : `${badge.label} · ${slot.displayName}`;
      addText(this, x - 43, y - 26, unitButtonName, battleUiFontSize(15, 22), '#ffffff').setDepth(5);
      const cost = addText(this, x - 43, y + 5, `${slot.cost} 보급`, battleUiFontSize(15, 21), '#f2d37c').setDepth(5);
      const cooldown = addText(this, x + 82, y + 5, '', battleUiFontSize(15, 21), '#d8e1ef', 'right').setOrigin(1, 0).setDepth(7);
      bg.on('pointerdown', () => this.trySpawnSlot(slot.slotId));
      this.buttons.set(slot.slotId, { bg, shade, cooldown, cost });
    });

    const controlHeight = compact ? 84 : 60;
    const upgradeY = compact ? 582 : 580;
    const weaponY = compact ? 666 : 651;
    const upgradeBg = this.add.rectangle(1145, upgradeY, 220, controlHeight, 0x302a1c).setStrokeStyle(3, 0xc59d4b).setInteractive({ useHandCursor: true });
    this.supplyUpgradeText = addText(this, 1145, compact ? 568 : 570, '', battleUiFontSize(17, 22), '#ffe29a', 'center').setOrigin(0.5);
    addText(this, 1145, compact ? 598 : 594, compact ? '보급소 강화' : 'Q · 보급소 강화', battleUiFontSize(16, 21), '#ffffff', 'center').setOrigin(0.5);
    upgradeBg.on('pointerdown', () => this.tryUpgradeSupplyInput());

    const weaponName = getBaseWeaponDisplayName(this.state);
    this.baseWeaponBg = this.add.rectangle(1145, weaponY, 220, controlHeight, 0x26394a).setStrokeStyle(3, 0x72b7db).setInteractive({ useHandCursor: true });
    this.baseWeaponText = addText(this, 1145, weaponY, compact ? `${weaponName} · 사용 가능` : `E · ${weaponName} · 사용 가능`, battleUiFontSize(17, 20), '#bfe8ff', 'center').setOrigin(0.5);
    this.baseWeaponBg.on('pointerdown', () => this.tryFireBaseWeaponInput());
  }

  private playBaseWeaponFx(): void {
    if (this.state.baseWeapon.kind === 'AEGIS_EMITTER') {
      const field = this.add.ellipse(635, 488, 1020, 118, 0x74cfff, 0.14).setStrokeStyle(4, 0xbdeaff, 0.9).setDepth(18);
      const core = this.add.ellipse(635, 488, 880, 84, 0xcdf4ff, 0.08).setDepth(17);
      this.tweens.add({
        targets: [field, core],
        alpha: 0,
        scaleX: 1.08,
        scaleY: 1.18,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () => { field.destroy(); core.destroy(); },
      });
      return;
    }
    if (this.state.baseWeapon.kind === 'SUPPLY_DROP') {
      const crate = this.add.rectangle(195, 250, 48, 42, 0xd4aa62, 0.98).setStrokeStyle(3, 0xffe3a6).setDepth(20);
      const canopy = this.add.arc(195, 220, 42, 180, 360, false, 0xe7edf5, 0.9).setDepth(19);
      const lineA = this.add.line(0, 0, 160, 222, 178, 250, 0xf3f5f8, 0.78).setOrigin(0).setDepth(19);
      const lineB = this.add.line(0, 0, 230, 222, 212, 250, 0xf3f5f8, 0.78).setOrigin(0).setDepth(19);
      this.tweens.add({
        targets: [crate, canopy, lineA, lineB],
        y: '+=175',
        duration: 320,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.tweens.add({
            targets: [crate, canopy, lineA, lineB],
            alpha: 0,
            duration: 160,
            onComplete: () => { crate.destroy(); canopy.destroy(); lineA.destroy(); lineB.destroy(); },
          });
        },
      });
      return;
    }
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
    const trait = addText(this, sprite.x, 425, unit.team === 'ENEMY' ? formatCompactTraits(unit.definition) : '', battleUiFontSize(14, 18), '#ffd0c8', 'center').setOrigin(0.5).setDepth(7);

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
      view.trait.setVisible(false);
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
    this.syncTraitLabelVisibility();
  }

  private syncTraitLabelVisibility(): void {
    const candidates = this.state.battle.units.flatMap((unit) => {
      if (unit.team !== 'ENEMY' || unit.state === UnitState.Dying) return [];
      const view = this.views.get(unit.simulationId);
      if (!view) return [];
      return [{
        simulationId: unit.simulationId,
        screenX: view.sprite.x,
        isBoss: (unit.definition.combatTags ?? []).includes('BOSS'),
      }];
    });
    const visibleIds = selectVisibleTraitLabelIds(candidates, 76);
    for (const unit of this.state.battle.units) {
      const view = this.views.get(unit.simulationId);
      if (!view) continue;
      view.trait.setVisible(unit.team === 'ENEMY' && unit.state !== UnitState.Dying && visibleIds.has(unit.simulationId));
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
    const weaponName = getBaseWeaponDisplayName(this.state);
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
