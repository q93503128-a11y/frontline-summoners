import type { EvolutionFormDefinition, EvolutionFormModifiers } from './meta-progression.ts';

export const EVOLUTION_RESOURCE_IDS = ['gold', 'evo_fragment', 'evo_core', 'evo_crown'] as const;
export type EvolutionResourceId = (typeof EVOLUTION_RESOURCE_IDS)[number];
export type EvolutionTemplateId = 'MASS' | 'FRONTLINE' | 'RANGED' | 'AREA' | 'FINISHER' | 'TRICK' | 'EXPLICIT';

export interface EvolutionRecipeCost {
  readonly gold: number;
  readonly evo_fragment: number;
  readonly evo_core: number;
  readonly evo_crown: number;
}
export interface EvolutionRecipeDefinition {
  readonly characterId: string;
  readonly formId: string;
  readonly formOrder: 2 | 3;
  readonly requiredBaseLevel: number;
  readonly cost: EvolutionRecipeCost;
}
export interface EvolutionCatalog {
  readonly forms: readonly EvolutionFormDefinition[];
  readonly recipes: readonly EvolutionRecipeDefinition[];
}

type TemplatePair = readonly [EvolutionFormModifiers, EvolutionFormModifiers];
const BASE: EvolutionFormModifiers = {
  maxHpPermille: 1000,
  attackDamagePermille: 1000,
  costPermille: 1000,
  rechargePermille: 1000,
  moveSpeedDelta: 0,
  standingRangeDelta: 0,
  attackMinRangeDelta: 0,
  attackMaxRangeDelta: 0,
};

export const EVOLUTION_ROLE_TEMPLATES: Readonly<Record<Exclude<EvolutionTemplateId, 'EXPLICIT'>, TemplatePair>> = {
  MASS: [
    { ...BASE, maxHpPermille: 1180, attackDamagePermille: 1150, costPermille: 1080, rechargePermille: 950, moveSpeedDelta: 1, standingRangeDelta: 5, attackMaxRangeDelta: 5 },
    { ...BASE, maxHpPermille: 1250, attackDamagePermille: 1500, costPermille: 1180, rechargePermille: 850, moveSpeedDelta: 2, standingRangeDelta: 10, attackMaxRangeDelta: 10 },
  ],
  FRONTLINE: [
    { ...BASE, maxHpPermille: 1350, attackDamagePermille: 1100, costPermille: 1120, rechargePermille: 1080, standingRangeDelta: 5, attackMaxRangeDelta: 5 },
    { ...BASE, maxHpPermille: 1650, attackDamagePermille: 1250, costPermille: 1250, rechargePermille: 1150, moveSpeedDelta: -1, standingRangeDelta: 10, attackMaxRangeDelta: 10 },
  ],
  RANGED: [
    { ...BASE, maxHpPermille: 1120, attackDamagePermille: 1200, costPermille: 1120, rechargePermille: 1080, standingRangeDelta: 20, attackMinRangeDelta: 10, attackMaxRangeDelta: 25 },
    { ...BASE, maxHpPermille: 1100, attackDamagePermille: 1450, costPermille: 1250, rechargePermille: 1180, standingRangeDelta: 55, attackMinRangeDelta: 30, attackMaxRangeDelta: 70 },
  ],
  AREA: [
    { ...BASE, maxHpPermille: 1150, attackDamagePermille: 1180, costPermille: 1120, rechargePermille: 1080, standingRangeDelta: 12, attackMaxRangeDelta: 18 },
    { ...BASE, maxHpPermille: 1200, attackDamagePermille: 1500, costPermille: 1280, rechargePermille: 1200, standingRangeDelta: 35, attackMaxRangeDelta: 50 },
  ],
  FINISHER: [
    { ...BASE, maxHpPermille: 1100, attackDamagePermille: 1250, costPermille: 1150, rechargePermille: 1120, standingRangeDelta: 15, attackMinRangeDelta: 10, attackMaxRangeDelta: 25 },
    { ...BASE, maxHpPermille: 950, attackDamagePermille: 1750, costPermille: 1400, rechargePermille: 1280, standingRangeDelta: 55, attackMinRangeDelta: 35, attackMaxRangeDelta: 80 },
  ],
  TRICK: [
    { ...BASE, maxHpPermille: 1150, attackDamagePermille: 1150, costPermille: 1100, rechargePermille: 1050, standingRangeDelta: 15, attackMaxRangeDelta: 25 },
    { ...BASE, maxHpPermille: 1100, attackDamagePermille: 1400, costPermille: 1250, rechargePermille: 1120, moveSpeedDelta: 1, standingRangeDelta: 45, attackMaxRangeDelta: 65 },
  ],
};

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}
function string(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
}
function integer(value: unknown, context: string, min = 0): number {
  if (!Number.isInteger(value) || (value as number) < min) throw new Error(`${context} must be an integer >= ${min}`);
  return value as number;
}
function finiteNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${context} must be a finite number`);
  return value;
}
function modifierInteger(raw: Record<string, unknown>, key: keyof EvolutionFormModifiers, fallback: number): number {
  const value = raw[key];
  if (value === undefined) return fallback;
  if (!Number.isInteger(value)) throw new Error(`evolution modifier ${String(key)} must be an integer`);
  return value as number;
}
function modifierNumber(raw: Record<string, unknown>, key: keyof EvolutionFormModifiers, fallback: number): number {
  const value = raw[key];
  return value === undefined ? fallback : finiteNumber(value, `evolution modifier ${String(key)}`);
}
function parseAttackTiming(value: unknown): EvolutionFormModifiers['attackTiming'] | undefined {
  if (value === undefined) return undefined;
  const raw = record(value, 'explicit evolution attackTiming');
  const cycleFrames = integer(raw.cycleFrames, 'explicit evolution attackTiming.cycleFrames', 1);
  if (!Array.isArray(raw.hitFrames) || raw.hitFrames.length === 0) throw new Error('explicit evolution attackTiming.hitFrames must be non-empty');
  const hitFrames = raw.hitFrames.map((frame, index) => {
    const parsed = integer(frame, `explicit evolution attackTiming.hitFrames[${index}]`, 0);
    if (parsed >= cycleFrames) throw new Error('explicit evolution attackTiming hit frame must be inside cycleFrames');
    return parsed;
  });
  if (hitFrames.some((frame, index) => index > 0 && frame <= hitFrames[index - 1]!)) throw new Error('explicit evolution attackTiming.hitFrames must strictly increase');
  return {
    cycleFrames,
    hitFrames,
    backswingFrames: integer(raw.backswingFrames, 'explicit evolution attackTiming.backswingFrames', 0),
  };
}
function parseExplicitModifiers(value: unknown): EvolutionFormModifiers {
  const raw = record(value, 'explicit evolution modifiers');
  const targetMode = raw.targetMode;
  if (targetMode !== undefined && targetMode !== 'SINGLE' && targetMode !== 'AREA') throw new Error(`evolution modifier targetMode is unknown: ${String(targetMode)}`);
  const naturalKnockbackCount = raw.naturalKnockbackCount === undefined
    ? undefined
    : integer(raw.naturalKnockbackCount, 'evolution modifier naturalKnockbackCount', 0);
  const attackTiming = parseAttackTiming(raw.attackTiming);
  return {
    maxHpPermille: modifierInteger(raw, 'maxHpPermille', 1000),
    attackDamagePermille: modifierInteger(raw, 'attackDamagePermille', 1000),
    costPermille: modifierInteger(raw, 'costPermille', 1000),
    rechargePermille: modifierInteger(raw, 'rechargePermille', 1000),
    moveSpeedDelta: modifierNumber(raw, 'moveSpeedDelta', 0),
    standingRangeDelta: modifierInteger(raw, 'standingRangeDelta', 0),
    attackMinRangeDelta: modifierInteger(raw, 'attackMinRangeDelta', 0),
    attackMaxRangeDelta: modifierInteger(raw, 'attackMaxRangeDelta', 0),
    ...(targetMode === undefined ? {} : { targetMode }),
    ...(naturalKnockbackCount === undefined ? {} : { naturalKnockbackCount }),
    ...(attackTiming === undefined ? {} : { attackTiming }),
  };
}
function parseRecipeTuple(value: unknown, context: string): readonly [number, number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 5) throw new Error(`${context} must be [level,fragment,core,crown,gold]`);
  return [integer(value[0], `${context}.level`, 1), integer(value[1], `${context}.fragment`), integer(value[2], `${context}.core`), integer(value[3], `${context}.crown`), integer(value[4], `${context}.gold`)];
}

export function applyEvolutionCatalogOverrides(baseValue: unknown, overridesValue: unknown): readonly unknown[] {
  if (!Array.isArray(baseValue)) throw new Error('base evolution catalog must be an array');
  if (!Array.isArray(overridesValue)) throw new Error('evolution catalog overrides must be an array');
  const baseIds = new Set(baseValue.map((entry, index) => string(record(entry, `baseEvolutionCatalog[${index}]`).id, `baseEvolutionCatalog[${index}].id`)));
  const overrides = new Map<string, unknown>();
  for (let index = 0; index < overridesValue.length; index += 1) {
    const raw = record(overridesValue[index], `evolutionCatalogOverrides[${index}]`);
    const id = string(raw.id, `evolutionCatalogOverrides[${index}].id`);
    if (!baseIds.has(id)) throw new Error(`evolution catalog override references unknown character: ${id}`);
    if (overrides.has(id)) throw new Error(`duplicate evolution catalog override: ${id}`);
    overrides.set(id, overridesValue[index]);
  }
  return baseValue.map((entry, index) => {
    const raw = record(entry, `baseEvolutionCatalog[${index}]`);
    const id = string(raw.id, `baseEvolutionCatalog[${index}].id`);
    return overrides.get(id) ?? entry;
  });
}

export function buildEvolutionCatalog(value: unknown, knownCharacterIds: ReadonlySet<string>): EvolutionCatalog {
  if (!Array.isArray(value)) throw new Error('evolution catalog must be an array');
  const forms: EvolutionFormDefinition[] = [];
  const recipes: EvolutionRecipeDefinition[] = [];
  const characters = new Set<string>();
  const formIds = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const raw = record(value[index], `evolutionCatalog[${index}]`);
    const characterId = string(raw.id, `evolutionCatalog[${index}].id`);
    if (!knownCharacterIds.has(characterId)) throw new Error(`evolution catalog references unknown character: ${characterId}`);
    if (characters.has(characterId)) throw new Error(`duplicate evolution catalog character: ${characterId}`);
    characters.add(characterId);
    if (!Array.isArray(raw.names) || raw.names.length !== 3) throw new Error(`${characterId}.names must contain three names`);
    const names = raw.names.map((name, nameIndex) => string(name, `${characterId}.names[${nameIndex}]`));
    const template = string(raw.template, `${characterId}.template`) as EvolutionTemplateId;
    if (!['MASS','FRONTLINE','RANGED','AREA','FINISHER','TRICK','EXPLICIT'].includes(template)) throw new Error(`${characterId}.template is unknown: ${template}`);

    let characterForms: EvolutionFormDefinition[];
    if (template === 'EXPLICIT') {
      if (!Array.isArray(raw.forms) || raw.forms.length !== 3) throw new Error(`${characterId}.forms must contain three explicit forms`);
      characterForms = raw.forms.map((entry, formIndex) => {
        const form = record(entry, `${characterId}.forms[${formIndex}]`);
        const formOrder = integer(form.formOrder, `${characterId}.forms[${formIndex}].formOrder`, 1) as 1 | 2 | 3;
        if (formOrder !== formIndex + 1 || formOrder > 3) throw new Error(`${characterId} explicit forms must be ordered 1,2,3`);
        return {
          characterId,
          formId: string(form.formId, `${characterId}.forms[${formIndex}].formId`),
          formOrder,
          name: string(form.name, `${characterId}.forms[${formIndex}].name`),
          description: string(form.description, `${characterId}.forms[${formIndex}].description`),
          modifiers: parseExplicitModifiers(form.modifiers ?? {}),
        };
      });
    } else {
      const templatePair = EVOLUTION_ROLE_TEMPLATES[template];
      characterForms = [1, 2, 3].map((order): EvolutionFormDefinition => ({
        characterId,
        formId: `${characterId}_f${order}`,
        formOrder: order as 1 | 2 | 3,
        name: names[order - 1]!,
        description: order === 1
          ? `${names[0]}의 기본 전투 형태.`
          : order === 2
            ? `${names[0]}의 핵심 역할을 안정적으로 강화한 2형태.`
            : `${names[0]}의 역할을 후반 전투에 맞게 더욱 뾰족하게 확장한 3형태.`,
        modifiers: order === 1 ? BASE : templatePair[order - 2]!,
      }));
    }
    for (const form of characterForms) {
      if (formIds.has(form.formId)) throw new Error(`duplicate evolution form id: ${form.formId}`);
      formIds.add(form.formId);
      forms.push(form);
    }
    if (!Array.isArray(raw.recipes) || raw.recipes.length !== 2) throw new Error(`${characterId}.recipes must contain F2 and F3 recipes`);
    const tuples = raw.recipes.map((recipe, recipeIndex) => parseRecipeTuple(recipe, `${characterId}.recipes[${recipeIndex}]`));
    for (let recipeIndex = 0; recipeIndex < 2; recipeIndex += 1) {
      const [requiredBaseLevel, evo_fragment, evo_core, evo_crown, gold] = tuples[recipeIndex]!;
      const formOrder = (recipeIndex + 2) as 2 | 3;
      recipes.push({
        characterId,
        formId: characterForms[formOrder - 1]!.formId,
        formOrder,
        requiredBaseLevel,
        cost: { gold, evo_fragment, evo_core, evo_crown },
      });
    }
  }
  if (characters.size !== knownCharacterIds.size) {
    const missing = [...knownCharacterIds].filter((id) => !characters.has(id));
    throw new Error(`evolution catalog must cover every character; missing: ${missing.join(',')}`);
  }
  return { forms, recipes };
}

export function getEvolutionRecipe(recipes: readonly EvolutionRecipeDefinition[], formId: string): EvolutionRecipeDefinition {
  const recipe = recipes.find((candidate) => candidate.formId === formId);
  if (!recipe) throw new Error(`Evolution form has no paid unlock recipe: ${formId}`);
  return recipe;
}
