import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import {
  getPvpMatchmakingStatus,
  joinPvpMatchmaking,
  leavePvpMatchmaking,
  type PvpMatchmakingState,
} from './pvp-network.ts';
import {
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
} from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

type MatchMode = 'pvp_casual_1v1' | 'pvp_ranked_1v1';

function modeName(modeId: MatchMode): string {
  return modeId === 'pvp_ranked_1v1' ? '1v1 랭킹전' : '1v1 일반전';
}

function pvpError(error: unknown): string {
  const message = error instanceof Error ? error.message : '대전 요청 오류';
  if (message === 'pvp_chapter_1_required') return '메인 1장을 완료해야 대전에 참가할 수 있습니다.';
  if (message.startsWith('pvp_ranked_ineligible')) return '현재 편성으로는 랭킹전에 참가할 수 없습니다.';
  if (message.startsWith('pvp_deck_requires_')) return '대전에 필요한 편성 칸을 모두 채워 주세요.';
  if (message === 'pvp_match_initialization_failed') return '대전방을 만들지 못했습니다. 다시 시도해 주세요.';
  if (message === 'pvp_match_room_lost_requeue_required') return '이전 대전방이 만료되었습니다. 다시 매칭해 주세요.';
  if (message.startsWith('HTTP_')) return '대전 서버 응답을 확인하지 못했습니다.';
  return '대전 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
}

function stateLabel(state: PvpMatchmakingState['state']): { label: string; detail: string; kind: 'neutral' | 'warning' | 'online' } {
  if (state === 'MATCHED') return { label: '상대 확정', detail: '전투 연결 준비 완료', kind: 'online' };
  if (state === 'PAIRING') return { label: '대전 준비 중', detail: '상대를 찾았습니다. 전투방을 준비하고 있습니다.', kind: 'warning' };
  if (state === 'QUEUED') return { label: '상대 탐색 중', detail: '같은 규칙의 지휘관을 찾고 있습니다.', kind: 'warning' };
  return { label: '출전 준비', detail: '대기열 참가 상태를 확인하고 있습니다.', kind: 'neutral' };
}

export class PvpMatchmakingScene extends Phaser.Scene {
  private modeId: MatchMode = 'pvp_casual_1v1';
  private state: PvpMatchmakingState = { state: 'IDLE' };
  private status?: Phaser.GameObjects.Text;
  private content?: Phaser.GameObjects.Container;
  private pollEvent: Phaser.Time.TimerEvent | undefined;
  private pending = false;

  constructor() { super('pvp-matchmaking'); }

  init(data: { modeId?: MatchMode } = {}): void {
    this.modeId = data.modeId ?? 'pvp_casual_1v1';
    this.state = { state: 'IDLE' };
    this.pending = false;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    const ranked = this.modeId === 'pvp_ranked_1v1';
    addText(this, 48, 28, ranked ? '랭킹전 출전' : '일반전 출전', compact ? 40 : 42, COLORS.cream);
    addText(this, 50, 77, ranked ? '시즌 평점이 걸린 1v1 대전입니다.' : '평점 변동 없이 1v1 규칙으로 겨룹니다.', compact ? 17 : 14, COLORS.muted);
    addButton(this, 1160, compact ? 60 : 56, 180, compact ? 80 : 50, '검색 취소', () => { void this.cancelAndLeave(); }, 0x7a5e61, { tone: 'danger' });
    this.status = addText(this, INTERNAL_WIDTH / 2, 688, '대기열 상태 확인 중…', compact ? 18 : 14, '#a9b5c5', 'center').setOrigin(0.5).setWordWrapWidth(1080);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.pollEvent?.destroy());
    this.render();
    void this.restoreOrJoin();
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const ranked = this.modeId === 'pvp_ranked_1v1';
    const state = stateLabel(this.state.state);

    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 365, 930, 450, ranked ? 0x8a6f56 : 0x657f9e, 0x18212b, 0.96));
    this.content.add(addSectionHeading(this, 190, 150, modeName(this.modeId), 900, ranked ? 0x9a7656 : 0x6683a5));
    this.content.add(addStatusPill(this, 210, 192, ranked ? '시즌 평점 반영' : '평점 변동 없음', ranked ? 'warning' : 'neutral'));
    this.content.add(addStatusPill(this, 385, 192, state.label, state.kind));

    const route = this.add.graphics();
    route.lineStyle(4, ranked ? 0x795f4a : 0x536d88, 0.42).lineBetween(330, 315, 950, 315);
    const activeSearch = this.state.state === 'QUEUED' || this.state.state === 'PAIRING' || this.state.state === 'MATCHED';
    const activeOpponent = this.state.state === 'PAIRING' || this.state.state === 'MATCHED';
    const nodes = [
      { x: 330, label: '나', active: true },
      { x: 640, label: '매칭', active: activeSearch },
      { x: 950, label: '상대', active: activeOpponent },
    ];
    nodes.forEach((node, index) => {
      const color = node.active ? (index === 1 ? 0xd6b861 : 0x7eb1d0) : 0x46515f;
      route.fillStyle(color, node.active ? 0.95 : 0.66).fillCircle(node.x, 315, node.active ? 12 : 9);
      route.lineStyle(2, node.active ? 0xe8d7a5 : 0x65707e, 0.72).strokeCircle(node.x, 315, node.active ? 12 : 9);
      this.content!.add(addText(this, node.x, 342, node.label, compact ? 18 : 15, node.active ? '#e8edf4' : '#7f8996', 'center').setOrigin(0.5));
    });
    this.content.add(route);

    this.content.add(addText(this, INTERNAL_WIDTH / 2, 400, state.detail, compact ? 22 : 18, this.state.state === 'MATCHED' ? COLORS.green : '#e4cf95', 'center').setOrigin(0.5).setWordWrapWidth(760));

    this.content.add(addSectionHeading(this, 230, 452, '대전 규칙', 820, 0x6c7582));
    this.content.add(addText(this, 260, 490, '표준 성장 Lv50 · +0 · 영구 전투 보너스 미적용', compact ? 18 : 15, '#c7d2df'));
    this.content.add(addText(this, 260, 525, '보유 동료 · 해금 형태 · 장착 거점 병기는 유지', compact ? 18 : 15, '#c7d2df'));
    this.content.add(addText(this, 260, 560, ranked ? '승패 결과는 현재 시즌 평점과 티어에 반영됩니다.' : '승패 결과는 기록되지만 시즌 평점과 티어는 변하지 않습니다.', compact ? 17 : 14, COLORS.muted));
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
      if (this.scene.isActive()) this.status?.setText(pvpError(error)).setColor(COLORS.red);
    }
  }

  private handleState(): void {
    if (this.state.state === 'MATCHED') return this.enterMatch(this.state);
    if (this.state.state === 'QUEUED' || this.state.state === 'PAIRING') {
      this.status?.setText(this.state.state === 'QUEUED' ? '상대를 찾고 있습니다…' : '상대 확정 중 · 전투방을 준비하고 있습니다…').setColor(COLORS.warning);
      if (!this.pollEvent) {
        this.pollEvent = this.time.addEvent({ delay: 1000, loop: true, callback: () => { void this.poll(); } });
      }
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
      if (this.scene.isActive()) this.status?.setText(pvpError(error)).setColor(COLORS.red);
    } finally {
      this.pending = false;
    }
  }

  private enterMatch(state: Extract<PvpMatchmakingState, { state: 'MATCHED' }>): void {
    this.pollEvent?.destroy();
    this.pollEvent = undefined;
    this.status?.setText('상대 확정 · 전투로 이동합니다.').setColor(COLORS.green);
    this.state = state;
    this.render();
    this.time.delayedCall(100, () => this.scene.start('pvp-match', { websocketPath: state.websocketPath, modeId: state.modeId }));
  }

  private async cancelAndLeave(): Promise<void> {
    if (this.state.state === 'QUEUED') await leavePvpMatchmaking().catch(() => undefined);
    if (this.scene.isActive()) this.scene.start('pvp-hub');
  }
}
