import {
  parseCampaignBundle,
  parseCampaignStages,
  parsePlayerUnits,
  type CampaignStageContent,
  type CombatContent,
  type PlayerUnitContent,
} from '@frontline/content-schema';
import {
  parseStagePolicies,
  type StagePolicyContent,
} from '@frontline/content-schema/stage-policy';
import type { BattleUnitDefinition } from '@frontline/sim';
import {
  createCoopPlayableBattle,
  type CoopPlayableBattleState,
} from '@frontline/sim/coop-playable';
import type {
  EnemyArchetype,
  PlayerRosterSlot,
} from '@frontline/sim/playable';
import playerUnitsJson from '../../../content/units/chapter-01.json' with { type: 'json' };
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import enemiesJson from '../../../content/enemies/chapter-01.json' with { type: 'json' };
import stagesJson from '../../../content/stages/chapter-01.json' with { type: 'json' };
import specialStagesJson from '../../../content/stages/special-01.json' with { type: 'json' };
import stagePoliciesJson from '../../../content/stages/policies-01.json' with { type: 'json' };

const STARTER_SLOT_ID = 'militia';

const CAMPAIGN = parseCampaignBundle({
  playerUnits: playerUnitsJson,
  enemies: enemiesJson,
  stages: stagesJson,
  starterUnitId: STARTER_SLOT_ID,
  expectedStageCount: 20,
  requiredThemeCount: 7,
});
const RECRUITMENT_UNITS = parsePlayerUnits(recruitmentUnitsJson);
const ALL_PLAYER_UNIT_CONTENT: readonly PlayerUnitContent[] = [...CAMPAIGN.playerUnits, ...RECRUITMENT_UNITS];
const ALL_PLAYER_UNIT_IDS = new Set(ALL_PLAYER_UNIT_CONTENT.map((unit) => unit.id));
const SPECIAL_STAGES = parseCampaignStages(specialStagesJson, {
  playerUnitIds: ALL_PLAYER_UNIT_IDS,
  enemyIds: new Set(CAMPAIGN.enemies.map((enemy) => enemy.id)),
  starterUnitId: STARTER_SLOT_ID,
  expectedStageCount: 5,
});
const ALL_STAGES: readonly CampaignStageContent[] = [...CAMPAIGN.stages, ...SPECIAL_STAGES];
const STAGE_BY_ID = new Map(ALL_STAGES.map((stage) => [stage.id, stage] as const));
const STAGE_POLICIES = parseStagePolicies(stagePoliciesJson, new Set(ALL_STAGES.map((stage) => stage.id)));
const STAGE_POLICY_BY_ID = new Map(STAGE_POLICIES.map((policy) => [policy.stageId, policy] as const));

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

function rosterSlot(unit: PlayerUnitContent): PlayerRosterSlot {
  return {
    slotId: unit.id,
    displayName: unit.displayName,
    definition: fighter(unit),
    cost: unit.cost,
    rechargeFrames: unit.rechargeFrames,
  };
}

const PLAYER_SLOT_BY_ID = new Map(ALL_PLAYER_UNIT_CONTENT.map((unit) => [unit.id, rosterSlot(unit)] as const));
const BASE_ENEMIES: readonly EnemyArchetype[] = CAMPAIGN.enemies.map((enemy) => ({
  enemyId: enemy.id,
  displayName: enemy.displayName,
  definition: fighter(enemy),
  rewardSupply: enemy.rewardSupply,
}));

export interface ServerCoopStageRuntime {
  readonly stage: CampaignStageContent;
  readonly policy: StagePolicyContent;
}

export function getServerCoopStage(stageId: string): ServerCoopStageRuntime {
  const stage = STAGE_BY_ID.get(stageId);
  if (!stage) throw new Error(`unknown_server_stage:${stageId}`);
  const policy = STAGE_POLICY_BY_ID.get(stageId);
  if (!policy) throw new Error(`missing_server_stage_policy:${stageId}`);
  if (policy.multiplayerPolicy === 'SOLO_ONLY') throw new Error(`stage_not_coop_eligible:${stageId}`);
  return { stage, policy };
}

export function getServerCoopDeck(deckSlotIds: readonly string[]): readonly PlayerRosterSlot[] {
  if (deckSlotIds.length < 1 || deckSlotIds.length > 5) throw new Error('co-op deck must contain 1..5 characters');
  if (new Set(deckSlotIds).size !== deckSlotIds.length) throw new Error('co-op deck must not contain duplicates');
  return deckSlotIds.map((slotId) => {
    const slot = PLAYER_SLOT_BY_ID.get(slotId);
    if (!slot) throw new Error(`unknown_coop_character:${slotId}`);
    return slot;
  });
}

function scaleInteger(value: number, permille: number, minimum: number): number {
  return Math.max(minimum, Math.round(value * permille / 1000));
}

function scaleEnemy(enemy: EnemyArchetype, hpPermille: number, attackPermille: number): EnemyArchetype {
  return {
    ...enemy,
    definition: {
      ...enemy.definition,
      maxHp: scaleInteger(enemy.definition.maxHp, hpPermille, 1),
      attackDamage: scaleInteger(enemy.definition.attackDamage, attackPermille, 0),
      ...(enemy.definition.attackPattern === undefined ? {} : {
        attackPattern: enemy.definition.attackPattern.map((step) => ({
          ...step,
          attackDamage: scaleInteger(step.attackDamage, attackPermille, 0),
        })),
      }),
    },
  };
}

export function createServerCoopBattle(
  stageId: string,
  deckA: readonly string[],
  deckB: readonly string[],
): CoopPlayableBattleState {
  const { stage, policy } = getServerCoopStage(stageId);
  const scaling = policy.coopStatScaling;
  const enemies = BASE_ENEMIES.map((enemy) => scaleEnemy(enemy, scaling.enemyHpPermille, scaling.enemyAttackPermille));
  return createCoopPlayableBattle({
    mapLength: stage.mapLength,
    playerBaseHp: stage.playerBaseHp,
    enemyBaseHp: scaleInteger(stage.enemyBaseHp, scaling.enemyBaseHpPermille, 1),
    startingSupply: stage.startingSupply,
    players: {
      A: getServerCoopDeck(deckA),
      B: getServerCoopDeck(deckB),
    },
    enemies,
    enemyWaves: stage.waves,
    ...(stage.playerUnitCap === undefined ? {} : { playerUnitCap: stage.playerUnitCap }),
    ...(stage.enemyUnitCap === undefined ? {} : { enemyUnitCap: stage.enemyUnitCap }),
  });
}

export function getServerRuntimeCharacterIds(): readonly string[] {
  return [...PLAYER_SLOT_BY_ID.keys()];
}

export function getServerRuntimeCoopStageIds(): readonly string[] {
  return ALL_STAGES.filter((stage) => STAGE_POLICY_BY_ID.get(stage.id)?.multiplayerPolicy !== 'SOLO_ONLY').map((stage) => stage.id);
}
