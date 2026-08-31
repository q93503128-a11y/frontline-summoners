import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { PVP_ARENA_DUEL_V1 } from '@frontline/sim/pvp-arena-content';
import { getSlotById } from './prototype.ts';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';
import { PvpSession, type PvpBattleSnapshot, type PvpConnectionState, type PvpServerMessage } from './pvp-network.ts';
import { cancelFriendPvpInvite } from './social-network.ts';
import {
  cancelFriendlyPvpLobby,
  createFriendlyPvpLobby,
  getFriendlyPvpLobbyStatus,
  joinFriendlyPvpLobby,
  type FriendlyPvpGrowthPolicy,
  type FriendlyPvpLobbyState,
} from './pvp-friendly-network.ts';

function connectionLabel(state: PvpConnectionState): string {
  if (state === 'OPEN') return '연결됨';
  if (state === 'RECONNECTING') return '재접속 중…';
  if (state === 'CONNECTING') return '연결 중…';
  return '연결 종료';
}

function growthName(policy: FriendlyPvpGrowthPolicy): string {
  return policy === 'ACTUAL' ? '실제 성장' : '표준 성장';
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : '친선 PvP 요청 오류';
  const labels: Readonly<Record<string, string>> = {
    pvp_chapter_1_required: '메인 1장을 완료해야 친선 PvP를 사용할 수 있습니다.',
    pvp_requires_10_owned_characters: '친선 1v1에는 보유 캐릭터 10명이 필요합니다.',
    pvp_deck_requires_10_characters: '친선 1v1 편성 10칸을 모두 채워 주세요.',
    friendly_pvp_lobby_not_found: '친선전 방을 찾을 수 없습니다.',
    friendly_pvp_lobby_expired: '친선전 방이 만료되었습니다.',
    friendly_pvp_lobby_full: '이미 다른 플레이어가 참가한 방입니다.',
    friendly_pvp_self_join: '자신이 만든 방에는 참가할 수 없습니다.',
    friendly_pvp_blocked: '차단 관계인 플레이어와는 친선전을 시작할 수 없습니다.',
    social_pvp_invite_pending: '이 친구에게 보낸 친선전 초대가 이미 대기 중입니다.',
    social_pvp_invite_expired: '친선전 초대가 만료되었습니다.',
  };
  return labels[message] ?? message;
}

export class FriendlyPvpLobbyScene extends Phaser.Scene {
  private growthPolicy: FriendlyPvpGrowthPolicy = 'STANDARDIZED';
  private lobby: FriendlyPvpLobbyState | null = null;
  private socialInviteId: string | null = null;
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private pollEvent?: Phaser.Time.TimerEvent;
  private pending = false;

  constructor() { super('pvp-friendly-lobby'); }

  init(data: {
    socialInviteId?: string;
    inviteCode?: string;
    growthPolicy?: FriendlyPvpGrowthPolicy;
    expiresAtMs?: number;
  } = {}): void {
    this.socialInviteId = typeof data.socialInviteId === 'string' ? data.socialInviteId : null;
    this.growthPolicy = data.growthPolicy === 'ACTUAL' ? 'ACTUAL' : 'STANDARDIZED';
    this.lobby = typeof data.inviteCode === 'string' && typeof data.expiresAtMs === 'number'
      ? {
          state: 'WAITING',
          modeId: 'pvp_friendly_1v1',
          inviteCode: data.inviteCode,
          growthPolicy: this.growthPolicy,
          expiresAtMs: data.expiresAtMs,
        }
      : null;
    this.pending = false;
    this.pollEvent = undefined;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 34, '1v1 친선전', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 86, '친구 직접 초대 또는 방 코드 · 레이팅/보상 없음 · 성장 규칙 선택', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1165, 62, 170, compact ? 78 : 50, 'PvP 허브', () => { void this.leave(); }, 0x586275);
    this.status = addText(this, INTERNAL_WIDTH / 2, 682, this.lobby ? '친구의 수락을 기다리는 중…' : '친선전 규칙을 선택하세요.', compact ? 20 : 16, '#a9b5c5', 'center').setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.pollEvent?.destroy());
    this.render();
    if (this.lobby?.state === 'WAITING') this.startPolling();
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const lobby = this.lobby;

    this.content.add(this.add.rectangle(INTERNAL_WIDTH / 2, 345, 980, 430, 0x232b38, 0.98).setStrokeStyle(3, 0x756b91, 1));
    if (!lobby || lobby.state !== 'WAITING') {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 155, '성장 규칙', compact ? 29 : 25, '#fff4cf', 'center').setOrigin(0.5));
      const standardizedSelected = this.growthPolicy === 'STANDARDIZED';
      const actualSelected = this.growthPolicy === 'ACTUAL';
      this.content.add(addButton(this, 430, 245, 360, compact ? 105 : 88, '표준 성장\nLv50 · +0 · 영구 전투보너스 0', () => {
        this.growthPolicy = 'STANDARDIZED';
        this.render();
      }, standardizedSelected ? 0x5f86aa : 0x475363));
      this.content.add(addButton(this, 850, 245, 360, compact ? 105 : 88, '실제 성장\n현재 Lv · +Lv · 메인 영구보너스 적용', () => {
        this.growthPolicy = 'ACTUAL';
        this.render();
      }, actualSelected ? 0x896455 : 0x554b49));
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 335,
        this.growthPolicy === 'STANDARDIZED'
          ? '수집·형태 해금만 유지하고 성장 격차를 제거합니다.'
          : '서로 합의한 경우 실제 성장 상태 그대로 겨룹니다.',
        compact ? 20 : 17, '#c0cad7', 'center').setOrigin(0.5));
      this.content.add(addButton(this, 430, 455, 310, compact ? 88 : 64, '방 만들기', () => { void this.createLobby(); }, 0x6b7799));
      this.content.add(addButton(this, 850, 455, 310, compact ? 88 : 64, '참가 코드 입력', () => { void this.joinByPrompt(); }, 0x78618e));
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 535, '친선전은 MMR·티어·시즌 보상에 영향을 주지 않습니다.', compact ? 18 : 15, '#94a0af', 'center').setOrigin(0.5));
      return;
    }

    const secondsLeft = Math.max(0, Math.ceil((lobby.expiresAtMs - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 165, this.socialInviteId ? '친구 친선전 수락 대기' : '친구 참가 대기', compact ? 34 : 30, '#fff4cf', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 235, lobby.inviteCode, compact ? 50 : 46, '#f0d67d', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 300, `${growthName(lobby.growthPolicy)} · 방 만료 ${minutes}:${seconds}`, compact ? 22 : 18, '#c9d3e0', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 355,
      this.socialInviteId ? '친구가 요청 탭에서 수락하면 자동으로 전투가 시작됩니다.' : '상대가 코드를 입력하면 자동으로 전투방이 열립니다.',
      compact ? 20 : 17, '#aeb9c7', 'center').setOrigin(0.5));
    this.content.add(addButton(this, 455, 455, 300, compact ? 88 : 64, '코드 복사', () => { void this.copyCode(lobby.inviteCode); }, 0x5f7897));
    this.content.add(addButton(this, 825, 455, 300, compact ? 88 : 64, '방 취소', () => { void this.cancelLobby(); }, 0x815b60));
  }

  private async createLobby(): Promise<void> {
    if (this.pending) return;
    this.pending = true;
    this.socialInviteId = null;
    this.status?.setText('친선전 방을 만드는 중…').setColor('#a9b5c5');
    try {
      const state = await createFriendlyPvpLobby(this.growthPolicy);
      if (!this.scene.isActive()) return;
      this.lobby = state;
      if (state.state === 'MATCHED') return this.enterMatch(state);
      this.status?.setText('친구에게 참가 코드를 보내세요.').setColor('#8ee3aa');
      this.render();
      this.startPolling();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(friendlyError(error)).setColor('#ff9a91');
    } finally { this.pending = false; }
  }

  private async joinByPrompt(): Promise<void> {
    if (this.pending || typeof window === 'undefined') return;
    const code = window.prompt('친구에게 받은 친선전 참가 코드를 입력하세요.');
    if (!code) return;
    this.pending = true;
    this.socialInviteId = null;
    this.status?.setText('친선전 방에 참가하는 중…').setColor('#a9b5c5');
    try {
      const state = await joinFriendlyPvpLobby(code);
      if (!this.scene.isActive()) return;
      this.lobby = state;
      if (state.state === 'MATCHED') this.enterMatch(state);
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(friendlyError(error)).setColor('#ff9a91');
    } finally { this.pending = false; }
  }

  private startPolling(): void {
    if (this.pollEvent) return;
    this.pollEvent = this.time.addEvent({ delay: 1000, loop: true, callback: () => { void this.poll(); } });
  }

  private async poll(): Promise<void> {
    const lobby = this.lobby;
    if (this.pending || !lobby || lobby.state !== 'WAITING') return;
    this.pending = true;
    try {
      const state = await getFriendlyPvpLobbyStatus(lobby.inviteCode);
      if (!this.scene.isActive()) return;
      this.lobby = state;
      if (state.state === 'MATCHED') return this.enterMatch(state);
      this.render();
    } catch (error) {
      if (this.scene.isActive()) {
        if (this.socialInviteId) {
          this.socialInviteId = null;
          this.lobby = null;
          this.status?.setText('친구 초대가 거절·취소·만료되어 방이 닫혔습니다.').setColor('#ffd493');
          this.render();
        } else {
          this.status?.setText(friendlyError(error)).setColor('#ff9a91');
        }
      }
      this.pollEvent?.destroy();
      this.pollEvent = undefined;
    } finally { this.pending = false; }
  }

  private enterMatch(state: Extract<FriendlyPvpLobbyState, { state: 'MATCHED' }>): void {
    this.pollEvent?.destroy();
    this.pollEvent = undefined;
    this.socialInviteId = null;
    this.status?.setText('친선전 상대 확정 · 전투 서버로 이동합니다.').setColor('#8ee3aa');
    this.time.delayedCall(100, () => this.scene.start('pvp-friendly-match', {
      websocketPath: state.websocketPath,
      growthPolicy: state.growthPolicy,
    }));
  }

  private async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.status?.setText('참가 코드를 복사했습니다.').setColor('#8ee3aa');
    } catch {
      if (typeof window !== 'undefined') window.prompt('이 코드를 친구에게 보내세요.', code);
    }
  }

  private async closeWaitingLobby(): Promise<void> {
    const lobby = this.lobby;
    if (lobby?.state !== 'WAITING') return;
    if (this.socialInviteId) await cancelFriendPvpInvite(this.socialInviteId).catch(() => undefined);
    else await cancelFriendlyPvpLobby(lobby.inviteCode).catch(() => undefined);
    this.socialInviteId = null;
  }

  private async cancelLobby(): Promise<void> {
    await this.closeWaitingLobby();
    this.lobby = null;
    this.pollEvent?.destroy();
    this.pollEvent = undefined;
    if (this.scene.isActive()) {
      this.status?.setText('친선전 방을 닫았습니다.').setColor('#a9b5c5');
      this.render();
    }
  }

  private async leave(): Promise<void> {
    await this.closeWaitingLobby();
    if (this.scene.isActive()) this.scene.start('pvp-hub');
  }
}

export class FriendlyPvpMatchScene extends Phaser.Scene {
  private websocketPath = '';
  private growthPolicy: FriendlyPvpGrowthPolicy = 'STANDARDIZED';
  private session: PvpSession | null = null;
  private snapshot: PvpBattleSnapshot | null = null;
  private battlefield?: Phaser.GameObjects.Container;
  private controls?: Phaser.GameObjects.Container;
  private resultLayer?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private connection?: Phaser.GameObjects.Text;
  private unsubscribeMessage?: () => void;
  private unsubscribeConnection?: () => void;
  private readySent = false;
  private finished = false;

  constructor() { super('pvp-friendly-match'); }

  init(data: { websocketPath?: string; growthPolicy?: FriendlyPvpGrowthPolicy } = {}): void {
    this.websocketPath = data.websocketPath ?? '';
    this.growthPolicy = data.growthPolicy ?? 'STANDARDIZED';
    this.readySent = false;
    this.finished = false;
    this.snapshot = null;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 36, 22, `친선 1v1 · ${growthName(this.growthPolicy)}`, compact ? 31 : 28, COLORS.cream);
    this.connection = addText(this, 1230, 28, '연결 중…', compact ? 18 : 15, '#a9b5c5', 'right').setOrigin(1, 0);
    this.status = addText(this, INTERNAL_WIDTH / 2, 505, '친선전 서버에 연결 중…', compact ? 18 : 15, '#a9b5c5', 'center').setOrigin(0.5);
    addButton(this, 1185, compact ? 78 : 75, 160, compact ? 78 : 46, '전투 나가기', () => this.leaveMatch(), 0x815b60);
    if (!this.websocketPath) {
      this.status.setText('친선전 좌석 정보가 없습니다.').setColor('#ff9a91');
      return;
    }
    this.session = new PvpSession(this.websocketPath);
    this.unsubscribeMessage = this.session.subscribe((message) => this.onMessage(message));
    this.unsubscribeConnection = this.session.subscribeConnection((state) => {
      if (!this.scene.isActive()) return;
      this.connection?.setText(connectionLabel(state));
      this.connection?.setColor(state === 'OPEN' ? '#8ee3aa' : state === 'RECONNECTING' ? '#ffd493' : '#a9b5c5');
      if (state === 'OPEN' && this.session?.room?.phase === 'BATTLE') this.session.startInputPump();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeMessage?.();
      this.unsubscribeConnection?.();
      this.unsubscribeMessage = undefined;
      this.unsubscribeConnection = undefined;
    });
    this.session.connect();
    this.renderBattle();
  }

  private onMessage(message: PvpServerMessage): void {
    if (!this.scene.isActive() || !this.session) return;
    if (message.type === 'ERROR') {
      this.status?.setText(message.message ?? message.code).setColor('#ff9a91');
      return;
    }
    if (message.type === 'WELCOME') {
      this.snapshot = message.battle;
      if (message.room.phase === 'LOBBY' && !this.readySent) {
        this.session.sendReady();
        this.readySent = true;
      }
      this.status?.setText('상대 준비를 기다리는 중…').setColor('#ffd493');
      this.renderBattle();
      this.renderControls();
      return;
    }
    if (message.type === 'ROOM_STATE') {
      this.snapshot = message.battle;
      if (message.room.phase === 'BATTLE') {
        this.status?.setText('30Hz 서버 권위 친선전 진행 중').setColor('#8ee3aa');
        this.session.startInputPump();
      }
      if (message.room.phase === 'FINISHED' && message.terminalResult && !this.finished) this.showResult(message.terminalResult, message.terminalReason ?? 'BATTLE');
      this.renderBattle();
      this.renderControls();
      return;
    }
    if (message.type === 'BATTLE_STARTED' || message.type === 'FRAME_COMMITTED') {
      this.snapshot = message.battle;
      this.session.startInputPump();
      this.renderBattle();
      this.renderControls();
      return;
    }
    if (message.type === 'BATTLE_FINISHED') {
      this.snapshot = message.battle;
      this.renderBattle();
      this.renderControls();
      this.showResult(message.result, message.reason);
      return;
    }
    if (message.type === 'BATTLE_VOID') {
      this.showVoid(message.reason);
      return;
    }
    if (message.type === 'ACCOUNT_SETTLED') this.status?.setText('친선전 기록 저장 완료 · MMR 변화 없음').setColor('#8ee3aa');
    else if (message.type === 'ACCOUNT_SETTLEMENT_ERROR') this.status?.setText(`친선전 결과 저장 재시도 필요 · ${message.message}`).setColor('#ffd493');
  }

  private renderBattle(): void {
    this.battlefield?.destroy(true);
    this.battlefield = this.add.container(0, 0);
    const snapshot = this.snapshot;
    const compact = isCompactMobileViewport();
    if (!snapshot) {
      this.battlefield.add(addText(this, INTERNAL_WIDTH / 2, 330, '친선전 상태 동기화 중…', compact ? 27 : 23, '#b6c0ce', 'center').setOrigin(0.5));
      return;
    }
    const aRatio = Math.max(0, snapshot.bases.aHp / Math.max(1, snapshot.bases.aMaxHp));
    const bRatio = Math.max(0, snapshot.bases.bHp / Math.max(1, snapshot.bases.bMaxHp));
    const mine = this.session?.seatId;
    this.battlefield.add(addText(this, 75, 98, `A${mine === 'A' ? ' · 나' : ''}  ${snapshot.bases.aHp}/${snapshot.bases.aMaxHp}`, compact ? 19 : 16, '#addbff'));
    this.battlefield.add(this.add.rectangle(75, 128, 430, 18, 0x1b2631).setOrigin(0, 0.5));
    this.battlefield.add(this.add.rectangle(75, 128, 430 * aRatio, 14, 0x6198c7).setOrigin(0, 0.5));
    this.battlefield.add(addText(this, 1205, 98, `B${mine === 'B' ? ' · 나' : ''}  ${snapshot.bases.bHp}/${snapshot.bases.bMaxHp}`, compact ? 19 : 16, '#ffb5af', 'right').setOrigin(1, 0));
    this.battlefield.add(this.add.rectangle(775, 128, 430, 18, 0x302022).setOrigin(0, 0.5));
    this.battlefield.add(this.add.rectangle(775 + 430 * (1 - bRatio), 128, 430 * bRatio, 14, 0xc46f70).setOrigin(0, 0.5));

    const left = 70;
    const right = 1210;
    const fieldY = 330;
    this.battlefield.add(this.add.rectangle(INTERNAL_WIDTH / 2, fieldY, right - left, 245, 0x181f29, 0.96).setStrokeStyle(2, 0x526072, 1));
    this.battlefield.add(this.add.rectangle(left + 20, fieldY, 34, 180, 0x557fa4, 1));
    this.battlefield.add(this.add.rectangle(right - 20, fieldY, 34, 180, 0x9f5c61, 1));
    snapshot.units.filter((unit) => unit.state !== 'DYING').forEach((unit, index) => {
      const x = left + 45 + (Math.max(0, Math.min(PVP_ARENA_DUEL_V1.mapLength, unit.anchorX)) / PVP_ARENA_DUEL_V1.mapLength) * (right - left - 90);
      const y = fieldY + ((index % 5) - 2) * 18;
      const ownUnit = unit.sideId === mine;
      const fill = unit.sideId === 'A' ? (ownUnit ? 0x67a1d2 : 0x527da3) : (ownUnit ? 0xd57d79 : 0xae5d61);
      this.battlefield!.add(this.add.circle(x, y, ownUnit ? 16 : 14, fill, 1).setStrokeStyle(2, 0xf0f3f8, ownUnit ? 0.9 : 0.55));
      const name = getSlotById(unit.definitionId)?.displayName ?? unit.definitionId;
      this.battlefield!.add(addText(this, x, y - 29, name, compact ? 12 : 10, unit.sideId === 'A' ? '#d2eaff' : '#ffd6d1', 'center').setOrigin(0.5));
    });
    const secondsLeft = Math.max(0, Math.ceil((snapshot.timeLimitFrames - snapshot.tick) / 30));
    const min = Math.floor(secondsLeft / 60);
    const sec = String(secondsLeft % 60).padStart(2, '0');
    const mySide = snapshot.sides.find((side) => side.sideId === mine);
    const other = snapshot.sides.find((side) => side.sideId !== mine);
    if (mySide) this.battlefield.add(addText(this, 75, 465, `내 보급 ${mySide.supply}/${mySide.maxSupply} · 보급소 Lv${mySide.supplyLevel}`, compact ? 20 : 17, '#f0d67d'));
    if (other) this.battlefield.add(addText(this, 1205, 465, `상대 보급 ${other.supply}/${other.maxSupply} · Lv${other.supplyLevel}`, compact ? 18 : 15, '#b3bdca', 'right').setOrigin(1, 0));
    this.battlefield.add(addText(this, INTERNAL_WIDTH / 2, 463, `${min}:${sec} · ${growthName(this.growthPolicy)}`, compact ? 19 : 16, secondsLeft <= 60 ? '#ffb58f' : '#9dacbe', 'center').setOrigin(0.5));
  }

  private renderControls(): void {
    this.controls?.destroy(true);
    this.controls = this.add.container(0, 0);
    if (!this.snapshot || !this.session?.seatId || this.finished) return;
    const compact = isCompactMobileViewport();
    const side = this.snapshot.sides.find((entry) => entry.sideId === this.session!.seatId);
    if (!side) return;
    const slotIds = Object.keys(side.costs).slice(0, 10);
    slotIds.forEach((slotId, index) => {
      const row = index < 5 ? 0 : 1;
      const column = index % 5;
      const x = 92 + column * 178;
      const y = row === 0 ? 570 : 650;
      const info = getSlotById(slotId);
      const cooldown = side.cooldowns[slotId] ?? 0;
      const cost = side.costs[slotId] ?? 0;
      const label = `${index + 1} ${info?.displayName ?? slotId}\n${cooldown > 0 ? `${cooldown}F` : `${cost} 보급`}`;
      this.controls!.add(addButton(this, x, y, 164, compact ? 72 : 60, label, () => this.session?.queueCommand({ type: 'SPAWN', slotId }), cooldown > 0 || side.supply < cost ? 0x48515e : 0x5f86aa));
    });
    const upgrade = side.nextSupplyUpgradeCost === null ? '보급소 MAX' : `보급소 강화\n${side.nextSupplyUpgradeCost}`;
    this.controls.add(addButton(this, 1035, 570, 220, compact ? 72 : 60, upgrade, () => this.session?.queueCommand({ type: 'UPGRADE_SUPPLY' }), side.nextSupplyUpgradeCost !== null && side.supply >= side.nextSupplyUpgradeCost ? 0x7a6e4f : 0x4d535d));
    const weapon = side.baseWeaponId === 'base_weapon_aegis_emitter' ? '결계발진기' : side.baseWeaponId === 'base_weapon_supply_drop' ? '보급낙하기' : '전선포격기';
    this.controls.add(addButton(this, 1035, 650, 220, compact ? 72 : 60, `${weapon}\n${side.baseWeaponCooldownFrames > 0 ? `${side.baseWeaponCooldownFrames}F` : 'READY'}`, () => this.session?.queueCommand({ type: 'FIRE_BASE_WEAPON' }), side.baseWeaponCooldownFrames === 0 ? 0x8a665a : 0x4d535d));
  }

  private showResult(result: 'A' | 'B' | 'DRAW', reason: string): void {
    if (this.finished) return;
    this.finished = true;
    this.session?.stopInputPump();
    const mine = this.session?.seatId;
    const won = result !== 'DRAW' && result === mine;
    const draw = result === 'DRAW';
    this.resultLayer?.destroy(true);
    this.resultLayer = this.add.container(0, 0).setDepth(400);
    const compact = isCompactMobileViewport();
    this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.84).setInteractive());
    this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 730, 400, 0x202632, 0.99).setStrokeStyle(4, draw ? 0x777d88 : won ? 0x69a87b : 0xa86464, 1));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 260, draw ? '친선전 무승부' : won ? '친선전 승리' : '친선전 패배', compact ? 48 : 42, draw ? '#d8dde5' : won ? '#bdf1c7' : '#ffb0a9', 'center').setOrigin(0.5));
    const reasonText = reason === 'FORFEIT' ? '재접속 유예 종료에 따른 기권 판정' : '서버 권위 전투 결과';
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 330, `${growthName(this.growthPolicy)} · ${reasonText}\nMMR·티어 변화 없음`, compact ? 20 : 17, '#c2ccd8', 'center').setOrigin(0.5));
    this.resultLayer.add(addButton(this, 505, 445, 220, compact ? 82 : 60, '친선 로비', () => { this.session?.close(); this.scene.start('pvp-friendly-lobby'); }, 0x6b7799));
    this.resultLayer.add(addButton(this, 775, 445, 220, compact ? 82 : 60, 'PvP 허브', () => { this.session?.close(); this.scene.start('pvp-hub'); }, 0x5f7897));
  }

  private showVoid(reason: string): void {
    if (this.finished) return;
    this.finished = true;
    this.session?.stopInputPump();
    this.resultLayer = this.add.container(0, 0).setDepth(400);
    const compact = isCompactMobileViewport();
    this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.84).setInteractive());
    this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 730, 360, 0x202632, 0.99).setStrokeStyle(4, 0x777d88, 1));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 280, '친선전 무효', compact ? 44 : 39, '#d8dde5', 'center').setOrigin(0.5));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 345, reason === 'both_players_disconnected' ? '양측 연결이 모두 끊겨 전적 없이 종료했습니다.' : reason, compact ? 20 : 17, '#b9c3d0', 'center').setOrigin(0.5));
    this.resultLayer.add(addButton(this, INTERNAL_WIDTH / 2, 445, 250, compact ? 82 : 60, '친선 로비', () => { this.session?.close(); this.scene.start('pvp-friendly-lobby'); }, 0x6b7799));
  }

  private leaveMatch(): void {
    this.session?.close();
    this.scene.start('pvp-friendly-lobby');
  }
}
