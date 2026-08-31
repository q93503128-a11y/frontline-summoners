import { PVP_PLACEMENT_MATCH_COUNT, type PvpTierId } from '@frontline/sim/pvp-content';
import { PVP_CURRENT_SEASON_ID } from './pvp-authority.ts';

export type PvpLeaderboardScope = 'TOP' | 'AROUND_ME' | 'FRIENDS';

export interface PvpLeaderboardViewEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly mmr: number;
  readonly displayedTier: PvpTierId;
  readonly rankedWins: number;
  readonly rank: number;
  readonly isSelf: boolean;
}

export interface PvpLeaderboardView {
  readonly seasonId: string;
  readonly scope: PvpLeaderboardScope;
  readonly selfRank: number | null;
  readonly totalPlayers: number;
  readonly entries: readonly PvpLeaderboardViewEntry[];
}

type RankedRow = {
  readonly user_id: string;
  readonly display_name: string | null;
  readonly mmr: number;
  readonly displayed_tier: PvpTierId;
  readonly ranked_wins: number;
  readonly rank: number;
};
type CountRow = { readonly total: number };
type RankOnlyRow = { readonly rank: number };

const RANKED_CTE = `WITH ranked AS (
  SELECT r.user_id,
         p.display_name,
         r.mmr,
         r.displayed_tier,
         r.ranked_wins,
         ROW_NUMBER() OVER (
           ORDER BY r.mmr DESC, r.ranked_wins DESC, r.updated_at ASC, r.user_id ASC
         ) AS rank
  FROM pvp_ratings r
  LEFT JOIN social_profiles p ON p.user_id = r.user_id
  WHERE r.season_id = ?1 AND r.placement_matches >= ?2
)`;

function normalizeLimit(value: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

function rowView(row: RankedRow, accountId: string): PvpLeaderboardViewEntry {
  return {
    userId: row.user_id,
    displayName: row.display_name ?? '알 수 없는 지휘관',
    mmr: row.mmr,
    displayedTier: row.displayed_tier,
    rankedWins: row.ranked_wins,
    rank: row.rank,
    isSelf: row.user_id === accountId,
  };
}

async function totalPlacedPlayers(db: D1Database): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) AS total FROM pvp_ratings
     WHERE season_id = ?1 AND placement_matches >= ?2`,
  ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT).first<CountRow>();
  return row?.total ?? 0;
}

async function exactSelfRank(db: D1Database, accountId: string): Promise<number | null> {
  const row = await db.prepare(
    `${RANKED_CTE}
     SELECT rank FROM ranked WHERE user_id = ?3`,
  ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT, accountId).first<RankOnlyRow>();
  return row?.rank ?? null;
}

async function topEntries(db: D1Database, accountId: string, limit: number): Promise<readonly PvpLeaderboardViewEntry[]> {
  const rows = await db.prepare(
    `${RANKED_CTE}
     SELECT user_id, display_name, mmr, displayed_tier, ranked_wins, rank
     FROM ranked ORDER BY rank ASC LIMIT ?3`,
  ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT, normalizeLimit(limit, 1000, 100)).all<RankedRow>();
  return rows.results.map((row) => rowView(row, accountId));
}

async function aroundEntries(db: D1Database, accountId: string, radius: number): Promise<readonly PvpLeaderboardViewEntry[]> {
  const selfRank = await exactSelfRank(db, accountId);
  if (selfRank === null) return [];
  const safeRadius = Math.max(1, Math.min(10, Math.trunc(radius)));
  const minRank = Math.max(1, selfRank - safeRadius);
  const maxRank = selfRank + safeRadius;
  const rows = await db.prepare(
    `${RANKED_CTE}
     SELECT user_id, display_name, mmr, displayed_tier, ranked_wins, rank
     FROM ranked WHERE rank BETWEEN ?3 AND ?4 ORDER BY rank ASC`,
  ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT, minRank, maxRank).all<RankedRow>();
  return rows.results.map((row) => rowView(row, accountId));
}

async function friendEntries(db: D1Database, accountId: string, limit: number): Promise<readonly PvpLeaderboardViewEntry[]> {
  const safeLimit = normalizeLimit(limit, 250, 100);
  const rows = await db.prepare(
    `${RANKED_CTE}, friend_ids AS (
       SELECT ?3 AS user_id
       UNION
       SELECT CASE WHEN user_low = ?3 THEN user_high ELSE user_low END AS user_id
       FROM social_friendships
       WHERE user_low = ?3 OR user_high = ?3
     )
     SELECT ranked.user_id, ranked.display_name, ranked.mmr, ranked.displayed_tier,
            ranked.ranked_wins, ranked.rank
     FROM ranked
     JOIN friend_ids ON friend_ids.user_id = ranked.user_id
     ORDER BY ranked.rank ASC
     LIMIT ?4`,
  ).bind(PVP_CURRENT_SEASON_ID, PVP_PLACEMENT_MATCH_COUNT, accountId, safeLimit).all<RankedRow>();
  return rows.results.map((row) => rowView(row, accountId));
}

export async function getPvpLeaderboardView(
  db: D1Database,
  accountId: string,
  scope: PvpLeaderboardScope,
  options: { readonly limit?: number; readonly radius?: number } = {},
): Promise<PvpLeaderboardView> {
  const [totalPlayers, selfRank] = await Promise.all([
    totalPlacedPlayers(db),
    exactSelfRank(db, accountId),
  ]);
  const entries = scope === 'TOP'
    ? await topEntries(db, accountId, options.limit ?? 100)
    : scope === 'AROUND_ME'
      ? await aroundEntries(db, accountId, options.radius ?? 5)
      : await friendEntries(db, accountId, options.limit ?? 100);
  return { seasonId: PVP_CURRENT_SEASON_ID, scope, selfRank, totalPlayers, entries };
}

export const __pvpLeaderboardAuthorityTestOnly = {
  normalizeLimit,
  rowView,
  rankedCte: RANKED_CTE,
};
