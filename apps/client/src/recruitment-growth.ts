import type {
  RecruitmentBanner,
  RecruitmentPullResult,
  RecruitmentRandomSource,
} from './recruitment.ts';
import {
  performGuestRecruitment,
  type DuplicatePolicy,
  type GuestProgress,
  type GuestRecruitmentPullResult,
  type GuestRecruitmentResult,
} from './save.ts';
import { normalizeCharacterPlusLevel } from './character-growth.ts';

export interface DuplicatePlusLevelApplication {
  readonly pullIndex: number;
  readonly characterId: string;
  readonly targetPlusLevel: number;
}

export type RecruitmentPullGrowthResult = GuestRecruitmentPullResult;
export type GuestRecruitmentGrowthResult = GuestRecruitmentResult;

/**
 * Retained as a pure planning helper for tests/tools. Runtime recruitment now resolves
 * duplicate policy atomically inside save.ts together with summon-crystal spending.
 */
export function planDuplicatePlusLevelApplications(
  progress: GuestProgress,
  results: readonly RecruitmentPullResult[],
): readonly DuplicatePlusLevelApplication[] {
  const nextPlusByCharacter = new Map<string, number>();
  const applications: DuplicatePlusLevelApplication[] = [];

  results.forEach((pull, pullIndex) => {
    if (!pull.duplicate) return;
    const saved = progress.characterProgressById?.[pull.characterId];
    if (!saved) throw new Error(`Duplicate recruitment character has no growth record: ${pull.characterId}`);
    const current = nextPlusByCharacter.get(pull.characterId) ?? saved.plusLevel;
    const targetPlusLevel = normalizeCharacterPlusLevel(current + 1);
    nextPlusByCharacter.set(pull.characterId, targetPlusLevel);
    applications.push({ pullIndex, characterId: pull.characterId, targetPlusLevel });
  });

  return applications;
}

export function performGuestRecruitmentWithDuplicateGrowth(
  count: number,
  rng: RecruitmentRandomSource,
  banner: RecruitmentBanner,
  duplicatePolicy: DuplicatePolicy = 'APPLY_PLUS',
): Promise<GuestRecruitmentGrowthResult> {
  return performGuestRecruitment(count, rng, banner, duplicatePolicy);
}
