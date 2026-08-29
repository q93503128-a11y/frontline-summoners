import type { StageType } from '@frontline/content-schema';
import stageCollectionsJson from '../../../content/stage-collections.json' with { type: 'json' };
import specialUnlocksJson from '../../../content/stages/special-unlocks.json' with { type: 'json' };
import eventAvailabilityJson from '../../../content/stages/event-availability.json' with { type: 'json' };
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
  readonly unlockAfterStageId?: string;
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

interface SpecialUnlockRuleContent {
  readonly stageId: string;
  readonly previousSpecialStageId?: string;
  readonly requiredProgressionStageId?: string;
}

interface EventAvailabilityWindowContent {
  readonly start: string;
  readonly end: string;
}
interface EventAvailabilityContent {
  readonly collectionId: string;
  readonly rerunnable: boolean;
  readonly windows: readonly EventAvailabilityWindowContent[];
}
interface EventAvailabilityWindow {
  readonly startMs: number;
  readonly endMs: number;
}
interface EventAvailability {
  readonly collectionId: string;
  readonly rerunnable: boolean;
  readonly windows: readonly EventAvailabilityWindow[];
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
    if (typeof raw.unlockAfterStageId !== 'string' || raw.unlockAfterStageId.trim().length === 0) throw new Error(`${context}.unlockAfterStageId must be a non-empty progression stage id`);
    const progressionIndex = PROGRESSION_STAGE_INDEX.get(raw.unlockAfterStageId);
    if (progressionIndex === undefined) throw new Error(`${context}.unlockAfterStageId references unknown progression stage: ${raw.unlockAfterStageId}`);
    unlockAfterStageId = raw.unlockAfterStageId;
    requiredProgressionClears = progressionIndex + 1;
  }

  return { id: raw.id, stageType: raw.stageType, title: raw.title, shortTitle: raw.shortTitle, description: raw.description, stages, ...(unlockAfterStageId === undefined ? {} : { unlockAfterStageId }), requiredProgressionClears };
}

function buildStageCollections(): readonly StageCollection[] {
  const collections = (stageCollectionsJson as readonly StageCollectionContent[]).map(parseStageCollection);
  const ids = collections.map((collection) => collection.id);
  if (new Set(ids).size !== ids.length) throw new Error('stage collection ids must be unique');
  const assignedStageIds = collections.flatMap((collection) => collection.stages.map((stage) => stage.id));
  if (new Set(assignedStageIds).size !== assignedStageIds.length) throw new Error('a stage cannot belong to more than one collection');
  if (assignedStageIds.length !== ALL_STAGES.length) throw new Error('every playable stage must belong to exactly one collection');
  for (const stage of ALL_STAGES) if (!assignedStageIds.includes(stage.id)) throw new Error(`stage is missing from collection data: ${stage.id}`);
  return collections;
}

export const STAGE_COLLECTIONS: readonly StageCollection[] = buildStageCollections();

function getStageCollectionForStageRaw(stageId: string): StageCollection {
  const collection = STAGE_COLLECTIONS.find((candidate) => candidate.stages.some((stage) => stage.id === stageId));
  if (!collection) throw new Error(`Stage is not assigned to a collection: ${stageId}`);
  return collection;
}

function buildSpecialUnlockRules(): ReadonlyMap<string, SpecialUnlockRuleContent> {
  if (!Array.isArray(specialUnlocksJson)) throw new Error('special unlock rules must be an array');
  const result = new Map<string, SpecialUnlockRuleContent>();
  for (const raw of specialUnlocksJson as readonly SpecialUnlockRuleContent[]) {
    const stage = ALL_STAGE_BY_ID.get(raw.stageId);
    if (!stage || stage.stageType !== 'SPECIAL') throw new Error(`special unlock rule references unknown SPECIAL stage: ${raw.stageId}`);
    if (result.has(raw.stageId)) throw new Error(`duplicate special unlock rule: ${raw.stageId}`);
    if (raw.previousSpecialStageId !== undefined) {
      const previous = ALL_STAGE_BY_ID.get(raw.previousSpecialStageId);
      if (!previous || previous.stageType !== 'SPECIAL') throw new Error(`special unlock previous stage is invalid: ${raw.previousSpecialStageId}`);
      if (getStageCollectionForStageRaw(raw.stageId).id !== getStageCollectionForStageRaw(raw.previousSpecialStageId).id) throw new Error(`special unlock previous stage must stay in collection: ${raw.stageId}`);
    }
    if (raw.requiredProgressionStageId !== undefined && !PROGRESSION_STAGE_INDEX.has(raw.requiredProgressionStageId)) throw new Error(`special unlock progression gate is invalid: ${raw.requiredProgressionStageId}`);
    result.set(raw.stageId, raw);
  }
  return result;
}

function parseTimestamp(value: string, context: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${context} must be an ISO date-time`);
  return parsed;
}
function buildEventAvailability(): ReadonlyMap<string, EventAvailability> {
  if (!Array.isArray(eventAvailabilityJson)) throw new Error('event availability must be an array');
  const collectionIds = new Set(STAGE_COLLECTIONS.map((collection) => collection.id));
  const result = new Map<string, EventAvailability>();
  for (const [index, raw] of (eventAvailabilityJson as readonly EventAvailabilityContent[]).entries()) {
    const context = `eventAvailability[${index}]`;
    if (!collectionIds.has(raw.collectionId)) throw new Error(`${context}.collectionId references unknown collection: ${raw.collectionId}`);
    if (result.has(raw.collectionId)) throw new Error(`duplicate event availability collection: ${raw.collectionId}`);
    if (typeof raw.rerunnable !== 'boolean') throw new Error(`${context}.rerunnable must be boolean`);
    if (!Array.isArray(raw.windows) || raw.windows.length === 0) throw new Error(`${context}.windows must be non-empty`);
    const windows = raw.windows.map((window, windowIndex) => {
      const startMs = parseTimestamp(window.start, `${context}.windows[${windowIndex}].start`);
      const endMs = parseTimestamp(window.end, `${context}.windows[${windowIndex}].end`);
      if (endMs < startMs) throw new Error(`${context}.windows[${windowIndex}] end must not precede start`);
      return { startMs, endMs };
    }).sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < windows.length; i += 1) if (windows[i]!.startMs <= windows[i - 1]!.endMs) throw new Error(`${context}.windows must not overlap`);
    result.set(raw.collectionId, { collectionId: raw.collectionId, rerunnable: raw.rerunnable, windows });
  }
  return result;
}

const SPECIAL_UNLOCK_RULE_BY_STAGE = buildSpecialUnlockRules();
const EVENT_AVAILABILITY_BY_COLLECTION = buildEventAvailability();

export function getStageCollection(collectionId: string): StageCollection {
  const collection = STAGE_COLLECTIONS.find((candidate) => candidate.id === collectionId);
  if (!collection) throw new Error(`Unknown stage collection: ${collectionId}`);
  return collection;
}
export function getStageCollectionForStage(stageId: string): StageCollection { return getStageCollectionForStageRaw(stageId); }
export function getStageCollectionPageCount(collections: readonly StageCollection[] = STAGE_COLLECTIONS): number { return Math.max(1, Math.ceil(collections.length / STAGE_COLLECTIONS_PER_PAGE)); }
export function getStageCollectionPage(page: number, collections: readonly StageCollection[] = STAGE_COLLECTIONS): readonly StageCollection[] {
  const pageCount = getStageCollectionPageCount(collections); const safePage = Math.max(0, Math.min(pageCount - 1, Math.trunc(page))); const start = safePage * STAGE_COLLECTIONS_PER_PAGE;
  return collections.slice(start, start + STAGE_COLLECTIONS_PER_PAGE);
}
export function getCollectionStagePageCount(collection: StageCollection): number { return Math.max(1, Math.ceil(collection.stages.length / STAGES_PER_COLLECTION_PAGE)); }
export function getCollectionStagePage(collection: StageCollection, page: number): readonly PrototypeStage[] {
  const pageCount = getCollectionStagePageCount(collection); const safePage = Math.max(0, Math.min(pageCount - 1, Math.trunc(page))); const start = safePage * STAGES_PER_COLLECTION_PAGE;
  return collection.stages.slice(start, start + STAGES_PER_COLLECTION_PAGE);
}
export function getCollectionStagePageIndexForStage(collection: StageCollection, stageId: string): number {
  const index = collection.stages.findIndex((stage) => stage.id === stageId); if (index < 0) throw new Error(`Stage ${stageId} is not part of collection ${collection.id}`); return Math.floor(index / STAGES_PER_COLLECTION_PAGE);
}
export function isStageCollectionUnlocked(collection: StageCollection, clearedStageIds: readonly string[]): boolean {
  if (!collection.unlockAfterStageId) return true;
  return getContiguousClearedStageIds(clearedStageIds).includes(collection.unlockAfterStageId);
}
export function isStageCollectionAvailable(collection: StageCollection | string, nowMs = Date.now()): boolean {
  const resolved = typeof collection === 'string' ? getStageCollection(collection) : collection;
  const availability = EVENT_AVAILABILITY_BY_COLLECTION.get(resolved.id);
  if (!availability) return true;
  return availability.windows.some((window) => nowMs >= window.startMs && nowMs <= window.endMs);
}
export function getStageCollectionAvailabilityText(collection: StageCollection | string, nowMs = Date.now()): string | undefined {
  const resolved = typeof collection === 'string' ? getStageCollection(collection) : collection;
  const availability = EVENT_AVAILABILITY_BY_COLLECTION.get(resolved.id);
  if (!availability || isStageCollectionAvailable(resolved, nowMs)) return undefined;
  const next = availability.windows.find((window) => window.startMs > nowMs);
  if (next) return availability.rerunnable ? '이벤트 시작 전 · 복각 일정 있음' : '이벤트 시작 전';
  return availability.rerunnable ? '이벤트 기간 종료 · 복각 예정' : '이벤트 기간 종료';
}

export function isSortieStageUnlocked(stageId: string, clearedStageIds: readonly string[], specialClearedStageIds: readonly string[] = [], nowMs = Date.now()): boolean {
  const stage = ALL_STAGE_BY_ID.get(stageId); if (!stage) return false;
  if (stage.stageType === 'PROGRESSION') return isStageUnlocked(stage.id, clearedStageIds);
  const collection = getStageCollectionForStage(stage.id);
  if (!isStageCollectionUnlocked(collection, clearedStageIds) || !isStageCollectionAvailable(collection, nowMs)) return false;
  const rule = SPECIAL_UNLOCK_RULE_BY_STAGE.get(stage.id);
  if (!rule) return true;
  if (rule.requiredProgressionStageId && !getContiguousClearedStageIds(clearedStageIds).includes(rule.requiredProgressionStageId)) return false;
  if (rule.previousSpecialStageId && !specialClearedStageIds.includes(rule.previousSpecialStageId)) return false;
  return true;
}

export function getSpecialStageUnlockText(stageId: string, clearedStageIds: readonly string[], specialClearedStageIds: readonly string[], nowMs = Date.now()): string | undefined {
  const stage = ALL_STAGE_BY_ID.get(stageId);
  if (!stage || stage.stageType !== 'SPECIAL') return undefined;
  const collection = getStageCollectionForStage(stageId);
  const availabilityText = getStageCollectionAvailabilityText(collection, nowMs);
  if (availabilityText) return availabilityText;
  if (!isStageCollectionUnlocked(collection, clearedStageIds)) return `메인 ${collection.requiredProgressionClears} 스테이지 진도 필요`;
  const rule = SPECIAL_UNLOCK_RULE_BY_STAGE.get(stageId);
  if (!rule) return undefined;
  if (rule.requiredProgressionStageId && !getContiguousClearedStageIds(clearedStageIds).includes(rule.requiredProgressionStageId)) {
    const index = PROGRESSION_STAGE_INDEX.get(rule.requiredProgressionStageId)! + 1;
    return `메인 ${index} 스테이지 진도 필요`;
  }
  if (rule.previousSpecialStageId && !specialClearedStageIds.includes(rule.previousSpecialStageId)) return '이전 단계 NORMAL_CLEAR 필요';
  return undefined;
}

export function getCollectionClearedIds(collection: StageCollection, clearedStageIds: readonly string[], specialClearedStageIds: readonly string[]): readonly string[] {
  const source = collection.stageType === 'PROGRESSION' ? getContiguousClearedStageIds(clearedStageIds) : specialClearedStageIds;
  const collectionIds = new Set(collection.stages.map((stage) => stage.id)); return source.filter((stageId) => collectionIds.has(stageId));
}
export function getFirstUnclearedCollectionStageIndex(collection: StageCollection, clearedStageIds: readonly string[], specialClearedStageIds: readonly string[]): number {
  const cleared = new Set(getCollectionClearedIds(collection, clearedStageIds, specialClearedStageIds)); return collection.stages.findIndex((stage) => !cleared.has(stage.id));
}
