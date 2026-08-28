import { normalizeCharacterPlusLevel } from './character-growth';
import type {
  RecruitmentBanner,
  RecruitmentPullResult,
  RecruitmentRandomSource,
} from './recruitment';
import {
  performGuestRecruitment,
  recordGuestCharacterPlusLevel,
  type GuestProgress,
  type GuestRecruitmentResult,
} from './save';

export interface DuplicatePlusLevelApplication {
  readonly pullIndex: number;
  readonly characterId: string;
  readonly targetPlusLevel: number;
}

export interface RecruitmentPullGrowthResult extends RecruitmentPullResult {
  readonly plusLevelAfter?: number;
}

export interface GuestRecruitmentGrowthResult extends Omit<GuestRecruitmentResult, 'results'> {
  readonly results: readonly RecruitmentPullGrowthResult[];
}

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

export async function performGuestRecruitmentWithDuplicateGrowth(
  count: number,
  rng: RecruitmentRandomSource,
  banner: RecruitmentBanner,
): Promise<GuestRecruitmentGrowthResult> {
  const recruited = await performGuestRecruitment(count, rng, banner);
  const applications = planDuplicatePlusLevelApplications(recruited.guestProgress, recruited.results);
  let progress = recruited.guestProgress;
  let persisted = recruited.persisted;
  const plusLevelAfterByPull = new Map<number, number>();

  for (const application of applications) {
    const current = progress.characterProgressById?.[application.characterId];
    if (!current) throw new Error(`Recruitment growth record disappeared: ${application.characterId}`);
    if (application.targetPlusLevel > current.plusLevel) {
      const growth = await recordGuestCharacterPlusLevel(application.characterId, application.targetPlusLevel);
      progress = growth.guestProgress;
      persisted = persisted && growth.persisted;
    }
    plusLevelAfterByPull.set(application.pullIndex, application.targetPlusLevel);
  }

  const results: RecruitmentPullGrowthResult[] = recruited.results.map((pull, pullIndex) => {
    const plusLevelAfter = plusLevelAfterByPull.get(pullIndex);
    return plusLevelAfter === undefined ? pull : { ...pull, plusLevelAfter };
  });

  return {
    ...recruited,
    results,
    persisted,
    guestProgress: progress,
  };
}
