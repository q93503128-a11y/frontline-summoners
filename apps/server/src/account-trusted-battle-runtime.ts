import {
  parseCampaignStages,
  parseEnemies,
  parsePlayerUnits,
  type CampaignStageContent,
  type CombatContent,
  type PlayerUnitContent,
} from '@frontline/content-schema';
import type { BattleUnitDefinition } from '@frontline/sim';
import { applyCombatGrammarOverride, buildCombatGrammarMap } from '@frontline/sim/combat-grammar';
import { getFormationRestrictionViolation } from '@frontline/sim/formation-restrictions';
import {
  applyPermanentRewardBattleEffects,
  buildCharacterCombatSlot,
  type PermanentRewardApplicableSlot,
} from '@frontline/sim/meta-progression';
import {
  createPlayableBattle,
  getBaseWeaponDefinition,
  type EnemyArchetype,
  type PlayableBattleState,
  type PlayerRosterSlot,
} from '@frontline/sim/playable';
import playerUnitsJson from '../../../content/units/chapter-01.json' with { type: 'json' };
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import enemiesOneTwoJson from '../../../content/enemies/main-01-02.json' with { type: 'json' };
import enemiesThreeJson from '../../../content/enemies/main-03.json' with { type: 'json' };
import enemiesFourJson from '../../../content/enemies/main-04.json' with { type: 'json' };
import permanentSpecialEnemiesJson from '../../../content/enemies/special-permanent-bosses.json' with { type: 'json' };
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
import type { AccountSaveSnapshotV2 } from './account-save-authority.ts';
import {
  SERVER_CHARACTER_LEVEL_CURVE,
  SERVER_EVOLUTION_FORMS,
  SERVER_PERMANENT_REWARDS,
  SERVER_REWARD_SCOPES_BY_CHARACTER,
} from './meta-content-v2.ts';

const STARTER_SLOT_ID = 'militia';
const PLAYER_CONTENT = [...parsePlayerUnits(playerUnitsJson), ...parsePlayerUnits(recruitmentUnitsJson)];
const PLAYER_IDS = new Set(PLAYER_CONTENT.map((unit) => unit.id));
const PLAYER_CONTENT_BY_ID = new Map(PLAYER_CONTENT.map((unit) => [unit.id, unit] as const));
const GRAMMAR_BY_ID = buildCombatGrammarMap(combatGrammarJson);
const ENEMY_CONTENT = [
  ...parseEnemies(enemiesOneTwoJson),
  ...parseEnemies(enemiesThreeJson),
  ...parseEnemies(enemiesFourJson),
  ...parseEnemies(permanentSpecialEnemiesJson),
  ...parseEnemies(eventSpecialEnemiesJson),
];
const ENEMY_IDS = new Set(ENEMY_CONTENT.map((enemy) => enemy.id));

function parseStages(raw: unknown, expectedStageCount: number): readonly CampaignStageContent[] {
  return parseCampaignStages(raw, {
    playerUnitIds: PLAYER_IDS,
    enemyIds: ENEMY_IDS,
    starterUnitId: STARTER_SLOT_ID,
    expectedStageCount,
  });
}

const STAGES: readonly CampaignStageContent[] = [
  ...parseStages(chapterOneStagesJson, 20),
  ...parseStages([...chapterTwoStagesAJson, ...chapterTwoStagesBJson, ...chapterTwoStagesCJson, ...chapterTwoStagesDJson], 20),
  ...parseStages([...chapterThreeStagesAJson, ...chapterThreeStagesBJson, ...chapterThreeStagesCJson, ...chapterThreeStagesDJson], 20),
  ...parseStages([...chapterFourStagesAJson, ...chapterFourStagesBJson, ...chapterFourStagesCJson, ...chapterFourStagesDJson], 20),
  ...parseStages(challengeSpecialStagesJson, 9),
  ...parseStages(resourceSpecialStagesJson, 18),
  ...parseStages([...permanentGluttonStagesJson, ...permanentUndeadStagesJson, ...permanentGlassStagesJson, ...permanentMechStagesJson, ...permanentAnomalyStagesJson, ...permanentEchoStagesJson], 23),
  ...parseStages(eventSpecialStagesJson, 11),
];
const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage] as const));
if (STAGE_BY_ID.size !== 141) throw new Error(`trusted battle runtime must cover 141 standard stages, got ${STAGE_BY_ID.size}`);

function fighter(content: CombatContent): BattleUnitDefinition {
  const base: BattleUnitDefinition = {
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
    ...(content.onHitWeaken === undefined ? {} : { onHitWeaken: content.onHitWeaken }),
    ...(content.reviveOnce === undefined ? {} : { reviveOnce: content.reviveOnce }),
    ...(content.hpThresholdAdvance === undefined ? {} : { hpThresholdAdvance: content.hpThresholdAdvance }),
    naturalKnockbackCount: content.naturalKnockbackCount,
    naturalKnockbackFrames: 12,
    naturalKnockbackDistance: 34,
    deathFrames: 12,
    attackTiming: { cycleFrames: content.cycleFrames, hitFrames: content.hitFrames, backswingFrames: content.backswingFrames },
  };
  return applyCombatGrammarOverride(base, GRAMMAR_BY_ID.get(content.id));
}

function rosterSlot(unit: PlayerUnitContent): PlayerRosterSlot {
  return { slotId: unit.id, displayName: unit.displayName, definition: fighter(unit), cost: unit.cost, rechargeFrames: unit.rechargeFrames };
}
const PLAYER_SLOT_BY_ID = new Map(PLAYER_CONTENT.map((unit) => [unit.id, rosterSlot(unit)] as const));
const BASE_ENEMIES: readonly EnemyArchetype[] = ENEMY_CONTENT.map((enemy) => ({
  enemyId: enemy.id,
  displayName: enemy.displayName,
  definition: fighter(enemy),
  rewardSupply: enemy.rewardSupply,
}));

function buildAccountSlots(snapshot: AccountSaveSnapshotV2): readonly PermanentRewardApplicableSlot[] {
  return snapshot.deckSlotIds.map((characterId) => {
    const base = PLAYER_SLOT_BY_ID.get(characterId);
    const meta = snapshot.characterProgressById[characterId];
    if (!base || !meta) throw new Error(`trusted battle deck references unresolved character:${characterId}`);
    const progressed = buildCharacterCombatSlot(
      base,
      SERVER_CHARACTER_LEVEL_CURVE,
      SERVER_EVOLUTION_FORMS,
      meta.level,
      meta.selectedFormId,
      meta.plusLevel,
    );
    const rewardScopes = SERVER_REWARD_SCOPES_BY_CHARACTER.get(characterId);
    if (!rewardScopes) throw new Error(`trusted battle reward scopes missing character:${characterId}`);
    return { ...progressed, rewardScopes };
  });
}

function assertFormation(stage: CampaignStageContent, snapshot: AccountSaveSnapshotV2, slots: readonly PermanentRewardApplicableSlot[]): void {
  const formation = slots.map((slot, index) => {
    const characterId = snapshot.deckSlotIds[index]!;
    const content = PLAYER_CONTENT_BY_ID.get(characterId);
    if (!content) throw new Error(`trusted battle character content missing:${characterId}`);
    return {
      slotId: characterId,
      cost: slot.cost,
      rarity: content.rarity,
      acquisitionClass: content.acquisitionClass,
      role: content.role,
      unitTags: slot.definition.combatTags,
    };
  });
  const violation = getFormationRestrictionViolation(stage.formationRestrictions, formation);
  if (violation) throw new Error(`stage_formation_restricted:${stage.id}:${violation}`);
}

function killSupplyMultiplierPermille(stage: CampaignStageContent): number {
  const prefix = 'killSupplyMultiplier:';
  const rule = stage.specialRules.find((value) => value.startsWith(prefix));
  if (!rule) return 1000;
  const value = Number(rule.slice(prefix.length));
  if (!Number.isFinite(value) || value < 0 || value > 5) throw new Error(`invalid trusted battle kill supply multiplier:${rule}`);
  return Math.round(value * 1000);
}

export function createAccountTrustedBattle(stageId: string, snapshot: AccountSaveSnapshotV2): PlayableBattleState {
  const stage = STAGE_BY_ID.get(stageId);
  if (!stage) throw new Error(`unknown trusted battle stage:${stageId}`);
  const slots = buildAccountSlots(snapshot);
  assertFormation(stage, snapshot, slots);
  const progression = applyPermanentRewardBattleEffects({
    ownedRewardIds: snapshot.permanentRewardIds,
    startingSupply: stage.startingSupply,
    playerBaseHp: stage.playerBaseHp,
    playerUnitCap: stage.playerUnitCap,
    playerSlots: slots,
    enemies: BASE_ENEMIES,
  }, SERVER_PERMANENT_REWARDS);
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
    killSupplyMultiplierPermille: killSupplyMultiplierPermille(stage),
    baseWeapon: getBaseWeaponDefinition(snapshot.selectedBaseWeaponId),
  });
}

export function getTrustedBattleStage(stageId: string): CampaignStageContent {
  const stage = STAGE_BY_ID.get(stageId);
  if (!stage) throw new Error(`unknown trusted battle stage:${stageId}`);
  return stage;
}
