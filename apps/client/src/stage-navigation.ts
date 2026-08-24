import type { StageType } from '@frontline/content-schema';
import stageCollectionsJson from '../../../content/stage-collections.json' with { type: 'json' };
import {
  ALL_STAGES,
  STAGES,
  getContiguousClearedStageIds,
  isStageUnlocked,
  type PrototypeStage,
} from './prototype.ts';

export type StageCollectionId = string;

export interface StageCollection {
  readonly id: StageCollectionId;
  readonly stageType: StageType;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly stages: readonly PrototypeStage[];
  /** Progression stage whose clear unlocks this collection. Undefined means available from the start. */
  readonly unlockAfterStageId?: string;
  /** Derived ordinal used only for progress/countdown UI. The stage ID above is the authority. */
  readonly requiredProgressionClears: number;
}

interface StageCollectionContent {
  readonly id: string;
  readonly stageType: StageType;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly stageIds: readonly string[];
  readonly unlockAfterStageId?: string;
}

export const STAGE_COLLECTIONS_PER_PAGE = 2;
export const STAGES_PER_COLLECTION_PAGE = 5;

const ALL_STAGE_BY_ID = new Map(ALL_STAGES.map((stage) => [stage.id, stage] as const));
const PROGRESSION_STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.id, index] as const));

function parseStageCollection(raw: StageCollectionContent, index: number): StageCollection {
  const context = `stageCollections[${index}]`;
  if (!raw.id.trim()) throw new Error(`${context}.id must be non-empty`);
  if (raw.stageType !== 'PROGRESSION' && raw.stageType !== 'SPECIAL') throw new Error(`${context}.stageType is unknown`);
  if (!raw.title.trim() || !raw.shortTitle.trim() || !raw.description.trim()) throw new Error(`${context} text fields must be non-empty`);
  if (!Array.isArray(raw.stageIds) || raw.stageIds.length === 0) throw new Error(`${context}.stageIds must be non-empty`);
  if (new Set(raw.stageIds).size !== raw.stageIds.length) throw new Error(`${context}.stageIds must be unique`);

  const stages = raw.stageIds.map((stageId) => {
    const stage = ALL_STAGE_BY_ID.get(stageId);
    if (!stage) throw new Error(`${context} references unknown stage: ${stageId}`);
    if (stage.stageType !== raw.stageType) throw new Error(`${context} mixes ${raw.stageType} with ${stage.id}:${stage.stageType}`);
    return stage;
  });

  let unlockAfterStageId: string | undefined;
  let requiredProgressionClears = 0;
  if (raw.unlockAfterStageId !== undefined) {
    if (typeof raw.unlockAfterStageId !== 'string' || raw.unlockAfterStageId.trim().length === 0) {
      throw new Error(`${context}.unlockAfterStageId must be a non-empty progression stage id`);
    }
    const progressionIndex = PROGRESSION_STAGE_INDEX.get(raw.unlockAfterStageId);
    if (progressionIndex === undefined) {
      throw new Error(`${context}.unlockAfterStageId references unknown progression stage: ${raw.unlockAfterStageId}`);
    }
    unlockAfterStageId = raw.unlockAfterStageId;
    requiredProgressionClears = progressionIndex + 1;
  }

  return {
    id: raw.id,
    stageType: raw.stageType,
    title: raw.title,
    shortTitle: raw.shortTitle,
    description: raw.description,
    stages,
    ...(unlockAfterStageId === undefined ? {} : { unlockAfterStageId }),
    requiredProgressionClears,
  };
}

function buildStageCollections(): readonly StageCollection[] {
  const collections = (stageCollectionsJson as readonly StageCollectionContent[]).map(parseStageCollection);
  const ids = collections.map((collection) => collection.id);
  if (new Set(ids).size !== ids.length) throw new Error('stage collection ids must be unique');

  const assignedStageIds = collections.flatMap((collection) => collection.stages.map((stage) => stage.id));
  if (new Set(assignedStageIds).size !== assignedStageIds.length) throw new Error('a stage cannot belong to more than one collection');
  if (assignedStageIds.length !== ALL_STAGES.length) throw new Error('every playable stage must belong to exactly one collection');
  for (const stage of ALL_STAGES) {
    if (!assignedStageIds.includes(stage.id)) throw new Error(`stage is missing from collection data: ${stage.id}`);
  }
  return collections;
}

export const STAGE_COLLECTIONS: readonly StageCollection[] = buildStageCollections();

export function getStageCollection(collectionId: string): StageCollection {
  const collection = STAGE_COLLECTIONS.find((candidate) => candidate.id === collectionId);
  if (!collection) throw new Error(`Unknown stage collection: ${collectionId}`);
  return collection;
}

export function getStageCollectionForStage(stageId: string): StageCollection {
  const collection = STAGE_COLLECTIONS.find((candidate) => candidate.stages.some((stage) => stage.id === stageId));
  if (!collection) throw new Error(`Stage is not assigned to a collection: ${stageId}`);
  return collection;
}

export function getStageCollectionPageCount(collections: readonly StageCollection[] = STAGE_COLLECTIONS): number {
  return Math.max(1, Math.ceil(collections.length / STAGE_COLLECTIONS_PER_PAGE));
}

export function getStageCollectionPage(
  page: number,
  collections: readonly StageCollection[] = STAGE_COLLECTIONS,
): readonly StageCollection[] {
  const pageCount = getStageCollectionPageCount(collections);
  const safePage = Math.max(0, Math.min(pageCount - 1, Math.trunc(page)));
  const start = safePage * STAGE_COLLECTIONS_PER_PAGE;
  return collections.slice(start, start + STAGE_COLLECTIONS_PER_PAGE);
}

export function getCollectionStagePageCount(collection: StageCollection): number {
  return Math.max(1, Math.ceil(collection.stages.length / STAGES_PER_COLLECTION_PAGE));
}

export function getCollectionStagePage(collection: StageCollection, page: number): readonly PrototypeStage[] {
  const pageCount = getCollectionStagePageCount(collection);
  const safePage = Math.max(0, Math.min(pageCount - 1, Math.trunc(page)));
  const start = safePage * STAGES_PER_COLLECTION_PAGE;
  return collection.stages.slice(start, start + STAGES_PER_COLLECTION_PAGE);
}

export function getCollectionStagePageIndexForStage(collection: StageCollection, stageId: string): number {
  const index = collection.stages.findIndex((stage) => stage.id === stageId);
  if (index < 0) throw new Error(`Stage ${stageId} is not part of collection ${collection.id}`);
  return Math.floor(index / STAGES_PER_COLLECTION_PAGE);
}

export function isStageCollectionUnlocked(collection: StageCollection, clearedStageIds: readonly string[]): boolean {
  if (!collection.unlockAfterStageId) return true;
  return getContiguousClearedStageIds(clearedStageIds).includes(collection.unlockAfterStageId);
}

/**
 * Navigation-level battle gate. Progression keeps its sequential rule; SPECIAL uses its Collection gate.
 * Main/Battle scenes should converge on this path before collections with different unlock anchors are added.
 */
export function isSortieStageUnlocked(stageId: string, clearedStageIds: readonly string[]): boolean {
  const stage = ALL_STAGE_BY_ID.get(stageId);
  if (!stage) return false;
  if (stage.stageType === 'PROGRESSION') return isStageUnlocked(stage.id, clearedStageIds);
  return isStageCollectionUnlocked(getStageCollectionForStage(stage.id), clearedStageIds);
}

export function getCollectionClearedIds(
  collection: StageCollection,
  clearedStageIds: readonly string[],
  specialClearedStageIds: readonly string[],
): readonly string[] {
  const source = collection.stageType === 'PROGRESSION'
    ? getContiguousClearedStageIds(clearedStageIds)
    : specialClearedStageIds;
  const collectionIds = new Set(collection.stages.map((stage) => stage.id));
  return source.filter((stageId) => collectionIds.has(stageId));
}

export function getFirstUnclearedCollectionStageIndex(
  collection: StageCollection,
  clearedStageIds: readonly string[],
  specialClearedStageIds: readonly string[],
): number {
  const cleared = new Set(getCollectionClearedIds(collection, clearedStageIds, specialClearedStageIds));
  return collection.stages.findIndex((stage) => !cleared.has(stage.id));
}
