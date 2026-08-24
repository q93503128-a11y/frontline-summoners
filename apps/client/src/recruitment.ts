import {
  RARITIES,
  parsePlayerUnits,
  type PlayerUnitContent,
  type Rarity,
} from '@frontline/content-schema';
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import bannerJson from '../../../content/recruitment/banner-01.json' with { type: 'json' };

export interface RecruitmentRandomSource {
  /** Returns an integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

export interface RecruitmentBanner {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ratesPermille: Readonly<Record<Rarity, number>>;
  readonly tenPullMinimumRarity: Rarity;
  readonly thirtyPullMinimumRarity: Rarity;
  readonly pickupSsGuaranteeEvery: number;
  readonly selectionCreditEvery: number;
  readonly pickupSsIds: readonly string[];
  readonly poolByRarity: Readonly<Record<Rarity, readonly string[]>>;
}

export interface RecruitmentProgress {
  readonly totalPulls: number;
  readonly selectionCredits: number;
}

export interface RecruitmentPullResult {
  readonly pullNumber: number;
  readonly characterId: string;
  readonly rarity: Rarity;
  readonly guaranteedBy: 'NONE' | 'TEN_PULL_A_PLUS' | 'THIRTY_PULL_S_PLUS' | 'SIXTY_PULL_PICKUP_SS';
  readonly duplicate: boolean;
  readonly selectionCreditGranted: boolean;
}

export interface RecruitmentBatchResult {
  readonly results: readonly RecruitmentPullResult[];
  readonly progress: RecruitmentProgress;
  readonly ownedCharacterIds: readonly string[];
}

export const EMPTY_RECRUITMENT_PROGRESS: RecruitmentProgress = {
  totalPulls: 0,
  selectionCredits: 0,
};

export const RECRUITMENT_UNITS: readonly PlayerUnitContent[] = parsePlayerUnits(recruitmentUnitsJson);
const RECRUITMENT_UNIT_BY_ID = new Map(RECRUITMENT_UNITS.map((unit) => [unit.id, unit] as const));

const RARITY_RANK: Readonly<Record<Rarity, number>> = {
  C: 0,
  B: 1,
  A: 2,
  S: 3,
  SS: 4,
};

function requireNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
}

function requirePositiveInteger(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) throw new Error(`${context} must be a positive integer`);
  return value as number;
}

function requireRarity(value: unknown, context: string): Rarity {
  if (typeof value !== 'string' || !(RARITIES as readonly string[]).includes(value)) throw new Error(`${context} is not a valid rarity`);
  return value as Rarity;
}

function requireStringArray(value: unknown, context: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${context} must be a non-empty array`);
  const parsed = value.map((item, index) => requireNonEmptyString(item, `${context}[${index}]`));
  if (new Set(parsed).size !== parsed.length) throw new Error(`${context} must not contain duplicates`);
  return parsed;
}

function parseBanner(value: unknown): RecruitmentBanner {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('recruitment banner must be an object');
  const raw = value as Record<string, unknown>;
  const ratesRaw = raw.ratesPermille;
  const poolRaw = raw.poolByRarity;
  if (typeof ratesRaw !== 'object' || ratesRaw === null || Array.isArray(ratesRaw)) throw new Error('ratesPermille must be an object');
  if (typeof poolRaw !== 'object' || poolRaw === null || Array.isArray(poolRaw)) throw new Error('poolByRarity must be an object');

  const rates = {} as Record<Rarity, number>;
  const pools = {} as Record<Rarity, readonly string[]>;
  let rateSum = 0;
  const assignedIds = new Set<string>();
  for (const rarity of RARITIES) {
    const rate = (ratesRaw as Record<string, unknown>)[rarity];
    if (!Number.isInteger(rate) || (rate as number) < 0) throw new Error(`ratesPermille.${rarity} must be a non-negative integer`);
    rates[rarity] = rate as number;
    rateSum += rate as number;

    const ids = requireStringArray((poolRaw as Record<string, unknown>)[rarity], `poolByRarity.${rarity}`);
    for (const id of ids) {
      if (assignedIds.has(id)) throw new Error(`recruitment character appears in multiple rarity pools: ${id}`);
      assignedIds.add(id);
      const unit = RECRUITMENT_UNIT_BY_ID.get(id);
      if (!unit) throw new Error(`banner references unknown recruitment character: ${id}`);
      if (unit.rarity !== rarity) throw new Error(`banner rarity mismatch for ${id}: ${rarity} vs ${unit.rarity}`);
    }
    pools[rarity] = ids;
  }
  if (rateSum !== 1000) throw new Error(`recruitment rates must sum to 1000 permille, got ${rateSum}`);
  if (assignedIds.size !== RECRUITMENT_UNITS.length) throw new Error('every recruitment unit must appear exactly once in the banner pool');

  const pickupSsIds = requireStringArray(raw.pickupSsIds, 'pickupSsIds');
  for (const id of pickupSsIds) {
    if (!pools.SS.includes(id)) throw new Error(`pickup SS must belong to the SS pool: ${id}`);
  }

  return {
    id: requireNonEmptyString(raw.id, 'banner.id'),
    name: requireNonEmptyString(raw.name, 'banner.name'),
    description: requireNonEmptyString(raw.description, 'banner.description'),
    ratesPermille: rates,
    tenPullMinimumRarity: requireRarity(raw.tenPullMinimumRarity, 'tenPullMinimumRarity'),
    thirtyPullMinimumRarity: requireRarity(raw.thirtyPullMinimumRarity, 'thirtyPullMinimumRarity'),
    pickupSsGuaranteeEvery: requirePositiveInteger(raw.pickupSsGuaranteeEvery, 'pickupSsGuaranteeEvery'),
    selectionCreditEvery: requirePositiveInteger(raw.selectionCreditEvery, 'selectionCreditEvery'),
    pickupSsIds,
    poolByRarity: pools,
  };
}

export const FIRST_RECRUITMENT_BANNER: RecruitmentBanner = parseBanner(bannerJson);

function checkedRoll(rng: RecruitmentRandomSource, maxExclusive: number): number {
  const roll = rng.nextInt(maxExclusive);
  if (!Number.isInteger(roll) || roll < 0 || roll >= maxExclusive) {
    throw new Error(`random source returned invalid roll ${roll} for maxExclusive=${maxExclusive}`);
  }
  return roll;
}

export const CRYPTO_RECRUITMENT_RANDOM_SOURCE: RecruitmentRandomSource = {
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new Error('maxExclusive must be a positive integer');
    if (!globalThis.crypto?.getRandomValues) throw new Error('secure random source is unavailable');
    const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
    const buffer = new Uint32Array(1);
    do {
      globalThis.crypto.getRandomValues(buffer);
    } while (buffer[0]! >= limit);
    return buffer[0]! % maxExclusive;
  },
};

function randomRarity(banner: RecruitmentBanner, rng: RecruitmentRandomSource): Rarity {
  const roll = checkedRoll(rng, 1000);
  let cursor = 0;
  for (const rarity of RARITIES) {
    cursor += banner.ratesPermille[rarity];
    if (roll < cursor) return rarity;
  }
  throw new Error('recruitment rate table did not resolve a rarity');
}

function weightedRarityAtLeast(banner: RecruitmentBanner, minimum: Rarity, rng: RecruitmentRandomSource): Rarity {
  const eligible = RARITIES.filter((rarity) => RARITY_RANK[rarity] >= RARITY_RANK[minimum]);
  const totalWeight = eligible.reduce((sum, rarity) => sum + banner.ratesPermille[rarity], 0);
  if (totalWeight <= 0) throw new Error(`banner has no positive rarity weight at or above ${minimum}`);
  const roll = checkedRoll(rng, totalWeight);
  let cursor = 0;
  for (const rarity of eligible) {
    cursor += banner.ratesPermille[rarity];
    if (roll < cursor) return rarity;
  }
  throw new Error(`guaranteed rarity table did not resolve at or above ${minimum}`);
}

function chooseFrom(ids: readonly string[], rng: RecruitmentRandomSource): string {
  const index = checkedRoll(rng, ids.length);
  return ids[index]!;
}

function chooseAtLeast(banner: RecruitmentBanner, minimum: Rarity, rng: RecruitmentRandomSource): string {
  const rarity = weightedRarityAtLeast(banner, minimum, rng);
  return chooseFrom(banner.poolByRarity[rarity], rng);
}

function rarityForCharacter(characterId: string): Rarity {
  const unit = RECRUITMENT_UNIT_BY_ID.get(characterId);
  if (!unit) throw new Error(`unknown recruitment character: ${characterId}`);
  return unit.rarity;
}

export function recruit(
  progress: RecruitmentProgress,
  ownedCharacterIds: readonly string[],
  count: number,
  rng: RecruitmentRandomSource,
  banner: RecruitmentBanner = FIRST_RECRUITMENT_BANNER,
): RecruitmentBatchResult {
  if (!Number.isInteger(count) || count <= 0) throw new Error('recruit count must be a positive integer');
  if (!Number.isInteger(progress.totalPulls) || progress.totalPulls < 0) throw new Error('totalPulls must be a non-negative integer');
  if (!Number.isInteger(progress.selectionCredits) || progress.selectionCredits < 0) throw new Error('selectionCredits must be a non-negative integer');

  const owned = new Set(ownedCharacterIds);
  const results: RecruitmentPullResult[] = [];
  let totalPulls = progress.totalPulls;
  let selectionCredits = progress.selectionCredits;

  for (let offset = 0; offset < count; offset += 1) {
    const pullNumber = totalPulls + 1;
    let characterId: string;
    let guaranteedBy: RecruitmentPullResult['guaranteedBy'] = 'NONE';

    if (pullNumber % banner.pickupSsGuaranteeEvery === 0) {
      characterId = chooseFrom(banner.pickupSsIds, rng);
      guaranteedBy = 'SIXTY_PULL_PICKUP_SS';
    } else if (pullNumber % 30 === 0) {
      characterId = chooseAtLeast(banner, banner.thirtyPullMinimumRarity, rng);
      guaranteedBy = 'THIRTY_PULL_S_PLUS';
    } else if (pullNumber % 10 === 0) {
      characterId = chooseAtLeast(banner, banner.tenPullMinimumRarity, rng);
      guaranteedBy = 'TEN_PULL_A_PLUS';
    } else {
      const rarity = randomRarity(banner, rng);
      characterId = chooseFrom(banner.poolByRarity[rarity], rng);
    }

    const duplicate = owned.has(characterId);
    owned.add(characterId);
    totalPulls = pullNumber;
    const selectionCreditGranted = pullNumber % banner.selectionCreditEvery === 0;
    if (selectionCreditGranted) selectionCredits += 1;

    results.push({
      pullNumber,
      characterId,
      rarity: rarityForCharacter(characterId),
      guaranteedBy,
      duplicate,
      selectionCreditGranted,
    });
  }

  return {
    results,
    progress: { totalPulls, selectionCredits },
    ownedCharacterIds: [...owned],
  };
}

export function redeemBannerSelection(
  progress: RecruitmentProgress,
  ownedCharacterIds: readonly string[],
  characterId: string,
  banner: RecruitmentBanner = FIRST_RECRUITMENT_BANNER,
): { readonly progress: RecruitmentProgress; readonly ownedCharacterIds: readonly string[]; readonly duplicate: boolean } {
  if (progress.selectionCredits <= 0) throw new Error('no banner selection credit available');
  const inBanner = RARITIES.some((rarity) => banner.poolByRarity[rarity].includes(characterId));
  if (!inBanner) throw new Error(`character is not selectable from this banner: ${characterId}`);
  const owned = new Set(ownedCharacterIds);
  const duplicate = owned.has(characterId);
  owned.add(characterId);
  return {
    progress: { ...progress, selectionCredits: progress.selectionCredits - 1 },
    ownedCharacterIds: [...owned],
    duplicate,
  };
}
