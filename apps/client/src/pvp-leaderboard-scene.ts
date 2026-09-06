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
    BRONZE: '브론즈',
    SILVER: '실버',
    GOLD: '골드',
    PLATINUM: '플래티넘',
    DIAMOND: '다이아',
    MASTER: '마스터',
    GRANDMASTER: '그랜드마스터',
    FRONTLINE_APEX: '전선 최상위',
  };
  return names[id] ?? id;
}

function scopeTitle(scope: PvpLeaderboardScope): string {
  if (scope === 'TOP') return '전체 순위';
  if (scope === 'AROUND_ME') return '내 주변';
  return '친구 순위';
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
    addText(this, 48, 28, '전선 순위', compact ? 40 : 42, COLORS.cream);
    addText(this, 50, 77, '배치를 마친 지휘관의 시즌 위치만 표시합니다.', compact ? 17 : 14, COLORS.muted);
    addButton(this, 1165, compact ? 60 : 56, 170, compact ? 80 : 50, '경쟁 전선', () => this.scene.start('pvp-hub'), 0x586275, { tone: 'quiet' });

    const tabHeight = compact ? 68 : 46;
    this.scopeButtons.TOP = addButton(this, 165, 132, 190, tabHeight, '전체', () => void this.changeScope('TOP'), 0x657c98, { tone: 'quiet' });
    this.scopeButtons.AROUND_ME = addButton(this, 375, 132, 190, tabHeight, '내 주변', () => void this.changeScope('AROUND_ME'), 0x6f6a91, { tone: 'quiet' });
    this.scopeButtons.FRIENDS = addButton(this, 585, 132, 190, tabHeight, '친구', () => void this.changeScope('FRIENDS'), 0x647f72, { tone: 'quiet' });
    this.refreshButton = addButton(this, 1080, 132, 190, tabHeight, '새로고침', () => void this.loadLeaderboard(), 0x5c6c82, { tone: 'quiet' });

    this.status = addText(this, INTERNAL_WIDTH / 2, 690, '순위 기록을 불러오는 중…', compact ? 18 : 14, '#a9b5c5', 'center').setOrigin(0.5).setWordWrapWidth(1080);
    this.updateCommandStates();
    this.render();
    void this.loadLeaderboard();
  }

  private updateCommandStates(): void {
    (['TOP', 'AROUND_ME', 'FRIENDS'] as const).forEach((scope) => {
      const button = this.scopeButtons[scope];
      if (!button) return;
      if (this.loading) {
        setButtonState(button, scope === this.scope ? 'loading' : 'disabled', '순위 기록 동기화가 끝난 뒤 범위를 바꿀 수 있습니다.');
      } else {
        setButtonState(button, scope === this.scope ? 'selected' : 'default');
      }
    });
    if (this.refreshButton) {
      setButtonState(this.refreshButton, this.loading ? 'loading' : 'default', this.loading ? '순위 기록을 동기화하고 있습니다.' : undefined);
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
      this.status?.setText(`${self} · 배치 완료 ${view.totalPlayers}명`).setColor(COLORS.green);
      const maxPage = Math.max(0, Math.ceil(view.entries.length / PAGE_SIZE) - 1);
      this.page = Math.min(this.page, maxPage);
      this.render();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(error instanceof Error ? error.message : '순위표를 불러오지 못했습니다.').setColor(COLORS.red);
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
      this.content.add(this.add.rectangle(650, y + 15, 1070, 34, entry.isSelf ? 0x27394a : 0x2b2c30, entry.isSelf ? 0.88 : 0.58)
        .setStrokeStyle(entry.isSelf ? 2 : 1, accent, entry.isSelf ? 0.82 : 0.42));
    } else {
      this.content.add(this.add.rectangle(650, y + 32, 1070, 1, 0x5c6878, 0.18));
    }

    const nodeRadius = entry.rank === 1 ? 12 : entry.rank <= 3 ? 9 : entry.isSelf ? 9 : 5;
    this.content.add(this.add.circle(108, y + 15, nodeRadius, accent, entry.rank <= 3 || entry.isSelf ? 0.95 : 0.58));
    this.content.add(addText(this, 138, y + 1, `#${entry.rank}`, compact ? 18 : 15, entry.rank <= 3 ? '#f0d67d' : main));
    this.content.add(addText(this, 240, y + 1, `${entry.displayName}${entry.isSelf ? ' · 나' : ''}`.slice(0, 24), compact ? 18 : 15, main));
    this.content.add(addText(this, 720, y + 1, tierName(entry.displayedTier), compact ? 17 : 14, '#cfe0f6'));
    this.content.add(addText(this, 970, y + 1, `${entry.mmr}`, compact ? 17 : 14, '#f2d998', 'right').setOrigin(1, 0));
    this.content.add(addText(this, 1185, y + 1, `${entry.rankedWins}승`, compact ? 17 : 14, '#9fd7b2', 'right').setOrigin(1, 0));
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const view = this.view;

    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 424, 1160, 476, 0x657184, 0x18212b, 0.95));
    this.content.add(addSectionHeading(this, 80, 190, scopeTitle(this.scope), 1090, 0x7b6c57));

    const selfLabel = view?.selfRank === null || view?.selfRank === undefined ? '내 위치 · 배치 전' : `내 위치 · #${view.selfRank}`;
    this.content.add(addText(this, 1180, 181, selfLabel, compact ? 17 : 14, view?.selfRank ? COLORS.gold : '#8f9baa', 'right').setOrigin(1, 0));

    this.content.add(addText(this, 138, 224, '순위', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 240, 224, '지휘관', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 720, 224, '티어', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 970, 224, '평점', compact ? 15 : 13, '#8593a4', 'right').setOrigin(1, 0));
    this.content.add(addText(this, 1185, 224, '승수', compact ? 15 : 13, '#8593a4', 'right').setOrigin(1, 0));

    const route = this.add.graphics();
    route.lineStyle(2, 0x657184, 0.26).lineBetween(108, 260, 108, 586);
    this.content.add(route);

    if (!view) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 430, '순위 기록 동기화 중…', compact ? 24 : 20, '#aeb8c5', 'center').setOrigin(0.5));
      return;
    }

    if (view.entries.length === 0) {
      const empty = this.scope === 'AROUND_ME'
        ? '배치 5경기를 완료하면 내 주변 순위를 볼 수 있습니다.'
        : this.scope === 'FRIENDS'
          ? '배치를 완료한 친구가 아직 없습니다.'
          : '배치를 완료한 지휘관이 아직 없습니다.';
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 430, empty, compact ? 22 : 18, '#a1adba', 'center').setOrigin(0.5));
      return;
    }

    const pageCount = Math.max(1, Math.ceil(view.entries.length / PAGE_SIZE));
    const start = this.scope === 'AROUND_ME' ? 0 : this.page * PAGE_SIZE;
    const visible = this.scope === 'AROUND_ME' ? view.entries : view.entries.slice(start, start + PAGE_SIZE);
    visible.forEach((entry, index) => this.row(entry, 250 + index * ROW_STEP, compact));

    if (this.scope !== 'AROUND_ME' && pageCount > 1) {
      const previous = addButton(this, 430, 628, 170, compact ? 68 : 44, '◀ 이전', () => {
        this.page = Math.max(0, this.page - 1);
        this.render();
      }, 0x596b82, { tone: 'quiet' });
      const next = addButton(this, 850, 628, 170, compact ? 68 : 44, '다음 ▶', () => {
        this.page = Math.min(pageCount - 1, this.page + 1);
        this.render();
      }, 0x596b82, { tone: 'quiet' });
      this.content.add(previous);
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 628, `${this.page + 1} / ${pageCount}`, compact ? 18 : 15, '#c4cfdd', 'center').setOrigin(0.5));
      this.content.add(next);
      if (this.page <= 0) setButtonState(previous, 'disabled', '첫 번째 페이지입니다.');
      if (this.page >= pageCount - 1) setButtonState(next, 'disabled', '마지막 페이지입니다.');
    }
  }
}
