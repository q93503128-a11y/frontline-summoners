import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import type { BaseWeaponId } from '@frontline/sim/playable';
import { getAccountClientState } from './account-network.ts';
import { accountCoopLoadout, getAuthenticatedCoopClientProgress, type AccountCoopClientProgress } from './coop-account-progress.ts';
import {
  getPublicCoopMatchmakingStatus,
  joinPublicCoopMatchmaking,
  leavePublicCoopMatchmaking,
  type PublicCoopMatchmakingState,
} from './coop-matchmaking-network.ts';
import { CoopSession, type CoopServerMessage } from './coop-network.ts';
import { BASE_WEAPON_UNLOCKS, getUnlockedBaseWeaponIds } from './base-weapon-progression.ts';
import { ALL_STAGES, getStage } from './prototype.ts';
import {
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
  setButtonState,
} from './scene-ui.ts';
import { isSortieStageUnlocked } from './stage-navigation.ts';
import { isCompactMobileViewport } from './viewport.ts';

function baseWeaponName(id: BaseWeaponId | null | undefined): string {
  return BASE_WEAPON_UNLOCKS.find((entry) => entry.id === id)?.displayName ?? '전선포격기';
}

function eligibleStageIds(progress: AccountCoopClientProgress): readonly string[] {
  return ALL_STAGES
    .filter((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP' && isSortieStageUnlocked(stage.id, progress.clearedStageIds))
    .map((stage) => stage.id);
}

function matchmakingError(error: unknown): string {
  const message = error instanceof Error ? error.message : '공개 협동 매칭 오류';
  const labels: Readonly<Record<string, string>> = {
    public_coop_already_matched: '이미 상대가 배정되었습니다.',
    public_coop_room_unavailable: '배정된 협동 방을 복구하지 못했습니다.',
    stage_not_coop_eligible: '이 전장은 협동할 수 없습니다.',
  };
  return labels[message] ?? message;
}

export class PublicCoopMatchmakingScene extends Phaser.Scene {
  private progress: AccountCoopClientProgress | null = null;
  private stageIds: readonly string[] = [];
  private selected = 0;
  private state: PublicCoopMatchmakingState = { state: 'IDLE' };
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private leaveButton?: Phaser.GameObjects.Container;
  private polling = false;
  private commandPending: 'JOIN' | 'CANCEL' | null = null;
  private pollEvent: Phaser.Time.TimerEvent | undefined;

  constructor() { super('public-coop-matchmaking'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 34, '공개 협동 매칭', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 86, '같은 전장의 온라인 지휘관과 자동 매칭 · 계정 귀속 전투', compact ? 19 : 16, COLORS.muted);
    this.leaveButton = addButton(this, 1170, 60, 160, compact ? 78 : 50, '출정', () => { void this.cancelAndLeave(); }, 0x586275, { tone: 'quiet' });
    this.status = addText(this, INTERNAL_WIDTH / 2, 640, '', compact ? 19 : 15, '#a9b5c5', 'center').setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.pollEvent?.destroy());

    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      this.status.setText('공개 매칭은 온라인 로그인 상태에서만 사용할 수 있습니다.').setColor('#ffd493');
      this.render();
      return;
    }
    this.progress = getAuthenticatedCoopClientProgress();
    if (!this.progress) {
      this.status.setText('계정 협동 편성을 읽을 수 없습니다.').setColor('#ff9a91');
      this.render();
      return;
    }
    this.stageIds = eligibleStageIds(this.progress);
    this.render();
    void this.restoreQueue();
  }

  private async restoreQueue(): Promise<void> {
    try {
      this.state = await getPublicCoopMatchmakingStatus();
      if (!this.scene.isActive()) return;
      if (this.state.state !== 'IDLE') {
        const index = this.stageIds.indexOf(this.state.stageId);
        if (index >= 0) this.selected = index;
      }
      this.handleState();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(matchmakingError(error)).setColor('#ff9a91');
    }
  }

  private selectedStageId(): string | null { return this.stageIds[this.selected] ?? null; }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    this.syncLeaveButtonState();

    if (!this.progress || this.stageIds.length === 0) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 350, this.progress ? '현재 협동 가능한 전장이 없습니다.' : '온라인 계정이 필요합니다.', compact ? 27 : 23, '#b3bdca', 'center').setOrigin(0.5));
      return;
    }

    const stageId = this.selectedStageId()!;
    const stage = getStage(stageId);
    const stageLocked = this.state.state !== 'IDLE';
    const stateLabel = this.state.state === 'IDLE'
      ? '전장 선택 가능'
      : this.state.state === 'QUEUED'
        ? '대기열 참가 중'
        : this.state.state === 'PAIRING'
          ? '상대 좌석 확정 중'
          : '상대 배정 완료';
    const stateKind = this.state.state === 'IDLE' ? 'neutral' : this.state.state === 'QUEUED' || this.state.state === 'PAIRING' ? 'warning' : 'online';

    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 360, 940, 390, 0x6388a5, 0x19232d, 0.97));
    this.content.add(addSectionHeading(this, 190, 184, '공개 협동 전선', 900, 0x6388a5));
    this.content.add(addStatusPill(this, 915, 182, stateLabel, stateKind));

    const rail = this.add.graphics();
    rail.lineStyle(5, 0x6388a5, 0.45).lineBetween(350, 348, 930, 348);
    rail.fillStyle(stageLocked ? 0x8a784f : 0x6388a5, 0.96).fillCircle(640, 348, 31);
    rail.lineStyle(3, 0xd6e1eb, 0.55).strokeCircle(640, 348, 31);
    this.content.add(rail);

    this.content.add(addText(this, INTERNAL_WIDTH / 2, 230, stage.name, compact ? 34 : 31, '#fff4cf', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 277, `${stage.chapter} · 난이도 ${stage.difficulty}/12 · 전장 ${stage.mapLength}m`, compact ? 20 : 17, '#b9c7d8', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 316, `협동 가능 전장 ${this.selected + 1} / ${this.stageIds.length}`, compact ? 18 : 15, '#9ca8b8', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 337, String(this.selected + 1), compact ? 18 : 15, '#ffffff', 'center').setOrigin(0.5));

    const previous = addButton(this, 330, 420, 180, compact ? 80 : 56, '◀ 이전 전장', () => this.moveStage(-1), 0x586d86, { tone: 'quiet' });
    const next = addButton(this, 950, 420, 180, compact ? 80 : 56, '다음 전장 ▶', () => this.moveStage(1), 0x586d86, { tone: 'quiet' });
    this.content.add([previous, next]);
    if (this.stageIds.length <= 1) {
      setButtonState(previous, 'disabled', '현재 선택 가능한 협동 전장이 하나뿐입니다.');
      setButtonState(next, 'disabled', '현재 선택 가능한 협동 전장이 하나뿐입니다.');
    } else if (stageLocked) {
      const reason = this.state.state === 'QUEUED'
        ? '대기열을 취소한 뒤 전장을 바꿀 수 있습니다.'
        : '상대 좌석을 확정하는 동안 전장을 바꿀 수 없습니다.';
      setButtonState(previous, 'locked', reason);
      setButtonState(next, 'locked', reason);
    }

    const primaryLabel = this.state.state === 'IDLE'
      ? this.commandPending === 'JOIN' ? '대기열 참가 요청 중…' : '이 전장으로 매칭 시작'
      : this.state.state === 'QUEUED'
        ? this.commandPending === 'CANCEL' ? '매칭 취소 요청 중…' : '대기열 취소'
        : this.state.state === 'PAIRING'
          ? '상대 좌석 확정 중…'
          : '협동 로비로 이동 중…';
    const primary = addButton(this, INTERNAL_WIDTH / 2, 505, 350, compact ? 88 : 66, primaryLabel, () => {
      if (this.state.state === 'IDLE') void this.join();
      else if (this.state.state === 'QUEUED') void this.cancel();
    }, this.state.state === 'IDLE' ? 0x5f8f75 : this.state.state === 'QUEUED' ? 0x8d6e59 : 0x56606c, { tone: this.state.state === 'QUEUED' ? 'danger' : 'primary' });
    this.content.add(primary);

    if (this.commandPending !== null || this.state.state === 'PAIRING' || this.state.state === 'MATCHED') {
      const reason = this.commandPending === 'JOIN'
        ? '대기열 참가 요청을 서버에 보내고 있습니다.'
        : this.commandPending === 'CANCEL'
          ? '대기열 취소 요청을 서버에 보내고 있습니다.'
          : this.state.state === 'PAIRING'
            ? '상대 지휘관의 좌석을 확정하고 있습니다.'
            : '상대가 배정되어 협동 로비로 이동합니다.';
      setButtonState(primary, 'loading', reason);
    } else if (this.state.state === 'QUEUED') {
      setButtonState(primary, 'warning');
    }
  }

  private syncLeaveButtonState(): void {
    if (!this.leaveButton) return;
    if (this.commandPending !== null) {
      setButtonState(this.leaveButton, 'loading', '현재 매칭 요청 처리가 끝난 뒤 이동할 수 있습니다.');
      return;
    }
    if (this.state.state === 'PAIRING') {
      setButtonState(this.leaveButton, 'locked', '상대 좌석을 확정하는 동안 잠시 기다려주세요.');
      return;
    }
    if (this.state.state === 'MATCHED') {
      setButtonState(this.leaveButton, 'loading', '상대가 배정되어 협동 로비로 이동합니다.');
      return;
    }
    setButtonState(this.leaveButton, 'default');
  }

  private moveStage(delta: number): void {
    if (this.state.state !== 'IDLE' || this.stageIds.length === 0) return;
    this.selected = (this.selected + delta + this.stageIds.length) % this.stageIds.length;
    this.render();
  }

  private async join(): Promise<void> {
    const stageId = this.selectedStageId();
    if (!stageId || this.commandPending !== null) return;
    this.commandPending = 'JOIN';
    this.status?.setText('공개 협동 대기열 참가를 요청하는 중…').setColor('#a9b5c5');
    this.render();
    try {
      this.state = await joinPublicCoopMatchmaking(stageId);
      if (!this.scene.isActive()) return;
      this.handleState();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(matchmakingError(error)).setColor('#ff9a91');
    } finally {
      this.commandPending = null;
      if (this.scene.isActive()) this.render();
    }
  }

  private async poll(): Promise<void> {
    if (this.polling || (this.state.state !== 'QUEUED' && this.state.state !== 'PAIRING')) return;
    this.polling = true;
    try {
      this.state = await getPublicCoopMatchmakingStatus();
      if (this.scene.isActive()) this.handleState();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(matchmakingError(error)).setColor('#ff9a91');
    } finally { this.polling = false; }
  }

  private handleState(): void {
    if (this.state.state === 'MATCHED') {
      this.pollEvent?.destroy();
      this.status?.setText('상대를 찾았습니다. 협동 로비로 이동합니다.').setColor('#8ee3aa');
      this.render();
      const path = this.state.websocketPath;
      this.time.delayedCall(120, () => this.scene.start('public-coop-lobby', { websocketPath: path }));
      return;
    }
    if (this.state.state === 'QUEUED' || this.state.state === 'PAIRING') {
      this.status?.setText(this.state.state === 'QUEUED' ? '같은 전장의 지휘관을 찾는 중…' : '상대 좌석을 확정하는 중…').setColor('#ffd493');
      if (!this.pollEvent) this.pollEvent = this.time.addEvent({ delay: 1000, loop: true, callback: () => { void this.poll(); } });
    } else {
      this.status?.setText('전장을 고르고 공개 매칭을 시작하세요.').setColor('#a9b5c5');
      this.pollEvent?.destroy();
      this.pollEvent = undefined;
    }
    this.render();
  }

  private async cancel(): Promise<void> {
    if (this.commandPending !== null) return;
    this.commandPending = 'CANCEL';
    this.status?.setText('공개 협동 대기열을 취소하는 중…').setColor('#ffd493');
    this.render();
    try {
      this.state = await leavePublicCoopMatchmaking();
      if (this.scene.isActive()) this.handleState();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(matchmakingError(error)).setColor('#ff9a91');
    } finally {
      this.commandPending = null;
      if (this.scene.isActive()) this.render();
    }
  }

  private async cancelAndLeave(): Promise<void> {
    if (this.commandPending !== null || this.state.state === 'PAIRING' || this.state.state === 'MATCHED') return;
    if (this.state.state === 'QUEUED') await this.cancel().catch(() => undefined);
    if (this.scene.isActive()) this.scene.start('stage-hub');
  }
}

export class PublicCoopLobbyScene extends Phaser.Scene {
  private websocketPath = '';
  private progress: AccountCoopClientProgress | null = null;
  private session: CoopSession | null = null;
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private unsubscribeMessage: (() => void) | undefined;
  private unsubscribeConnection: (() => void) | undefined;

  constructor() { super('public-coop-lobby'); }

  init(data: { websocketPath?: string } = {}): void { this.websocketPath = data.websocketPath ?? ''; }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 34, '공개 협동 로비', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 86, '자동 매칭 · 계정 편성 · 개인 보급 · 공유 기지/병기', compact ? 19 : 16, COLORS.muted);
    this.status = addText(this, INTERNAL_WIDTH / 2, 620, '협동 방 연결 중…', compact ? 20 : 16, '#a9b5c5', 'center').setOrigin(0.5);
    this.progress = getAuthenticatedCoopClientProgress();
    if (!this.progress || !this.websocketPath) {
      this.status.setText('온라인 계정 또는 매칭 좌석 정보가 없습니다.').setColor('#ff9a91');
      return;
    }
    this.session = new CoopSession(this.websocketPath);
    this.unsubscribeMessage = this.session.subscribe((message) => this.onMessage(message));
    this.unsubscribeConnection = this.session.subscribeConnection((state) => {
      if (!this.scene.isActive()) return;
      this.status?.setText(state === 'OPEN' ? '상대와 연결됨' : state === 'RECONNECTING' ? '재접속 중…' : '협동 서버 연결 중…').setColor(state === 'OPEN' ? '#8ee3aa' : '#ffd493');
      this.render();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.session.connect();
    this.render();
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    if (!this.session?.room || !this.progress) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 340, '매칭된 상대의 접속을 기다리는 중…', 24, '#c3ccd8', 'center').setOrigin(0.5));
      return;
    }
    const room = this.session.room;
    const stage = getStage(room.stageId);
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 150, stage.name, 31, '#fff4cf', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 190, 'PUBLIC MATCH · 계정 귀속 좌석', 15, '#a9c8e8', 'center').setOrigin(0.5));
    room.seats.forEach((seat, index) => {
      const x = index === 0 ? 405 : 875;
      const mine = seat.seatId === this.session!.seatId;
      this.content!.add(this.add.rectangle(x, 340, 370, 250, mine ? 0x29364a : 0x272d38, 0.98).setStrokeStyle(3, mine ? 0x6fa2d0 : 0x566171, 1));
      this.content!.add(addText(this, x, 270, `${seat.seatId} 지휘관${mine ? ' · 나' : ''}`, 23, '#ffffff', 'center').setOrigin(0.5));
      this.content!.add(addText(this, x, 318, seat.connected ? '온라인' : '접속 대기', 17, seat.connected ? '#8ee3aa' : '#a3adba', 'center').setOrigin(0.5));
      this.content!.add(addText(this, x, 360, `편성 ${seat.deckSize}/5 · ${seat.ready ? '준비 완료' : '준비 전'}`, 16, seat.ready ? '#f0d67d' : '#bbc4cf', 'center').setOrigin(0.5));
      this.content!.add(addText(this, x, 402, baseWeaponName(seat.selectedBaseWeaponId), 16, '#bfe8ff', 'center').setOrigin(0.5));
    });
    const mine = room.seats.find((seat) => seat.seatId === this.session!.seatId);
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 490, room.agreedBaseWeaponId ? `공유 병기 합의 · ${baseWeaponName(room.agreedBaseWeaponId)}` : '병기 불일치 · 같은 병기를 선택해야 준비할 수 있습니다.', 17, room.agreedBaseWeaponId ? '#8ee3aa' : '#ffd493', 'center').setOrigin(0.5));
    this.content.add(addButton(this, 430, 555, 260, 60, `병기 변경 · ${baseWeaponName(mine?.selectedBaseWeaponId)}`, () => this.cycleWeapon(), mine?.ready ? 0x424a56 : 0x4f7894));
    this.content.add(addButton(this, 720, 555, 220, 60, mine?.ready ? '준비 취소' : '준비', () => this.toggleReady(), mine?.ready ? 0x766854 : 0x5f8f75));
    this.content.add(addButton(this, 990, 555, 210, 60, '매칭 화면', () => this.leave(), 0x6b628f));
  }

  private onMessage(message: CoopServerMessage): void {
    if (!this.scene.isActive() || !this.session || !this.progress) return;
    if (message.type === 'ERROR') {
      this.status?.setText(message.message ?? message.code).setColor('#ff9a91');
      return;
    }
    if (message.type === 'WELCOME' || message.type === 'ROOM_STATE') {
      const room = message.room;
      const mine = room.seats.find((seat) => seat.seatId === this.session!.seatId);
      const accountBound = room.seats.every((seat) => seat.accountBound === true);
      if (!mine?.accountBound || !accountBound || room.matchKind !== 'CODE') {
        this.status?.setText('공개 매칭용 계정 귀속 방이 아닙니다.').setColor('#ff9a91');
        this.session.close();
        return;
      }
      this.render();
    }
    if (message.type === 'BATTLE_STARTED' || message.type === 'BATTLE_RESUME' || message.type === 'BATTLE_FINISHED') {
      const session = this.session;
      this.cleanup();
      this.scene.start('friend-coop-battle', { session });
    }
  }

  private cycleWeapon(): void {
    if (!this.session?.room || !this.progress) return;
    const mine = this.session.room.seats.find((seat) => seat.seatId === this.session!.seatId);
    if (!mine || mine.ready) return;
    const unlocked = getUnlockedBaseWeaponIds(this.progress.clearedStageIds);
    const current = Math.max(0, unlocked.indexOf(mine.selectedBaseWeaponId));
    const next = unlocked[(current + 1) % unlocked.length] ?? 'base_weapon_front_cannon';
    this.session.sendBaseWeaponSelection(next);
  }

  private toggleReady(): void {
    if (!this.session?.room || !this.progress) return;
    const mine = this.session.room.seats.find((seat) => seat.seatId === this.session!.seatId);
    try {
      if (mine?.ready) this.session.sendUnready();
      else this.session.sendReady(accountCoopLoadout(this.progress));
    } catch (error) {
      this.status?.setText(error instanceof Error ? error.message : '준비 상태 변경 실패').setColor('#ff9a91');
    }
  }

  private cleanup(): void {
    this.unsubscribeMessage?.();
    this.unsubscribeConnection?.();
    this.unsubscribeMessage = undefined;
    this.unsubscribeConnection = undefined;
  }

  private leave(): void {
    this.session?.close();
    this.cleanup();
    this.scene.start('public-coop-matchmaking');
  }
}
