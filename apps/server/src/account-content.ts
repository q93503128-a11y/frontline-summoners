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
import enemiesOneTwoJson from '../../../content/enemies/main-01-02.json' with { type: 'json' };
import enemiesThreeJson from '../../../content/enemies/main-03.json' with { type: 'json' };
import enemiesFourJson from '../../../content/enemies/main-04.json' with { type: 'json' };
import permanentSpecialEnemiesJson from '../../../content/enemies/special-permanent-bosses.json' with { type: 'json' };
import eventSpecialEnemiesJson from '../../../content/enemies/special-event-enemies.json' with { type: 'json' };

export interface AccountMainStageSeed {
  readonly id: string;
  readonly permanentRewardId?: string;
  readonly unlockUnitId?: string;
}

type IdSeed = { readonly id: string };

function asStageSeeds(value: unknown): readonly AccountMainStageSeed[] {
  if (!Array.isArray(value)) throw new Error('account stage content must be an array');
  return value as readonly AccountMainStageSeed[];
}

function asIdSeeds(value: unknown): readonly IdSeed[] {
  if (!Array.isArray(value)) throw new Error('account id content must be an array');
  return value as readonly IdSeed[];
}

export const ACCOUNT_MAIN_STAGES: readonly AccountMainStageSeed[] = [
  ...asStageSeeds(chapterOneStagesJson),
  ...asStageSeeds(chapterTwoStagesAJson),
  ...asStageSeeds(chapterTwoStagesBJson),
  ...asStageSeeds(chapterTwoStagesCJson),
  ...asStageSeeds(chapterTwoStagesDJson),
  ...asStageSeeds(chapterThreeStagesAJson),
  ...asStageSeeds(chapterThreeStagesBJson),
  ...asStageSeeds(chapterThreeStagesCJson),
  ...asStageSeeds(chapterThreeStagesDJson),
  ...asStageSeeds(chapterFourStagesAJson),
  ...asStageSeeds(chapterFourStagesBJson),
  ...asStageSeeds(chapterFourStagesCJson),
  ...asStageSeeds(chapterFourStagesDJson),
];

const SPECIAL_STAGE_SEEDS: readonly IdSeed[] = [
  ...asIdSeeds(challengeSpecialStagesJson),
  ...asIdSeeds(resourceSpecialStagesJson),
  ...asIdSeeds(eventSpecialStagesJson),
  ...asIdSeeds(permanentGluttonStagesJson),
  ...asIdSeeds(permanentUndeadStagesJson),
  ...asIdSeeds(permanentGlassStagesJson),
  ...asIdSeeds(permanentMechStagesJson),
  ...asIdSeeds(permanentAnomalyStagesJson),
  ...asIdSeeds(permanentEchoStagesJson),
];

const ENEMY_SEEDS: readonly IdSeed[] = [
  ...asIdSeeds(enemiesOneTwoJson),
  ...asIdSeeds(enemiesThreeJson),
  ...asIdSeeds(enemiesFourJson),
  ...asIdSeeds(permanentSpecialEnemiesJson),
  ...asIdSeeds(eventSpecialEnemiesJson),
];

if (ACCOUNT_MAIN_STAGES.length !== 80) throw new Error(`account authority must contain MAIN80, got ${ACCOUNT_MAIN_STAGES.length}`);
if (new Set(ACCOUNT_MAIN_STAGES.map((stage) => stage.id)).size !== ACCOUNT_MAIN_STAGES.length) throw new Error('account MAIN stage ids must be unique');
if (SPECIAL_STAGE_SEEDS.length !== 61) throw new Error(`account authority must contain SPECIAL61, got ${SPECIAL_STAGE_SEEDS.length}`);
if (new Set(SPECIAL_STAGE_SEEDS.map((stage) => stage.id)).size !== SPECIAL_STAGE_SEEDS.length) throw new Error('account SPECIAL stage ids must be unique');
if (new Set(ENEMY_SEEDS.map((enemy) => enemy.id)).size !== ENEMY_SEEDS.length) throw new Error('account enemy ids must be unique');

export const ACCOUNT_MAIN_STAGE_IDS = ACCOUNT_MAIN_STAGES.map((stage) => stage.id);
export const ACCOUNT_MAIN_STAGE_INDEX = new Map(ACCOUNT_MAIN_STAGE_IDS.map((id, index) => [id, index] as const));
export const ACCOUNT_SPECIAL_STAGE_IDS = new Set(SPECIAL_STAGE_SEEDS.map((stage) => stage.id));
export const ACCOUNT_ENEMY_IDS = new Set(ENEMY_SEEDS.map((enemy) => enemy.id));
