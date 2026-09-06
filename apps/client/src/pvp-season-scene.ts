import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
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
import {
  claimPvpSeasonHonors,
  getPvpSeasonOverview,
  type PvpSeasonOverview,
} from './pvp-season-network.ts';

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

function resultName(result: 'WIN' | 'LOSS' | 'DRAW'): string {
  return result === 'WIN' ? '승' : result === 'LOSS' ? '패' : '무';
}

function deltaText(delta: number | null): string {
  return delta === null ? '-' : delta > 0 ? `+${delta}` : String(delta);
}

function phaseName(phase: PvpSeasonOverview['phase']): string {
  return phase === 'PRESEASON' ? '프리시즌' : '정규 시즌';
}

export class PvpSeasonScene extends Phaser.Scene {
  private overview: PvpSeasonOverview | null = null;
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private claiming = false;
  private loading = false;
  private loadFailed = false;

  constructor() { super('pvp-season'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 28, '시즌 전황', compact ? 40 : 42, COLORS.cream);
    addText(this, 50, 77, '현재 위치 · 최근 랭킹전 · 시즌 분포 · 지난 시즌 명예', compact ? 17 : 14, COLORS.muted);
    addButton(this, 1165, compact ? 60 : 56, 170, compact ? 80 : 50, '경쟁 전선', () => this.scene.start('pvp-hub'), 0x586275, { tone: 'quiet' });
    this.status = addText(this, INTERNAL_WIDTH / 2, 690, '시즌 기록을 불러오는 중…', compact ? 18 : 14, '#a9b5c5', 'center').setOrigin(0.5).setWordWrapWidth(1080);
    this.render();
    void this.loadSeasonOverview();
  }

  private async loadSeasonOverview(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.loadFailed = false;
    this.status?.setText('시즌 전황을 동기화하는 중…').setColor('#a9b5c5');
    this.render();
    try {
      const overview = await getPvpSeasonOverview();
      if (!this.scene.isActive()) return;
      this.overview = overview;
      this.status?.setText('시즌 전황 동기화 완료').setColor(COLORS.green);
    } catch {
      if (!this.scene.isActive()) return;
      this.overview = null;
      this.loadFailed = true;
      this.status?.setText('시즌 기록을 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.').setColor(COLORS.red);
    } finally {
      if (!this.scene.isActive()) return;
      this.loading = false;
      this.render();
    }
  }

  private async claim(seasonId: string): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    this.status?.setText('지난 시즌 명예를 확인하는 중…').setColor(COLORS.warning);
    this.render();
    try {
      const result = await claimPvpSeasonHonors(seasonId);
      if (!this.scene.isActive()) return;
      const newCount = result.newlyGrantedCosmeticIds.length;
      if (newCount > 0) {
        this.status?.setText(`시즌 명예 ${result.honors.length}개 · 프로필 장식 ${newCount}개 수령 완료`).setColor(COLORS.green);
      } else if (result.cosmeticIds.length > 0) {
        this.status?.setText(`시즌 명예 확인 완료 · 프로필 장식 ${result.cosmeticIds.length}개 보유`).setColor(COLORS.green);
      } else {
        this.status?.setText('지난 시즌 정산 확인 완료').setColor(COLORS.green);
      }
      this.overview = await getPvpSeasonOverview();
    } catch {
      if (this.scene.isActive()) this.status?.setText('시즌 명예를 확인하지 못했습니다. 다시 시도해 주세요.').setColor(COLORS.red);
    } finally {
      this.claiming = false;
      if (this.scene.isActive()) this.render();
    }
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const overview = this.overview;

    if (!overview) {
      this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 354, 760, 270, this.loadFailed ? 0x8b6664 : 0x657184, 0x1a222d, 0.95));
      this.content.add(addStatusPill(this, 300, 260, this.loadFailed ? '동기화 실패' : '시즌 확인 중', this.loadFailed ? 'danger' : 'neutral'));
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 326, this.loadFailed ? '시즌 전황을 확인하지 못했습니다.' : '현재 시즌 기록을 불러오고 있습니다.', compact ? 25 : 21, this.loadFailed ? '#e3c1bf' : '#c6d0dc', 'center').setOrigin(0.5));
      const action = addButton(this, INTERNAL_WIDTH / 2, 408, 260, compact ? 82 : 56, this.loadFailed ? '다시 불러오기' : '기록 확인 중', () => { void this.loadSeasonOverview(); }, this.loadFailed ? 0x8b6664 : 0x657184, { tone: 'primary' });
      this.content.add(action);
      if (this.loading) setButtonState(action, 'loading', '시즌 기록을 동기화하고 있습니다.');
      return;
    }

    const rating = overview.rating;
    const placementComplete = rating.placementComplete;
    const globalRank = placementComplete && overview.globalRank !== null ? `전체 #${overview.globalRank}` : `배치 ${rating.placementMatches}/5`;

    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 350, 1160, 408, 0x667184, 0x18212b, 0.95));
    this.content.add(addSectionHeading(this, 78, 142, '내 시즌 위치', 322, 0x647e9e));
    this.content.add(addSectionHeading(this, 432, 142, '최근 랭킹전', 402, 0x7a6a88));
    this.content.add(addSectionHeading(this, 866, 142, '티어 분포', 334, 0x6f7582));

    const separators = this.add.graphics();
    separators.lineStyle(1, 0x5d6979, 0.34);
    separators.lineBetween(412, 170, 412, 514);
    separators.lineBetween(846, 170, 846, 514);
    this.content.add(separators);

    const phase = phaseName(overview.phase);
    this.content.add(addStatusPill(this, 88, 184, phase, overview.phase === 'ACTIVE' ? 'online' : 'neutral'));
    this.content.add(addText(this, 90, 229, placementComplete ? tierName(rating.displayedTier) : '배치 진행 중', compact ? 31 : 28, '#fff0bd'));
    this.content.add(addText(this, 90, 270, placementComplete ? `평점 ${rating.mmr}` : '평점은 배치 완료 후 공개', compact ? 22 : 18, '#cfe2f8'));
    this.content.add(addText(this, 90, 310, globalRank, compact ? 19 : 16, '#aab8c8'));
    this.content.add(addText(this, 90, 358, `${rating.rankedWins}승  ${rating.rankedLosses}패  ${rating.rankedDraws}무`, compact ? 20 : 17, '#dce4ed'));
    this.content.add(addText(this, 90, 395, placementComplete ? `최고 평점 ${rating.bestMmr}` : '배치 완료 전 최고 평점 비공개', compact ? 17 : 14, COLORS.gold));
    this.content.add(addText(this, 90, 444, `참가 ${overview.ratedPlayerCount}명 · 배치 완료 ${overview.placementPlayerCount}명`, compact ? 16 : 13, '#8f9cab').setWordWrapWidth(292));
    this.content.add(addText(this, 90, 478, `시즌 ${overview.activeWeeksTarget}주 · 정산 ${overview.settlementDaysTarget}일`, compact ? 15 : 12, '#748193'));

    if (overview.recentRankedMatches.length === 0) {
      this.content.add(addText(this, 640, 330, '아직 완료한 랭킹전이 없습니다.', compact ? 20 : 17, '#929eae', 'center').setOrigin(0.5));
    } else {
      overview.recentRankedMatches.slice(0, 7).forEach((match, index) => {
        const y = 190 + index * 44;
        const resultColor = match.result === 'WIN' ? COLORS.green : match.result === 'LOSS' ? COLORS.red : '#c9d0da';
        this.content!.add(addText(this, 448, y, resultName(match.result), compact ? 17 : 14, resultColor));
        this.content!.add(addText(this, 500, y, match.opponentDisplayName.slice(0, 16), compact ? 17 : 14, '#e4e9ef'));
        this.content!.add(addText(this, 812, y, deltaText(match.mmrDelta), compact ? 17 : 14, match.mmrDelta !== null && match.mmrDelta > 0 ? COLORS.green : match.mmrDelta !== null && match.mmrDelta < 0 ? COLORS.red : '#aab4c1', 'right').setOrigin(1, 0));
        if (index < Math.min(6, overview.recentRankedMatches.length - 1)) {
          this.content!.add(this.add.rectangle(632, y + 29, 358, 1, 0x5d6979, 0.2));
        }
      });
    }

    const tierOrder: PvpSeasonOverview['tierPopulation'][number]['tierId'][] = [
      'FRONTLINE_APEX', 'GRANDMASTER', 'MASTER', 'DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE',
    ];
    const byTier = new Map(overview.tierPopulation.map((entry) => [entry.tierId, entry.players] as const));
    const maxTierPopulation = Math.max(1, ...tierOrder.map((tier) => byTier.get(tier) ?? 0));
    tierOrder.forEach((tier, index) => {
      const y = 184 + index * 39;
      const players = byTier.get(tier) ?? 0;
      const barWidth = players <= 0 ? 0 : Math.max(4, Math.round(122 * players / maxTierPopulation));
      this.content!.add(addText(this, 878, y, tierName(tier), compact ? 15 : 13, '#c7d0dc'));
      this.content!.add(this.add.rectangle(1048, y + 9, 124, 7, 0x121820, 0.9).setOrigin(0, 0.5));
      if (barWidth > 0) this.content!.add(this.add.rectangle(1048, y + 9, barWidth, 7, 0x776b91, 0.82).setOrigin(0, 0.5));
      this.content!.add(addText(this, 1198, y, `${players}명`, compact ? 15 : 13, COLORS.gold, 'right').setOrigin(1, 0));
    });

    this.content.add(addText(this, INTERNAL_WIDTH / 2, 535, '랭킹전만 시즌 평점에 반영 · 티어 최초 도달 보상은 계정당 1회', compact ? 16 : 13, '#8f9baa', 'center').setOrigin(0.5));

    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 612, 1160, 102, 0x786d83, 0x1c232c, 0.95));
    this.content.add(addSectionHeading(this, 78, 566, '지난 시즌 명예', 1080, 0x8b745c));
    const latest = overview.recentSeasonHistory[0];
    if (!latest) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 616, '아직 정산 완료된 시즌이 없습니다.', compact ? 20 : 16, '#929eae', 'center').setOrigin(0.5));
      return;
    }

    const finalRank = latest.finalRank === null ? '미배치' : `#${latest.finalRank}`;
    this.content.add(addText(this, 94, 593, `${tierName(latest.finalTier)} · 평점 ${latest.finalMmr} · ${finalRank}`, compact ? 18 : 15, '#f0d67d'));
    this.content.add(addText(this, 94, 621, `${latest.rankedWins}승 ${latest.rankedLosses}패 ${latest.rankedDraws}무 · 최고 ${latest.bestMmr}`, compact ? 16 : 13, '#cbd4df'));

    const honorNames = latest.honors.map((honor) => honor.displayName);
    const shown = honorNames.slice(0, 3).join(' · ');
    const extra = honorNames.length > 3 ? ` 외 ${honorNames.length - 3}개` : '';
    this.content.add(addText(this, 520, 607, honorNames.length > 0 ? `${shown}${extra}` : '획득 가능한 시즌 명예 없음', compact ? 16 : 13, honorNames.length > 0 ? '#d8e6f7' : '#8793a2').setWordWrapWidth(430));

    if (latest.honors.length > 0) {
      const label = latest.honorClaimed ? '장식 확인' : '명예 수령';
      const claimButton = addButton(this, 1090, 612, 190, compact ? 72 : 52, label, () => { void this.claim(latest.seasonId); }, latest.honorClaimed ? 0x58736d : 0x6d7894, { tone: latest.honorClaimed ? 'quiet' : 'primary' });
      this.content.add(claimButton);
      if (this.claiming) setButtonState(claimButton, 'loading', '시즌 명예 정산과 프로필 장식을 확인하고 있습니다.');
    } else {
      this.content.add(addText(this, 1180, 607, '정산 완료', compact ? 17 : 14, '#8f9baa', 'right').setOrigin(1, 0));
    }
  }
}
