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

/**
 * Presentation-only PvP command hub.
 * Matchmaking, rating, season and battle authority stay in their existing scenes/network modules.
 */
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
    addText(this, 48, 28, '대전 전선', compact ? 42 : 46, COLORS.cream);
    addText(this, 50, 80, '표준 전투 규칙으로 맞붙고, 일반전·랭킹전·친선전·팀전을 한 지휘판에서 선택한다.', compact ? 18 : 15, COLORS.muted);
    addButton(this, 1170, compact ? 61 : 56, 170, compact ? 82 : 50, '지휘소', () => this.scene.start('main-menu'), 0x59677f, { tone: 'quiet' });
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
    this.statusText?.setText('대전 기록과 전선 순위를 확인하는 중…').setColor('#a9b5c5');
    this.renderHub();
    try {
      const [overview, leaderboard] = await Promise.all([getPvpAccountOverview(), getPvpLeaderboard(8)]);
      if (!this.scene.isActive()) return;
      this.accountOverview = overview;
      this.leaderboardEntries = leaderboard;
      this.statusText?.setText(
        overview.eligibility.chapter1Complete
          ? '대전 참가 기록 확인 완료'
          : '메인 1장을 완료하면 대전 전선이 개방됩니다.',
      ).setColor(overview.eligibility.chapter1Complete ? '#8ee3aa' : '#ffd493');
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

    this.commandLayer.add(addCommandPanel(this, 318, 360, 542, 486, 0x6a7f96, 0x1c2531, 0.97));
    this.commandLayer.add(addSectionHeading(this, 70, 132, '내 대전 기록 · 출전 명령', 496, 0x6f879f));

    if (!online) {
      this.commandLayer.add(addStatusPill(this, 82, 174, '온라인 계정 필요', 'warning'));
      this.commandLayer.add(addText(this, 318, 250, '로그인하면 대전 기록과 참가 조건을 확인할 수 있습니다.', compact ? 21 : 17, '#c5ceda', 'center').setOrigin(0.5).setWordWrapWidth(430));
      const accountButton = addButton(this, 318, 352, 330, compact ? 82 : 62, '계정 연결', () => this.scene.start('account'), 0x8d7358, { tone: 'primary' });
      this.commandLayer.add(accountButton);
      this.addModeButtons(false, false, '온라인 로그인 후 사용할 수 있습니다.');
    } else if (this.isLoading) {
      this.commandLayer.add(addStatusPill(this, 82, 174, '전선 기록 확인 중', 'neutral'));
      const loading = addButton(this, 318, 300, 330, compact ? 82 : 62, '대전 기록 불러오기', () => undefined, 0x68778d, {
        tone: 'secondary',
        state: 'loading',
        reason: '계정 대전 기록을 확인하고 있습니다.',
      });
      this.commandLayer.add(loading);
      this.addModeButtons(false, false, '대전 기록 확인이 끝난 뒤 사용할 수 있습니다.');
    } else if (this.loadFailed || !overview) {
      this.commandLayer.add(addStatusPill(this, 82, 174, '기록 확인 실패', 'danger'));
      this.commandLayer.add(addText(this, 318, 252, '대전 기록을 읽지 못했습니다. 네트워크 상태를 확인한 뒤 다시 불러오세요.', compact ? 20 : 16, '#e2c4c1', 'center').setOrigin(0.5).setWordWrapWidth(430));
      this.commandLayer.add(addButton(this, 318, 350, 330, compact ? 82 : 62, '다시 불러오기', () => { void this.refreshHub(); }, 0x8b6664, { tone: 'primary' }));
      this.addModeButtons(false, false, '대전 기록을 다시 불러온 뒤 사용할 수 있습니다.');
    } else {
      const unlocked = overview.eligibility.chapter1Complete;
      const ranked = unlocked && overview.eligibility.eligible;
      const rating = overview.rating;
      this.commandLayer.add(addStatusPill(this, 82, 174, unlocked ? '대전 전선 개방' : '메인 1장 필요', unlocked ? 'online' : 'warning'));

      const ratingLabel = rating.placementComplete
        ? `${tierName(rating.displayedTier)} · 평점 ${rating.mmr}`
        : `배치전 ${rating.placementMatches}/5`;
      this.commandLayer.add(addText(this, 318, 220, ratingLabel, compact ? 27 : 23, '#f1d88a', 'center').setOrigin(0.5));
      this.commandLayer.add(addText(
        this,
        318,
        263,
        `랭킹 ${rating.rankedWins}승 ${rating.rankedLosses}패 ${rating.rankedDraws}무 · 일반 ${rating.casualWins}승 ${rating.casualLosses}패 ${rating.casualDraws}무`,
        compact ? 17 : 14,
        '#c4cfdd',
        'center',
      ).setOrigin(0.5).setWordWrapWidth(455));
      this.commandLayer.add(addText(this, 318, 300, `보유 동료 ${overview.eligibility.ownedCharacterCount}명 · 대전 편성 ${overview.eligibility.deckSize}/10`, compact ? 17 : 14, '#aab8c9', 'center').setOrigin(0.5));

      this.addModeButtons(unlocked, ranked, unlocked ? '랭킹전 참가 조건을 충족해야 합니다. 편성과 보유 동료를 확인하세요.' : '메인 1장을 완료하면 사용할 수 있습니다.');
    }

    this.renderLeaderboard();
  }

  private addModeButtons(casualEnabled: boolean, rankedEnabled: boolean, lockedReason: string): void {
    const compact = isCompactMobileViewport();
    const y = 374;
    const h = compact ? 76 : 56;
    const casual = addButton(this, 194, y, 210, h, '1v1 일반전', () => this.scene.start('pvp-matchmaking', { modeId: 'pvp_casual_1v1' }), 0x607f9e, { tone: 'primary' });
    const ranked = addButton(this, 442, y, 210, h, '1v1 랭킹전', () => this.scene.start('pvp-matchmaking', { modeId: 'pvp_ranked_1v1' }), 0x956f55, { tone: 'primary' });
    this.commandLayer!.add([casual, ranked]);
    if (!casualEnabled) setButtonState(casual, 'locked', lockedReason);
    if (!rankedEnabled) setButtonState(ranked, 'locked', lockedReason);

    this.commandLayer!.add(addSectionHeading(this, 82, 430, '친선 · 팀전', 472, 0x7b7299));
    const friendly = addButton(this, 152, 482, 150, compact ? 72 : 50, '1v1 친선', () => this.scene.start('pvp-friendly-lobby'), 0x75628e, { tone: 'quiet' });
    const team = addButton(this, 318, 482, 150, compact ? 72 : 50, '2v2 일반', () => this.scene.start('pvp-2v2-matchmaking'), 0x607f9e, { tone: 'secondary' });
    const teamFriendly = addButton(this, 484, 482, 150, compact ? 72 : 50, '2v2 친선', () => this.scene.start('pvp-friendly-2v2-lobby'), 0x70668f, { tone: 'quiet' });
    this.commandLayer!.add([friendly, team, teamFriendly]);
    if (!casualEnabled) {
      setButtonState(friendly, 'locked', lockedReason);
      setButtonState(team, 'locked', lockedReason);
      setButtonState(teamFriendly, 'locked', lockedReason);
    }

    this.commandLayer!.add(addText(this, 318, 540, '일반전·친선전은 평점 변동 없음 · 랭킹전만 시즌 평점 반영', compact ? 15 : 12, '#9ca9b8', 'center').setOrigin(0.5).setWordWrapWidth(455));
  }

  private renderLeaderboard(): void {
    const compact = isCompactMobileViewport();
    this.commandLayer!.add(addCommandPanel(this, 930, 360, 590, 486, 0x7c6d91, 0x242532, 0.97));
    this.commandLayer!.add(addSectionHeading(this, 662, 132, '전선 순위 · 시즌 기록', 536, 0x806f95));

    if (this.isLoading) {
      this.commandLayer!.add(addText(this, 930, 300, '순위 기록 확인 중…', compact ? 22 : 18, '#b5aebf', 'center').setOrigin(0.5));
    } else if (this.leaderboardEntries.length === 0) {
      this.commandLayer!.add(addText(this, 930, 292, '아직 표시할 배치 완료 기록이 없습니다.', compact ? 22 : 18, '#aeb4bf', 'center').setOrigin(0.5));
    } else {
      this.leaderboardEntries.slice(0, 7).forEach((entry, index) => {
        const y = 188 + index * 47;
        const top = index < 3;
        const rail = this.add.rectangle(930, y + 16, 520, 1, 0x625d6c, 0.32);
        this.commandLayer!.add(rail);
        this.commandLayer!.add(addText(this, 682, y, `#${entry.rank}`, compact ? 18 : 15, top ? '#f1d88a' : '#9ba8b9'));
        this.commandLayer!.add(addText(this, 748, y, entry.displayName, compact ? 18 : 15, '#ffffff'));
        this.commandLayer!.add(addText(this, 1178, y, `${tierName(entry.displayedTier)} · 평점 ${entry.mmr}`, compact ? 17 : 14, '#cdbbe5', 'right').setOrigin(1, 0));
      });
    }

    this.commandLayer!.add(addSectionHeading(this, 674, 524, '기록 열람', 510, 0x786b8c));
    const season = addButton(this, 825, 570, 220, compact ? 72 : 50, '시즌 · 전적', () => this.scene.start('pvp-season'), 0x6a5f83, { tone: 'quiet' });
    const leaderboard = addButton(this, 1070, 570, 220, compact ? 72 : 50, '전체 순위표', () => this.scene.start('pvp-leaderboard'), 0x657f9e, { tone: 'quiet' });
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
