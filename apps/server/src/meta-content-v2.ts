import {
  type PermanentRewardDefinition,
  type PermanentRewardModifier,
  type PermanentRewardTargetScope,
} from '@frontline/sim/meta-progression';
import chapterTwoRewardsJson from '../../../content/permanent-rewards/chapter-02.json' with { type: 'json' };
import chapterThreeRewardsJson from '../../../content/permanent-rewards/chapter-03.json' with { type: 'json' };
import {
  SERVER_CHARACTER_LEVEL_CURVE,
  SERVER_EVOLUTION_FORMS,
  SERVER_PERMANENT_REWARDS as SERVER_CHAPTER_ONE_PERMANENT_REWARDS,
  SERVER_REWARD_SCOPES_BY_CHARACTER,
} from './meta-content.ts';

export {
  SERVER_CHARACTER_LEVEL_CURVE,
  SERVER_EVOLUTION_FORMS,
  SERVER_REWARD_SCOPES_BY_CHARACTER,
};

const KNOWN_REWARD_SCOPES = new Set<string>(['ALL', 'FRONTLINE', 'RANGED', 'AREA']);
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

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}
function nonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context} must be a non-empty string`);
  return value;
}
function percent(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) throw new Error(`${context} must be an integer in 0..100`);
  return value as number;
}
function parseModifier(value: unknown, context: string): PermanentRewardModifier {
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
function parseDefinitions(value: unknown, label: string): readonly PermanentRewardDefinition[] {
  if (!Array.isArray(value)) throw new Error(`${label} server permanent rewards must be an array`);
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const raw = record(entry, `${label}Rewards[${index}]`);
    const id = nonEmptyString(raw.id, `${label}Rewards[${index}].id`);
    if (ids.has(id)) throw new Error(`duplicate ${label} permanent reward id:${id}`);
    ids.add(id);
    if (!Array.isArray(raw.modifiers) || raw.modifiers.length === 0) throw new Error(`${id}.modifiers must be non-empty`);
    return { id, modifiers: raw.modifiers.map((modifier, modifierIndex) => parseModifier(modifier, `${id}.modifiers[${modifierIndex}]`)) };
  });
}

const chapterTwoRewards = parseDefinitions(chapterTwoRewardsJson, 'chapterTwo');
const chapterThreeRewards = parseDefinitions(chapterThreeRewardsJson, 'chapterThree');
const allRewards = [...SERVER_CHAPTER_ONE_PERMANENT_REWARDS, ...chapterTwoRewards, ...chapterThreeRewards];
if (new Set(allRewards.map((reward) => reward.id)).size !== allRewards.length) throw new Error('server permanent reward ids must be globally unique');
export const SERVER_PERMANENT_REWARDS: readonly PermanentRewardDefinition[] = allRewards;
