import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { PVP_ARENA_TEAM_V1 } from '@frontline/sim/pvp-arena-content';
import { getSlotById } from './prototype.ts';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';
import {
  Pvp2v2Session,
  getPvp2v2MatchmakingStatus,
  joinPvp2v2Matchmaking,
  leavePvp2v2Matchmaking,
  type Pvp2v2BattleSnapshot,
  type Pvp2v2ConnectionState,
  type Pvp2v2MatchmakingState,
  type Pvp2v2ServerMessage,
} from './pvp-2v2-network.ts';

function connectionLabel(state: Pvp2v2ConnectionState): string {
  if (state === 'OPEN') return '연결됨';
  if (state === 'RECONNECTING') return '재접속 중…';
  if (state === 'CONNECTING') return '연결 중…';
  return '연결 종료';
}
function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : '2v2 PvP 요청 오류';
  const labels: Readonly<Record<string, string>> = {
    pvp_chapter_1_required: '메인 1장을 완료해야 2v2에 참가할 수 있습니다.',
    pvp_requires_5_owned_characters: '2v2에는 보유 캐릭터 5명이 필요합니다.',
    pvp_deck_requires_5_characters: '2v2에 사용할 편성 앞 5칸을 채워 주세요.',
    pvp_2v2_match_initialization_failed: '2v2 전투방을 만들지 못했습니다. 다시 매칭해 주세요.',
    pvp_2v2_match_room_lost_requeue_required: '2v2 전투방이 만료되었습니다. 다시 매칭해 주세요.',
  };
  return labels[message] ?? message;
}

export class Pvp2v2MatchmakingScene extends Phaser.Scene {
  private state: Pvp2v2MatchmakingState = { state: 'IDLE' };
  private status?: Phaser.GameObjects.Text;
  private content?: Phaser.GameObjects.Container;
  private pollEvent?: Phaser.Time.TimerEvent;
  private pending = false;

  constructor() { super('pvp-2v2-matchmaking'); }
  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 34, '2v2 일반전', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 86, '플레이어당 5칸 · 개인 보급/보급소 · 팀 공유 기지/전선포격기', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1165, 62, 170, compact ? 78 : 50, '취소·돌아가기', () => { void this.cancel(); }, 0x7a5e61);
    this.status = addText(this, INTERNAL_WIDTH / 2, 620, '2v2 대기열 상태 확인 중…', compact ? 22 : 18, '#a9b5c5', 'center').setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.pollEvent?.destroy());
    this.render();
    void this.restoreOrJoin();
  }
  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    this.content.add(this.add.rectangle(INTERNAL_WIDTH / 2, 345, 850, 390, 0x242c39, 0.98).setStrokeStyle(4, 0x6683a5, 1));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 190, 'CASUAL 2v2', compact ? 38 : 34, '#cfe6ff', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 260, '표준 Lv50 · +0 · 팀 총 10칸\n각자 보급/재생산 독립 · 팀 유닛 상한 55', compact ? 21 : 18, '#c7d0dc', 'center').setOrigin(0.5));
    const label = this.state.state === 'IDLE' ? '대기열 준비' : this.state.state === 'QUEUED' ? '4명의 지휘관을 찾는 중…' : this.state.state === 'PAIRING' ? '팀 배정·전투방 확정 중…' : '2v2 상대팀 확정';
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 390, label, compact ? 28 : 24, this.state.state === 'MATCHED' ? '#8ee3aa' : '#f0d67d', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 470, '2v2 랭킹은 동접/매칭시간 검증 후 개방 · 현재는 일반전만 제공', compact ? 18 : 15, '#929eae', 'center').setOrigin(0.5));
  }
  private async restoreOrJoin(): Promise<void> {
    try {
      const current = await getPvp2v2MatchmakingStatus();
      if (!this.scene.isActive()) return;
      if (current.state === 'MATCHED') return this.enter(current);
      if (current.state === 'QUEUED' || current.state === 'PAIRING') { this.state = current; this.handle(); return; }
      this.state = await joinPvp2v2Matchmaking();
      if (this.scene.isActive()) this.handle();
    } catch (error) { if (this.scene.isActive()) this.status?.setText(errorText(error)).setColor('#ff9a91'); }
  }
  private handle(): void {
    if (this.state.state === 'MATCHED') return this.enter(this.state);
    if (this.state.state === 'QUEUED' || this.state.state === 'PAIRING') {
      this.status?.setText(this.state.state === 'QUEUED' ? '나머지 플레이어를 찾고 있습니다…' : '4명 확정 · 서버 전투방을 준비하는 중…').setColor('#ffd493');
      if (!this.pollEvent) this.pollEvent = this.time.addEvent({ delay: 1000, loop: true, callback: () => { void this.poll(); } });
    }
    this.render();
  }
  private async poll(): Promise<void> {
    if (this.pending || (this.state.state !== 'QUEUED' && this.state.state !== 'PAIRING')) return;
    this.pending = true;
    try { this.state = await getPvp2v2MatchmakingStatus(); if (this.scene.isActive()) this.handle(); }
    catch (error) { if (this.scene.isActive()) this.status?.setText(errorText(error)).setColor('#ff9a91'); }
    finally { this.pending = false; }
  }
  private enter(state: Extract<Pvp2v2MatchmakingState, { state: 'MATCHED' }>): void {
    this.pollEvent?.destroy(); this.pollEvent = undefined;
    this.status?.setText(`좌석 ${state.seatId} 확정 · 2v2 전투로 이동합니다.`).setColor('#8ee3aa');
    this.time.delayedCall(100, () => this.scene.start('pvp-2v2-match', { websocketPath: state.websocketPath }));
  }
  private async cancel(): Promise<void> {
    if (this.state.state === 'QUEUED') await leavePvp2v2Matchmaking().catch(() => undefined);
    if (this.scene.isActive()) this.scene.start('pvp-hub');
  }
}

export class Pvp2v2BattleScene extends Phaser.Scene {
  private websocketPath = '';
  private session: Pvp2v2Session | null = null;
  private snapshot: Pvp2v2BattleSnapshot | null = null;
  private battlefield?: Phaser.GameObjects.Container;
  private controls?: Phaser.GameObjects.Container;
  private resultLayer?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private connection?: Phaser.GameObjects.Text;
  private unsubscribeMessage?: () => void;
  private unsubscribeConnection?: () => void;
  private readySent = false;
  private finished = false;

  constructor() { super('pvp-2v2-match'); }
  init(data: { websocketPath?: string } = {}): void { this.websocketPath = data.websocketPath ?? ''; this.readySent = false; this.finished = false; this.snapshot = null; }
  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 36, 22, '대전 · 2v2 일반전', compact ? 31 : 28, COLORS.cream);
    this.connection = addText(this, 1230, 28, '연결 중…', compact ? 18 : 15, '#a9b5c5', 'right').setOrigin(1, 0);
    this.status = addText(this, INTERNAL_WIDTH / 2, 510, '2v2 전투 서버에 연결 중…', compact ? 18 : 15, '#a9b5c5', 'center').setOrigin(0.5);
    addButton(this, 1185, compact ? 78 : 75, 160, compact ? 78 : 46, '전투 나가기', () => this.leave(), 0x815b60);
    if (!this.websocketPath) { this.status.setText('2v2 좌석 정보가 없습니다.').setColor('#ff9a91'); return; }
    this.session = new Pvp2v2Session(this.websocketPath);
    this.unsubscribeMessage = this.session.subscribe((message) => this.onMessage(message));
    this.unsubscribeConnection = this.session.subscribeConnection((state) => {
      if (!this.scene.isActive()) return;
      this.connection?.setText(connectionLabel(state));
      this.connection?.setColor(state === 'OPEN' ? '#8ee3aa' : state === 'RECONNECTING' ? '#ffd493' : '#a9b5c5');
      if (state === 'OPEN' && this.session?.room?.phase === 'BATTLE') this.session.startInputPump();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsubscribeMessage?.(); this.unsubscribeConnection?.(); });
    this.session.connect();
    this.renderBattle();
  }
  private onMessage(message: Pvp2v2ServerMessage): void {
    if (!this.scene.isActive() || !this.session) return;
    if (message.type === 'ERROR') { this.status?.setText(message.message ?? message.code).setColor('#ff9a91'); return; }
    if (message.type === 'WELCOME') {
      this.snapshot = message.battle;
      if (message.room.phase === 'LOBBY' && !this.readySent) { this.session.sendReady(); this.readySent = true; }
      this.status?.setText('나머지 지휘관 준비를 기다리는 중…').setColor('#ffd493'); this.renderBattle(); this.renderControls(); return;
    }
    if (message.type === 'ROOM_STATE') {
      this.snapshot = message.battle;
      if (message.room.phase === 'BATTLE') { this.status?.setText('4인 lockstep 전투 진행 중').setColor('#8ee3aa'); this.session.startInputPump(); }
      if (message.room.phase === 'FINISHED' && message.terminalResult && !this.finished) this.showResult(message.terminalResult, message.terminalReason ?? 'BATTLE');
      this.renderBattle(); this.renderControls(); return;
    }
    if (message.type === 'BATTLE_STARTED' || message.type === 'FRAME_COMMITTED') { this.snapshot = message.battle; this.session.startInputPump(); this.renderBattle(); this.renderControls(); return; }
    if (message.type === 'BATTLE_FINISHED') { this.snapshot = message.battle; this.renderBattle(); this.renderControls(); this.showResult(message.result, message.reason); return; }
    if (message.type === 'BATTLE_VOID') { this.showVoid(message.reason); return; }
    if (message.type === 'ACCOUNT_SETTLED') this.status?.setText('2v2 일반전 기록 저장 완료').setColor('#8ee3aa');
    else if (message.type === 'ACCOUNT_SETTLEMENT_ERROR') this.status?.setText(`2v2 결과 저장 재시도 필요 · ${message.message}`).setColor('#ffd493');
  }
  private renderBattle(): void {
    this.battlefield?.destroy(true); this.battlefield = this.add.container(0, 0);
    const snapshot = this.snapshot; const compact = isCompactMobileViewport();
    if (!snapshot) { this.battlefield.add(addText(this, INTERNAL_WIDTH / 2, 330, '2v2 전투 상태 동기화 중…', compact ? 27 : 23, '#b6c0ce', 'center').setOrigin(0.5)); return; }
    const mineSeat = this.session?.seatId; const mineTeam = mineSeat?.startsWith('A') ? 'A' : mineSeat?.startsWith('B') ? 'B' : null;
    const aRatio = Math.max(0, snapshot.bases.aHp / Math.max(1, snapshot.bases.aMaxHp)); const bRatio = Math.max(0, snapshot.bases.bHp / Math.max(1, snapshot.bases.bMaxHp));
    this.battlefield.add(addText(this, 75, 98, `A팀${mineTeam === 'A' ? ' · 우리팀' : ''}  ${snapshot.bases.aHp}/${snapshot.bases.aMaxHp}`, compact ? 19 : 16, '#addbff'));
    this.battlefield.add(this.add.rectangle(75, 128, 430, 18, 0x1b2631).setOrigin(0, 0.5)); this.battlefield.add(this.add.rectangle(75, 128, 430 * aRatio, 14, 0x6198c7).setOrigin(0, 0.5));
    this.battlefield.add(addText(this, 1205, 98, `B팀${mineTeam === 'B' ? ' · 우리팀' : ''}  ${snapshot.bases.bHp}/${snapshot.bases.bMaxHp}`, compact ? 19 : 16, '#ffb5af', 'right').setOrigin(1, 0));
    this.battlefield.add(this.add.rectangle(775, 128, 430, 18, 0x302022).setOrigin(0, 0.5)); this.battlefield.add(this.add.rectangle(775 + 430 * (1 - bRatio), 128, 430 * bRatio, 14, 0xc46f70).setOrigin(0, 0.5));
    const left = 70, right = 1210, fieldY = 330;
    this.battlefield.add(this.add.rectangle(INTERNAL_WIDTH / 2, fieldY, right - left, 245, 0x181f29, 0.96).setStrokeStyle(2, 0x526072, 1));
    this.battlefield.add(this.add.rectangle(left + 20, fieldY, 34, 180, 0x557fa4, 1)); this.battlefield.add(this.add.rectangle(right - 20, fieldY, 34, 180, 0x9f5c61, 1));
    snapshot.units.filter((unit) => unit.state !== 'DYING').forEach((unit, index) => {
      const x = left + 45 + (Math.max(0, Math.min(PVP_ARENA_TEAM_V1.mapLength, unit.anchorX)) / PVP_ARENA_TEAM_V1.mapLength) * (right - left - 90); const y = fieldY + ((index % 6) - 2.5) * 16;
      const ourTeam = unit.teamId === mineTeam; const fill = unit.teamId === 'A' ? (ourTeam ? 0x67a1d2 : 0x527da3) : (ourTeam ? 0xd57d79 : 0xae5d61);
      this.battlefield!.add(this.add.circle(x, y, unit.ownerSeatId === mineSeat ? 16 : 13, fill, 1).setStrokeStyle(2, 0xf0f3f8, unit.ownerSeatId === mineSeat ? 0.9 : 0.5));
      const name = getSlotById(unit.definitionId)?.displayName ?? unit.definitionId;
      this.battlefield!.add(addText(this, x, y - 28, `${unit.ownerSeatId ?? '?'}·${name}`, compact ? 11 : 9, unit.teamId === 'A' ? '#d2eaff' : '#ffd6d1', 'center').setOrigin(0.5));
    });
    const secondsLeft = Math.max(0, Math.ceil((snapshot.timeLimitFrames - snapshot.tick) / 30)); const min = Math.floor(secondsLeft / 60); const sec = String(secondsLeft % 60).padStart(2, '0');
    const mine = snapshot.seats.find((seat) => seat.seatId === mineSeat); const partner = snapshot.seats.find((seat) => seat.teamId === mineTeam && seat.seatId !== mineSeat);
    if (mine) this.battlefield.add(addText(this, 75, 465, `${mine.seatId} 내 보급 ${mine.supply}/${mine.maxSupply} · Lv${mine.supplyLevel}`, compact ? 19 : 16, '#f0d67d'));
    if (partner) this.battlefield.add(addText(this, 1205, 465, `동료 ${partner.seatId} · 보급 ${partner.supply}/${partner.maxSupply} · Lv${partner.supplyLevel}`, compact ? 17 : 14, '#b8c8d9', 'right').setOrigin(1, 0));
    this.battlefield.add(addText(this, INTERNAL_WIDTH / 2, 463, `${min}:${sec} · 팀 공유 전선포격기`, compact ? 18 : 15, secondsLeft <= 60 ? '#ffb58f' : '#9dacbe', 'center').setOrigin(0.5));
  }
  private renderControls(): void {
    this.controls?.destroy(true); this.controls = this.add.container(0, 0);
    if (!this.snapshot || !this.session?.seatId || this.finished) return;
    const compact = isCompactMobileViewport(); const seat = this.snapshot.seats.find((entry) => entry.seatId === this.session!.seatId); if (!seat) return;
    const slotIds = Object.keys(seat.costs).slice(0, 5);
    slotIds.forEach((slotId, index) => { const x = 105 + index * 184; const info = getSlotById(slotId); const cooldown = seat.cooldowns[slotId] ?? 0; const cost = seat.costs[slotId] ?? 0; const label = `${index + 1} ${info?.displayName ?? slotId}\n${cooldown > 0 ? `${cooldown}F` : `${cost} 보급`}`; this.controls!.add(addButton(this, x, 625, 170, compact ? 80 : 64, label, () => this.session?.queueCommand({ type: 'SPAWN', slotId }), cooldown > 0 || seat.supply < cost ? 0x48515e : 0x5f86aa)); });
    const upgrade = seat.nextSupplyUpgradeCost === null ? '보급소 MAX' : `보급소 강화\n${seat.nextSupplyUpgradeCost}`;
    this.controls.add(addButton(this, 1080, 585, 190, compact ? 72 : 58, upgrade, () => this.session?.queueCommand({ type: 'UPGRADE_SUPPLY' }), seat.nextSupplyUpgradeCost !== null && seat.supply >= seat.nextSupplyUpgradeCost ? 0x7a6e4f : 0x4d535d));
    const team = this.snapshot.teams.find((entry) => entry.teamId === seat.teamId);
    this.controls.add(addButton(this, 1080, 660, 190, compact ? 72 : 58, `팀 전선포격기\n${team && team.baseWeaponCooldownFrames > 0 ? `${team.baseWeaponCooldownFrames}F` : 'READY'}`, () => this.session?.queueCommand({ type: 'FIRE_BASE_WEAPON' }), team && team.baseWeaponCooldownFrames === 0 ? 0x8a665a : 0x4d535d));
  }
  private showResult(result: 'A' | 'B' | 'DRAW', reason: string): void {
    if (this.finished) return; this.finished = true; this.session?.stopInputPump();
    const mine = this.session?.seatId; const myTeam = mine?.startsWith('A') ? 'A' : 'B'; const draw = result === 'DRAW'; const won = !draw && result === myTeam;
    this.resultLayer = this.add.container(0, 0).setDepth(400); const compact = isCompactMobileViewport();
    this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.84).setInteractive());
    this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 740, 400, 0x202632, 0.99).setStrokeStyle(4, draw ? 0x777d88 : won ? 0x69a87b : 0xa86464, 1));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 260, draw ? '2v2 무승부' : won ? '우리 팀 승리' : '우리 팀 패배', compact ? 48 : 42, draw ? '#d8dde5' : won ? '#bdf1c7' : '#ffb0a9', 'center').setOrigin(0.5));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 330, reason === 'FORFEIT' ? '상대 팀 재접속 유예 종료 · 기권 판정' : '서버 권위 4인 전투 결과', compact ? 20 : 17, '#c2ccd8', 'center').setOrigin(0.5));
    this.resultLayer.add(addButton(this, 505, 445, 220, compact ? 82 : 60, 'PvP 허브', () => { this.session?.close(); this.scene.start('pvp-hub'); }, 0x5f7897));
    this.resultLayer.add(addButton(this, 775, 445, 220, compact ? 82 : 60, '2v2 다시 매칭', () => { this.session?.close(); this.scene.start('pvp-2v2-matchmaking'); }, 0x6b7799));
  }
  private showVoid(reason: string): void {
    if (this.finished) return; this.finished = true; this.session?.stopInputPump(); this.resultLayer = this.add.container(0, 0).setDepth(400); const compact = isCompactMobileViewport();
    this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.84).setInteractive()); this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 740, 350, 0x202632, 0.99).setStrokeStyle(4, 0x777d88, 1));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 285, '2v2 무효 경기', compact ? 44 : 39, '#d8dde5', 'center').setOrigin(0.5)); this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 350, reason === 'both_teams_disconnect_timeout' ? '양 팀에서 연결 이탈이 발생해 전적 없이 종료했습니다.' : reason, compact ? 19 : 16, '#b9c3d0', 'center').setOrigin(0.5)); this.resultLayer.add(addButton(this, INTERNAL_WIDTH / 2, 440, 260, compact ? 82 : 60, '2v2 다시 매칭', () => { this.session?.close(); this.scene.start('pvp-2v2-matchmaking'); }, 0x6b7799));
  }
  private leave(): void { this.session?.close(); this.scene.start('pvp-hub'); }
}
