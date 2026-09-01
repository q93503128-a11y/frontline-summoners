import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';
import {
  createFriendlyPvp2v2Lobby,
  getFriendlyPvp2v2LobbyStatus,
  joinFriendlyPvp2v2Lobby,
  leaveFriendlyPvp2v2Lobby,
  type FriendlyPvp2v2LobbyState,
} from './pvp-friendly-2v2-network.ts';
import { createFriendPvp2v2Invite } from './social-network.ts';

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : '2v2 친선전 요청 오류';
  const labels: Readonly<Record<string, string>> = {
    pvp_chapter_1_required: '메인 1장을 완료해야 2v2 친선전을 사용할 수 있습니다.',
    pvp_requires_5_owned_characters: '2v2 친선전에는 보유 캐릭터 5명이 필요합니다.',
    pvp_deck_requires_5_characters: '편성 앞 5칸을 채워 주세요.',
    friendly_2v2_lobby_not_found: '2v2 친선전 방을 찾을 수 없습니다.',
    friendly_2v2_lobby_expired: '2v2 친선전 방이 만료되었습니다.',
    friendly_2v2_lobby_cancelled: '방장이 2v2 친선전 방을 닫았습니다.',
    friendly_2v2_lobby_full: '이미 4명이 확정된 2v2 친선전 방입니다.',
    friendly_2v2_blocked: '차단 관계가 포함된 방에는 참가할 수 없습니다.',
    friendly_2v2_room_initialization_failed: '2v2 친선 전투방을 만들지 못했습니다.',
    friendly_2v2_host_only: '방장만 친구를 직접 초대할 수 있습니다.',
    social_target_not_found: '해당 친구 코드를 찾을 수 없습니다.',
    social_friend_required: '친구 목록에 있는 지휘관만 직접 초대할 수 있습니다.',
    social_blocked: '차단 관계인 플레이어에게는 초대를 보낼 수 없습니다.',
    social_pvp_2v2_already_joined: '이미 이 2v2 방에 참가한 친구입니다.',
    social_pvp_2v2_invite_pending: '이 친구에게 보낸 2v2 초대가 이미 대기 중입니다.',
  };
  return labels[message] ?? message;
}

export class FriendlyPvp2v2LobbyScene extends Phaser.Scene {
  private lobby: FriendlyPvp2v2LobbyState | null = null;
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private pollEvent: Phaser.Time.TimerEvent | undefined;
  private pending = false;

  constructor() { super('pvp-friendly-2v2-lobby'); }

  init(data: { lobby?: FriendlyPvp2v2LobbyState } = {}): void {
    this.lobby = data.lobby ?? null;
    this.pending = false;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 34, '2v2 친선전', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 86, '친구 직접 초대 또는 방 코드 · 표준 Lv50/+0 · 레이팅/시즌 보상 없음', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1165, 62, 170, compact ? 78 : 50, 'PvP 허브', () => { void this.leave(); }, 0x586275);
    this.status = addText(this, INTERNAL_WIDTH / 2, 675, '친구 3명을 직접 초대하거나 받은 코드를 입력하세요.', compact ? 20 : 16, '#a9b5c5', 'center').setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.pollEvent?.destroy());
    this.render();
    if (this.lobby?.state === 'MATCHED') this.enter(this.lobby);
    else if (this.lobby?.state === 'WAITING') {
      this.status.setText(this.lobby.host ? '2v2 파티 대기 중 · 친구를 직접 초대할 수 있습니다.' : `좌석 ${this.lobby.seatId ?? '-'} 참가 완료 · 나머지 인원을 기다립니다.`).setColor('#8ee3aa');
      this.startPolling();
    }
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const lobby = this.lobby;
    this.content.add(this.add.rectangle(INTERNAL_WIDTH / 2, 345, 980, 430, 0x232b38, 0.98).setStrokeStyle(3, 0x6c7899, 1));
    if (!lobby || lobby.state !== 'WAITING') {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 170, 'FRIENDLY TEAM BATTLE', compact ? 34 : 30, '#dbe8ff', 'center').setOrigin(0.5));
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 255, '플레이어당 5칸 · 개인 보급/보급소\n팀 공유 기지 · 팀 공유 전선포격기 · 20초 재접속 유예', compact ? 21 : 18, '#c4cfdd', 'center').setOrigin(0.5));
      this.content.add(addButton(this, 430, 430, 310, compact ? 92 : 66, '2v2 방 만들기', () => { void this.createLobby(); }, 0x5d748f));
      this.content.add(addButton(this, 850, 430, 310, compact ? 92 : 66, '참가 코드 입력', () => { void this.joinByPrompt(); }, 0x735d87));
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 525, '입장 순서: A1(방장) → B1 → A2 → B2 · 두 팀이 번갈아 채워집니다.', compact ? 17 : 14, '#929eae', 'center').setOrigin(0.5));
      return;
    }

    const secondsLeft = Math.max(0, Math.ceil((lobby.expiresAtMs - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 155, `4인 참가 대기 · ${lobby.participantCount}/4`, compact ? 34 : 30, '#fff4cf', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 225, lobby.inviteCode, compact ? 48 : 44, '#f0d67d', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 292, `내 좌석 ${lobby.seatId ?? '-'} · 방 만료 ${minutes}:${seconds}`, compact ? 22 : 18, '#c9d3e0', 'center').setOrigin(0.5));
    const seats = ['A1 방장', 'B1 참가자 1', 'A2 참가자 2', 'B2 참가자 3'];
    seats.forEach((seat, index) => {
      const occupied = index < lobby.participantCount;
      const x = 330 + (index % 2) * 620;
      const y = 350 + Math.floor(index / 2) * 55;
      this.content!.add(addText(this, x, y, `${occupied ? '●' : '○'} ${seat}`, compact ? 19 : 16, occupied ? '#8ee3aa' : '#7f8a99', 'center').setOrigin(0.5));
    });
    if (lobby.host) {
      this.content.add(addButton(this, 330, 500, 245, compact ? 86 : 62, '친구 직접 초대', () => { void this.inviteFriendByPrompt(); }, 0x6f6a9a));
      this.content.add(addButton(this, 640, 500, 245, compact ? 86 : 62, '코드 복사', () => { void this.copyCode(lobby.inviteCode); }, 0x5f7897));
      this.content.add(addButton(this, 950, 500, 245, compact ? 86 : 62, '방 취소', () => { void this.leaveLobby(); }, 0x815b60));
    } else {
      this.content.add(addButton(this, 455, 500, 300, compact ? 86 : 62, '코드 복사', () => { void this.copyCode(lobby.inviteCode); }, 0x5f7897));
      this.content.add(addButton(this, 825, 500, 300, compact ? 86 : 62, '방 나가기', () => { void this.leaveLobby(); }, 0x815b60));
    }
  }

  private async createLobby(): Promise<void> {
    if (this.pending) return;
    this.pending = true;
    this.status?.setText('2v2 친선전 방을 만드는 중…').setColor('#a9b5c5');
    try {
      const lobby = await createFriendlyPvp2v2Lobby();
      if (!this.scene.isActive()) return;
      this.lobby = lobby;
      if (lobby.state === 'MATCHED') return this.enter(lobby);
      this.status?.setText('친구 직접 초대 버튼으로 최대 3명을 부르거나 코드를 공유하세요.').setColor('#8ee3aa');
      this.render();
      this.startPolling();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(errorText(error)).setColor('#ff9a91');
    } finally { this.pending = false; }
  }

  private async joinByPrompt(): Promise<void> {
    if (this.pending || typeof window === 'undefined') return;
    const code = window.prompt('2v2 친선전 참가 코드를 입력하세요.');
    if (!code) return;
    this.pending = true;
    this.status?.setText('2v2 친선전 방에 참가하는 중…').setColor('#a9b5c5');
    try {
      const lobby = await joinFriendlyPvp2v2Lobby(code);
      if (!this.scene.isActive()) return;
      this.lobby = lobby;
      if (lobby.state === 'MATCHED') return this.enter(lobby);
      this.status?.setText(`좌석 ${lobby.seatId ?? '-'} 참가 완료 · 나머지 인원을 기다립니다.`).setColor('#8ee3aa');
      this.render();
      this.startPolling();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(errorText(error)).setColor('#ff9a91');
    } finally { this.pending = false; }
  }

  private async inviteFriendByPrompt(): Promise<void> {
    const lobby = this.lobby;
    if (this.pending || !lobby || lobby.state !== 'WAITING' || !lobby.host || typeof window === 'undefined') return;
    const friendCode = window.prompt('직접 초대할 친구 코드(FS-XXXXXXXX)를 입력하세요.');
    if (!friendCode) return;
    this.pending = true;
    this.status?.setText('2v2 친구 초대를 보내는 중…').setColor('#a9b5c5');
    try {
      await createFriendPvp2v2Invite(lobby.inviteCode, friendCode);
      if (this.scene.isActive()) this.status?.setText('2v2 친선전 초대를 보냈습니다. 상대가 수락하면 이 방에 자동 참가합니다.').setColor('#8ee3aa');
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(errorText(error)).setColor('#ff9a91');
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
      const next = await getFriendlyPvp2v2LobbyStatus(lobby.inviteCode);
      if (!this.scene.isActive()) return;
      this.lobby = next;
      if (next.state === 'MATCHED') return this.enter(next);
      this.render();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(errorText(error)).setColor('#ff9a91');
      this.pollEvent?.destroy();
      this.pollEvent = undefined;
    } finally { this.pending = false; }
  }

  private enter(lobby: Extract<FriendlyPvp2v2LobbyState, { state: 'MATCHED' }>): void {
    this.pollEvent?.destroy();
    this.pollEvent = undefined;
    this.status?.setText(`4명 확정 · ${lobby.seatId} 좌석으로 친선 전투에 입장합니다.`).setColor('#8ee3aa');
    this.time.delayedCall(100, () => this.scene.start('pvp-2v2-match', {
      websocketPath: lobby.websocketPath,
      modeId: 'pvp_friendly_2v2',
      nextScene: 'pvp-friendly-2v2-lobby',
    }));
  }

  private async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.status?.setText('2v2 참가 코드를 복사했습니다.').setColor('#8ee3aa');
    } catch {
      if (typeof window !== 'undefined') window.prompt('이 코드를 친구들에게 보내세요.', code);
    }
  }

  private async leaveLobby(): Promise<void> {
    const lobby = this.lobby;
    if (lobby?.state === 'WAITING') await leaveFriendlyPvp2v2Lobby(lobby.inviteCode).catch(() => undefined);
    this.lobby = null;
    this.pollEvent?.destroy();
    this.pollEvent = undefined;
    if (this.scene.isActive()) {
      this.status?.setText('2v2 친선전 대기방에서 나왔습니다.').setColor('#a9b5c5');
      this.render();
    }
  }

  private async leave(): Promise<void> {
    const lobby = this.lobby;
    if (lobby?.state === 'WAITING') await leaveFriendlyPvp2v2Lobby(lobby.inviteCode).catch(() => undefined);
    if (this.scene.isActive()) this.scene.start('pvp-hub');
  }
}
