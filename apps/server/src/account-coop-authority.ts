import { initializeAccountSave, type AccountSaveSnapshotV2 } from './account-save-authority.ts';
import { applyAccountEnemyDiscoveries } from './account-enemy-discovery-authority.ts';
import { applyAccountMainBattleResult } from './account-mutation-authority.ts';
import { applyAccountSpecialBattleResult } from './account-special-mutation-authority.ts';
import { initializeAccountProfile, recordAccountAchievementFact } from './account-profile-authority.ts';
import { ACCOUNT_MAIN_STAGE_INDEX, ACCOUNT_SPECIAL_STAGE_IDS } from './account-content.ts';
import { assertAccountSpecialStagePlayable } from './account-stage-authority.ts';
import { getServerCoopLoadout, getServerCoopStage, type ServerCoopStageRuntime } from './runtime-content.ts';
import type { CoopPlayerLoadout } from './coop-room.ts';
import { COMBAT_QUIRK_FACT_IDS, type CombatQuirkFactId } from '@frontline/sim/combat-quirk-attribution';

const COMBAT_QUIRK_FACT_ID_SET = new Set<string>(COMBAT_QUIRK_FACT_IDS);

export interface AccountCoopSeatAuthority {
  readonly accountId: string;
  readonly revision: number;
  readonly loadout: CoopPlayerLoadout;
  readonly selectedBaseWeaponId: AccountSaveSnapshotV2['selectedBaseWeaponId'];
}

export interface AccountCoopSettlement {
  readonly accountId: string;
  readonly stageId: string;
  readonly revision: number;
  readonly replayed: boolean;
  readonly friendFactRecorded: boolean;
  readonly reconnectFactRecorded: boolean;
}

function buildAccountCoopLoadout(snapshot: AccountSaveSnapshotV2): CoopPlayerLoadout {
  const characters = snapshot.deckSlotIds.slice(0, 5).map((characterId) => {
    const progress = snapshot.characterProgressById[characterId];
    if (!progress) throw new Error(`account coop deck character has no progress:${characterId}`);
    return {
      characterId,
      level: progress.level,
      plusLevel: progress.plusLevel,
      ...(progress.selectedFormId === undefined ? {} : { selectedFormId: progress.selectedFormId }),
    };
  });
  const loadout: CoopPlayerLoadout = {
    characters,
    permanentRewardIds: [...snapshot.permanentRewardIds],
    clearedStageIds: [...snapshot.clearedStageIds],
  };
  getServerCoopLoadout(loadout);
  return loadout;
}

export function assertAccountCoopStagePlayable(
  snapshot: AccountSaveSnapshotV2,
  stageId: string,
  nowMs = Date.now(),
): ServerCoopStageRuntime {
  const runtime = getServerCoopStage(stageId);
  const mainIndex = ACCOUNT_MAIN_STAGE_INDEX.get(stageId);
  if (mainIndex !== undefined) {
    if (mainIndex > snapshot.clearedStageIds.length) throw new Error(`account coop MAIN stage is locked:${stageId}`);
    return runtime;
  }
  if (!ACCOUNT_SPECIAL_STAGE_IDS.has(stageId)) throw new Error(`unknown account coop stage:${stageId}`);
  assertAccountSpecialStagePlayable(stageId, snapshot.clearedStageIds, snapshot.specialClearedStageIds, nowMs);
  return runtime;
}

export async function getAccountCoopSeatAuthority(
  db: D1Database,
  accountId: string,
  stageId: string,
  nowMs = Date.now(),
): Promise<AccountCoopSeatAuthority> {
  const record = await initializeAccountSave(db, accountId, undefined, nowMs);
  assertAccountCoopStagePlayable(record.snapshot, stageId, nowMs);
  return {
    accountId,
    revision: record.revision,
    loadout: buildAccountCoopLoadout(record.snapshot),
    selectedBaseWeaponId: record.snapshot.selectedBaseWeaponId,
  };
}

async function settleStageOnce(
  db: D1Database,
  accountId: string,
  stageId: string,
  battleId: string,
  expectedRevision: number,
  nowMs: number,
  availabilityAtMs: number,
  discoveredEnemyIds: readonly string[],
) {
  if (ACCOUNT_MAIN_STAGE_INDEX.has(stageId)) {
    return applyAccountMainBattleResult(db, accountId, {
      battleId,
      expectedRevision,
      stageId,
      source: 'COOP_BATTLE',
      discoveredEnemyIds,
    }, nowMs);
  }
  return applyAccountSpecialBattleResult(db, accountId, {
    battleId,
    expectedRevision,
    stageId,
    discoveredEnemyIds,
  }, nowMs, availabilityAtMs);
}

export async function settleAuthenticatedCoopDiscoveries(
  db: D1Database,
  accountId: string,
  discoveredEnemyIds: readonly string[],
  nowMs = Date.now(),
): Promise<number> {
  let lastRevision = -1;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await initializeAccountSave(db, accountId, undefined, nowMs);
    lastRevision = current.revision;
    const result = await applyAccountEnemyDiscoveries(db, accountId, current.revision, discoveredEnemyIds, nowMs);
    if (result.ok) return result.record.revision;
  }
  throw new Error(`authenticated coop discovery revision conflict:${accountId}:${lastRevision}`);
}

export async function settleAuthenticatedCoopCombatFacts(
  db: D1Database,
  accountId: string,
  factIds: readonly CombatQuirkFactId[],
  nowMs = Date.now(),
): Promise<readonly CombatQuirkFactId[]> {
  const canonical = [...new Set(factIds.filter((factId) => COMBAT_QUIRK_FACT_ID_SET.has(factId)))];
  for (const factId of canonical) await recordAccountAchievementFact(db, accountId, factId, nowMs);
  return canonical;
}

export async function settleAuthenticatedCoopWin(
  db: D1Database,
  accountId: string,
  stageId: string,
  matchId: string,
  options: {
    readonly friendMatch: boolean;
    readonly reconnected: boolean;
    readonly discoveredEnemyIds?: readonly string[];
    readonly battleStartedAtMs?: number;
  },
  nowMs = Date.now(),
): Promise<AccountCoopSettlement> {
  const battleId = `coop:${matchId}`;
  const availabilityAtMs = options.battleStartedAtMs ?? nowMs;
  const discoveredEnemyIds = [...(options.discoveredEnemyIds ?? [])].sort();
  let lastRevision = -1;
  let replayed = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await initializeAccountSave(db, accountId, undefined, nowMs);
    lastRevision = current.revision;
    assertAccountCoopStagePlayable(current.snapshot, stageId, availabilityAtMs);
    const result = await settleStageOnce(db, accountId, stageId, battleId, current.revision, nowMs, availabilityAtMs, discoveredEnemyIds);
    if (!result.ok) continue;
    lastRevision = result.record.revision;
    replayed = result.replayed;
    await initializeAccountProfile(db, accountId, nowMs);
    if (options.friendMatch) await recordAccountAchievementFact(db, accountId, 'coop_friend_first', nowMs);
    if (options.reconnected) await recordAccountAchievementFact(db, accountId, 'coop_reconnected_win', nowMs);
    return {
      accountId,
      stageId,
      revision: lastRevision,
      replayed,
      friendFactRecorded: options.friendMatch,
      reconnectFactRecorded: options.reconnected,
    };
  }
  throw new Error(`authenticated coop settlement revision conflict:${accountId}:${matchId}:${lastRevision}`);
}

export const __accountCoopTestOnly = { buildAccountCoopLoadout };
