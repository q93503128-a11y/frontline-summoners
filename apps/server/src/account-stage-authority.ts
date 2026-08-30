import { parseStagePolicies, type StagePolicyContent } from '@frontline/content-schema/stage-policy';
import {
  getPeriodicCollectionWindowState,
  PERIODIC_REWARD_COLLECTION_IDS,
  type PeriodicCollectionSchedule,
  type PeriodicRewardCollectionId,
} from '@frontline/sim/periodic-special';
import stageCollectionsJson from '../../../content/stage-collections.json' with { type: 'json' };
import specialUnlocksJson from '../../../content/stages/special-unlocks.json' with { type: 'json' };
import eventAvailabilityJson from '../../../content/stages/event-availability.json' with { type: 'json' };
import periodicAvailabilityJson from '../../../content/stages/periodic-availability.json' with { type: 'json' };
import policiesOneTwoJson from '../../../content/stages/policies-01-02.json' with { type: 'json' };
import policiesThreeJson from '../../../content/stages/policies-03.json' with { type: 'json' };
import policiesFourJson from '../../../content/stages/policies-04.json' with { type: 'json' };
import policiesResourceJson from '../../../content/stages/policies-special-resource.json' with { type: 'json' };
import policiesPermanentJson from '../../../content/stages/policies-special-permanent.json' with { type: 'json' };
import policiesRestrictionJson from '../../../content/stages/policies-special-restriction.json' with { type: 'json' };
import policiesEventJson from '../../../content/stages/policies-special-event.json' with { type: 'json' };
import { ACCOUNT_MAIN_STAGE_IDS, ACCOUNT_SPECIAL_STAGE_IDS } from './account-content.ts';

interface StageCollectionSeed {
  readonly id: string;
  readonly stageType: 'PROGRESSION' | 'SPECIAL';
  readonly stageIds: readonly string[];
  readonly unlockAfterStageId?: string;
}

interface SpecialUnlockRule {
  readonly stageId: string;
  readonly previousSpecialStageId?: string;
  readonly requiredProgressionStageId?: string;
}

interface EventAvailabilitySeed {
  readonly collectionId: string;
  readonly windows: readonly { readonly start: string; readonly end: string }[];
}

interface PeriodicAvailabilitySeed {
  readonly collectionId: string;
  readonly epoch: string;
  readonly cycleHours: number;
  readonly openHours: number;
  readonly offsetHours: number;
}

interface ResolvedSpecialAccess {
  readonly collectionId: string;
  readonly policy: StagePolicyContent;
}

const ALL_STAGE_IDS = new Set([...ACCOUNT_MAIN_STAGE_IDS, ...ACCOUNT_SPECIAL_STAGE_IDS]);
const STAGE_POLICIES = parseStagePolicies([
  ...policiesOneTwoJson,
  ...policiesThreeJson,
  ...policiesFourJson,
  ...policiesResourceJson,
  ...policiesPermanentJson,
  ...policiesRestrictionJson,
  ...policiesEventJson,
], ALL_STAGE_IDS);
const STAGE_POLICY_BY_ID = new Map(STAGE_POLICIES.map((policy) => [policy.stageId, policy] as const));

const COLLECTION_BY_STAGE_ID = new Map<string, StageCollectionSeed>();
const COLLECTION_BY_ID = new Map<string, StageCollectionSeed>();
for (const collection of stageCollectionsJson as readonly StageCollectionSeed[]) {
  if (COLLECTION_BY_ID.has(collection.id)) throw new Error(`duplicate account stage collection:${collection.id}`);
  COLLECTION_BY_ID.set(collection.id, collection);
  for (const stageId of collection.stageIds) {
    if (!ALL_STAGE_IDS.has(stageId)) throw new Error(`account stage collection references unknown stage:${stageId}`);
    if (COLLECTION_BY_STAGE_ID.has(stageId)) throw new Error(`account stage belongs to multiple collections:${stageId}`);
    COLLECTION_BY_STAGE_ID.set(stageId, collection);
  }
}
if (COLLECTION_BY_STAGE_ID.size !== ALL_STAGE_IDS.size) throw new Error(`account stage collection coverage mismatch:${COLLECTION_BY_STAGE_ID.size}/${ALL_STAGE_IDS.size}`);

const SPECIAL_UNLOCK_BY_STAGE_ID = new Map<string, SpecialUnlockRule>();
for (const rule of specialUnlocksJson as readonly SpecialUnlockRule[]) {
  if (!ACCOUNT_SPECIAL_STAGE_IDS.has(rule.stageId)) throw new Error(`account special unlock references unknown stage:${rule.stageId}`);
  if (SPECIAL_UNLOCK_BY_STAGE_ID.has(rule.stageId)) throw new Error(`duplicate account special unlock:${rule.stageId}`);
  if (rule.previousSpecialStageId !== undefined && !ACCOUNT_SPECIAL_STAGE_IDS.has(rule.previousSpecialStageId)) {
    throw new Error(`account special unlock previous stage is unknown:${rule.previousSpecialStageId}`);
  }
  if (rule.requiredProgressionStageId !== undefined && !ACCOUNT_MAIN_STAGE_IDS.includes(rule.requiredProgressionStageId)) {
    throw new Error(`account special unlock progression stage is unknown:${rule.requiredProgressionStageId}`);
  }
  SPECIAL_UNLOCK_BY_STAGE_ID.set(rule.stageId, rule);
}

const EVENT_WINDOWS_BY_COLLECTION = new Map<string, readonly { readonly startMs: number; readonly endMs: number }[]>();
for (const entry of eventAvailabilityJson as readonly EventAvailabilitySeed[]) {
  if (!COLLECTION_BY_ID.has(entry.collectionId)) throw new Error(`account event availability references unknown collection:${entry.collectionId}`);
  const windows = entry.windows.map((window) => {
    const startMs = Date.parse(window.start);
    const endMs = Date.parse(window.end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) throw new Error(`invalid account event availability:${entry.collectionId}`);
    return { startMs, endMs };
  });
  EVENT_WINDOWS_BY_COLLECTION.set(entry.collectionId, windows);
}

const PERIODIC_SCHEDULE_BY_COLLECTION = new Map<string, PeriodicCollectionSchedule>();
const knownPeriodic = new Set<string>(PERIODIC_REWARD_COLLECTION_IDS);
for (const entry of periodicAvailabilityJson as readonly PeriodicAvailabilitySeed[]) {
  if (!knownPeriodic.has(entry.collectionId) || !COLLECTION_BY_ID.has(entry.collectionId)) throw new Error(`account periodic availability references unknown collection:${entry.collectionId}`);
  const epochMs = Date.parse(entry.epoch);
  if (!Number.isFinite(epochMs) || !Number.isInteger(entry.cycleHours) || !Number.isInteger(entry.openHours) || !Number.isInteger(entry.offsetHours)
    || entry.cycleHours <= 0 || entry.openHours <= 0 || entry.openHours > entry.cycleHours || entry.offsetHours < 0) {
    throw new Error(`invalid account periodic availability:${entry.collectionId}`);
  }
  PERIODIC_SCHEDULE_BY_COLLECTION.set(entry.collectionId, {
    collectionId: entry.collectionId as PeriodicRewardCollectionId,
    epochMs,
    cycleMs: entry.cycleHours * 3_600_000,
    openMs: entry.openHours * 3_600_000,
    offsetMs: entry.offsetHours * 3_600_000,
  });
}
for (const collectionId of PERIODIC_REWARD_COLLECTION_IDS) {
  if (!PERIODIC_SCHEDULE_BY_COLLECTION.has(collectionId)) throw new Error(`account periodic availability missing collection:${collectionId}`);
}

export function getAccountStagePolicy(stageId: string): StagePolicyContent {
  const policy = STAGE_POLICY_BY_ID.get(stageId);
  if (!policy) throw new Error(`unknown account stage policy:${stageId}`);
  return policy;
}

export function isAccountStageAvailable(stageId: string, nowMs = Date.now()): boolean {
  const collection = COLLECTION_BY_STAGE_ID.get(stageId);
  if (!collection) return false;
  const windows = EVENT_WINDOWS_BY_COLLECTION.get(collection.id);
  if (windows && !windows.some((window) => nowMs >= window.startMs && nowMs <= window.endMs)) return false;
  const schedule = PERIODIC_SCHEDULE_BY_COLLECTION.get(collection.id);
  return !schedule || getPeriodicCollectionWindowState(schedule, nowMs).available;
}

export function assertAccountSpecialClearHistory(
  specialClearedStageIds: readonly string[],
  clearedStageIds: readonly string[],
): void {
  const specialClears = new Set(specialClearedStageIds);
  for (const stageId of specialClearedStageIds) {
    if (!ACCOUNT_SPECIAL_STAGE_IDS.has(stageId)) throw new Error(`unknown account SPECIAL stage:${stageId}`);
    const collection = COLLECTION_BY_STAGE_ID.get(stageId);
    if (!collection || collection.stageType !== 'SPECIAL') throw new Error(`account SPECIAL collection missing:${stageId}`);
    if (collection.unlockAfterStageId && !clearedStageIds.includes(collection.unlockAfterStageId)) {
      throw new Error(`historical SPECIAL collection gate is not satisfied:${stageId}`);
    }
    const rule = SPECIAL_UNLOCK_BY_STAGE_ID.get(stageId);
    if (rule?.requiredProgressionStageId && !clearedStageIds.includes(rule.requiredProgressionStageId)) {
      throw new Error(`historical SPECIAL progression gate is not satisfied:${stageId}`);
    }
    if (rule?.previousSpecialStageId && !specialClears.has(rule.previousSpecialStageId)) {
      throw new Error(`historical SPECIAL previous clear is missing:${stageId}`);
    }
  }
}

export function assertAccountSpecialStagePlayable(
  stageId: string,
  clearedStageIds: readonly string[],
  specialClearedStageIds: readonly string[],
  nowMs = Date.now(),
): ResolvedSpecialAccess {
  if (!ACCOUNT_SPECIAL_STAGE_IDS.has(stageId)) throw new Error(`unknown account SPECIAL stage:${stageId}`);
  const collection = COLLECTION_BY_STAGE_ID.get(stageId);
  if (!collection || collection.stageType !== 'SPECIAL') throw new Error(`account SPECIAL collection missing:${stageId}`);
  if (collection.unlockAfterStageId && !clearedStageIds.includes(collection.unlockAfterStageId)) {
    throw new Error(`SPECIAL collection is locked:${stageId}`);
  }
  if (!isAccountStageAvailable(stageId, nowMs)) throw new Error(`SPECIAL stage is not currently available:${stageId}`);
  const rule = SPECIAL_UNLOCK_BY_STAGE_ID.get(stageId);
  if (rule?.requiredProgressionStageId && !clearedStageIds.includes(rule.requiredProgressionStageId)) {
    throw new Error(`SPECIAL progression gate is locked:${stageId}`);
  }
  if (rule?.previousSpecialStageId && !specialClearedStageIds.includes(rule.previousSpecialStageId)) {
    throw new Error(`SPECIAL previous stage is uncleared:${stageId}`);
  }
  return { collectionId: collection.id, policy: getAccountStagePolicy(stageId) };
}
