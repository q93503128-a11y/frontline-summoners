import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import {
  ALL_STAGES,
  ENEMIES,
  getSlotById,
  getStage,
  type PrototypeStage,
} from './prototype';
import {
  getEffectiveDeckSlotIds,
  loadGuestProgress,
  recordGuestEnemyDiscoveries,
  recordNormalStageClear,
  recordSpecialStageClear,
  type GuestProgress,
} from './save';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import {
  getCollectionStagePageIndexForStage,
  getStageCollectionForStage,
  isSortieStageUnlocked,
} from './stage-navigation';
import { isCompactMobileViewport } from './viewport';
import {
  CoopSession,
  createCoopMatch,
  decodeCoopInvite,
  encodeCoopInvite,
  guestWebsocketPath,
  type CoopBattleSnapshot,
  type CoopServerMessage,
} from './coop-network';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  discoveredEnemyIds: [],
};

function coopDeck(progress: GuestProgress): readonly string[] {
  return getEffectiveDeckSlotIds(progress).slice(0, 5);
}

function eligibleCoopStages(progress: GuestProgress): readonly PrototypeStage[] {
  return ALL_STAGES.filter((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP' && isSortieStageUnlocked(stage.id, progress.clearedStageIds));
}

function connectionLabel(state: CoopSession['connectionState']): string {
  if (state === 'OPEN') return '연결됨';
  if (state === 'RECONNECTING') return '재접속 중…';
  if (state === 'CONNECTING') return '연결 중…';
  return '연결 종료';
}

function formatPermille(permille: number): string {
  const percent = permille / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function stageReturnData(stage: PrototypeStage): { scene: string; data: { collectionId: string; page: number } } {
  const collection = getStageCollectionForStage(stage.id);
  return {
    scene: 'stage-select',
    data: {
      collectionId: collection.id,
      page: getCollectionStagePageIndexForStage(collection, stage.id),
    },
  };
}

export class CoopLobbyScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private page = 0;
  private contentLayer?: Phaser.GameObjects.Container;
  private session: CoopSession | null = null;
  private inviteCode: string | null = null;
  private statusText?: Phaser.GameObjects.Text;
  private unsubscribeMessage: (() => void) | undefined;
  private unsubscribeConnection: (() => void) | undefined;

  constructor() { super('coop-lobby'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 36, '2인 협동', compact ? 44 : 46, COLORS.cream);
    addText(this, 56, 92, compact ? '각자 5칸 · 개인 보급 · 공유 전장' : 'A 5칸 + B 5칸 · 개인 보급/쿨다운 · 공유 기지/거점 병기', compact ? 22 : 18, COLORS.muted);
    addButton(this, 1165, compact ? 66 : 62, 160, compact ? 84 : 50, '메인', () => this.leaveTo('main-menu'), 0x586275);
    addButton(this, 1055, compact ? 650 : 658, 300, compact ? 84 : 56, '참가 코드 입력', () => this.promptJoin(), 0x745d91);
    addButton(this, 90, compact ? 650 : 658, 120, compact ? 84 : 56, '◀', () => { this.page = Math.max(0, this.page - 1); this.render(); }, 0x586275);
    addButton(this, 230, compact ? 650 : 658, 120, compact ? 84 : 56, '▶', () => { this.page += 1; this.render(); }, 0x586275);
    this.statusText = addText(this, INTERNAL_WIDTH / 2, compact ? 610 : 618, '진행도 불러오는 중…', compact ? 20 : 16, '#9ca9bb', 'center').setOrigin(0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeMessage?.();
      this.unsubscribeConnection?.();
      this.unsubscribeMessage = undefined;
      this.unsubscribeConnection = undefined;
    });

    this.render();
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      this.statusText?.setText(`협동 덱: ${coopDeck(progress).map((id) => getSlotById(id)?.displayName ?? id).join(' · ')}`);
      this.render();
    });
  }

  private render(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = this.add.container(0, 0);
    if (this.session) {
      this.renderRoom();
      return;
    }
    this.renderStagePicker();
  }

  private renderStagePicker(): void {
    if (!this.contentLayer) return;
    const compact = isCompactMobileViewport();
    const stages = eligibleCoopStages(this.progress);
    const pageSize = 5;
    const pageCount = Math.max(1, Math.ceil(stages.length / pageSize));
    this.page = Math.min(this.page, pageCount - 1);
    const visible = stages.slice(this.page * pageSize, this.page * pageSize + pageSize);

    this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 145, `협동 가능 전장 ${stages.length}개 · ${this.page + 1}/${pageCount}`, compact ? 23 : 18, '#b9c9da', 'center').setOrigin(0.5));
    if (visible.length === 0) {
      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 330, '현재 진행도에서 협동 가능한 전장이 없습니다.', compact ? 28 : 24, '#9aa4b3', 'center').setOrigin(0.5));
      return;
    }

    visible.forEach((stage, index) => {
      const x = 145 + index * 247;
      const special = stage.stageType === 'SPECIAL';
      const panel = this.add.rectangle(x, 360, 220, 360, special ? 0x2b2535 : 0x242b3a, 0.98).setStrokeStyle(3, special ? 0x80659b : 0x596c86, 1);
      this.contentLayer!.add(panel);
      this.contentLayer!.add(addText(this, x, 225, special ? 'SPECIAL' : stage.chapter.toUpperCase(), compact ? 20 : 16, special ? '#c8abe0' : '#9eb8d3', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 270, stage.name, compact ? 27 : 23, '#ffffff', 'center').setOrigin(0.5).setWordWrapWidth(196));
      this.contentLayer!.add(addText(this, x, 320, `난이도 ${stage.difficulty}/12`, compact ? 20 : 17, COLORS.gold, 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 365, `전장 ${stage.mapLength}m`, compact ? 18 : 15, '#b6c1d0', 'center').setOrigin(0.5));
      const scaling = stage.coopStatScaling;
      this.contentLayer!.add(addText(this, x, 410, `적 HP ${formatPermille(scaling.enemyHpPermille)} · ATK ${formatPermille(scaling.enemyAttackPermille)}\n적 기지 ${formatPermille(scaling.enemyBaseHpPermille)}`, compact ? 17 : 14, '#d4b8a2', 'center').setOrigin(0.5));
      this.contentLayer!.add(addButton(this, x, 495, 180, compact ? 84 : 58, '방 만들기', () => { void this.host(stage.id); }, special ? 0x8a6197 : 0x5f86aa));
    });
  }

  private async host(stageId: string): Promise<void> {
    if (this.session) return;
    const deck = coopDeck(this.progress);
    if (deck.length < 1) {
      this.statusText?.setText('협동에 사용할 보유 캐릭터가 없습니다.');
      this.statusText?.setColor('#ff9a91');
      return;
    }
    this.statusText?.setText('협동 방 만드는 중…');
    this.statusText?.setColor('#9ca9bb');
    try {
      const created = await createCoopMatch(stageId);
      if (!this.scene.isActive()) return;
      this.inviteCode = encodeCoopInvite(created.guestInvite);
      this.attachSession(new CoopSession(created.hostPath));
      this.session!.connect();
      this.render();
    } catch (error) {
      this.statusText?.setText(error instanceof Error ? error.message : '협동 방을 만들지 못했습니다.');
      this.statusText?.setColor('#ff9a91');
    }
  }

  private promptJoin(): void {
    if (this.session || typeof window === 'undefined') return;
    const code = window.prompt('친구에게 받은 협동 참가 코드를 입력하세요.');
    if (!code) return;
    try {
      const invite = decodeCoopInvite(code);
      this.inviteCode = null;
      this.attachSession(new CoopSession(guestWebsocketPath(invite)));
      this.session!.connect();
      this.statusText?.setText('협동 방에 연결 중…');
      this.statusText?.setColor('#9ca9bb');
      this.render();
    } catch (error) {
      this.statusText?.setText(error instanceof Error ? error.message : '참가 코드가 올바르지 않습니다.');
      this.statusText?.setColor('#ff9a91');
    }
  }

  private attachSession(session: CoopSession): void {
    this.unsubscribeMessage?.();
    this.unsubscribeConnection?.();
    this.session = session;
    this.unsubscribeMessage = session.subscribe((message) => this.onServerMessage(message));
    this.unsubscribeConnection = session.subscribeConnection((state) => {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(`협동 서버 · ${connectionLabel(state)}`);
      this.statusText?.setColor(state === 'OPEN' ? '#8ee3aa' : state === 'RECONNECTING' ? '#ffd493' : '#9ca9bb');
      this.render();
    });
  }

  private onServerMessage(message: CoopServerMessage): void {
    if (!this.scene.isActive() || !this.session) return;
    if (message.type === 'ERROR') {
      this.statusText?.setText(message.message ?? message.code);
      this.statusText?.setColor('#ff9a91');
      return;
    }
    if (message.type === 'WELCOME') {
      const stage = getStage(message.room.stageId);
      if (!isSortieStageUnlocked(stage.id, this.progress.clearedStageIds) || stage.multiplayerPolicy !== 'SOLO_OR_COOP') {
        this.statusText?.setText('현재 진행도에서는 이 협동 전장에 참가할 수 없습니다.');
        this.statusText?.setColor('#ff9a91');
        this.session.close();
        return;
      }
      this.render();
    }
    if (message.type === 'ROOM_STATE') this.render();
    if (message.type === 'BATTLE_STARTED' || message.type === 'BATTLE_RESUME' || message.type === 'BATTLE_FINISHED') {
      const session = this.session;
      this.unsubscribeMessage?.();
      this.unsubscribeConnection?.();
      this.unsubscribeMessage = undefined;
      this.unsubscribeConnection = undefined;
      this.scene.start('coop-battle', { session });
    }
  }

  private renderRoom(): void {
    if (!this.contentLayer || !this.session) return;
    const compact = isCompactMobileViewport();
    const room = this.session.room;
    const stage = room ? getStage(room.stageId) : null;
    this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 150, stage ? stage.name : '협동 방 연결 중…', compact ? 34 : 30, '#fff4cf', 'center').setOrigin(0.5));
    if (!room) return;

    room.seats.forEach((seat, index) => {
      const x = index === 0 ? 405 : 875;
      const mine = this.session!.seatId === seat.seatId;
      const panel = this.add.rectangle(x, 340, 360, 250, mine ? 0x29364a : 0x272d38, 0.98).setStrokeStyle(3, mine ? 0x6fa2d0 : 0x566171, 1);
      this.contentLayer!.add(panel);
      this.contentLayer!.add(addText(this, x, 260, `${seat.seatId} 지휘관${mine ? ' · 나' : ''}`, compact ? 27 : 23, '#ffffff', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 315, seat.connected ? '접속됨' : '접속 대기', compact ? 22 : 18, seat.connected ? '#8ee3aa' : '#9aa3b0', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 365, `편성 ${seat.deckSize}/5 · ${seat.ready ? '준비 완료' : '준비 전'}`, compact ? 21 : 17, seat.ready ? '#f0d67d' : '#aab2bf', 'center').setOrigin(0.5));
      this.contentLayer!.add(addText(this, x, 410, seat.control === 'AI' ? '연결 이탈 · 임시 지휘' : '플레이어 제어', compact ? 18 : 15, seat.control === 'AI' ? '#ffd493' : '#9fcfff', 'center').setOrigin(0.5));
    });

    if (this.inviteCode) {
      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 505, `친구 참가 코드\n${this.inviteCode}`, compact ? 18 : 15, '#cbd4e1', 'center').setOrigin(0.5).setWordWrapWidth(760));
      this.contentLayer.add(addButton(this, 930, 530, 190, compact ? 84 : 54, '코드 복사', () => { void this.copyInvite(); }, 0x6b628f));
    }

    const mine = room.seats.find((seat) => seat.seatId === this.session!.seatId);
    const readyLabel = mine?.ready ? '준비 취소' : '준비';
    this.contentLayer.add(addButton(this, 520, compact ? 550 : 545, 210, compact ? 84 : 60, readyLabel, () => this.toggleReady(), mine?.ready ? 0x766854 : 0x5f8f75));
    this.contentLayer.add(addButton(this, 750, compact ? 550 : 545, 210, compact ? 84 : 60, '방 나가기', () => this.leaveRoom(), 0x8d5f64));
  }

  private toggleReady(): void {
    if (!this.session?.room) return;
    const mine = this.session.room.seats.find((seat) => seat.seatId === this.session!.seatId);
    try {
      if (mine?.ready) this.session.sendUnready();
      else this.session.sendReady(coopDeck(this.progress));
    } catch (error) {
      this.statusText?.setText(error instanceof Error ? error.message : '준비 상태를 바꾸지 못했습니다.');
      this.statusText?.setColor('#ff9a91');
    }
  }

  private async copyInvite(): Promise<void> {
    if (!this.inviteCode) return;
    try {
      await navigator.clipboard.writeText(this.inviteCode);
      this.statusText?.setText('참가 코드를 복사했습니다.');
      this.statusText?.setColor('#8ee3aa');
    } catch {
      if (typeof window !== 'undefined') window.prompt('이 코드를 친구에게 보내세요.', this.inviteCode);
    }
  }

  private leaveRoom(): void {
    this.session?.close();
    this.session = null;
    this.inviteCode = null;
    this.unsubscribeMessage?.();
    this.unsubscribeConnection?.();
    this.unsubscribeMessage = undefined;
    this.unsubscribeConnection = undefined;
    this.statusText?.setText('협동 방에서 나왔습니다.');
    this.statusText?.setColor('#9ca9bb');
    this.render();
  }

  private leaveTo(scene: string): void {
    this.session?.close();
    this.scene.start(scene);
  }
}

export class CoopBattleScene extends Phaser.Scene {
  private session!: CoopSession;
  private stage!: PrototypeStage;
  private progress: GuestProgress = EMPTY_PROGRESS;
  private deckIds: readonly string[] = [];
  private snapshot: CoopBattleSnapshot | null = null;
  private battlefieldLayer?: Phaser.GameObjects.Container;
  private controlsLayer?: Phaser.GameObjects.Container;
  private resultLayer?: Phaser.GameObjects.Container;
  private headerText?: Phaser.GameObjects.Text;
  private connectionText?: Phaser.GameObjects.Text;
  private unsubscribeMessage: (() => void) | undefined;
  private unsubscribeConnection: (() => void) | undefined;
  private resultRecorded = false;
  private knownEnemyIds = new Set<string>();

  constructor() { super('coop-battle'); }

  init(data: { session?: CoopSession } = {}): void {
    if (!data.session) throw new Error('CoopBattleScene requires an active session');
    this.session = data.session;
    const stageId = this.session.room?.stageId;
    if (!stageId) throw new Error('Co-op session has no stage');
    this.stage = getStage(stageId);
    this.snapshot = this.session.battle;
    this.resultRecorded = false;
    this.knownEnemyIds = new Set<string>();
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    this.headerText = addText(this, 36, 24, `협동 · ${this.stage.name}`, compact ? 31 : 28, COLORS.cream);
    this.connectionText = addText(this, 1240, 30, connectionLabel(this.session.connectionState), compact ? 18 : 15, '#9fcfff', 'right').setOrigin(1, 0);
    addButton(this, 1190, compact ? 82 : 78, 150, compact ? 84 : 48, '나가기', () => this.leaveBattle(), 0x8d5f64);

    this.unsubscribeMessage = this.session.subscribe((message) => this.onServerMessage(message));
    this.unsubscribeConnection = this.session.subscribeConnection((state) => {
      if (!this.scene.isActive()) return;
      this.connectionText?.setText(connectionLabel(state));
      this.connectionText?.setColor(state === 'OPEN' ? '#8ee3aa' : state === 'RECONNECTING' ? '#ffd493' : '#ffb0a9');
      if (state === 'OPEN' && this.snapshot?.winner === null) this.session.startInputPump();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeMessage?.();
      this.unsubscribeConnection?.();
      this.unsubscribeMessage = undefined;
      this.unsubscribeConnection = undefined;
    });

    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      this.deckIds = coopDeck(progress);
      this.renderControls();
    });

    this.renderSnapshot();
    if (this.snapshot?.winner === null) this.session.startInputPump();
    else if (this.snapshot) void this.finishBattle(this.snapshot);
  }

  private onServerMessage(message: CoopServerMessage): void {
    if (!this.scene.isActive()) return;
    if (message.type === 'ERROR') {
      this.headerText?.setText(`협동 오류 · ${message.message ?? message.code}`);
      this.headerText?.setColor('#ffaaa2');
      return;
    }
    if (message.type === 'ROOM_STATE' && message.battle) this.snapshot = message.battle;
    if (message.type === 'BATTLE_STARTED' || message.type === 'BATTLE_RESUME' || message.type === 'FRAME_COMMITTED' || message.type === 'BATTLE_FINISHED') {
      this.snapshot = message.battle;
      if (this.snapshot.winner === null) this.session.startInputPump();
      this.renderSnapshot();
      this.renderControls();
      void this.recordVisibleEnemies(this.snapshot);
      if (this.snapshot.winner !== null || message.type === 'BATTLE_FINISHED') void this.finishBattle(this.snapshot);
    }
  }

  private renderSnapshot(): void {
    this.battlefieldLayer?.destroy(true);
    this.battlefieldLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const snapshot = this.snapshot;
    if (!snapshot) {
      this.battlefieldLayer.add(addText(this, INTERNAL_WIDTH / 2, 340, '전투 상태 동기화 중…', compact ? 28 : 23, '#b6c0ce', 'center').setOrigin(0.5));
      return;
    }

    const playerRatio = Math.max(0, snapshot.bases.playerHp / Math.max(1, snapshot.bases.playerMaxHp));
    const enemyRatio = Math.max(0, snapshot.bases.enemyHp / Math.max(1, snapshot.bases.enemyMaxHp));
    this.battlefieldLayer.add(addText(this, 80, 105, `아군 기지 ${snapshot.bases.playerHp}/${snapshot.bases.playerMaxHp}`, compact ? 19 : 16, '#a9d8ff'));
    this.battlefieldLayer.add(this.add.rectangle(80, 138, 420, 18, 0x1c2530).setOrigin(0, 0.5));
    this.battlefieldLayer.add(this.add.rectangle(80, 138, 420 * playerRatio, 14, 0x6c9dcc).setOrigin(0, 0.5));
    this.battlefieldLayer.add(addText(this, 1200, 105, `적 기지 ${snapshot.bases.enemyHp}/${snapshot.bases.enemyMaxHp}`, compact ? 19 : 16, '#ffb0a9', 'right').setOrigin(1, 0));
    this.battlefieldLayer.add(this.add.rectangle(780, 138, 420, 18, 0x302022).setOrigin(0, 0.5));
    this.battlefieldLayer.add(this.add.rectangle(780 + 420 * (1 - enemyRatio), 138, 420 * enemyRatio, 14, 0xc46f70).setOrigin(0, 0.5));

    const fieldLeft = 70;
    const fieldRight = 1210;
    const fieldY = 385;
    this.battlefieldLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, fieldY, fieldRight - fieldLeft, 230, 0x1a2029, 0.94).setStrokeStyle(2, 0x4d596b, 1));
    this.battlefieldLayer.add(this.add.rectangle(fieldLeft + 18, fieldY, 32, 170, 0x567da1, 1));
    this.battlefieldLayer.add(this.add.rectangle(fieldRight - 18, fieldY, 32, 170, 0x9e5f62, 1));

    const aliveUnits = snapshot.units.filter((unit) => unit.state !== 'DYING');
    aliveUnits.forEach((unit, index) => {
      const x = fieldLeft + 42 + (Math.max(0, Math.min(this.stage.mapLength, unit.anchorX)) / this.stage.mapLength) * (fieldRight - fieldLeft - 84);
      const laneOffset = ((index % 5) - 2) * 17;
      const y = fieldY + laneOffset;
      const isPlayer = unit.team === 'PLAYER';
      const body = this.add.circle(x, y, isPlayer ? 15 : 14, isPlayer ? (unit.ownerSeatId === 'B' ? 0x7f78bd : 0x5f91bb) : 0xb45f63, 1).setStrokeStyle(2, 0xe8edf6, 0.65);
      this.battlefieldLayer!.add(body);
      const name = getSlotById(unit.definitionId)?.displayName ?? ENEMIES.find((enemy) => enemy.enemyId === unit.definitionId)?.displayName ?? unit.definitionId;
      this.battlefieldLayer!.add(addText(this, x, y - 30, isPlayer ? `${unit.ownerSeatId ?? '?'}·${name}` : name, compact ? 13 : 11, isPlayer ? '#cfeaff' : '#ffd1cc', 'center').setOrigin(0.5));
    });

    const mine = snapshot.players.find((player) => player.seatId === this.session.seatId);
    const partner = snapshot.players.find((player) => player.seatId !== this.session.seatId);
    if (mine) this.battlefieldLayer.add(addText(this, 80, 520, `내 보급 ${mine.supply}/${mine.maxSupply} · 보급소 Lv${mine.supplyLevel}`, compact ? 22 : 18, '#f0d67d'));
    if (partner) this.battlefieldLayer.add(addText(this, 1200, 520, `동료 보급 ${partner.supply}/${partner.maxSupply} · Lv${partner.supplyLevel}`, compact ? 20 : 16, '#b8c8d9', 'right').setOrigin(1, 0));
    this.battlefieldLayer.add(addText(this, INTERNAL_WIDTH / 2, 555, `30Hz 서버 전투 · frame ${snapshot.tick} · 전선포 ${snapshot.baseWeaponCooldownFrames > 0 ? `${snapshot.baseWeaponCooldownFrames}F` : 'READY'}`, compact ? 17 : 14, '#8f9cad', 'center').setOrigin(0.5));
  }

  private renderControls(): void {
    this.controlsLayer?.destroy(true);
    this.controlsLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const snapshot = this.snapshot;
    const mine = snapshot?.players.find((player) => player.seatId === this.session.seatId);
    const deck = this.deckIds.slice(0, 5);
    deck.forEach((slotId, index) => {
      const slot = getSlotById(slotId);
      if (!slot) return;
      const remaining = mine?.cooldowns[slotId] ?? 0;
      const label = compact
        ? `${index + 1} ${slot.displayName}\n${remaining > 0 ? `${remaining}F` : `${slot.cost} 보급`}`
        : `${index + 1} · ${slot.displayName}\n${remaining > 0 ? `재생산 ${remaining}F` : `${slot.cost} 보급`}`;
      this.controlsLayer!.add(addButton(this, 105 + index * 194, 650, 180, compact ? 84 : 62, label, () => this.session.queueCommand({ type: 'SPAWN', slotId }), remaining > 0 ? 0x4e5968 : 0x5f86aa));
    });
    this.controlsLayer.add(addButton(this, 1085, 650, 170, compact ? 84 : 62, '보급소 강화', () => this.session.queueCommand({ type: 'UPGRADE_SUPPLY' }), 0x7a6e4f));
    this.controlsLayer.add(addButton(this, 1245, 650, 130, compact ? 84 : 62, '전선포', () => this.session.queueCommand({ type: 'FIRE_BASE_WEAPON' }), snapshot && snapshot.baseWeaponCooldownFrames === 0 ? 0x8a665a : 0x4d535d));
  }

  private async recordVisibleEnemies(snapshot: CoopBattleSnapshot): Promise<void> {
    const current = snapshot.units.filter((unit) => unit.team === 'ENEMY').map((unit) => unit.definitionId);
    const fresh = current.filter((enemyId) => !this.knownEnemyIds.has(enemyId));
    if (fresh.length === 0) return;
    fresh.forEach((enemyId) => this.knownEnemyIds.add(enemyId));
    try { await recordGuestEnemyDiscoveries(fresh); } catch { /* battle discovery must not interrupt the match */ }
  }

  private async finishBattle(snapshot: CoopBattleSnapshot): Promise<void> {
    if (this.resultRecorded) return;
    this.resultRecorded = true;
    this.session.stopInputPump();
    let persistenceText = '';
    if (snapshot.winner === 'PLAYER') {
      try {
        if (this.stage.stageType === 'SPECIAL') {
          const result = await recordSpecialStageClear(this.stage.id);
          persistenceText = result.persisted ? '특수전 클리어 저장 완료' : '현재 탭에서 클리어 유지';
        } else {
          const result = await recordNormalStageClear(this.stage.id, 'COOP_BATTLE');
          persistenceText = result.persisted ? '협동 NORMAL_CLEAR 저장 완료' : '현재 탭에서 클리어 유지';
        }
      } catch (error) {
        persistenceText = error instanceof Error ? error.message : '클리어 저장 실패';
      }
    }
    if (!this.scene.isActive()) return;
    this.showResult(snapshot.winner === 'PLAYER', persistenceText);
  }

  private showResult(victory: boolean, persistenceText: string): void {
    this.resultLayer?.destroy(true);
    this.resultLayer = this.add.container(0, 0).setDepth(300);
    const compact = isCompactMobileViewport();
    const blocker = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.82).setInteractive();
    const panel = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 720, compact ? 420 : 390, 0x202632, 0.99).setStrokeStyle(4, victory ? 0x6aa478 : 0xa36363, 1);
    this.resultLayer.add([blocker, panel]);
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 265, victory ? '협동 승리' : '협동 패배', compact ? 48 : 42, victory ? '#bdf1c7' : '#ffb0a9', 'center').setOrigin(0.5));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 335, persistenceText || (victory ? '전투 완료' : '다시 도전할 수 있습니다.'), compact ? 22 : 18, '#c0cad7', 'center').setOrigin(0.5).setWordWrapWidth(620));
    const target = stageReturnData(this.stage);
    this.resultLayer.add(addButton(this, 510, 435, 220, compact ? 84 : 60, '스테이지 선택', () => {
      this.session.close();
      this.scene.start(target.scene, target.data);
    }, 0x5f86aa));
    this.resultLayer.add(addButton(this, 770, 435, 220, compact ? 84 : 60, '메인', () => {
      this.session.close();
      this.scene.start('main-menu');
    }, 0x586275));
  }

  private leaveBattle(): void {
    this.session.close();
    const target = stageReturnData(this.stage);
    this.scene.start(target.scene, target.data);
  }
}
