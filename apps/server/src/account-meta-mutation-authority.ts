import { BASE_WEAPON_IDS, type BaseWeaponId } from '@frontline/sim/playable';
import {
  getLevelUpgradeGoldCost,
  getPlusLevelSoulEssenceCost,
} from '@frontline/sim/meta-economy';
import { spendResources, type ResourceAmounts } from '@frontline/sim/resource-ledger';
import playerUnitsJson from '../../../content/units/chapter-01.json' with { type: 'json' };
import recruitmentUnitsJson from '../../../content/units/recruitment-01.json' with { type: 'json' };
import {
  initializeAccountSave,
  loadAccountSave,
  normalizeAccountSaveSnapshot,
  type AccountSaveRecord,
  type AccountSaveSnapshotV2,
} from './account-save-authority.ts';
import {
  ACCOUNT_MAX_DECK_SLOTS,
  getAccountOwnedCharacterIds,
  type AccountCharacterProgress,
} from './progression-authority.ts';
import {
  SERVER_CHARACTER_LEVEL_CURVE,
  SERVER_EVOLUTION_FORMS,
  SERVER_EVOLUTION_RECIPES,
} from './meta-content-v2.ts';
import { isServerCoopBaseWeaponUnlocked } from './runtime-content.ts';

export const ACCOUNT_META_MUTATION_KIND = 'META_PROGRESSION' as const;
export const ACCOUNT_META_ACTIONS = [
  'CHARACTER_LEVEL',
  'CHARACTER_PLUS_LEVEL',
  'EVOLUTION_UNLOCK',
  'EVOLUTION_SELECT',
  'DECK_SET',
  'BASE_WEAPON_SELECT',
] as const;
export type AccountMetaAction = (typeof ACCOUNT_META_ACTIONS)[number];

type CharacterRarity = 'C' | 'B' | 'A' | 'S' | 'SS';
type CharacterAcquisitionClass = 'STORY' | 'RECRUITMENT' | 'SPECIAL';

interface CharacterEconomyProfile {
  readonly acquisitionClass: CharacterAcquisitionClass;
  readonly rarity: CharacterRarity | null;
}

export type AccountMetaMutationInput =
  | {
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly action: 'CHARACTER_LEVEL';
      readonly characterId: string;
      readonly targetLevel: number;
    }
  | {
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly action: 'CHARACTER_PLUS_LEVEL';
      readonly characterId: string;
      readonly targetPlusLevel: number;
    }
  | {
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly action: 'EVOLUTION_UNLOCK';
      readonly characterId: string;
      readonly formId: string;
    }
  | {
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly action: 'EVOLUTION_SELECT';
      readonly characterId: string;
      readonly formId: string;
    }
  | {
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly action: 'DECK_SET';
      readonly deckSlotIds: readonly string[];
    }
  | {
      readonly requestId: string;
      readonly expectedRevision: number;
      readonly action: 'BASE_WEAPON_SELECT';
      readonly baseWeaponId: BaseWeaponId;
    };

export type AccountMetaMutationResult =
  | {
      readonly action: 'CHARACTER_LEVEL';
      readonly characterId: string;
      readonly characterProgress: AccountCharacterProgress;
      readonly spentResources: ResourceAmounts;
    }
  | {
      readonly action: 'CHARACTER_PLUS_LEVEL';
      readonly characterId: string;
      readonly characterProgress: AccountCharacterProgress;
      readonly spentResources: ResourceAmounts;
    }
  | {
      readonly action: 'EVOLUTION_UNLOCK';
      readonly characterId: string;
      readonly formId: string;
      readonly characterProgress: AccountCharacterProgress;
      readonly spentResources: ResourceAmounts;
    }
  | {
      readonly action: 'EVOLUTION_SELECT';
      readonly characterId: string;
      readonly formId: string;
      readonly characterProgress: AccountCharacterProgress;
    }
  | {
      readonly action: 'DECK_SET';
      readonly deckSlotIds: readonly string[];
    }
  | {
      readonly action: 'BASE_WEAPON_SELECT';
      readonly selectedBaseWeaponId: BaseWeaponId;
    };

export type AccountMetaMutationApplyResult =
  | {
      readonly ok: true;
      readonly replayed: boolean;
      readonly record: AccountSaveRecord;
      readonly result: AccountMetaMutationResult;
    }
  | {
      readonly ok: false;
      readonly reason: 'revision_conflict';
      readonly currentRevision: number;
    };

type ReceiptRow = {
  readonly input_fingerprint: string;
  readonly resulting_revision: number;
  readonly result_json: string;
};

type BuiltMutation = {
  readonly snapshot: AccountSaveSnapshotV2;
  readonly result: AccountMetaMutationResult;
};

type UnitEconomySeed = {
  readonly id: string;
  readonly acquisitionClass: CharacterAcquisitionClass;
  readonly rarity: CharacterRarity | null;
};

type EvolutionForm = (typeof SERVER_EVOLUTION_FORMS)[number];

const BASE_WEAPON_ID_SET = new Set<string>(BASE_WEAPON_IDS);
const CHARACTER_RARITIES = new Set<string>(['C', 'B', 'A', 'S', 'SS']);
const CHARACTER_ACQUISITION_CLASSES = new Set<string>(['STORY', 'RECRUITMENT', 'SPECIAL']);
const CHARACTER_ECONOMY_BY_ID = new Map<string, CharacterEconomyProfile>();
const FORM_BY_ID = new Map(SERVER_EVOLUTION_FORMS.map((form) => [form.formId, form] as const));
const RECIPE_BY_FORM_ID = new Map(SERVER_EVOLUTION_RECIPES.map((recipe) => [recipe.formId, recipe] as const));
const FORM_BY_CHARACTER_ORDER = new Map<string, EvolutionForm>(
  SERVER_EVOLUTION_FORMS.map((form) => [`${form.characterId}:${form.formOrder}`, form]),
);

for (const raw of [...playerUnitsJson, ...recruitmentUnitsJson] as unknown as readonly UnitEconomySeed[]) {
  if (typeof raw.id !== 'string' || raw.id.length === 0) throw new Error('account meta unit id must be non-empty');
  if (!CHARACTER_ACQUISITION_CLASSES.has(raw.acquisitionClass)) throw new Error(`account meta unit acquisition class is unknown:${raw.id}`);
  if (raw.rarity !== null && !CHARACTER_RARITIES.has(raw.rarity)) throw new Error(`account meta unit rarity is unknown:${raw.id}`);
  if (CHARACTER_ECONOMY_BY_ID.has(raw.id)) throw new Error(`duplicate account meta unit:${raw.id}`);
  CHARACTER_ECONOMY_BY_ID.set(raw.id, { acquisitionClass: raw.acquisitionClass, rarity: raw.rarity });
}

function nonEmptyId(value: string, context: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return trimmed;
}

function integer(value: number, context: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${context} must be an integer in ${min}..${max}`);
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function parseReceipt(row: ReceiptRow): AccountMetaMutationResult {
  try {
    return JSON.parse(row.result_json) as AccountMetaMutationResult;
  } catch {
    throw new Error('stored account meta mutation receipt JSON is invalid');
  }
}

function getBaseLevelCap(clearedStageIds: readonly string[]): number {
  const cleared = new Set(clearedStageIds);
  if (cleared.has('main_04_020')) return Math.min(50, SERVER_CHARACTER_LEVEL_CURVE.levelCap);
  if (cleared.has('main_03_020')) return Math.min(40, SERVER_CHARACTER_LEVEL_CURVE.levelCap);
  if (cleared.has('main_02_020')) return Math.min(30, SERVER_CHARACTER_LEVEL_CURVE.levelCap);
  if (cleared.has('main_01_020')) return Math.min(20, SERVER_CHARACTER_LEVEL_CURVE.levelCap);
  return Math.min(10, SERVER_CHARACTER_LEVEL_CURVE.levelCap);
}

function requireOwnedCharacter(snapshot: AccountSaveSnapshotV2, rawCharacterId: string): readonly [string, AccountCharacterProgress] {
  const characterId = nonEmptyId(rawCharacterId, 'characterId');
  const owned = new Set(getAccountOwnedCharacterIds(snapshot));
  if (!owned.has(characterId)) throw new Error(`account meta character is not owned:${characterId}`);
  const progress = snapshot.characterProgressById[characterId];
  if (!progress) throw new Error(`account meta character progress is missing:${characterId}`);
  return [characterId, progress];
}

function replaceCharacterProgress(
  snapshot: AccountSaveSnapshotV2,
  characterId: string,
  progress: AccountCharacterProgress,
): Readonly<Record<string, AccountCharacterProgress>> {
  return { ...snapshot.characterProgressById, [characterId]: progress };
}

function normalizeBuilt(
  snapshot: AccountSaveSnapshotV2,
  result: AccountMetaMutationResult,
  nowMs: number,
): BuiltMutation {
  return { snapshot: normalizeAccountSaveSnapshot(snapshot, nowMs), result };
}

function buildMetaProgressionResult(
  snapshot: AccountSaveSnapshotV2,
  input: AccountMetaMutationInput,
  nowMs = Date.now(),
): BuiltMutation {
  if (input.action === 'CHARACTER_LEVEL') {
    const [characterId, current] = requireOwnedCharacter(snapshot, input.characterId);
    const targetLevel = integer(input.targetLevel, 'targetLevel', 1, SERVER_CHARACTER_LEVEL_CURVE.levelCap);
    if (targetLevel < current.level) throw new Error('character level cannot decrease');
    const cap = getBaseLevelCap(snapshot.clearedStageIds);
    if (targetLevel > cap) throw new Error(`Base level cap is Lv${cap}`);
    const spentResources: ResourceAmounts = { gold: getLevelUpgradeGoldCost(current.level, targetLevel) };
    const characterProgress: AccountCharacterProgress = { ...current, level: targetLevel };
    return normalizeBuilt({
      ...snapshot,
      resourceLedgerById: spendResources(snapshot.resourceLedgerById, spentResources),
      characterProgressById: replaceCharacterProgress(snapshot, characterId, characterProgress),
    }, { action: input.action, characterId, characterProgress, spentResources }, nowMs);
  }

  if (input.action === 'CHARACTER_PLUS_LEVEL') {
    const [characterId, current] = requireOwnedCharacter(snapshot, input.characterId);
    const targetPlusLevel = integer(input.targetPlusLevel, 'targetPlusLevel', 0, SERVER_CHARACTER_LEVEL_CURVE.plusLevelCap);
    if (targetPlusLevel < current.plusLevel) throw new Error('character plus level cannot decrease');
    const profile = CHARACTER_ECONOMY_BY_ID.get(characterId);
    if (!profile) throw new Error(`account meta character economy profile is missing:${characterId}`);
    const perLevelCost = getPlusLevelSoulEssenceCost(profile.acquisitionClass, profile.rarity);
    const spentResources: ResourceAmounts = { soul_essence: perLevelCost * (targetPlusLevel - current.plusLevel) };
    const characterProgress: AccountCharacterProgress = { ...current, plusLevel: targetPlusLevel };
    return normalizeBuilt({
      ...snapshot,
      resourceLedgerById: spendResources(snapshot.resourceLedgerById, spentResources),
      characterProgressById: replaceCharacterProgress(snapshot, characterId, characterProgress),
    }, { action: input.action, characterId, characterProgress, spentResources }, nowMs);
  }

  if (input.action === 'EVOLUTION_UNLOCK') {
    const [characterId, current] = requireOwnedCharacter(snapshot, input.characterId);
    const formId = nonEmptyId(input.formId, 'formId');
    const form = FORM_BY_ID.get(formId);
    if (!form) throw new Error(`unknown account evolution form:${formId}`);
    if (form.characterId !== characterId) throw new Error(`evolution form belongs to another character:${formId}`);
    if (current.unlockedFormIds.includes(formId)) {
      return normalizeBuilt(snapshot, { action: input.action, characterId, formId, characterProgress: current, spentResources: {} }, nowMs);
    }
    if (form.formOrder === 1) throw new Error('base evolution form is unlocked automatically');
    const previous = FORM_BY_CHARACTER_ORDER.get(`${characterId}:${form.formOrder - 1}`);
    if (!previous || !current.unlockedFormIds.includes(previous.formId)) {
      throw new Error(`previous evolution form must be unlocked first:${formId}`);
    }
    const recipe = RECIPE_BY_FORM_ID.get(formId);
    if (!recipe) throw new Error(`evolution form has no paid unlock recipe:${formId}`);
    if (current.level < recipe.requiredBaseLevel) throw new Error(`Base Lv${recipe.requiredBaseLevel} is required:${formId}`);
    const spentResources: ResourceAmounts = recipe.cost;
    const characterProgress: AccountCharacterProgress = {
      ...current,
      unlockedFormIds: [...current.unlockedFormIds, formId],
    };
    return normalizeBuilt({
      ...snapshot,
      resourceLedgerById: spendResources(snapshot.resourceLedgerById, spentResources),
      characterProgressById: replaceCharacterProgress(snapshot, characterId, characterProgress),
    }, { action: input.action, characterId, formId, characterProgress, spentResources }, nowMs);
  }

  if (input.action === 'EVOLUTION_SELECT') {
    const [characterId, current] = requireOwnedCharacter(snapshot, input.characterId);
    const formId = nonEmptyId(input.formId, 'formId');
    const form = FORM_BY_ID.get(formId);
    if (!form) throw new Error(`unknown account evolution form:${formId}`);
    if (form.characterId !== characterId) throw new Error(`evolution form belongs to another character:${formId}`);
    if (!current.unlockedFormIds.includes(formId)) throw new Error(`evolution form is not unlocked:${formId}`);
    const characterProgress: AccountCharacterProgress = { ...current, selectedFormId: formId };
    return normalizeBuilt({
      ...snapshot,
      characterProgressById: replaceCharacterProgress(snapshot, characterId, characterProgress),
    }, { action: input.action, characterId, formId, characterProgress }, nowMs);
  }

  if (input.action === 'DECK_SET') {
    if (!Array.isArray(input.deckSlotIds) || input.deckSlotIds.length < 1 || input.deckSlotIds.length > ACCOUNT_MAX_DECK_SLOTS) {
      throw new Error(`account deck must contain 1..${ACCOUNT_MAX_DECK_SLOTS} characters`);
    }
    const deckSlotIds = input.deckSlotIds.map((id, index) => nonEmptyId(id, `deckSlotIds[${index}]`));
    if (new Set(deckSlotIds).size !== deckSlotIds.length) throw new Error('account deck must not contain duplicate characters');
    const owned = new Set(getAccountOwnedCharacterIds(snapshot));
    for (const characterId of deckSlotIds) {
      if (!owned.has(characterId)) throw new Error(`account deck references unowned character:${characterId}`);
    }
    return normalizeBuilt({ ...snapshot, deckSlotIds }, { action: input.action, deckSlotIds }, nowMs);
  }

  if (input.action === 'BASE_WEAPON_SELECT') {
    if (typeof input.baseWeaponId !== 'string' || !BASE_WEAPON_ID_SET.has(input.baseWeaponId)) {
      throw new Error(`unknown account base weapon:${String(input.baseWeaponId)}`);
    }
    const baseWeaponId = input.baseWeaponId as BaseWeaponId;
    if (!isServerCoopBaseWeaponUnlocked(baseWeaponId, snapshot.clearedStageIds)) {
      throw new Error(`account base weapon is locked:${baseWeaponId}`);
    }
    return normalizeBuilt({ ...snapshot, selectedBaseWeaponId: baseWeaponId }, {
      action: input.action,
      selectedBaseWeaponId: baseWeaponId,
    }, nowMs);
  }

  throw new Error(`unknown account meta action:${String((input as { readonly action?: unknown }).action)}`);
}

function metaFingerprint(input: AccountMetaMutationInput): string {
  if (input.action === 'CHARACTER_LEVEL') return fingerprint({ action: input.action, characterId: input.characterId, targetLevel: input.targetLevel });
  if (input.action === 'CHARACTER_PLUS_LEVEL') return fingerprint({ action: input.action, characterId: input.characterId, targetPlusLevel: input.targetPlusLevel });
  if (input.action === 'EVOLUTION_UNLOCK' || input.action === 'EVOLUTION_SELECT') {
    return fingerprint({ action: input.action, characterId: input.characterId, formId: input.formId });
  }
  if (input.action === 'DECK_SET') return fingerprint({ action: input.action, deckSlotIds: input.deckSlotIds });
  if (input.action === 'BASE_WEAPON_SELECT') return fingerprint({ action: input.action, baseWeaponId: input.baseWeaponId });
  throw new Error(`unknown account meta action:${String((input as { readonly action?: unknown }).action)}`);
}

async function loadReceipt(db: D1Database, accountId: string, mutationId: string): Promise<ReceiptRow | null> {
  return db.prepare(
    'SELECT input_fingerprint, resulting_revision, result_json FROM account_mutation_receipts WHERE user_id = ?1 AND mutation_kind = ?2 AND mutation_id = ?3',
  ).bind(accountId, ACCOUNT_META_MUTATION_KIND, mutationId).first<ReceiptRow>();
}

async function resolveReplay(
  db: D1Database,
  accountId: string,
  mutationId: string,
  inputFingerprint: string,
  nowMs: number,
): Promise<AccountMetaMutationApplyResult | null> {
  const receipt = await loadReceipt(db, accountId, mutationId);
  if (!receipt) return null;
  if (receipt.input_fingerprint !== inputFingerprint) {
    throw new Error(`idempotency key reused with different input:${ACCOUNT_META_MUTATION_KIND}:${mutationId}`);
  }
  const record = await loadAccountSave(db, accountId, nowMs);
  if (!record) throw new Error(`account save missing for mutation receipt:${accountId}`);
  if (record.revision < receipt.resulting_revision) throw new Error(`account save revision is behind mutation receipt:${mutationId}`);
  return { ok: true, replayed: true, record, result: parseReceipt(receipt) };
}

async function commitMetaMutation(
  db: D1Database,
  rawAccountId: string,
  input: AccountMetaMutationInput,
  nowMs: number,
): Promise<AccountMetaMutationApplyResult> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const requestId = nonEmptyId(input.requestId, 'requestId');
  const expectedRevision = integer(input.expectedRevision, 'expectedRevision', 0, Number.MAX_SAFE_INTEGER);
  const inputFingerprint = metaFingerprint(input);
  const current = await initializeAccountSave(db, accountId, undefined, nowMs);
  const replay = await resolveReplay(db, accountId, requestId, inputFingerprint, nowMs);
  if (replay) return replay;
  if (current.revision !== expectedRevision) {
    return { ok: false, reason: 'revision_conflict', currentRevision: current.revision };
  }

  const built = buildMetaProgressionResult(current.snapshot, input, nowMs);
  const nextSnapshot = normalizeAccountSaveSnapshot(built.snapshot, nowMs);
  const nextRevision = expectedRevision + 1;
  const snapshotJson = JSON.stringify(nextSnapshot);
  const resultJson = JSON.stringify(built.result);

  try {
    const writes = await db.batch([
      db.prepare(
        `UPDATE account_saves
         SET schema_version = 2,
             revision = CASE WHEN revision = ?3 THEN revision + 1 ELSE -1 END,
             snapshot_json = ?1,
             updated_at = unixepoch()
         WHERE user_id = ?2`,
      ).bind(snapshotJson, accountId, expectedRevision),
      db.prepare(
        `INSERT INTO account_mutation_receipts
         (user_id, mutation_kind, mutation_id, input_fingerprint, resulting_revision, result_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(accountId, ACCOUNT_META_MUTATION_KIND, requestId, inputFingerprint, nextRevision, resultJson),
    ]);
    const saveWrite = writes[0];
    const receiptWrite = writes[1];
    if (!saveWrite || !receiptWrite) throw new Error('account meta mutation batch returned incomplete results');
    if ((saveWrite.meta.changes ?? 0) !== 1 || (receiptWrite.meta.changes ?? 0) !== 1) {
      throw new Error(`account meta mutation batch did not commit both rows:${requestId}`);
    }
  } catch (error) {
    const racedReplay = await resolveReplay(db, accountId, requestId, inputFingerprint, nowMs);
    if (racedReplay) return racedReplay;
    const latest = await loadAccountSave(db, accountId, nowMs);
    if (latest && latest.revision !== expectedRevision) {
      return { ok: false, reason: 'revision_conflict', currentRevision: latest.revision };
    }
    throw error;
  }

  const record = await loadAccountSave(db, accountId, nowMs);
  if (!record || record.revision !== nextRevision) {
    throw new Error(`account meta mutation committed without expected save revision:${requestId}`);
  }
  return { ok: true, replayed: false, record, result: built.result };
}

export async function applyAccountMetaProgression(
  db: D1Database,
  accountId: string,
  input: AccountMetaMutationInput,
  nowMs = Date.now(),
): Promise<AccountMetaMutationApplyResult> {
  return commitMetaMutation(db, accountId, input, nowMs);
}

export const __accountMetaMutationTestOnly = {
  buildMetaProgressionResult,
  getBaseLevelCap,
};
