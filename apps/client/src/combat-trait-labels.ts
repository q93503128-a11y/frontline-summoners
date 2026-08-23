import type { BattleUnitDefinition, CombatTrait } from '@frontline/sim';

const TRAIT_LABELS: Readonly<Record<CombatTrait, string>> = {
  LIGHT: '경량',
  ARMORED: '중갑',
  ARCANE: '비전',
  BOSS: '우두머리',
};

export function getCombatTraitLabel(trait: CombatTrait): string {
  return TRAIT_LABELS[trait];
}

export function formatCombatTraits(definition: BattleUnitDefinition): string {
  const traits = definition.traits ?? [];
  if (traits.length === 0) return '속성 없음';
  return `속성 ${traits.map(getCombatTraitLabel).join('·')}`;
}

export function formatDamageSpecialty(definition: BattleUnitDefinition): string | null {
  const bonuses = definition.damageBonuses ?? [];
  if (bonuses.length === 0) return null;
  return bonuses
    .map((bonus) => {
      const bonusPercent = Math.round((bonus.multiplierPermille - 1000) / 10);
      return `${getCombatTraitLabel(bonus.trait)} 특효 +${bonusPercent}%`;
    })
    .join(' · ');
}

export function formatCompactCombatIdentity(definition: BattleUnitDefinition): string {
  const traits = definition.traits ?? [];
  const bonuses = definition.damageBonuses ?? [];
  const traitText = traits.length > 0 ? traits.map(getCombatTraitLabel).join('·') : '무속성';
  if (bonuses.length === 0) return traitText;
  const strongest = bonuses.reduce((best, bonus) => bonus.multiplierPermille > best.multiplierPermille ? bonus : best, bonuses[0]!);
  const bonusPercent = Math.round((strongest.multiplierPermille - 1000) / 10);
  return `${traitText} / ${getCombatTraitLabel(strongest.trait)}+${bonusPercent}%`;
}
