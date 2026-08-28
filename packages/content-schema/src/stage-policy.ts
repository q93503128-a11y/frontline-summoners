export const MULTIPLAYER_POLICIES = ['SOLO_ONLY', 'SOLO_OR_COOP', 'COOP_ONLY'] as const;
export type MultiplayerPolicy = (typeof MULTIPLAYER_POLICIES)[number];

export const REPLAY_ELIGIBILITIES = ['NEVER', 'AFTER_NORMAL_CLEAR'] as const;
export type ReplayEligibility = (typeof REPLAY_ELIGIBILITIES)[number];

export const REWARD_CHARGE_POLICIES = ['NONE', 'COLLECTION_CHARGE'] as const;
export type RewardChargePolicy = (typeof REWARD_CHARGE_POLICIES)[number];

export interface CoopStatScalingContent {
  readonly enemyHpPermille: number;
  readonly enemyAttackPermille: number;
  readonly enemyBaseHpPermille: number;
}

export interface StagePolicyContent {
  readonly stageId: string;
  readonly multiplayerPolicy: MultiplayerPolicy;
  readonly speedUpEligibility: ReplayEligibility;
  readonly sweepEligibility: ReplayEligibility;
  readonly rewardChargePolicy: RewardChargePolicy;
  readonly coopStatScaling: CoopStatScalingContent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context}.${key} must be a non-empty string`);
  return value;
}

function requireInteger(record: Record<string, unknown>, key: string, context: string, min: number, max: number): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${context}.${key} must be an integer in ${min}..${max}`);
  }
  return value as number;
}

function requireEnum<T extends readonly string[]>(record: Record<string, unknown>, key: string, context: string, values: T): T[number] {
  const value = requireString(record, key, context);
  if (!(values as readonly string[]).includes(value)) throw new Error(`${context}.${key} is unknown: ${value}`);
  return value as T[number];
}

function parseCoopScaling(value: unknown, context: string): CoopStatScalingContent {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  return {
    enemyHpPermille: requireInteger(value, 'enemyHpPermille', context, 100, 5000),
    enemyAttackPermille: requireInteger(value, 'enemyAttackPermille', context, 100, 5000),
    enemyBaseHpPermille: requireInteger(value, 'enemyBaseHpPermille', context, 100, 5000),
  };
}

export function parseStagePolicies(value: unknown, expectedStageIds?: ReadonlySet<string>): readonly StagePolicyContent[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('stage policies must be a non-empty array');
  const ids = new Set<string>();
  const policies = value.map((raw, index): StagePolicyContent => {
    const context = `stagePolicies[${index}]`;
    if (!isRecord(raw)) throw new Error(`${context} must be an object`);
    const stageId = requireString(raw, 'stageId', context);
    if (ids.has(stageId)) throw new Error(`duplicate stage policy id: ${stageId}`);
    ids.add(stageId);
    if (expectedStageIds && !expectedStageIds.has(stageId)) throw new Error(`${context}.stageId references unknown stage: ${stageId}`);

    const multiplayerPolicy = requireEnum(raw, 'multiplayerPolicy', context, MULTIPLAYER_POLICIES);
    const coopStatScaling = parseCoopScaling(raw.coopStatScaling, `${context}.coopStatScaling`);
    if (multiplayerPolicy === 'SOLO_ONLY') {
      const neutral = coopStatScaling.enemyHpPermille === 1000
        && coopStatScaling.enemyAttackPermille === 1000
        && coopStatScaling.enemyBaseHpPermille === 1000;
      if (!neutral) throw new Error(`${context}.SOLO_ONLY stage must use neutral coopStatScaling`);
    }

    return {
      stageId,
      multiplayerPolicy,
      speedUpEligibility: requireEnum(raw, 'speedUpEligibility', context, REPLAY_ELIGIBILITIES),
      sweepEligibility: requireEnum(raw, 'sweepEligibility', context, REPLAY_ELIGIBILITIES),
      rewardChargePolicy: requireEnum(raw, 'rewardChargePolicy', context, REWARD_CHARGE_POLICIES),
      coopStatScaling,
    };
  });

  if (expectedStageIds) {
    for (const stageId of expectedStageIds) {
      if (!ids.has(stageId)) throw new Error(`missing stage policy: ${stageId}`);
    }
    if (ids.size !== expectedStageIds.size) throw new Error(`stage policy count mismatch: expected ${expectedStageIds.size}, got ${ids.size}`);
  }
  return policies;
}
