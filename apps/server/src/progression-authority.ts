import {
  getEvolutionForm,
  normalizeCharacterLevel,
  normalizeCharacterPlusLevel,
} from '@frontline/sim/meta-progression';
import playerUnitsJson from '../../../content/units/chapter-01.json' with { type: 'json' };
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import enemiesJson from '../../../content/enemies/chapter-01.json' with { type: 'json' };
import stagesJson from '../../../content/stages/chapter-01.json' with { type: 'json' };
import specialStagesJson from '../../../content/stages/special-01.json' with { type: 'json' };
import type { CoopPlayerLoadout } from './coop-room.ts';
import {
  SERVER_CHARACTER_LEVEL_CURVE,
  SERVER_EVOLUTION_FORMS,
  SERVER_PERMANENT_REWARDS,
} from './meta-content.ts';

export const ACCOUNT_PROGRESSION_SCHEMA_VERSION = 1;
export const ACCOUNT_MAX_DECK_SLOTS = 10;
export const ACCOUNT_NORMAL_CLEAR_SOURCES = ['SOLO_BATTLE', 'COOP_BATTLE'] as const;
export type AccountNormalClearSource = (typeof ACCOUNT_NORMAL_CLEAR_SOURCES)[number];

export interface AccountCharacterProgress {
  readonly level: number;
  readonly plusLevel: number;
  readonly unlockedFormIds: readonly string[];
  readonly selectedFormId?: string;
}

export interface AccountProgressionSnapshotV1 {
  readonly schemaVersion: 1;
  readonly clearedStageIds: readonly string[];
  readonly normalClearSourceByStage: Readonly<Record<string, AccountNormalClearSource>>;
  readonly specialClearedStageIds: readonly string[];
  readonly permanentRewardIds: readonly string[];
  readonly discoveredEnemyIds: readonly string[];
  readonly ownedRecruitmentCharacterIds: readonly string[];
  readonly characterProgressById: Readonly<Record<string, AccountCharacterProgress>>;
  readonly deckSlotIds: readonly string[];
}

export interface AccountProgressionRecord {
  readonly accountId: string;
  readonly revision: number;
  readonly snapshot: AccountProgressionSnapshotV1;
  readonly updatedAt: number;
}

export type ReplaceAccountProgressionResult =
  | { readonly ok: true; readonly record: AccountProgressionRecord }
  | { readonly ok: false; readonly reason: 'revision_conflict'; readonly currentRevision: number };

type MainStageSeed = {
  readonly id: string;
  readonly permanentRewardId?: string;
  readonly unlockUnitId?: string;
};
type SimpleIdSeed = { readonly id: string };

const MAIN_STAGES = stagesJson as unknown as readonly MainStageSeed[];
const SPECIAL_STAGES = specialStagesJson as unknown as readonly SimpleIdSeed[];
const STORY_UNITS = playerUnitsJson as unknown as readonly SimpleIdSeed[];
const RECRUITMENT_UNITS = recruitmentUnitsJson as unknown as readonly SimpleIdSeed[];
const ENEMIES = enemiesJson as unknown as readonly SimpleIdSeed[];

const STARTER_CHARACTER_ID = 'militia';
const MAIN_STAGE_IDS = MAIN_STAGES.map((stage) => stage.id);
const MAIN_STAGE_INDEX = new Map(MAIN_STAGE_IDS.map((id, index) => [id, index] as const));
const SPECIAL_STAGE_IDS = new Set(SPECIAL_STAGES.map((stage) => stage.id));
const STORY_CHARACTER_IDS = new Set(STORY_UNITS.map((unit) => unit.id));
const RECRUITMENT_CHARACTER_IDS = new Set(RECRUITMENT_UNITS.map((unit) => unit.id));
const ALL_CHARACTER_IDS = new Set([...STORY_CHARACTER_IDS, ...RECRUITMENT_CHARACTER_IDS]);
const ENEMY_IDS = new Set(ENEMIES.map((enemy) => enemy.id));
const PERMANENT_REWARD_IDS = new Set(SERVER_PERMANENT_REWARDS.map((reward) => reward.id));
const NORMAL_CLEAR_SOURCE_IDS = new Set<string>(ACCOUNT_NORMAL_CLEAR_SOURCES);
const PERMANENT_REWARD_STAGE_INDEX = new Map<string, number>();
const FORMS_BY_CHARACTER = new Map<string, readonly string[]>();

for (const [index, stage] of MAIN_STAGES.entries()) {
  if (stage.permanentRewardId) PERMANENT_REWARD_STAGE_INDEX.set(stage.permanentRewardId, index);
}
for (const form of SERVER_EVOLUTION_FORMS) {
  const ids = FORMS_BY_CHARACTER.get(form.characterId) ?? [];
  FORMS_BY_CHARACTER.set(form.characterId, [...ids, form.formId]);
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function uniqueStrings(value: unknown, context: string): readonly string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string' && entry.length > 0)) {
    throw new Error(`${context} must be a non-empty string array`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${context} must not contain duplicates`);
  return value as readonly string[];
}

function integer(value: unknown, context: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${context} must be an integer in ${min}..${max}`);
  }
  return value as number;
}

function normalizeMainClears(value: unknown): readonly string[] {
  const ids = uniqueStrings(value, 'account progression clearedStageIds');
  if (ids.length > MAIN_STAGE_IDS.length) throw new Error('account progression contains too many main clears');
  ids.forEach((id, index) => {
    if (id !== MAIN_STAGE_IDS[index]) throw new Error(`account progression main clears must be a contiguous prefix:${id}`);
  });
  return ids;
}

function normalizeNormalClearSources(
  value: unknown,
  clearedStageIds: readonly string[],
): Readonly<Record<string, AccountNormalClearSource>> {
  const raw = value === undefined ? {} : record(value, 'account progression normalClearSourceByStage');
  for (const stageId of Object.keys(raw)) {
    if (!clearedStageIds.includes(stageId)) throw new Error(`normal clear source references uncleared stage:${stageId}`);
  }
  const normalized: Record<string, AccountNormalClearSource> = {};
  for (const stageId of clearedStageIds) {
    const candidate = raw[stageId] ?? 'SOLO_BATTLE';
    if (typeof candidate !== 'string' || !NORMAL_CLEAR_SOURCE_IDS.has(candidate)) {
      throw new Error(`invalid normal clear source:${stageId}`);
    }
    normalized[stageId] = candidate as AccountNormalClearSource;
  }
  return normalized;
}

function normalizeSpecialClears(value: unknown, clearedStageIds: readonly string[]): readonly string[] {
  const ids = uniqueStrings(value, 'account progression specialClearedStageIds');
  for (const id of ids) {
    if (!SPECIAL_STAGE_IDS.has(id)) throw new Error(`unknown account special stage:${id}`);
  }
  if (ids.length > 0 && !clearedStageIds.includes('main_01_020')) {
    throw new Error('account special clears require main_01_020 NORMAL_CLEAR');
  }
  return ids;
}

function normalizePermanentRewards(value: unknown, clearedStageIds: readonly string[]): readonly string[] {
  const ids = uniqueStrings(value, 'account progression permanentRewardIds');
  const clearedCount = clearedStageIds.length;
  for (const id of ids) {
    if (!PERMANENT_REWARD_IDS.has(id)) throw new Error(`unknown account permanent reward:${id}`);
    const stageIndex = PERMANENT_REWARD_STAGE_INDEX.get(id);
    if (stageIndex !== undefined && stageIndex >= clearedCount) {
      throw new Error(`account permanent reward is ahead of progression:${id}`);
    }
  }
  for (let index = 0; index < clearedCount; index += 1) {
    const guaranteed = MAIN_STAGES[index]?.permanentRewardId;
    if (guaranteed && !ids.includes(guaranteed)) throw new Error(`account progression is missing guaranteed permanent reward:${guaranteed}`);
  }
  return ids;
}

function normalizeDiscoveredEnemies(value: unknown): readonly string[] {
  const ids = uniqueStrings(value, 'account progression discoveredEnemyIds');
  for (const id of ids) {
    if (!ENEMY_IDS.has(id)) throw new Error(`unknown account enemy discovery:${id}`);
  }
  return ids;
}

function normalizeOwnedRecruitment(value: unknown): readonly string[] {
  const ids = uniqueStrings(value, 'account progression ownedRecruitmentCharacterIds');
  for (const id of ids) {
    if (!RECRUITMENT_CHARACTER_IDS.has(id)) throw new Error(`unknown account recruitment character:${id}`);
  }
  return ids;
}

export function getAccountOwnedCharacterIds(snapshot: Pick<AccountProgressionSnapshotV1, 'clearedStageIds' | 'ownedRecruitmentCharacterIds'>): readonly string[] {
  const owned = new Set<string>([STARTER_CHARACTER_ID]);
  for (const stageId of snapshot.clearedStageIds) {
    const index = MAIN_STAGE_INDEX.get(stageId);
    if (index === undefined) throw new Error(`unknown account main stage:${stageId}`);
    const unlock = MAIN_STAGES[index]?.unlockUnitId;
    if (unlock) owned.add(unlock);
  }
  for (const id of snapshot.ownedRecruitmentCharacterIds) owned.add(id);
  return [...owned].filter((id) => ALL_CHARACTER_IDS.has(id));
}

function normalizeCharacterProgress(
  value: unknown,
  ownedCharacterIds: readonly string[],
): Readonly<Record<string, AccountCharacterProgress>> {
  const raw = value === undefined ? {} : record(value, 'account progression characterProgressById');
  const owned = new Set(ownedCharacterIds);
  for (const characterId of Object.keys(raw)) {
    if (!owned.has(characterId)) throw new Error(`character progress references unowned character:${characterId}`);
  }

  const normalized: Record<string, AccountCharacterProgress> = {};
  for (const characterId of ownedCharacterIds) {
    const candidate = raw[characterId] === undefined ? {} : record(raw[characterId], `character progress ${characterId}`);
    const level = integer(candidate.level ?? 1, `${characterId}.level`, 1, SERVER_CHARACTER_LEVEL_CURVE.levelCap);
    const plusLevel = integer(candidate.plusLevel ?? 0, `${characterId}.plusLevel`, 0, SERVER_CHARACTER_LEVEL_CURVE.plusLevelCap);
    if (level !== normalizeCharacterLevel(SERVER_CHARACTER_LEVEL_CURVE, level)) throw new Error(`invalid character level:${characterId}`);
    if (plusLevel !== normalizeCharacterPlusLevel(SERVER_CHARACTER_LEVEL_CURVE, plusLevel)) throw new Error(`invalid character plus level:${characterId}`);

    const knownForms = FORMS_BY_CHARACTER.get(characterId) ?? [];
    const unlockedRaw = candidate.unlockedFormIds === undefined ? [] : uniqueStrings(candidate.unlockedFormIds, `${characterId}.unlockedFormIds`);
    for (const formId of unlockedRaw) {
      const form = getEvolutionForm(SERVER_EVOLUTION_FORMS, formId);
      if (form.characterId !== characterId) throw new Error(`character form belongs to another character:${formId}`);
    }
    const baseFormId = knownForms[0];
    const unlockedFormIds = baseFormId === undefined
      ? []
      : [...new Set([baseFormId, ...unlockedRaw])];
    const selectedFormId = candidate.selectedFormId === undefined
      ? baseFormId
      : typeof candidate.selectedFormId === 'string' ? candidate.selectedFormId : undefined;
    if (candidate.selectedFormId !== undefined && selectedFormId === undefined) throw new Error(`${characterId}.selectedFormId must be a string`);
    if (selectedFormId !== undefined) {
      const form = getEvolutionForm(SERVER_EVOLUTION_FORMS, selectedFormId);
      if (form.characterId !== characterId) throw new Error(`selected form belongs to another character:${selectedFormId}`);
      if (!unlockedFormIds.includes(selectedFormId)) throw new Error(`selected form is not unlocked:${selectedFormId}`);
    }
    if (knownForms.length === 0 && (unlockedRaw.length > 0 || candidate.selectedFormId !== undefined)) {
      throw new Error(`character has no server evolution forms:${characterId}`);
    }

    normalized[characterId] = {
      level,
      plusLevel,
      unlockedFormIds,
      ...(selectedFormId === undefined ? {} : { selectedFormId }),
    };
  }
  return normalized;
}

function normalizeDeck(value: unknown, ownedCharacterIds: readonly string[]): readonly string[] {
  const ids = uniqueStrings(value, 'account progression deckSlotIds');
  if (ids.length > ACCOUNT_MAX_DECK_SLOTS) throw new Error(`account deck exceeds ${ACCOUNT_MAX_DECK_SLOTS} slots`);
  const owned = new Set(ownedCharacterIds);
  for (const id of ids) {
    if (!owned.has(id)) throw new Error(`account deck references unowned character:${id}`);
  }
  return ids;
}

export function normalizeAccountProgressionSnapshot(value: unknown): AccountProgressionSnapshotV1 {
  const raw = record(value, 'account progression snapshot');
  if (raw.schemaVersion !== ACCOUNT_PROGRESSION_SCHEMA_VERSION) {
    throw new Error(`unsupported account progression schema:${String(raw.schemaVersion)}`);
  }
  const clearedStageIds = normalizeMainClears(raw.clearedStageIds);
  const ownedRecruitmentCharacterIds = normalizeOwnedRecruitment(raw.ownedRecruitmentCharacterIds);
  const ownedCharacterIds = getAccountOwnedCharacterIds({ clearedStageIds, ownedRecruitmentCharacterIds });
  return {
    schemaVersion: ACCOUNT_PROGRESSION_SCHEMA_VERSION,
    clearedStageIds,
    normalClearSourceByStage: normalizeNormalClearSources(raw.normalClearSourceByStage, clearedStageIds),
    specialClearedStageIds: normalizeSpecialClears(raw.specialClearedStageIds, clearedStageIds),
    permanentRewardIds: normalizePermanentRewards(raw.permanentRewardIds, clearedStageIds),
    discoveredEnemyIds: normalizeDiscoveredEnemies(raw.discoveredEnemyIds),
    ownedRecruitmentCharacterIds,
    characterProgressById: normalizeCharacterProgress(raw.characterProgressById, ownedCharacterIds),
    deckSlotIds: normalizeDeck(raw.deckSlotIds, ownedCharacterIds),
  };
}

export function createInitialAccountProgression(): AccountProgressionSnapshotV1 {
  return normalizeAccountProgressionSnapshot({
    schemaVersion: ACCOUNT_PROGRESSION_SCHEMA_VERSION,
    clearedStageIds: [],
    normalClearSourceByStage: {},
    specialClearedStageIds: [],
    permanentRewardIds: [],
    discoveredEnemyIds: [],
    ownedRecruitmentCharacterIds: [],
    characterProgressById: {},
    deckSlotIds: [STARTER_CHARACTER_ID],
  });
}

export function buildAuthoritativeCoopLoadout(
  snapshotValue: unknown,
  requestedCharacterIds: readonly string[],
): CoopPlayerLoadout {
  const snapshot = normalizeAccountProgressionSnapshot(snapshotValue);
  if (requestedCharacterIds.length < 1 || requestedCharacterIds.length > 5) {
    throw new Error('authoritative co-op selection must contain 1..5 characters');
  }
  if (new Set(requestedCharacterIds).size !== requestedCharacterIds.length) {
    throw new Error('authoritative co-op selection must not contain duplicates');
  }
  const owned = new Set(getAccountOwnedCharacterIds(snapshot));
  const characters = requestedCharacterIds.map((characterId) => {
    if (!owned.has(characterId)) throw new Error(`authoritative co-op selection is unowned:${characterId}`);
    const progress = snapshot.characterProgressById[characterId];
    if (!progress) throw new Error(`authoritative character progress missing:${characterId}`);
    return {
      characterId,
      level: progress.level,
      plusLevel: progress.plusLevel,
      ...(progress.selectedFormId === undefined ? {} : { selectedFormId: progress.selectedFormId }),
    };
  });
  return { characters, permanentRewardIds: snapshot.permanentRewardIds, clearedStageIds: snapshot.clearedStageIds };
}

interface AccountProgressionRow {
  readonly schema_version: number;
  readonly revision: number;
  readonly snapshot_json: string;
  readonly updated_at: number;
}

function accountId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 128) throw new Error('accountId must be 1..128 characters');
  return trimmed;
}

function rowToRecord(id: string, row: AccountProgressionRow): AccountProgressionRecord {
  if (row.schema_version !== ACCOUNT_PROGRESSION_SCHEMA_VERSION) {
    throw new Error(`unsupported stored account progression schema:${row.schema_version}`);
  }
  let decoded: unknown;
  try { decoded = JSON.parse(row.snapshot_json); } catch { throw new Error('stored account progression JSON is invalid'); }
  return {
    accountId: id,
    revision: integer(row.revision, 'stored account progression revision', 0, Number.MAX_SAFE_INTEGER),
    snapshot: normalizeAccountProgressionSnapshot(decoded),
    updatedAt: integer(row.updated_at, 'stored account progression updatedAt', 0, Number.MAX_SAFE_INTEGER),
  };
}

export async function loadAccountProgression(db: D1Database, rawAccountId: string): Promise<AccountProgressionRecord | null> {
  const id = accountId(rawAccountId);
  const row = await db.prepare(
    'SELECT schema_version, revision, snapshot_json, updated_at FROM account_progression_saves WHERE user_id = ?1',
  ).bind(id).first<AccountProgressionRow>();
  return row ? rowToRecord(id, row) : null;
}

export async function initializeAccountProgression(
  db: D1Database,
  rawAccountId: string,
  snapshotValue: unknown = createInitialAccountProgression(),
): Promise<AccountProgressionRecord> {
  const id = accountId(rawAccountId);
  const snapshot = normalizeAccountProgressionSnapshot(snapshotValue);
  await db.prepare(
    'INSERT OR IGNORE INTO account_progression_saves (user_id, schema_version, revision, snapshot_json) VALUES (?1, ?2, 0, ?3)',
  ).bind(id, ACCOUNT_PROGRESSION_SCHEMA_VERSION, JSON.stringify(snapshot)).run();
  const record = await loadAccountProgression(db, id);
  if (!record) throw new Error(`account progression could not be initialized:${id}`);
  return record;
}

export async function replaceAccountProgression(
  db: D1Database,
  rawAccountId: string,
  expectedRevision: number,
  snapshotValue: unknown,
): Promise<ReplaceAccountProgressionResult> {
  const id = accountId(rawAccountId);
  const expected = integer(expectedRevision, 'expectedRevision', 0, Number.MAX_SAFE_INTEGER);
  const snapshot = normalizeAccountProgressionSnapshot(snapshotValue);
  const result = await db.prepare(
    'UPDATE account_progression_saves SET schema_version = ?1, revision = revision + 1, snapshot_json = ?2, updated_at = unixepoch() WHERE user_id = ?3 AND revision = ?4',
  ).bind(ACCOUNT_PROGRESSION_SCHEMA_VERSION, JSON.stringify(snapshot), id, expected).run();
  if ((result.meta.changes ?? 0) !== 1) {
    const current = await loadAccountProgression(db, id);
    if (!current) throw new Error(`account progression is not initialized:${id}`);
    return { ok: false, reason: 'revision_conflict', currentRevision: current.revision };
  }
  const record = await loadAccountProgression(db, id);
  if (!record) throw new Error(`account progression disappeared after write:${id}`);
  return { ok: true, record };
}
