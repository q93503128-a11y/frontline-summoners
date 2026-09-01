import {
  captureCombatQuirkFrame,
  resolveCombatQuirkFacts,
  type CombatQuirkFactId,
} from '@frontline/sim/combat-quirk-attribution';
import {
  stepPlayableBattle,
  tryFireBaseWeapon,
  trySpawnPlayerUnit,
  tryUpgradeSupply,
  type PlayableBattleState,
} from '@frontline/sim/playable';
import { isRecordModeId } from '@frontline/sim/record-content';
import { stepBossRushRecordBattle, stepEndlessRecordBattle } from '@frontline/sim/record-playable';
import { normalizeAccountSaveSnapshot } from './account-save-authority.ts';
import { createAccountTrustedBattle, createAccountTrustedRecordBattle } from './account-trusted-battle-runtime.ts';
import {
  TRUSTED_BATTLE_MAX_REPLAY_FRAMES,
  type TrustedBattleCommand,
  type TrustedBattleCompletionResult,
  type TrustedBattleKind,
} from './trusted-battle-authority.ts';

type QuirkReplayRow = {
  readonly battle_kind: TrustedBattleKind;
  readonly target_id: string;
  readonly start_snapshot_json: string;
  readonly initial_state_hash: string;
  readonly started_at: number;
};

function parseSnapshot(row: QuirkReplayRow) {
  let decoded: unknown;
  try { decoded = JSON.parse(row.start_snapshot_json); }
  catch { throw new Error('trusted quirk replay start snapshot JSON is invalid'); }
  return normalizeAccountSaveSnapshot(decoded, row.started_at * 1000);
}

async function loadReplayRow(db: D1Database, accountId: string, battleId: string): Promise<QuirkReplayRow> {
  const row = await db.prepare(
    `SELECT battle_kind, target_id, start_snapshot_json, initial_state_hash, started_at
     FROM trusted_battle_runs
     WHERE battle_id = ?1 AND user_id = ?2`,
  ).bind(battleId, accountId).first<QuirkReplayRow>();
  if (!row) throw new Error(`trusted quirk replay run not found:${battleId}`);
  return row;
}

function applyCommand(state: PlayableBattleState, command: TrustedBattleCommand): void {
  if (command.type === 'SPAWN') {
    const result = trySpawnPlayerUnit(state, command.slotId);
    if (!result.ok) throw new Error(`trusted quirk replay SPAWN rejected:${command.slotId}:${result.reason}`);
    return;
  }
  if (command.type === 'UPGRADE_SUPPLY') {
    const result = tryUpgradeSupply(state);
    if (!result.ok) throw new Error(`trusted quirk replay UPGRADE_SUPPLY rejected:${result.reason}`);
    return;
  }
  const result = tryFireBaseWeapon(state);
  if (!result.ok) throw new Error(`trusted quirk replay FIRE_BASE_WEAPON rejected:${result.reason}`);
}

function collectFactsAroundStep(state: PlayableBattleState, facts: Set<CombatQuirkFactId>, step: () => void): void {
  const capture = captureCombatQuirkFrame(state.battle);
  step();
  for (const factId of resolveCombatQuirkFacts(capture, state.battle)) facts.add(factId);
}

function assertCompletionMatches(
  completion: TrustedBattleCompletionResult,
  state: PlayableBattleState,
  winner: 'PLAYER' | 'ENEMY' | 'DRAW',
): void {
  if (state.battle.tick !== completion.clearFrames) throw new Error('trusted quirk replay clearFrames drift');
  if (state.stateHash !== completion.finalStateHash) throw new Error('trusted quirk replay final state hash drift');
  if (winner !== completion.winner) throw new Error('trusted quirk replay winner drift');
}

function replayStandard(
  row: QuirkReplayRow,
  commands: readonly TrustedBattleCommand[],
  completion: TrustedBattleCompletionResult,
): readonly CombatQuirkFactId[] {
  const state = createAccountTrustedBattle(row.target_id, parseSnapshot(row));
  if (state.stateHash !== row.initial_state_hash) throw new Error('trusted quirk replay initial state hash drift');
  const facts = new Set<CombatQuirkFactId>();
  let commandIndex = 0;
  while (state.battle.winner === null && state.battle.tick < TRUSTED_BATTLE_MAX_REPLAY_FRAMES) {
    while (commandIndex < commands.length && commands[commandIndex]!.tick === state.battle.tick) {
      applyCommand(state, commands[commandIndex]!);
      commandIndex += 1;
    }
    collectFactsAroundStep(state, facts, () => { stepPlayableBattle(state); });
  }
  if (state.battle.winner === null) throw new Error('trusted quirk replay exceeded frame limit');
  if (commandIndex !== commands.length) throw new Error('trusted quirk replay has commands after terminal state');
  assertCompletionMatches(completion, state, state.battle.winner);
  return [...facts];
}

function replayRecord(
  row: QuirkReplayRow,
  commands: readonly TrustedBattleCommand[],
  completion: TrustedBattleCompletionResult,
): readonly CombatQuirkFactId[] {
  if (!isRecordModeId(row.target_id)) throw new Error(`trusted quirk replay unknown Record mode:${row.target_id}`);
  const runtime = createAccountTrustedRecordBattle(row.target_id, parseSnapshot(row));
  const state = runtime.battle;
  if (state.stateHash !== row.initial_state_hash) throw new Error('trusted quirk replay Record initial state hash drift');
  const facts = new Set<CombatQuirkFactId>();
  let commandIndex = 0;
  while (!runtime.ended && state.battle.tick < TRUSTED_BATTLE_MAX_REPLAY_FRAMES) {
    while (commandIndex < commands.length && commands[commandIndex]!.tick === state.battle.tick) {
      applyCommand(state, commands[commandIndex]!);
      commandIndex += 1;
    }
    collectFactsAroundStep(state, facts, () => {
      if (runtime.mode === 'ENDLESS_FRONT') stepEndlessRecordBattle(runtime);
      else stepBossRushRecordBattle(runtime);
    });
  }
  if (!runtime.ended) throw new Error('trusted quirk replay Record exceeded frame limit');
  if (commandIndex !== commands.length) throw new Error('trusted quirk replay Record has commands after terminal state');
  const winner = runtime.mode === 'BOSS_RUSH' && runtime.completed ? 'PLAYER' : state.battle.winner ?? 'DRAW';
  assertCompletionMatches(completion, state, winner);
  if (completion.recordMode !== runtime.mode) throw new Error('trusted quirk replay Record mode drift');
  if (runtime.mode === 'BOSS_RUSH' && completion.defeatedBosses !== runtime.defeatedBosses) {
    throw new Error('trusted quirk replay defeatedBosses drift');
  }
  return [...facts];
}

export async function replayTrustedCombatQuirkFacts(
  db: D1Database,
  accountId: string,
  battleId: string,
  commands: readonly TrustedBattleCommand[],
  completion: TrustedBattleCompletionResult,
): Promise<readonly CombatQuirkFactId[]> {
  const row = await loadReplayRow(db, accountId, battleId);
  if (row.battle_kind !== completion.kind || row.target_id !== completion.targetId) {
    throw new Error('trusted quirk replay target drift');
  }
  return row.battle_kind === 'RECORD'
    ? replayRecord(row, commands, completion)
    : replayStandard(row, commands, completion);
}
