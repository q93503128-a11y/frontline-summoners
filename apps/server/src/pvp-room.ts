import type { Pvp1v1Command } from '@frontline/sim/pvp-playable-frame';

export const PVP_1V1_SEATS = ['A', 'B'] as const;
export type PvpRoomSeatId = (typeof PVP_1V1_SEATS)[number];
export type PvpRoomPhase = 'LOBBY' | 'BATTLE' | 'FINISHED';

export const PVP_MAX_INPUT_LEAD = 6;
export const PVP_MAX_COMMANDS_PER_FRAME = 8;

export interface PvpRoomFrameInput {
  readonly tick: number;
  readonly sequence: number;
  readonly commands: readonly Pvp1v1Command[];
}

export interface PvpRoomSeatState {
  readonly seatId: PvpRoomSeatId;
  clientId: string | null;
  connected: boolean;
  ready: boolean;
  lastSequence: number;
  disconnectedAtMs: number | null;
}

export interface PvpRoomCommittedFrame {
  readonly tick: number;
  readonly inputs: Readonly<Record<PvpRoomSeatId, PvpRoomFrameInput>>;
}

export interface PvpRoomState {
  readonly matchId: string;
  readonly modeId: 'pvp_casual_1v1' | 'pvp_ranked_1v1' | 'pvp_friendly_1v1';
  phase: PvpRoomPhase;
  committedTick: number;
  readonly seats: Record<PvpRoomSeatId, PvpRoomSeatState>;
  readonly pendingInputs: Record<PvpRoomSeatId, Record<string, PvpRoomFrameInput>>;
}

export interface PvpRoomSnapshot {
  readonly matchId: string;
  readonly modeId: PvpRoomState['modeId'];
  readonly phase: PvpRoomPhase;
  readonly committedTick: number;
  readonly seats: readonly {
    readonly seatId: PvpRoomSeatId;
    readonly connected: boolean;
    readonly ready: boolean;
    readonly reconnecting: boolean;
  }[];
}

export type PvpRoomClientMessage =
  | { readonly type: 'PING' }
  | { readonly type: 'READY' }
  | { readonly type: 'FRAME_INPUT'; readonly input: PvpRoomFrameInput };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${context} must be non-negative`);
  return value as number;
}

function parseCommand(value: unknown, context: string): Pvp1v1Command {
  if (!isRecord(value) || !nonEmptyString(value.type)) throw new Error(`${context} must be a command object`);
  if (value.type === 'SPAWN') {
    if (!nonEmptyString(value.slotId)) throw new Error(`${context}.slotId must be non-empty`);
    return { type: 'SPAWN', slotId: value.slotId };
  }
  if (value.type === 'UPGRADE_SUPPLY') return { type: 'UPGRADE_SUPPLY' };
  if (value.type === 'FIRE_BASE_WEAPON') return { type: 'FIRE_BASE_WEAPON' };
  throw new Error(`${context}.type is unsupported`);
}

function parseFrameInput(value: unknown): PvpRoomFrameInput {
  if (!isRecord(value)) throw new Error('FRAME_INPUT.input must be an object');
  const tick = nonNegativeInteger(value.tick, 'FRAME_INPUT.input.tick');
  const sequence = nonNegativeInteger(value.sequence, 'FRAME_INPUT.input.sequence');
  if (!Array.isArray(value.commands)) throw new Error('FRAME_INPUT.input.commands must be an array');
  if (value.commands.length > PVP_MAX_COMMANDS_PER_FRAME) throw new Error(`FRAME_INPUT.input.commands exceeds ${PVP_MAX_COMMANDS_PER_FRAME}`);
  return {
    tick,
    sequence,
    commands: value.commands.map((command, index) => parseCommand(command, `FRAME_INPUT.input.commands[${index}]`)),
  };
}

export function parsePvpRoomClientMessage(value: unknown): PvpRoomClientMessage {
  if (!isRecord(value) || !nonEmptyString(value.type)) throw new Error('message must have a type');
  if (value.type === 'PING') return { type: 'PING' };
  if (value.type === 'READY') return { type: 'READY' };
  if (value.type === 'FRAME_INPUT') return { type: 'FRAME_INPUT', input: parseFrameInput(value.input) };
  throw new Error('unsupported_message');
}

function seatState(seatId: PvpRoomSeatId): PvpRoomSeatState {
  return {
    seatId,
    clientId: null,
    connected: false,
    ready: false,
    lastSequence: -1,
    disconnectedAtMs: null,
  };
}

export function createPvpRoom(
  matchId: string,
  modeId: PvpRoomState['modeId'],
): PvpRoomState {
  if (!nonEmptyString(matchId)) throw new Error('matchId must be non-empty');
  return {
    matchId,
    modeId,
    phase: 'LOBBY',
    committedTick: -1,
    seats: { A: seatState('A'), B: seatState('B') },
    pendingInputs: { A: {}, B: {} },
  };
}

export function getPvpRoomSnapshot(state: PvpRoomState): PvpRoomSnapshot {
  return {
    matchId: state.matchId,
    modeId: state.modeId,
    phase: state.phase,
    committedTick: state.committedTick,
    seats: PVP_1V1_SEATS.map((seatId) => ({
      seatId,
      connected: state.seats[seatId].connected,
      ready: state.seats[seatId].ready,
      reconnecting: state.seats[seatId].disconnectedAtMs !== null,
    })),
  };
}

export function connectPvpSeat(state: PvpRoomState, seatId: PvpRoomSeatId, clientId: string): void {
  if (!nonEmptyString(clientId)) throw new Error('clientId must be non-empty');
  const seat = state.seats[seatId];
  seat.clientId = clientId;
  seat.connected = true;
  seat.disconnectedAtMs = null;
}

export function disconnectPvpSeat(
  state: PvpRoomState,
  seatId: PvpRoomSeatId,
  clientId: string,
  nowMs = Date.now(),
): void {
  const seat = state.seats[seatId];
  if (seat.clientId !== clientId) return;
  seat.connected = false;
  seat.clientId = null;
  if (state.phase === 'LOBBY') seat.ready = false;
  else if (state.phase === 'BATTLE') seat.disconnectedAtMs = nowMs;
}

function requireSeat(state: PvpRoomState, seatId: PvpRoomSeatId, clientId: string): PvpRoomSeatState {
  const seat = state.seats[seatId];
  if (!seat.connected || seat.clientId !== clientId) throw new Error(`client does not control PvP seat ${seatId}`);
  return seat;
}

export function setPvpSeatReady(
  state: PvpRoomState,
  seatId: PvpRoomSeatId,
  clientId: string,
): { readonly battleStarted: boolean } {
  if (state.phase !== 'LOBBY') throw new Error('pvp room is not in lobby');
  const seat = requireSeat(state, seatId, clientId);
  seat.ready = true;
  const battleStarted = PVP_1V1_SEATS.every((candidate) => state.seats[candidate].connected && state.seats[candidate].ready);
  if (battleStarted) state.phase = 'BATTLE';
  return { battleStarted };
}

function validateSpawnCommands(allowedSlotIds: ReadonlySet<string>, input: PvpRoomFrameInput): void {
  for (const command of input.commands) {
    if (command.type === 'SPAWN' && !allowedSlotIds.has(command.slotId)) {
      throw new Error(`pvp frame cannot spawn unselected slot:${command.slotId}`);
    }
  }
}

function drainCommittedFrames(state: PvpRoomState): PvpRoomCommittedFrame[] {
  const frames: PvpRoomCommittedFrame[] = [];
  while (state.phase === 'BATTLE') {
    const tick = state.committedTick + 1;
    const a = state.pendingInputs.A[String(tick)];
    const b = state.pendingInputs.B[String(tick)];
    if (!a || !b) break;
    delete state.pendingInputs.A[String(tick)];
    delete state.pendingInputs.B[String(tick)];
    state.committedTick = tick;
    frames.push({ tick, inputs: { A: a, B: b } });
  }
  return frames;
}

export function submitPvpFrameInput(
  state: PvpRoomState,
  seatId: PvpRoomSeatId,
  clientId: string,
  input: PvpRoomFrameInput,
  allowedSlotIds: ReadonlySet<string>,
): readonly PvpRoomCommittedFrame[] {
  if (state.phase !== 'BATTLE') throw new Error('pvp room is not in battle');
  const seat = requireSeat(state, seatId, clientId);
  if (input.sequence <= seat.lastSequence) throw new Error('pvp input sequence must increase');
  if (input.tick <= state.committedTick) throw new Error('pvp input tick already committed');
  if (input.tick > state.committedTick + 1 + PVP_MAX_INPUT_LEAD) throw new Error('pvp input too far ahead');
  validateSpawnCommands(allowedSlotIds, input);
  const key = String(input.tick);
  if (state.pendingInputs[seatId][key]) throw new Error('pvp input already submitted for tick');
  state.pendingInputs[seatId][key] = input;
  seat.lastSequence = input.sequence;
  return drainCommittedFrames(state);
}

export function resolvePvpReconnectForfeit(
  state: PvpRoomState,
  nowMs: number,
  graceMs: number,
): PvpRoomSeatId | 'BOTH' | null {
  if (state.phase !== 'BATTLE') return null;
  const expired = PVP_1V1_SEATS.filter((seatId) => {
    const disconnectedAt = state.seats[seatId].disconnectedAtMs;
    return disconnectedAt !== null && nowMs - disconnectedAt >= graceMs;
  });
  if (expired.length === 2) return 'BOTH';
  return expired[0] ?? null;
}

export function finishPvpRoom(state: PvpRoomState): void {
  state.phase = 'FINISHED';
  state.pendingInputs.A = {};
  state.pendingInputs.B = {};
}
