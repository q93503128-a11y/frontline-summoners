import {
  PERMANENT_REWARD_SCOPES,
  applyPercent as applyPercentShared,
  applyPermanentRewardBattleEffects as applyPermanentRewardBattleEffectsShared,
  type PermanentRewardApplicableSlot,
  type PermanentRewardBattleInput,
  type PermanentRewardBattleOutput,
  type PermanentRewardDefinition,
  type PermanentRewardModifier,
  type PermanentRewardScope,
  type PermanentRewardTargetScope,
} from '@frontline/sim/meta-progression';
import chapterOneRewardsJson from '../../../content/permanent-rewards/chapter-01.json' with { type: 'json' };
import chapterTwoRewardsJson from '../../../content/permanent-rewards/chapter-02.json' with { type: 'json' };

export const REWARD_SCOPES = PERMANENT_REWARD_SCOPES;
export type RewardScope = PermanentRewardScope;
export type RewardTargetScope = PermanentRewardTargetScope;
export type {
  PermanentRewardApplicableSlot,
  PermanentRewardBattleInput,
  PermanentRewardBattleOutput,
  PermanentRewardDefinition,
  PermanentRewardModifier,
};

const KNOWN_SCOPES = new Set<string>(['ALL', ...REWARD_SCOPES]);
const KNOWN_KINDS = new Set<string>([
  'UNIT_HP_PERCENT',
  'UNIT_ATTACK_PERCENT',
  'STARTING_SUPPLY_PERCENT',
  'PLAYER_BASE_HP_PERCENT',
  'KILL_SUPPLY_PERCENT',
  'WORKER_COST_REDUCTION_PERCENT',
  'RECHARGE_REDUCTION_PERCENT',
  'CHAPTER_FLAG',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requirePercent(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
    throw new Error(`${context} must be an integer in 0..100`);
  }
  return value as number;
}

function parseModifier(value: unknown, context: string): PermanentRewardModifier {
  if (!isRecord(value) || typeof value.kind !== 'string' || !KNOWN_KINDS.has(value.kind)) {
    throw new Error(`${context}.kind is unknown: ${String(isRecord(value) ? value.kind : undefined)}`);
  }
  if (value.kind === 'CHAPTER_FLAG') {
    if (typeof value.flag !== 'string' || value.flag.trim().length === 0) throw new Error(`${context}.flag must be a non-empty string`);
    return { kind: 'CHAPTER_FLAG', flag: value.flag };
  }
  if (value.kind === 'UNIT_HP_PERCENT' || value.kind === 'UNIT_ATTACK_PERCENT') {
    if (typeof value.scope !== 'string' || !KNOWN_SCOPES.has(value.scope)) throw new Error(`${context}.scope is unknown: ${String(value.scope)}`);
    return { kind: value.kind, scope: value.scope as RewardTargetScope, percent: requirePercent(value.percent, `${context}.percent`) };
  }
  const percent = requirePercent(value.percent, `${context}.percent`);
  if (value.kind === 'STARTING_SUPPLY_PERCENT') return { kind: value.kind, percent };
  if (value.kind === 'PLAYER_BASE_HP_PERCENT') return { kind: value.kind, percent };
  if (value.kind === 'KILL_SUPPLY_PERCENT') return { kind: value.kind, percent };
  if (value.kind === 'WORKER_COST_REDUCTION_PERCENT') return { kind: value.kind, percent };
  return { kind: 'RECHARGE_REDUCTION_PERCENT', percent };
}

function parseDefinitions(value: unknown): readonly PermanentRewardDefinition[] {
  if (!Array.isArray(value)) throw new Error('permanent rewards must be an array');
  const ids = new Set<string>();
  return value.map((raw, index) => {
    const context = `permanentRewards[${index}]`;
    if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.trim().length === 0) throw new Error(`${context}.id must be a non-empty string`);
    if (ids.has(raw.id)) throw new Error(`duplicate permanent reward id: ${raw.id}`);
    ids.add(raw.id);
    if (!Array.isArray(raw.modifiers) || raw.modifiers.length === 0) throw new Error(`${context}.modifiers must be non-empty`);
    return {
      id: raw.id,
      modifiers: raw.modifiers.map((modifier, modifierIndex) => parseModifier(modifier, `${context}.modifiers[${modifierIndex}]`)),
    };
  });
}

const chapterOneRewards = parseDefinitions(chapterOneRewardsJson);
const chapterTwoRewards = parseDefinitions(chapterTwoRewardsJson);
const rewardIds = new Set(chapterOneRewards.map((reward) => reward.id));
for (const reward of chapterTwoRewards) {
  if (rewardIds.has(reward.id)) throw new Error(`chapter-two permanent reward duplicates existing id: ${reward.id}`);
  rewardIds.add(reward.id);
}
export const PERMANENT_REWARDS: readonly PermanentRewardDefinition[] = [...chapterOneRewards, ...chapterTwoRewards];

export function applyPercent(value: number, percent: number, minimum = 1): number {
  return applyPercentShared(value, percent, minimum);
}

export function applyPermanentRewardBattleEffects<TSlot extends PermanentRewardApplicableSlot>(
  input: PermanentRewardBattleInput<TSlot>,
): PermanentRewardBattleOutput<TSlot> {
  return applyPermanentRewardBattleEffectsShared(input, PERMANENT_REWARDS);
}
