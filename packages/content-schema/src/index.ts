export const RARITIES = ['C', 'B', 'A', 'S', 'SS'] as const;
export type Rarity = (typeof RARITIES)[number];

export const ACQUISITION_CLASSES = ['STORY', 'RECRUITMENT', 'SPECIAL'] as const;
export type AcquisitionClass = (typeof ACQUISITION_CLASSES)[number];

export const PLAYER_ROLES = ['물량', '전열', '원거리', '광역', '결정타', '변칙'] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

export const TARGET_MODES = ['SINGLE', 'AREA'] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

export const ATTRIBUTES = ['NEUTRAL', 'BEAST', 'UNDEAD', 'NATURE', 'ARCANE', 'DEMON', 'MACHINE', 'ANOMALY'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const COMBAT_TAGS = ['ARMORED', 'FLOATING', 'GIANT', 'BOSS', 'STRUCTURE', 'SUMMON', 'SWARM'] as const;
export type CombatTag = (typeof COMBAT_TAGS)[number];

export const DAMAGE_BONUS_TARGET_KINDS = ['ATTRIBUTE', 'TAG'] as const;
export type DamageBonusTargetKind = (typeof DAMAGE_BONUS_TARGET_KINDS)[number];

export const STAGE_TYPES = ['PROGRESSION', 'SPECIAL'] as const;
export type StageType = (typeof STAGE_TYPES)[number];
export const MIN_STAGE_DIFFICULTY = 1;
export const MAX_STAGE_DIFFICULTY = 12;
export const DEFAULT_PLAYER_UNIT_CAP = 50;
export const DEFAULT_ENEMY_UNIT_CAP = 50;
export const MIN_PLAYER_RECHARGE_FRAMES = 60;

export const WAVE_TRIGGER_TYPES = [
  'TIME',
  'ENEMY_BASE_HP_BELOW',
  'PLAYER_BASE_HP_BELOW',
  'BOSS_HP_BELOW',
  'AFTER_WAVE_TRIGGERED',
  'AFTER_WAVE_CLEARED',
  'ANY_OF',
] as const;
export type WaveTriggerType = (typeof WAVE_TRIGGER_TYPES)[number];

export type DamageBonusContent =
  | { readonly targetKind: 'ATTRIBUTE'; readonly target: Attribute; readonly multiplierPermille: number }
  | { readonly targetKind: 'TAG'; readonly target: CombatTag; readonly multiplierPermille: number };

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
  readonly attributes: readonly Attribute[];
  readonly combatTags: readonly CombatTag[];
  readonly damageBonuses: readonly DamageBonusContent[];
}

export interface PlayerUnitContent extends CombatContent {
  readonly acquisitionClass: AcquisitionClass;
  readonly rarity: Rarity | null;
  readonly seriesId?: string;
  readonly role: PlayerRole;
  readonly description: string;
  readonly cost: number;
  readonly rechargeFrames: number;
}

export interface EnemyContent extends CombatContent {
  readonly rewardSupply: number;
}

export type SimpleCampaignWaveTriggerContent =
  | { readonly type: 'TIME'; readonly frame: number }
  | { readonly type: 'ENEMY_BASE_HP_BELOW'; readonly percent: number }
  | { readonly type: 'PLAYER_BASE_HP_BELOW'; readonly percent: number }
  | { readonly type: 'BOSS_HP_BELOW'; readonly enemyId: string; readonly percent: number }
  | { readonly type: 'AFTER_WAVE_TRIGGERED'; readonly waveId: string; readonly delayFrames: number }
  | { readonly type: 'AFTER_WAVE_CLEARED'; readonly waveId: string; readonly delayFrames: number };

export type CampaignWaveTriggerContent =
  | SimpleCampaignWaveTriggerContent
  | { readonly type: 'ANY_OF'; readonly conditions: readonly SimpleCampaignWaveTriggerContent[] };

export interface CampaignWaveSpawnContent {
  readonly enemyId: string;
  readonly count: number;
  readonly intervalFrames: number;
  readonly magnificationPermille: number;
}

export interface CampaignWaveRepeatContent {
  readonly delayFrames: number;
  readonly maxCycles?: number;
}

export interface CampaignWaveContent {
  readonly id: string;
  readonly trigger: CampaignWaveTriggerContent;
  readonly spawn: CampaignWaveSpawnContent;
  readonly repeat?: CampaignWaveRepeatContent;
}

export interface FormationRestrictionContent {
  readonly allowedRarities: readonly Rarity[];
  readonly maxRarity?: Rarity;
  readonly allowedAcquisitionClasses: readonly AcquisitionClass[];
  readonly allowedRoles: readonly PlayerRole[];
  readonly maxUnitCost?: number;
  readonly requiredUnitTags: readonly string[];
  readonly forbiddenUnitTags: readonly string[];
  readonly maxDistinctUnits?: number;
  readonly sameFactionOnly: boolean;
}

export interface CampaignStageContent {
  readonly id: string;
  readonly chapter: string;
  readonly name: string;
  readonly subtitle: string;
  readonly stageType: StageType;
  readonly difficulty: number;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
  readonly startingSupply: number;
  readonly mapLength: number;
  readonly theme: BattlefieldThemeId;
  readonly decorSeed: number;
  readonly waves: readonly CampaignWaveContent[];
  /** MAIN first-clear account growth. SPECIAL stages do not define one by default. */
  readonly permanentRewardId?: string;
  readonly playerUnitCap: number;
  readonly enemyUnitCap: number;
  readonly formationRestrictions: FormationRestrictionContent;
  readonly specialRules: readonly string[];
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

function optionalString(record: Record<string, unknown>, key: string, context: string): string | undefined {
  if (record[key] === undefined) return undefined;
  return requireString(record, key, context);
}

function requireInteger(record: Record<string, unknown>, key: string, context: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${context}.${key} must be an integer in ${min}..${max}`);
  return value as number;
}

function optionalInteger(record: Record<string, unknown>, key: string, context: string, min: number, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (record[key] === undefined) return undefined;
  return requireInteger(record, key, context, min, max);
}

function requireEnum<T extends readonly string[]>(record: Record<string, unknown>, key: string, context: string, values: T): T[number] {
  const value = requireString(record, key, context);
  if (!(values as readonly string[]).includes(value)) throw new Error(`${context}.${key} is unknown: ${value}`);
  return value as T[number];
}

function optionalEnum<T extends readonly string[]>(record: Record<string, unknown>, key: string, context: string, values: T): T[number] | undefined {
  if (record[key] === undefined) return undefined;
  return requireEnum(record, key, context, values);
}

function parseStringArray(record: Record<string, unknown>, key: string, context: string): readonly string[] {
  const raw = record[key];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${context}.${key} must be an array`);
  const values = raw.map((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) throw new Error(`${context}.${key}[${index}] must be a non-empty string`);
    return item;
  });
  if (new Set(values).size !== values.length) throw new Error(`${context}.${key} must be unique`);
  return values;
}

function parseEnumArray<T extends readonly string[]>(record: Record<string, unknown>, key: string, context: string, values: T): readonly T[number][] {
  const raw = record[key];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${context}.${key} must be an array`);
  const parsed = raw.map((item, index) => {
    if (typeof item !== 'string' || !(values as readonly string[]).includes(item)) throw new Error(`${context}.${key}[${index}] is unknown: ${String(item)}`);
    return item as T[number];
  });
  if (new Set(parsed).size !== parsed.length) throw new Error(`${context}.${key} must be unique`);
  return parsed;
}

function optionalBoolean(record: Record<string, unknown>, key: string, context: string, fallback: boolean): boolean {
  const raw = record[key];
  if (raw === undefined) return fallback;
  if (typeof raw !== 'boolean') throw new Error(`${context}.${key} must be a boolean`);
  return raw;
}

function requireHitFrames(record: Record<string, unknown>, context: string, cycleFrames: number): readonly number[] {
  const value = record.hitFrames;
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${context}.hitFrames must be a non-empty array`);
  const frames = value.map((frame, index) => {
    if (!Number.isInteger(frame) || (frame as number) < 0 || (frame as number) >= cycleFrames) throw new Error(`${context}.hitFrames[${index}] must be inside cycleFrames`);
    return frame as number;
  });
  if (frames.some((frame, index) => index > 0 && frame <= frames[index - 1]!)) throw new Error(`${context}.hitFrames must be strictly increasing`);
  return frames;
}

function parseAttributes(record: Record<string, unknown>, context: string): readonly Attribute[] {
  const attributes = parseEnumArray(record, 'attributes', context, ATTRIBUTES);
  if (attributes.length === 0 || attributes.length > 2) throw new Error(`${context}.attributes must contain one or two attributes`);
  if (attributes.includes('NEUTRAL') && attributes.length !== 1) throw new Error(`${context}.NEUTRAL cannot be combined with another attribute`);
  return attributes;
}

function parseCombatTags(record: Record<string, unknown>, context: string): readonly CombatTag[] {
  return parseEnumArray(record, 'combatTags', context, COMBAT_TAGS);
}

function parseDamageBonuses(record: Record<string, unknown>, context: string): readonly DamageBonusContent[] {
  const raw = record.damageBonuses;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${context}.damageBonuses must be an array`);
  const bonuses = raw.map((bonus, index): DamageBonusContent => {
    const itemContext = `${context}.damageBonuses[${index}]`;
    if (!isRecord(bonus)) throw new Error(`${itemContext} must be an object`);
    const targetKind = requireEnum(bonus, 'targetKind', itemContext, DAMAGE_BONUS_TARGET_KINDS);
    const multiplierPermille = requireInteger(bonus, 'multiplierPermille', itemContext, 1000, 3000);
    if (targetKind === 'ATTRIBUTE') return { targetKind, target: requireEnum(bonus, 'target', itemContext, ATTRIBUTES), multiplierPermille };
    return { targetKind, target: requireEnum(bonus, 'target', itemContext, COMBAT_TAGS), multiplierPermille };
  });
  const keys = bonuses.map((bonus) => `${bonus.targetKind}:${bonus.target}`);
  if (new Set(keys).size !== keys.length) throw new Error(`${context}.damageBonuses targets must be unique`);
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
    attributes: parseAttributes(value, context),
    combatTags: parseCombatTags(value, context),
    damageBonuses: parseDamageBonuses(value, context),
  };
}

function parseNullableRarity(raw: Record<string, unknown>, context: string): Rarity | null {
  if (raw.rarity === null) return null;
  return requireEnum(raw, 'rarity', context, RARITIES);
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
    const acquisitionClass = requireEnum(raw, 'acquisitionClass', context, ACQUISITION_CLASSES);
    const rarity = parseNullableRarity(raw, context);
    const seriesId = optionalString(raw, 'seriesId', context);
    if (acquisitionClass === 'RECRUITMENT') {
      if (rarity === null) throw new Error(`${context}.RECRUITMENT character requires rarity`);
      if (!seriesId) throw new Error(`${context}.RECRUITMENT character requires seriesId`);
    } else {
      if (rarity !== null) throw new Error(`${context}.${acquisitionClass} character must use rarity:null`);
      if (seriesId !== undefined) throw new Error(`${context}.${acquisitionClass} character must not define seriesId`);
    }
    return {
      ...combat,
      acquisitionClass,
      rarity,
      ...(seriesId === undefined ? {} : { seriesId }),
      role: requireEnum(raw, 'role', context, PLAYER_ROLES),
      description: requireString(raw, 'description', context),
      cost: requireInteger(raw, 'cost', context, 0, 1000000),
      rechargeFrames: requireInteger(raw, 'rechargeFrames', context, MIN_PLAYER_RECHARGE_FRAMES, 36000),
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

function parseSimpleWaveTrigger(value: unknown, context: string, enemyIds?: ReadonlySet<string>): SimpleCampaignWaveTriggerContent {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const type = requireEnum(value, 'type', context, WAVE_TRIGGER_TYPES);
  if (type === 'ANY_OF') throw new Error(`${context}.ANY_OF cannot be nested`);
  if (type === 'TIME') return { type, frame: requireInteger(value, 'frame', context, 0) };
  if (type === 'ENEMY_BASE_HP_BELOW' || type === 'PLAYER_BASE_HP_BELOW') return { type, percent: requireInteger(value, 'percent', context, 1, 100) };
  if (type === 'BOSS_HP_BELOW') {
    const enemyId = requireString(value, 'enemyId', context);
    if (enemyIds && !enemyIds.has(enemyId)) throw new Error(`${context}.enemyId references unknown enemy: ${enemyId}`);
    return { type, enemyId, percent: requireInteger(value, 'percent', context, 1, 100) };
  }
  const waveId = requireString(value, 'waveId', context);
  const delayFrames = value.delayFrames === undefined ? 0 : requireInteger(value, 'delayFrames', context, 0);
  return { type, waveId, delayFrames };
}

function parseWaveTrigger(value: unknown, context: string, enemyIds?: ReadonlySet<string>): CampaignWaveTriggerContent {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const type = requireEnum(value, 'type', context, WAVE_TRIGGER_TYPES);
  if (type !== 'ANY_OF') return parseSimpleWaveTrigger(value, context, enemyIds);
  if (!Array.isArray(value.conditions) || value.conditions.length < 2) throw new Error(`${context}.conditions must contain at least two conditions`);
  return { type, conditions: value.conditions.map((condition, index) => parseSimpleWaveTrigger(condition, `${context}.conditions[${index}]`, enemyIds)) };
}

function parseWave(value: unknown, context: string, enemyIds?: ReadonlySet<string>): CampaignWaveContent {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  if (!isRecord(value.spawn)) throw new Error(`${context}.spawn must be an object`);
  const enemyId = requireString(value.spawn, 'enemyId', `${context}.spawn`);
  if (enemyIds && !enemyIds.has(enemyId)) throw new Error(`${context}.spawn.enemyId references unknown enemy: ${enemyId}`);
  const magnificationPermille = value.spawn.magnificationPermille === undefined ? 1000 : requireInteger(value.spawn, 'magnificationPermille', `${context}.spawn`, 100, 10000);
  let repeat: CampaignWaveRepeatContent | undefined;
  if (value.repeat !== undefined) {
    if (!isRecord(value.repeat)) throw new Error(`${context}.repeat must be an object`);
    const maxCycles = optionalInteger(value.repeat, 'maxCycles', `${context}.repeat`, 1, 1000);
    repeat = {
      delayFrames: requireInteger(value.repeat, 'delayFrames', `${context}.repeat`, 1),
      ...(maxCycles === undefined ? {} : { maxCycles }),
    };
  }
  return {
    id: requireString(value, 'id', context),
    trigger: parseWaveTrigger(value.trigger, `${context}.trigger`, enemyIds),
    spawn: {
      enemyId,
      count: requireInteger(value.spawn, 'count', `${context}.spawn`, 1, 1000),
      intervalFrames: requireInteger(value.spawn, 'intervalFrames', `${context}.spawn`, 1),
      magnificationPermille,
    },
    ...(repeat === undefined ? {} : { repeat }),
  };
}

function parseFormationRestrictions(value: unknown, context: string): FormationRestrictionContent {
  if (value === undefined) return {
    allowedRarities: [],
    allowedAcquisitionClasses: [],
    allowedRoles: [],
    requiredUnitTags: [],
    forbiddenUnitTags: [],
    sameFactionOnly: false,
  };
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const maxRarity = optionalEnum(value, 'maxRarity', context, RARITIES);
  const maxUnitCost = optionalInteger(value, 'maxUnitCost', context, 0, 1000000);
  const maxDistinctUnits = optionalInteger(value, 'maxDistinctUnits', context, 1, 10);
  return {
    allowedRarities: parseEnumArray(value, 'allowedRarities', context, RARITIES),
    ...(maxRarity === undefined ? {} : { maxRarity }),
    allowedAcquisitionClasses: parseEnumArray(value, 'allowedAcquisitionClasses', context, ACQUISITION_CLASSES),
    allowedRoles: parseEnumArray(value, 'allowedRoles', context, PLAYER_ROLES),
    ...(maxUnitCost === undefined ? {} : { maxUnitCost }),
    requiredUnitTags: parseStringArray(value, 'requiredUnitTags', context),
    forbiddenUnitTags: parseStringArray(value, 'forbiddenUnitTags', context),
    ...(maxDistinctUnits === undefined ? {} : { maxDistinctUnits }),
    sameFactionOnly: optionalBoolean(value, 'sameFactionOnly', context, false),
  };
}

function referencedWaveIds(trigger: CampaignWaveTriggerContent): readonly string[] {
  const conditions = trigger.type === 'ANY_OF' ? trigger.conditions : [trigger];
  return conditions.flatMap((condition) => condition.type === 'AFTER_WAVE_TRIGGERED' || condition.type === 'AFTER_WAVE_CLEARED' ? [condition.waveId] : []);
}

function parseStage(value: unknown, index: number, options: CampaignValidationOptions): CampaignStageContent {
  const context = `stages[${index}]`;
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const stageType = value.stageType === undefined ? 'PROGRESSION' : requireEnum(value, 'stageType', context, STAGE_TYPES);
  const wavesValue = value.waves;
  if (!Array.isArray(wavesValue) || wavesValue.length === 0) throw new Error(`${context}.waves must contain at least one wave`);
  const waves = wavesValue.map((wave, waveIndex) => parseWave(wave, `${context}.waves[${waveIndex}]`, options.enemyIds));
  const waveIds = new Set<string>();
  for (let waveIndex = 0; waveIndex < waves.length; waveIndex += 1) {
    const wave = waves[waveIndex]!;
    if (waveIds.has(wave.id)) throw new Error(`${context}.waves duplicate id: ${wave.id}`);
    const priorWaveIds = new Set(waves.slice(0, waveIndex).map((candidate) => candidate.id));
    for (const reference of referencedWaveIds(wave.trigger)) {
      if (!priorWaveIds.has(reference)) throw new Error(`${context}.${wave.id} must reference an earlier wave: ${reference}`);
    }
    waveIds.add(wave.id);
  }
  const unlockUnitId = optionalString(value, 'unlockUnitId', context);
  if (unlockUnitId && options.playerUnitIds && !options.playerUnitIds.has(unlockUnitId)) throw new Error(`${context}.unlockUnitId references unknown player unit: ${unlockUnitId}`);
  if (unlockUnitId && options.starterUnitId && unlockUnitId === options.starterUnitId) throw new Error(`${context} must not unlock the starter unit again`);
  const permanentRewardId = optionalString(value, 'permanentRewardId', context);
  if (stageType === 'PROGRESSION' && !permanentRewardId) throw new Error(`${context}.PROGRESSION stage requires permanentRewardId`);
  if (stageType === 'SPECIAL' && permanentRewardId) throw new Error(`${context}.SPECIAL stage must not define permanentRewardId`);
  const base: Omit<CampaignStageContent, 'unlockUnitId'> = {
    id: requireString(value, 'id', context),
    chapter: requireString(value, 'chapter', context),
    name: requireString(value, 'name', context),
    subtitle: requireString(value, 'subtitle', context),
    stageType,
    difficulty: requireInteger(value, 'difficulty', context, MIN_STAGE_DIFFICULTY, MAX_STAGE_DIFFICULTY),
    playerBaseHp: requireInteger(value, 'playerBaseHp', context, 1),
    enemyBaseHp: requireInteger(value, 'enemyBaseHp', context, 1),
    startingSupply: requireInteger(value, 'startingSupply', context, 0, 100000),
    mapLength: requireInteger(value, 'mapLength', context, 500, 5000),
    theme: requireEnum(value, 'theme', context, BATTLEFIELD_THEME_IDS),
    decorSeed: requireInteger(value, 'decorSeed', context, 0),
    waves,
    ...(permanentRewardId === undefined ? {} : { permanentRewardId }),
    playerUnitCap: value.playerUnitCap === undefined ? DEFAULT_PLAYER_UNIT_CAP : requireInteger(value, 'playerUnitCap', context, 1, 500),
    enemyUnitCap: value.enemyUnitCap === undefined ? DEFAULT_ENEMY_UNIT_CAP : requireInteger(value, 'enemyUnitCap', context, 1, 500),
    formationRestrictions: parseFormationRestrictions(value.formationRestrictions, `${context}.formationRestrictions`),
    specialRules: parseStringArray(value, 'specialRules', context),
  };
  return unlockUnitId === undefined ? base : { ...base, unlockUnitId };
}

export function parseCampaignStages(value: unknown, options: CampaignValidationOptions = {}): readonly CampaignStageContent[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('campaign stages must be a non-empty array');
  if (options.expectedStageCount !== undefined && value.length !== options.expectedStageCount) throw new Error(`campaign must contain exactly ${options.expectedStageCount} stages, got ${value.length}`);
  const stages = value.map((stage, index) => parseStage(stage, index, options));
  const stageIds = new Set<string>();
  const rewardIds = new Set<string>();
  const unlockIds = new Set<string>();
  const themes = new Set<BattlefieldThemeId>();
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index]!;
    if (stageIds.has(stage.id)) throw new Error(`duplicate stage id: ${stage.id}`);
    stageIds.add(stage.id);
    if (stage.permanentRewardId) {
      if (rewardIds.has(stage.permanentRewardId)) throw new Error(`duplicate permanent reward id: ${stage.permanentRewardId}`);
      rewardIds.add(stage.permanentRewardId);
    }
    themes.add(stage.theme);
    if (stage.unlockUnitId) {
      if (unlockIds.has(stage.unlockUnitId)) throw new Error(`player unit is unlocked more than once: ${stage.unlockUnitId}`);
      unlockIds.add(stage.unlockUnitId);
    }
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
  for (const unit of playerUnits) if (unit.id !== input.starterUnitId && !unlockedIds.has(unit.id)) throw new Error(`player unit is never unlocked by campaign: ${unit.id}`);
  if (unlockedIds.size !== playerUnits.length - 1) throw new Error('campaign unlock count must match all non-starter player units exactly once');
  return { playerUnits, enemies, stages };
}
