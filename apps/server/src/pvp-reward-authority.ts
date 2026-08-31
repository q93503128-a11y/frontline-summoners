import {
  PVP_TIER_FIRST_REACH_REWARDS,
  PVP_TIERS,
  type PvpTierFirstReachReward,
  type PvpTierId,
} from '@frontline/sim/pvp-content';
import { grantResources, type ResourceAmounts } from '@frontline/sim/resource-ledger';
import {
  ACCOUNT_SAVE_SCHEMA_VERSION,
  initializeAccountSave,
  loadAccountSave,
  normalizeAccountSaveSnapshot,
  type AccountSaveRecord,
} from './account-save-authority.ts';

export interface PvpFirstReachGrant {
  readonly tierId: Exclude<PvpTierId, 'BRONZE'>;
  readonly resources: ResourceAmounts;
}

export interface PvpFirstReachGrantResult {
  readonly accountId: string;
  readonly granted: readonly PvpFirstReachGrant[];
  readonly resultingRevision: number;
}

type ReceiptRow = {
  readonly tier_id: Exclude<PvpTierId, 'BRONZE'>;
  readonly reward_json: string;
  readonly resulting_revision: number;
};

const TIER_MIN_MMR = new Map(PVP_TIERS.map((tier) => [tier.id, tier.minMmr] as const));

function eligibleRewards(bestMmr: number): readonly PvpTierFirstReachReward[] {
  if (!Number.isFinite(bestMmr)) throw new Error('pvp first-reach bestMmr must be finite');
  const normalized = Math.max(0, Math.round(bestMmr));
  return PVP_TIER_FIRST_REACH_REWARDS.filter((reward) => normalized >= (TIER_MIN_MMR.get(reward.tierId) ?? Number.MAX_SAFE_INTEGER));
}

async function loadReceipts(db: D1Database, accountId: string): Promise<readonly ReceiptRow[]> {
  const rows = await db.prepare(
    `SELECT tier_id, reward_json, resulting_revision
     FROM pvp_first_reach_reward_receipts
     WHERE user_id = ?1
     ORDER BY resulting_revision ASC, tier_id ASC`,
  ).bind(accountId).all<ReceiptRow>();
  return rows.results;
}

function aggregateResources(rewards: readonly PvpTierFirstReachReward[]): ResourceAmounts {
  const totals: Record<string, number> = {};
  for (const reward of rewards) {
    for (const [resourceId, amount] of Object.entries(reward.currencies)) {
      if (!Number.isInteger(amount) || amount < 0) throw new Error(`invalid PvP first-reach reward amount:${reward.tierId}:${resourceId}`);
      totals[resourceId] = (totals[resourceId] ?? 0) + amount;
    }
  }
  return totals as ResourceAmounts;
}

function grantsFromRewards(rewards: readonly PvpTierFirstReachReward[]): readonly PvpFirstReachGrant[] {
  return rewards.map((reward) => ({ tierId: reward.tierId, resources: reward.currencies }));
}

export async function getClaimedPvpFirstReachTiers(
  db: D1Database,
  accountId: string,
): Promise<readonly Exclude<PvpTierId, 'BRONZE'>[]> {
  return (await loadReceipts(db, accountId)).map((row) => row.tier_id);
}

/**
 * Grants every currently eligible, never-before-received first-reach tier reward in one
 * account-save revision. The save mutation and all tier receipts share one D1 batch so
 * a retry cannot duplicate currency even if two ranked settlements race.
 */
export async function grantPvpFirstReachRewards(
  db: D1Database,
  rawAccountId: string,
  bestMmr: number,
  nowMs = Date.now(),
): Promise<PvpFirstReachGrantResult> {
  const accountId = rawAccountId.trim();
  if (!accountId) throw new Error('pvp first-reach accountId required');
  const eligible = eligibleRewards(bestMmr);
  if (eligible.length === 0) {
    const save = await initializeAccountSave(db, accountId, undefined, nowMs);
    return { accountId, granted: [], resultingRevision: save.revision };
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const save = await initializeAccountSave(db, accountId, undefined, nowMs);
    const claimed = new Set((await loadReceipts(db, accountId)).map((row) => row.tier_id));
    const pending = eligible.filter((reward) => !claimed.has(reward.tierId));
    if (pending.length === 0) return { accountId, granted: [], resultingRevision: save.revision };

    const resources = aggregateResources(pending);
    const nextSnapshot = normalizeAccountSaveSnapshot({
      ...save.snapshot,
      resourceLedgerById: grantResources(save.snapshot.resourceLedgerById, resources),
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
        ).bind(ACCOUNT_SAVE_SCHEMA_VERSION, JSON.stringify(nextSnapshot), accountId, save.revision),
        ...pending.map((reward) => db.prepare(
          `INSERT INTO pvp_first_reach_reward_receipts
           (user_id, tier_id, reward_json, resulting_revision)
           VALUES (?1, ?2, ?3, ?4)`,
        ).bind(accountId, reward.tierId, JSON.stringify(reward.currencies), nextRevision)),
      ]);
      if (writes.length !== pending.length + 1 || (writes[0]?.meta.changes ?? 0) !== 1) {
        throw new Error('pvp first-reach reward batch incomplete');
      }
      const record = await loadAccountSave(db, accountId, nowMs);
      if (!record || record.revision !== nextRevision) throw new Error('pvp first-reach reward revision mismatch');
      return { accountId, granted: grantsFromRewards(pending), resultingRevision: record.revision };
    } catch (error) {
      const latestReceipts = new Set((await loadReceipts(db, accountId)).map((row) => row.tier_id));
      if (pending.every((reward) => latestReceipts.has(reward.tierId))) {
        const latest = await initializeAccountSave(db, accountId, undefined, nowMs);
        return { accountId, granted: [], resultingRevision: latest.revision };
      }
      const latest = await loadAccountSave(db, accountId, nowMs);
      if (latest && latest.revision !== save.revision) continue;
      throw error;
    }
  }
  const finalRecord: AccountSaveRecord = await initializeAccountSave(db, accountId, undefined, nowMs);
  throw new Error(`pvp first-reach reward revision conflict:${accountId}:${finalRecord.revision}`);
}

export const __pvpRewardAuthorityTestOnly = {
  eligibleRewards,
  aggregateResources,
  grantsFromRewards,
};
