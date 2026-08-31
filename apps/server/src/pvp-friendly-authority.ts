import { PVP_ARENA_DUEL_V1 } from '@frontline/sim/pvp-arena-content';
import { PVP_STANDARDIZATION, type PvpTimedResult } from '@frontline/sim/pvp-content';
import {
  applyPermanentRewardBattleEffects,
  type PermanentRewardApplicableSlot,
} from '@frontline/sim/meta-progression';
import type { BaseWeaponId, SupplyLevelDefinition } from '@frontline/sim/playable';
import { initializeAccountSave, type AccountSaveSnapshotV2 } from './account-save-authority.ts';
import { recordAccountAchievementFact } from './account-profile-authority.ts';
import { getAccountOwnedCharacterIds } from './progression-authority.ts';
import {
  getServerCoopLoadout,
  isServerCoopBaseWeaponUnlocked,
} from './runtime-content.ts';
import { SERVER_PERMANENT_REWARDS } from './meta-content-v2.ts';
import { ensureSocialProfile, isEitherSocialBlocked, recordRecentCoopPlayers } from './social-authority.ts';
import { loadPvpMatch, loadPvpMatchParticipants } from './pvp-authority.ts';

export const FRIENDLY_PVP_GROWTH_POLICIES = ['STANDARDIZED', 'ACTUAL'] as const;
export type FriendlyPvpGrowthPolicy = (typeof FRIENDLY_PVP_GROWTH_POLICIES)[number];

export interface AccountFriendlyPvpAuthority {
  readonly accountId: string;
  readonly accountRevision: number;
  readonly displayName: string;
  readonly growthPolicy: FriendlyPvpGrowthPolicy;
  readonly playerSlots: readonly PermanentRewardApplicableSlot[];
  readonly selectedBaseWeaponId: BaseWeaponId;
  readonly startingSupply: number;
  readonly baseHp: number;
  readonly unitCap: number;
  readonly supplyLevels: readonly SupplyLevelDefinition[];
}

const CHAPTER_ONE_FINAL_STAGE_ID = 'main_01_020';
const FRIENDLY_SLOT_COUNT = 10;

function selectedCharacterIds(snapshot: AccountSaveSnapshotV2): readonly string[] {
  if (snapshot.deckSlotIds.length < FRIENDLY_SLOT_COUNT) throw new Error('pvp_deck_requires_10_characters');
  const ids = snapshot.deckSlotIds.slice(0, FRIENDLY_SLOT_COUNT);
  if (new Set(ids).size !== ids.length) throw new Error('pvp_deck_contains_duplicate_character');
  const owned = new Set(getAccountOwnedCharacterIds(snapshot));
  for (const characterId of ids) if (!owned.has(characterId)) throw new Error(`pvp_deck_character_not_owned:${characterId}`);
  return ids;
}

function charactersForPolicy(
  snapshot: AccountSaveSnapshotV2,
  characterIds: readonly string[],
  growthPolicy: FriendlyPvpGrowthPolicy,
) {
  return characterIds.map((characterId) => {
    const progress = snapshot.characterProgressById[characterId];
    if (!progress) throw new Error(`friendly_pvp_character_progress_missing:${characterId}`);
    if (progress.selectedFormId !== undefined && !progress.unlockedFormIds.includes(progress.selectedFormId)) {
      throw new Error(`friendly_pvp_selected_form_locked:${characterId}:${progress.selectedFormId}`);
    }
    return {
      characterId,
      level: growthPolicy === 'STANDARDIZED' ? PVP_STANDARDIZATION.baseLevel : progress.level,
      plusLevel: growthPolicy === 'STANDARDIZED' ? PVP_STANDARDIZATION.plusLevel : progress.plusLevel,
      ...(progress.selectedFormId === undefined ? {} : { selectedFormId: progress.selectedFormId }),
    };
  });
}

function resolveTenSlots(
  snapshot: AccountSaveSnapshotV2,
  growthPolicy: FriendlyPvpGrowthPolicy,
): readonly PermanentRewardApplicableSlot[] {
  const characters = charactersForPolicy(snapshot, selectedCharacterIds(snapshot), growthPolicy);
  const slots: PermanentRewardApplicableSlot[] = [];
  for (let index = 0; index < characters.length; index += 5) {
    const resolved = getServerCoopLoadout({
      characters: characters.slice(index, index + 5),
      permanentRewardIds: growthPolicy === 'ACTUAL' ? snapshot.permanentRewardIds : [],
      clearedStageIds: snapshot.clearedStageIds,
    });
    slots.push(...resolved.playerSlots);
  }
  if (slots.length !== FRIENDLY_SLOT_COUNT) throw new Error('friendly_pvp_roster_resolution_failed');
  return slots;
}

export function parseFriendlyPvpGrowthPolicy(value: unknown): FriendlyPvpGrowthPolicy | null {
  return value === 'STANDARDIZED' || value === 'ACTUAL' ? value : null;
}

export async function getAccountFriendlyPvpAuthority(
  db: D1Database,
  rawAccountId: string,
  growthPolicy: FriendlyPvpGrowthPolicy,
  nowMs = Date.now(),
): Promise<AccountFriendlyPvpAuthority> {
  const accountId = rawAccountId.trim();
  if (!accountId) throw new Error('friendly_pvp_account_required');
  const record = await initializeAccountSave(db, accountId, undefined, nowMs);
  const social = await ensureSocialProfile(db, accountId);
  if (!record.snapshot.clearedStageIds.includes(CHAPTER_ONE_FINAL_STAGE_ID)) throw new Error('pvp_chapter_1_required');
  if (getAccountOwnedCharacterIds(record.snapshot).length < FRIENDLY_SLOT_COUNT) throw new Error('pvp_requires_10_owned_characters');
  const baseWeaponId = record.snapshot.selectedBaseWeaponId;
  if (!isServerCoopBaseWeaponUnlocked(baseWeaponId, record.snapshot.clearedStageIds)) {
    throw new Error(`pvp_base_weapon_locked:${baseWeaponId}`);
  }

  const slots = resolveTenSlots(record.snapshot, growthPolicy);
  const progression = applyPermanentRewardBattleEffects({
    ownedRewardIds: growthPolicy === 'ACTUAL' ? record.snapshot.permanentRewardIds : [],
    startingSupply: PVP_ARENA_DUEL_V1.startingSupplyPerPlayer,
    playerBaseHp: PVP_ARENA_DUEL_V1.baseHp,
    playerUnitCap: PVP_ARENA_DUEL_V1.unitCapPerSide,
    playerSlots: slots,
    enemies: [],
  }, SERVER_PERMANENT_REWARDS);

  return {
    accountId,
    accountRevision: record.revision,
    displayName: social.display_name,
    growthPolicy,
    playerSlots: progression.playerSlots,
    selectedBaseWeaponId: baseWeaponId,
    startingSupply: progression.startingSupply,
    baseHp: progression.playerBaseHp,
    unitCap: progression.playerUnitCap,
    supplyLevels: progression.supplyLevels,
  };
}

export async function assertFriendlyPvpPairAllowed(db: D1Database, hostAccountId: string, guestAccountId: string): Promise<void> {
  if (hostAccountId === guestAccountId) throw new Error('friendly_pvp_self_join');
  if (await isEitherSocialBlocked(db, hostAccountId, guestAccountId)) throw new Error('friendly_pvp_blocked');
}

export async function createFriendlyPvpDatabaseMatch(
  db: D1Database,
  matchId: string,
  hostAccountId: string,
  guestAccountId: string,
  nowMs = Date.now(),
): Promise<void> {
  const existing = await loadPvpMatch(db, matchId);
  if (existing) {
    if (existing.mode_id !== 'pvp_friendly_1v1') throw new Error('friendly_pvp_match_id_collision');
    const participants = await loadPvpMatchParticipants(db, matchId);
    const host = participants.find((entry) => entry.team_id === 'A' && entry.seat_index === 0)?.user_id;
    const guest = participants.find((entry) => entry.team_id === 'B' && entry.seat_index === 0)?.user_id;
    if (host === hostAccountId && guest === guestAccountId) return;
    throw new Error('friendly_pvp_match_participant_conflict');
  }
  const now = Math.floor(nowMs / 1000);
  const writes = await db.batch([
    db.prepare(
      `INSERT INTO pvp_matches (match_id, mode_id, season_id, state, result, created_at, started_at, completed_at)
       VALUES (?1, 'pvp_friendly_1v1', 'friendly', 'CREATED', NULL, ?2, NULL, NULL)`,
    ).bind(matchId, now),
    db.prepare(
      `INSERT INTO pvp_match_participants (match_id, user_id, team_id, seat_index, mmr_before, mmr_after)
       VALUES (?1, ?2, 'A', 0, NULL, NULL)`,
    ).bind(matchId, hostAccountId),
    db.prepare(
      `INSERT INTO pvp_match_participants (match_id, user_id, team_id, seat_index, mmr_before, mmr_after)
       VALUES (?1, ?2, 'B', 0, NULL, NULL)`,
    ).bind(matchId, guestAccountId),
  ]);
  if (writes.some((write) => (write.meta.changes ?? 0) !== 1)) throw new Error('friendly_pvp_match_create_failed');
}

export async function settleFriendlyPvpMatch(
  db: D1Database,
  matchId: string,
  result: PvpTimedResult,
  nowMs = Date.now(),
): Promise<void> {
  const match = await loadPvpMatch(db, matchId);
  if (!match) throw new Error('friendly_pvp_match_not_found');
  if (match.mode_id !== 'pvp_friendly_1v1') throw new Error('friendly_pvp_match_mode_invalid');
  const freshlyCompleted = match.state !== 'COMPLETED';
  if (freshlyCompleted) {
    if (match.state !== 'CREATED' && match.state !== 'ACTIVE') throw new Error('friendly_pvp_match_not_completable');
    const write = await db.prepare(
      `UPDATE pvp_matches SET state = 'COMPLETED', result = ?1, completed_at = ?2
       WHERE match_id = ?3 AND state IN ('CREATED','ACTIVE')`,
    ).bind(result, Math.floor(nowMs / 1000), matchId).run();
    if ((write.meta.changes ?? 0) !== 1) throw new Error('friendly_pvp_result_conflict');
  }
  const participants = await loadPvpMatchParticipants(db, matchId);
  const ids = participants.map((entry) => entry.user_id);
  await Promise.all(ids.map((accountId) => recordAccountAchievementFact(db, accountId, 'pvp_first_friendly', nowMs)));
  if (freshlyCompleted && ids.length === 2) {
    await recordRecentCoopPlayers(db, ids[0]!, ids[1]!, matchId, 'PvP 1v1 친선전').catch(() => undefined);
  }
}

export async function voidFriendlyPvpMatch(db: D1Database, matchId: string, nowMs = Date.now()): Promise<void> {
  const match = await loadPvpMatch(db, matchId);
  if (!match) return;
  if (match.mode_id !== 'pvp_friendly_1v1') throw new Error('friendly_pvp_match_mode_invalid');
  if (match.state === 'COMPLETED' || match.state === 'VOID') return;
  await db.prepare(
    `UPDATE pvp_matches SET state = 'VOID', completed_at = ?1 WHERE match_id = ?2 AND state IN ('CREATED','ACTIVE')`,
  ).bind(Math.floor(nowMs / 1000), matchId).run();
}

export const __friendlyPvpAuthorityTestOnly = {
  selectedCharacterIds,
  charactersForPolicy,
  resolveTenSlots,
};
