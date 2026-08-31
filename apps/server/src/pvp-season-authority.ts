import {
  PVP_PLACEMENT_MATCH_COUNT,
  PVP_SEASON_ACTIVE_WEEKS,
  PVP_SEASON_SETTLEMENT_DAYS,
  type PvpTierId,
} from '@frontline/sim/pvp-content';
import {
  PVP_CURRENT_SEASON_ID,
  getPvpRatingView,
  type PvpRatingView,
} from './pvp-authority.ts';

export interface PvpSeasonTierPopulation {
  readonly tierId: PvpTierId;
  readonly players: number;
}

export interface PvpSeasonRecentMatch {
  readonly matchId: string;
  readonly completedAtMs: number;
  readonly opponentUserId: string;
  readonly opponentDisplayName: string;
  readonly result: 'WIN' | 'LOSS' | 'DRAW';
  readonly mmrBefore: number | null;
  readonly mmrAfter: number | null;
  readonly mmrDelta: number | null;
}

export interface PvpSeasonOverview {
  readonly seasonId: string;
  readonly phase: 'PRESEASON';
  readonly activeWeeksTarget: number;
  readonly settlementDaysTarget: number;
  readonly rating: PvpRatingView;
  readonly globalRank: number | null;
  readonly ratedPlayerCount: number;
  readonly placementPlayerCount: number;
  readonly tierPopulation: readonly PvpSeasonTierPopulation[];
  readonly recentRankedMatches: readonly PvpSeasonRecentMatch[];
}

type PopulationRow = { displayed_tier: PvpTierId; players: number };
type CountRow = { total: number; placed: number };
type RankRow = { rank: number };
type RecentRow = {
  match_id: string;
  result: 'A' | 'B' | 'DRAW';
  completed_at: number;
  my_team: 'A' | 'B';
  mmr_before: number | null;
  mmr_after: number | null;
  opponent_user_id: string;
  opponent_display_name: string | null;
};

async function getExactGlobalRank(db: D1Database, accountId: string): Promise<number | null> {
  const row = await db.prepare(
    `WITH placed AS (
       SELECT user_id,
              ROW_NUMBER() OVER (ORDER BY mmr DESC, ranked_wins DESC, updated_at ASC, user_id ASC) AS rank
       FROM pvp_ratings
       WHERE season_id = ?1 AND placement_matches >= ?2
     )
     SELECT rank FROM placed WHERE user_id = ?3`,
  ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT, accountId).first<RankRow>();
  return row?.rank ?? null;
}

async function getPopulation(db: D1Database): Promise<{ total: number; placed: number; tiers: readonly PvpSeasonTierPopulation[] }> {
  const [count, tiers] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN placement_matches >= ?2 THEN 1 ELSE 0 END) AS placed
       FROM pvp_ratings WHERE season_id = ?1`,
    ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT).first<CountRow>(),
    db.prepare(
      `SELECT displayed_tier, COUNT(*) AS players
       FROM pvp_ratings
       WHERE season_id = ?1 AND placement_matches >= ?2
       GROUP BY displayed_tier`,
    ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT).all<PopulationRow>(),
  ]);
  return {
    total: count?.total ?? 0,
    placed: count?.placed ?? 0,
    tiers: tiers.results.map((row) => ({ tierId: row.displayed_tier, players: row.players })),
  };
}

async function getRecentRankedMatches(
  db: D1Database,
  accountId: string,
  limit = 12,
): Promise<readonly PvpSeasonRecentMatch[]> {
  const safeLimit = Math.max(1, Math.min(30, Math.trunc(limit)));
  const rows = await db.prepare(
    `SELECT m.match_id, m.result, m.completed_at,
            me.team_id AS my_team, me.mmr_before, me.mmr_after,
            opponent.user_id AS opponent_user_id,
            profile.display_name AS opponent_display_name
     FROM pvp_matches m
     JOIN pvp_match_participants me
       ON me.match_id = m.match_id AND me.user_id = ?1
     JOIN pvp_match_participants opponent
       ON opponent.match_id = m.match_id AND opponent.user_id <> ?1
     LEFT JOIN social_profiles profile ON profile.user_id = opponent.user_id
     WHERE m.mode_id = 'pvp_ranked_1v1'
       AND m.season_id = ?2
       AND m.state = 'COMPLETED'
     ORDER BY m.completed_at DESC, m.match_id DESC
     LIMIT ?3`,
  ).bind(accountId, PVP_CURRENT_SEASON_ID, safeLimit).all<RecentRow>();
  return rows.results.map((row) => {
    const result = row.result === 'DRAW' ? 'DRAW' : row.result === row.my_team ? 'WIN' : 'LOSS';
    const mmrDelta = row.mmr_before === null || row.mmr_after === null ? null : row.mmr_after - row.mmr_before;
    return {
      matchId: row.match_id,
      completedAtMs: row.completed_at * 1000,
      opponentUserId: row.opponent_user_id,
      opponentDisplayName: row.opponent_display_name ?? '알 수 없는 지휘관',
      result,
      mmrBefore: row.mmr_before,
      mmrAfter: row.mmr_after,
      mmrDelta,
    };
  });
}

export async function getPvpSeasonOverview(
  db: D1Database,
  accountId: string,
  nowMs = Date.now(),
): Promise<PvpSeasonOverview> {
  const [rating, rank, population, recentRankedMatches] = await Promise.all([
    getPvpRatingView(db, accountId, nowMs),
    getExactGlobalRank(db, accountId),
    getPopulation(db),
    getRecentRankedMatches(db, accountId),
  ]);
  return {
    seasonId: PVP_CURRENT_SEASON_ID,
    phase: 'PRESEASON',
    activeWeeksTarget: PVP_SEASON_ACTIVE_WEEKS,
    settlementDaysTarget: PVP_SEASON_SETTLEMENT_DAYS,
    rating,
    globalRank: rating.placementComplete ? rank : null,
    ratedPlayerCount: population.total,
    placementPlayerCount: population.placed,
    tierPopulation: population.tiers,
    recentRankedMatches,
  };
}
