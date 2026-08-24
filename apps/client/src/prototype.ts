import {
  parseCampaignBundle,
  type BattlefieldThemeId as ContentBattlefieldThemeId,
  type CampaignStageContent,
  type CombatContent,
  type PlayerRole,
  type Rarity,
} from '@frontline/content-schema';
import type { BattleUnitDefinition } from '@frontline/sim';
import {
  createPlayableBattle,
  type EnemyArchetype,
  type PlayableBattleState,
  type PlayerRosterSlot,
} from '@frontline/sim/playable';
import playerUnitsJson from '../../../content/units/chapter-01.json' with { type: 'json' };
import enemiesJson from '../../../content/enemies/chapter-01.json' with { type: 'json' };
import stagesJson from '../../../content/stages/chapter-01.json' with { type: 'json' };
import { applyTreasureBattleEffects } from './treasure-effects.ts';

export type PrototypeRarity = Rarity;
export type PrototypeRole = PlayerRole;
export type BattlefieldThemeId = ContentBattlefieldThemeId;

export interface PrototypeRosterSlot extends PlayerRosterSlot {
  readonly rarity: PrototypeRarity;
  readonly role: PrototypeRole;
  readonly description: string;
}

export type PrototypeStage = CampaignStageContent;

export const STARTER_SLOT_ID = 'militia';

const CAMPAIGN = parseCampaignBundle({
  playerUnits: playerUnitsJson,
  enemies: enemiesJson,
  stages: stagesJson,
  starterUnitId: STARTER_SLOT_ID,
  expectedStageCount: 20,
  requiredThemeCount: 7,
});

function fighter(content: CombatContent): BattleUnitDefinition {
  return {
    id: content.id,
    maxHp: content.maxHp,
    attackDamage: content.attackDamage,
    moveSpeed: content.moveSpeed,
    standingRange: content.standingRange,
    attackMinRange: content.attackMinRange,
    attackMaxRange: content.attackMaxRange,
    targetMode: content.targetMode,
    traits: content.traits,
    damageBonuses: content.damageBonuses,
    naturalKnockbackCount: content.naturalKnockbackCount,
    naturalKnockbackFrames: 12,
    naturalKnockbackDistance: 34,
    deathFrames: 12,
    attackTiming: {
      cycleFrames: content.cycleFrames,
      hitFrames: content.hitFrames,
      backswingFrames: content.backswingFrames,
    },
  };
}

export const PLAYER_SLOTS: readonly PrototypeRosterSlot[] = CAMPAIGN.playerUnits.map((unit) => ({
  slotId: unit.id,
  displayName: unit.displayName,
  rarity: unit.rarity,
  role: unit.role,
  description: unit.description,
  definition: fighter(unit),
  cost: unit.cost,
  rechargeFrames: unit.rechargeFrames,
}));

export const ENEMIES: readonly EnemyArchetype[] = CAMPAIGN.enemies.map((enemy) => ({
  enemyId: enemy.id,
  displayName: enemy.displayName,
  definition: fighter(enemy),
  rewardSupply: enemy.rewardSupply,
}));

export const STAGES: readonly PrototypeStage[] = CAMPAIGN.stages;

export function getStage(stageId: string): PrototypeStage {
  const stage = STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`Unknown campaign stage: ${stageId}`);
  return stage;
}

export function getStageNumber(stageId: string): number {
  const index = STAGES.findIndex((stage) => stage.id === stageId);
  return index >= 0 ? index + 1 : 1;
}

export function getSlotById(slotId: string): PrototypeRosterSlot | undefined {
  return PLAYER_SLOTS.find((slot) => slot.slotId === slotId);
}

export function getUnlockStageForSlot(slotId: string): PrototypeStage | undefined {
  if (slotId === STARTER_SLOT_ID) return undefined;
  return STAGES.find((stage) => stage.unlockUnitId === slotId);
}

export function getUnlockedSlotIds(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(clearedStageIds);
  const unlocked = new Set<string>([STARTER_SLOT_ID]);
  for (const stage of STAGES) {
    if (cleared.has(stage.id) && stage.unlockUnitId) unlocked.add(stage.unlockUnitId);
  }
  return PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId)).map((slot) => slot.slotId);
}

export function getUnlockedPlayerSlots(clearedStageIds: readonly string[]): readonly PrototypeRosterSlot[] {
  const unlocked = new Set(getUnlockedSlotIds(clearedStageIds));
  return PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId));
}

export function isStageUnlocked(stageId: string, clearedStageIds: readonly string[]): boolean {
  const index = STAGES.findIndex((stage) => stage.id === stageId);
  if (index < 0) return false;
  if (index === 0) return true;
  const cleared = new Set(clearedStageIds);
  return STAGES.slice(0, index).every((stage) => cleared.has(stage.id));
}

export function getTreasureIdsForClearedStages(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(clearedStageIds);
  return STAGES.filter((stage) => cleared.has(stage.id)).map((stage) => stage.treasure.id);
}

export function createPrototypeBattle(
  stageId = STAGES[0]!.id,
  unlockedSlotIds: readonly string[] = [STARTER_SLOT_ID],
  ownedTreasureIds: readonly string[] = [],
): PlayableBattleState {
  const stage = getStage(stageId);
  const unlocked = new Set(unlockedSlotIds);
  const playerSlots = PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId));
  const safeSlots = playerSlots.length > 0 ? playerSlots : [PLAYER_SLOTS[0]!];
  const progression = applyTreasureBattleEffects({
    ownedTreasureIds,
    startingSupply: stage.startingSupply,
    playerBaseHp: stage.playerBaseHp,
    playerUnitCap: stage.playerUnitCap,
    playerSlots: safeSlots,
    enemies: ENEMIES,
  });
  return createPlayableBattle({
    mapLength: stage.mapLength,
    playerBaseHp: progression.playerBaseHp,
    enemyBaseHp: stage.enemyBaseHp,
    startingSupply: progression.startingSupply,
    playerSlots: progression.playerSlots,
    enemies: progression.enemies,
    enemyWaves: stage.waves,
    playerUnitCap: progression.playerUnitCap,
    enemyUnitCap: stage.enemyUnitCap,
    supplyLevels: progression.supplyLevels,
  });
}
