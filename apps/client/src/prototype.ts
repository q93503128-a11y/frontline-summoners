import {
  parseCampaignBundle,
  parseCampaignStages,
  parsePlayerUnits,
  type AcquisitionClass,
  type BattlefieldThemeId as ContentBattlefieldThemeId,
  type CampaignStageContent,
  type CombatContent,
  type PlayerRole,
  type PlayerUnitContent,
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
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import enemiesJson from '../../../content/enemies/chapter-01.json' with { type: 'json' };
import stagesJson from '../../../content/stages/chapter-01.json' with { type: 'json' };
import specialStagesJson from '../../../content/stages/special-01.json' with { type: 'json' };
import { applyTreasureBattleEffects } from './treasure-effects.ts';

export type PrototypeRarity = Rarity | null;
export type PrototypeRole = PlayerRole;
export type BattlefieldThemeId = ContentBattlefieldThemeId;

export interface PrototypeRosterSlot extends PlayerRosterSlot {
  readonly acquisitionClass: AcquisitionClass;
  readonly rarity: PrototypeRarity;
  readonly seriesId?: string;
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

const RECRUITMENT_UNIT_CONTENT = parsePlayerUnits(recruitmentUnitsJson);
const campaignUnitIds = new Set(CAMPAIGN.playerUnits.map((unit) => unit.id));
for (const unit of RECRUITMENT_UNIT_CONTENT) {
  if (campaignUnitIds.has(unit.id)) throw new Error(`recruitment unit duplicates chapter-one unit id: ${unit.id}`);
  if (unit.acquisitionClass !== 'RECRUITMENT') throw new Error(`recruitment file contains non-recruitment unit: ${unit.id}`);
}

const SPECIAL_STAGE_CONTENT = parseCampaignStages(specialStagesJson, {
  playerUnitIds: new Set([...CAMPAIGN.playerUnits, ...RECRUITMENT_UNIT_CONTENT].map((unit) => unit.id)),
  enemyIds: new Set(CAMPAIGN.enemies.map((enemy) => enemy.id)),
  starterUnitId: STARTER_SLOT_ID,
  expectedStageCount: 5,
});

for (const stage of SPECIAL_STAGE_CONTENT) {
  if (stage.stageType !== 'SPECIAL') throw new Error(`special stage must use SPECIAL stageType: ${stage.id}`);
  if (stage.unlockUnitId) throw new Error(`special stage must not unlock chapter-one core roster units: ${stage.id}`);
}

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
    attributes: content.attributes,
    combatTags: content.combatTags,
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

function rosterSlot(unit: PlayerUnitContent): PrototypeRosterSlot {
  return {
    slotId: unit.id,
    displayName: unit.displayName,
    acquisitionClass: unit.acquisitionClass,
    rarity: unit.rarity,
    ...(unit.seriesId === undefined ? {} : { seriesId: unit.seriesId }),
    role: unit.role,
    description: unit.description,
    definition: fighter(unit),
    cost: unit.cost,
    rechargeFrames: unit.rechargeFrames,
  };
}

export const PLAYER_SLOTS: readonly PrototypeRosterSlot[] = CAMPAIGN.playerUnits.map(rosterSlot);
export const RECRUITMENT_PLAYER_SLOTS: readonly PrototypeRosterSlot[] = RECRUITMENT_UNIT_CONTENT.map(rosterSlot);
export const ALL_PLAYER_SLOTS: readonly PrototypeRosterSlot[] = [...PLAYER_SLOTS, ...RECRUITMENT_PLAYER_SLOTS];

if (new Set(ALL_PLAYER_SLOTS.map((slot) => slot.slotId)).size !== ALL_PLAYER_SLOTS.length) throw new Error('campaign and recruitment player slot ids must be globally unique');

export const ENEMIES: readonly EnemyArchetype[] = CAMPAIGN.enemies.map((enemy) => ({
  enemyId: enemy.id,
  displayName: enemy.displayName,
  definition: fighter(enemy),
  rewardSupply: enemy.rewardSupply,
}));

export const STAGES: readonly PrototypeStage[] = CAMPAIGN.stages;
export const SPECIAL_STAGES: readonly PrototypeStage[] = SPECIAL_STAGE_CONTENT;
export const ALL_STAGES: readonly PrototypeStage[] = [...STAGES, ...SPECIAL_STAGES];
if (new Set(ALL_STAGES.map((stage) => stage.id)).size !== ALL_STAGES.length) throw new Error('progression and special stage ids must be globally unique');

export function getStage(stageId: string): PrototypeStage {
  const stage = ALL_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`Unknown stage: ${stageId}`);
  return stage;
}
export function getStageNumber(stageId: string): number {
  const index = STAGES.findIndex((stage) => stage.id === stageId);
  if (index < 0) throw new Error(`Unknown progression stage: ${stageId}`);
  return index + 1;
}
export function getSpecialStageNumber(stageId: string): number {
  const index = SPECIAL_STAGES.findIndex((stage) => stage.id === stageId);
  if (index < 0) throw new Error(`Unknown special stage: ${stageId}`);
  return index + 1;
}
export function getSlotById(slotId: string): PrototypeRosterSlot | undefined {
  return ALL_PLAYER_SLOTS.find((slot) => slot.slotId === slotId);
}
export function getUnlockStageForSlot(slotId: string): PrototypeStage | undefined {
  if (slotId === STARTER_SLOT_ID) return undefined;
  return STAGES.find((stage) => stage.unlockUnitId === slotId);
}
export function getContiguousClearedStageIds(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(clearedStageIds);
  const contiguous: string[] = [];
  for (const stage of STAGES) {
    if (!cleared.has(stage.id)) break;
    contiguous.push(stage.id);
  }
  return contiguous;
}
export function getUnlockedSlotIds(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(getContiguousClearedStageIds(clearedStageIds));
  const unlocked = new Set<string>([STARTER_SLOT_ID]);
  for (const stage of STAGES) if (cleared.has(stage.id) && stage.unlockUnitId) unlocked.add(stage.unlockUnitId);
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
  return getContiguousClearedStageIds(clearedStageIds).length >= index;
}
export function isSpecialStageUnlocked(stageId: string, clearedStageIds: readonly string[]): boolean {
  if (!SPECIAL_STAGES.some((stage) => stage.id === stageId)) return false;
  return getContiguousClearedStageIds(clearedStageIds).length === STAGES.length;
}
export function isBattleStageUnlocked(stageId: string, clearedStageIds: readonly string[]): boolean {
  const stage = ALL_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) return false;
  return stage.stageType === 'SPECIAL' ? isSpecialStageUnlocked(stageId, clearedStageIds) : isStageUnlocked(stageId, clearedStageIds);
}
export function getTreasureIdsForClearedStages(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(getContiguousClearedStageIds(clearedStageIds));
  return STAGES.filter((stage) => cleared.has(stage.id)).map((stage) => stage.treasure.id);
}

export function createPrototypeBattleWithPlayerSlots(stageId: string, playerSlots: readonly PrototypeRosterSlot[], ownedTreasureIds: readonly string[] = []): PlayableBattleState {
  const stage = getStage(stageId);
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

export function createPrototypeBattle(stageId = STAGES[0]!.id, unlockedSlotIds: readonly string[] = [STARTER_SLOT_ID], ownedTreasureIds: readonly string[] = []): PlayableBattleState {
  const unlocked = new Set(unlockedSlotIds);
  const playerSlots = ALL_PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId));
  return createPrototypeBattleWithPlayerSlots(stageId, playerSlots, ownedTreasureIds);
}
