import type { AttackHitEffectDefinition, AttackPatternStep, AttackPhaseDefinition, BattleUnitDefinition } from './index.ts';

export interface CombatGrammarOverride {
  readonly id: string;
  readonly hitDamages?: readonly number[];
  readonly hitEffects?: readonly AttackHitEffectDefinition[];
  readonly attackPattern?: readonly AttackPatternStep[];
  readonly attackPhases?: readonly AttackPhaseDefinition[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEffect(value: unknown, context: string): AttackHitEffectDefinition {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const effect: AttackHitEffectDefinition = {};
  if (value.onHitPush !== undefined) {
    if (!isRecord(value.onHitPush)) throw new Error(`${context}.onHitPush must be an object`);
    const chancePermille = Number(value.onHitPush.chancePermille);
    const distance = Number(value.onHitPush.distance);
    const frames = Number(value.onHitPush.frames);
    if (!Number.isInteger(chancePermille) || chancePermille < 1 || chancePermille > 1000) throw new Error(`${context}.onHitPush.chancePermille invalid`);
    if (!Number.isInteger(distance) || distance < 0 || !Number.isInteger(frames) || frames <= 0) throw new Error(`${context}.onHitPush displacement invalid`);
    (effect as { onHitPush?: AttackHitEffectDefinition['onHitPush'] }).onHitPush = { chancePermille, distance, frames };
  }
  if (value.onHitSlow !== undefined) {
    if (!isRecord(value.onHitSlow)) throw new Error(`${context}.onHitSlow must be an object`);
    const chancePermille = Number(value.onHitSlow.chancePermille);
    const durationFrames = Number(value.onHitSlow.durationFrames);
    const speedPermille = Number(value.onHitSlow.speedPermille);
    if (!Number.isInteger(chancePermille) || chancePermille < 1 || chancePermille > 1000 || !Number.isInteger(durationFrames) || durationFrames <= 0 || !Number.isInteger(speedPermille) || speedPermille < 1 || speedPermille >= 1000) throw new Error(`${context}.onHitSlow invalid`);
    (effect as { onHitSlow?: AttackHitEffectDefinition['onHitSlow'] }).onHitSlow = { chancePermille, durationFrames, speedPermille };
  }
  if (value.onHitWeaken !== undefined) {
    if (!isRecord(value.onHitWeaken)) throw new Error(`${context}.onHitWeaken must be an object`);
    const chancePermille = Number(value.onHitWeaken.chancePermille);
    const durationFrames = Number(value.onHitWeaken.durationFrames);
    const attackPermille = Number(value.onHitWeaken.attackPermille);
    if (!Number.isInteger(chancePermille) || chancePermille < 1 || chancePermille > 1000 || !Number.isInteger(durationFrames) || durationFrames <= 0 || !Number.isInteger(attackPermille) || attackPermille < 1 || attackPermille >= 1000) throw new Error(`${context}.onHitWeaken invalid`);
    (effect as { onHitWeaken?: AttackHitEffectDefinition['onHitWeaken'] }).onHitWeaken = { chancePermille, durationFrames, attackPermille };
  }
  return effect;
}

function parseIntegerArray(value: unknown, context: string, minimum = 0): readonly number[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${context} must be a non-empty array`);
  return value.map((entry, index) => {
    if (!Number.isInteger(entry) || (entry as number) < minimum) throw new Error(`${context}[${index}] invalid`);
    return entry as number;
  });
}

function parsePatternStep(value: unknown, context: string): AttackPatternStep {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const attackDamage = Number(value.attackDamage);
  const attackMinRange = Number(value.attackMinRange);
  const attackMaxRange = Number(value.attackMaxRange);
  const cycleFrames = Number(value.cycleFrames);
  const hitFrames = parseIntegerArray(value.hitFrames, `${context}.hitFrames`);
  if (![attackDamage, attackMinRange, attackMaxRange, cycleFrames].every(Number.isInteger) || attackDamage < 0 || attackMinRange < 0 || attackMaxRange < attackMinRange || cycleFrames <= hitFrames[hitFrames.length - 1]!) throw new Error(`${context} numeric profile invalid`);
  const hitDamages = value.hitDamages === undefined ? undefined : parseIntegerArray(value.hitDamages, `${context}.hitDamages`);
  if (hitDamages && hitDamages.length !== hitFrames.length) throw new Error(`${context}.hitDamages length mismatch`);
  let hitEffects: readonly AttackHitEffectDefinition[] | undefined;
  if (value.hitEffects !== undefined) {
    if (!Array.isArray(value.hitEffects) || value.hitEffects.length !== hitFrames.length) throw new Error(`${context}.hitEffects length mismatch`);
    hitEffects = value.hitEffects.map((entry, index) => parseEffect(entry, `${context}.hitEffects[${index}]`));
  }
  return {
    attackDamage, attackMinRange, attackMaxRange, cycleFrames, hitFrames,
    ...(hitDamages === undefined ? {} : { hitDamages }),
    ...(hitEffects === undefined ? {} : { hitEffects }),
  };
}

export function parseCombatGrammarOverrides(value: unknown): readonly CombatGrammarOverride[] {
  if (!Array.isArray(value)) throw new Error('combat grammar registry must be an array');
  const ids = new Set<string>();
  return value.map((raw, index): CombatGrammarOverride => {
    const context = `combatGrammar[${index}]`;
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim()) throw new Error(`${context}.id invalid`);
    if (ids.has(raw.id)) throw new Error(`duplicate combat grammar id:${raw.id}`);
    ids.add(raw.id);
    const hitDamages = raw.hitDamages === undefined ? undefined : parseIntegerArray(raw.hitDamages, `${context}.hitDamages`);
    let hitEffects: readonly AttackHitEffectDefinition[] | undefined;
    if (raw.hitEffects !== undefined) {
      if (!Array.isArray(raw.hitEffects)) throw new Error(`${context}.hitEffects must be an array`);
      hitEffects = raw.hitEffects.map((entry, effectIndex) => parseEffect(entry, `${context}.hitEffects[${effectIndex}]`));
    }
    let attackPattern: readonly AttackPatternStep[] | undefined;
    if (raw.attackPattern !== undefined) {
      if (!Array.isArray(raw.attackPattern) || raw.attackPattern.length === 0) throw new Error(`${context}.attackPattern must be non-empty`);
      attackPattern = raw.attackPattern.map((step, stepIndex) => parsePatternStep(step, `${context}.attackPattern[${stepIndex}]`));
    }
    let attackPhases: readonly AttackPhaseDefinition[] | undefined;
    if (raw.attackPhases !== undefined) {
      if (!Array.isArray(raw.attackPhases) || raw.attackPhases.length === 0) throw new Error(`${context}.attackPhases must be non-empty`);
      attackPhases = raw.attackPhases.map((phase, phaseIndex): AttackPhaseDefinition => {
        if (!isRecord(phase)) throw new Error(`${context}.attackPhases[${phaseIndex}] must be an object`);
        const maxHpPermille = Number(phase.maxHpPermille);
        const patternIndices = parseIntegerArray(phase.patternIndices, `${context}.attackPhases[${phaseIndex}].patternIndices`);
        const cyclePermille = phase.cyclePermille === undefined ? undefined : Number(phase.cyclePermille);
        if (!Number.isInteger(maxHpPermille) || maxHpPermille < 1 || maxHpPermille > 1000) throw new Error(`${context}.attackPhases[${phaseIndex}].maxHpPermille invalid`);
        if (cyclePermille !== undefined && (!Number.isInteger(cyclePermille) || cyclePermille < 100 || cyclePermille > 2000)) throw new Error(`${context}.attackPhases[${phaseIndex}].cyclePermille invalid`);
        return { maxHpPermille, patternIndices, ...(cyclePermille === undefined ? {} : { cyclePermille }) };
      });
    }
    return {
      id: raw.id,
      ...(hitDamages === undefined ? {} : { hitDamages }),
      ...(hitEffects === undefined ? {} : { hitEffects }),
      ...(attackPattern === undefined ? {} : { attackPattern }),
      ...(attackPhases === undefined ? {} : { attackPhases }),
    };
  });
}

export function buildCombatGrammarMap(value: unknown): ReadonlyMap<string, CombatGrammarOverride> {
  return new Map(parseCombatGrammarOverrides(value).map((entry) => [entry.id, entry] as const));
}

export function applyCombatGrammarOverride(definition: BattleUnitDefinition, override: CombatGrammarOverride | undefined): BattleUnitDefinition {
  if (!override) return definition;
  if (override.id !== definition.id) throw new Error(`combat grammar id mismatch:${override.id}:${definition.id}`);
  return {
    ...definition,
    ...(override.hitDamages === undefined ? {} : { hitDamages: override.hitDamages }),
    ...(override.hitEffects === undefined ? {} : { hitEffects: override.hitEffects }),
    ...(override.attackPattern === undefined ? {} : { attackPattern: override.attackPattern }),
    ...(override.attackPhases === undefined ? {} : { attackPhases: override.attackPhases }),
  };
}
