import type { PvpTimedResult } from '@frontline/sim/pvp-content';
import {
  ensurePvpRating,
  loadPvpMatch,
  loadPvpMatchParticipants,
  type PvpMatchParticipantRow,
  type PvpTeamId,
} from './pvp-authority.ts';
import {
  grantPvpCasualMatchReward,
  type PvpCasualMatchRewardView,
} from './pvp-casual-reward-authority.ts';
import { recordRecentCoopPlayers } from './social-authority.ts';

function delta(result: PvpTimedResult, teamId: PvpTeamId): { wins: number; losses: number; draws: number } {
  if (result === 'DRAW') return { wins: 0, losses: 0, draws: 1 };
  return result === teamId ? { wins: 1, losses: 0, draws: 0 } : { wins: 0, losses: 1, draws: 0 };
}

function seatId(participant: PvpMatchParticipantRow): 'A1' | 'A2' | 'B1' | 'B2' {
  return `${participant.team_id}${participant.seat_index + 1}` as 'A1' | 'A2' | 'B1' | 'B2';
}

export interface Pvp2v2CasualSettlementView {
  readonly matchId: string;
  readonly result: PvpTimedResult;
  readonly rated: false;
  readonly casualRewards: readonly {
    readonly seatId: 'A1' | 'A2' | 'B1' | 'B2';
    readonly reward: PvpCasualMatchRewardView;
  }[];
}

export async function completeTrustedCasualPvp2v2Result(
  db: D1Database,
  matchId: string,
  result: PvpTimedResult,
  nowMs = Date.now(),
): Promise<Pvp2v2CasualSettlementView> {
  const match = await loadPvpMatch(db, matchId);
  if (!match) throw new Error('pvp_2v2_match_not_found');
  if (match.mode_id !== 'pvp_casual_2v2') throw new Error('pvp_2v2_match_mode_invalid');
  const freshlyCompleted = match.state !== 'COMPLETED';
  if (freshlyCompleted && match.state !== 'CREATED' && match.state !== 'ACTIVE') throw new Error('pvp_2v2_match_not_completable');

  const participants = await loadPvpMatchParticipants(db, matchId);
  if (participants.length !== 4) throw new Error('pvp_2v2_participant_count_invalid');
  for (const teamId of ['A', 'B'] as const) {
    const seats = participants.filter((entry) => entry.team_id === teamId).map((entry) => entry.seat_index).sort();
    if (seats.length !== 2 || seats[0] !== 0 || seats[1] !== 1) throw new Error(`pvp_2v2_team_seats_invalid:${teamId}`);
  }

  const finalResult = match.state === 'COMPLETED' ? (match.result ?? result) : result;
  const completedAtSeconds = match.completed_at ?? Math.floor(nowMs / 1000);

  if (freshlyCompleted) {
    const ratings = await Promise.all(participants.map((participant) => ensurePvpRating(db, participant.user_id, nowMs)));
    const statements: D1PreparedStatement[] = [
      db.prepare(
        `UPDATE pvp_matches SET state = 'COMPLETED', result = ?1, completed_at = ?2
         WHERE match_id = ?3 AND state IN ('CREATED','ACTIVE')`,
      ).bind(finalResult, completedAtSeconds, matchId),
    ];
    participants.forEach((participant, index) => {
      const record = ratings[index]!;
      const change = delta(finalResult, participant.team_id);
      statements.push(db.prepare(
        `UPDATE pvp_ratings SET
           casual_wins = casual_wins + ?1,
           casual_losses = casual_losses + ?2,
           casual_draws = casual_draws + ?3,
           revision = revision + 1,
           updated_at = ?4
         WHERE user_id = ?5 AND revision = ?6`,
      ).bind(change.wins, change.losses, change.draws, completedAtSeconds, participant.user_id, record.revision));
    });
    const writes = await db.batch(statements);
    if (writes.some((write) => (write.meta.changes ?? 0) !== 1)) throw new Error('pvp_2v2_result_conflict');
    await db.prepare('DELETE FROM pvp_matchmaking_queue WHERE match_id = ?1').bind(matchId).run();
    for (let a = 0; a < participants.length; a += 1) {
      for (let b = a + 1; b < participants.length; b += 1) {
        await recordRecentCoopPlayers(db, participants[a]!.user_id, participants[b]!.user_id, matchId, 'PvP 2v2 일반전').catch(() => undefined);
      }
    }
  }

  const completedAtMs = completedAtSeconds * 1000;
  const rewards = await Promise.all(participants.map(async (participant) => ({
    seatId: seatId(participant),
    reward: await grantPvpCasualMatchReward(
      db,
      participant.user_id,
      matchId,
      match.mode_id,
      finalResult === participant.team_id,
      completedAtMs,
      nowMs,
    ),
  })));
  return { matchId, result: finalResult, rated: false, casualRewards: rewards };
}

export const __pvp2v2ResultTestOnly = { delta, seatId };
