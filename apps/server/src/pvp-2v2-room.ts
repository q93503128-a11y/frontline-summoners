import type { Pvp2v2Command } from '@frontline/sim/pvp-2v2-playable-frame';
import { PVP_2V2_SEAT_IDS, getPvp2v2SeatTeamId, type Pvp2v2SeatId, type Pvp2v2TeamId } from '@frontline/sim/pvp-2v2-playable';

export const PVP_2V2_MAX_INPUT_LEAD = 6;
export const PVP_2V2_MAX_COMMANDS_PER_FRAME = 8;

export interface Pvp2v2FrameInput {
  readonly tick: number;
  readonly sequence: number;
  readonly commands: readonly Pvp2v2Command[];
}

export interface Pvp2v2RoomSeatState {
  readonly seatId: Pvp2v2SeatId;
  readonly teamId: Pvp2v2TeamId;
  clientId: string | null;
  connected: boolean;
  ready: boolean;
  lastSequence: number;
  disconnectedAtMs: number | null;
}

export interface Pvp2v2RoomState {
  readonly matchId: string;
  readonly modeId: 'pvp_casual_2v2' | 'pvp_friendly_2v2';
  phase: 'LOBBY' | 'BATTLE' | 'FINISHED';
  committedTick: number;
  readonly seats: Record<Pvp2v2SeatId, Pvp2v2RoomSeatState>;
  readonly pendingInputs: Record<Pvp2v2SeatId, Record<string, Pvp2v2FrameInput>>;
}

export interface Pvp2v2CommittedFrame {
  readonly tick: number;
  readonly inputs: Readonly<Record<Pvp2v2SeatId, Pvp2v2FrameInput>>;
}

export type Pvp2v2RoomClientMessage =
  | { readonly type: 'PING' }
  | { readonly type: 'READY' }
  | { readonly type: 'FRAME_INPUT'; readonly input: Pvp2v2FrameInput };

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function nonEmptyString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function nonNegativeInteger(value: unknown, context: string): number { if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${context} must be non-negative`); return value as number; }

function parseCommand(value: unknown, context: string): Pvp2v2Command {
  if (!isRecord(value) || !nonEmptyString(value.type)) throw new Error(`${context} must be a command object`);
  if (value.type === 'SPAWN') {
    if (!nonEmptyString(value.slotId)) throw new Error(`${context}.slotId must be non-empty`);
    return { type: 'SPAWN', slotId: value.slotId };
  }
  if (value.type === 'UPGRADE_SUPPLY') return { type: 'UPGRADE_SUPPLY' };
  if (value.type === 'FIRE_BASE_WEAPON') return { type: 'FIRE_BASE_WEAPON' };
  throw new Error(`${context}.type is unsupported`);
}

function parseFrameInput(value: unknown): Pvp2v2FrameInput {
  if (!isRecord(value)) throw new Error('FRAME_INPUT.input must be an object');
  const tick = nonNegativeInteger(value.tick, 'FRAME_INPUT.input.tick');
  const sequence = nonNegativeInteger(value.sequence, 'FRAME_INPUT.input.sequence');
  if (!Array.isArray(value.commands)) throw new Error('FRAME_INPUT.input.commands must be an array');
  if (value.commands.length > PVP_2V2_MAX_COMMANDS_PER_FRAME) throw new Error(`FRAME_INPUT.input.commands exceeds ${PVP_2V2_MAX_COMMANDS_PER_FRAME}`);
  return { tick, sequence, commands: value.commands.map((command, index) => parseCommand(command, `FRAME_INPUT.input.commands[${index}]`)) };
}

export function parsePvp2v2RoomClientMessage(value: unknown): Pvp2v2RoomClientMessage {
  if (!isRecord(value) || !nonEmptyString(value.type)) throw new Error('message must have a type');
  if (value.type === 'PING') return { type: 'PING' };
  if (value.type === 'READY') return { type: 'READY' };
  if (value.type === 'FRAME_INPUT') return { type: 'FRAME_INPUT', input: parseFrameInput(value.input) };
  throw new Error('unsupported_message');
}

function seatState(seatId: Pvp2v2SeatId): Pvp2v2RoomSeatState {
  return { seatId, teamId: getPvp2v2SeatTeamId(seatId), clientId: null, connected: false, ready: false, lastSequence: -1, disconnectedAtMs: null };
}

export function createPvp2v2Room(matchId: string, modeId: Pvp2v2RoomState['modeId']): Pvp2v2RoomState {
  if (!nonEmptyString(matchId)) throw new Error('matchId must be non-empty');
  return {
    matchId,
    modeId,
    phase: 'LOBBY',
    committedTick: -1,
    seats: { A1: seatState('A1'), A2: seatState('A2'), B1: seatState('B1'), B2: seatState('B2') },
    pendingInputs: { A1: {}, A2: {}, B1: {}, B2: {} },
  };
}

export function getPvp2v2RoomSnapshot(state: Pvp2v2RoomState) {
  return {
    matchId: state.matchId,
    modeId: state.modeId,
    phase: state.phase,
    committedTick: state.committedTick,
    seats: PVP_2V2_SEAT_IDS.map((seatId) => ({
      seatId,
      teamId: state.seats[seatId].teamId,
      connected: state.seats[seatId].connected,
      ready: state.seats[seatId].ready,
      reconnecting: state.seats[seatId].disconnectedAtMs !== null,
      nextSequence: state.seats[seatId].lastSequence + 1,
    })),
  } as const;
}

export function connectPvp2v2Seat(state: Pvp2v2RoomState, seatId: Pvp2v2SeatId, clientId: string): void {
  if (!nonEmptyString(clientId)) throw new Error('clientId must be non-empty');
  const seat = state.seats[seatId];
  seat.clientId = clientId;
  seat.connected = true;
  seat.disconnectedAtMs = null;
}

export function disconnectPvp2v2Seat(state: Pvp2v2RoomState, seatId: Pvp2v2SeatId, clientId: string, nowMs = Date.now()): void {
  const seat = state.seats[seatId];
  if (seat.clientId !== clientId) return;
  seat.clientId = null;
  seat.connected = false;
  if (state.phase === 'LOBBY') seat.ready = false;
  else if (state.phase === 'BATTLE') seat.disconnectedAtMs = nowMs;
}

function requireSeat(state: Pvp2v2RoomState, seatId: Pvp2v2SeatId, clientId: string): Pvp2v2RoomSeatState {
  const seat = state.seats[seatId];
  if (!seat.connected || seat.clientId !== clientId) throw new Error(`client does not control PvP 2v2 seat ${seatId}`);
  return seat;
}

export function setPvp2v2SeatReady(state: Pvp2v2RoomState, seatId: Pvp2v2SeatId, clientId: string): { readonly battleStarted: boolean } {
  if (state.phase !== 'LOBBY') throw new Error('pvp 2v2 room is not in lobby');
  requireSeat(state, seatId, clientId).ready = true;
  const battleStarted = PVP_2V2_SEAT_IDS.every((candidate) => state.seats[candidate].connected && state.seats[candidate].ready);
  if (battleStarted) state.phase = 'BATTLE';
  return { battleStarted };
}

function drainFrames(state: Pvp2v2RoomState): Pvp2v2CommittedFrame[] {
  const frames: Pvp2v2CommittedFrame[] = [];
  while (state.phase === 'BATTLE') {
    const tick = state.committedTick + 1;
    const inputs = Object.fromEntries(PVP_2V2_SEAT_IDS.map((seatId) => [seatId, state.pendingInputs[seatId][String(tick)]])) as Partial<Record<Pvp2v2SeatId, Pvp2v2FrameInput>>;
    if (PVP_2V2_SEAT_IDS.some((seatId) => inputs[seatId] === undefined)) break;
    for (const seatId of PVP_2V2_SEAT_IDS) delete state.pendingInputs[seatId][String(tick)];
    state.committedTick = tick;
    frames.push({ tick, inputs: inputs as Record<Pvp2v2SeatId, Pvp2v2FrameInput> });
  }
  return frames;
}

export function submitPvp2v2FrameInput(
  state: Pvp2v2RoomState,
  seatId: Pvp2v2SeatId,
  clientId: string,
  input: Pvp2v2FrameInput,
  allowedSlotIds: ReadonlySet<string>,
): readonly Pvp2v2CommittedFrame[] {
  if (state.phase !== 'BATTLE') throw new Error('pvp 2v2 room is not in battle');
  const seat = requireSeat(state, seatId, clientId);
  if (input.sequence <= seat.lastSequence) throw new Error('pvp 2v2 input sequence must increase');
  if (input.tick <= state.committedTick) throw new Error('pvp 2v2 input tick already committed');
  if (input.tick > state.committedTick + 1 + PVP_2V2_MAX_INPUT_LEAD) throw new Error('pvp 2v2 input too far ahead');
  for (const command of input.commands) if (command.type === 'SPAWN' && !allowedSlotIds.has(command.slotId)) throw new Error(`pvp 2v2 frame cannot spawn unselected slot:${command.slotId}`);
  const key = String(input.tick);
  if (state.pendingInputs[seatId][key]) throw new Error('pvp 2v2 input already submitted for tick');
  state.pendingInputs[seatId][key] = input;
  seat.lastSequence = input.sequence;
  return drainFrames(state);
}

export function getExpiredPvp2v2Teams(state: Pvp2v2RoomState, nowMs: number, graceMs: number): readonly Pvp2v2TeamId[] {
  if (state.phase !== 'BATTLE') return [];
  const expired = new Set<Pvp2v2TeamId>();
  for (const seatId of PVP_2V2_SEAT_IDS) {
    const at = state.seats[seatId].disconnectedAtMs;
    if (at !== null && nowMs - at >= graceMs) expired.add(state.seats[seatId].teamId);
  }
  return [...expired];
}

export function finishPvp2v2Room(state: Pvp2v2RoomState): void {
  state.phase = 'FINISHED';
  for (const seatId of PVP_2V2_SEAT_IDS) state.pendingInputs[seatId] = {};
}
