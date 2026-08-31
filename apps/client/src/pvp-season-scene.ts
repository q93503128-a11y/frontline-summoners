import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
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
    addText(this, 48, 34, 'PvP 시즌 기록', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 86, '현재 순위 · 티어 분포 · 최근 랭킹전 · 종료 시즌 명예', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1165, 62, 170, compact ? 78 : 50, 'PvP 허브', () => this.scene.start('pvp-hub'), 0x586275);
    this.status = addText(this, INTERNAL_WIDTH / 2, 687, '시즌 기록을 불러오는 중…', compact ? 18 : 15, '#a9b5c5', 'center').setOrigin(0.5);
    this.render();
    void this.load();
  }

  private async load(): Promise<void> {
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
    this.status?.setText(`${seasonId} 명예 보상을 확인하는 중…`).setColor('#ffd493');
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
      if (this.scene.isActive()) this.render();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(error instanceof Error ? error.message : '시즌 명예 보상을 받지 못했습니다.').setColor('#ff9a91');
    } finally { this.claiming = false; }
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
    this.content.add(this.add.rectangle(270, 285, 440, 335, 0x242c39, 0.98).setStrokeStyle(3, 0x657c98, 1));
    this.content.add(addText(this, 270, 140, overview.seasonId.toUpperCase(), compact ? 27 : 24, '#f0d67d', 'center').setOrigin(0.5));
    const rankText = rating.placementComplete && overview.globalRank !== null ? `전체 #${overview.globalRank}` : `배치 ${rating.placementMatches}/5`;
    this.content.add(addText(this, 270, 195, `${tierName(rating.displayedTier)} · ${rating.mmr} MMR`, compact ? 28 : 25, '#fff4cf', 'center').setOrigin(0.5));
    this.content.add(addText(this, 270, 240, rankText, compact ? 23 : 20, '#cfe6ff', 'center').setOrigin(0.5));
    this.content.add(addText(this, 270, 290, `${rating.rankedWins}승 ${rating.rankedLosses}패 ${rating.rankedDraws}무\n최고 ${rating.bestMmr} MMR`, compact ? 20 : 17, '#c4cfdd', 'center').setOrigin(0.5));
    this.content.add(addText(this, 270, 365, `참가 ${overview.ratedPlayerCount}명 · 배치 완료 ${overview.placementPlayerCount}명`, compact ? 18 : 15, '#9fabb9', 'center').setOrigin(0.5));
    this.content.add(addText(this, 270, 420, `${phaseName(overview.phase)} 운영 중\n정규 시즌 목표 ${overview.activeWeeksTarget}주 + 정산 ${overview.settlementDaysTarget}일`, compact ? 17 : 14, '#8f9baa', 'center').setOrigin(0.5));

    this.content.add(this.add.rectangle(770, 285, 500, 335, 0x272936, 0.98).setStrokeStyle(3, 0x77678c, 1));
    this.content.add(addText(this, 770, 140, '배치 완료 티어 분포', compact ? 26 : 23, '#eadcff', 'center').setOrigin(0.5));
    const tierOrder = ['FRONTLINE_APEX','GRANDMASTER','MASTER','DIAMOND','PLATINUM','GOLD','SILVER','BRONZE'];
    const byTier = new Map(overview.tierPopulation.map((entry) => [entry.tierId, entry.players] as const));
    tierOrder.forEach((tier, index) => {
      const y = 183 + index * 34;
      this.content!.add(addText(this, 565, y, tierName(tier), compact ? 16 : 14, '#c7d0dc'));
      this.content!.add(addText(this, 975, y, `${byTier.get(tier as never) ?? 0}명`, compact ? 16 : 14, '#f0d67d', 'right').setOrigin(1, 0));
    });

    this.content.add(this.add.rectangle(1090, 285, 270, 335, 0x222a34, 0.98).setStrokeStyle(3, 0x5f6d7e, 1));
    this.content.add(addText(this, 1090, 140, '최근 랭킹전', compact ? 25 : 22, '#dbe8ff', 'center').setOrigin(0.5));
    if (overview.recentRankedMatches.length === 0) {
      this.content.add(addText(this, 1090, 285, '완료한 랭킹전이\n아직 없습니다.', compact ? 20 : 17, '#929eae', 'center').setOrigin(0.5));
    } else {
      overview.recentRankedMatches.slice(0, 7).forEach((match, index) => {
        const y = 185 + index * 42;
        const resultColor = match.result === 'WIN' ? '#8ee3aa' : match.result === 'LOSS' ? '#ff9a91' : '#c9d0da';
        this.content!.add(addText(this, 980, y, resultName(match.result), compact ? 16 : 14, resultColor));
        this.content!.add(addText(this, 1020, y, match.opponentDisplayName.slice(0, 11), compact ? 15 : 13, '#d9e0e8'));
        this.content!.add(addText(this, 1205, y, deltaText(match.mmrDelta), compact ? 15 : 13, match.mmrDelta !== null && match.mmrDelta > 0 ? '#8ee3aa' : match.mmrDelta !== null && match.mmrDelta < 0 ? '#ff9a91' : '#aab4c1', 'right').setOrigin(1, 0));
      });
    }

    this.content.add(addText(this, INTERNAL_WIDTH / 2, 495, '티어 최초 도달 보상은 계정당 1회 · 시즌 명예는 수령 후 프로필에서 실제 장착 가능', compact ? 17 : 14, '#9aa6b4', 'center').setOrigin(0.5));

    this.content.add(this.add.rectangle(INTERNAL_WIDTH / 2, 585, 1140, 125, 0x202833, 0.98).setStrokeStyle(2, 0x687687, 1));
    const latest = overview.recentSeasonHistory[0];
    if (!latest) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 585, '아직 정산 완료된 시즌 기록이 없습니다.', compact ? 20 : 17, '#929eae', 'center').setOrigin(0.5));
      return;
    }
    const finalRank = latest.finalRank === null ? '미배치' : `#${latest.finalRank}`;
    this.content.add(addText(this, 105, 548, `종료 시즌 · ${latest.seasonId}`, compact ? 18 : 15, '#f0d67d'));
    this.content.add(addText(this, 105, 585, `${tierName(latest.finalTier)} ${latest.finalMmr} MMR · ${finalRank} · ${latest.rankedWins}승 ${latest.rankedLosses}패 ${latest.rankedDraws}무`, compact ? 18 : 15, '#d2dae5'));
    const honorNames = latest.honors.map((honor) => honor.displayName);
    const shown = honorNames.slice(0, 3).join(' · ');
    const extra = honorNames.length > 3 ? ` 외 ${honorNames.length - 3}개` : '';
    this.content.add(addText(this, 105, 620, honorNames.length > 0 ? `명예: ${shown}${extra}` : '획득 가능한 시즌 명예 없음', compact ? 16 : 14, honorNames.length > 0 ? '#cfe6ff' : '#8793a2'));
    if (latest.honorClaimed && latest.honors.length > 0) {
      // Replay is intentionally useful: it repairs a profile grant if an older/partial claim row exists.
      this.content.add(addButton(this, 1090, 588, 185, compact ? 72 : 54, this.claiming ? '확인 중…' : '장식 확인', () => { void this.claim(latest.seasonId); }, this.claiming ? 0x4c535d : 0x58736d));
    } else if (latest.honors.length > 0) {
      this.content.add(addButton(this, 1090, 588, 185, compact ? 72 : 54, this.claiming ? '확인 중…' : '명예 수령', () => { void this.claim(latest.seasonId); }, this.claiming ? 0x4c535d : 0x6d7894));
    } else {
      this.content.add(addText(this, 1170, 585, '정산 완료', compact ? 18 : 15, '#8f9baa', 'right').setOrigin(1, 0));
    }
  }
}
