import {
  PVP_STANDARDIZATION,
  getPvpMode,
  getPvpRankedEligibilityFailure,
  type PvpModeId,
  type PvpRankedEligibilityFailure,
} from '@frontline/sim/pvp-content';
import type { PlayerRosterSlot, BaseWeaponId } from '@frontline/sim/playable';
import { initializeAccountSave, type AccountSaveSnapshotV2 } from './account-save-authority.ts';
import { getAccountOwnedCharacterIds } from './progression-authority.ts';
import {
  getServerCoopLoadout,
  isServerCoopBaseWeaponUnlocked,
} from './runtime-content.ts';
import { ensureSocialProfile } from './social-authority.ts';

const CHAPTER_ONE_FINAL_STAGE_ID = 'main_01_020';

export interface AccountPvpSeatAuthority {
  readonly accountId: string;
  readonly accountRevision: number;
  readonly modeId: PvpModeId;
  readonly displayName: string;
  readonly playerSlots: readonly PlayerRosterSlot[];
  readonly selectedBaseWeaponId: BaseWeaponId;
  readonly standardized: true;
  readonly standardizedLevel: number;
  readonly standardizedPlusLevel: number;
}

export interface AccountPvpEligibility {
  readonly eligible: boolean;
  readonly failure: PvpRankedEligibilityFailure | null;
  readonly chapter1Complete: boolean;
  readonly ownedCharacterCount: number;
  readonly deckSize: number;
  readonly displayName: string;
}

function standardizedCharacters(
  snapshot: AccountSaveSnapshotV2,
  characterIds: readonly string[],
) {
  return characterIds.map((characterId) => {
    const progress = snapshot.characterProgressById[characterId];
    if (!progress) throw new Error(`pvp deck character has no progress:${characterId}`);
    const selectedFormId = progress.selectedFormId;
    if (selectedFormId !== undefined && !progress.unlockedFormIds.includes(selectedFormId)) {
      throw new Error(`pvp selected form is not unlocked:${characterId}:${selectedFormId}`);
    }
    return {
      characterId,
      level: PVP_STANDARDIZATION.baseLevel,
      plusLevel: PVP_STANDARDIZATION.plusLevel,
      ...(selectedFormId === undefined ? {} : { selectedFormId }),
    };
  });
}

function splitForServerResolver<T>(values: readonly T[]): readonly (readonly T[])[] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += 5) chunks.push(values.slice(index, index + 5));
  return chunks;
}

function buildStandardizedSlots(
  snapshot: AccountSaveSnapshotV2,
  requiredSlots: 5 | 10,
): readonly PlayerRosterSlot[] {
  if (snapshot.deckSlotIds.length < requiredSlots) {
    throw new Error(`pvp_deck_requires_${requiredSlots}_characters`);
  }
  const selectedIds = snapshot.deckSlotIds.slice(0, requiredSlots);
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error('pvp_deck_contains_duplicate_character');
  const owned = new Set(getAccountOwnedCharacterIds(snapshot));
  for (const characterId of selectedIds) {
    if (!owned.has(characterId)) throw new Error(`pvp_deck_character_not_owned:${characterId}`);
  }
  const characters = standardizedCharacters(snapshot, selectedIds);
  const slots: PlayerRosterSlot[] = [];
  for (const chunk of splitForServerResolver(characters)) {
    const resolved = getServerCoopLoadout({
      characters: chunk,
      // Public PvP standardization deliberately removes account permanent combat rewards.
      permanentRewardIds: [],
      clearedStageIds: snapshot.clearedStageIds,
    });
    slots.push(...resolved.playerSlots);
  }
  if (slots.length !== requiredSlots) throw new Error('pvp_standardized_roster_resolution_failed');
  return slots;
}

async function buildStandardizedSeatAuthority(
  db: D1Database,
  accountId: string,
  modeId: PvpModeId,
  requiredSlots: 5 | 10,
  nowMs: number,
): Promise<AccountPvpSeatAuthority> {
  const record = await initializeAccountSave(db, accountId, undefined, nowMs);
  const social = await ensureSocialProfile(db, accountId);
  const ownedCharacterCount = getAccountOwnedCharacterIds(record.snapshot).length;
  const chapter1Complete = record.snapshot.clearedStageIds.includes(CHAPTER_ONE_FINAL_STAGE_ID);
  if (!chapter1Complete) throw new Error('pvp_chapter_1_required');
  if (ownedCharacterCount < requiredSlots) throw new Error(`pvp_requires_${requiredSlots}_owned_characters`);
  if (record.snapshot.deckSlotIds.length < requiredSlots) throw new Error(`pvp_deck_requires_${requiredSlots}_characters`);
  const baseWeaponId = record.snapshot.selectedBaseWeaponId;
  if (!isServerCoopBaseWeaponUnlocked(baseWeaponId, record.snapshot.clearedStageIds)) {
    throw new Error(`pvp_base_weapon_locked:${baseWeaponId}`);
  }
  return {
    accountId,
    accountRevision: record.revision,
    modeId,
    displayName: social.display_name,
    playerSlots: buildStandardizedSlots(record.snapshot, requiredSlots),
    selectedBaseWeaponId: baseWeaponId,
    standardized: true,
    standardizedLevel: PVP_STANDARDIZATION.baseLevel,
    standardizedPlusLevel: PVP_STANDARDIZATION.plusLevel,
  };
}

export async function getAccountPvpEligibility(
  db: D1Database,
  accountId: string,
  nowMs = Date.now(),
): Promise<AccountPvpEligibility> {
  const record = await initializeAccountSave(db, accountId, undefined, nowMs);
  const social = await ensureSocialProfile(db, accountId);
  const ownedCharacterCount = getAccountOwnedCharacterIds(record.snapshot).length;
  const chapter1Complete = record.snapshot.clearedStageIds.includes(CHAPTER_ONE_FINAL_STAGE_ID);
  const failure = getPvpRankedEligibilityFailure({
    chapter1Complete,
    ownedCharacterCount,
    hasValidTenSlotDeck: record.snapshot.deckSlotIds.length === 10,
    hasPersistentAccount: true,
    // The current social authority always gives persistent accounts a valid public display name.
    displayNameConfigured: social.display_name.trim().length > 0,
  });
  return {
    eligible: failure === null,
    failure,
    chapter1Complete,
    ownedCharacterCount,
    deckSize: record.snapshot.deckSlotIds.length,
    displayName: social.display_name,
  };
}

export async function getAccountPvpSeatAuthority(
  db: D1Database,
  accountId: string,
  modeId: PvpModeId,
  nowMs = Date.now(),
): Promise<AccountPvpSeatAuthority> {
  const mode = getPvpMode(modeId);
  if (mode.growthPolicy !== 'STANDARDIZED') throw new Error('pvp_mode_requires_friendly_growth_choice');
  if (mode.ranked) {
    const record = await initializeAccountSave(db, accountId, undefined, nowMs);
    const social = await ensureSocialProfile(db, accountId);
    const ownedCharacterCount = getAccountOwnedCharacterIds(record.snapshot).length;
    const chapter1Complete = record.snapshot.clearedStageIds.includes(CHAPTER_ONE_FINAL_STAGE_ID);
    const failure = getPvpRankedEligibilityFailure({
      chapter1Complete,
      ownedCharacterCount,
      hasValidTenSlotDeck: record.snapshot.deckSlotIds.length === 10,
      hasPersistentAccount: true,
      displayNameConfigured: social.display_name.trim().length > 0,
    });
    if (failure) throw new Error(`pvp_ranked_ineligible:${failure}`);
  }
  return buildStandardizedSeatAuthority(db, accountId, modeId, mode.slotsPerPlayer, nowMs);
}

/**
 * Friendly 2v2 initially ships on the same Lv50/+0 standardization as public 2v2.
 * The design keeps ACTUAL as an optional future room rule, but the first live team
 * friendly path must not silently inherit account permanent combat bonuses.
 */
export async function getAccountFriendlyPvp2v2SeatAuthority(
  db: D1Database,
  accountId: string,
  nowMs = Date.now(),
): Promise<AccountPvpSeatAuthority> {
  return buildStandardizedSeatAuthority(db, accountId, 'pvp_friendly_2v2', 5, nowMs);
}

export const __accountPvpTestOnly = {
  buildStandardizedSlots,
  standardizedCharacters,
};
