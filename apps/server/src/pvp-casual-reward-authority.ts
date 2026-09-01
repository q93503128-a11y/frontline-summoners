import {
  PVP_CASUAL_DAILY_REWARD,
  getPvpCasualRewardDayKey,
  type PvpCasualRewardModeId,
} from '@frontline/sim/pvp-casual-rewards';
import { grantResources } from '@frontline/sim/resource-ledger';
import {
  ACCOUNT_SAVE_SCHEMA_VERSION,
  initializeAccountSave,
  loadAccountSave,
  normalizeAccountSaveSnapshot,
} from './account-save-authority.ts';

interface CasualRewardReceiptRow {
  readonly user_id: string;
  readonly match_id: string;
  readonly mode_id: PvpCasualRewardModeId;
  readonly reward_day: string;
  readonly reward_slot: number | null;
  readonly participation_gold: number;
  readonly win_bonus_gold: number;
  readonly resulting_revision: number;
}

export interface PvpCasualMatchRewardView {
  readonly accountId: string;
  readonly matchId: string;
  readonly modeId: PvpCasualRewardModeId;
  readonly rewardDay: string;
  readonly rewardSlot: number | null;
  readonly dailyRewardCap: number;
  readonly participationGold: number;
  readonly winBonusGold: number;
  readonly totalGold: number;
  readonly replayed: boolean;
  readonly resultingRevision: number;
}

function accountId(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 128) throw new Error('casual PvP reward accountId must be 1..128 characters');
  return normalized;
}

function matchId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error('casual PvP reward matchId required');
  return normalized;
}

function assertMode(modeId: string): asserts modeId is PvpCasualRewardModeId {
  if (modeId !== 'pvp_casual_1v1' && modeId !== 'pvp_casual_2v2') throw new Error(`casual PvP reward mode invalid:${modeId}`);
}

async function loadReceipt(db: D1Database, userId: string, id: string): Promise<CasualRewardReceiptRow | null> {
  return db.prepare(
    `SELECT user_id, match_id, mode_id, reward_day, reward_slot,
            participation_gold, win_bonus_gold, resulting_revision
     FROM pvp_casual_reward_receipts
     WHERE user_id = ?1 AND match_id = ?2`,
  ).bind(userId, id).first<CasualRewardReceiptRow>();
}

async function maxRewardSlot(db: D1Database, userId: string, rewardDay: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COALESCE(MAX(reward_slot), 0) AS max_slot
     FROM pvp_casual_reward_receipts
     WHERE user_id = ?1 AND reward_day = ?2 AND reward_slot IS NOT NULL`,
  ).bind(userId, rewardDay).first<{ max_slot: number }>();
  return Number.isInteger(row?.max_slot) ? Math.max(0, row!.max_slot) : 0;
}

function view(row: CasualRewardReceiptRow, replayed: boolean): PvpCasualMatchRewardView {
  return {
    accountId: row.user_id,
    matchId: row.match_id,
    modeId: row.mode_id,
    rewardDay: row.reward_day,
    rewardSlot: row.reward_slot,
    dailyRewardCap: PVP_CASUAL_DAILY_REWARD.rewardedMatchesPerUtcDay,
    participationGold: row.participation_gold,
    winBonusGold: row.win_bonus_gold,
    totalGold: row.participation_gold + row.win_bonus_gold,
    replayed,
    resultingRevision: row.resulting_revision,
  };
}

async function recordExhaustedMatch(
  db: D1Database,
  userId: string,
  id: string,
  modeId: PvpCasualRewardModeId,
  rewardDay: string,
  revision: number,
): Promise<PvpCasualMatchRewardView> {
  await db.prepare(
    `INSERT OR IGNORE INTO pvp_casual_reward_receipts
      (user_id, match_id, mode_id, reward_day, reward_slot,
       participation_gold, win_bonus_gold, resulting_revision)
     VALUES (?1, ?2, ?3, ?4, NULL, 0, 0, ?5)`,
  ).bind(userId, id, modeId, rewardDay, revision).run();
  const receipt = await loadReceipt(db, userId, id);
  if (!receipt) throw new Error('casual PvP exhausted reward receipt missing');
  return view(receipt, false);
}

/**
 * Grants the bounded v1 casual-PvP gold reward from a trusted completed match.
 *
 * The first three casual matches across 1v1 and 2v2 share one UTC-day allowance.
 * A per-match receipt makes replay idempotent, while the unique day/slot key plus the
 * account-save revision CAS prevents concurrent settlements from creating a fourth grant.
 */
export async function grantPvpCasualMatchReward(
  db: D1Database,
  rawAccountId: string,
  rawMatchId: string,
  rawModeId: string,
  won: boolean,
  completedAtMs: number,
  nowMs = Date.now(),
): Promise<PvpCasualMatchRewardView> {
  const userId = accountId(rawAccountId);
  const id = matchId(rawMatchId);
  assertMode(rawModeId);
  const modeId = rawModeId;
  const rewardDay = getPvpCasualRewardDayKey(completedAtMs);

  const existing = await loadReceipt(db, userId, id);
  if (existing) return view(existing, true);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const replay = await loadReceipt(db, userId, id);
    if (replay) return view(replay, true);

    const save = await initializeAccountSave(db, userId, undefined, nowMs);
    const currentSlot = await maxRewardSlot(db, userId, rewardDay);
    if (currentSlot >= PVP_CASUAL_DAILY_REWARD.rewardedMatchesPerUtcDay) {
      return recordExhaustedMatch(db, userId, id, modeId, rewardDay, save.revision);
    }

    const rewardSlot = currentSlot + 1;
    const participationGold = PVP_CASUAL_DAILY_REWARD.participationGold;
    const winBonusGold = won ? PVP_CASUAL_DAILY_REWARD.winBonusGold : 0;
    const nextSnapshot = normalizeAccountSaveSnapshot({
      ...save.snapshot,
      resourceLedgerById: grantResources(save.snapshot.resourceLedgerById, {
        gold: participationGold + winBonusGold,
      }),
    }, nowMs);
    const nextRevision = save.revision + 1;

    try {
      const writes = await db.batch([
        db.prepare(
          `UPDATE account_saves
           SET schema_version = ?1,
               revision = CASE WHEN revision = ?4 THEN revision + 1 ELSE -1 END,
               snapshot_json = ?2,
               updated_at = unixepoch()
           WHERE user_id = ?3`,
        ).bind(ACCOUNT_SAVE_SCHEMA_VERSION, JSON.stringify(nextSnapshot), userId, save.revision),
        db.prepare(
          `INSERT INTO pvp_casual_reward_receipts
            (user_id, match_id, mode_id, reward_day, reward_slot,
             participation_gold, win_bonus_gold, resulting_revision)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
        ).bind(userId, id, modeId, rewardDay, rewardSlot, participationGold, winBonusGold, nextRevision),
      ]);
      if (writes.length !== 2 || (writes[0]?.meta.changes ?? 0) !== 1 || (writes[1]?.meta.changes ?? 0) !== 1) {
        throw new Error('casual PvP reward batch incomplete');
      }
      const receipt = await loadReceipt(db, userId, id);
      if (!receipt) throw new Error('casual PvP reward receipt missing after grant');
      return view(receipt, false);
    } catch (error) {
      const receipt = await loadReceipt(db, userId, id);
      if (receipt) return view(receipt, true);
      const latest = await loadAccountSave(db, userId, nowMs);
      if (latest && latest.revision !== save.revision) continue;
      throw error;
    }
  }
  throw new Error(`casual PvP reward revision conflict:${userId}:${id}`);
}

export const __pvpCasualRewardAuthorityTestOnly = {
  maxRewardSlot,
  view,
};
