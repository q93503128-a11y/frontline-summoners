import {
  PVP_ACHIEVEMENT_TIERS,
  type PvpAchievementTier,
} from '@frontline/sim/achievement-profile';
import type { PvpTimedResult } from '@frontline/sim/pvp-content';
import {
  completeRankedPvpMatch,
  ensurePvpRating,
  loadPvpMatch,
  loadPvpMatchParticipants,
  type PvpRatingView,
  type PvpTeamId,
} from './pvp-authority.ts';
import {
  recordAccountAchievementFact,
  recordAccountPvpAchievementTier,
} from './account-profile-authority.ts';
import {
  grantPvpFirstReachRewards,
  type PvpFirstReachGrant,
} from './pvp-reward-authority.ts';
import {
  grantPvpCasualMatchReward,
  type PvpCasualMatchRewardView,
} from './pvp-casual-reward-authority.ts';
import { recordRecentCoopPlayers } from './social-authority.ts';

function seconds(ms: number): number {
  return Math.floor(ms / 1000);
}

function recordDelta(result: PvpTimedResult, teamId: PvpTeamId): { wins: number; losses: number; draws: number } {
  if (result === 'DRAW') return { wins: 0, losses: 0, draws: 1 };
  return result === teamId ? { wins: 1, losses: 0, draws: 0 } : { wins: 0, losses: 1, draws: 0 };
}

function achievementTier(displayedTier: string): PvpAchievementTier {
  if (PVP_ACHIEVEMENT_TIERS.includes(displayedTier as PvpAchievementTier)) return displayedTier as PvpAchievementTier;
  // Grandmaster / Frontline Apex both satisfy the current highest MASTER achievement band.
  return 'MASTER';
}

export interface PvpSettlementView {
  readonly matchId: string;
  readonly result: PvpTimedResult;
  readonly modeId: string;
  readonly rated: boolean;
  readonly ratings?: readonly {
    readonly accountId: string;
    readonly rating: PvpRatingView;
  }[];
  readonly firstReachRewards?: readonly {
    readonly accountId: string;
    readonly grants: readonly PvpFirstReachGrant[];
    readonly newlyGrantedCosmeticIds: readonly string[];
  }[];
  readonly casualRewards?: readonly PvpCasualMatchRewardView[];
}

async function completeCasual1v1(
  db: D1Database,
  matchId: string,
  result: PvpTimedResult,
  nowMs: number,
): Promise<PvpSettlementView> {
  const match = await loadPvpMatch(db, matchId);
  if (!match) throw new Error('pvp_match_not_found');
  if (match.mode_id !== 'pvp_casual_1v1') throw new Error('pvp_match_not_casual_1v1');
  const participants = await loadPvpMatchParticipants(db, matchId);
  const a = participants.find((entry) => entry.team_id === 'A' && entry.seat_index === 0);
  const b = participants.find((entry) => entry.team_id === 'B' && entry.seat_index === 0);
  if (!a || !b || participants.length !== 2) throw new Error('pvp_casual_participants_invalid');

  const freshlyCompleted = match.state !== 'COMPLETED';
  if (freshlyCompleted && match.state !== 'CREATED' && match.state !== 'ACTIVE') throw new Error('pvp_match_not_completable');
  const finalResult = match.state === 'COMPLETED' ? (match.result ?? result) : result;
  const completedAtSeconds = match.completed_at ?? seconds(nowMs);

  if (freshlyCompleted) {
    const aRating = await ensurePvpRating(db, a.user_id, nowMs);
    const bRating = await ensurePvpRating(db, b.user_id, nowMs);
    const aDelta = recordDelta(finalResult, 'A');
    const bDelta = recordDelta(finalResult, 'B');
    const writes = await db.batch([
      db.prepare(
        `UPDATE pvp_matches
         SET state = 'COMPLETED', result = ?1, completed_at = ?2
         WHERE match_id = ?3 AND state IN ('CREATED','ACTIVE')`,
      ).bind(finalResult, completedAtSeconds, matchId),
      db.prepare(
        `UPDATE pvp_ratings SET
           casual_wins = casual_wins + ?1,
           casual_losses = casual_losses + ?2,
           casual_draws = casual_draws + ?3,
           revision = revision + 1,
           updated_at = ?4
         WHERE user_id = ?5 AND revision = ?6`,
      ).bind(aDelta.wins, aDelta.losses, aDelta.draws, completedAtSeconds, a.user_id, aRating.revision),
      db.prepare(
        `UPDATE pvp_ratings SET
           casual_wins = casual_wins + ?1,
           casual_losses = casual_losses + ?2,
           casual_draws = casual_draws + ?3,
           revision = revision + 1,
           updated_at = ?4
         WHERE user_id = ?5 AND revision = ?6`,
      ).bind(bDelta.wins, bDelta.losses, bDelta.draws, completedAtSeconds, b.user_id, bRating.revision),
    ]);
    if (writes.some((write) => (write.meta.changes ?? 0) !== 1)) throw new Error('pvp_casual_result_conflict');
    await db.prepare(`DELETE FROM pvp_matchmaking_queue WHERE match_id = ?1`).bind(matchId).run();
    await recordRecentCoopPlayers(db, a.user_id, b.user_id, matchId, 'PvP 1v1 일반전').catch(() => undefined);
  }

  const completedAtMs = completedAtSeconds * 1000;
  const [aReward, bReward] = await Promise.all([
    grantPvpCasualMatchReward(db, a.user_id, matchId, match.mode_id, finalResult === 'A', completedAtMs, nowMs),
    grantPvpCasualMatchReward(db, b.user_id, matchId, match.mode_id, finalResult === 'B', completedAtMs, nowMs),
  ]);
  return {
    matchId,
    result: finalResult,
    modeId: match.mode_id,
    rated: false,
    casualRewards: [aReward, bReward],
  };
}

export async function completeTrustedPvp1v1Result(
  db: D1Database,
  matchId: string,
  result: PvpTimedResult,
  nowMs = Date.now(),
): Promise<PvpSettlementView> {
  const match = await loadPvpMatch(db, matchId);
  if (!match) throw new Error('pvp_match_not_found');
  if (match.mode_id === 'pvp_ranked_1v1') {
    const wasAlreadyCompleted = match.state === 'COMPLETED';
    const settled = await completeRankedPvpMatch(db, matchId, result, nowMs);
    const participants = await loadPvpMatchParticipants(db, matchId);
    const a = participants.find((entry) => entry.team_id === 'A' && entry.seat_index === 0);
    const b = participants.find((entry) => entry.team_id === 'B' && entry.seat_index === 0);
    if (!a || !b) throw new Error('pvp_ranked_participants_missing_after_settlement');
    const [aReward, bReward] = await Promise.all([
      grantPvpFirstReachRewards(db, a.user_id, settled.a.bestMmr, nowMs),
      grantPvpFirstReachRewards(db, b.user_id, settled.b.bestMmr, nowMs),
    ]);
    await Promise.all([
      recordAccountAchievementFact(db, a.user_id, 'pvp_first_ranked', nowMs),
      recordAccountAchievementFact(db, b.user_id, 'pvp_first_ranked', nowMs),
      recordAccountPvpAchievementTier(db, a.user_id, achievementTier(settled.a.displayedTier), nowMs),
      recordAccountPvpAchievementTier(db, b.user_id, achievementTier(settled.b.displayedTier), nowMs),
    ]);
    if (!wasAlreadyCompleted) await recordRecentCoopPlayers(db, a.user_id, b.user_id, matchId, 'PvP 1v1 랭킹전').catch(() => undefined);
    return {
      matchId,
      result: settled.result,
      modeId: match.mode_id,
      rated: true,
      ratings: [
        { accountId: a.user_id, rating: settled.a },
        { accountId: b.user_id, rating: settled.b },
      ],
      firstReachRewards: [
        { accountId: a.user_id, grants: aReward.granted, newlyGrantedCosmeticIds: aReward.newlyGrantedCosmeticIds },
        { accountId: b.user_id, grants: bReward.granted, newlyGrantedCosmeticIds: bReward.newlyGrantedCosmeticIds },
      ],
    };
  }
  if (match.mode_id === 'pvp_casual_1v1') return completeCasual1v1(db, matchId, result, nowMs);
  throw new Error(`pvp_1v1_result_mode_not_supported:${match.mode_id}`);
}

export async function voidTrustedPvpMatch(
  db: D1Database,
  matchId: string,
  nowMs = Date.now(),
): Promise<void> {
  const write = await db.prepare(
    `UPDATE pvp_matches
     SET state = 'VOID', completed_at = ?1
     WHERE match_id = ?2 AND state IN ('CREATED','ACTIVE')`,
  ).bind(seconds(nowMs), matchId).run();
  if ((write.meta.changes ?? 0) === 0) {
    const match = await loadPvpMatch(db, matchId);
    if (!match || (match.state !== 'VOID' && match.state !== 'COMPLETED')) throw new Error('pvp_void_match_failed');
  }
  await db.prepare(`DELETE FROM pvp_matchmaking_queue WHERE match_id = ?1`).bind(matchId).run();
}

export const __pvpResultTestOnly = { recordDelta, achievementTier };
