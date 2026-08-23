export type Rarity = 'C' | 'B' | 'A' | 'S' | 'SS';

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
