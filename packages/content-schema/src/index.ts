export const RARITIES = ['C', 'B', 'A', 'S', 'SS'] as const;
export type Rarity = (typeof RARITIES)[number];

export const PLAYER_ROLES = ['물량', '전열', '원거리', '광역', '결정타', '변칙'] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

export const TARGET_MODES = ['SINGLE', 'AREA'] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

export const COMBAT_TRAITS = ['LIGHT', 'ARMORED', 'ARCANE', 'BOSS'] as const;
export type CombatTrait = (typeof COMBAT_TRAITS)[number];

export interface TraitDamageBonusContent {
  readonly trait: CombatTrait;
  readonly multiplierPermille: number;
}

export const BATTLEFIELD_THEME_IDS = ['meadow', 'canyon', 'burning', 'ruins', 'moon', 'fortress', 'golden'] as const;
export type BattlefieldThemeId = (typeof BATTLEFIELD_THEME_IDS)[number];

export interface CombatContent {
  readonly id: string;
  readonly displayName: string;
  readonly maxHp: number;
  readonly attackDamage: number;
  readonly moveSpeed: number;
  readonly standingRange: number;
  readonly attackMinRange: number;
  readonly attackMaxRange: number;
  readonly cycleFrames: number;
  readonly hitFrames: readonly number[];
  readonly backswingFrames: number;
  readonly naturalKnockbackCount: number;
  readonly targetMode: TargetMode;
  readonly traits: readonly CombatTrait[];
  readonly damageBonuses: readonly TraitDamageBonusContent[];
}

export interface PlayerUnitContent extends CombatContent {
  readonly rarity: Rarity;
  readonly role: PlayerRole;
  readonly description: string;
  readonly cost: number;
  readonly rechargeFrames: number;
}

export interface EnemyContent extends CombatContent {
  readonly rewardSupply: number;
}

export interface CampaignWaveContent {
  readonly enemyId: string;
  readonly atTick: number;
  readonly count: number;
  readonly intervalTicks: number;
}

export interface CampaignTreasureContent {
  readonly id: string;
  readonly name: string;
  readonly effect: string;
}

export interface CampaignStageContent {
  readonly id: string;
  readonly chapter: string;
  readonly name: string;
  readonly subtitle: string;
  readonly difficulty: number;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
  readonly startingSupply: number;
  readonly mapLength: number;
  readonly theme: BattlefieldThemeId;
  readonly decorSeed: number;
  readonly waves: readonly CampaignWaveContent[];
  readonly treasure: CampaignTreasureContent;
  readonly unlockUnitId?: string;
}

export interface CampaignContentBundle {
  readonly playerUnits: readonly PlayerUnitContent[];
  readonly enemies: readonly EnemyContent[];
  readonly stages: readonly CampaignStageContent[];
}

export interface CampaignValidationOptions {
  readonly enemyIds?: ReadonlySet<string> | undefined;
  readonly playerUnitIds?: ReadonlySet<string> | undefined;
  readonly expectedStageCount?: number | undefined;
  readonly requiredThemeCount?: number | undefined;
  readonly starterUnitId?: string | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${context}.${key} must be a non-empty string`);
  return value;
}

function requireInteger(record: Record<string, unknown>, key: string, context: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${context}.${key} must be an integer in ${min}..${max}`);
  return value as number;
}

function requireEnum<T extends readonly string[]>(record: Record<string, unknown>, key: string, context: string, values: T): T[number] {
  const value = requireString(record, key, context);
  if (!(values as readonly string[]).includes(value)) throw new Error(`${context}.${key} is unknown: ${value}`);
  return value as T[number];
}

function requireHitFrames(record: Record<string, unknown>, context: string, cycleFrames: number): readonly number[] {
  const value = record.hitFrames;
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${context}.hitFrames must be a non-empty array`);
  const frames = value.map((frame, index) => {
    if (!Number.isInteger(frame) || (frame as number) < 0 || (frame as number) >= cycleFrames) {
      throw new Error(`${context}.hitFrames[${index}] must be inside cycleFrames`);
    }
    return frame as number;
  });
  if (frames.some((frame, index) => index > 0 && frame <= frames[index - 1]!)) throw new Error(`${context}.hitFrames must be strictly increasing`);
  return frames;
}

function parseTraits(record: Record<string, unknown>, context: string): readonly CombatTrait[] {
  const raw = record.traits;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${context}.traits must be an array`);
  const traits = raw.map((trait, index) => {
    if (typeof trait !== 'string' || !(COMBAT_TRAITS as readonly string[]).includes(trait)) {
      throw new Error(`${context}.traits[${index}] is unknown: ${String(trait)}`);
    }
    return trait as CombatTrait;
  });
  if (new Set(traits).size !== traits.length) throw new Error(`${context}.traits must be unique`);
  return traits;
}

function parseDamageBonuses(record: Record<string, unknown>, context: string): readonly TraitDamageBonusContent[] {
  const raw = record.damageBonuses;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${context}.damageBonuses must be an array`);
  const bonuses = raw.map((bonus, index) => {
    const itemContext = `${context}.damageBonuses[${index}]`;
    if (!isRecord(bonus)) throw new Error(`${itemContext} must be an object`);
    return {
      trait: requireEnum(bonus, 'trait', itemContext, COMBAT_TRAITS),
      multiplierPermille: requireInteger(bonus, 'multiplierPermille', itemContext, 1000, 3000),
    };
  });
  if (new Set(bonuses.map((bonus) => bonus.trait)).size !== bonuses.length) throw new Error(`${context}.damageBonuses traits must be unique`);
  return bonuses;
}

function parseCombat(value: unknown, context: string): CombatContent {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const cycleFrames = requireInteger(value, 'cycleFrames', context, 1, 3600);
  const attackMinRange = requireInteger(value, 'attackMinRange', context, 0, 10000);
  const attackMaxRange = requireInteger(value, 'attackMaxRange', context, 0, 10000);
  const standingRange = requireInteger(value, 'standingRange', context, 0, 10000);
  if (attackMinRange > attackMaxRange) throw new Error(`${context}.attackMinRange must be <= attackMaxRange`);
  return {
    id: requireString(value, 'id', context),
    displayName: requireString(value, 'displayName', context),
    maxHp: requireInteger(value, 'maxHp', context, 1, 10000000),
    attackDamage: requireInteger(value, 'attackDamage', context, 0, 10000000),
    moveSpeed: requireInteger(value, 'moveSpeed', context, 0, 1000),
    standingRange,
    attackMinRange,
    attackMaxRange,
    cycleFrames,
    hitFrames: requireHitFrames(value, context, cycleFrames),
    backswingFrames: requireInteger(value, 'backswingFrames', context, 0, 3600),
    naturalKnockbackCount: requireInteger(value, 'naturalKnockbackCount', context, 0, 100),
    targetMode: requireEnum(value, 'targetMode', context, TARGET_MODES),
    traits: parseTraits(value, context),
    damageBonuses: parseDamageBonuses(value, context),
  };
}

export function parsePlayerUnits(value: unknown): readonly PlayerUnitContent[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('player units must be a non-empty array');
  const ids = new Set<string>();
  return value.map((raw, index) => {
    const context = `playerUnits[${index}]`;
    if (!isRecord(raw)) throw new Error(`${context} must be an object`);
    const combat = parseCombat(raw, context);
    if (ids.has(combat.id)) throw new Error(`duplicate player unit id: ${combat.id}`);
    ids.add(combat.id);
    return {
      ...combat,
      rarity: requireEnum(raw, 'rarity', context, RARITIES),
      role: requireEnum(raw, 'role', context, PLAYER_ROLES),
      description: requireString(raw, 'description', context),
      cost: requireInteger(raw, 'cost', context, 0, 1000000),
      rechargeFrames: requireInteger(raw, 'rechargeFrames', context, 1, 36000),
    };
  });
}

export function parseEnemies(value: unknown): readonly EnemyContent[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('enemies must be a non-empty array');
  const ids = new Set<string>();
  return value.map((raw, index) => {
    const context = `enemies[${index}]`;
    if (!isRecord(raw)) throw new Error(`${context} must be an object`);
    const combat = parseCombat(raw, context);
    if (ids.has(combat.id)) throw new Error(`duplicate enemy id: ${combat.id}`);
    ids.add(combat.id);
    return { ...combat, rewardSupply: requireInteger(raw, 'rewardSupply', context, 0, 1000000) };
  });
}

function parseWave(value: unknown, context: string, enemyIds?: ReadonlySet<string>): CampaignWaveContent {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const enemyId = requireString(value, 'enemyId', context);
  if (enemyIds && !enemyIds.has(enemyId)) throw new Error(`${context}.enemyId references unknown enemy: ${enemyId}`);
  return {
    enemyId,
    atTick: requireInteger(value, 'atTick', context, 0),
    count: requireInteger(value, 'count', context, 1, 1000),
    intervalTicks: requireInteger(value, 'intervalTicks', context, 1),
  };
}

function parseTreasure(value: unknown, context: string): CampaignTreasureContent {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  return { id: requireString(value, 'id', context), name: requireString(value, 'name', context), effect: requireString(value, 'effect', context) };
}

function parseStage(value: unknown, index: number, options: CampaignValidationOptions): CampaignStageContent {
  const context = `stages[${index}]`;
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const theme = requireEnum(value, 'theme', context, BATTLEFIELD_THEME_IDS);
  const wavesValue = value.waves;
  if (!Array.isArray(wavesValue) || wavesValue.length === 0) throw new Error(`${context}.waves must contain at least one wave`);
  const unlockRaw = value.unlockUnitId;
  const unlockUnitId = unlockRaw === undefined ? undefined : requireString(value, 'unlockUnitId', context);
  if (unlockUnitId && options.playerUnitIds && !options.playerUnitIds.has(unlockUnitId)) throw new Error(`${context}.unlockUnitId references unknown player unit: ${unlockUnitId}`);
  if (unlockUnitId && options.starterUnitId && unlockUnitId === options.starterUnitId) throw new Error(`${context} must not unlock the starter unit again`);

  const base: Omit<CampaignStageContent, 'unlockUnitId'> = {
    id: requireString(value, 'id', context),
    chapter: requireString(value, 'chapter', context),
    name: requireString(value, 'name', context),
    subtitle: requireString(value, 'subtitle', context),
    difficulty: requireInteger(value, 'difficulty', context, 1, 5),
    playerBaseHp: requireInteger(value, 'playerBaseHp', context, 1),
    enemyBaseHp: requireInteger(value, 'enemyBaseHp', context, 1),
    startingSupply: requireInteger(value, 'startingSupply', context, 0, 100000),
    mapLength: requireInteger(value, 'mapLength', context, 500, 5000),
    theme,
    decorSeed: requireInteger(value, 'decorSeed', context, 0),
    waves: wavesValue.map((wave, waveIndex) => parseWave(wave, `${context}.waves[${waveIndex}]`, options.enemyIds)),
    treasure: parseTreasure(value.treasure, `${context}.treasure`),
  };
  return unlockUnitId === undefined ? base : { ...base, unlockUnitId };
}

export function parseCampaignStages(value: unknown, options: CampaignValidationOptions = {}): readonly CampaignStageContent[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('campaign stages must be a non-empty array');
  if (options.expectedStageCount !== undefined && value.length !== options.expectedStageCount) {
    throw new Error(`campaign must contain exactly ${options.expectedStageCount} stages, got ${value.length}`);
  }
  const stages = value.map((stage, index) => parseStage(stage, index, options));
  const stageIds = new Set<string>();
  const treasureIds = new Set<string>();
  const unlockIds = new Set<string>();
  const themes = new Set<BattlefieldThemeId>();

  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index]!;
    if (stageIds.has(stage.id)) throw new Error(`duplicate stage id: ${stage.id}`);
    if (treasureIds.has(stage.treasure.id)) throw new Error(`duplicate treasure id: ${stage.treasure.id}`);
    stageIds.add(stage.id);
    treasureIds.add(stage.treasure.id);
    themes.add(stage.theme);
    if (stage.unlockUnitId) {
      if (unlockIds.has(stage.unlockUnitId)) throw new Error(`player unit is unlocked more than once: ${stage.unlockUnitId}`);
      unlockIds.add(stage.unlockUnitId);
    }
    const waveStarts = stage.waves.map((wave) => wave.atTick);
    if (waveStarts.some((tick, waveIndex) => waveIndex > 0 && tick < waveStarts[waveIndex - 1]!)) throw new Error(`${stage.id} waves must be ordered by atTick`);
    const previous = stages[index - 1];
    if (previous && stage.mapLength === previous.mapLength && stage.theme === previous.theme) throw new Error(`${stage.id} repeats both theme and mapLength from the immediately previous stage`);
  }

  if (options.requiredThemeCount !== undefined && themes.size < options.requiredThemeCount) throw new Error(`campaign must use at least ${options.requiredThemeCount} battlefield themes, got ${themes.size}`);
  return stages;
}

export function parseCampaignBundle(input: {
  readonly playerUnits: unknown;
  readonly enemies: unknown;
  readonly stages: unknown;
  readonly starterUnitId: string;
  readonly expectedStageCount?: number | undefined;
  readonly requiredThemeCount?: number | undefined;
}): CampaignContentBundle {
  const playerUnits = parsePlayerUnits(input.playerUnits);
  const enemies = parseEnemies(input.enemies);
  const playerUnitIds = new Set(playerUnits.map((unit) => unit.id));
  const enemyIds = new Set(enemies.map((enemy) => enemy.id));
  if (!playerUnitIds.has(input.starterUnitId)) throw new Error(`starter unit does not exist: ${input.starterUnitId}`);
  const stages = parseCampaignStages(input.stages, {
    playerUnitIds,
    enemyIds,
    starterUnitId: input.starterUnitId,
    expectedStageCount: input.expectedStageCount,
    requiredThemeCount: input.requiredThemeCount,
  });
  const unlockedIds = new Set(stages.flatMap((stage) => stage.unlockUnitId ? [stage.unlockUnitId] : []));
  for (const unit of playerUnits) {
    if (unit.id !== input.starterUnitId && !unlockedIds.has(unit.id)) throw new Error(`player unit is never unlocked by campaign: ${unit.id}`);
  }
  if (unlockedIds.size !== playerUnits.length - 1) throw new Error('campaign unlock count must match all non-starter player units exactly once');
  return { playerUnits, enemies, stages };
}
