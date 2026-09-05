import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { getSlotById } from './prototype.ts';
import { addButton, addText, COLORS, drawBackdrop, setButtonState } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';
import { getAccountClientState } from './account-network.ts';
import {
  PvpSession,
  getPvpAccountOverview,
  getPvpLeaderboard,
  getPvpMatchmakingStatus,
  joinPvpMatchmaking,
  leavePvpMatchmaking,
  type PvpBattleSnapshot,
  type PvpConnectionState,
  type PvpLeaderboardEntry,
  type PvpMatchmakingState,
  type PvpServerMessage,
} from './pvp-network.ts';

function connectionLabel(state: PvpConnectionState): string {
  if (state === 'OPEN') return '연결됨';
  if (state === 'RECONNECTING') return '재접속 중…';
  if (state === 'CONNECTING') return '연결 중…';
  return '연결 종료';
}

function modeName(modeId: string): string {
  return modeId === 'pvp_ranked_1v1' ? '1v1 랭킹전' : '1v1 일반전';
}

function tierName(id: string): string {
  const names: Readonly<Record<string, string>> = {
    BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘',
    DIAMOND: '다이아', MASTER: '마스터', GRANDMASTER: '그랜드마스터', FRONTLINE_APEX: '전선 최상위',
  };
  return names[id] ?? id;
}

function pvpError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'PvP 요청 오류';
  const labels: Readonly<Record<string, string>> = {
    pvp_chapter_1_required: '메인 1장을 완료해야 PvP에 참가할 수 있습니다.',
    pvp_ranked_ineligible: '현재 계정은 랭킹전 참가 조건을 충족하지 못했습니다.',
    pvp_match_initialization_failed: 'PvP 전투방을 만들지 못했습니다. 다시 매칭해 주세요.',
    pvp_match_room_lost_requeue_required: '이전 PvP 방이 만료되었습니다. 다시 매칭해 주세요.',
    pvp_already_matched: '이미 상대가 확정된 매치가 있습니다.',
  };
  if (message.startsWith('pvp_ranked_ineligible:')) return `랭킹전 참가 조건 미충족 · ${message.split(':').slice(1).join(':')}`;
  if (message.startsWith('pvp_deck_requires_')) return 'PvP에 필요한 편성 칸을 모두 채워 주세요.';
  return labels[message] ?? message;
}

function cooldownSeconds(frames: number): number {
  return Math.max(1, Math.ceil(Math.max(0, frames) / 30));
}

function resultReason(reason: string): string {
  if (reason === 'FORFEIT') return '재접속 유예 종료에 따른 기권 판정';
  if (reason === 'TIME_LIMIT') return '제한 시간 종료 판정';
  if (reason === 'BASE_DESTROYED') return '기지 파괴로 승부 확정';
  return '대전 결과 확정';
}

export class PvpHubScene extends Phaser.Scene {
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private loading = false;
  private leaderboard: readonly PvpLeaderboardEntry[] = [];
  private overview: Awaited<ReturnType<typeof getPvpAccountOverview>> | null = null;

  constructor() { super('pvp-hub'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 34, '대전 전선', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 86, 'Lv50 · +0 표준 성장 · 실제 보유 캐릭터와 해금 형태 사용', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1170, 62, 160, compact ? 78 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    this.status = addText(this, INTERNAL_WIDTH / 2, 680, '', compact ? 18 : 14, '#a9b5c5', 'center').setOrigin(0.5);
    this.render();
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    if (this.loading) return;
    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      this.status?.setText('PvP는 온라인 로그인 계정에서 사용할 수 있습니다.').setColor('#ffd493');
      return;
    }
    this.loading = true;
    this.status?.setText('PvP 기록과 순위표를 불러오는 중…').setColor('#a9b5c5');
    try {
      const [overview, leaderboard] = await Promise.all([getPvpAccountOverview(), getPvpLeaderboard(12)]);
      if (!this.scene.isActive()) return;
      this.overview = overview;
      this.leaderboard = leaderboard;
      this.status?.setText(overview.eligibility.chapter1Complete ? '전선 규칙 확인 완료' : '메인 1장 완료 후 PvP가 열립니다.').setColor(overview.eligibility.chapter1Complete ? '#8ee3aa' : '#ffd493');
      this.render();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(pvpError(error)).setColor('#ff9a91');
    } finally { this.loading = false; }
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const overview = this.overview;

    this.content.add(this.add.rectangle(305, 330, 500, 405, 0x242c39, 0.98).setStrokeStyle(3, 0x637a96, 1));
    this.content.add(addText(this, 305, 145, '내 PvP 기록', compact ? 28 : 24, '#fff4cf', 'center').setOrigin(0.5));
    if (overview) {
      const rating = overview.rating;
      const placement = rating.placementComplete ? `${tierName(rating.displayedTier)} · ${rating.mmr} 평점` : `배치전 ${rating.placementMatches}/5`;
      this.content.add(addText(this, 305, 205, placement, compact ? 25 : 21, '#f0d67d', 'center').setOrigin(0.5));
      this.content.add(addText(this, 305, 255, `랭킹 ${rating.rankedWins}승 ${rating.rankedLosses}패 ${rating.rankedDraws}무\n일반 ${rating.casualWins}승 ${rating.casualLosses}패 ${rating.casualDraws}무`, compact ? 20 : 17, '#c4cfdd', 'center').setOrigin(0.5));
      this.content.add(addText(this, 305, 325, `보유 ${overview.eligibility.ownedCharacterCount}명 · 편성 ${overview.eligibility.deckSize}/10`, compact ? 19 : 16, '#aebccd', 'center').setOrigin(0.5));
      this.content.add(addButton(this, 305, 405, 330, compact ? 84 : 62, '1v1 일반전', () => this.startQueue('pvp_casual_1v1'), overview.eligibility.chapter1Complete ? 0x5f7897 : 0x464d57));
      this.content.add(addButton(this, 305, 485, 330, compact ? 84 : 62, '1v1 랭킹전', () => this.startQueue('pvp_ranked_1v1'), overview.eligibility.eligible ? 0x85634f : 0x464d57));
      this.content.add(addText(this, 305, 545, '2v2 일반·친선은 대전 허브에서 선택할 수 있습니다.', compact ? 17 : 14, '#8995a6', 'center').setOrigin(0.5));
    } else {
      this.content.add(addText(this, 305, 330, '온라인 계정 기록을 불러오면\n일반전과 랭킹전을 선택할 수 있습니다.', compact ? 22 : 18, '#aeb8c6', 'center').setOrigin(0.5));
    }

    this.content.add(this.add.rectangle(905, 330, 590, 405, 0x272936, 0.98).setStrokeStyle(3, 0x77678c, 1));
    this.content.add(addText(this, 905, 145, '시즌 순위표', compact ? 27 : 23, '#eadcff', 'center').setOrigin(0.5));
    if (this.leaderboard.length === 0) {
      this.content.add(addText(this, 905, 330, '배치 완료 랭커가 아직 없습니다.', compact ? 22 : 18, '#9fa9b8', 'center').setOrigin(0.5));
    } else {
      this.leaderboard.slice(0, 8).forEach((entry, index) => {
        const y = 195 + index * 43;
        this.content!.add(addText(this, 650, y, `#${entry.rank}`, compact ? 18 : 15, index < 3 ? '#f0d67d' : '#9eabba'));
        this.content!.add(addText(this, 725, y, entry.displayName, compact ? 18 : 15, '#ffffff'));
        this.content!.add(addText(this, 1135, y, `${tierName(entry.displayedTier)} · ${entry.mmr} 평점`, compact ? 18 : 15, '#cdb9e8', 'right').setOrigin(1, 0));
      });
    }
  }

  private startQueue(modeId: 'pvp_casual_1v1' | 'pvp_ranked_1v1'): void {
    const overview = this.overview;
    if (!overview) return;
    if (!overview.eligibility.chapter1Complete) {
      this.status?.setText('메인 1장을 완료해야 PvP에 참가할 수 있습니다.').setColor('#ffd493');
      return;
    }
    if (modeId === 'pvp_ranked_1v1' && !overview.eligibility.eligible) {
      this.status?.setText(`랭킹전 참가 조건 미충족 · ${overview.eligibility.failure ?? '편성을 확인하세요.'}`).setColor('#ffd493');
      return;
    }
    this.scene.start('pvp-matchmaking', { modeId });
  }
}

export class PvpMatchmakingScene extends Phaser.Scene {
  private modeId: 'pvp_casual_1v1' | 'pvp_ranked_1v1' = 'pvp_casual_1v1';
  private state: PvpMatchmakingState = { state: 'IDLE' };
  private status?: Phaser.GameObjects.Text;
  private content?: Phaser.GameObjects.Container;
  private pollEvent: Phaser.Time.TimerEvent | undefined;
  private pending = false;

  constructor() { super('pvp-matchmaking'); }

  init(data: { modeId?: 'pvp_casual_1v1' | 'pvp_ranked_1v1' } = {}): void {
    this.modeId = data.modeId ?? 'pvp_casual_1v1';
    this.state = { state: 'IDLE' };
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 34, modeName(this.modeId), compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 86, '같은 규칙의 상대와 연결한 뒤 결과를 안전하게 기록합니다.', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1165, 62, 170, compact ? 78 : 50, '취소·돌아가기', () => { void this.cancelAndLeave(); }, 0x7a5e61);
    this.status = addText(this, INTERNAL_WIDTH / 2, 600, '대기열 상태 확인 중…', compact ? 22 : 18, '#a9b5c5', 'center').setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.pollEvent?.destroy());
    this.render();
    void this.restoreOrJoin();
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const ranked = this.modeId === 'pvp_ranked_1v1';
    this.content.add(this.add.rectangle(INTERNAL_WIDTH / 2, 340, 760, 330, ranked ? 0x302a29 : 0x242c39, 0.98).setStrokeStyle(4, ranked ? 0x9a7656 : 0x6683a5, 1));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 235, ranked ? '1v1 랭킹전' : '1v1 일반전', compact ? 37 : 33, ranked ? '#f1d59c' : '#cfe6ff', 'center').setOrigin(0.5));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 295, '표준 Lv50 · +0 · 영구 전투보너스 0\n보유 캐릭터/해금 형태/장착 병기는 유지', compact ? 21 : 17, '#c7d0dc', 'center').setOrigin(0.5));
    const state = this.state.state;
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 405, state === 'IDLE' ? '대기열 준비' : state === 'QUEUED' ? '상대 검색 중…' : state === 'PAIRING' ? '대전 준비 중…' : '상대 발견', compact ? 27 : 23, state === 'MATCHED' ? '#8ee3aa' : '#f0d67d', 'center').setOrigin(0.5));
  }

  private async restoreOrJoin(): Promise<void> {
    try {
      const existing = await getPvpMatchmakingStatus();
      if (!this.scene.isActive()) return;
      if (existing.state === 'MATCHED') return this.enterMatch(existing);
      if (existing.state === 'QUEUED' || existing.state === 'PAIRING') {
        if (existing.modeId !== this.modeId) await leavePvpMatchmaking();
        else {
          this.state = existing;
          this.handleState();
          return;
        }
      }
      this.state = await joinPvpMatchmaking(this.modeId);
      if (this.scene.isActive()) this.handleState();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(pvpError(error)).setColor('#ff9a91');
    }
  }

  private handleState(): void {
    if (this.state.state === 'MATCHED') return this.enterMatch(this.state);
    if (this.state.state === 'QUEUED' || this.state.state === 'PAIRING') {
      this.status?.setText(this.state.state === 'QUEUED' ? '상대를 찾고 있습니다…' : '상대를 찾았습니다. 대전을 준비하는 중…').setColor('#ffd493');
      if (!this.pollEvent) this.pollEvent = this.time.addEvent({ delay: 1000, loop: true, callback: () => { void this.poll(); } });
    }
    this.render();
  }

  private async poll(): Promise<void> {
    if (this.pending || (this.state.state !== 'QUEUED' && this.state.state !== 'PAIRING')) return;
    this.pending = true;
    try {
      this.state = await getPvpMatchmakingStatus();
      if (this.scene.isActive()) this.handleState();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(pvpError(error)).setColor('#ff9a91');
    } finally { this.pending = false; }
  }

  private enterMatch(state: Extract<PvpMatchmakingState, { state: 'MATCHED' }>): void {
    this.pollEvent?.destroy();
    this.pollEvent = undefined;
    this.status?.setText('상대 확정 · 대전으로 이동합니다.').setColor('#8ee3aa');
    this.time.delayedCall(100, () => this.scene.start('pvp-match', { websocketPath: state.websocketPath, modeId: state.modeId }));
  }

  private async cancelAndLeave(): Promise<void> {
    if (this.state.state === 'QUEUED') await leavePvpMatchmaking().catch(() => undefined);
    if (this.scene.isActive()) this.scene.start('pvp-hub');
  }
}

export class PvpMatchScene extends Phaser.Scene {
  private websocketPath = '';
  private modeId = 'pvp_casual_1v1';
  private session: PvpSession | null = null;
  private snapshot: PvpBattleSnapshot | null = null;
  private battlefield?: Phaser.GameObjects.Container;
  private controls?: Phaser.GameObjects.Container;
  private resultLayer?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private connection?: Phaser.GameObjects.Text;
  private unsubscribeMessage: (() => void) | undefined;
  private unsubscribeConnection: (() => void) | undefined;
  private readySent = false;
  private finished = false;

  constructor() { super('pvp-match'); }

  init(data: { websocketPath?: string; modeId?: string } = {}): void {
    this.websocketPath = data.websocketPath ?? '';
    this.modeId = data.modeId ?? 'pvp_casual_1v1';
    this.readySent = false;
    this.finished = false;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 36, 22, `대전 · ${modeName(this.modeId)}`, compact ? 31 : 28, COLORS.cream);
    this.connection = addText(this, 1230, 28, '연결 중…', compact ? 18 : 15, '#a9b5c5', 'right').setOrigin(1, 0);
    this.status = addText(this, INTERNAL_WIDTH / 2, 505, '상대와 대전을 연결하는 중…', compact ? 18 : 15, '#a9b5c5', 'center').setOrigin(0.5);
    addButton(this, 1185, compact ? 78 : 75, 160, compact ? 78 : 46, '전투 나가기', () => this.leaveMatch(), 0x815b60);
    if (!this.websocketPath) {
      this.status.setText('대전 참가 정보를 찾지 못했습니다. 허브에서 다시 매칭해 주세요.').setColor('#ff9a91');
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
      const label = message.message ? pvpError(new Error(message.message)) : '대전 연결 중 오류가 발생했습니다. 다시 시도해 주세요.';
      this.status?.setText(label).setColor('#ff9a91');
      return;
    }
    if (message.type === 'WELCOME') {
      this.snapshot = message.battle;
      if (message.room.phase === 'LOBBY' && !this.readySent) {
        this.session.sendReady();
        this.readySent = true;
      }
      this.status?.setText('상대 접속 및 준비를 기다리는 중…').setColor('#ffd493');
      this.renderBattle();
      this.renderControls();
      return;
    }
    if (message.type === 'ROOM_STATE') {
      this.snapshot = message.battle;
      if (message.room.phase === 'BATTLE') {
        this.status?.setText('대전 진행 중').setColor('#8ee3aa');
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
    if (message.type === 'ACCOUNT_SETTLED') {
      this.status?.setText('대전 결과와 PvP 기록 저장 완료').setColor('#8ee3aa');
    } else if (message.type === 'ACCOUNT_SETTLEMENT_ERROR') {
      this.status?.setText('결과 저장이 지연되고 있습니다. 잠시 후 기록을 다시 확인해 주세요.').setColor('#ffd493');
    }
  }

  private renderBattle(): void {
    this.battlefield?.destroy(true);
    this.battlefield = this.add.container(0, 0);
    const snapshot = this.snapshot;
    const compact = isCompactMobileViewport();
    if (!snapshot) {
      this.battlefield.add(addText(this, INTERNAL_WIDTH / 2, 330, 'PvP 전투 상태 동기화 중…', compact ? 27 : 23, '#b6c0ce', 'center').setOrigin(0.5));
      return;
    }
    const aRatio = Math.max(0, snapshot.bases.aHp / Math.max(1, snapshot.bases.aMaxHp));
    const bRatio = Math.max(0, snapshot.bases.bHp / Math.max(1, snapshot.bases.bMaxHp));
    const mine = this.session?.seatId;
    const leftLabel = mine === 'A' ? '내 진영' : '상대 진영';
    const rightLabel = mine === 'B' ? '내 진영' : '상대 진영';
    this.battlefield.add(addText(this, 75, 98, `${leftLabel}  ${snapshot.bases.aHp}/${snapshot.bases.aMaxHp}`, compact ? 19 : 16, '#addbff'));
    this.battlefield.add(this.add.rectangle(75, 128, 430, 18, 0x1b2631).setOrigin(0, 0.5));
    this.battlefield.add(this.add.rectangle(75, 128, 430 * aRatio, 14, 0x6198c7).setOrigin(0, 0.5));
    this.battlefield.add(addText(this, 1205, 98, `${rightLabel}  ${snapshot.bases.bHp}/${snapshot.bases.bMaxHp}`, compact ? 19 : 16, '#ffb5af', 'right').setOrigin(1, 0));
    this.battlefield.add(this.add.rectangle(775, 128, 430, 18, 0x302022).setOrigin(0, 0.5));
    this.battlefield.add(this.add.rectangle(775 + 430 * (1 - bRatio), 128, 430 * bRatio, 14, 0xc46f70).setOrigin(0, 0.5));

    const left = 70;
    const right = 1210;
    const fieldY = 330;
    this.battlefield.add(this.add.rectangle(INTERNAL_WIDTH / 2, fieldY, right - left, 245, 0x181f29, 0.96).setStrokeStyle(2, 0x526072, 1));
    this.battlefield.add(this.add.rectangle(left + 20, fieldY, 34, 180, 0x557fa4, 1));
    this.battlefield.add(this.add.rectangle(right - 20, fieldY, 34, 180, 0x9f5c61, 1));
    snapshot.units.filter((unit) => unit.state !== 'DYING').forEach((unit, index) => {
      const x = left + 45 + (Math.max(0, Math.min(3000, unit.anchorX)) / 3000) * (right - left - 90);
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
    this.battlefield.add(addText(this, INTERNAL_WIDTH / 2, 463, `${min}:${sec}`, compact ? 19 : 16, secondsLeft <= 60 ? '#ffb58f' : '#9dacbe', 'center').setOrigin(0.5));
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
      const hotkey = index === 9 ? '0' : String(index + 1);
      const prefix = compact ? '' : `${hotkey} `;
      const cooldownLabel = cooldown > 0 ? `재사용 ${cooldownSeconds(cooldown)}초` : `${cost} 보급`;
      const label = `${prefix}${info?.displayName ?? slotId}\n${cooldownLabel}`;
      const button = addButton(this, x, y, 164, compact ? 72 : 60, label, () => this.session?.queueCommand({ type: 'SPAWN', slotId }), cooldown > 0 || side.supply < cost ? 0x48515e : 0x5f86aa);
      this.controls!.add(button);
      if (cooldown > 0) setButtonState(button, 'disabled', `재사용까지 ${cooldownSeconds(cooldown)}초 남았습니다.`);
      else if (side.supply < cost) setButtonState(button, 'disabled', `보급이 ${cost - side.supply} 부족합니다.`);
    });

    const upgrade = side.nextSupplyUpgradeCost === null ? '보급소 최대' : `보급소 강화\n${side.nextSupplyUpgradeCost} 보급`;
    const upgradeButton = addButton(this, 1035, 570, 220, compact ? 72 : 60, upgrade, () => this.session?.queueCommand({ type: 'UPGRADE_SUPPLY' }), side.nextSupplyUpgradeCost !== null && side.supply >= side.nextSupplyUpgradeCost ? 0x7a6e4f : 0x4d535d);
    this.controls.add(upgradeButton);
    if (side.nextSupplyUpgradeCost === null) setButtonState(upgradeButton, 'disabled', '보급소가 최대 단계입니다.');
    else if (side.supply < side.nextSupplyUpgradeCost) setButtonState(upgradeButton, 'disabled', `보급이 ${side.nextSupplyUpgradeCost - side.supply} 부족합니다.`);

    const weapon = side.baseWeaponId === 'base_weapon_aegis_emitter'
      ? '결계발진기'
      : side.baseWeaponId === 'base_weapon_supply_drop'
        ? '보급낙하기'
        : side.baseWeaponId === null
          ? '기지 병기 없음'
          : '전선포격기';
    const weaponReady = side.baseWeaponId !== null && side.baseWeaponCooldownFrames === 0;
    const weaponState = side.baseWeaponId === null
      ? '장착 없음'
      : side.baseWeaponCooldownFrames > 0
        ? `재사용 ${cooldownSeconds(side.baseWeaponCooldownFrames)}초`
        : '사용 가능';
    const weaponButton = addButton(this, 1035, 650, 220, compact ? 72 : 60, `${weapon}\n${weaponState}`, () => this.session?.queueCommand({ type: 'FIRE_BASE_WEAPON' }), weaponReady ? 0x8a665a : 0x4d535d);
    this.controls.add(weaponButton);
    if (side.baseWeaponId === null) setButtonState(weaponButton, 'disabled', '장착된 기지 병기가 없습니다.');
    else if (side.baseWeaponCooldownFrames > 0) setButtonState(weaponButton, 'disabled', `재사용까지 ${cooldownSeconds(side.baseWeaponCooldownFrames)}초 남았습니다.`);
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
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 260, draw ? '무승부' : won ? 'PvP 승리' : 'PvP 패배', compact ? 48 : 42, draw ? '#d8dde5' : won ? '#bdf1c7' : '#ffb0a9', 'center').setOrigin(0.5));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 330, `${modeName(this.modeId)} · ${resultReason(reason)}`, compact ? 21 : 18, '#c2ccd8', 'center').setOrigin(0.5));
    this.resultLayer.add(addButton(this, 505, 435, 220, compact ? 82 : 60, 'PvP 허브', () => { this.session?.close(); this.scene.start('pvp-hub'); }, 0x5f7897));
    this.resultLayer.add(addButton(this, 775, 435, 220, compact ? 82 : 60, '다시 매칭', () => { this.session?.close(); this.scene.start('pvp-matchmaking', { modeId: this.modeId }); }, 0x7c654f));
  }

  private showVoid(_reason: string): void {
    if (this.finished) return;
    this.finished = true;
    this.session?.stopInputPump();
    this.resultLayer = this.add.container(0, 0).setDepth(400);
    this.resultLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.84).setInteractive());
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 300, '경기 무효', 42, '#d4d9e1', 'center').setOrigin(0.5));
    this.resultLayer.add(addText(this, INTERNAL_WIDTH / 2, 355, '대전 상태를 확정할 수 없어 이번 경기는 기록되지 않습니다.', 18, '#aeb8c6', 'center').setOrigin(0.5));
    this.resultLayer.add(addButton(this, INTERNAL_WIDTH / 2, 445, 240, 62, 'PvP 허브', () => { this.session?.close(); this.scene.start('pvp-hub'); }, 0x5f7897));
  }

  private leaveMatch(): void {
    if (!this.session) {
      this.scene.start('pvp-hub');
      return;
    }
    if (!this.finished && typeof window !== 'undefined') {
      const okay = window.confirm('전투 중 나가면 20초 재접속 유예 후 패배 처리될 수 있습니다. 나갈까요?');
      if (!okay) return;
    }
    this.session.close();
    this.scene.start('pvp-hub');
  }
}
