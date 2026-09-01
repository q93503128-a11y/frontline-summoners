import type { Attribute, PlayerRole, TargetMode } from '@frontline/content-schema';
import type { PrototypeRosterSlot } from './prototype.ts';
import type { GuestProgress } from './save.ts';

export const ROSTER_QUICK_FILTERS = ['ALL', 'STORY', 'C', 'B', 'A', 'S', 'SS', 'FAVORITE'] as const;
export type RosterQuickFilter = (typeof ROSTER_QUICK_FILTERS)[number];
export const ROSTER_ROLE_FILTERS = ['ALL', '물량', '전열', '원거리', '광역', '결정타', '변칙'] as const;
export type RosterRoleFilter = 'ALL' | PlayerRole;
export const ROSTER_ATTACK_FILTERS = ['ALL', 'SINGLE', 'AREA'] as const;
export type RosterAttackFilter = 'ALL' | TargetMode;
export const ROSTER_COUNTER_FILTERS = ['ALL', 'NEUTRAL', 'BEAST', 'UNDEAD', 'NATURE', 'ARCANE', 'DEMON', 'MACHINE', 'ANOMALY'] as const;
export type RosterCounterFilter = 'ALL' | Attribute;
export const ROSTER_COST_FILTERS = ['ALL', 'LOW', 'MID', 'HIGH'] as const;
export type RosterCostFilter = (typeof ROSTER_COST_FILTERS)[number];
export const ROSTER_RANGE_FILTERS = ['ALL', 'SHORT', 'MID', 'LONG'] as const;
export type RosterRangeFilter = (typeof ROSTER_RANGE_FILTERS)[number];
export const ROSTER_GROWTH_FILTERS = ['ALL', 'PLUS', 'EVOLVED'] as const;
export type RosterGrowthFilter = (typeof ROSTER_GROWTH_FILTERS)[number];

export interface RosterBrowserQuery {
  readonly quick: RosterQuickFilter;
  readonly role: RosterRoleFilter;
  readonly attack: RosterAttackFilter;
  readonly counter: RosterCounterFilter;
  readonly cost: RosterCostFilter;
  readonly range: RosterRangeFilter;
  readonly growth: RosterGrowthFilter;
  readonly search: string;
  readonly favoriteIds: ReadonlySet<string>;
}

export const DEFAULT_ROSTER_BROWSER_QUERY: Omit<RosterBrowserQuery, 'favoriteIds'> = {
  quick: 'ALL',
  role: 'ALL',
  attack: 'ALL',
  counter: 'ALL',
  cost: 'ALL',
  range: 'ALL',
  growth: 'ALL',
  search: '',
};

export function cycleRosterFilter<T extends string>(values: readonly T[], current: T): T {
  const index = values.indexOf(current);
  return values[(index < 0 ? 0 : index + 1) % values.length]!;
}

function matchesQuick(slot: PrototypeRosterSlot, quick: RosterQuickFilter, favoriteIds: ReadonlySet<string>): boolean {
  if (quick === 'ALL') return true;
  if (quick === 'FAVORITE') return favoriteIds.has(slot.slotId);
  if (quick === 'STORY') return slot.acquisitionClass === 'STORY';
  return slot.rarity === quick;
}

function matchesCost(slot: PrototypeRosterSlot, filter: RosterCostFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'LOW') return slot.cost <= 299;
  if (filter === 'MID') return slot.cost >= 300 && slot.cost <= 699;
  return slot.cost >= 700;
}

function matchesRange(slot: PrototypeRosterSlot, filter: RosterRangeFilter): boolean {
  if (filter === 'ALL') return true;
  const range = slot.definition.attackMaxRange;
  if (filter === 'SHORT') return range <= 170;
  if (filter === 'MID') return range >= 171 && range <= 349;
  return range >= 350;
}

function matchesGrowth(slot: PrototypeRosterSlot, progress: GuestProgress, filter: RosterGrowthFilter): boolean {
  if (filter === 'ALL') return true;
  const meta = progress.characterProgressById?.[slot.slotId];
  if (filter === 'PLUS') return (meta?.plusLevel ?? 0) > 0;
  const selected = meta?.selectedFormId ?? '';
  return selected.endsWith('_f2') || selected.endsWith('_f3');
}

function countersAttribute(slot: PrototypeRosterSlot, attribute: Attribute): boolean {
  return slot.definition.damageBonuses.some((bonus) => bonus.targetKind === 'ATTRIBUTE' && bonus.target === attribute);
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('ko-KR');
}

function matchesSearch(slot: PrototypeRosterSlot, rawSearch: string): boolean {
  const search = normalizeSearch(rawSearch);
  if (!search) return true;
  const attributeText = slot.definition.attributes.join(' ');
  const counterText = slot.definition.damageBonuses
    .filter((bonus) => bonus.targetKind === 'ATTRIBUTE')
    .map((bonus) => bonus.target)
    .join(' ');
  const haystack = [
    slot.slotId,
    slot.displayName,
    slot.description,
    slot.acquisitionClass,
    slot.rarity ?? '',
    slot.seriesId ?? '',
    slot.role,
    slot.definition.targetMode,
    attributeText,
    counterText,
  ].join(' ').toLocaleLowerCase('ko-KR');
  return haystack.includes(search);
}

/**
 * Applies only presentation/search filters. Ownership remains a save-authority concern and the caller must
 * pass the already-authorized visible roster (Deck passes owned slots; Catalog may pass the full roster).
 */
export function filterRosterSlots(
  slots: readonly PrototypeRosterSlot[],
  progress: GuestProgress,
  query: RosterBrowserQuery,
): readonly PrototypeRosterSlot[] {
  return slots.filter((slot) => {
    if (!matchesQuick(slot, query.quick, query.favoriteIds)) return false;
    if (query.role !== 'ALL' && slot.role !== query.role) return false;
    if (query.attack !== 'ALL' && slot.definition.targetMode !== query.attack) return false;
    if (query.counter !== 'ALL' && !countersAttribute(slot, query.counter)) return false;
    if (!matchesCost(slot, query.cost)) return false;
    if (!matchesRange(slot, query.range)) return false;
    if (!matchesGrowth(slot, progress, query.growth)) return false;
    return matchesSearch(slot, query.search);
  });
}

export function summarizeRosterBrowserQuery(query: RosterBrowserQuery): string {
  const active = [
    query.quick !== 'ALL' ? `분류 ${query.quick}` : '',
    query.role !== 'ALL' ? `역할 ${query.role}` : '',
    query.attack !== 'ALL' ? `공격 ${query.attack}` : '',
    query.counter !== 'ALL' ? `대항 ${query.counter}` : '',
    query.cost !== 'ALL' ? `비용 ${query.cost}` : '',
    query.range !== 'ALL' ? `사거리 ${query.range}` : '',
    query.growth !== 'ALL' ? `성장 ${query.growth}` : '',
    query.search.trim() ? `검색 “${query.search.trim()}”` : '',
  ].filter(Boolean);
  return active.length === 0 ? '필터 없음' : active.join(' · ');
}
