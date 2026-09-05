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
    BRONZE: '브론즈', SILVER: '실버', GOLD: '골드', PLATINUM: '플래티넘',
    DIAMOND: '다이아', MASTER: '마스터', GRANDMASTER: '그랜드마스터', FRONTLINE_APEX: '전선 최상위',
  };
  return names[id] ?? id;
}
function resultName(result: 'WIN' | 'LOSS' | 'DRAW'): string { return result === 'WIN' ? '승' : result === 'LOSS' ? '패' : '무'; }
function deltaText(delta: number | null): string { return delta === null ? '-' : delta > 0 ? `+${delta}` : String(delta); }
function phaseName(phase: PvpSeasonOverview['phase']): string { return phase === 'PRESEASON' ? '프리시즌' : '정규 시즌'; }

export class PvpSeasonScene extends Phaser.Scene {
  private overview: PvpSeasonOverview | null = null;
  private content?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private claiming = false;

  constructor() { super('pvp-season'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 32, 'PvP 시즌 기록', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 84, '현재 전선 · 배치 완료 티어 분포 · 최근 랭킹전 · 종료 시즌 명예', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1165, 60, 170, compact ? 78 : 50, 'PvP 허브', () => this.scene.start('pvp-hub'), 0x586275, { tone: 'quiet' });
    this.status = addText(this, INTERNAL_WIDTH / 2, 690, '시즌 기록을 불러오는 중…', compact ? 18 : 15, '#a9b5c5', 'center').setOrigin(0.5);
    this.render();
    void this.loadSeasonOverview();
  }

  private async loadSeasonOverview(): Promise<void> {
    try {
      const overview = await getPvpSeasonOverview();
      if (!this.scene.isActive()) return;
      this.overview = overview;
      this.status?.setText('서버 시즌 기록 동기화 완료').setColor('#8ee3aa');
      this.render();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(error instanceof Error ? error.message : '시즌 기록을 불러오지 못했습니다.').setColor('#ff9a91');
    }
  }

  private async claim(seasonId: string): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    this.status?.setText('시즌 명예 보상을 확인하는 중…').setColor('#ffd493');
    this.render();
    try {
      const result = await claimPvpSeasonHonors(seasonId);
      if (!this.scene.isActive()) return;
      const newCount = result.newlyGrantedCosmeticIds.length;
      if (newCount > 0) {
        this.status?.setText(`시즌 명예 ${result.honors.length}개 · 프로필 장식 ${newCount}개 수령 완료`).setColor('#8ee3aa');
      } else if (result.cosmeticIds.length > 0) {
        this.status?.setText(`시즌 명예 확인 완료 · 프로필 장식 ${result.cosmeticIds.length}개 보유 중`).setColor('#8ee3aa');
      } else {
        this.status?.setText('시즌 정산 확인 완료').setColor('#8ee3aa');
      }
      this.overview = await getPvpSeasonOverview();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(error instanceof Error ? error.message : '시즌 명예 보상을 받지 못했습니다.').setColor('#ff9a91');
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
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 350, '시즌 데이터 동기화 중…', compact ? 28 : 24, '#b9c3d0', 'center').setOrigin(0.5));
      return;
    }

    const rating = overview.rating;
    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 344, 1160, 390, 0x6f7484, 0x1b222c, 0.92));
    this.content.add(addSectionHeading(this, 82, 156, '현재 전선', 310, 0x657c98));
    this.content.add(addSectionHeading(this, 455, 156, '배치 완료 티어 분포', 370, 0x77678c));
    this.content.add(addSectionHeading(this, 884, 156, '최근 랭킹전', 300, 0x5f6d7e));

    const separators = this.add.graphics();
    separators.lineStyle(2, 0x657080, 0.28);
    separators.lineBetween(425, 178, 425, 511);
    separators.lineBetween(856, 178, 856, 511);
    this.content.add(separators);

    const phase = phaseName(overview.phase);
    this.content.add(addStatusPill(this, 86, 194, phase, overview.phase === 'ACTIVE' ? 'online' : 'neutral'));
    const rankText = rating.placementComplete && overview.globalRank !== null ? `전체 #${overview.globalRank}` : `배치 ${rating.placementMatches}/5`;
    this.content.add(addText(this, 88, 238, tierName(rating.displayedTier), compact ? 30 : 27, '#fff4cf'));
    this.content.add(addText(this, 88, 279, `${rating.mmr} MMR · ${rankText}`, compact ? 22 : 19, '#cfe6ff'));
    this.content.add(addText(this, 88, 326, `${rating.rankedWins}승  ${rating.rankedLosses}패  ${rating.rankedDraws}무`, compact ? 20 : 17, '#c4cfdd'));
    this.content.add(addText(this, 88, 364, `최고 ${rating.bestMmr} MMR`, compact ? 18 : 15, '#f0d67d'));
    this.content.add(addText(this, 88, 409, `참가 ${overview.ratedPlayerCount}명\n배치 완료 ${overview.placementPlayerCount}명`, compact ? 18 : 15, '#9fabb9'));
    this.content.add(addText(this, 88, 470, `정규 시즌 목표 ${overview.activeWeeksTarget}주 · 정산 ${overview.settlementDaysTarget}일`, compact ? 16 : 13, '#8f9baa').setWordWrapWidth(300));

    const tierOrder: PvpSeasonOverview['tierPopulation'][number]['tierId'][] = ['FRONTLINE_APEX','GRANDMASTER','MASTER','DIAMOND','PLATINUM','GOLD','SILVER','BRONZE'];
    const byTier = new Map(overview.tierPopulation.map((entry) => [entry.tierId, entry.players] as const));
    const maxTierPopulation = Math.max(1, ...tierOrder.map((tier) => byTier.get(tier) ?? 0));
    tierOrder.forEach((tier, index) => {
      const y = 194 + index * 38;
      const players = byTier.get(tier) ?? 0;
      const barWidth = players <= 0 ? 0 : Math.max(5, Math.round(190 * players / maxTierPopulation));
      this.content!.add(addText(this, 462, y, tierName(tier), compact ? 16 : 14, '#c7d0dc'));
      this.content!.add(this.add.rectangle(648, y + 10, 194, 8, 0x171d26, 0.9).setOrigin(0, 0.5));
      if (barWidth > 0) this.content!.add(this.add.rectangle(648, y + 10, barWidth, 8, 0x806f95, 0.82).setOrigin(0, 0.5));
      this.content!.add(addText(this, 830, y, `${players}명`, compact ? 16 : 14, '#f0d67d', 'right').setOrigin(1, 0));
    });

    if (overview.recentRankedMatches.length === 0) {
      this.content.add(addText(this, 1045, 345, '완료한 랭킹전이\n아직 없습니다.', compact ? 20 : 17, '#929eae', 'center').setOrigin(0.5));
    } else {
      overview.recentRankedMatches.slice(0, 7).forEach((match, index) => {
        const y = 198 + index * 43;
        const resultColor = match.result === 'WIN' ? '#8ee3aa' : match.result === 'LOSS' ? '#ff9a91' : '#c9d0da';
        this.content!.add(addText(this, 895, y, resultName(match.result), compact ? 17 : 14, resultColor));
        this.content!.add(addText(this, 940, y, match.opponentDisplayName.slice(0, 12), compact ? 16 : 13, '#d9e0e8'));
        this.content!.add(addText(this, 1200, y, deltaText(match.mmrDelta), compact ? 16 : 13, match.mmrDelta !== null && match.mmrDelta > 0 ? '#8ee3aa' : match.mmrDelta !== null && match.mmrDelta < 0 ? '#ff9a91' : '#aab4c1', 'right').setOrigin(1, 0));
        if (index < Math.min(6, overview.recentRankedMatches.length - 1)) {
          this.content!.add(this.add.rectangle(1045, y + 29, 315, 1, 0x657080, 0.2));
        }
      });
    }

    this.content.add(addText(this, INTERNAL_WIDTH / 2, 526, '티어 최초 도달 보상은 계정당 1회 · 시즌 명예는 수령 후 프로필에서 실제 장착 가능', compact ? 17 : 14, '#9aa6b4', 'center').setOrigin(0.5));

    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 610, 1160, 108, 0x687687, 0x1c242d, 0.94));
    this.content.add(addSectionHeading(this, 82, 565, '종료 시즌 명예 보관대', 1085, 0x8b745c));
    const latest = overview.recentSeasonHistory[0];
    if (!latest) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 618, '아직 정산 완료된 시즌 기록이 없습니다.', compact ? 20 : 17, '#929eae', 'center').setOrigin(0.5));
      return;
    }

    const finalRank = latest.finalRank === null ? '미배치' : `#${latest.finalRank}`;
    this.content.add(addText(this, 96, 592, `직전 정산 · ${tierName(latest.finalTier)} ${latest.finalMmr} MMR · ${finalRank}`, compact ? 18 : 15, '#f0d67d'));
    this.content.add(addText(this, 96, 623, `${latest.rankedWins}승 ${latest.rankedLosses}패 ${latest.rankedDraws}무 · 최고 ${latest.bestMmr} MMR`, compact ? 17 : 14, '#d2dae5'));
    const honorNames = latest.honors.map((honor) => honor.displayName);
    const shown = honorNames.slice(0, 3).join(' · ');
    const extra = honorNames.length > 3 ? ` 외 ${honorNames.length - 3}개` : '';
    this.content.add(addText(this, 560, 607, honorNames.length > 0 ? `명예 · ${shown}${extra}` : '획득 가능한 시즌 명예 없음', compact ? 16 : 14, honorNames.length > 0 ? '#cfe6ff' : '#8793a2').setWordWrapWidth(360));

    if (latest.honors.length > 0) {
      const label = latest.honorClaimed ? '장식 확인' : '명예 수령';
      const claimButton = addButton(this, 1090, 613, 190, compact ? 72 : 54, label, () => { void this.claim(latest.seasonId); }, latest.honorClaimed ? 0x58736d : 0x6d7894, { tone: latest.honorClaimed ? 'quiet' : 'primary' });
      this.content.add(claimButton);
      if (this.claiming) setButtonState(claimButton, 'loading', '시즌 명예 정산과 프로필 장식을 확인하고 있습니다.');
    } else {
      this.content.add(addText(this, 1180, 606, '정산 완료', compact ? 18 : 15, '#8f9baa', 'right').setOrigin(1, 0));
    }
  }
}
