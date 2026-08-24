import type { StageType } from '@frontline/content-schema';
import {
  SPECIAL_STAGES,
  STAGES,
  getContiguousClearedStageIds,
  type PrototypeStage,
} from './prototype.ts';

export type StageCollectionId = 'chapter-01' | 'special-border-01';

export interface StageCollection {
  readonly id: StageCollectionId;
  readonly stageType: StageType;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly stages: readonly PrototypeStage[];
  readonly requiredProgressionClears: number;
}

export const STAGE_COLLECTIONS: readonly StageCollection[] = [
  {
    id: 'chapter-01',
    stageType: 'PROGRESSION',
    title: '제1장 · 뒤집힌 국경',
    shortTitle: '제1장',
    description: '첫 전선을 밀며 동료와 보물을 확보한다.',
    stages: STAGES,
    requiredProgressionClears: 0,
  },
  {
    id: 'special-border-01',
    stageType: 'SPECIAL',
    title: '특수전 · 뒤집힌 국경',
    shortTitle: '특수전',
    description: '출격 제한·러시·장거리·보스 연전 도전.',
    stages: SPECIAL_STAGES,
    requiredProgressionClears: STAGES.length,
  },
];

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

export function isStageCollectionUnlocked(collection: StageCollection, clearedStageIds: readonly string[]): boolean {
  return getContiguousClearedStageIds(clearedStageIds).length >= collection.requiredProgressionClears;
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
