import { parseCampaignBundle, parseCampaignStages, parseEnemies, parsePlayerUnits, type CampaignStageContent, type CombatContent, type PlayerUnitContent } from '@frontline/content-schema';
import { parseStagePolicies, type StagePolicyContent } from '@frontline/content-schema/stage-policy';
import type { BattleUnitDefinition } from '@frontline/sim';
import { applyCombatGrammarOverride, buildCombatGrammarMap } from '@frontline/sim/combat-grammar';
import { createCoopPlayableBattle, type CoopPlayableBattleState } from '@frontline/sim/coop-playable';
import { getFormationRestrictionViolation } from '@frontline/sim/formation-restrictions';
import { applyPermanentRewardBattleEffects, buildCharacterCombatSlot, getEvolutionForm, normalizeCharacterLevel, normalizeCharacterPlusLevel, type PermanentRewardApplicableSlot } from '@frontline/sim/meta-progression';
import { getPeriodicCollectionWindowState, PERIODIC_REWARD_COLLECTION_IDS, type PeriodicCollectionSchedule, type PeriodicRewardCollectionId } from '@frontline/sim/periodic-special';
import type { EnemyArchetype, PlayerRosterSlot } from '@frontline/sim/playable';
import playerUnitsJson from '../../../content/units/chapter-01.json' with { type: 'json' };
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import enemiesOneTwoJson from '../../../content/enemies/main-01-02.json' with { type: 'json' };
import enemiesThreeJson from '../../../content/enemies/main-03.json' with { type: 'json' };
import enemiesFourJson from '../../../content/enemies/main-04.json' with { type: 'json' };
import permanentSpecialBossesJson from '../../../content/enemies/special-permanent-bosses.json' with { type: 'json' };
import eventSpecialEnemiesJson from '../../../content/enemies/special-event-enemies.json' with { type: 'json' };
import combatGrammarJson from '../../../content/enemies/combat-grammar-v1.json' with { type: 'json' };
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
import eventSpecialStagesJson from '../../../content/stages/special-event-01.json' with { type: 'json' };
import permanentGluttonStagesJson from '../../../content/stages/special-permanent-glutton.json' with { type: 'json' };
import permanentUndeadStagesJson from '../../../content/stages/special-permanent-undead.json' with { type: 'json' };
import permanentGlassStagesJson from '../../../content/stages/special-permanent-glass.json' with { type: 'json' };
import permanentMechStagesJson from '../../../content/stages/special-permanent-mech.json' with { type: 'json' };
import permanentAnomalyStagesJson from '../../../content/stages/special-permanent-anomaly.json' with { type: 'json' };
import permanentEchoStagesJson from '../../../content/stages/special-permanent-echoes.json' with { type: 'json' };
import stagePoliciesOneTwoJson from '../../../content/stages/policies-01-02.json' with { type: 'json' };
import stagePoliciesThreeJson from '../../../content/stages/policies-03.json' with { type: 'json' };
import stagePoliciesFourJson from '../../../content/stages/policies-04.json' with { type: 'json' };
import stagePoliciesResourceJson from '../../../content/stages/policies-special-resource.json' with { type: 'json' };
import stagePoliciesPermanentSpecialJson from '../../../content/stages/policies-special-permanent.json' with { type: 'json' };
import stagePoliciesRestrictionSpecialJson from '../../../content/stages/policies-special-restriction.json' with { type: 'json' };
import stagePoliciesEventSpecialJson from '../../../content/stages/policies-special-event.json' with { type: 'json' };
import stageCollectionsJson from '../../../content/stage-collections.json' with { type: 'json' };
import eventAvailabilityJson from '../../../content/stages/event-availability.json' with { type: 'json' };
import periodicAvailabilityJson from '../../../content/stages/periodic-availability.json' with { type: 'json' };
import type { CoopPlayerLoadout } from './coop-room.ts';
import { SERVER_CHARACTER_LEVEL_CURVE, SERVER_EVOLUTION_FORMS, SERVER_PERMANENT_REWARDS, SERVER_REWARD_SCOPES_BY_CHARACTER } from './meta-content-v2.ts';

const STARTER_SLOT_ID = 'militia';
const COMBAT_GRAMMAR_BY_ID = buildCombatGrammarMap(combatGrammarJson);
const ENEMY_CONTENT = [...parseEnemies(enemiesOneTwoJson), ...parseEnemies(enemiesThreeJson), ...parseEnemies(enemiesFourJson), ...parseEnemies(permanentSpecialBossesJson), ...parseEnemies(eventSpecialEnemiesJson)];
if (new Set(ENEMY_CONTENT.map((enemy) => enemy.id)).size !== ENEMY_CONTENT.length) throw new Error('server enemy ids must be globally unique');
for (const grammarId of COMBAT_GRAMMAR_BY_ID.keys()) if (!ENEMY_CONTENT.some((enemy) => enemy.id === grammarId)) throw new Error(`server combat grammar references unknown enemy:${grammarId}`);
const ENEMY_IDS = new Set(ENEMY_CONTENT.map((enemy) => enemy.id));
const CHAPTER_ONE = parseCampaignBundle({ playerUnits: playerUnitsJson, enemies: enemiesOneTwoJson, stages: chapterOneStagesJson, starterUnitId: STARTER_SLOT_ID, expectedStageCount: 20, requiredThemeCount: 7 });
const RECRUITMENT_UNITS = parsePlayerUnits(recruitmentUnitsJson);
const ALL_PLAYER_UNIT_CONTENT: readonly PlayerUnitContent[] = [...CHAPTER_ONE.playerUnits, ...RECRUITMENT_UNITS];
const ALL_PLAYER_UNIT_IDS = new Set(ALL_PLAYER_UNIT_CONTENT.map((unit) => unit.id));
const PLAYER_CONTENT_BY_ID = new Map(ALL_PLAYER_UNIT_CONTENT.map((unit) => [unit.id, unit] as const));
function parseProgressionChapter(raw: unknown): readonly CampaignStageContent[] { return parseCampaignStages(raw, { playerUnitIds: ALL_PLAYER_UNIT_IDS, enemyIds: ENEMY_IDS, starterUnitId: STARTER_SLOT_ID, expectedStageCount: 20 }); }
function parseSpecialStages(raw: unknown, expectedStageCount: number): readonly CampaignStageContent[] { return parseCampaignStages(raw, { playerUnitIds: ALL_PLAYER_UNIT_IDS, enemyIds: ENEMY_IDS, starterUnitId: STARTER_SLOT_ID, expectedStageCount }); }
const CHAPTER_TWO_STAGES = parseProgressionChapter([...chapterTwoStagesAJson, ...chapterTwoStagesBJson, ...chapterTwoStagesCJson, ...chapterTwoStagesDJson]);
const CHAPTER_THREE_STAGES = parseProgressionChapter([...chapterThreeStagesAJson, ...chapterThreeStagesBJson, ...chapterThreeStagesCJson, ...chapterThreeStagesDJson]);
const CHAPTER_FOUR_STAGES = parseProgressionChapter([...chapterFourStagesAJson, ...chapterFourStagesBJson, ...chapterFourStagesCJson, ...chapterFourStagesDJson]);
const CHALLENGE_SPECIAL_STAGES = parseSpecialStages(challengeSpecialStagesJson, 9);
const RESOURCE_SPECIAL_STAGES = parseSpecialStages(resourceSpecialStagesJson, 18);
const EVENT_SPECIAL_STAGES = parseSpecialStages(eventSpecialStagesJson, 11);
const PERMANENT_SPECIAL_STAGES = parseSpecialStages([...permanentGluttonStagesJson, ...permanentUndeadStagesJson, ...permanentGlassStagesJson, ...permanentMechStagesJson, ...permanentAnomalyStagesJson, ...permanentEchoStagesJson], 23);
const SPECIAL_STAGES: readonly CampaignStageContent[] = [...CHALLENGE_SPECIAL_STAGES, ...RESOURCE_SPECIAL_STAGES, ...PERMANENT_SPECIAL_STAGES, ...EVENT_SPECIAL_STAGES];
const ALL_STAGES: readonly CampaignStageContent[] = [...CHAPTER_ONE.stages, ...CHAPTER_TWO_STAGES, ...CHAPTER_THREE_STAGES, ...CHAPTER_FOUR_STAGES, ...SPECIAL_STAGES];
if (new Set(ALL_STAGES.map((stage) => stage.id)).size !== ALL_STAGES.length) throw new Error('server stage ids must be globally unique');
const STAGE_BY_ID = new Map(ALL_STAGES.map((stage) => [stage.id, stage] as const));
const STAGE_POLICIES = parseStagePolicies([...stagePoliciesOneTwoJson, ...stagePoliciesThreeJson, ...stagePoliciesFourJson, ...stagePoliciesResourceJson, ...stagePoliciesPermanentSpecialJson, ...stagePoliciesRestrictionSpecialJson, ...stagePoliciesEventSpecialJson], new Set(ALL_STAGES.map((stage) => stage.id)));
const STAGE_POLICY_BY_ID = new Map(STAGE_POLICIES.map((policy) => [policy.stageId, policy] as const));

interface CollectionAvailabilityContent { readonly collectionId: string; readonly windows: readonly { readonly start: string; readonly end: string }[]; }
interface PeriodicAvailabilityContent { readonly collectionId: string; readonly epoch: string; readonly cycleHours: number; readonly openHours: number; readonly offsetHours: number; }
interface StageCollectionRuntimeContent { readonly id: string; readonly stageIds: readonly string[]; }
const COLLECTION_STAGE_IDS = new Map((stageCollectionsJson as readonly StageCollectionRuntimeContent[]).map((collection) => [collection.id, collection.stageIds] as const));
const EVENT_WINDOWS_BY_STAGE_ID = new Map<string, readonly { readonly startMs: number; readonly endMs: number }[]>();
for (const availability of eventAvailabilityJson as readonly CollectionAvailabilityContent[]) {
  const stageIds = COLLECTION_STAGE_IDS.get(availability.collectionId); if (!stageIds) throw new Error(`server event availability references unknown collection:${availability.collectionId}`);
  const windows = availability.windows.map((window) => { const startMs = Date.parse(window.start); const endMs = Date.parse(window.end); if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) throw new Error(`invalid_server_event_window:${availability.collectionId}`); return { startMs, endMs }; });
  for (const stageId of stageIds) EVENT_WINDOWS_BY_STAGE_ID.set(stageId, windows);
}
const PERIODIC_SCHEDULE_BY_STAGE_ID = new Map<string, PeriodicCollectionSchedule>();
const PERIODIC_ID_SET = new Set<string>(PERIODIC_REWARD_COLLECTION_IDS);
const seenPeriodicIds = new Set<string>();
for (const availability of periodicAvailabilityJson as readonly PeriodicAvailabilityContent[]) {
  if (!PERIODIC_ID_SET.has(availability.collectionId)) throw new Error(`server periodic availability references unknown periodic collection:${availability.collectionId}`);
  if (seenPeriodicIds.has(availability.collectionId)) throw new Error(`duplicate_server_periodic_collection:${availability.collectionId}`);
  const stageIds = COLLECTION_STAGE_IDS.get(availability.collectionId); if (!stageIds) throw new Error(`server periodic availability references unknown collection:${availability.collectionId}`);
  const epochMs = Date.parse(availability.epoch); if (!Number.isFinite(epochMs)) throw new Error(`invalid_server_periodic_epoch:${availability.collectionId}`);
  if (!Number.isInteger(availability.cycleHours) || !Number.isInteger(availability.openHours) || !Number.isInteger(availability.offsetHours)) throw new Error(`invalid_server_periodic_integer:${availability.collectionId}`);
  if (availability.cycleHours <= 0 || availability.openHours <= 0 || availability.openHours > availability.cycleHours || availability.offsetHours < 0) throw new Error(`invalid_server_periodic_duration:${availability.collectionId}`);
  const schedule: PeriodicCollectionSchedule = { collectionId: availability.collectionId as PeriodicRewardCollectionId, epochMs, cycleMs: availability.cycleHours * 3600000, openMs: availability.openHours * 3600000, offsetMs: availability.offsetHours * 3600000 };
  seenPeriodicIds.add(availability.collectionId);
  for (const stageId of stageIds) PERIODIC_SCHEDULE_BY_STAGE_ID.set(stageId, schedule);
}
for (const collectionId of PERIODIC_REWARD_COLLECTION_IDS) if (!seenPeriodicIds.has(collectionId)) throw new Error(`server periodic availability missing collection:${collectionId}`);
export function isServerStageAvailable(stageId: string, nowMs = Date.now()): boolean {
  const windows = EVENT_WINDOWS_BY_STAGE_ID.get(stageId); if (windows && !windows.some((window) => nowMs >= window.startMs && nowMs <= window.endMs)) return false;
  const schedule = PERIODIC_SCHEDULE_BY_STAGE_ID.get(stageId); return !schedule || getPeriodicCollectionWindowState(schedule, nowMs).available;
}

function fighter(content: CombatContent): BattleUnitDefinition {
  const base: BattleUnitDefinition = {
    id: content.id, maxHp: content.maxHp, attackDamage: content.attackDamage, moveSpeed: content.moveSpeed,
    standingRange: content.standingRange, attackMinRange: content.attackMinRange, attackMaxRange: content.attackMaxRange,
    targetMode: content.targetMode, attributes: content.attributes, combatTags: content.combatTags, damageBonuses: content.damageBonuses,
    ...(content.attackPattern === undefined ? {} : { attackPattern: content.attackPattern }),
    ...(content.closeRangeAttack === undefined ? {} : { closeRangeAttack: content.closeRangeAttack }),
    ...(content.onHitSlow === undefined ? {} : { onHitSlow: content.onHitSlow }),
    ...(content.onHitPush === undefined ? {} : { onHitPush: content.onHitPush }),
    ...(content.onHitWeaken === undefined ? {} : { onHitWeaken: content.onHitWeaken }),
    ...(content.reviveOnce === undefined ? {} : { reviveOnce: content.reviveOnce }),
    ...(content.hpThresholdAdvance === undefined ? {} : { hpThresholdAdvance: content.hpThresholdAdvance }),
    naturalKnockbackCount: content.naturalKnockbackCount, naturalKnockbackFrames: 12, naturalKnockbackDistance: 34, deathFrames: 12,
    attackTiming: { cycleFrames: content.cycleFrames, hitFrames: content.hitFrames, backswingFrames: content.backswingFrames },
  };
  return applyCombatGrammarOverride(base, COMBAT_GRAMMAR_BY_ID.get(content.id));
}
function rosterSlot(unit: PlayerUnitContent): PlayerRosterSlot { return { slotId: unit.id, displayName: unit.displayName, definition: fighter(unit), cost: unit.cost, rechargeFrames: unit.rechargeFrames }; }
const PLAYER_SLOT_BY_ID = new Map(ALL_PLAYER_UNIT_CONTENT.map((unit) => [unit.id, rosterSlot(unit)] as const));
const BASE_ENEMIES: readonly EnemyArchetype[] = ENEMY_CONTENT.map((enemy) => ({ enemyId: enemy.id, displayName: enemy.displayName, definition: fighter(enemy), rewardSupply: enemy.rewardSupply }));
const PERMANENT_REWARD_IDS = new Set(SERVER_PERMANENT_REWARDS.map((reward) => reward.id));
for (const form of SERVER_EVOLUTION_FORMS) if (!ALL_PLAYER_UNIT_IDS.has(form.characterId)) throw new Error(`server evolution references unknown character:${form.characterId}`);
for (const characterId of ALL_PLAYER_UNIT_IDS) if (!SERVER_REWARD_SCOPES_BY_CHARACTER.has(characterId)) throw new Error(`server reward scopes missing character:${characterId}`);
for (const characterId of SERVER_REWARD_SCOPES_BY_CHARACTER.keys()) if (!ALL_PLAYER_UNIT_IDS.has(characterId)) throw new Error(`server reward scopes reference unknown character:${characterId}`);

export interface ServerCoopStageRuntime { readonly stage: CampaignStageContent; readonly policy: StagePolicyContent; }
export interface ServerCoopResolvedLoadout { readonly playerSlots: readonly PermanentRewardApplicableSlot[]; readonly permanentRewardIds: readonly string[]; }
export function getServerCoopStage(stageId: string): ServerCoopStageRuntime {
  const stage = STAGE_BY_ID.get(stageId); if (!stage) throw new Error(`unknown_server_stage:${stageId}`);
  const policy = STAGE_POLICY_BY_ID.get(stageId); if (!policy) throw new Error(`missing_server_stage_policy:${stageId}`);
  if (policy.multiplayerPolicy === 'SOLO_ONLY') throw new Error(`stage_not_coop_eligible:${stageId}`);
  if (!isServerStageAvailable(stageId)) throw new Error(`stage_not_available:${stageId}`);
  return { stage, policy };
}
export function getServerCoopDeck(deckSlotIds: readonly string[]): readonly PlayerRosterSlot[] {
  if (deckSlotIds.length < 1 || deckSlotIds.length > 5) throw new Error('co-op deck must contain 1..5 characters');
  if (new Set(deckSlotIds).size !== deckSlotIds.length) throw new Error('co-op deck must not contain duplicates');
  return deckSlotIds.map((slotId) => { const slot = PLAYER_SLOT_BY_ID.get(slotId); if (!slot) throw new Error(`unknown_coop_character:${slotId}`); return slot; });
}
export function getServerCoopLoadout(loadout: CoopPlayerLoadout): ServerCoopResolvedLoadout {
  if (loadout.characters.length < 1 || loadout.characters.length > 5) throw new Error('co-op loadout must contain 1..5 characters');
  const ids = loadout.characters.map((character) => character.characterId); if (new Set(ids).size !== ids.length) throw new Error('co-op loadout must not contain duplicate characters');
  if (new Set(loadout.permanentRewardIds).size !== loadout.permanentRewardIds.length) throw new Error('co-op permanent rewards must not contain duplicates');
  for (const rewardId of loadout.permanentRewardIds) if (!PERMANENT_REWARD_IDS.has(rewardId)) throw new Error(`unknown_coop_permanent_reward:${rewardId}`);
  const playerSlots = loadout.characters.map((character): PermanentRewardApplicableSlot => {
    const baseSlot = PLAYER_SLOT_BY_ID.get(character.characterId); if (!baseSlot) throw new Error(`unknown_coop_character:${character.characterId}`);
    if (character.level !== normalizeCharacterLevel(SERVER_CHARACTER_LEVEL_CURVE, character.level)) throw new Error(`invalid_coop_level:${character.characterId}:${character.level}`);
    if (character.plusLevel !== normalizeCharacterPlusLevel(SERVER_CHARACTER_LEVEL_CURVE, character.plusLevel)) throw new Error(`invalid_coop_plus_level:${character.characterId}:${character.plusLevel}`);
    if (character.selectedFormId !== undefined) { const form = getEvolutionForm(SERVER_EVOLUTION_FORMS, character.selectedFormId); if (form.characterId !== character.characterId) throw new Error(`invalid_coop_form_owner:${character.selectedFormId}`); }
    const progressed = buildCharacterCombatSlot(baseSlot, SERVER_CHARACTER_LEVEL_CURVE, SERVER_EVOLUTION_FORMS, character.level, character.selectedFormId, character.plusLevel);
    const rewardScopes = SERVER_REWARD_SCOPES_BY_CHARACTER.get(character.characterId); if (!rewardScopes) throw new Error(`server reward scopes missing character:${character.characterId}`);
    return { ...progressed, rewardScopes };
  });
  return { playerSlots, permanentRewardIds: [...loadout.permanentRewardIds] };
}
function validateStageFormation(stage: CampaignStageContent, loadout: CoopPlayerLoadout, resolved: ServerCoopResolvedLoadout): void {
  const slots = resolved.playerSlots.map((slot, index) => {
    const characterId = loadout.characters[index]!.characterId; const content = PLAYER_CONTENT_BY_ID.get(characterId); if (!content) throw new Error(`unknown_coop_character:${characterId}`);
    return { slotId: characterId, cost: slot.cost, rarity: content.rarity, acquisitionClass: content.acquisitionClass, role: content.role, unitTags: slot.definition.combatTags };
  });
  const coopDistinctLimit = stage.formationRestrictions.maxCoopDistinctUnitsPerPlayer;
  const violation = getFormationRestrictionViolation(stage.formationRestrictions, slots, coopDistinctLimit === undefined ? {} : { maxDistinctUnitsOverride: coopDistinctLimit });
  if (violation) throw new Error(`stage_formation_restricted:${stage.id}:${violation}`);
}

function scaleInteger(value: number, permille: number, minimum: number): number { return Math.max(minimum, Math.round(value * permille / 1000)); }
function scaleDamageList(values: readonly number[] | undefined, permille: number): readonly number[] | undefined { return values?.map((value) => scaleInteger(value, permille, 0)); }
function scaleEnemy(enemy: EnemyArchetype, hpPermille: number, attackPermille: number): EnemyArchetype {
  const hitDamages = scaleDamageList(enemy.definition.hitDamages, attackPermille);
  return {
    ...enemy,
    definition: {
      ...enemy.definition,
      maxHp: scaleInteger(enemy.definition.maxHp, hpPermille, 1),
      attackDamage: scaleInteger(enemy.definition.attackDamage, attackPermille, 0),
      ...(hitDamages === undefined ? {} : { hitDamages }),
      ...(enemy.definition.attackPattern === undefined ? {} : { attackPattern: enemy.definition.attackPattern.map((step) => { const stepHits = scaleDamageList(step.hitDamages, attackPermille); return { ...step, attackDamage: scaleInteger(step.attackDamage, attackPermille, 0), ...(stepHits === undefined ? {} : { hitDamages: stepHits }) }; }) }),
      ...(enemy.definition.closeRangeAttack === undefined ? {} : { closeRangeAttack: { ...enemy.definition.closeRangeAttack, attackDamage: scaleInteger(enemy.definition.closeRangeAttack.attackDamage, attackPermille, 0), ...(enemy.definition.closeRangeAttack.hitDamages === undefined ? {} : { hitDamages: enemy.definition.closeRangeAttack.hitDamages.map((value) => scaleInteger(value, attackPermille, 0)) }) } }),
    },
  };
}
function getStageKillSupplyMultiplierPermille(stage: CampaignStageContent): number {
  const prefix = 'killSupplyMultiplier:'; const rule = stage.specialRules.find((value) => value.startsWith(prefix)); if (!rule) return 1000;
  const multiplier = Number(rule.slice(prefix.length)); if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 5) throw new Error(`invalid_server_killSupplyMultiplier:${rule}`);
  return Math.round(multiplier * 1000);
}
function rewardSupplyMap(enemies: readonly EnemyArchetype[], multiplierPermille = 1000): Readonly<Record<string, number>> { return Object.fromEntries(enemies.map((enemy) => [enemy.enemyId, Math.max(0, Math.round(enemy.rewardSupply * multiplierPermille / 1000))])); }
function sharedRewardIds(a: readonly string[], b: readonly string[]): readonly string[] { const right = new Set(b); return a.filter((rewardId) => right.has(rewardId)); }

export function createServerCoopBattle(stageId: string, loadoutA: CoopPlayerLoadout, loadoutB: CoopPlayerLoadout): CoopPlayableBattleState {
  const { stage, policy } = getServerCoopStage(stageId);
  const resolvedA = getServerCoopLoadout(loadoutA); const resolvedB = getServerCoopLoadout(loadoutB);
  validateStageFormation(stage, loadoutA, resolvedA); validateStageFormation(stage, loadoutB, resolvedB);
  const commonRewardIds = sharedRewardIds(resolvedA.permanentRewardIds, resolvedB.permanentRewardIds);
  const progressionA = applyPermanentRewardBattleEffects({ ownedRewardIds: resolvedA.permanentRewardIds, startingSupply: stage.startingSupply, playerBaseHp: stage.playerBaseHp, playerUnitCap: stage.playerUnitCap, playerSlots: resolvedA.playerSlots, enemies: BASE_ENEMIES }, SERVER_PERMANENT_REWARDS);
  const progressionB = applyPermanentRewardBattleEffects({ ownedRewardIds: resolvedB.permanentRewardIds, startingSupply: stage.startingSupply, playerBaseHp: stage.playerBaseHp, playerUnitCap: stage.playerUnitCap, playerSlots: resolvedB.playerSlots, enemies: BASE_ENEMIES }, SERVER_PERMANENT_REWARDS);
  const sharedProgression = applyPermanentRewardBattleEffects({ ownedRewardIds: commonRewardIds, startingSupply: stage.startingSupply, playerBaseHp: stage.playerBaseHp, playerUnitCap: stage.playerUnitCap, playerSlots: [] as readonly PermanentRewardApplicableSlot[], enemies: BASE_ENEMIES }, SERVER_PERMANENT_REWARDS);
  const scaling = policy.coopStatScaling;
  const enemies = BASE_ENEMIES.map((enemy) => scaleEnemy(enemy, scaling.enemyHpPermille, scaling.enemyAttackPermille));
  const killSupplyMultiplierPermille = getStageKillSupplyMultiplierPermille(stage);
  return createCoopPlayableBattle({
    mapLength: stage.mapLength,
    playerBaseHp: sharedProgression.playerBaseHp,
    enemyBaseHp: scaleInteger(stage.enemyBaseHp, scaling.enemyBaseHpPermille, 1),
    players: { A: progressionA.playerSlots, B: progressionB.playerSlots },
    playerEconomies: {
      A: { startingSupply: progressionA.startingSupply, supplyLevels: progressionA.supplyLevels, enemyRewardSupplyById: rewardSupplyMap(progressionA.enemies, killSupplyMultiplierPermille) },
      B: { startingSupply: progressionB.startingSupply, supplyLevels: progressionB.supplyLevels, enemyRewardSupplyById: rewardSupplyMap(progressionB.enemies, killSupplyMultiplierPermille) },
    },
    enemies, enemyWaves: stage.waves, playerUnitCap: stage.playerUnitCap, enemyUnitCap: stage.enemyUnitCap,
  });
}
export function getServerRuntimeCharacterIds(): readonly string[] { return [...PLAYER_SLOT_BY_ID.keys()]; }
export function getServerRuntimeCoopStageIds(): readonly string[] { return ALL_STAGES.filter((stage) => STAGE_POLICY_BY_ID.get(stage.id)?.multiplayerPolicy !== 'SOLO_ONLY' && isServerStageAvailable(stage.id)).map((stage) => stage.id); }
