import { parseCampaignBundle, parseCampaignStages, parseEnemies, parsePlayerUnits, type CampaignStageContent, type CombatContent, type PlayerUnitContent } from '@frontline/content-schema';
import { parseStagePolicies, type StagePolicyContent } from '@frontline/content-schema/stage-policy';
import type { BattleUnitDefinition } from '@frontline/sim';
import { createCoopPlayableBattle, type CoopPlayableBattleState } from '@frontline/sim/coop-playable';
import { applyPermanentRewardBattleEffects, buildCharacterCombatSlot, getEvolutionForm, normalizeCharacterLevel, normalizeCharacterPlusLevel, type PermanentRewardApplicableSlot } from '@frontline/sim/meta-progression';
import type { EnemyArchetype, PlayerRosterSlot } from '@frontline/sim/playable';
import playerUnitsJson from '../../../content/units/chapter-01.json' with { type: 'json' };
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import enemiesOneTwoJson from '../../../content/enemies/main-01-02.json' with { type: 'json' };
import enemiesThreeJson from '../../../content/enemies/main-03.json' with { type: 'json' };
import enemiesFourJson from '../../../content/enemies/main-04.json' with { type: 'json' };
import permanentSpecialBossesJson from '../../../content/enemies/special-permanent-bosses.json' with { type: 'json' };
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
import type { CoopPlayerLoadout } from './coop-room.ts';
import { SERVER_CHARACTER_LEVEL_CURVE, SERVER_EVOLUTION_FORMS, SERVER_PERMANENT_REWARDS, SERVER_REWARD_SCOPES_BY_CHARACTER } from './meta-content-v2.ts';

const STARTER_SLOT_ID = 'militia';
const ENEMY_CONTENT = [...parseEnemies(enemiesOneTwoJson), ...parseEnemies(enemiesThreeJson), ...parseEnemies(enemiesFourJson), ...parseEnemies(permanentSpecialBossesJson)];
if (new Set(ENEMY_CONTENT.map((enemy) => enemy.id)).size !== ENEMY_CONTENT.length) throw new Error('server enemy ids must be globally unique');
const ENEMY_IDS = new Set(ENEMY_CONTENT.map((enemy) => enemy.id));
const CHAPTER_ONE = parseCampaignBundle({ playerUnits: playerUnitsJson, enemies: enemiesOneTwoJson, stages: chapterOneStagesJson, starterUnitId: STARTER_SLOT_ID, expectedStageCount: 20, requiredThemeCount: 7 });
const RECRUITMENT_UNITS = parsePlayerUnits(recruitmentUnitsJson);
const ALL_PLAYER_UNIT_CONTENT: readonly PlayerUnitContent[] = [...CHAPTER_ONE.playerUnits, ...RECRUITMENT_UNITS];
const ALL_PLAYER_UNIT_IDS = new Set(ALL_PLAYER_UNIT_CONTENT.map((unit) => unit.id));
function parseProgressionChapter(raw: unknown): readonly CampaignStageContent[] {
  return parseCampaignStages(raw, { playerUnitIds: ALL_PLAYER_UNIT_IDS, enemyIds: ENEMY_IDS, starterUnitId: STARTER_SLOT_ID, expectedStageCount: 20 });
}
function parseSpecialStages(raw: unknown, expectedStageCount: number): readonly CampaignStageContent[] {
  return parseCampaignStages(raw, { playerUnitIds: ALL_PLAYER_UNIT_IDS, enemyIds: ENEMY_IDS, starterUnitId: STARTER_SLOT_ID, expectedStageCount });
}
const CHAPTER_TWO_STAGES = parseProgressionChapter([...chapterTwoStagesAJson, ...chapterTwoStagesBJson, ...chapterTwoStagesCJson, ...chapterTwoStagesDJson]);
const CHAPTER_THREE_STAGES = parseProgressionChapter([...chapterThreeStagesAJson, ...chapterThreeStagesBJson, ...chapterThreeStagesCJson, ...chapterThreeStagesDJson]);
const CHAPTER_FOUR_STAGES = parseProgressionChapter([...chapterFourStagesAJson, ...chapterFourStagesBJson, ...chapterFourStagesCJson, ...chapterFourStagesDJson]);
const CHALLENGE_SPECIAL_STAGES = parseSpecialStages(challengeSpecialStagesJson, 5);
const RESOURCE_SPECIAL_STAGES = parseSpecialStages(resourceSpecialStagesJson, 18);
const PERMANENT_SPECIAL_STAGES = parseSpecialStages([
  ...permanentGluttonStagesJson,
  ...permanentUndeadStagesJson,
  ...permanentGlassStagesJson,
  ...permanentMechStagesJson,
  ...permanentAnomalyStagesJson,
  ...permanentEchoStagesJson,
], 23);
const SPECIAL_STAGES: readonly CampaignStageContent[] = [...CHALLENGE_SPECIAL_STAGES, ...RESOURCE_SPECIAL_STAGES, ...PERMANENT_SPECIAL_STAGES];
const ALL_STAGES: readonly CampaignStageContent[] = [...CHAPTER_ONE.stages, ...CHAPTER_TWO_STAGES, ...CHAPTER_THREE_STAGES, ...CHAPTER_FOUR_STAGES, ...SPECIAL_STAGES];
if (new Set(ALL_STAGES.map((stage) => stage.id)).size !== ALL_STAGES.length) throw new Error('server stage ids must be globally unique');
const STAGE_BY_ID = new Map(ALL_STAGES.map((stage) => [stage.id, stage] as const));
const STAGE_POLICIES = parseStagePolicies([...stagePoliciesOneTwoJson, ...stagePoliciesThreeJson, ...stagePoliciesFourJson, ...stagePoliciesResourceJson, ...stagePoliciesPermanentSpecialJson], new Set(ALL_STAGES.map((stage) => stage.id)));
const STAGE_POLICY_BY_ID = new Map(STAGE_POLICIES.map((policy) => [policy.stageId, policy] as const));

function fighter(content: CombatContent): BattleUnitDefinition {
  return {
    id: content.id, maxHp: content.maxHp, attackDamage: content.attackDamage, moveSpeed: content.moveSpeed,
    standingRange: content.standingRange, attackMinRange: content.attackMinRange, attackMaxRange: content.attackMaxRange,
    targetMode: content.targetMode, attributes: content.attributes, combatTags: content.combatTags, damageBonuses: content.damageBonuses,
    ...(content.attackPattern === undefined ? {} : { attackPattern: content.attackPattern }),
    ...(content.closeRangeAttack === undefined ? {} : { closeRangeAttack: content.closeRangeAttack }),
    ...(content.onHitSlow === undefined ? {} : { onHitSlow: content.onHitSlow }),
    ...(content.onHitPush === undefined ? {} : { onHitPush: content.onHitPush }),
    ...(content.reviveOnce === undefined ? {} : { reviveOnce: content.reviveOnce }),
    naturalKnockbackCount: content.naturalKnockbackCount, naturalKnockbackFrames: 12, naturalKnockbackDistance: 34, deathFrames: 12,
    attackTiming: { cycleFrames: content.cycleFrames, hitFrames: content.hitFrames, backswingFrames: content.backswingFrames },
  };
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
  return { stage, policy };
}
export function getServerCoopDeck(deckSlotIds: readonly string[]): readonly PlayerRosterSlot[] {
  if (deckSlotIds.length < 1 || deckSlotIds.length > 5) throw new Error('co-op deck must contain 1..5 characters');
  if (new Set(deckSlotIds).size !== deckSlotIds.length) throw new Error('co-op deck must not contain duplicates');
  return deckSlotIds.map((slotId) => { const slot = PLAYER_SLOT_BY_ID.get(slotId); if (!slot) throw new Error(`unknown_coop_character:${slotId}`); return slot; });
}
export function getServerCoopLoadout(loadout: CoopPlayerLoadout): ServerCoopResolvedLoadout {
  if (loadout.characters.length < 1 || loadout.characters.length > 5) throw new Error('co-op loadout must contain 1..5 characters');
  const ids = loadout.characters.map((character) => character.characterId);
  if (new Set(ids).size !== ids.length) throw new Error('co-op loadout must not contain duplicate characters');
  if (new Set(loadout.permanentRewardIds).size !== loadout.permanentRewardIds.length) throw new Error('co-op permanent rewards must not contain duplicates');
  for (const rewardId of loadout.permanentRewardIds) if (!PERMANENT_REWARD_IDS.has(rewardId)) throw new Error(`unknown_coop_permanent_reward:${rewardId}`);
  const playerSlots = loadout.characters.map((character): PermanentRewardApplicableSlot => {
    const baseSlot = PLAYER_SLOT_BY_ID.get(character.characterId); if (!baseSlot) throw new Error(`unknown_coop_character:${character.characterId}`);
    if (character.level !== normalizeCharacterLevel(SERVER_CHARACTER_LEVEL_CURVE, character.level)) throw new Error(`invalid_coop_level:${character.characterId}:${character.level}`);
    if (character.plusLevel !== normalizeCharacterPlusLevel(SERVER_CHARACTER_LEVEL_CURVE, character.plusLevel)) throw new Error(`invalid_coop_plus_level:${character.characterId}:${character.plusLevel}`);
    if (character.selectedFormId !== undefined) {
      const form = getEvolutionForm(SERVER_EVOLUTION_FORMS, character.selectedFormId);
      if (form.characterId !== character.characterId) throw new Error(`invalid_coop_form_owner:${character.selectedFormId}`);
    }
    const progressed = buildCharacterCombatSlot(baseSlot, SERVER_CHARACTER_LEVEL_CURVE, SERVER_EVOLUTION_FORMS, character.level, character.selectedFormId, character.plusLevel);
    const rewardScopes = SERVER_REWARD_SCOPES_BY_CHARACTER.get(character.characterId);
    if (!rewardScopes) throw new Error(`server reward scopes missing character:${character.characterId}`);
    return { ...progressed, rewardScopes };
  });
  return { playerSlots, permanentRewardIds: [...loadout.permanentRewardIds] };
}

function scaleInteger(value: number, permille: number, minimum: number): number { return Math.max(minimum, Math.round(value * permille / 1000)); }
function scaleEnemy(enemy: EnemyArchetype, hpPermille: number, attackPermille: number): EnemyArchetype {
  return {
    ...enemy,
    definition: {
      ...enemy.definition,
      maxHp: scaleInteger(enemy.definition.maxHp, hpPermille, 1),
      attackDamage: scaleInteger(enemy.definition.attackDamage, attackPermille, 0),
      ...(enemy.definition.attackPattern === undefined ? {} : { attackPattern: enemy.definition.attackPattern.map((step) => ({ ...step, attackDamage: scaleInteger(step.attackDamage, attackPermille, 0) })) }),
      ...(enemy.definition.closeRangeAttack === undefined ? {} : { closeRangeAttack: { ...enemy.definition.closeRangeAttack, attackDamage: scaleInteger(enemy.definition.closeRangeAttack.attackDamage, attackPermille, 0) } }),
    },
  };
}
function rewardSupplyMap(enemies: readonly EnemyArchetype[]): Readonly<Record<string, number>> { return Object.fromEntries(enemies.map((enemy) => [enemy.enemyId, enemy.rewardSupply])); }
function sharedRewardIds(a: readonly string[], b: readonly string[]): readonly string[] { const right = new Set(b); return a.filter((rewardId) => right.has(rewardId)); }

export function createServerCoopBattle(stageId: string, loadoutA: CoopPlayerLoadout, loadoutB: CoopPlayerLoadout): CoopPlayableBattleState {
  const { stage, policy } = getServerCoopStage(stageId);
  const resolvedA = getServerCoopLoadout(loadoutA); const resolvedB = getServerCoopLoadout(loadoutB);
  const commonRewardIds = sharedRewardIds(resolvedA.permanentRewardIds, resolvedB.permanentRewardIds);
  const progressionA = applyPermanentRewardBattleEffects({ ownedRewardIds: resolvedA.permanentRewardIds, startingSupply: stage.startingSupply, playerBaseHp: stage.playerBaseHp, playerUnitCap: stage.playerUnitCap, playerSlots: resolvedA.playerSlots, enemies: BASE_ENEMIES }, SERVER_PERMANENT_REWARDS);
  const progressionB = applyPermanentRewardBattleEffects({ ownedRewardIds: resolvedB.permanentRewardIds, startingSupply: stage.startingSupply, playerBaseHp: stage.playerBaseHp, playerUnitCap: stage.playerUnitCap, playerSlots: resolvedB.playerSlots, enemies: BASE_ENEMIES }, SERVER_PERMANENT_REWARDS);
  const sharedProgression = applyPermanentRewardBattleEffects({ ownedRewardIds: commonRewardIds, startingSupply: stage.startingSupply, playerBaseHp: stage.playerBaseHp, playerUnitCap: stage.playerUnitCap, playerSlots: [] as readonly PermanentRewardApplicableSlot[], enemies: BASE_ENEMIES }, SERVER_PERMANENT_REWARDS);
  const scaling = policy.coopStatScaling;
  const enemies = BASE_ENEMIES.map((enemy) => scaleEnemy(enemy, scaling.enemyHpPermille, scaling.enemyAttackPermille));
  return createCoopPlayableBattle({
    mapLength: stage.mapLength,
    playerBaseHp: sharedProgression.playerBaseHp,
    enemyBaseHp: scaleInteger(stage.enemyBaseHp, scaling.enemyBaseHpPermille, 1),
    players: { A: progressionA.playerSlots, B: progressionB.playerSlots },
    playerEconomies: {
      A: { startingSupply: progressionA.startingSupply, supplyLevels: progressionA.supplyLevels, enemyRewardSupplyById: rewardSupplyMap(progressionA.enemies) },
      B: { startingSupply: progressionB.startingSupply, supplyLevels: progressionB.supplyLevels, enemyRewardSupplyById: rewardSupplyMap(progressionB.enemies) },
    },
    enemies,
    enemyWaves: stage.waves,
    playerUnitCap: stage.playerUnitCap,
    enemyUnitCap: stage.enemyUnitCap,
  });
}
export function getServerRuntimeCharacterIds(): readonly string[] { return [...PLAYER_SLOT_BY_ID.keys()]; }
export function getServerRuntimeCoopStageIds(): readonly string[] { return ALL_STAGES.filter((stage) => STAGE_POLICY_BY_ID.get(stage.id)?.multiplayerPolicy !== 'SOLO_ONLY').map((stage) => stage.id); }
