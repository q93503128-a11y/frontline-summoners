export interface FormationRestrictionRule {
  readonly allowedRarities?: readonly string[];
  readonly maxRarity?: string;
  readonly allowedAcquisitionClasses?: readonly string[];
  readonly allowedRoles?: readonly string[];
  readonly maxUnitCost?: number;
  readonly requiredUnitTags?: readonly string[];
  readonly forbiddenUnitTags?: readonly string[];
  readonly maxDistinctUnits?: number;
  readonly maxCoopDistinctUnitsPerPlayer?: number;
  readonly sameFactionOnly?: boolean;
}

export interface FormationRestrictionSlot {
  readonly slotId: string;
  readonly cost: number;
  readonly rarity?: string | null;
  readonly acquisitionClass?: string;
  readonly role?: string;
  /** Runtime combat metadata may explicitly resolve to undefined before tag-based restrictions are applied. */
  readonly unitTags?: readonly string[] | undefined;
  readonly factionId?: string;
}

export interface FormationRestrictionOptions {
  readonly maxDistinctUnitsOverride?: number;
}

const RARITY_ORDER = ['C', 'B', 'A', 'S', 'SS'] as const;

function maxDistinct(rule: FormationRestrictionRule, options: FormationRestrictionOptions): number | undefined {
  if (options.maxDistinctUnitsOverride !== undefined) return options.maxDistinctUnitsOverride;
  return rule.maxDistinctUnits;
}

export function getFormationRestrictionViolation(
  rule: FormationRestrictionRule,
  slots: readonly FormationRestrictionSlot[],
  options: FormationRestrictionOptions = {},
): string | undefined {
  const distinctLimit = maxDistinct(rule, options);
  if (distinctLimit !== undefined && new Set(slots.map((slot) => slot.slotId)).size > distinctLimit) {
    return `편성 가능한 캐릭터는 최대 ${distinctLimit}종이다.`;
  }

  if (rule.maxUnitCost !== undefined) {
    const over = slots.find((slot) => slot.cost > rule.maxUnitCost!);
    if (over) return `${over.slotId}의 현재 생산비 ${over.cost}가 제한 ${rule.maxUnitCost}을 초과한다.`;
  }

  if (rule.allowedRarities && rule.allowedRarities.length > 0) {
    const allowed = new Set(rule.allowedRarities);
    const invalid = slots.find((slot) => slot.rarity !== null && slot.rarity !== undefined && !allowed.has(slot.rarity));
    if (invalid) return `${invalid.slotId}의 희귀도는 이 전장에 출전할 수 없다.`;
  }

  if (rule.maxRarity !== undefined) {
    const maximum = RARITY_ORDER.indexOf(rule.maxRarity as (typeof RARITY_ORDER)[number]);
    if (maximum >= 0) {
      const invalid = slots.find((slot) => {
        if (slot.rarity === null || slot.rarity === undefined) return false;
        const index = RARITY_ORDER.indexOf(slot.rarity as (typeof RARITY_ORDER)[number]);
        return index > maximum;
      });
      if (invalid) return `${invalid.slotId}의 희귀도가 허용 상한 ${rule.maxRarity}보다 높다.`;
    }
  }

  if (rule.allowedAcquisitionClasses && rule.allowedAcquisitionClasses.length > 0) {
    const allowed = new Set(rule.allowedAcquisitionClasses);
    const invalid = slots.find((slot) => slot.acquisitionClass !== undefined && !allowed.has(slot.acquisitionClass));
    if (invalid) return `${invalid.slotId}의 획득 분류는 이 전장에 출전할 수 없다.`;
  }

  if (rule.allowedRoles && rule.allowedRoles.length > 0) {
    const allowed = new Set(rule.allowedRoles);
    const invalid = slots.find((slot) => slot.role !== undefined && !allowed.has(slot.role));
    if (invalid) return `${invalid.slotId}의 역할은 이 전장에 출전할 수 없다.`;
  }

  const required = rule.requiredUnitTags ?? [];
  if (required.length > 0) {
    const invalid = slots.find((slot) => required.some((tag) => !(slot.unitTags ?? []).includes(tag)));
    if (invalid) return `${invalid.slotId}에 필요한 전투 태그가 없다.`;
  }

  const forbidden = new Set(rule.forbiddenUnitTags ?? []);
  if (forbidden.size > 0) {
    const invalid = slots.find((slot) => (slot.unitTags ?? []).some((tag) => forbidden.has(tag)));
    if (invalid) return `${invalid.slotId}에 금지된 전투 태그가 있다.`;
  }

  if (rule.sameFactionOnly) {
    const factions = new Set(slots.map((slot) => slot.factionId).filter((value): value is string => Boolean(value)));
    if (factions.size > 1) return '같은 진영의 캐릭터만 편성할 수 있다.';
  }

  return undefined;
}

export function assertFormationRestrictions(
  rule: FormationRestrictionRule,
  slots: readonly FormationRestrictionSlot[],
  options: FormationRestrictionOptions = {},
): void {
  const violation = getFormationRestrictionViolation(rule, slots, options);
  if (violation) throw new Error(`formation_restricted:${violation}`);
}
