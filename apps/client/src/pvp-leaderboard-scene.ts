import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import {
  addButton,
  addCommandPanel,
  addSectionHeading,
  addText,
  COLORS,
  drawBackdrop,
  setButtonState,
} from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';
import {
  getPvpLeaderboardView,
  type PvpLeaderboardEntryClient,
  type PvpLeaderboardScope,
  type PvpLeaderboardViewClient,
} from './pvp-leaderboard-network.ts';

const PAGE_SIZE = 9;
const ROW_STEP = 39;

function tierName(id: string): string {
  const names: Readonly<Record<string, string>> = {
    BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘',
    DIAMOND: '다이아', MASTER: '마스터', GRANDMASTER: '그랜드마스터', FRONTLINE_APEX: '전선 최상위',
  };
  return names[id] ?? id;
}

function scopeTitle(scope: PvpLeaderboardScope): string {
  if (scope === 'TOP') return '전체 Top 1000';
  if (scope === 'AROUND_ME') return '내 순위 주변 ±5';
  return '친구 랭킹';
}

function rankAccent(rank: number): number {
  if (rank === 1) return 0xd8b65a;
  if (rank === 2) return 0x9eafc4;
  if (rank === 3) return 0xb77f5f;
  return 0x657184;
}

export class PvpLeaderboardScene extends Phaser.Scene {
  private scope: PvpLeaderboardScope = 'TOP';
  private view: PvpLeaderboardViewClient | null = null;
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private page = 0;
  private loading = false;
  private readonly scopeButtons: Partial<Record<PvpLeaderboardScope, Phaser.GameObjects.Container>> = {};
  private refreshButton: Phaser.GameObjects.Container | undefined;

  constructor() { super('pvp-leaderboard'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 30, '전선 명예 게시판', compact ? 44 : 42, COLORS.cream);
    addText(this, 50, 82, '배치를 마친 지휘관의 전과만 기록한다 · 편성 상세는 공개하지 않는다.', compact ? 18 : 15, COLORS.muted);
    addButton(this, 1170, 58, 180, compact ? 76 : 50, 'PvP 허브', () => this.scene.start('pvp-hub'), 0x586275, { tone: 'quiet' });

    this.scopeButtons.TOP = addButton(this, 190, 136, 215, compact ? 70 : 50, '전체 Top', () => void this.changeScope('TOP'), 0x657c98, { tone: 'secondary' });
    this.scopeButtons.AROUND_ME = addButton(this, 430, 136, 215, compact ? 70 : 50, '내 주변', () => void this.changeScope('AROUND_ME'), 0x6f6a91, { tone: 'secondary' });
    this.scopeButtons.FRIENDS = addButton(this, 670, 136, 215, compact ? 70 : 50, '친 구', () => void this.changeScope('FRIENDS'), 0x647f72, { tone: 'secondary' });
    this.refreshButton = addButton(this, 1060, 136, 220, compact ? 70 : 50, '기록 갱신', () => void this.loadLeaderboard(), 0x5c6c82, { tone: 'quiet' });

    this.status = addText(this, INTERNAL_WIDTH / 2, 688, '명예 기록을 불러오는 중…', compact ? 18 : 15, '#a9b5c5', 'center').setOrigin(0.5);
    this.updateCommandStates();
    this.render();
    void this.loadLeaderboard();
  }

  private updateCommandStates(): void {
    (['TOP', 'AROUND_ME', 'FRIENDS'] as const).forEach((scope) => {
      const button = this.scopeButtons[scope];
      if (!button) return;
      if (this.loading) {
        setButtonState(button, scope === this.scope ? 'loading' : 'disabled', '랭킹 기록 동기화가 끝난 뒤 범위를 바꿀 수 있습니다.');
      } else {
        setButtonState(button, scope === this.scope ? 'selected' : 'default');
      }
    });
    if (this.refreshButton) {
      setButtonState(this.refreshButton, this.loading ? 'loading' : 'default', this.loading ? '랭킹 기록을 동기화하고 있습니다.' : undefined);
    }
  }

  private async changeScope(scope: PvpLeaderboardScope): Promise<void> {
    if (this.loading) return;
    if (this.scope === scope && this.view) return;
    this.scope = scope;
    this.page = 0;
    this.view = null;
    this.updateCommandStates();
    this.render();
    await this.loadLeaderboard();
  }

  private async loadLeaderboard(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.updateCommandStates();
    this.status?.setText(`${scopeTitle(this.scope)} 동기화 중…`).setColor('#a9b5c5');
    try {
      const view = await getPvpLeaderboardView(this.scope, {
        limit: this.scope === 'TOP' ? 1000 : 250,
        radius: 5,
      });
      if (!this.scene.isActive() || view.scope !== this.scope) return;
      this.view = view;
      const self = view.selfRank === null ? '배치 미완료' : `내 순위 #${view.selfRank}`;
      this.status?.setText(`${self} · 배치 완료 지휘관 ${view.totalPlayers}명`).setColor('#8ee3aa');
      const maxPage = Math.max(0, Math.ceil(view.entries.length / PAGE_SIZE) - 1);
      this.page = Math.min(this.page, maxPage);
      this.render();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(error instanceof Error ? error.message : '순위표를 불러오지 못했습니다.').setColor('#ff9a91');
    } finally {
      this.loading = false;
      if (this.scene.isActive()) this.updateCommandStates();
    }
  }

  private row(entry: PvpLeaderboardEntryClient, y: number, compact: boolean): void {
    if (!this.content) return;
    const topThree = entry.rank <= 3;
    const accent = entry.isSelf ? 0xe0c879 : rankAccent(entry.rank);
    const main = entry.isSelf ? '#fff0b8' : topThree ? '#f5e5bd' : '#d9e2ed';

    if (entry.isSelf || topThree) {
      this.content.add(this.add.rectangle(650, y + 15, 1070, 34, entry.isSelf ? 0x303c4d : 0x2b2c30, entry.isSelf ? 0.94 : 0.72)
        .setStrokeStyle(entry.isSelf ? 2 : 1, accent, entry.isSelf ? 0.9 : 0.55));
    } else {
      this.content.add(this.add.rectangle(650, y + 32, 1070, 1, 0x5c6878, 0.2));
    }

    const nodeRadius = entry.rank === 1 ? 13 : entry.rank <= 3 ? 10 : entry.isSelf ? 9 : 6;
    this.content.add(this.add.circle(112, y + 15, nodeRadius, accent, entry.rank <= 3 || entry.isSelf ? 0.95 : 0.62)
      .setStrokeStyle(entry.isSelf ? 3 : 1, 0xf4e4ba, entry.isSelf ? 0.75 : 0.25));
    this.content.add(addText(this, 145, y + 1, `#${entry.rank}`, compact ? 18 : 15, entry.rank <= 3 ? '#f0d67d' : main));
    this.content.add(addText(this, 245, y + 1, `${entry.displayName}${entry.isSelf ? ' · 나' : ''}`.slice(0, 24), compact ? 18 : 15, main));
    this.content.add(addText(this, 690, y + 1, tierName(entry.displayedTier), compact ? 17 : 14, '#cfe0f6'));
    this.content.add(addText(this, 945, y + 1, `${entry.mmr} 평점`, compact ? 17 : 14, '#f2d998', 'right').setOrigin(1, 0));
    this.content.add(addText(this, 1180, y + 1, `${entry.rankedWins}승`, compact ? 17 : 14, '#9fd7b2', 'right').setOrigin(1, 0));
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const view = this.view;

    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 422, 1160, 474, 0x657184, 0x1b222c, 0.92));
    this.content.add(addSectionHeading(this, 82, 194, scopeTitle(this.scope), 1090, 0x7b6c57));

    const selfLabel = view?.selfRank === null || view?.selfRank === undefined ? '내 위치 · 배치 전' : `내 위치 · #${view.selfRank}`;
    this.content.add(addText(this, 1180, 183, selfLabel, compact ? 17 : 14, view?.selfRank ? '#f0d67d' : '#8f9baa', 'right').setOrigin(1, 0));

    this.content.add(addText(this, 145, 226, '순위', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 245, 226, '지휘관', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 690, 226, '티어', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 945, 226, '평점', compact ? 15 : 13, '#8593a4', 'right').setOrigin(1, 0));
    this.content.add(addText(this, 1180, 226, '시즌 승수', compact ? 15 : 13, '#8593a4', 'right').setOrigin(1, 0));

    const route = this.add.graphics();
    route.lineStyle(3, 0x657184, 0.34).lineBetween(112, 263, 112, 584);
    this.content.add(route);

    if (!view) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 430, '서버 명예 기록 동기화 중…', compact ? 25 : 21, '#aeb8c5', 'center').setOrigin(0.5));
      return;
    }

    if (view.entries.length === 0) {
      const text = this.scope === 'AROUND_ME'
        ? '배치 5경기를 완료하면 내 순위 주변을 볼 수 있습니다.'
        : this.scope === 'FRIENDS'
          ? '배치를 완료한 친구가 아직 없습니다.'
          : '배치를 완료한 랭킹 참가자가 아직 없습니다.';
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 430, text, compact ? 23 : 20, '#a1adba', 'center').setOrigin(0.5));
      return;
    }

    const pageCount = Math.max(1, Math.ceil(view.entries.length / PAGE_SIZE));
    const start = this.scope === 'AROUND_ME' ? 0 : this.page * PAGE_SIZE;
    const visible = this.scope === 'AROUND_ME' ? view.entries : view.entries.slice(start, start + PAGE_SIZE);
    visible.forEach((entry, index) => this.row(entry, 251 + index * ROW_STEP, compact));

    if (this.scope !== 'AROUND_ME' && pageCount > 1) {
      const previous = addButton(this, 430, 626, 170, compact ? 68 : 46, '◀ 이전 기록', () => {
        this.page = Math.max(0, this.page - 1);
        this.render();
      }, 0x596b82, { tone: 'quiet' });
      const next = addButton(this, 850, 626, 170, compact ? 68 : 46, '다음 기록 ▶', () => {
        this.page = Math.min(pageCount - 1, this.page + 1);
        this.render();
      }, 0x596b82, { tone: 'quiet' });
      this.content.add(previous);
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 626, `${this.page + 1} / ${pageCount}`, compact ? 18 : 15, '#c4cfdd', 'center').setOrigin(0.5));
      this.content.add(next);
      if (this.page <= 0) setButtonState(previous, 'disabled', '첫 번째 기록 묶음입니다.');
      if (this.page >= pageCount - 1) setButtonState(next, 'disabled', '마지막 기록 묶음입니다.');
    }
  }
}
