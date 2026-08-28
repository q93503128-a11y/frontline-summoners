import {
  RARITIES,
  parsePlayerUnits,
  type PlayerUnitContent,
  type Rarity,
} from '@frontline/content-schema';
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import banner01Json from '../../../content/recruitment/banner-01.json' with { type: 'json' };
import banner02Json from '../../../content/recruitment/banner-02.json' with { type: 'json' };
import banner03Json from '../../../content/recruitment/banner-03.json' with { type: 'json' };

export interface RecruitmentRandomSource {
  nextInt(maxExclusive: number): number;
}

export interface RecruitmentBanner {
  readonly id: string;
  readonly seriesId: string;
  readonly name: string;
  readonly description: string;
  readonly ratesPermille: Readonly<Record<Rarity, number>>;
  readonly poolByRarity: Readonly<Record<Rarity, readonly string[]>>;
}

/** Pull count is retained only as account history/statistics. It never changes odds or guarantees a result. */
export interface RecruitmentProgress {
  readonly totalPulls: number;
}

export interface RecruitmentPullResult {
  readonly pullNumber: number;
  readonly characterId: string;
  readonly rarity: Rarity;
  readonly duplicate: boolean;
}

export interface RecruitmentBatchResult {
  readonly results: readonly RecruitmentPullResult[];
  readonly progress: RecruitmentProgress;
  readonly ownedCharacterIds: readonly string[];
}

export const EMPTY_RECRUITMENT_PROGRESS: RecruitmentProgress = { totalPulls: 0 };
export const RECRUITMENT_UNITS: readonly PlayerUnitContent[] = parsePlayerUnits(recruitmentUnitsJson);
const RECRUITMENT_UNIT_BY_ID = new Map(RECRUITMENT_UNITS.map((unit) => [unit.id, unit] as const));

function requireNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
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
  const seriesId = requireNonEmptyString(raw.seriesId, 'banner.seriesId');
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
      if (unit.acquisitionClass !== 'RECRUITMENT' || unit.rarity !== rarity) throw new Error(`banner rarity/source mismatch for ${id}`);
      if ((rarity === 'S' || rarity === 'SS') && unit.seriesId !== seriesId) throw new Error(`series-specific ${rarity} character ${id} must belong to ${seriesId}`);
    }
    pools[rarity] = ids;
  }
  if (rateSum !== 1000) throw new Error(`recruitment rates must sum to 1000 permille, got ${rateSum}`);
  if (pools.C.length !== 5 || pools.B.length !== 5 || pools.A.length !== 5) throw new Error('initial banners must share the canonical 5/5/5 common pool');
  if (pools.S.length !== 5) throw new Error(`each initial recruitment series must contain exactly five S characters, got ${pools.S.length}`);
  if (pools.SS.length !== 1) throw new Error(`each recruitment series must contain exactly one SS character, got ${pools.SS.length}`);

  return {
    id: requireNonEmptyString(raw.id, 'banner.id'),
    seriesId,
    name: requireNonEmptyString(raw.name, 'banner.name'),
    description: requireNonEmptyString(raw.description, 'banner.description'),
    ratesPermille: rates,
    poolByRarity: pools,
  };
}

export const RECRUITMENT_BANNERS: readonly RecruitmentBanner[] = [
  parseBanner(banner01Json),
  parseBanner(banner02Json),
  parseBanner(banner03Json),
];

if (new Set(RECRUITMENT_BANNERS.map((banner) => banner.id)).size !== RECRUITMENT_BANNERS.length) {
  throw new Error('recruitment banner ids must be unique');
}
if (new Set(RECRUITMENT_BANNERS.map((banner) => banner.seriesId)).size !== RECRUITMENT_BANNERS.length) {
  throw new Error('initial recruitment series ids must be unique');
}

const canonicalCommonPool = JSON.stringify({
  C: RECRUITMENT_BANNERS[0]!.poolByRarity.C,
  B: RECRUITMENT_BANNERS[0]!.poolByRarity.B,
  A: RECRUITMENT_BANNERS[0]!.poolByRarity.A,
});
for (const banner of RECRUITMENT_BANNERS.slice(1)) {
  const commonPool = JSON.stringify({ C: banner.poolByRarity.C, B: banner.poolByRarity.B, A: banner.poolByRarity.A });
  if (commonPool !== canonicalCommonPool) throw new Error(`initial banner ${banner.id} does not share the canonical C/B/A pool`);
}

export const FIRST_RECRUITMENT_BANNER: RecruitmentBanner = RECRUITMENT_BANNERS[0]!;

export function getRecruitmentBanner(bannerId: string): RecruitmentBanner {
  const banner = RECRUITMENT_BANNERS.find((candidate) => candidate.id === bannerId);
  if (!banner) throw new Error(`Unknown recruitment banner: ${bannerId}`);
  return banner;
}

export function getBannerCharacterIds(banner: RecruitmentBanner): readonly string[] {
  return RARITIES.flatMap((rarity) => banner.poolByRarity[rarity]);
}

function checkedRoll(rng: RecruitmentRandomSource, maxExclusive: number): number {
  const roll = rng.nextInt(maxExclusive);
  if (!Number.isInteger(roll) || roll < 0 || roll >= maxExclusive) throw new Error(`random source returned invalid roll ${roll} for maxExclusive=${maxExclusive}`);
  return roll;
}

export const CRYPTO_RECRUITMENT_RANDOM_SOURCE: RecruitmentRandomSource = {
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new Error('maxExclusive must be a positive integer');
    if (!globalThis.crypto?.getRandomValues) throw new Error('secure random source is unavailable');
    const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
    const buffer = new Uint32Array(1);
    do globalThis.crypto.getRandomValues(buffer); while (buffer[0]! >= limit);
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

function chooseFrom(ids: readonly string[], rng: RecruitmentRandomSource): string {
  return ids[checkedRoll(rng, ids.length)]!;
}

function rarityForCharacter(characterId: string): Rarity {
  const unit = RECRUITMENT_UNIT_BY_ID.get(characterId);
  if (!unit || unit.acquisitionClass !== 'RECRUITMENT' || unit.rarity === null) throw new Error(`unknown recruitment character: ${characterId}`);
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

  const owned = new Set(ownedCharacterIds);
  const results: RecruitmentPullResult[] = [];
  let totalPulls = progress.totalPulls;
  for (let offset = 0; offset < count; offset += 1) {
    const rarity = randomRarity(banner, rng);
    const characterId = chooseFrom(banner.poolByRarity[rarity], rng);
    const duplicate = owned.has(characterId);
    owned.add(characterId);
    totalPulls += 1;
    results.push({ pullNumber: totalPulls, characterId, rarity: rarityForCharacter(characterId), duplicate });
  }
  return { results, progress: { totalPulls }, ownedCharacterIds: [...owned] };
}
