import { SIM_TICK_RATE } from '@frontline/shared';

/**
 * Shared v1 PvP rules. These values mirror the current DESIGN_TARGET wiki and are
 * intentionally centralized so client/server/runtime code does not grow separate
 * copies of rating, queue, timeout, or standardization constants.
 */

export const PVP_MODE_IDS = [
  'pvp_casual_1v1',
  'pvp_ranked_1v1',
  'pvp_friendly_1v1',
  'pvp_casual_2v2',
  'pvp_friendly_2v2',
] as const;
export type PvpModeId = (typeof PVP_MODE_IDS)[number];
export type PvpQueueKind = 'PUBLIC' | 'FRIENDLY';
export type PvpGrowthPolicy = 'STANDARDIZED' | 'ACTUAL_OPTIONAL';

export interface PvpModeDefinition {
  readonly id: PvpModeId;
  readonly displayName: string;
  readonly teamSize: 1 | 2;
  readonly slotsPerPlayer: 5 | 10;
  readonly queueKind: PvpQueueKind;
  readonly ranked: boolean;
  readonly ratingChanges: boolean;
  readonly growthPolicy: PvpGrowthPolicy;
  readonly rewardPolicy: 'CASUAL_SMALL' | 'RANKED' | 'NONE';
}

export const PVP_MODES: readonly PvpModeDefinition[] = [
  {
    id: 'pvp_casual_1v1',
    displayName: '1v1 일반전',
    teamSize: 1,
    slotsPerPlayer: 10,
    queueKind: 'PUBLIC',
    ranked: false,
    ratingChanges: false,
    growthPolicy: 'STANDARDIZED',
    rewardPolicy: 'CASUAL_SMALL',
  },
  {
    id: 'pvp_ranked_1v1',
    displayName: '1v1 랭킹전',
    teamSize: 1,
    slotsPerPlayer: 10,
    queueKind: 'PUBLIC',
    ranked: true,
    ratingChanges: true,
    growthPolicy: 'STANDARDIZED',
    rewardPolicy: 'RANKED',
  },
  {
    id: 'pvp_friendly_1v1',
    displayName: '1v1 친선전',
    teamSize: 1,
    slotsPerPlayer: 10,
    queueKind: 'FRIENDLY',
    ranked: false,
    ratingChanges: false,
    growthPolicy: 'ACTUAL_OPTIONAL',
    rewardPolicy: 'NONE',
  },
  {
    id: 'pvp_casual_2v2',
    displayName: '2v2 일반전',
    teamSize: 2,
    slotsPerPlayer: 5,
    queueKind: 'PUBLIC',
    ranked: false,
    ratingChanges: false,
    growthPolicy: 'STANDARDIZED',
    rewardPolicy: 'CASUAL_SMALL',
  },
  {
    id: 'pvp_friendly_2v2',
    displayName: '2v2 친선전',
    teamSize: 2,
    slotsPerPlayer: 5,
    queueKind: 'FRIENDLY',
    ranked: false,
    ratingChanges: false,
    growthPolicy: 'ACTUAL_OPTIONAL',
    rewardPolicy: 'NONE',
  },
] as const;

export function getPvpMode(id: PvpModeId): PvpModeDefinition {
  const mode = PVP_MODES.find((candidate) => candidate.id === id);
  if (!mode) throw new Error(`unknown pvp mode:${id}`);
  return mode;
}

export const PVP_STANDARDIZATION = {
  baseLevel: 50,
  plusLevel: 0,
  permanentCombatRewardsEnabled: false,
  actualOwnershipRequired: true,
  actualFormUnlockRequired: true,
  baseWeaponUsesCanonicalStats: true,
} as const;

export const PVP_MATCH_TARGET_MINUTES = { minimum: 2.5, maximum: 5 } as const;
export const PVP_MATCH_TIME_LIMIT_FRAMES = 8 * 60 * SIM_TICK_RATE;
export const PVP_RECONNECT_GRACE_FRAMES = 20 * SIM_TICK_RATE;

export type PvpBattleSide = 'A' | 'B';
export type PvpTimedResult = PvpBattleSide | 'DRAW';

export interface PvpTimedResultInput {
  readonly aBaseHp: number;
  readonly aBaseMaxHp: number;
  readonly bBaseHp: number;
  readonly bBaseMaxHp: number;
  /** Total damage dealt to the opposing base during the match. */
  readonly aBaseDamageDealt: number;
  readonly bBaseDamageDealt: number;
}

function validHp(current: number, maximum: number, context: string): void {
  if (!Number.isInteger(maximum) || maximum <= 0) throw new Error(`${context}.maxHp must be positive`);
  if (!Number.isInteger(current) || current < 0 || current > maximum) throw new Error(`${context}.hp must be in 0..maxHp`);
}

/**
 * Canonical 8-minute anti-stall decision:
 * 1) surviving base HP ratio, 2) cumulative opposing-base damage, 3) draw.
 * Cross multiplication keeps the HP-ratio comparison deterministic.
 */
export function resolvePvpTimedResult(input: PvpTimedResultInput): PvpTimedResult {
  validHp(input.aBaseHp, input.aBaseMaxHp, 'A');
  validHp(input.bBaseHp, input.bBaseMaxHp, 'B');
  if (!Number.isInteger(input.aBaseDamageDealt) || input.aBaseDamageDealt < 0) throw new Error('aBaseDamageDealt must be non-negative');
  if (!Number.isInteger(input.bBaseDamageDealt) || input.bBaseDamageDealt < 0) throw new Error('bBaseDamageDealt must be non-negative');
  const ratioLeft = input.aBaseHp * input.bBaseMaxHp;
  const ratioRight = input.bBaseHp * input.aBaseMaxHp;
  if (ratioLeft > ratioRight) return 'A';
  if (ratioRight > ratioLeft) return 'B';
  if (input.aBaseDamageDealt > input.bBaseDamageDealt) return 'A';
  if (input.bBaseDamageDealt > input.aBaseDamageDealt) return 'B';
  return 'DRAW';
}

export const PVP_TIER_IDS = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'FRONTLINE_APEX',
] as const;
export type PvpTierId = (typeof PVP_TIER_IDS)[number];

export interface PvpTierDefinition {
  readonly id: PvpTierId;
  readonly displayName: string;
  readonly minMmr: number;
  /** MMR below this value demotes from this tier after the tier has been reached. */
  readonly demotionBelowMmr: number;
}

export const PVP_TIERS: readonly PvpTierDefinition[] = [
  { id: 'BRONZE', displayName: '브론즈', minMmr: 0, demotionBelowMmr: 0 },
  { id: 'SILVER', displayName: '실버', minMmr: 900, demotionBelowMmr: 885 },
  { id: 'GOLD', displayName: '골드', minMmr: 1050, demotionBelowMmr: 1035 },
  { id: 'PLATINUM', displayName: '플래티넘', minMmr: 1200, demotionBelowMmr: 1185 },
  { id: 'DIAMOND', displayName: '다이아', minMmr: 1400, demotionBelowMmr: 1385 },
  { id: 'MASTER', displayName: '마스터', minMmr: 1600, demotionBelowMmr: 1585 },
  { id: 'GRANDMASTER', displayName: '그랜드마스터', minMmr: 1800, demotionBelowMmr: 1785 },
  { id: 'FRONTLINE_APEX', displayName: '전선 최상위', minMmr: 2000, demotionBelowMmr: 1985 },
] as const;

export const PVP_INITIAL_MMR = 1000;
export const PVP_PLACEMENT_MATCH_COUNT = 5;
export const PVP_PLACEMENT_VISIBLE_TIER_CAP: PvpTierId = 'PLATINUM';

export function getPvpTierForMmr(mmr: number): PvpTierDefinition {
  if (!Number.isFinite(mmr)) throw new Error('mmr must be finite');
  const normalized = Math.max(0, Math.round(mmr));
  let result = PVP_TIERS[0]!;
  for (const tier of PVP_TIERS) {
    if (normalized >= tier.minMmr) result = tier;
    else break;
  }
  return result;
}

export function getPlacementVisibleTier(mmr: number): PvpTierDefinition {
  const tier = getPvpTierForMmr(mmr);
  const capIndex = PVP_TIERS.findIndex((candidate) => candidate.id === PVP_PLACEMENT_VISIBLE_TIER_CAP);
  const tierIndex = PVP_TIERS.findIndex((candidate) => candidate.id === tier.id);
  return PVP_TIERS[Math.min(tierIndex, capIndex)]!;
}

export function resolveDisplayedTier(previousTierId: PvpTierId, mmr: number): PvpTierDefinition {
  const previousIndex = PVP_TIERS.findIndex((candidate) => candidate.id === previousTierId);
  if (previousIndex < 0) throw new Error(`unknown previous tier:${previousTierId}`);
  const normalized = Math.max(0, Math.round(mmr));
  const natural = getPvpTierForMmr(normalized);
  const naturalIndex = PVP_TIERS.findIndex((candidate) => candidate.id === natural.id);
  if (naturalIndex >= previousIndex) return natural;
  let index = previousIndex;
  while (index > naturalIndex && normalized < PVP_TIERS[index]!.demotionBelowMmr) index -= 1;
  return PVP_TIERS[index]!;
}

export type PvpScore = 0 | 0.5 | 1;

export function getPvpExpectedScore(playerMmr: number, opponentMmr: number): number {
  if (!Number.isFinite(playerMmr) || !Number.isFinite(opponentMmr)) throw new Error('MMR values must be finite');
  return 1 / (1 + 10 ** ((opponentMmr - playerMmr) / 400));
}

export function getPvpKFactor(mmr: number, placementMatchesPlayed: number): number {
  if (!Number.isInteger(placementMatchesPlayed) || placementMatchesPlayed < 0) throw new Error('placementMatchesPlayed must be non-negative');
  if (placementMatchesPlayed < PVP_PLACEMENT_MATCH_COUNT) return 48;
  if (mmr < 1400) return 32;
  if (mmr < 1800) return 26;
  return 20;
}

export interface PvpMmrUpdate {
  readonly oldMmr: number;
  readonly newMmr: number;
  readonly delta: number;
  readonly expectedScore: number;
  readonly kFactor: number;
}

export function updatePvpMmr(
  playerMmr: number,
  opponentMmr: number,
  score: PvpScore,
  placementMatchesPlayed: number,
): PvpMmrUpdate {
  const oldMmr = Math.max(0, Math.round(playerMmr));
  const expectedScore = getPvpExpectedScore(oldMmr, Math.max(0, Math.round(opponentMmr)));
  const kFactor = getPvpKFactor(oldMmr, placementMatchesPlayed);
  const newMmr = Math.max(0, Math.round(oldMmr + kFactor * (score - expectedScore)));
  return { oldMmr, newMmr, delta: newMmr - oldMmr, expectedScore, kFactor };
}

export interface PvpMatchmakingWindow {
  readonly afterSeconds: number;
  readonly radiusMmr: number;
}

export const PVP_MATCHMAKING_WINDOWS: readonly PvpMatchmakingWindow[] = [
  { afterSeconds: 0, radiusMmr: 100 },
  { afterSeconds: 15, radiusMmr: 180 },
  { afterSeconds: 30, radiusMmr: 280 },
  { afterSeconds: 60, radiusMmr: 400 },
] as const;

export function getPvpMatchmakingRadius(waitSeconds: number): number {
  if (!Number.isFinite(waitSeconds) || waitSeconds < 0) return PVP_MATCHMAKING_WINDOWS[0]!.radiusMmr;
  let radius = PVP_MATCHMAKING_WINDOWS[0]!.radiusMmr;
  for (const window of PVP_MATCHMAKING_WINDOWS) {
    if (waitSeconds >= window.afterSeconds) radius = window.radiusMmr;
    else break;
  }
  return radius;
}

export const PVP_SEASON_ACTIVE_WEEKS = 6;
export const PVP_SEASON_SETTLEMENT_DAYS = 3;

export function softResetPvpMmr(previousMmr: number): number {
  if (!Number.isFinite(previousMmr)) throw new Error('previousMmr must be finite');
  return Math.max(800, Math.min(1750, Math.round(1000 + (previousMmr - 1000) * 0.6)));
}

export type PvpRewardCurrency =
  | 'gold'
  | 'summon_crystal'
  | 'soul_essence'
  | 'evo_fragment'
  | 'evo_core'
  | 'evo_crown';

export interface PvpTierFirstReachReward {
  readonly tierId: Exclude<PvpTierId, 'BRONZE'>;
  readonly currencies: Readonly<Partial<Record<PvpRewardCurrency, number>>>;
  readonly cosmeticDesignNote?: string;
}

/** Economy quantities remain DESIGN_TARGET until human economy QA. */
export const PVP_TIER_FIRST_REACH_REWARDS: readonly PvpTierFirstReachReward[] = [
  { tierId: 'SILVER', currencies: { gold: 5000, summon_crystal: 100, soul_essence: 40 } },
  { tierId: 'GOLD', currencies: { gold: 10000, summon_crystal: 200, soul_essence: 80, evo_fragment: 8 }, cosmeticDesignNote: '칭호' },
  { tierId: 'PLATINUM', currencies: { gold: 18000, summon_crystal: 300, soul_essence: 140, evo_fragment: 15 }, cosmeticDesignNote: '테두리' },
  { tierId: 'DIAMOND', currencies: { gold: 30000, summon_crystal: 500, soul_essence: 240, evo_core: 2 }, cosmeticDesignNote: '칭호+테두리' },
  { tierId: 'MASTER', currencies: { gold: 45000, summon_crystal: 700, soul_essence: 360, evo_core: 3 }, cosmeticDesignNote: '프로필 배너' },
  { tierId: 'GRANDMASTER', currencies: { gold: 60000, summon_crystal: 900, soul_essence: 500, evo_crown: 1 }, cosmeticDesignNote: '전용 문장' },
  { tierId: 'FRONTLINE_APEX', currencies: { gold: 80000, summon_crystal: 1200, soul_essence: 700, evo_crown: 1 }, cosmeticDesignNote: '최상위 테두리' },
] as const;

export function getPvpFirstReachRewardsBetween(previousBestMmr: number, nextBestMmr: number): readonly PvpTierFirstReachReward[] {
  const previous = Math.max(0, Math.round(previousBestMmr));
  const next = Math.max(previous, Math.round(nextBestMmr));
  return PVP_TIER_FIRST_REACH_REWARDS.filter((reward) => {
    const threshold = PVP_TIERS.find((tier) => tier.id === reward.tierId)!.minMmr;
    return previous < threshold && next >= threshold;
  });
}

export interface PvpRankedResultSummary {
  readonly a: PvpMmrUpdate;
  readonly b: PvpMmrUpdate;
  readonly aScore: PvpScore;
  readonly bScore: PvpScore;
}

export function resolveRankedPvpMmr(
  aMmr: number,
  bMmr: number,
  result: PvpTimedResult,
  aPlacementMatchesPlayed: number,
  bPlacementMatchesPlayed: number,
): PvpRankedResultSummary {
  const aScore: PvpScore = result === 'A' ? 1 : result === 'B' ? 0 : 0.5;
  const bScore: PvpScore = result === 'B' ? 1 : result === 'A' ? 0 : 0.5;
  return {
    a: updatePvpMmr(aMmr, bMmr, aScore, aPlacementMatchesPlayed),
    b: updatePvpMmr(bMmr, aMmr, bScore, bPlacementMatchesPlayed),
    aScore,
    bScore,
  };
}

export interface PvpRankedEligibilityInput {
  readonly chapter1Complete: boolean;
  readonly ownedCharacterCount: number;
  readonly hasValidTenSlotDeck: boolean;
  readonly hasPersistentAccount: boolean;
  readonly displayNameConfigured: boolean;
}

export type PvpRankedEligibilityFailure =
  | 'chapter_1_required'
  | 'ten_characters_required'
  | 'valid_deck_required'
  | 'persistent_account_required'
  | 'display_name_required';

export function getPvpRankedEligibilityFailure(input: PvpRankedEligibilityInput): PvpRankedEligibilityFailure | null {
  if (!input.chapter1Complete) return 'chapter_1_required';
  if (input.ownedCharacterCount < 10) return 'ten_characters_required';
  if (!input.hasValidTenSlotDeck) return 'valid_deck_required';
  if (!input.hasPersistentAccount) return 'persistent_account_required';
  if (!input.displayNameConfigured) return 'display_name_required';
  return null;
}
