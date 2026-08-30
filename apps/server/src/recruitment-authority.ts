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

export interface ServerRecruitmentRandomSource {
  nextInt(maxExclusive: number): number;
}

export interface ServerRecruitmentBanner {
  readonly id: string;
  readonly seriesId: string;
  readonly ratesPermille: Readonly<Record<Rarity, number>>;
  readonly poolByRarity: Readonly<Record<Rarity, readonly string[]>>;
}

export interface ServerRecruitmentPull {
  readonly index: number;
  readonly characterId: string;
  readonly rarity: Rarity;
  readonly duplicate: boolean;
}

export const SERVER_RECRUITMENT_UNITS: readonly PlayerUnitContent[] = parsePlayerUnits(recruitmentUnitsJson);
const UNIT_BY_ID = new Map(SERVER_RECRUITMENT_UNITS.map((unit) => [unit.id, unit] as const));

function object(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
}

function stringArray(value: unknown, context: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${context} must be a non-empty array`);
  const result = value.map((entry, index) => nonEmptyString(entry, `${context}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${context} must not contain duplicates`);
  return result;
}

function parseBanner(value: unknown): ServerRecruitmentBanner {
  const raw = object(value, 'server recruitment banner');
  const id = nonEmptyString(raw.id, 'banner.id');
  const seriesId = nonEmptyString(raw.seriesId, 'banner.seriesId');
  const ratesRaw = object(raw.ratesPermille, `${id}.ratesPermille`);
  const poolsRaw = object(raw.poolByRarity, `${id}.poolByRarity`);
  const rates = {} as Record<Rarity, number>;
  const pools = {} as Record<Rarity, readonly string[]>;
  const assignedIds = new Set<string>();
  let sum = 0;
  for (const rarity of RARITIES) {
    const rate = ratesRaw[rarity];
    if (!Number.isInteger(rate) || (rate as number) < 0) throw new Error(`${id}.ratesPermille.${rarity} must be non-negative integer`);
    rates[rarity] = rate as number;
    sum += rate as number;
    const ids = stringArray(poolsRaw[rarity], `${id}.poolByRarity.${rarity}`);
    for (const characterId of ids) {
      if (assignedIds.has(characterId)) throw new Error(`recruitment character appears in multiple pools:${characterId}`);
      assignedIds.add(characterId);
      const unit = UNIT_BY_ID.get(characterId);
      if (!unit || unit.acquisitionClass !== 'RECRUITMENT' || unit.rarity !== rarity) {
        throw new Error(`server recruitment pool mismatch:${characterId}`);
      }
      if ((rarity === 'S' || rarity === 'SS') && unit.seriesId !== seriesId) {
        throw new Error(`server recruitment series mismatch:${characterId}`);
      }
    }
    pools[rarity] = ids;
  }
  if (sum !== 1000) throw new Error(`server recruitment rates must sum to 1000:${id}`);
  if (pools.C.length !== 5 || pools.B.length !== 5 || pools.A.length !== 5 || pools.S.length !== 5 || pools.SS.length !== 1) {
    throw new Error(`server recruitment pool shape is not canonical:${id}`);
  }
  return { id, seriesId, ratesPermille: rates, poolByRarity: pools };
}

export const SERVER_RECRUITMENT_BANNERS: readonly ServerRecruitmentBanner[] = [
  parseBanner(banner01Json),
  parseBanner(banner02Json),
  parseBanner(banner03Json),
];

if (new Set(SERVER_RECRUITMENT_BANNERS.map((banner) => banner.id)).size !== SERVER_RECRUITMENT_BANNERS.length) {
  throw new Error('server recruitment banner ids must be unique');
}

export function getServerRecruitmentBanner(bannerId: string): ServerRecruitmentBanner {
  const banner = SERVER_RECRUITMENT_BANNERS.find((candidate) => candidate.id === bannerId);
  if (!banner) throw new Error(`unknown server recruitment banner:${bannerId}`);
  return banner;
}

function checkedRoll(rng: ServerRecruitmentRandomSource, maxExclusive: number): number {
  const roll = rng.nextInt(maxExclusive);
  if (!Number.isInteger(roll) || roll < 0 || roll >= maxExclusive) throw new Error(`invalid server recruitment roll:${roll}/${maxExclusive}`);
  return roll;
}

function rollRarity(banner: ServerRecruitmentBanner, rng: ServerRecruitmentRandomSource): Rarity {
  const roll = checkedRoll(rng, 1000);
  let cursor = 0;
  for (const rarity of RARITIES) {
    cursor += banner.ratesPermille[rarity];
    if (roll < cursor) return rarity;
  }
  throw new Error(`server recruitment rarity table did not resolve:${banner.id}`);
}

export const SERVER_CRYPTO_RECRUITMENT_RANDOM_SOURCE: ServerRecruitmentRandomSource = {
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new Error('maxExclusive must be positive integer');
    if (!globalThis.crypto?.getRandomValues) throw new Error('secure random source is unavailable');
    const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
    const buffer = new Uint32Array(1);
    do globalThis.crypto.getRandomValues(buffer); while (buffer[0]! >= limit);
    return buffer[0]! % maxExclusive;
  },
};

export function rollServerRecruitment(
  bannerId: string,
  count: number,
  ownedCharacterIds: readonly string[],
  rng: ServerRecruitmentRandomSource = SERVER_CRYPTO_RECRUITMENT_RANDOM_SOURCE,
): readonly ServerRecruitmentPull[] {
  if (count !== 1 && count !== 10) throw new Error('server recruitment count must be 1 or 10');
  const banner = getServerRecruitmentBanner(bannerId);
  const owned = new Set(ownedCharacterIds);
  const results: ServerRecruitmentPull[] = [];
  for (let index = 1; index <= count; index += 1) {
    const rarity = rollRarity(banner, rng);
    const pool = banner.poolByRarity[rarity];
    const characterId = pool[checkedRoll(rng, pool.length)]!;
    const duplicate = owned.has(characterId);
    owned.add(characterId);
    results.push({ index, characterId, rarity, duplicate });
  }
  return results;
}
