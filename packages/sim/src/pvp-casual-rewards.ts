export const PVP_CASUAL_REWARDED_MATCHES_PER_UTC_DAY = 3;
export const PVP_CASUAL_PARTICIPATION_GOLD = 300;
export const PVP_CASUAL_WIN_BONUS_GOLD = 150;

export type PvpCasualRewardModeId = 'pvp_casual_1v1' | 'pvp_casual_2v2';

/**
 * v1 DESIGN_TARGET: casual PvP itself is unlimited. Only the repeatable Gold reward
 * is capped so casual PvP does not become a farming optimum. The first three completed
 * casual matches across 1v1/2v2 share one UTC-day Gold allowance; after that players may
 * keep matchmaking and playing normally, but those extra matches grant 0 casual Gold.
 * Friendly/ranked modes never consume this Gold allowance.
 */
export const PVP_CASUAL_DAILY_REWARD = {
  playLimitPerUtcDay: null,
  rewardedMatchesPerUtcDay: PVP_CASUAL_REWARDED_MATCHES_PER_UTC_DAY,
  participationGold: PVP_CASUAL_PARTICIPATION_GOLD,
  winBonusGold: PVP_CASUAL_WIN_BONUS_GOLD,
} as const;

export function getPvpCasualRewardDayKey(timeMs: number): string {
  if (!Number.isFinite(timeMs) || timeMs < 0) throw new Error('casual PvP reward time must be non-negative');
  return new Date(timeMs).toISOString().slice(0, 10);
}

export function getPvpCasualRewardGold(won: boolean): number {
  return PVP_CASUAL_PARTICIPATION_GOLD + (won ? PVP_CASUAL_WIN_BONUS_GOLD : 0);
}
