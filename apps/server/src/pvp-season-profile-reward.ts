import { grantAccountProfileCosmetics } from './account-profile-authority.ts';
import type { PvpSeasonHonor, PvpSeasonHonorId } from './pvp-season-authority.ts';

export const PVP_SEASON_HONOR_COSMETIC_IDS: Readonly<Record<PvpSeasonHonorId, string>> = {
  SEASON_GOLD_EMBLEM: 'emblem_pvp_season_gold',
  SEASON_PLATINUM_FRAME: 'frame_pvp_season_platinum',
  SEASON_MASTER_TITLE: 'title_pvp_season_master',
  SEASON_TOP_1000_BANNER: 'banner_pvp_season_top1000',
  SEASON_TOP_100_EMBLEM: 'emblem_pvp_season_top100',
  SEASON_TOP_10_HONOR: 'badge_pvp_season_top10',
};

export function resolvePvpSeasonHonorCosmeticIds(honors: readonly PvpSeasonHonor[]): readonly string[] {
  return [...new Set(honors.map((honor) => PVP_SEASON_HONOR_COSMETIC_IDS[honor.id]))];
}

export async function grantPvpSeasonHonorProfileCosmetics(
  db: D1Database,
  accountId: string,
  honors: readonly PvpSeasonHonor[],
  nowMs = Date.now(),
): Promise<{
  readonly cosmeticIds: readonly string[];
  readonly newlyGrantedCosmeticIds: readonly string[];
  readonly profileRevision: number;
}> {
  const cosmeticIds = resolvePvpSeasonHonorCosmeticIds(honors);
  const grant = await grantAccountProfileCosmetics(db, accountId, cosmeticIds, nowMs);
  return {
    cosmeticIds,
    newlyGrantedCosmeticIds: grant.grantedIds,
    profileRevision: grant.record.revision,
  };
}
