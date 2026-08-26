import type {
  BattleUnitDefinition,
  CombatAttribute,
  CombatTag,
  DamageBonus,
} from '@frontline/sim';

const ATTRIBUTE_LABELS: Readonly<Record<CombatAttribute, string>> = {
  NEUTRAL: '중립',
  BEAST: '야수',
  UNDEAD: '언데드',
  NATURE: '자연',
  ARCANE: '비전',
  DEMON: '악마',
  MACHINE: '기계',
  ANOMALY: '이상',
};

const TAG_LABELS: Readonly<Record<CombatTag, string>> = {
  ARMORED: '중갑',
  FLOATING: '부유',
  GIANT: '거대',
  BOSS: '보스',
  STRUCTURE: '구조물',
  SUMMON: '소환체',
  SWARM: '군집',
};

export function getCombatAttributeLabel(attribute: CombatAttribute): string {
  return ATTRIBUTE_LABELS[attribute];
}

export function getCombatTagLabel(tag: CombatTag): string {
  return TAG_LABELS[tag];
}

function getDamageBonusTargetLabel(bonus: DamageBonus): string {
  return bonus.targetKind === 'ATTRIBUTE'
    ? getCombatAttributeLabel(bonus.target)
    : getCombatTagLabel(bonus.target);
}

/** Compact battle label. Attributes are identity; combat tags are appended only when present. */
export function formatCompactTraits(definition: BattleUnitDefinition): string {
  const attributes = definition.attributes ?? [];
  const combatTags = definition.combatTags ?? [];
  const labels = [
    ...attributes.map(getCombatAttributeLabel),
    ...combatTags.map(getCombatTagLabel),
  ];
  return labels.length > 0 ? labels.join('·') : '중립';
}

export function formatCombatTraits(definition: BattleUnitDefinition): string {
  const attributes = definition.attributes ?? [];
  const combatTags = definition.combatTags ?? [];
  const attributeText = attributes.length > 0
    ? attributes.map(getCombatAttributeLabel).join('·')
    : '중립';
  if (combatTags.length === 0) return `속성 ${attributeText}`;
  return `속성 ${attributeText} · 태그 ${combatTags.map(getCombatTagLabel).join('·')}`;
}

export function formatDamageSpecialty(definition: BattleUnitDefinition): string | null {
  const bonuses = definition.damageBonuses ?? [];
  if (bonuses.length === 0) return null;
  return bonuses
    .map((bonus) => {
      const bonusPercent = Math.round((bonus.multiplierPermille - 1000) / 10);
      return `${getDamageBonusTargetLabel(bonus)} 특효 +${bonusPercent}%`;
    })
    .join(' · ');
}

export function formatCompactCombatIdentity(definition: BattleUnitDefinition): string {
  const bonuses = definition.damageBonuses ?? [];
  const identityText = formatCompactTraits(definition);
  if (bonuses.length === 0) return identityText;
  const strongest = bonuses.reduce(
    (best, bonus) => bonus.multiplierPermille > best.multiplierPermille ? bonus : best,
    bonuses[0]!,
  );
  const bonusPercent = Math.round((strongest.multiplierPermille - 1000) / 10);
  return `${identityText} / ${getDamageBonusTargetLabel(strongest)}+${bonusPercent}%`;
}
