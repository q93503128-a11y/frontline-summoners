import {
  parseCampaignBundle, parseCampaignStages, parseEnemies, parsePlayerUnits,
  type AcquisitionClass, type BattlefieldThemeId as ContentBattlefieldThemeId,
  type CampaignStageContent, type CombatContent, type PlayerRole, type PlayerUnitContent, type Rarity,
} from '@frontline/content-schema';
import { parseStagePolicies, type StagePolicyContent } from '@frontline/content-schema/stage-policy';
import type { BattleUnitDefinition } from '@frontline/sim';
import { createPlayableBattle, type EnemyArchetype, type PlayableBattleState, type PlayerRosterSlot } from '@frontline/sim/playable';
import playerUnitsJson from '../../../content/units/chapter-01.json' with { type: 'json' };
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import enemiesOneTwoJson from '../../../content/enemies/main-01-02.json' with { type: 'json' };
import enemiesThreeJson from '../../../content/enemies/main-03.json' with { type: 'json' };
import enemiesFourJson from '../../../content/enemies/main-04.json' with { type: 'json' };
import chapterOneStagesJson from '../../../content/stages/chapter-01.json' with { type: 'json' };
import chapterTwoStagesAJson from '../../../content/stages/chapter-02-01-05.json' with { type: 'json' };
import chapterTwoStagesBJson from '../../../content/stages/chapter-02-06-10.json' with { type: 'json' };
import chapterTwoStagesCJson from '../../../content/stages/chapter-02-11-15.json' with { type: 'json' };
import chapterTwoStagesDJson from '../../../content/stages/chapter-02-16-20.json' with { type: 'json' };
import chapterThreeStagesAJson from '../../../content/stages/chapter-03-01-05.json' with { type: 'json' };
import chapterThreeStagesBJson from '../../../content/stages/chapter-03-06-10.json' with { type: 'json' };
import chapterThreeStagesCJson from '../../../content/stages/chapter-03-11-15.json' with { type: 'json' };
import chapterThreeStagesDJson from '../../../content/stages/chapter-03-16-20.json' with { type: 'json' };
import chapterFourStagesAJson from '../../../content/stages/chapter-04-01-05.json' with { type: 'json' };
import chapterFourStagesBJson from '../../../content/stages/chapter-04-06-10.json' with { type: 'json' };
import chapterFourStagesCJson from '../../../content/stages/chapter-04-11-15.json' with { type: 'json' };
import chapterFourStagesDJson from '../../../content/stages/chapter-04-16-20.json' with { type: 'json' };
import challengeSpecialStagesJson from '../../../content/stages/special-01.json' with { type: 'json' };
import resourceSpecialStagesJson from '../../../content/stages/special-resource-01.json' with { type: 'json' };
import stagePoliciesOneTwoJson from '../../../content/stages/policies-01-02.json' with { type: 'json' };
import stagePoliciesThreeJson from '../../../content/stages/policies-03.json' with { type: 'json' };
import stagePoliciesFourJson from '../../../content/stages/policies-04.json' with { type: 'json' };
import stagePoliciesResourceJson from '../../../content/stages/policies-special-resource.json' with { type: 'json' };
import rewardScopesJson from '../../../content/permanent-rewards/reward-scopes.json' with { type: 'json' };
import { REWARD_SCOPES, applyPermanentRewardBattleEffects, type RewardScope } from './permanent-rewards.ts';

export type PrototypeRarity = Rarity | null;
export type PrototypeRole = PlayerRole;
export type BattlefieldThemeId = ContentBattlefieldThemeId;
export interface PrototypeRosterSlot extends PlayerRosterSlot {
  readonly acquisitionClass: AcquisitionClass;
  readonly rarity: PrototypeRarity;
  readonly seriesId?: string;
  readonly role: PrototypeRole;
  readonly description: string;
  readonly rewardScopes: readonly RewardScope[];
}
export type PrototypeStage = CampaignStageContent & Omit<StagePolicyContent, 'stageId'>;
export const STARTER_SLOT_ID = 'militia';
export const SPECIAL_HUB_UNLOCK_STAGE_ID = 'main_01_020';

const ENEMY_CONTENT = [...parseEnemies(enemiesOneTwoJson), ...parseEnemies(enemiesThreeJson), ...parseEnemies(enemiesFourJson)];
if (new Set(ENEMY_CONTENT.map((enemy) => enemy.id)).size !== ENEMY_CONTENT.length) throw new Error('enemy ids must be globally unique');
const ENEMY_IDS = new Set(ENEMY_CONTENT.map((enemy) => enemy.id));
const CHAPTER_ONE = parseCampaignBundle({ playerUnits: playerUnitsJson, enemies: enemiesOneTwoJson, stages: chapterOneStagesJson, starterUnitId: STARTER_SLOT_ID, expectedStageCount: 20, requiredThemeCount: 7 });
const RECRUITMENT_UNIT_CONTENT = parsePlayerUnits(recruitmentUnitsJson);
const campaignUnitIds = new Set(CHAPTER_ONE.playerUnits.map((unit) => unit.id));
for (const unit of RECRUITMENT_UNIT_CONTENT) {
  if (campaignUnitIds.has(unit.id)) throw new Error(`recruitment unit duplicates story unit id: ${unit.id}`);
  if (unit.acquisitionClass !== 'RECRUITMENT') throw new Error(`recruitment file contains non-recruitment unit: ${unit.id}`);
}
const ALL_PLAYER_UNIT_IDS = new Set([...CHAPTER_ONE.playerUnits, ...RECRUITMENT_UNIT_CONTENT].map((unit) => unit.id));

function parseProgressionChapter(raw: unknown, label: string): readonly CampaignStageContent[] {
  const stages = parseCampaignStages(raw, { playerUnitIds: ALL_PLAYER_UNIT_IDS, enemyIds: ENEMY_IDS, starterUnitId: STARTER_SLOT_ID, expectedStageCount: 20 });
  for (const stage of stages) {
    if (stage.stageType !== 'PROGRESSION') throw new Error(`${label} stage must be PROGRESSION: ${stage.id}`);
    if (stage.unlockUnitId) throw new Error(`${label} stage must not unlock chapter-one story units: ${stage.id}`);
  }
  return stages;
}
function parseSpecialGroup(raw: unknown, expectedStageCount: number, label: string): readonly CampaignStageContent[] {
  const stages = parseCampaignStages(raw, { playerUnitIds: ALL_PLAYER_UNIT_IDS, enemyIds: ENEMY_IDS, starterUnitId: STARTER_SLOT_ID, expectedStageCount });
  for (const stage of stages) {
    if (stage.stageType !== 'SPECIAL') throw new Error(`${label} stage must use SPECIAL stageType: ${stage.id}`);
    if (stage.unlockUnitId) throw new Error(`${label} stage must not unlock story roster units: ${stage.id}`);
  }
  return stages;
}

const CHAPTER_TWO_STAGE_CONTENT = parseProgressionChapter([...chapterTwoStagesAJson, ...chapterTwoStagesBJson, ...chapterTwoStagesCJson, ...chapterTwoStagesDJson], 'chapter-two');
const CHAPTER_THREE_STAGE_CONTENT = parseProgressionChapter([...chapterThreeStagesAJson, ...chapterThreeStagesBJson, ...chapterThreeStagesCJson, ...chapterThreeStagesDJson], 'chapter-three');
const CHAPTER_FOUR_STAGE_CONTENT = parseProgressionChapter([...chapterFourStagesAJson, ...chapterFourStagesBJson, ...chapterFourStagesCJson, ...chapterFourStagesDJson], 'chapter-four');
const CHALLENGE_SPECIAL_STAGE_CONTENT = parseSpecialGroup(challengeSpecialStagesJson, 5, 'challenge-special');
const RESOURCE_SPECIAL_STAGE_CONTENT = parseSpecialGroup(resourceSpecialStagesJson, 18, 'resource-special');
const SPECIAL_STAGE_CONTENT: readonly CampaignStageContent[] = [...CHALLENGE_SPECIAL_STAGE_CONTENT, ...RESOURCE_SPECIAL_STAGE_CONTENT];
const PROGRESSION_STAGE_CONTENT: readonly CampaignStageContent[] = [...CHAPTER_ONE.stages, ...CHAPTER_TWO_STAGE_CONTENT, ...CHAPTER_THREE_STAGE_CONTENT, ...CHAPTER_FOUR_STAGE_CONTENT];
const BASE_STAGE_CONTENT: readonly CampaignStageContent[] = [...PROGRESSION_STAGE_CONTENT, ...SPECIAL_STAGE_CONTENT];
if (new Set(BASE_STAGE_CONTENT.map((stage) => stage.id)).size !== BASE_STAGE_CONTENT.length) throw new Error('playable stage ids must be globally unique');

const STAGE_POLICIES = parseStagePolicies([...stagePoliciesOneTwoJson, ...stagePoliciesThreeJson, ...stagePoliciesFourJson, ...stagePoliciesResourceJson], new Set(BASE_STAGE_CONTENT.map((stage) => stage.id)));
const STAGE_POLICY_BY_ID = new Map(STAGE_POLICIES.map((policy) => [policy.stageId, policy] as const));
function withStagePolicy(stage: CampaignStageContent): PrototypeStage {
  const policy = STAGE_POLICY_BY_ID.get(stage.id);
  if (!policy) throw new Error(`missing stage policy at runtime: ${stage.id}`);
  return { ...stage, multiplayerPolicy: policy.multiplayerPolicy, speedUpEligibility: policy.speedUpEligibility, sweepEligibility: policy.sweepEligibility, rewardChargePolicy: policy.rewardChargePolicy, coopStatScaling: policy.coopStatScaling };
}

const VALID_REWARD_SCOPES = new Set<string>(REWARD_SCOPES);
function parseRewardScopeRegistry(value: unknown): ReadonlyMap<string, readonly RewardScope[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('reward scope registry must be an object');
  const registry = new Map<string, readonly RewardScope[]>();
  for (const [unitId, rawScopes] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(rawScopes) || rawScopes.length === 0) throw new Error(`reward scopes must be non-empty for ${unitId}`);
    const scopes = rawScopes.map((scope) => {
      if (typeof scope !== 'string' || !VALID_REWARD_SCOPES.has(scope)) throw new Error(`unknown reward scope for ${unitId}: ${String(scope)}`);
      return scope as RewardScope;
    });
    if (new Set(scopes).size !== scopes.length) throw new Error(`duplicate reward scope for ${unitId}`);
    registry.set(unitId, scopes);
  }
  return registry;
}
const REWARD_SCOPE_BY_UNIT_ID = parseRewardScopeRegistry(rewardScopesJson);

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
    ...(content.attackPattern === undefined ? {} : { attackPattern: content.attackPattern }),
    ...(content.closeRangeAttack === undefined ? {} : { closeRangeAttack: content.closeRangeAttack }),
    ...(content.onHitSlow === undefined ? {} : { onHitSlow: content.onHitSlow }),
    ...(content.onHitPush === undefined ? {} : { onHitPush: content.onHitPush }),
    ...(content.reviveOnce === undefined ? {} : { reviveOnce: content.reviveOnce }),
    naturalKnockbackCount: content.naturalKnockbackCount,
    naturalKnockbackFrames: 12,
    naturalKnockbackDistance: 34,
    deathFrames: 12,
    attackTiming: { cycleFrames: content.cycleFrames, hitFrames: content.hitFrames, backswingFrames: content.backswingFrames },
  };
}
function rosterSlot(unit: PlayerUnitContent): PrototypeRosterSlot {
  const rewardScopes = REWARD_SCOPE_BY_UNIT_ID.get(unit.id);
  if (!rewardScopes) throw new Error(`missing explicit permanent reward scopes for unit: ${unit.id}`);
  return {
    slotId: unit.id,
    displayName: unit.displayName,
    acquisitionClass: unit.acquisitionClass,
    rarity: unit.rarity,
    ...(unit.seriesId === undefined ? {} : { seriesId: unit.seriesId }),
    role: unit.role,
    description: unit.description,
    rewardScopes,
    definition: fighter(unit),
    cost: unit.cost,
    rechargeFrames: unit.rechargeFrames,
  };
}

export const PLAYER_SLOTS: readonly PrototypeRosterSlot[] = CHAPTER_ONE.playerUnits.map(rosterSlot);
export const RECRUITMENT_PLAYER_SLOTS: readonly PrototypeRosterSlot[] = RECRUITMENT_UNIT_CONTENT.map(rosterSlot);
export const ALL_PLAYER_SLOTS: readonly PrototypeRosterSlot[] = [...PLAYER_SLOTS, ...RECRUITMENT_PLAYER_SLOTS];
if (new Set(ALL_PLAYER_SLOTS.map((slot) => slot.slotId)).size !== ALL_PLAYER_SLOTS.length) throw new Error('story and recruitment player slot ids must be globally unique');
for (const unitId of REWARD_SCOPE_BY_UNIT_ID.keys()) if (!ALL_PLAYER_SLOTS.some((slot) => slot.slotId === unitId)) throw new Error(`reward scope registry references unknown unit: ${unitId}`);

export const ENEMIES: readonly EnemyArchetype[] = ENEMY_CONTENT.map((enemy) => ({ enemyId: enemy.id, displayName: enemy.displayName, definition: fighter(enemy), rewardSupply: enemy.rewardSupply }));
export const STAGES: readonly PrototypeStage[] = PROGRESSION_STAGE_CONTENT.map(withStagePolicy);
export const SPECIAL_STAGES: readonly PrototypeStage[] = SPECIAL_STAGE_CONTENT.map(withStagePolicy);
export const ALL_STAGES: readonly PrototypeStage[] = [...STAGES, ...SPECIAL_STAGES];

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
export function getSlotById(slotId: string): PrototypeRosterSlot | undefined { return ALL_PLAYER_SLOTS.find((slot) => slot.slotId === slotId); }
export function getUnlockStageForSlot(slotId: string): PrototypeStage | undefined { if (slotId === STARTER_SLOT_ID) return undefined; return STAGES.find((stage) => stage.unlockUnitId === slotId); }
export function getContiguousClearedStageIds(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(clearedStageIds); const contiguous: string[] = [];
  for (const stage of STAGES) { if (!cleared.has(stage.id)) break; contiguous.push(stage.id); }
  return contiguous;
}
export function getUnlockedSlotIds(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(getContiguousClearedStageIds(clearedStageIds)); const unlocked = new Set<string>([STARTER_SLOT_ID]);
  for (const stage of STAGES) if (cleared.has(stage.id) && stage.unlockUnitId) unlocked.add(stage.unlockUnitId);
  return PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId)).map((slot) => slot.slotId);
}
export function getUnlockedPlayerSlots(clearedStageIds: readonly string[]): readonly PrototypeRosterSlot[] { const unlocked = new Set(getUnlockedSlotIds(clearedStageIds)); return PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId)); }
export function isStageUnlocked(stageId: string, clearedStageIds: readonly string[]): boolean {
  const index = STAGES.findIndex((stage) => stage.id === stageId); if (index < 0) return false; if (index === 0) return true;
  return getContiguousClearedStageIds(clearedStageIds).length >= index;
}
export function isSpecialStageUnlocked(stageId: string, clearedStageIds: readonly string[]): boolean {
  if (!SPECIAL_STAGES.some((stage) => stage.id === stageId)) return false;
  return getContiguousClearedStageIds(clearedStageIds).includes(SPECIAL_HUB_UNLOCK_STAGE_ID);
}
export function isBattleStageUnlocked(stageId: string, clearedStageIds: readonly string[]): boolean {
  const stage = ALL_STAGES.find((candidate) => candidate.id === stageId); if (!stage) return false;
  return stage.stageType === 'SPECIAL' ? isSpecialStageUnlocked(stageId, clearedStageIds) : isStageUnlocked(stageId, clearedStageIds);
}
export function getPermanentRewardIdsForClearedStages(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(getContiguousClearedStageIds(clearedStageIds));
  return STAGES.flatMap((stage) => cleared.has(stage.id) && stage.permanentRewardId ? [stage.permanentRewardId] : []);
}

export function createPrototypeBattleWithPlayerSlots(stageId: string, playerSlots: readonly PrototypeRosterSlot[], ownedRewardIds: readonly string[] = []): PlayableBattleState {
  const stage = getStage(stageId); const safeSlots = playerSlots.length > 0 ? playerSlots : [PLAYER_SLOTS[0]!];
  const progression = applyPermanentRewardBattleEffects({ ownedRewardIds, startingSupply: stage.startingSupply, playerBaseHp: stage.playerBaseHp, playerUnitCap: stage.playerUnitCap, playerSlots: safeSlots, enemies: ENEMIES });
  return createPlayableBattle({ mapLength: stage.mapLength, playerBaseHp: progression.playerBaseHp, enemyBaseHp: stage.enemyBaseHp, startingSupply: progression.startingSupply, playerSlots: progression.playerSlots, enemies: progression.enemies, enemyWaves: stage.waves, playerUnitCap: progression.playerUnitCap, enemyUnitCap: stage.enemyUnitCap, supplyLevels: progression.supplyLevels });
}
export function createPrototypeBattle(stageId = STAGES[0]!.id, unlockedSlotIds: readonly string[] = [STARTER_SLOT_ID], ownedRewardIds: readonly string[] = []): PlayableBattleState {
  const unlocked = new Set(unlockedSlotIds); const playerSlots = ALL_PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId));
  return createPrototypeBattleWithPlayerSlots(stageId, playerSlots, ownedRewardIds);
}
