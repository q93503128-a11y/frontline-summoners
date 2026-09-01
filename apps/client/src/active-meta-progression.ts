import { META_RESOURCE_IDS, type ResourceAmounts } from '@frontline/sim/resource-ledger';
import type { BaseWeaponId } from '@frontline/sim/playable';
import {
  getAccountClientState,
  mutateAuthenticatedAccountMeta,
  mutateAuthenticatedAccountRecruitment,
} from './account-network.ts';
import { accountSnapshotToGuestProgress } from './active-progress.ts';
import type { RecruitmentBanner, RecruitmentRandomSource } from './recruitment.ts';
import {
  MAX_DECK_SLOTS,
  getGuestResourceBalance,
  getOwnedCharacterIds,
  performGuestRecruitment,
  recordGuestCharacterLevel,
  recordGuestCharacterPlusLevel,
  recordGuestDeck,
  recordGuestEvolutionUnlock,
  resetGuestDeckToAutomatic,
  selectGuestBaseWeapon,
  selectGuestEvolutionForm,
  type DuplicatePolicy,
  type GuestBaseWeaponResult,
  type GuestCharacterProgressResult,
  type GuestDeckResult,
  type GuestProgress,
  type GuestRecruitmentPullResult,
} from './save.ts';

export interface ActiveRecruitmentResult {
  readonly results: readonly GuestRecruitmentPullResult[];
  readonly duplicatePolicy: DuplicatePolicy;
  readonly spentResources: ResourceAmounts;
  readonly dismantledSoulEssence: number;
  readonly persisted: boolean;
  readonly guestProgress: GuestProgress;
}

export type ActiveRecruitmentPullResult = GuestRecruitmentPullResult;

type AccountOnlineState = Extract<ReturnType<typeof getAccountClientState>, { kind: 'AUTHENTICATED_ONLINE' }>;

type RecruitmentRarity = 'C' | 'B' | 'A' | 'S' | 'SS';
const RECRUITMENT_RARITIES = new Set<RecruitmentRarity>(['C', 'B', 'A', 'S', 'SS']);
let requestSequence = 0;

function nextRequestId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}:${uuid}`;
  requestSequence = (requestSequence + 1) % 0x7fffffff;
  return `${prefix}:${Date.now().toString(36)}:${requestSequence.toString(36)}`;
}

function accountOnlineState(): AccountOnlineState | null {
  const state = getAccountClientState();
  if (state.kind === 'GUEST_LOCAL') return null;
  if (state.kind !== 'AUTHENTICATED_ONLINE') {
    throw new Error('계정 진행 저장은 온라인 연결이 필요합니다. 연결을 확인한 뒤 다시 시도하세요.');
  }
  return state;
}

function accountProgress(state: AccountOnlineState): GuestProgress {
  return accountSnapshotToGuestProgress(state.remote.snapshot);
}

function mutationProgress(snapshot: Readonly<Record<string, unknown>>): GuestProgress {
  return accountSnapshotToGuestProgress(snapshot);
}

function spentBetween(before: GuestProgress, after: GuestProgress): ResourceAmounts {
  const spent: Partial<Record<(typeof META_RESOURCE_IDS)[number], number>> = {};
  for (const id of META_RESOURCE_IDS) {
    const beforeBalance = getGuestResourceBalance(before, id);
    const afterBalance = getGuestResourceBalance(after, id);
    if (beforeBalance > afterBalance) spent[id] = beforeBalance - afterBalance;
  }
  return spent;
}

function requireCharacterProgress(progress: GuestProgress, characterId: string) {
  const characterProgress = progress.characterProgressById?.[characterId];
  if (!characterProgress) throw new Error(`보유 동료의 성장 기록을 찾을 수 없습니다: ${characterId}`);
  return characterProgress;
}

function requireRecruitmentCount(count: number): 1 | 10 {
  if (count !== 1 && count !== 10) throw new Error('모집은 1회 또는 10회만 가능합니다.');
  return count;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`계정 모집 응답이 올바르지 않습니다: ${context}`);
  return value as number;
}

function parseAccountRecruitmentPull(value: unknown): GuestRecruitmentPullResult {
  if (!isRecord(value)) throw new Error('계정 모집 결과가 올바르지 않습니다.');
  const index = nonNegativeInteger(value.index, 'index');
  if (index < 1) throw new Error('계정 모집 결과 번호가 올바르지 않습니다.');
  if (typeof value.characterId !== 'string' || value.characterId.length === 0) throw new Error('계정 모집 캐릭터 정보가 올바르지 않습니다.');
  if (typeof value.rarity !== 'string' || !RECRUITMENT_RARITIES.has(value.rarity as RecruitmentRarity)) throw new Error('계정 모집 희귀도 정보가 올바르지 않습니다.');
  if (typeof value.duplicate !== 'boolean') throw new Error('계정 모집 중복 정보가 올바르지 않습니다.');

  const duplicateResolution = value.duplicateResolution;
  if (duplicateResolution !== undefined && duplicateResolution !== 'PLUS' && duplicateResolution !== 'DISMANTLE') {
    throw new Error('계정 모집 중복 처리 결과가 올바르지 않습니다.');
  }
  const plusLevelAfter = value.plusLevelAfter === undefined ? undefined : nonNegativeInteger(value.plusLevelAfter, 'plusLevelAfter');
  const dismantledSoulEssence = value.dismantledSoulEssence === undefined
    ? undefined
    : nonNegativeInteger(value.dismantledSoulEssence, 'dismantledSoulEssence');

  return {
    pullNumber: index,
    characterId: value.characterId,
    rarity: value.rarity as RecruitmentRarity,
    duplicate: value.duplicate,
    ...(duplicateResolution ? { duplicateResolution } : {}),
    ...(plusLevelAfter !== undefined ? { plusLevelAfter } : {}),
    ...(dismantledSoulEssence !== undefined ? { dismantledSoulEssence } : {}),
  };
}

function parseAccountRecruitmentResult(
  value: unknown,
  bannerId: string,
  count: 1 | 10,
  duplicatePolicy: DuplicatePolicy,
): { readonly results: readonly GuestRecruitmentPullResult[]; readonly dismantledSoulEssence: number } {
  if (!isRecord(value)) throw new Error('계정 모집 서버 응답이 올바르지 않습니다.');
  if (value.bannerId !== bannerId || value.count !== count || value.duplicatePolicy !== duplicatePolicy) {
    throw new Error('계정 모집 서버 응답이 요청과 일치하지 않습니다.');
  }
  if (!Array.isArray(value.results) || value.results.length !== count) throw new Error('계정 모집 결과 개수가 올바르지 않습니다.');
  const results = value.results.map(parseAccountRecruitmentPull);
  return {
    results,
    dismantledSoulEssence: nonNegativeInteger(value.dismantledSoulEssence, 'dismantledSoulEssence'),
  };
}

export async function recordActiveCharacterLevel(characterId: string, targetLevel: number): Promise<GuestCharacterProgressResult> {
  const state = accountOnlineState();
  if (!state) return recordGuestCharacterLevel(characterId, targetLevel);
  const before = accountProgress(state);
  const response = await mutateAuthenticatedAccountMeta({
    requestId: nextRequestId('character-level'),
    action: 'CHARACTER_LEVEL',
    characterId,
    targetLevel,
  });
  const progress = mutationProgress(response.snapshot);
  return {
    characterId,
    characterProgress: requireCharacterProgress(progress, characterId),
    spentResources: spentBetween(before, progress),
    persisted: true,
    guestProgress: progress,
  };
}

export async function recordActiveCharacterPlusLevel(characterId: string, targetPlusLevel: number): Promise<GuestCharacterProgressResult> {
  const state = accountOnlineState();
  if (!state) return recordGuestCharacterPlusLevel(characterId, targetPlusLevel);
  const before = accountProgress(state);
  const response = await mutateAuthenticatedAccountMeta({
    requestId: nextRequestId('character-plus'),
    action: 'CHARACTER_PLUS_LEVEL',
    characterId,
    targetPlusLevel,
  });
  const progress = mutationProgress(response.snapshot);
  return {
    characterId,
    characterProgress: requireCharacterProgress(progress, characterId),
    spentResources: spentBetween(before, progress),
    persisted: true,
    guestProgress: progress,
  };
}

export async function recordActiveEvolutionUnlock(characterId: string, formId: string): Promise<GuestCharacterProgressResult> {
  const state = accountOnlineState();
  if (!state) return recordGuestEvolutionUnlock(characterId, formId);
  const before = accountProgress(state);
  const response = await mutateAuthenticatedAccountMeta({
    requestId: nextRequestId('evolution-unlock'),
    action: 'EVOLUTION_UNLOCK',
    characterId,
    formId,
  });
  const progress = mutationProgress(response.snapshot);
  return {
    characterId,
    characterProgress: requireCharacterProgress(progress, characterId),
    spentResources: spentBetween(before, progress),
    persisted: true,
    guestProgress: progress,
  };
}

export async function selectActiveEvolutionForm(characterId: string, formId: string): Promise<GuestCharacterProgressResult> {
  const state = accountOnlineState();
  if (!state) return selectGuestEvolutionForm(characterId, formId);
  const response = await mutateAuthenticatedAccountMeta({
    requestId: nextRequestId('evolution-select'),
    action: 'EVOLUTION_SELECT',
    characterId,
    formId,
  });
  const progress = mutationProgress(response.snapshot);
  return {
    characterId,
    characterProgress: requireCharacterProgress(progress, characterId),
    persisted: true,
    guestProgress: progress,
  };
}

export async function recordActiveDeck(deckSlotIds: readonly string[]): Promise<GuestDeckResult> {
  const state = accountOnlineState();
  if (!state) return recordGuestDeck(deckSlotIds);
  const response = await mutateAuthenticatedAccountMeta({
    requestId: nextRequestId('deck-set'),
    action: 'DECK_SET',
    deckSlotIds,
  });
  const progress = mutationProgress(response.snapshot);
  return { deckSlotIds: progress.deckSlotIds ?? [], persisted: true, guestProgress: progress };
}

export async function resetActiveDeckToAutomatic(): Promise<GuestDeckResult> {
  const state = accountOnlineState();
  if (!state) return resetGuestDeckToAutomatic();
  const before = accountProgress(state);
  const automaticDeck = getOwnedCharacterIds(before).slice(0, MAX_DECK_SLOTS);
  if (automaticDeck.length === 0) throw new Error('자동 편성할 보유 동료가 없습니다.');
  const response = await mutateAuthenticatedAccountMeta({
    requestId: nextRequestId('deck-auto'),
    action: 'DECK_SET',
    deckSlotIds: automaticDeck,
  });
  const progress = mutationProgress(response.snapshot);
  return { deckSlotIds: progress.deckSlotIds ?? automaticDeck, persisted: true, guestProgress: progress };
}

export async function selectActiveBaseWeapon(baseWeaponId: BaseWeaponId): Promise<GuestBaseWeaponResult> {
  const state = accountOnlineState();
  if (!state) return selectGuestBaseWeapon(baseWeaponId);
  const response = await mutateAuthenticatedAccountMeta({
    requestId: nextRequestId('base-weapon'),
    action: 'BASE_WEAPON_SELECT',
    baseWeaponId,
  });
  const progress = mutationProgress(response.snapshot);
  return {
    selectedBaseWeaponId: progress.selectedBaseWeaponId ?? baseWeaponId,
    persisted: true,
    guestProgress: progress,
  };
}

export async function performActiveRecruitment(
  count: number,
  rng: RecruitmentRandomSource,
  banner: RecruitmentBanner,
  duplicatePolicy: DuplicatePolicy = 'APPLY_PLUS',
): Promise<ActiveRecruitmentResult> {
  const state = accountOnlineState();
  if (!state) {
    const result = await performGuestRecruitment(count, rng, banner, duplicatePolicy);
    return {
      results: result.results,
      duplicatePolicy: result.duplicatePolicy,
      spentResources: result.spentResources,
      dismantledSoulEssence: result.dismantledSoulEssence,
      persisted: result.persisted,
      guestProgress: result.guestProgress,
    };
  }

  const pullCount = requireRecruitmentCount(count);
  const before = accountProgress(state);
  const response = await mutateAuthenticatedAccountRecruitment({
    requestId: nextRequestId('recruitment'),
    bannerId: banner.id,
    count: pullCount,
    duplicatePolicy,
  });
  const progress = mutationProgress(response.snapshot);
  const parsed = parseAccountRecruitmentResult(response.result, banner.id, pullCount, duplicatePolicy);
  return {
    results: parsed.results,
    duplicatePolicy,
    spentResources: spentBetween(before, progress),
    dismantledSoulEssence: parsed.dismantledSoulEssence,
    persisted: true,
    guestProgress: progress,
  };
}
