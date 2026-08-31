import {
  PVP_PLACEMENT_MATCH_COUNT,
  PVP_SEASON_ACTIVE_WEEKS,
  PVP_SEASON_SETTLEMENT_DAYS,
  PVP_TIERS,
  type PvpTierId,
} from '@frontline/sim/pvp-content';
import {
  PVP_CURRENT_SEASON_ID,
  getPvpRatingView,
  type PvpRatingView,
} from './pvp-authority.ts';

export type PvpSeasonPhase = 'PRESEASON' | 'ACTIVE';
export type PvpSeasonHonorId =
  | 'SEASON_GOLD_EMBLEM'
  | 'SEASON_PLATINUM_FRAME'
  | 'SEASON_MASTER_TITLE'
  | 'SEASON_TOP_1000_BANNER'
  | 'SEASON_TOP_100_EMBLEM'
  | 'SEASON_TOP_10_HONOR';

export interface PvpSeasonHonor {
  readonly id: PvpSeasonHonorId;
  readonly displayName: string;
  readonly kind: 'EMBLEM' | 'FRAME' | 'TITLE' | 'BANNER' | 'HONOR';
}

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

export interface PvpSeasonHistoryEntry {
  readonly seasonId: string;
  readonly closedAtMs: number;
  readonly finalMmr: number;
  readonly bestMmr: number;
  readonly finalTier: PvpTierId;
  readonly placementMatches: number;
  readonly rankedWins: number;
  readonly rankedLosses: number;
  readonly rankedDraws: number;
  readonly finalRank: number | null;
  readonly honors: readonly PvpSeasonHonor[];
  readonly honorClaimed: boolean;
  readonly honorClaimedAtMs: number | null;
}

export interface PvpSeasonOverview {
  readonly seasonId: string;
  readonly phase: PvpSeasonPhase;
  readonly activeWeeksTarget: number;
  readonly settlementDaysTarget: number;
  readonly rating: PvpRatingView;
  readonly globalRank: number | null;
  readonly ratedPlayerCount: number;
  readonly placementPlayerCount: number;
  readonly tierPopulation: readonly PvpSeasonTierPopulation[];
  readonly recentRankedMatches: readonly PvpSeasonRecentMatch[];
  readonly recentSeasonHistory: readonly PvpSeasonHistoryEntry[];
}

export interface PvpSeasonClosure {
  readonly seasonId: string;
  readonly nextSeasonId: string;
  readonly closedAtMs: number;
  readonly rolledAtMs: number | null;
  readonly playerCount: number;
  readonly placementPlayerCount: number;
}

export interface PvpSeasonHonorClaimResult {
  readonly seasonId: string;
  readonly replayed: boolean;
  readonly honors: readonly PvpSeasonHonor[];
  readonly claimedAtMs: number;
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
type ClosureRow = {
  season_id: string;
  next_season_id: string;
  closed_at: number;
  rolled_at: number | null;
  player_count: number;
  placement_player_count: number;
};
type SeasonResultRow = {
  season_id: string;
  closed_at: number;
  final_mmr: number;
  best_mmr: number;
  final_tier: PvpTierId;
  placement_matches: number;
  ranked_wins: number;
  ranked_losses: number;
  ranked_draws: number;
  final_rank: number | null;
  honor_claimed_at: number | null;
  honor_json: string | null;
};
type LiveActivityRow = { live_matches: number; live_queue: number };

const HONORS: Readonly<Record<PvpSeasonHonorId, PvpSeasonHonor>> = {
  SEASON_GOLD_EMBLEM: { id: 'SEASON_GOLD_EMBLEM', displayName: '시즌 참가 문장', kind: 'EMBLEM' },
  SEASON_PLATINUM_FRAME: { id: 'SEASON_PLATINUM_FRAME', displayName: '시즌 플래티넘 테두리', kind: 'FRAME' },
  SEASON_MASTER_TITLE: { id: 'SEASON_MASTER_TITLE', displayName: '시즌 마스터 칭호', kind: 'TITLE' },
  SEASON_TOP_1000_BANNER: { id: 'SEASON_TOP_1000_BANNER', displayName: '시즌 랭커 배너', kind: 'BANNER' },
  SEASON_TOP_100_EMBLEM: { id: 'SEASON_TOP_100_EMBLEM', displayName: 'Top 100 랭킹 문장', kind: 'EMBLEM' },
  SEASON_TOP_10_HONOR: { id: 'SEASON_TOP_10_HONOR', displayName: 'Top 10 명예 기록', kind: 'HONOR' },
};
const HONOR_IDS = new Set<PvpSeasonHonorId>(Object.keys(HONORS) as PvpSeasonHonorId[]);
const TIER_INDEX = new Map(PVP_TIERS.map((tier, index) => [tier.id, index] as const));

function nonEmptyId(value: string, context: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return normalized;
}
function seconds(ms: number): number { return Math.floor(ms / 1000); }
function phaseForCurrentSeason(): PvpSeasonPhase { return PVP_CURRENT_SEASON_ID.startsWith('preseason') ? 'PRESEASON' : 'ACTIVE'; }
function tierAtLeast(tier: PvpTierId, target: PvpTierId): boolean { return (TIER_INDEX.get(tier) ?? -1) >= (TIER_INDEX.get(target) ?? Number.MAX_SAFE_INTEGER); }

export function resolvePvpSeasonHonors(input: {
  readonly finalTier: PvpTierId;
  readonly placementMatches: number;
  readonly finalRank: number | null;
}): readonly PvpSeasonHonor[] {
  if (input.placementMatches < PVP_PLACEMENT_MATCH_COUNT) return [];
  const ids: PvpSeasonHonorId[] = [];
  if (tierAtLeast(input.finalTier, 'GOLD')) ids.push('SEASON_GOLD_EMBLEM');
  if (tierAtLeast(input.finalTier, 'PLATINUM')) ids.push('SEASON_PLATINUM_FRAME');
  if (tierAtLeast(input.finalTier, 'MASTER')) ids.push('SEASON_MASTER_TITLE');
  if (input.finalRank !== null && input.finalRank <= 1000) ids.push('SEASON_TOP_1000_BANNER');
  if (input.finalRank !== null && input.finalRank <= 100) ids.push('SEASON_TOP_100_EMBLEM');
  if (input.finalRank !== null && input.finalRank <= 10) ids.push('SEASON_TOP_10_HONOR');
  return ids.map((id) => HONORS[id]);
}

function parseHonors(value: string | null, fallback: readonly PvpSeasonHonor[]): readonly PvpSeasonHonor[] {
  if (value === null) return fallback;
  try {
    const decoded: unknown = JSON.parse(value);
    if (!Array.isArray(decoded)) return fallback;
    const ids = decoded.filter((entry): entry is PvpSeasonHonorId => typeof entry === 'string' && HONOR_IDS.has(entry as PvpSeasonHonorId));
    return [...new Set(ids)].map((id) => HONORS[id]);
  } catch { return fallback; }
}

function historyView(row: SeasonResultRow): PvpSeasonHistoryEntry {
  const fallback = resolvePvpSeasonHonors({ finalTier: row.final_tier, placementMatches: row.placement_matches, finalRank: row.final_rank });
  return {
    seasonId: row.season_id,
    closedAtMs: row.closed_at * 1000,
    finalMmr: row.final_mmr,
    bestMmr: row.best_mmr,
    finalTier: row.final_tier,
    placementMatches: row.placement_matches,
    rankedWins: row.ranked_wins,
    rankedLosses: row.ranked_losses,
    rankedDraws: row.ranked_draws,
    finalRank: row.final_rank,
    honors: parseHonors(row.honor_json, fallback),
    honorClaimed: row.honor_claimed_at !== null,
    honorClaimedAtMs: row.honor_claimed_at === null ? null : row.honor_claimed_at * 1000,
  };
}

function closureView(row: ClosureRow): PvpSeasonClosure {
  return {
    seasonId: row.season_id,
    nextSeasonId: row.next_season_id,
    closedAtMs: row.closed_at * 1000,
    rolledAtMs: row.rolled_at === null ? null : row.rolled_at * 1000,
    playerCount: row.player_count,
    placementPlayerCount: row.placement_player_count,
  };
}

async function loadClosure(db: D1Database, seasonId: string): Promise<ClosureRow | null> {
  return db.prepare(
    `SELECT season_id, next_season_id, closed_at, rolled_at, player_count, placement_player_count
     FROM pvp_season_closures WHERE season_id = ?1`,
  ).bind(seasonId).first<ClosureRow>();
}

async function assertNoLiveSeasonActivity(db: D1Database, seasonId: string, nowMs: number): Promise<void> {
  const row = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM pvp_matches
        WHERE season_id = ?1 AND state IN ('CREATED','ACTIVE')) AS live_matches,
       (SELECT COUNT(*) FROM pvp_matchmaking_queue
        WHERE season_id = ?1 AND state IN ('QUEUED','PAIRING') AND expires_at > ?2) AS live_queue`,
  ).bind(seasonId, seconds(nowMs)).first<LiveActivityRow>();
  if ((row?.live_matches ?? 0) > 0 || (row?.live_queue ?? 0) > 0) throw new Error('pvp_season_live_activity');
}

/**
 * Trusted operations hook for season settlement. It is intentionally not exposed by
 * public HTTP: deployment/operations code closes the season only after ranked queue
 * admission has been stopped. Final standings are immutable once this succeeds.
 */
export async function finalizePvpSeason(
  db: D1Database,
  rawSeasonId: string,
  rawNextSeasonId: string,
  nowMs = Date.now(),
): Promise<PvpSeasonClosure> {
  const seasonId = nonEmptyId(rawSeasonId, 'seasonId');
  const nextSeasonId = nonEmptyId(rawNextSeasonId, 'nextSeasonId');
  if (seasonId === nextSeasonId) throw new Error('pvp_season_next_id_must_differ');
  const existing = await loadClosure(db, seasonId);
  if (existing) {
    if (existing.next_season_id !== nextSeasonId) throw new Error('pvp_season_closure_next_id_conflict');
    return closureView(existing);
  }
  await assertNoLiveSeasonActivity(db, seasonId, nowMs);
  const now = seconds(nowMs);
  await db.batch([
    db.prepare(
      `INSERT OR IGNORE INTO pvp_season_closures
       (season_id, next_season_id, closed_at, rolled_at, player_count, placement_player_count)
       SELECT ?1, ?2, ?3, NULL,
              COUNT(*), COALESCE(SUM(CASE WHEN placement_matches >= ?4 THEN 1 ELSE 0 END), 0)
       FROM pvp_ratings WHERE season_id = ?1`,
    ).bind(seasonId, nextSeasonId, now, PVP_PLACEMENT_MATCH_COUNT),
    db.prepare(
      `INSERT OR IGNORE INTO pvp_season_results
       (season_id, user_id, final_mmr, best_mmr, final_tier, placement_matches,
        ranked_wins, ranked_losses, ranked_draws, final_rank, honor_claimed_at, honor_json)
       SELECT ?1, user_id, mmr, best_mmr, displayed_tier, placement_matches,
              ranked_wins, ranked_losses, ranked_draws,
              ROW_NUMBER() OVER (ORDER BY mmr DESC, ranked_wins DESC, updated_at ASC, user_id ASC),
              NULL, NULL
       FROM pvp_ratings
       WHERE season_id = ?1 AND placement_matches >= ?2`,
    ).bind(seasonId, PVP_PLACEMENT_MATCH_COUNT),
    db.prepare(
      `INSERT OR IGNORE INTO pvp_season_results
       (season_id, user_id, final_mmr, best_mmr, final_tier, placement_matches,
        ranked_wins, ranked_losses, ranked_draws, final_rank, honor_claimed_at, honor_json)
       SELECT ?1, user_id, mmr, best_mmr, displayed_tier, placement_matches,
              ranked_wins, ranked_losses, ranked_draws, NULL, NULL, NULL
       FROM pvp_ratings
       WHERE season_id = ?1 AND placement_matches < ?2`,
    ).bind(seasonId, PVP_PLACEMENT_MATCH_COUNT),
  ]);
  const closed = await loadClosure(db, seasonId);
  if (!closed) throw new Error('pvp_season_closure_missing_after_create');
  if (closed.next_season_id !== nextSeasonId) throw new Error('pvp_season_closure_next_id_conflict');
  return closureView(closed);
}

/**
 * Applies the canonical 60% compression toward 1000 (clamped to 800..1750), then
 * clears season-local records. This is also intentionally trusted-only. The code
 * deployment must already point PVP_CURRENT_SEASON_ID at closure.nextSeasonId.
 */
export async function rollClosedPvpSeasonToCurrent(
  db: D1Database,
  rawSeasonId: string,
  nowMs = Date.now(),
): Promise<{ readonly fromSeasonId: string; readonly toSeasonId: string; readonly changedRatings: number }> {
  const seasonId = nonEmptyId(rawSeasonId, 'seasonId');
  const closure = await loadClosure(db, seasonId);
  if (!closure) throw new Error('pvp_season_not_closed');
  if (closure.next_season_id !== PVP_CURRENT_SEASON_ID) throw new Error('pvp_season_code_not_on_next_season');
  if (closure.rolled_at !== null) return { fromSeasonId: seasonId, toSeasonId: closure.next_season_id, changedRatings: 0 };
  await assertNoLiveSeasonActivity(db, seasonId, nowMs);
  const resetExpression = `CAST(MAX(800, MIN(1750, ROUND(1000 + (mmr - 1000) * 0.60))) AS INTEGER)`;
  const now = seconds(nowMs);
  const writes = await db.batch([
    db.prepare(
      `UPDATE pvp_ratings SET
         season_id = ?1,
         mmr = ${resetExpression},
         best_mmr = ${resetExpression},
         displayed_tier = CASE
           WHEN ${resetExpression} >= 2000 THEN 'FRONTLINE_APEX'
           WHEN ${resetExpression} >= 1800 THEN 'GRANDMASTER'
           WHEN ${resetExpression} >= 1600 THEN 'MASTER'
           WHEN ${resetExpression} >= 1400 THEN 'DIAMOND'
           WHEN ${resetExpression} >= 1200 THEN 'PLATINUM'
           WHEN ${resetExpression} >= 1050 THEN 'GOLD'
           WHEN ${resetExpression} >= 900 THEN 'SILVER'
           ELSE 'BRONZE' END,
         placement_matches = 0,
         ranked_wins = 0, ranked_losses = 0, ranked_draws = 0,
         casual_wins = 0, casual_losses = 0, casual_draws = 0,
         revision = revision + 1,
         updated_at = ?2
       WHERE season_id = ?3`,
    ).bind(PVP_CURRENT_SEASON_ID, now, seasonId),
    db.prepare(`DELETE FROM pvp_matchmaking_queue WHERE season_id = ?1`).bind(seasonId),
    db.prepare(
      `UPDATE pvp_season_closures SET rolled_at = ?1
       WHERE season_id = ?2 AND rolled_at IS NULL`,
    ).bind(now, seasonId),
  ]);
  if ((writes[2]?.meta.changes ?? 0) !== 1) throw new Error('pvp_season_roll_conflict');
  return { fromSeasonId: seasonId, toSeasonId: PVP_CURRENT_SEASON_ID, changedRatings: writes[0]?.meta.changes ?? 0 };
}

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

export async function getRecentPvpSeasonHistory(
  db: D1Database,
  accountId: string,
  limit = 4,
): Promise<readonly PvpSeasonHistoryEntry[]> {
  const safeLimit = Math.max(1, Math.min(12, Math.trunc(limit)));
  const rows = await db.prepare(
    `SELECT r.season_id, c.closed_at, r.final_mmr, r.best_mmr, r.final_tier,
            r.placement_matches, r.ranked_wins, r.ranked_losses, r.ranked_draws,
            r.final_rank, r.honor_claimed_at, r.honor_json
     FROM pvp_season_results r
     JOIN pvp_season_closures c ON c.season_id = r.season_id
     WHERE r.user_id = ?1
     ORDER BY c.closed_at DESC, r.season_id DESC
     LIMIT ?2`,
  ).bind(accountId, safeLimit).all<SeasonResultRow>();
  return rows.results.map(historyView);
}

export async function claimPvpSeasonHonors(
  db: D1Database,
  rawAccountId: string,
  rawSeasonId: string,
  nowMs = Date.now(),
): Promise<PvpSeasonHonorClaimResult> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const seasonId = nonEmptyId(rawSeasonId, 'seasonId');
  const load = async () => db.prepare(
    `SELECT r.season_id, c.closed_at, r.final_mmr, r.best_mmr, r.final_tier,
            r.placement_matches, r.ranked_wins, r.ranked_losses, r.ranked_draws,
            r.final_rank, r.honor_claimed_at, r.honor_json
     FROM pvp_season_results r
     JOIN pvp_season_closures c ON c.season_id = r.season_id
     WHERE r.season_id = ?1 AND r.user_id = ?2`,
  ).bind(seasonId, accountId).first<SeasonResultRow>();
  const current = await load();
  if (!current) throw new Error('pvp_season_result_not_found');
  const fallback = resolvePvpSeasonHonors({ finalTier: current.final_tier, placementMatches: current.placement_matches, finalRank: current.final_rank });
  if (current.honor_claimed_at !== null) {
    return {
      seasonId,
      replayed: true,
      honors: parseHonors(current.honor_json, fallback),
      claimedAtMs: current.honor_claimed_at * 1000,
    };
  }
  const honorIds = fallback.map((honor) => honor.id);
  const claimedAt = seconds(nowMs);
  const write = await db.prepare(
    `UPDATE pvp_season_results
     SET honor_claimed_at = ?1, honor_json = ?2
     WHERE season_id = ?3 AND user_id = ?4 AND honor_claimed_at IS NULL`,
  ).bind(claimedAt, JSON.stringify(honorIds), seasonId, accountId).run();
  if ((write.meta.changes ?? 0) !== 1) {
    const raced = await load();
    if (raced?.honor_claimed_at !== null && raced?.honor_claimed_at !== undefined) {
      return {
        seasonId,
        replayed: true,
        honors: parseHonors(raced.honor_json, fallback),
        claimedAtMs: raced.honor_claimed_at * 1000,
      };
    }
    throw new Error('pvp_season_honor_claim_conflict');
  }
  return { seasonId, replayed: false, honors: fallback, claimedAtMs: claimedAt * 1000 };
}

export async function getPvpSeasonOverview(
  db: D1Database,
  accountId: string,
  nowMs = Date.now(),
): Promise<PvpSeasonOverview> {
  const [rating, rank, population, recentRankedMatches, recentSeasonHistory] = await Promise.all([
    getPvpRatingView(db, accountId, nowMs),
    getExactGlobalRank(db, accountId),
    getPopulation(db),
    getRecentRankedMatches(db, accountId),
    getRecentPvpSeasonHistory(db, accountId),
  ]);
  return {
    seasonId: PVP_CURRENT_SEASON_ID,
    phase: phaseForCurrentSeason(),
    activeWeeksTarget: PVP_SEASON_ACTIVE_WEEKS,
    settlementDaysTarget: PVP_SEASON_SETTLEMENT_DAYS,
    rating,
    globalRank: rating.placementComplete ? rank : null,
    ratedPlayerCount: population.total,
    placementPlayerCount: population.placed,
    tierPopulation: population.tiers,
    recentRankedMatches,
    recentSeasonHistory,
  };
}

export const __pvpSeasonAuthorityTestOnly = {
  resolvePvpSeasonHonors,
  phaseForCurrentSeason,
};
