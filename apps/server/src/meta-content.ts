import {
  ATTRIBUTES,
  COMBAT_TAGS,
  DAMAGE_BONUS_TARGET_KINDS,
  TARGET_MODES,
  type DamageBonusContent,
  type TargetMode,
} from '@frontline/content-schema';
import {
  PERMANENT_REWARD_SCOPES,
  type CharacterLevelCurve,
  type EvolutionFormDefinition,
  type EvolutionFormModifiers,
  type PermanentRewardDefinition,
  type PermanentRewardModifier,
  type PermanentRewardScope,
  type PermanentRewardTargetScope,
} from '@frontline/sim/meta-progression';
import levelCurveJson from '../../../content/growth/level-curve-01.json' with { type: 'json' };
import evolutionJson from '../../../content/evolution/recruitment-01.json' with { type: 'json' };
import permanentRewardsJson from '../../../content/permanent-rewards/chapter-01.json' with { type: 'json' };
import rewardScopesJson from '../../../content/permanent-rewards/reward-scopes.json' with { type: 'json' };

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}
function nonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
}
function integer(value: unknown, context: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${context} must be an integer in ${min}..${max}`);
  return value as number;
}
function signedInteger(value: unknown, context: string, fallback = 0): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value)) throw new Error(`${context} must be an integer`);
  return value as number;
}

function parseLevelCurve(value: unknown): CharacterLevelCurve {
  const raw = record(value, 'server level curve');
  if (raw.status !== 'DESIGN_TARGET') throw new Error('server level curve status must be DESIGN_TARGET');
  const levelCap = integer(raw.levelCap, 'server levelCap', 1, 100);
  const plusLevelCap = integer(raw.plusLevelCap, 'server plusLevelCap', 0, 200);
  if (!Array.isArray(raw.anchors) || raw.anchors.length < 2) throw new Error('server level curve anchors must contain at least two entries');
  const anchors = raw.anchors.map((entry, index) => {
    const anchor = record(entry, `server anchors[${index}]`);
    return {
      level: integer(anchor.level, `server anchors[${index}].level`, 1, levelCap),
      multiplierPermille: integer(anchor.multiplierPermille, `server anchors[${index}].multiplierPermille`, 1, 100000),
    };
  });
  if (anchors[0]!.level !== 1 || anchors[anchors.length - 1]!.level !== levelCap) throw new Error('server level curve anchors must start at 1 and end at levelCap');
  for (let index = 1; index < anchors.length; index += 1) {
    if (anchors[index]!.level <= anchors[index - 1]!.level) throw new Error('server level curve anchor levels must strictly increase');
    if (anchors[index]!.multiplierPermille < anchors[index - 1]!.multiplierPermille) throw new Error('server level curve multipliers must not decrease');
  }
  return {
    id: nonEmptyString(raw.id, 'server level curve id'),
    status: 'DESIGN_TARGET',
    levelCap,
    plusLevelCap,
    plusHpAttackPermillePerLevel: integer(raw.plusHpAttackPermillePerLevel, 'server plus growth', 0, 5000),
    anchors,
  };
}

function parseDamageBonuses(value: unknown, context: string): readonly DamageBonusContent[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  const bonuses = value.map((entry, index): DamageBonusContent => {
    const raw = record(entry, `${context}[${index}]`);
    const targetKind = nonEmptyString(raw.targetKind, `${context}[${index}].targetKind`);
    if (!(DAMAGE_BONUS_TARGET_KINDS as readonly string[]).includes(targetKind)) throw new Error(`${context}[${index}].targetKind is unknown`);
    const target = nonEmptyString(raw.target, `${context}[${index}].target`);
    const multiplierPermille = integer(raw.multiplierPermille, `${context}[${index}].multiplierPermille`, 1000, 3000);
    if (targetKind === 'ATTRIBUTE') {
      if (!(ATTRIBUTES as readonly string[]).includes(target)) throw new Error(`${context}[${index}].target attribute is unknown`);
      return { targetKind, target: target as (typeof ATTRIBUTES)[number], multiplierPermille };
    }
    if (!(COMBAT_TAGS as readonly string[]).includes(target)) throw new Error(`${context}[${index}].target tag is unknown`);
    return { targetKind: 'TAG', target: target as (typeof COMBAT_TAGS)[number], multiplierPermille };
  });
  const keys = bonuses.map((bonus) => `${bonus.targetKind}:${bonus.target}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${context} targets must be unique`);
  return bonuses;
}

function parseModifiers(value: unknown, context: string): EvolutionFormModifiers {
  const raw = record(value, context);
  let targetMode: TargetMode | undefined;
  if (raw.targetMode !== undefined) {
    if (typeof raw.targetMode !== 'string' || !(TARGET_MODES as readonly string[]).includes(raw.targetMode)) throw new Error(`${context}.targetMode is unknown`);
    targetMode = raw.targetMode as TargetMode;
  }
  const damageBonuses = parseDamageBonuses(raw.damageBonuses, `${context}.damageBonuses`);
  return {
    maxHpPermille: raw.maxHpPermille === undefined ? 1000 : integer(raw.maxHpPermille, `${context}.maxHpPermille`, 1, 5000),
    attackDamagePermille: raw.attackDamagePermille === undefined ? 1000 : integer(raw.attackDamagePermille, `${context}.attackDamagePermille`, 0, 5000),
    costPermille: raw.costPermille === undefined ? 1000 : integer(raw.costPermille, `${context}.costPermille`, 0, 5000),
    rechargePermille: raw.rechargePermille === undefined ? 1000 : integer(raw.rechargePermille, `${context}.rechargePermille`, 1, 5000),
    moveSpeedDelta: signedInteger(raw.moveSpeedDelta, `${context}.moveSpeedDelta`),
    standingRangeDelta: signedInteger(raw.standingRangeDelta, `${context}.standingRangeDelta`),
    attackMinRangeDelta: signedInteger(raw.attackMinRangeDelta, `${context}.attackMinRangeDelta`),
    attackMaxRangeDelta: signedInteger(raw.attackMaxRangeDelta, `${context}.attackMaxRangeDelta`),
    ...(targetMode === undefined ? {} : { targetMode }),
    ...(damageBonuses === undefined ? {} : { damageBonuses }),
  };
}

function parseEvolutionForms(value: unknown): readonly EvolutionFormDefinition[] {
  if (!Array.isArray(value)) throw new Error('server evolution content must be an array');
  const characters = new Set<string>();
  const formIds = new Set<string>();
  const result: EvolutionFormDefinition[] = [];
  value.forEach((entry, entryIndex) => {
    const raw = record(entry, `server evolution[${entryIndex}]`);
    const characterId = nonEmptyString(raw.characterId, `server evolution[${entryIndex}].characterId`);
    if (characters.has(characterId)) throw new Error(`duplicate server evolution character: ${characterId}`);
    characters.add(characterId);
    if (!Array.isArray(raw.forms) || raw.forms.length !== 3) throw new Error(`${characterId} must define exactly three server forms`);
    raw.forms.forEach((entry, formIndex) => {
      const form = record(entry, `${characterId}.forms[${formIndex}]`);
      const formId = nonEmptyString(form.formId, `${characterId}.forms[${formIndex}].formId`);
      if (formIds.has(formId)) throw new Error(`duplicate server evolution form id: ${formId}`);
      formIds.add(formId);
      const formOrder = integer(form.formOrder, `${formId}.formOrder`, 1, 3) as 1 | 2 | 3;
      if (formOrder !== formIndex + 1) throw new Error(`${characterId} server forms must be ordered 1,2,3`);
      result.push({
        characterId,
        formId,
        formOrder,
        name: nonEmptyString(form.name, `${formId}.name`),
        description: nonEmptyString(form.description, `${formId}.description`),
        modifiers: parseModifiers(form.modifiers ?? {}, `${formId}.modifiers`),
      });
    });
  });
  return result;
}

const KNOWN_REWARD_SCOPES = new Set<string>(['ALL', ...PERMANENT_REWARD_SCOPES]);
const KNOWN_REWARD_KINDS = new Set<string>([
  'UNIT_HP_PERCENT',
  'UNIT_ATTACK_PERCENT',
  'STARTING_SUPPLY_PERCENT',
  'PLAYER_BASE_HP_PERCENT',
  'KILL_SUPPLY_PERCENT',
  'WORKER_COST_REDUCTION_PERCENT',
  'RECHARGE_REDUCTION_PERCENT',
  'CHAPTER_FLAG',
]);

function percent(value: unknown, context: string): number {
  return integer(value, context, 0, 100);
}

function parseRewardModifier(value: unknown, context: string): PermanentRewardModifier {
  const raw = record(value, context);
  const kind = nonEmptyString(raw.kind, `${context}.kind`);
  if (!KNOWN_REWARD_KINDS.has(kind)) throw new Error(`${context}.kind is unknown: ${kind}`);
  if (kind === 'CHAPTER_FLAG') return { kind, flag: nonEmptyString(raw.flag, `${context}.flag`) };
  if (kind === 'UNIT_HP_PERCENT' || kind === 'UNIT_ATTACK_PERCENT') {
    const scope = nonEmptyString(raw.scope, `${context}.scope`);
    if (!KNOWN_REWARD_SCOPES.has(scope)) throw new Error(`${context}.scope is unknown: ${scope}`);
    return { kind, scope: scope as PermanentRewardTargetScope, percent: percent(raw.percent, `${context}.percent`) };
  }
  const parsedPercent = percent(raw.percent, `${context}.percent`);
  if (kind === 'STARTING_SUPPLY_PERCENT') return { kind, percent: parsedPercent };
  if (kind === 'PLAYER_BASE_HP_PERCENT') return { kind, percent: parsedPercent };
  if (kind === 'KILL_SUPPLY_PERCENT') return { kind, percent: parsedPercent };
  if (kind === 'WORKER_COST_REDUCTION_PERCENT') return { kind, percent: parsedPercent };
  return { kind: 'RECHARGE_REDUCTION_PERCENT', percent: parsedPercent };
}

function parsePermanentRewards(value: unknown): readonly PermanentRewardDefinition[] {
  if (!Array.isArray(value)) throw new Error('server permanent rewards must be an array');
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const raw = record(entry, `server permanentRewards[${index}]`);
    const id = nonEmptyString(raw.id, `server permanentRewards[${index}].id`);
    if (ids.has(id)) throw new Error(`duplicate server permanent reward id: ${id}`);
    ids.add(id);
    if (!Array.isArray(raw.modifiers) || raw.modifiers.length === 0) throw new Error(`${id}.modifiers must be non-empty`);
    return {
      id,
      modifiers: raw.modifiers.map((modifier, modifierIndex) => parseRewardModifier(modifier, `${id}.modifiers[${modifierIndex}]`)),
    };
  });
}

function parseRewardScopes(value: unknown): ReadonlyMap<string, readonly PermanentRewardScope[]> {
  const raw = record(value, 'server reward scopes');
  const result = new Map<string, readonly PermanentRewardScope[]>();
  for (const [characterId, scopesValue] of Object.entries(raw)) {
    if (!Array.isArray(scopesValue) || scopesValue.length === 0) throw new Error(`server reward scopes must be non-empty for ${characterId}`);
    const scopes = scopesValue.map((scope, index) => {
      if (typeof scope !== 'string' || !(PERMANENT_REWARD_SCOPES as readonly string[]).includes(scope)) {
        throw new Error(`server reward scope is unknown for ${characterId}[${index}]`);
      }
      return scope as PermanentRewardScope;
    });
    if (new Set(scopes).size !== scopes.length) throw new Error(`duplicate server reward scope for ${characterId}`);
    result.set(characterId, scopes);
  }
  return result;
}

export const SERVER_CHARACTER_LEVEL_CURVE = parseLevelCurve(levelCurveJson);
export const SERVER_EVOLUTION_FORMS = parseEvolutionForms(evolutionJson);
export const SERVER_PERMANENT_REWARDS = parsePermanentRewards(permanentRewardsJson);
export const SERVER_REWARD_SCOPES_BY_CHARACTER = parseRewardScopes(rewardScopesJson);
