import {
  stepPlayableBattle,
  tryFireBaseWeapon,
  trySpawnPlayerUnit,
  tryUpgradeSupply,
  type PlayableBattleState,
} from '@frontline/sim/playable';
import { isRecordModeId, isRecordModeUnlocked, type RecordModeId } from '@frontline/sim/record-content';
import { stepBossRushRecordBattle, stepEndlessRecordBattle } from '@frontline/sim/record-playable';
import {
  initializeAccountSave,
  normalizeAccountSaveSnapshot,
  type AccountSaveRecord,
  type AccountSaveSnapshotV2,
} from './account-save-authority.ts';
import {
  applyAccountEnemyDiscoveries,
  normalizeServerEnemyDiscoveries,
} from './account-enemy-discovery-authority.ts';
import { ACCOUNT_MAIN_STAGE_INDEX, ACCOUNT_SPECIAL_STAGE_IDS } from './account-content.ts';
import {
  applyAccountMainBattleResult,
  applyAccountRecordResult,
  type AccountMainBattleMutationResult,
  type AccountRecordMutationResult,
} from './account-mutation-authority.ts';
import { applyAccountSpecialBattleResult, type AccountSpecialBattleMutationResult } from './account-special-mutation-authority.ts';
import { assertAccountSpecialStagePlayable } from './account-stage-authority.ts';
import {
  createAccountTrustedBattle,
  createAccountTrustedRecordBattle,
} from './account-trusted-battle-runtime.ts';

export const TRUSTED_BATTLE_KINDS = ['MAIN', 'SPECIAL', 'RECORD'] as const;
export type TrustedBattleKind = (typeof TRUSTED_BATTLE_KINDS)[number];
export const TRUSTED_BATTLE_LIFETIME_MS = 6 * 60 * 60 * 1000;
export const TRUSTED_BATTLE_MAX_REPLAY_FRAMES = 30 * 60 * 30;
export const TRUSTED_BATTLE_MAX_COMMANDS = 4096;
export const TRUSTED_BATTLE_MAX_ACTIVE_RUNS = 4;

export type TrustedBattleCommand =
  | { readonly tick: number; readonly type: 'SPAWN'; readonly slotId: string }
  | { readonly tick: number; readonly type: 'UPGRADE_SUPPLY' }
  | { readonly tick: number; readonly type: 'FIRE_BASE_WEAPON' };

export interface TrustedBattleStartResult {
  readonly battleId: string;
  readonly kind: TrustedBattleKind;
  readonly targetId: string;
  readonly startRevision: number;
  readonly initialStateHash: string;
  readonly expiresAtMs: number;
}

export interface TrustedBattleCompletionResult {
  readonly battleId: string;
  readonly kind: TrustedBattleKind;
  readonly targetId: string;
  readonly winner: 'PLAYER' | 'ENEMY' | 'DRAW';
  readonly clearFrames: number;
  readonly finalStateHash: string;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
  readonly discoveredEnemyIds: readonly string[];
  readonly completedAtMs: number;
  readonly recordMode?: 'ENDLESS_FRONT' | 'BOSS_RUSH';
  readonly defeatedBosses?: number;
  readonly recordCompleted?: boolean;
}

export type TrustedBattleClaimMutationResult = AccountMainBattleMutationResult | AccountSpecialBattleMutationResult | AccountRecordMutationResult;
export type TrustedBattleClaimResult =
  | {
      readonly ok: true;
      readonly replayed: boolean;
      readonly awarded: boolean;
      readonly record: AccountSaveRecord;
      readonly completion: TrustedBattleCompletionResult;
      readonly result: TrustedBattleClaimMutationResult | null;
    }
  | { readonly ok: false; readonly reason: 'revision_conflict'; readonly currentRevision: number };

type TrustedBattleRow = {
  readonly battle_id: string;
  readonly battle_kind: TrustedBattleKind;
  readonly target_id: string;
  readonly start_revision: number;
  readonly start_snapshot_json: string;
  readonly initial_state_hash: string;
  readonly started_at: number;
  readonly expires_at: number;
  readonly completion_fingerprint: string | null;
  readonly completed_at: number | null;
  readonly result_json: string | null;
  readonly claimed_at: number | null;
};

function nonEmptyId(value: string, context: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 128) throw new Error(`${context} must be 1..128 characters`);
  return trimmed;
}

function integer(value: number, context: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${context} must be an integer in ${min}..${max}`);
  return value;
}

function commandFingerprint(commands: readonly TrustedBattleCommand[]): string {
  return JSON.stringify(commands);
}

function parseStoredSnapshot(row: TrustedBattleRow): AccountSaveSnapshotV2 {
  let decoded: unknown;
  try { decoded = JSON.parse(row.start_snapshot_json); }
  catch { throw new Error(`trusted battle start snapshot JSON is invalid:${row.battle_id}`); }
  return normalizeAccountSaveSnapshot(decoded, row.started_at * 1000);
}

function parseStoredCompletion(row: TrustedBattleRow): TrustedBattleCompletionResult {
  if (!row.result_json || row.completed_at === null) throw new Error(`trusted battle completion is missing:${row.battle_id}`);
  let decoded: unknown;
  try { decoded = JSON.parse(row.result_json); }
  catch { throw new Error(`trusted battle result JSON is invalid:${row.battle_id}`); }
  if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
    throw new Error(`trusted battle result shape is invalid:${row.battle_id}`);
  }
  const raw = decoded as Record<string, unknown>;
  const discoveredEnemyIds = normalizeServerEnemyDiscoveries(
    Array.isArray(raw.discoveredEnemyIds) ? raw.discoveredEnemyIds.filter((id): id is string => typeof id === 'string') : [],
  );
  return { ...(raw as unknown as Omit<TrustedBattleCompletionResult, 'discoveredEnemyIds'>), discoveredEnemyIds };
}

async function loadRun(db: D1Database, accountId: string, battleId: string): Promise<TrustedBattleRow | null> {
  return db.prepare(
    `SELECT battle_id, battle_kind, target_id, start_revision, start_snapshot_json,
            initial_state_hash, started_at, expires_at, completion_fingerprint,
            completed_at, result_json, claimed_at
     FROM trusted_battle_runs
     WHERE battle_id = ?1 AND user_id = ?2`,
  ).bind(battleId, accountId).first<TrustedBattleRow>();
}

function assertStartAllowed(kind: TrustedBattleKind, targetId: string, snapshot: AccountSaveSnapshotV2, nowMs: number): void {
  if (kind === 'MAIN') {
    const index = ACCOUNT_MAIN_STAGE_INDEX.get(targetId);
    if (index === undefined) throw new Error(`unknown trusted MAIN stage:${targetId}`);
    if (index > snapshot.clearedStageIds.length) throw new Error(`trusted MAIN stage is locked:${targetId}`);
    return;
  }
  if (kind === 'SPECIAL') {
    if (!ACCOUNT_SPECIAL_STAGE_IDS.has(targetId)) throw new Error(`unknown trusted SPECIAL stage:${targetId}`);
    assertAccountSpecialStagePlayable(targetId, snapshot.clearedStageIds, snapshot.specialClearedStageIds, nowMs);
    return;
  }
  if (!isRecordModeId(targetId)) throw new Error(`unknown trusted RECORD mode:${targetId}`);
  if (!isRecordModeUnlocked(targetId, snapshot.clearedStageIds)) throw new Error(`trusted RECORD mode is locked:${targetId}`);
}

function initialStateHash(kind: TrustedBattleKind, targetId: string, snapshot: AccountSaveSnapshotV2): string {
  if (kind !== 'RECORD') return createAccountTrustedBattle(targetId, snapshot).stateHash;
  if (!isRecordModeId(targetId)) throw new Error(`unknown trusted RECORD mode:${targetId}`);
  return createAccountTrustedRecordBattle(targetId, snapshot).battle.stateHash;
}

export async function startTrustedBattle(
  db: D1Database,
  rawAccountId: string,
  kind: TrustedBattleKind,
  rawTargetId: string,
  nowMs = Date.now(),
): Promise<TrustedBattleStartResult> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const targetId = nonEmptyId(rawTargetId, 'targetId');
  if (!TRUSTED_BATTLE_KINDS.includes(kind)) throw new Error(`unknown trusted battle kind:${kind}`);
  const account = await initializeAccountSave(db, accountId, undefined, nowMs);
  assertStartAllowed(kind, targetId, account.snapshot, nowMs);

  const active = await db.prepare(
    'SELECT COUNT(*) AS count FROM trusted_battle_runs WHERE user_id = ?1 AND completed_at IS NULL AND expires_at > ?2',
  ).bind(accountId, Math.floor(nowMs / 1000)).first<{ count: number }>();
  if ((active?.count ?? 0) >= TRUSTED_BATTLE_MAX_ACTIVE_RUNS) throw new Error('too many active trusted battles');

  const stateHash = initialStateHash(kind, targetId, account.snapshot);
  const battleId = crypto.randomUUID();
  const startedAtSeconds = Math.floor(nowMs / 1000);
  const expiresAtSeconds = Math.floor((nowMs + TRUSTED_BATTLE_LIFETIME_MS) / 1000);
  const write = await db.prepare(
    `INSERT INTO trusted_battle_runs
     (battle_id, user_id, battle_kind, target_id, start_revision, start_snapshot_json,
      initial_state_hash, started_at, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  ).bind(
    battleId,
    accountId,
    kind,
    targetId,
    account.revision,
    JSON.stringify(account.snapshot),
    stateHash,
    startedAtSeconds,
    expiresAtSeconds,
  ).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('trusted battle start did not create one run');
  return {
    battleId,
    kind,
    targetId,
    startRevision: account.revision,
    initialStateHash: stateHash,
    expiresAtMs: expiresAtSeconds * 1000,
  };
}

function normalizeCommands(commands: readonly TrustedBattleCommand[]): readonly TrustedBattleCommand[] {
  if (!Array.isArray(commands) || commands.length > TRUSTED_BATTLE_MAX_COMMANDS) {
    throw new Error(`trusted battle commands must contain at most ${TRUSTED_BATTLE_MAX_COMMANDS} entries`);
  }
  let previousTick = -1;
  return commands.map((command, index) => {
    const tick = integer(command.tick, `commands[${index}].tick`, 0, TRUSTED_BATTLE_MAX_REPLAY_FRAMES - 1);
    if (tick < previousTick) throw new Error('trusted battle command ticks must be non-decreasing');
    previousTick = tick;
    if (command.type === 'SPAWN') return { tick, type: 'SPAWN', slotId: nonEmptyId(command.slotId, `commands[${index}].slotId`) };
    if (command.type === 'UPGRADE_SUPPLY') return { tick, type: 'UPGRADE_SUPPLY' };
    if (command.type === 'FIRE_BASE_WEAPON') return { tick, type: 'FIRE_BASE_WEAPON' };
    throw new Error(`unknown trusted battle command type:${String((command as { type?: unknown }).type)}`);
  });
}

function applyCommand(state: PlayableBattleState, command: TrustedBattleCommand): void {
  if (command.type === 'SPAWN') {
    const result = trySpawnPlayerUnit(state, command.slotId);
    if (!result.ok) throw new Error(`trusted battle logged SPAWN was rejected:${command.slotId}:${result.reason}`);
    return;
  }
  if (command.type === 'UPGRADE_SUPPLY') {
    const result = tryUpgradeSupply(state);
    if (!result.ok) throw new Error(`trusted battle logged UPGRADE_SUPPLY was rejected:${result.reason}`);
    return;
  }
  const result = tryFireBaseWeapon(state);
  if (!result.ok) throw new Error(`trusted battle logged FIRE_BASE_WEAPON was rejected:${result.reason}`);
}

function collectEnemyDiscoveries(state: PlayableBattleState, discovered: Set<string>): void {
  for (const unit of state.battle.units) {
    if (unit.team === 'ENEMY') discovered.add(unit.definition.id);
  }
}

function replayStandardBattle(row: TrustedBattleRow, commands: readonly TrustedBattleCommand[], completedAtMs: number): TrustedBattleCompletionResult {
  const snapshot = parseStoredSnapshot(row);
  const state = createAccountTrustedBattle(row.target_id, snapshot);
  if (state.stateHash !== row.initial_state_hash) throw new Error(`trusted battle initial state hash drift:${row.battle_id}`);
  const discoveredEnemyIds = new Set<string>();
  collectEnemyDiscoveries(state, discoveredEnemyIds);
  let commandIndex = 0;
  while (state.battle.winner === null && state.battle.tick < TRUSTED_BATTLE_MAX_REPLAY_FRAMES) {
    while (commandIndex < commands.length && commands[commandIndex]!.tick === state.battle.tick) {
      applyCommand(state, commands[commandIndex]!);
      commandIndex += 1;
    }
    stepPlayableBattle(state);
    collectEnemyDiscoveries(state, discoveredEnemyIds);
  }
  if (state.battle.winner === null) throw new Error('trusted battle exceeded replay frame limit');
  if (commandIndex !== commands.length) throw new Error('trusted battle command log contains actions after terminal result');
  return {
    battleId: row.battle_id,
    kind: row.battle_kind,
    targetId: row.target_id,
    winner: state.battle.winner,
    clearFrames: state.battle.tick,
    finalStateHash: state.stateHash,
    playerBaseHp: state.battle.bases.PLAYER.hp,
    enemyBaseHp: state.battle.bases.ENEMY.hp,
    discoveredEnemyIds: normalizeServerEnemyDiscoveries([...discoveredEnemyIds]),
    completedAtMs,
  };
}

function replayRecordBattle(row: TrustedBattleRow, commands: readonly TrustedBattleCommand[], completedAtMs: number): TrustedBattleCompletionResult {
  if (!isRecordModeId(row.target_id)) throw new Error(`trusted RECORD row has unknown mode:${row.target_id}`);
  const snapshot = parseStoredSnapshot(row);
  const runtime = createAccountTrustedRecordBattle(row.target_id, snapshot);
  const state = runtime.battle;
  if (state.stateHash !== row.initial_state_hash) throw new Error(`trusted record initial state hash drift:${row.battle_id}`);
  const discoveredEnemyIds = new Set<string>();
  collectEnemyDiscoveries(state, discoveredEnemyIds);
  let commandIndex = 0;
  while (!runtime.ended && state.battle.tick < TRUSTED_BATTLE_MAX_REPLAY_FRAMES) {
    while (commandIndex < commands.length && commands[commandIndex]!.tick === state.battle.tick) {
      applyCommand(state, commands[commandIndex]!);
      commandIndex += 1;
    }
    if (runtime.mode === 'ENDLESS_FRONT') stepEndlessRecordBattle(runtime);
    else stepBossRushRecordBattle(runtime);
    collectEnemyDiscoveries(state, discoveredEnemyIds);
  }
  if (!runtime.ended) throw new Error('trusted record exceeded replay frame limit');
  if (commandIndex !== commands.length) throw new Error('trusted record command log contains actions after terminal result');
  const completed = runtime.mode === 'BOSS_RUSH' && runtime.completed;
  const winner = completed ? 'PLAYER' : state.battle.winner ?? 'DRAW';
  return {
    battleId: row.battle_id,
    kind: 'RECORD',
    targetId: row.target_id,
    winner,
    clearFrames: state.battle.tick,
    finalStateHash: state.stateHash,
    playerBaseHp: state.battle.bases.PLAYER.hp,
    enemyBaseHp: state.battle.bases.ENEMY.hp,
    discoveredEnemyIds: normalizeServerEnemyDiscoveries([...discoveredEnemyIds]),
    completedAtMs,
    recordMode: runtime.mode,
    ...(runtime.mode === 'BOSS_RUSH' ? { defeatedBosses: runtime.defeatedBosses, recordCompleted: runtime.completed } : {}),
  };
}

function replayTrustedBattle(row: TrustedBattleRow, commands: readonly TrustedBattleCommand[], completedAtMs: number): TrustedBattleCompletionResult {
  return row.battle_kind === 'RECORD'
    ? replayRecordBattle(row, commands, completedAtMs)
    : replayStandardBattle(row, commands, completedAtMs);
}

export async function completeTrustedBattle(
  db: D1Database,
  rawAccountId: string,
  rawBattleId: string,
  rawCommands: readonly TrustedBattleCommand[],
  nowMs = Date.now(),
): Promise<{ readonly replayed: boolean; readonly result: TrustedBattleCompletionResult }> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const battleId = nonEmptyId(rawBattleId, 'battleId');
  const commands = normalizeCommands(rawCommands);
  const fingerprint = commandFingerprint(commands);
  let row = await loadRun(db, accountId, battleId);
  if (!row) throw new Error(`unknown trusted battle:${battleId}`);
  if (row.completed_at !== null) {
    if (row.completion_fingerprint !== fingerprint) throw new Error(`trusted battle completion replay differs:${battleId}`);
    return { replayed: true, result: parseStoredCompletion(row) };
  }
  if (row.expires_at * 1000 <= nowMs) throw new Error(`trusted battle expired:${battleId}`);

  const completedAtMs = Math.floor(nowMs / 1000) * 1000;
  const result = replayTrustedBattle(row, commands, completedAtMs);
  const write = await db.prepare(
    `UPDATE trusted_battle_runs
     SET completion_fingerprint = ?1, completed_at = ?2, result_json = ?3
     WHERE battle_id = ?4 AND user_id = ?5 AND completed_at IS NULL`,
  ).bind(fingerprint, Math.floor(completedAtMs / 1000), JSON.stringify(result), battleId, accountId).run();
  if ((write.meta.changes ?? 0) === 1) return { replayed: false, result };

  row = await loadRun(db, accountId, battleId);
  if (!row || row.completed_at === null) throw new Error(`trusted battle completion race lost without stored result:${battleId}`);
  if (row.completion_fingerprint !== fingerprint) throw new Error(`trusted battle completion race differs:${battleId}`);
  return { replayed: true, result: parseStoredCompletion(row) };
}

async function claimRecordBattle(
  db: D1Database,
  accountId: string,
  row: TrustedBattleRow,
  completion: TrustedBattleCompletionResult,
  expectedRevision: number,
): Promise<TrustedBattleClaimResult> {
  if (!isRecordModeId(row.target_id) || !completion.recordMode) throw new Error(`trusted RECORD completion is malformed:${row.battle_id}`);
  const mutation = completion.recordMode === 'ENDLESS_FRONT'
    ? await applyAccountRecordResult(db, accountId, {
        battleId: row.battle_id,
        expectedRevision,
        mode: 'ENDLESS_FRONT',
        survivalFrames: completion.clearFrames,
        discoveredEnemyIds: completion.discoveredEnemyIds,
      }, completion.completedAtMs)
    : await applyAccountRecordResult(db, accountId, {
        battleId: row.battle_id,
        expectedRevision,
        mode: 'BOSS_RUSH',
        defeatedBosses: completion.defeatedBosses ?? 0,
        discoveredEnemyIds: completion.discoveredEnemyIds,
      }, completion.completedAtMs);
  if (!mutation.ok) return mutation;
  await db.prepare(
    'UPDATE trusted_battle_runs SET claimed_at = COALESCE(claimed_at, unixepoch()) WHERE battle_id = ?1 AND user_id = ?2',
  ).bind(row.battle_id, accountId).run();
  return {
    ok: true,
    replayed: mutation.replayed,
    awarded: true,
    record: mutation.record,
    completion,
    result: mutation.result,
  };
}

export async function claimTrustedBattle(
  db: D1Database,
  rawAccountId: string,
  rawBattleId: string,
  expectedRevision: number,
  nowMs = Date.now(),
): Promise<TrustedBattleClaimResult> {
  const accountId = nonEmptyId(rawAccountId, 'accountId');
  const battleId = nonEmptyId(rawBattleId, 'battleId');
  const expected = integer(expectedRevision, 'expectedRevision', 0, Number.MAX_SAFE_INTEGER);
  const row = await loadRun(db, accountId, battleId);
  if (!row) throw new Error(`unknown trusted battle:${battleId}`);
  if (row.completed_at === null) throw new Error(`trusted battle is not completed:${battleId}`);
  const completion = parseStoredCompletion(row);

  if (row.battle_kind === 'RECORD') {
    return claimRecordBattle(db, accountId, row, completion, expected);
  }

  if (completion.winner !== 'PLAYER') {
    const discovery = await applyAccountEnemyDiscoveries(db, accountId, expected, completion.discoveredEnemyIds, nowMs);
    if (!discovery.ok) return discovery;
    await db.prepare(
      'UPDATE trusted_battle_runs SET claimed_at = COALESCE(claimed_at, unixepoch()) WHERE battle_id = ?1 AND user_id = ?2',
    ).bind(battleId, accountId).run();
    return { ok: true, replayed: row.claimed_at !== null, awarded: false, record: discovery.record, completion, result: null };
  }

  const mutationTime = completion.completedAtMs;
  const mutation = row.battle_kind === 'MAIN'
    ? await applyAccountMainBattleResult(db, accountId, {
        battleId,
        expectedRevision: expected,
        stageId: row.target_id,
        source: 'SOLO_BATTLE',
        discoveredEnemyIds: completion.discoveredEnemyIds,
      }, mutationTime)
    : await applyAccountSpecialBattleResult(db, accountId, {
        battleId,
        expectedRevision: expected,
        stageId: row.target_id,
        discoveredEnemyIds: completion.discoveredEnemyIds,
      }, mutationTime, row.started_at * 1000);
  if (!mutation.ok) return mutation;

  await db.prepare(
    'UPDATE trusted_battle_runs SET claimed_at = COALESCE(claimed_at, unixepoch()) WHERE battle_id = ?1 AND user_id = ?2',
  ).bind(battleId, accountId).run();
  return {
    ok: true,
    replayed: mutation.replayed,
    awarded: true,
    record: mutation.record,
    completion,
    result: mutation.result,
  };
}

export const __trustedBattleTestOnly = {
  normalizeCommands,
  replayTrustedBattle,
  replayRecordBattle,
  collectEnemyDiscoveries,
  parseStoredCompletion,
};
