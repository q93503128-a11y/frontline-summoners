import Phaser from 'phaser';
import {
  COOP_QUICK_MESSAGE_IDS,
  COOP_QUICK_MESSAGE_LABELS,
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  type CoopQuickMessageId,
} from '@frontline/shared';
import type { BaseWeaponId } from '@frontline/sim/playable';
import { refreshAuthenticatedAccount } from './account-network';
import { accountCoopLoadout, getAuthenticatedCoopClientProgress, type AccountCoopClientProgress } from './coop-account-progress';
import { CoopSession, type CoopBattleSnapshot, type CoopServerMessage } from './coop-network';
import { BASE_WEAPON_UNLOCKS, getUnlockedBaseWeaponIds } from './base-weapon-progression';
import { ENEMIES, getSlotById, getStage, type PrototypeStage } from './prototype';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

function baseWeaponName(id: BaseWeaponId | null | undefined): string {
  return BASE_WEAPON_UNLOCKS.find((entry) => entry.id === id)?.displayName ?? '전선포격기';
}

function connectionLabel(state: CoopSession['connectionState']): string {
  if (state === 'OPEN') return '연결됨';
  if (state === 'RECONNECTING') return '재접속 중…';
  if (state === 'CONNECTING') return '연결 중…';
  return '연결 종료';
}

export class FriendCoopLobbyScene extends Phaser.Scene {
  private websocketPath = '';
  private progress: AccountCoopClientProgress | null = null;
  private session: CoopSession | null = null;
  private contentLayer?: Phaser.GameObjects.Container;
  private statusText?: Phaser.GameObjects.Text;
  private unsubscribeMessage?: () => void;
  private unsubscribeConnection?: () => void;

  constructor() { super('friend-coop-lobby'); }

  init(data: { websocketPath?: string } = {}): void {
    this.websocketPath = data.websocketPath ?? '';
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 34, '친구 협동', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 88, '로그인 계정 편성 · 각자 개인 보급 · 공유 기지/병기', compact ? 20 : 17, COLORS.muted);
    addButton(this, 1170, 62, 160, compact ? 78 : 50, '친구', () => this.leave('social'), 0x6b628f);
    this.statusText = addText(this, INTERNAL_WIDTH / 2, 620, '계정 전투 정보를 확인하는 중…', compact ? 20 : 16, '#a9b5c5', 'center').setOrigin(0.5);

    this.progress = getAuthenticatedCoopClientProgress();
    if (!this.progress || this.progress.deckSlotIds.length < 1 || !this.websocketPath) {
      this.statusText.setText(!this.progress ? '온라인 로그인 상태가 필요합니다.' : '친구 협동 편성 또는 초대 정보가 없습니다.').setColor('#ff9a91');
      return;
    }

    this.session = new CoopSession(this.websocketPath);
    this.unsubscribeMessage = this.session.subscribe((message) => this.onMessage(message));
    this.unsubscribeConnection = this.session.subscribeConnection((state) => {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(`친구 협동 서버 · ${connectionLabel(state)}`);
      this.statusText?.setColor(state === 'OPEN' ? '#8ee3aa' : state === 'RECONNECTING' ? '#ffd493' : '#a9b5c5');
      this.render();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupSubscriptions());
    this.session.connect();
    this.render();
  }

  private render(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const room = this.session?.room;
    if (!room || !this.session || !this.progress) {
      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 320, '친구 방 연결 중…', compact ? 28 : 24, '#c3ccd8', 'center').setOrigin(0.5));
      return;
    }
    const stage = getStage(room.stageId);
    this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 145, stage.name, compact ? 34 : 30, '#fff4cf', 'center').setOrigin(0.5));
    this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 185, 'FRIEND ROOM · 계정 귀속 좌석', compact ? 18 : 14, '#bba7da', 'center').setOrigin(0.5));

    room.seats.forEach((seat, index) => {
      const x = index === 0 ? 405 : 875;
      const mine = seat.seatId === this.session!.seatId;
      const panel = this.add.rectangle(x, 345, 370, 285, mine ? 0x29364a : 0x272d38, 0.98).setStrokeStyle(3, mine ? 0x6fa2d0 : 0x566171, 1);
      this.contentLayer!.add(panel);
      this.contentLayer!.add(addText(this, x, 250, `${seat.seatId} 지휘관${mine ? ' · 나' : ''}`, compact ? 27 : 23, '#ffffff', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 298, seat.connected ? '온라인' : '접속 대기', compact ? 21 : 17, seat.connected ? '#8ee3aa' : '#a3adba', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 340, `계정 편성 ${seat.deckSize}/5 · ${seat.ready ? '준비 완료' : '준비 전'}`, compact ? 20 : 16, seat.ready ? '#f0d67d' : '#bbc4cf', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 382, `공유 병기 · ${baseWeaponName(seat.selectedBaseWeaponId)}`, compact ? 19 : 16, '#bfe8ff', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 424, seat.control === 'AI' ? '재접속 대기 · AI 임시 지휘' : '플레이어 제어', compact ? 18 : 14, seat.control === 'AI' ? '#ffd493' : '#9fcfff', 'center').setOrigin(0.5));
    });

    const mine = room.seats.find((seat) => seat.seatId === this.session!.seatId);
    const agreement = room.agreedBaseWeaponId
      ? `공유 병기 합의 · ${baseWeaponName(room.agreedBaseWeaponId)}`
      : '병기 불일치 · 두 지휘관이 같은 병기를 선택해야 합니다.';
    this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 505, agreement, compact ? 20 : 16, room.agreedBaseWeaponId ? '#8ee3aa' : '#ffd493', 'center').setOrigin(0.5));
    this.contentLayer.add(addButton(this, 360, 560, 260, compact ? 80 : 58, mine?.ready ? '준비 취소 후 병기 변경' : `병기 변경 · ${baseWeaponName(mine?.selectedBaseWeaponId)}`, () => this.cycleWeapon(), mine?.ready ? 0x4e555f : 0x4f7894));
    this.contentLayer.add(addButton(this, 650, 560, 210, compact ? 80 : 58, mine?.ready ? '준비 취소' : '준비', () => this.toggleReady(), mine?.ready ? 0x766854 : 0x5f8f75));
    this.contentLayer.add(addButton(this, 910, 560, 210, compact ? 80 : 58, '나가기', () => this.leave('social'), 0x8d5f64));
  }

  private onMessage(message: CoopServerMessage): void {
    if (!this.scene.isActive() || !this.session || !this.progress) return;
    if (message.type === 'ERROR') {
      this.statusText?.setText(message.code === 'quick_message_rate_limited' ? '빠른 통신을 너무 자주 보냈습니다.' : (message.message ?? message.code));
      this.statusText?.setColor('#ff9a91');
      return;
    }
    if (message.type === 'WELCOME' || message.type === 'ROOM_STATE') {
      const room = message.room;
      const mine = room.seats.find((seat) => seat.seatId === this.session!.seatId);
      if (!mine?.accountBound || room.matchKind !== 'FRIEND') {
        this.statusText?.setText('이 방은 계정 친구 협동 방이 아닙니다.');
        this.statusText?.setColor('#ff9a91');
        this.session.close();
        return;
      }
      this.render();
    }
    if (message.type === 'BATTLE_STARTED' || message.type === 'BATTLE_RESUME' || message.type === 'BATTLE_FINISHED') {
      const session = this.session;
      this.cleanupSubscriptions();
      this.scene.start('friend-coop-battle', { session });
    }
  }

  private cycleWeapon(): void {
    if (!this.session?.room || !this.progress) return;
    const mine = this.session.room.seats.find((seat) => seat.seatId === this.session!.seatId);
    if (!mine || mine.ready) {
      this.statusText?.setText('준비 취소 후 병기를 변경할 수 있습니다.').setColor('#ffd493');
      return;
    }
    const unlocked = getUnlockedBaseWeaponIds(this.progress.clearedStageIds);
    const current = Math.max(0, unlocked.indexOf(mine.selectedBaseWeaponId));
    const next = unlocked[(current + 1) % unlocked.length] ?? 'base_weapon_front_cannon';
    try { this.session.sendBaseWeaponSelection(next); } catch (error) { this.statusText?.setText(error instanceof Error ? error.message : '병기 변경 실패'); }
  }

  private toggleReady(): void {
    if (!this.session?.room || !this.progress) return;
    const mine = this.session.room.seats.find((seat) => seat.seatId === this.session!.seatId);
    try {
      if (mine?.ready) this.session.sendUnready();
      else this.session.sendReady(accountCoopLoadout(this.progress));
    } catch (error) {
      this.statusText?.setText(error instanceof Error ? error.message : '준비 상태 변경 실패').setColor('#ff9a91');
    }
  }

  private cleanupSubscriptions(): void {
    this.unsubscribeMessage?.();
    this.unsubscribeConnection?.();
    this.unsubscribeMessage = undefined;
    this.unsubscribeConnection = undefined;
  }

  private leave(scene: string): void {
    this.session?.close();
    this.cleanupSubscriptions();
    this.scene.start(scene);
  }
}

export class FriendCoopBattleScene extends Phaser.Scene {
  private session!: CoopSession;
  private stage!: PrototypeStage;
  private progress!: AccountCoopClientProgress;
  private snapshot: CoopBattleSnapshot | null = null;
  private battlefieldLayer?: Phaser.GameObjects.Container;
  private controlsLayer?: Phaser.GameObjects.Container;
  private quickLayer?: Phaser.GameObjects.Container;
  private resultLayer?: Phaser.GameObjects.Container;
  private connectionText?: Phaser.GameObjects.Text;
  private quickNotice?: Phaser.GameObjects.Text;
  private settlementText?: Phaser.GameObjects.Text;
  private unsubscribeMessage?: () => void;
  private unsubscribeConnection?: () => void;
  private resultShown = false;
  private accountSettled = false;

  constructor() { super('friend-coop-battle'); }

  init(data: { session?: CoopSession } = {}): void {
    if (!data.session) throw new Error('FriendCoopBattleScene requires session');
    const progress = getAuthenticatedCoopClientProgress();
    if (!progress) throw new Error('FriendCoopBattleScene requires online account progress');
    const stageId = data.session.room?.stageId;
    if (!stageId) throw new Error('FriendCoopBattleScene requires stage');
    this.session = data.session;
    this.progress = progress;
    this.stage = getStage(stageId);
    this.snapshot = this.session.battle;
    this.resultShown = false;
    this.accountSettled = false;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 34, 22, `친구 협동 · ${this.stage.name}`, compact ? 30 : 27, COLORS.cream);
    this.connectionText = addText(this, 1240, 28, connectionLabel(this.session.connectionState), compact ? 18 : 14, '#9fcfff', 'right').setOrigin(1, 0);
    this.quickNotice = addText(this, INTERNAL_WIDTH / 2, 88, '', compact ? 22 : 18, '#fff0a8', 'center').setOrigin(0.5).setDepth(220);
    addButton(this, 1195, 78, 145, compact ? 76 : 46, '나가기', () => this.leave(), 0x8d5f64);

    this.unsubscribeMessage = this.session.subscribe((message) => this.onMessage(message));
    this.unsubscribeConnection = this.session.subscribeConnection((state) => {
      if (!this.scene.isActive()) return;
      this.connectionText?.setText(connectionLabel(state)).setColor(state === 'OPEN' ? '#8ee3aa' : state === 'RECONNECTING' ? '#ffd493' : '#ffaaa2');
      if (state === 'OPEN' && this.snapshot?.winner === null) this.session.startInputPump();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.renderBattle();
    this.renderControls();
    this.renderQuickPalette();
    if (this.snapshot?.winner === null) this.session.startInputPump();
    else if (this.snapshot) this.showResult(this.snapshot.winner === 'PLAYER');
  }

  private onMessage(message: CoopServerMessage): void {
    if (!this.scene.isActive()) return;
    if (message.type === 'ERROR') {
      const text = message.code === 'quick_message_rate_limited' ? '빠른 통신 대기 중' : `협동 오류 · ${message.message ?? message.code}`;
      this.quickNotice?.setText(text).setColor('#ffaaa2');
      return;
    }
    if (message.type === 'QUICK_MESSAGE') {
      const who = message.seatId === this.session.seatId ? '나' : '동료';
      this.showQuickNotice(`${who}: ${COOP_QUICK_MESSAGE_LABELS[message.messageId]}`);
      return;
    }
    if (message.type === 'ACCOUNT_SETTLED') {
      if (message.seatId === this.session.seatId) {
        this.accountSettled = true;
        this.settlementText?.setText('계정 보상·협동 기록 저장 완료').setColor('#8ee3aa');
        void refreshAuthenticatedAccount();
      }
      return;
    }
    if (message.type === 'ACCOUNT_SETTLEMENT_ERROR') {
      if (message.seatId === this.session.seatId) this.settlementText?.setText(`계정 저장 재시도 대기 · ${message.message}`).setColor('#ffd493');
      return;
    }
    if (message.type === 'ROOM_STATE' && message.battle) this.snapshot = message.battle;
    if (message.type === 'BATTLE_STARTED' || message.type === 'BATTLE_RESUME' || message.type === 'FRAME_COMMITTED' || message.type === 'BATTLE_FINISHED') {
      this.snapshot = message.battle;
      this.renderBattle();
      this.renderControls();
      if (this.snapshot.winner === null) this.session.startInputPump();
      else this.showResult(this.snapshot.winner === 'PLAYER');
    }
  }

  private renderBattle(): void {
    this.battlefieldLayer?.destroy(true);
    this.battlefieldLayer = this.add.container(0, 0);
    const snapshot = this.snapshot;
    const compact = isCompactMobileViewport();
    if (!snapshot) {
      this.battlefieldLayer.add(addText(this, INTERNAL_WIDTH / 2, 340, '전투 상태 동기화 중…', compact ? 27 : 22, '#b8c2d0', 'center').setOrigin(0.5));
      return;
    }
    const playerRatio = Math.max(0, snapshot.bases.playerHp / Math.max(1, snapshot.bases.playerMaxHp));
    const enemyRatio = Math.max(0, snapshot.bases.enemyHp / Math.max(1, snapshot.bases.enemyMaxHp));
    this.battlefieldLayer.add(addText(this, 70, 115, `아군 기지 ${snapshot.bases.playerHp}/${snapshot.bases.playerMaxHp}`, compact ? 18 : 15, '#a9d8ff'));
    this.battlefieldLayer.add(this.add.rectangle(70, 145, 410, 18, 0x1c2530).setOrigin(0, 0.5));
    this.battlefieldLayer.add(this.add.rectangle(70, 145, 410 * playerRatio, 14, 0x6c9dcc).setOrigin(0, 0.5));
    this.battlefieldLayer.add(addText(this, 1210, 115, `적 기지 ${snapshot.bases.enemyHp}/${snapshot.bases.enemyMaxHp}`, compact ? 18 : 15, '#ffb0a9', 'right').setOrigin(1, 0));
    this.battlefieldLayer.add(this.add.rectangle(800, 145, 410, 18, 0x302022).setOrigin(0, 0.5));
    this.battlefieldLayer.add(this.add.rectangle(800 + 410 * (1 - enemyRatio), 145, 410 * enemyRatio, 14, 0xc46f70).setOrigin(0, 0.5));

    const left = 70;
    const right = 1210;
    const y = 380;
    this.battlefieldLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, y, right - left, 230, 0x1a2029, 0.94).setStrokeStyle(2, 0x4d596b, 1));
    snapshot.units.filter((unit) => unit.state !== 'DYING').forEach((unit, index) => {
      const x = left + 42 + (Math.max(0, Math.min(this.stage.mapLength, unit.anchorX)) / this.stage.mapLength) * (right - left - 84);
      const yy = y + ((index % 5) - 2) * 17;
      const player = unit.team === 'PLAYER';
      this.battlefieldLayer!.add(this.add.circle(x, yy, player ? 15 : 14, player ? (unit.ownerSeatId === 'B' ? 0x7f78bd : 0x5f91bb) : 0xb45f63, 1).setStrokeStyle(2, 0xe8edf6, 0.6));
      const name = getSlotById(unit.definitionId)?.displayName ?? ENEMIES.find((enemy) => enemy.enemyId === unit.definitionId)?.displayName ?? unit.definitionId;
      this.battlefieldLayer!.add(addText(this, x, yy - 29, player ? `${unit.ownerSeatId ?? '?'}·${name}` : name, compact ? 13 : 11, player ? '#cfeaff' : '#ffd1cc', 'center').setOrigin(0.5));
    });
    const mine = snapshot.players.find((player) => player.seatId === this.session.seatId);
    const partner = snapshot.players.find((player) => player.seatId !== this.session.seatId);
    if (mine) this.battlefieldLayer.add(addText(this, 75, 515, `내 보급 ${mine.supply}/${mine.maxSupply} · Lv${mine.supplyLevel}`, compact ? 21 : 17, '#f0d67d'));
    if (partner) this.battlefieldLayer.add(addText(this, 1205, 515, `동료 보급 ${partner.supply}/${partner.maxSupply} · Lv${partner.supplyLevel}`, compact ? 19 : 15, '#b8c8d9', 'right').setOrigin(1, 0));
    this.battlefieldLayer.add(addText(this, INTERNAL_WIDTH / 2, 548, `공유 ${baseWeaponName(snapshot.baseWeaponId)} · ${snapshot.baseWeaponCooldownFrames > 0 ? `${snapshot.baseWeaponCooldownFrames}F` : 'READY'}`, compact ? 17 : 14, '#98a7b9', 'center').setOrigin(0.5));
  }

  private renderControls(): void {
    this.controlsLayer?.destroy(true);
    this.controlsLayer = this.add.container(0, 0);
    const snapshot = this.snapshot;
    const mine = snapshot?.players.find((player) => player.seatId === this.session.seatId);
    this.progress.deckSlotIds.slice(0, 5).forEach((slotId, index) => {
      const slot = getSlotById(slotId);
      if (!slot) return;
      const cooldown = mine?.cooldowns[slotId] ?? 0;
      const cost = mine?.costs[slotId] ?? slot.cost;
      this.controlsLayer!.add(addButton(this, 100 + index * 185, 654, 172, 60, `${index + 1} ${slot.displayName}\n${cooldown > 0 ? `${cooldown}F` : `${cost} 보급`}`, () => this.session.queueCommand({ type: 'SPAWN', slotId }), cooldown > 0 ? 0x4e5968 : 0x5f86aa));
    });
    const upgrade = mine?.nextSupplyUpgradeCost === null ? '보급 MAX' : `보급 강화\n${mine?.nextSupplyUpgradeCost ?? ''}`;
    this.controlsLayer.add(addButton(this, 1050, 654, 150, 60, upgrade, () => this.session.queueCommand({ type: 'UPGRADE_SUPPLY' }), 0x7a6e4f));
    this.controlsLayer.add(addButton(this, 1210, 654, 130, 60, `공유 병기\n${baseWeaponName(snapshot?.baseWeaponId)}`, () => this.session.queueCommand({ type: 'FIRE_BASE_WEAPON' }), snapshot?.baseWeaponCooldownFrames === 0 ? 0x8a665a : 0x4d535d));
  }

  private renderQuickPalette(): void {
    this.quickLayer?.destroy(true);
    this.quickLayer = this.add.container(0, 0).setDepth(120);
    COOP_QUICK_MESSAGE_IDS.forEach((messageId, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      this.quickLayer!.add(addButton(this, 835 + col * 100, 205 + row * 48, 92, 40, COOP_QUICK_MESSAGE_LABELS[messageId], () => this.sendQuick(messageId), 0x6b628f));
    });
  }

  private sendQuick(messageId: CoopQuickMessageId): void {
    try { this.session.sendQuickMessage(messageId); }
    catch (error) { this.showQuickNotice(error instanceof Error ? error.message : '빠른 통신 실패', '#ffaaa2'); }
  }

  private showQuickNotice(text: string, color = '#fff0a8'): void {
    this.quickNotice?.setText(text).setColor(color);
    this.time.delayedCall(2200, () => {
      if (this.scene.isActive() && this.quickNotice?.text === text) this.quickNotice.setText('');
    });
  }

  private showResult(victory: boolean): void {
    if (this.resultShown) return;
    this.resultShown = true;
    this.session.stopInputPump();
    this.resultLayer = this.add.container(0, 0).setDepth(300);
    const blocker = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.82).setInteractive();
    const panel = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 720, 390, 0x202632, 0.99).setStrokeStyle(4, victory ? 0x6aa478 : 0xa36363, 1);
    this.resultLayer.add([blocker, panel]);
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 260, victory ? '친구 협동 승리' : '친구 협동 패배', 42, victory ? '#bdf1c7' : '#ffb0a9', 'center').setOrigin(0.5));
    this.settlementText = addText(this, INTERNAL_WIDTH / 2, 330, victory ? '서버가 계정 보상과 협동 기록을 처리하는 중…' : '패배에서는 클리어 보상이 지급되지 않습니다.', 18, '#c0cad7', 'center').setOrigin(0.5).setWordWrapWidth(620);
    if (this.accountSettled) this.settlementText.setText('계정 보상·협동 기록 저장 완료').setColor('#8ee3aa');
    this.resultLayer.add(this.settlementText);
    this.resultLayer.add(addButton(this, 510, 430, 220, 60, '친구 목록', () => { this.session.close(); this.scene.start('social'); }, 0x6b628f));
    this.resultLayer.add(addButton(this, 770, 430, 220, 60, '메인', () => { this.session.close(); this.scene.start('main-menu'); }, 0x586275));
  }

  private cleanup(): void {
    this.unsubscribeMessage?.();
    this.unsubscribeConnection?.();
    this.unsubscribeMessage = undefined;
    this.unsubscribeConnection = undefined;
  }

  private leave(): void {
    this.session.close();
    this.cleanup();
    this.scene.start('social');
  }
}
