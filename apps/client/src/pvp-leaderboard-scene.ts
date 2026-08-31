import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';
import {
  getPvpLeaderboardView,
  type PvpLeaderboardEntryClient,
  type PvpLeaderboardScope,
  type PvpLeaderboardViewClient,
} from './pvp-leaderboard-network.ts';

const PAGE_SIZE = 10;

function tierName(id: string): string {
  const names: Readonly<Record<string, string>> = {
    BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘',
    DIAMOND: '다이아', MASTER: '마스터', GRANDMASTER: '그랜드마스터', FRONTLINE_APEX: '전선 최상위',
  };
  return names[id] ?? id;
}

function scopeTitle(scope: PvpLeaderboardScope): string {
  if (scope === 'TOP') return '전체 Top 100';
  if (scope === 'AROUND_ME') return '내 순위 주변 ±5';
  return '친구 랭킹';
}

export class PvpLeaderboardScene extends Phaser.Scene {
  private scope: PvpLeaderboardScope = 'TOP';
  private view: PvpLeaderboardViewClient | null = null;
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private page = 0;
  private loading = false;

  constructor() { super('pvp-leaderboard'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 32, '랭킹 순위표', compact ? 44 : 42, COLORS.cream);
    addText(this, 50, 84, '랭킹전 배치 완료 지휘관 · 덱 상세 정보는 공개하지 않습니다.', compact ? 18 : 15, COLORS.muted);
    addButton(this, 1170, 58, 180, compact ? 76 : 50, 'PvP 허브', () => this.scene.start('pvp-hub'), 0x586275);

    addButton(this, 210, 130, 220, compact ? 70 : 50, '전체 Top', () => void this.changeScope('TOP'), 0x657c98);
    addButton(this, 470, 130, 220, compact ? 70 : 50, '내 주변', () => void this.changeScope('AROUND_ME'), 0x6f6a91);
    addButton(this, 730, 130, 220, compact ? 70 : 50, '친 구', () => void this.changeScope('FRIENDS'), 0x647f72);
    addButton(this, 1030, 130, 220, compact ? 70 : 50, '새로고침', () => void this.load(), 0x5c6c82);

    this.status = addText(this, INTERNAL_WIDTH / 2, 690, '순위표를 불러오는 중…', compact ? 18 : 15, '#a9b5c5', 'center').setOrigin(0.5);
    this.render();
    void this.load();
  }

  private async changeScope(scope: PvpLeaderboardScope): Promise<void> {
    if (this.scope === scope && this.view) return;
    this.scope = scope;
    this.page = 0;
    this.view = null;
    this.render();
    await this.load();
  }

  private async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.status?.setText(`${scopeTitle(this.scope)} 동기화 중…`).setColor('#a9b5c5');
    try {
      const view = await getPvpLeaderboardView(this.scope, {
        limit: this.scope === 'TOP' ? 100 : 250,
        radius: 5,
      });
      if (!this.scene.isActive() || view.scope !== this.scope) return;
      this.view = view;
      const self = view.selfRank === null ? '배치 미완료' : `내 순위 #${view.selfRank}`;
      this.status?.setText(`${view.seasonId} · ${self} · 배치 완료 ${view.totalPlayers}명`).setColor('#8ee3aa');
      const maxPage = Math.max(0, Math.ceil(view.entries.length / PAGE_SIZE) - 1);
      this.page = Math.min(this.page, maxPage);
      this.render();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(error instanceof Error ? error.message : '순위표를 불러오지 못했습니다.').setColor('#ff9a91');
    } finally {
      this.loading = false;
    }
  }

  private row(entry: PvpLeaderboardEntryClient, y: number, compact: boolean): void {
    if (!this.content) return;
    const background = entry.isSelf ? 0x354153 : (entry.rank % 2 === 0 ? 0x232b37 : 0x202732);
    const stroke = entry.isSelf ? 0xe0c879 : 0x354151;
    this.content.add(this.add.rectangle(INTERNAL_WIDTH / 2, y + 18, 1120, 43, background, 0.98).setStrokeStyle(entry.isSelf ? 2 : 1, stroke, 1));
    const main = entry.isSelf ? '#fff0b8' : '#d9e2ed';
    this.content.add(addText(this, 95, y, `#${entry.rank}`, compact ? 18 : 16, entry.rank <= 3 ? '#f0d67d' : main));
    this.content.add(addText(this, 210, y, `${entry.displayName}${entry.isSelf ? '  (나)' : ''}`.slice(0, 24), compact ? 18 : 16, main));
    this.content.add(addText(this, 650, y, tierName(entry.displayedTier), compact ? 17 : 15, '#cfe0f6'));
    this.content.add(addText(this, 900, y, `${entry.mmr} MMR`, compact ? 17 : 15, '#f2d998', 'right').setOrigin(1, 0));
    this.content.add(addText(this, 1170, y, `${entry.rankedWins}승`, compact ? 17 : 15, '#9fd7b2', 'right').setOrigin(1, 0));
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const view = this.view;

    this.content.add(this.add.rectangle(INTERNAL_WIDTH / 2, 420, 1160, 500, 0x1d2430, 0.98).setStrokeStyle(3, 0x59697d, 1));
    this.content.add(addText(this, 85, 185, scopeTitle(this.scope), compact ? 23 : 21, '#f4e5b9'));
    this.content.add(addText(this, 95, 225, '순위', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 210, 225, '지휘관', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 650, 225, '티어', compact ? 15 : 13, '#8593a4'));
    this.content.add(addText(this, 900, 225, 'MMR', compact ? 15 : 13, '#8593a4', 'right').setOrigin(1, 0));
    this.content.add(addText(this, 1170, 225, '시즌 승수', compact ? 15 : 13, '#8593a4', 'right').setOrigin(1, 0));

    if (!view) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 430, '서버 랭킹 동기화 중…', compact ? 25 : 21, '#aeb8c5', 'center').setOrigin(0.5));
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
    visible.forEach((entry, index) => this.row(entry, 260 + index * 43, compact));

    if (this.scope !== 'AROUND_ME' && pageCount > 1) {
      this.content.add(addButton(this, 420, 652, 150, compact ? 66 : 44, '이 전', () => {
        if (this.page <= 0) return;
        this.page -= 1;
        this.render();
      }, this.page <= 0 ? 0x434b56 : 0x596b82));
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 665, `${this.page + 1} / ${pageCount}`, compact ? 18 : 15, '#c4cfdd', 'center').setOrigin(0.5));
      this.content.add(addButton(this, 860, 652, 150, compact ? 66 : 44, '다 음', () => {
        if (this.page >= pageCount - 1) return;
        this.page += 1;
        this.render();
      }, this.page >= pageCount - 1 ? 0x434b56 : 0x596b82));
    }
  }
}
