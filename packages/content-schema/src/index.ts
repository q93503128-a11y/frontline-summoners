export type Rarity = 'C' | 'B' | 'A' | 'S' | 'SS';
export const BATTLEFIELD_THEME_IDS = ['meadow', 'canyon', 'burning', 'ruins', 'moon', 'fortress', 'golden'] as const;
export type BattlefieldThemeId = (typeof BATTLEFIELD_THEME_IDS)[number];

export interface AttackTimingData {
  readonly cycleFrames: number;
  readonly hitFrames: readonly number[];
  readonly backswingFrames: number;
}

export interface UnitContent {
  readonly id: string;
  readonly name: string;
  readonly rarity: Rarity;
  readonly maxHp: number;
  readonly attack: number;
  readonly moveSpeed: number;
  readonly standingRange: number;
  readonly attackMinRange: number;
  readonly attackMaxRange: number;
  readonly cost: number;
  readonly rechargeFrames: number;
  readonly knockbackCount: number;
  readonly attackTiming: AttackTimingData;
  readonly assetId: string;
  readonly abilityIds: readonly string[];
}

export interface StageSpawn {
  readonly enemyId: string;
  readonly atFrame?: number;
  readonly enemyBaseHpBelowPermille?: number;
  readonly count: number;
  readonly intervalFrames: number;
}

export interface StageContent {
  readonly id: string;
  readonly mapLength: number;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
  readonly maxEnemies: number;
  readonly spawns: readonly StageSpawn[];
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

export interface CampaignValidationOptions {
  readonly enemyIds?: ReadonlySet<string>;
  readonly playerUnitIds?: ReadonlySet<string>;
  readonly expectedStageCount?: number;
  readonly requiredThemeCount?: number;
  readonly starterUnitId?: string;
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
  return {
    id: requireString(value, 'id', context),
    name: requireString(value, 'name', context),
    effect: requireString(value, 'effect', context),
  };
}

function parseStage(value: unknown, index: number, options: CampaignValidationOptions): CampaignStageContent {
  const context = `stages[${index}]`;
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const theme = requireString(value, 'theme', context);
  if (!(BATTLEFIELD_THEME_IDS as readonly string[]).includes(theme)) throw new Error(`${context}.theme is unknown: ${theme}`);
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
    theme: theme as BattlefieldThemeId,
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
  let previousMapLength: number | null = null;

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
    if (waveStarts.some((tick, waveIndex) => waveIndex > 0 && tick < waveStarts[waveIndex - 1]!)) {
      throw new Error(`${stage.id} waves must be ordered by atTick`);
    }
    if (previousMapLength !== null && index > 0 && stage.mapLength === previousMapLength && stage.theme === stages[index - 1]!.theme) {
      throw new Error(`${stage.id} repeats both theme and mapLength from the immediately previous stage`);
    }
    previousMapLength = stage.mapLength;
  }

  if (options.requiredThemeCount !== undefined && themes.size < options.requiredThemeCount) {
    throw new Error(`campaign must use at least ${options.requiredThemeCount} battlefield themes, got ${themes.size}`);
  }
  return stages;
}
