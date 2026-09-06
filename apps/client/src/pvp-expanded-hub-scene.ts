import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { getAccountClientState } from './account-network.ts';
import {
  getPvpAccountOverview,
  getPvpLeaderboard,
  type PvpAccountOverview,
  type PvpLeaderboardEntry,
} from './pvp-network.ts';
import { PvpHubScene as BasePvpHubScene } from './pvp-scenes.ts';
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
import { isCompactMobileViewport } from './viewport.ts';

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
  return names[id] ?? '미분류';
}

function hubError(error: unknown): string {
  const message = error instanceof Error ? error.message : '대전 기록을 불러오지 못했습니다.';
  const labels: Readonly<Record<string, string>> = {
    pvp_chapter_1_required: '메인 1장을 완료해야 대전에 참가할 수 있습니다.',
    pvp_ranked_ineligible: '현재 편성으로는 랭킹전에 참가할 수 없습니다.',
  };
  if (message.startsWith('pvp_ranked_ineligible')) return labels.pvp_ranked_ineligible!;
  if (message.startsWith('pvp_deck_requires_')) return '대전에 필요한 편성 칸을 모두 채워 주세요.';
  if (message.startsWith('HTTP_')) return '대전 서버 응답을 확인하지 못했습니다.';
  return labels[message] ?? '대전 기록을 불러오지 못했습니다. 다시 시도해 주세요.';
}

/** Matchmaking/rating authority remains in the existing network and battle scenes. */
export class PvpHubScene extends BasePvpHubScene {
  private commandLayer: Phaser.GameObjects.Container | undefined;
  private statusText: Phaser.GameObjects.Text | undefined;
  private accountOverview: PvpAccountOverview | null = null;
  private leaderboardEntries: readonly PvpLeaderboardEntry[] = [];
  private isLoading = false;
  private loadFailed = false;

  override create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 26, '경쟁 전선', compact ? 40 : 43, COLORS.cream);
    addText(this, 50, 76, '출전 모드를 고르고, 현재 시즌의 전적과 상위 전선을 확인합니다.', compact ? 17 : 14, COLORS.muted);
    addButton(this, 1170, compact ? 60 : 55, 170, compact ? 82 : 50, '지휘소', () => this.scene.start('main-menu'), 0x59677f, { tone: 'quiet' });
    this.statusText = addText(this, INTERNAL_WIDTH / 2, 687, '', compact ? 18 : 14, '#a9b5c5', 'center').setOrigin(0.5).setWordWrapWidth(1120);

    this.renderHub();
    void this.refreshHub();
  }

  private async refreshHub(): Promise<void> {
    if (this.isLoading) return;
    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      this.accountOverview = null;
      this.leaderboardEntries = [];
      this.loadFailed = false;
      this.statusText?.setText('대전은 온라인 로그인 계정에서 사용할 수 있습니다.').setColor('#ffd493');
      this.renderHub();
      return;
    }

    this.isLoading = true;
    this.loadFailed = false;
    this.statusText?.setText('대전 기록과 시즌 순위를 확인하는 중…').setColor('#a9b5c5');
    this.renderHub();
    try {
      const [overview, leaderboard] = await Promise.all([getPvpAccountOverview(), getPvpLeaderboard(8)]);
      if (!this.scene.isActive()) return;
      this.accountOverview = overview;
      this.leaderboardEntries = leaderboard;
      this.statusText?.setText(overview.eligibility.chapter1Complete ? '출전 준비 완료' : '메인 1장을 완료하면 경쟁 전선이 개방됩니다.')
        .setColor(overview.eligibility.chapter1Complete ? '#8ee3aa' : '#ffd493');
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.accountOverview = null;
      this.leaderboardEntries = [];
      this.loadFailed = true;
      this.statusText?.setText(hubError(error)).setColor('#ff9a91');
    } finally {
      if (!this.scene.isActive()) return;
      this.isLoading = false;
      this.renderHub();
    }
  }

  private renderHub(): void {
    this.commandLayer?.destroy(true);
    this.commandLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const online = getAccountClientState().kind === 'AUTHENTICATED_ONLINE';
    const overview = this.accountOverview;

    this.commandLayer.add(addCommandPanel(this, 318, 360, 542, 486, 0x6a7f96, 0x19222d, 0.95));
    this.commandLayer.add(addSectionHeading(this, 70, 132, '출전 준비', 496, 0x6f879f));

    if (!online) {
      this.commandLayer.add(addStatusPill(this, 82, 174, '온라인 계정 필요', 'warning'));
      this.commandLayer.add(addText(this, 318, 220, '로그인하면 참가 조건과 시즌 기록을 확인할 수 있습니다.', compact ? 20 : 16, '#c5ceda', 'center').setOrigin(0.5).setWordWrapWidth(430));
      this.commandLayer.add(addButton(this, 318, 282, 330, compact ? 82 : 58, '계정 연결', () => this.scene.start('account'), 0x8d7358, { tone: 'primary' }));
      this.addModeButtons(false, false, '온라인 로그인 후 사용할 수 있습니다.');
    } else if (this.isLoading) {
      this.commandLayer.add(addStatusPill(this, 82, 174, '전선 기록 확인 중', 'neutral'));
      this.commandLayer.add(addButton(this, 318, 272, 330, compact ? 82 : 58, '출전 정보 확인', () => undefined, 0x68778d, {
        tone: 'secondary', state: 'loading', reason: '계정 대전 기록을 확인하고 있습니다.',
      }));
      this.addModeButtons(false, false, '대전 기록 확인이 끝난 뒤 사용할 수 있습니다.');
    } else if (this.loadFailed || !overview) {
      this.commandLayer.add(addStatusPill(this, 82, 174, '기록 확인 실패', 'danger'));
      this.commandLayer.add(addText(this, 318, 220, '대전 기록을 읽지 못했습니다. 네트워크 상태를 확인해 주세요.', compact ? 19 : 15, '#e2c4c1', 'center').setOrigin(0.5).setWordWrapWidth(430));
      this.commandLayer.add(addButton(this, 318, 282, 330, compact ? 82 : 58, '다시 불러오기', () => { void this.refreshHub(); }, 0x8b6664, { tone: 'primary' }));
      this.addModeButtons(false, false, '대전 기록을 다시 불러온 뒤 사용할 수 있습니다.');
    } else {
      const unlocked = overview.eligibility.chapter1Complete;
      const ranked = unlocked && overview.eligibility.eligible;
      const rating = overview.rating;
      this.commandLayer.add(addStatusPill(this, 82, 174, unlocked ? '출전 가능' : '메인 1장 필요', unlocked ? 'online' : 'warning'));
      const ratingLabel = rating.placementComplete ? `${tierName(rating.displayedTier)} · ${rating.mmr}` : `배치전 ${rating.placementMatches}/5`;
      this.commandLayer.add(addText(this, 318, 205, ratingLabel, compact ? 28 : 24, '#f1d88a', 'center').setOrigin(0.5));
      this.commandLayer.add(addText(this, 318, 242, `랭킹 ${rating.rankedWins}승 ${rating.rankedLosses}패 ${rating.rankedDraws}무   /   일반 ${rating.casualWins}승 ${rating.casualLosses}패 ${rating.casualDraws}무`, compact ? 16 : 13, '#c4cfdd', 'center').setOrigin(0.5).setWordWrapWidth(455));
      this.commandLayer.add(addText(this, 318, 275, `대전 편성 ${overview.eligibility.deckSize}/10 · 보유 동료 ${overview.eligibility.ownedCharacterCount}명`, compact ? 16 : 13, '#9dabbc', 'center').setOrigin(0.5));
      this.addModeButtons(unlocked, ranked, unlocked ? '랭킹전 참가 조건을 충족해야 합니다. 편성과 보유 동료를 확인하세요.' : '메인 1장을 완료하면 사용할 수 있습니다.');
    }

    this.renderLeaderboard();
  }

  private addModeButtons(casualEnabled: boolean, rankedEnabled: boolean, lockedReason: string): void {
    const compact = isCompactMobileViewport();
    this.commandLayer!.add(addSectionHeading(this, 82, 318, '전투 개시', 472, 0x6f879f));
    const h = compact ? 76 : 58;
    const casual = addButton(this, 194, 365, 210, h, '1v1 일반', () => this.scene.start('pvp-matchmaking', { modeId: 'pvp_casual_1v1' }), 0x607f9e, { tone: 'secondary' });
    const ranked = addButton(this, 442, 365, 210, h, '1v1 랭킹', () => this.scene.start('pvp-matchmaking', { modeId: 'pvp_ranked_1v1' }), 0x956f55, { tone: 'primary' });
    this.commandLayer!.add([casual, ranked]);
    if (!casualEnabled) setButtonState(casual, 'locked', lockedReason);
    if (!rankedEnabled) setButtonState(ranked, 'locked', lockedReason);

    this.commandLayer!.add(addText(this, 194, 405, '평점 변동 없음', compact ? 14 : 11, '#8795a6', 'center').setOrigin(0.5));
    this.commandLayer!.add(addText(this, 442, 405, '시즌 평점 반영', compact ? 14 : 11, '#bda982', 'center').setOrigin(0.5));
    this.commandLayer!.add(addText(this, 82, 435, '연습 · 팀전', compact ? 15 : 12, '#8f9cab'));
    const friendly = addButton(this, 152, 472, 150, compact ? 68 : 46, '친선 1v1', () => this.scene.start('pvp-friendly-lobby'), 0x75628e, { tone: 'quiet' });
    const team = addButton(this, 318, 472, 150, compact ? 68 : 46, '일반 2v2', () => this.scene.start('pvp-2v2-matchmaking'), 0x607f9e, { tone: 'secondary' });
    const teamFriendly = addButton(this, 484, 472, 150, compact ? 68 : 46, '친선 2v2', () => this.scene.start('pvp-friendly-2v2-lobby'), 0x70668f, { tone: 'quiet' });
    this.commandLayer!.add([friendly, team, teamFriendly]);
    if (!casualEnabled) {
      setButtonState(friendly, 'locked', lockedReason);
      setButtonState(team, 'locked', lockedReason);
      setButtonState(teamFriendly, 'locked', lockedReason);
    }
    this.commandLayer!.add(addText(this, 318, 511, '랭킹전만 시즌 평점을 변경합니다.', compact ? 14 : 11, '#7f8d9d', 'center').setOrigin(0.5));
  }

  private renderLeaderboard(): void {
    const compact = isCompactMobileViewport();
    this.commandLayer!.add(addCommandPanel(this, 930, 360, 590, 486, 0x7c6d91, 0x20232f, 0.95));
    this.commandLayer!.add(addSectionHeading(this, 662, 132, '이번 시즌 · 상위 전선', 536, 0x806f95));

    if (this.isLoading) {
      this.commandLayer!.add(addText(this, 930, 300, '순위 기록 확인 중…', compact ? 22 : 18, '#b5aebf', 'center').setOrigin(0.5));
    } else if (this.leaderboardEntries.length === 0) {
      this.commandLayer!.add(addText(this, 930, 292, '아직 표시할 배치 완료 기록이 없습니다.', compact ? 22 : 18, '#aeb4bf', 'center').setOrigin(0.5));
    } else {
      const route = this.add.graphics();
      route.lineStyle(2, 0x6e6680, 0.28).lineBetween(704, 185, 704, 487);
      this.commandLayer!.add(route);
      this.leaderboardEntries.slice(0, 7).forEach((entry, index) => {
        const y = 184 + index * 46;
        const top = index < 3;
        const node = this.add.circle(704, y + 10, top ? 7 : 4, top ? 0xcaa85e : 0x6e7890, top ? 0.95 : 0.64);
        this.commandLayer!.add(node);
        this.commandLayer!.add(this.add.rectangle(948, y + 28, 486, 1, 0x625d6c, 0.22));
        this.commandLayer!.add(addText(this, 724, y, `#${entry.rank}`, compact ? 18 : 15, top ? '#f1d88a' : '#9ba8b9'));
        this.commandLayer!.add(addText(this, 792, y, entry.displayName.slice(0, 14), compact ? 18 : 15, '#ffffff'));
        this.commandLayer!.add(addText(this, 1178, y, `${tierName(entry.displayedTier)} · ${entry.mmr}`, compact ? 17 : 14, '#cdbbe5', 'right').setOrigin(1, 0));
      });
    }

    this.commandLayer!.add(addSectionHeading(this, 674, 524, '시즌 기록', 510, 0x786b8c));
    const season = addButton(this, 825, 570, 220, compact ? 72 : 50, '내 시즌 전적', () => this.scene.start('pvp-season'), 0x6a5f83, { tone: 'quiet' });
    const leaderboard = addButton(this, 1070, 570, 220, compact ? 72 : 50, '전체 순위', () => this.scene.start('pvp-leaderboard'), 0x657f9e, { tone: 'quiet' });
    this.commandLayer!.add([season, leaderboard]);
    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      setButtonState(season, 'locked', '온라인 로그인 후 시즌 기록을 볼 수 있습니다.');
      setButtonState(leaderboard, 'locked', '온라인 로그인 후 순위표를 볼 수 있습니다.');
    } else if (this.loadFailed) {
      setButtonState(season, 'disabled', '대전 기록을 다시 불러온 뒤 사용할 수 있습니다.');
      setButtonState(leaderboard, 'disabled', '대전 기록을 다시 불러온 뒤 사용할 수 있습니다.');
    }
  }
}
