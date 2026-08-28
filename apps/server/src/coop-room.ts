export const COOP_SEATS = ['A', 'B'] as const;
export type CoopSeatId = (typeof COOP_SEATS)[number];
export type CoopControl = 'PLAYER' | 'AI';
export type CoopRoomPhase = 'LOBBY' | 'BATTLE' | 'FINISHED';

export const COOP_DECK_SLOTS_PER_PLAYER = 5;
export const COOP_MAX_INPUT_LEAD = 6;
export const COOP_MAX_COMMANDS_PER_FRAME = 8;

export type CoopBattleCommand =
  | { readonly type: 'SPAWN'; readonly slotId: string }
  | { readonly type: 'UPGRADE_SUPPLY' }
  | { readonly type: 'FIRE_BASE_WEAPON' };

export interface CoopFrameInput {
  readonly tick: number;
  readonly sequence: number;
  readonly commands: readonly CoopBattleCommand[];
}

export interface CoopSeatState {
  readonly seatId: CoopSeatId;
  clientId: string | null;
  connected: boolean;
  ready: boolean;
  control: CoopControl;
  deckSlotIds: string[];
  lastSequence: number;
}

export interface CoopCommittedFrame {
  readonly tick: number;
  readonly inputs: Readonly<Record<CoopSeatId, CoopFrameInput>>;
}

export interface CoopRoomState {
  readonly matchId: string;
  readonly stageId: string;
  phase: CoopRoomPhase;
  committedTick: number;
  readonly seats: Record<CoopSeatId, CoopSeatState>;
  readonly pendingInputs: Record<CoopSeatId, Record<string, CoopFrameInput>>;
}

export interface CoopRoomSnapshot {
  readonly matchId: string;
  readonly stageId: string;
  readonly phase: CoopRoomPhase;
  readonly committedTick: number;
  readonly seats: readonly {
    readonly seatId: CoopSeatId;
    readonly clientId: string | null;
    readonly connected: boolean;
    readonly ready: boolean;
    readonly control: CoopControl;
    readonly deckSize: number;
  }[];
}

export type CoopClientMessage =
  | { readonly type: 'PING' }
  | { readonly type: 'READY'; readonly deckSlotIds: readonly string[] }
  | { readonly type: 'UNREADY' }
  | { readonly type: 'FRAME_INPUT'; readonly input: CoopFrameInput };

export interface SubmitFrameResult {
  readonly accepted: true;
  readonly committedFrames: readonly CoopCommittedFrame[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertNonNegativeInteger(value: number, context: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${context} must be a non-negative integer`);
}

function requireSeat(state: CoopRoomState, seatId: CoopSeatId, clientId: string): CoopSeatState {
  const seat = state.seats[seatId];
  if (!seat.connected || seat.clientId !== clientId || seat.control !== 'PLAYER') {
    throw new Error(`client does not control seat ${seatId}`);
  }
  return seat;
}

function parseCommand(value: unknown, context: string): CoopBattleCommand {
  if (!isRecord(value) || !isNonEmptyString(value.type)) throw new Error(`${context} must be a command object`);
  if (value.type === 'SPAWN') {
    if (!isNonEmptyString(value.slotId)) throw new Error(`${context}.slotId must be a non-empty string`);
    return { type: 'SPAWN', slotId: value.slotId };
  }
  if (value.type === 'UPGRADE_SUPPLY') return { type: 'UPGRADE_SUPPLY' };
  if (value.type === 'FIRE_BASE_WEAPON') return { type: 'FIRE_BASE_WEAPON' };
  throw new Error(`${context}.type is unsupported`);
}

function parseFrameInput(value: unknown): CoopFrameInput {
  if (!isRecord(value)) throw new Error('FRAME_INPUT.input must be an object');
  const tick = value.tick;
  const sequence = value.sequence;
  if (typeof tick !== 'number') throw new Error('FRAME_INPUT.input.tick must be a number');
  if (typeof sequence !== 'number') throw new Error('FRAME_INPUT.input.sequence must be a number');
  assertNonNegativeInteger(tick, 'FRAME_INPUT.input.tick');
  assertNonNegativeInteger(sequence, 'FRAME_INPUT.input.sequence');
  if (!Array.isArray(value.commands)) throw new Error('FRAME_INPUT.input.commands must be an array');
  if (value.commands.length > COOP_MAX_COMMANDS_PER_FRAME) {
    throw new Error(`FRAME_INPUT.input.commands exceeds ${COOP_MAX_COMMANDS_PER_FRAME}`);
  }
  return {
    tick,
    sequence,
    commands: value.commands.map((command, index) => parseCommand(command, `FRAME_INPUT.input.commands[${index}]`)),
  };
}

export function parseCoopClientMessage(value: unknown): CoopClientMessage {
  if (!isRecord(value) || !isNonEmptyString(value.type)) throw new Error('message must be an object with type');
  if (value.type === 'PING') return { type: 'PING' };
  if (value.type === 'UNREADY') return { type: 'UNREADY' };
  if (value.type === 'READY') {
    if (!Array.isArray(value.deckSlotIds) || !value.deckSlotIds.every(isNonEmptyString)) {
      throw new Error('READY.deckSlotIds must be a string array');
    }
    return { type: 'READY', deckSlotIds: value.deckSlotIds };
  }
  if (value.type === 'FRAME_INPUT') return { type: 'FRAME_INPUT', input: parseFrameInput(value.input) };
  throw new Error('unsupported_message');
}

export function createCoopRoom(matchId: string, stageId: string): CoopRoomState {
  if (!isNonEmptyString(matchId)) throw new Error('matchId must be non-empty');
  if (!isNonEmptyString(stageId)) throw new Error('stageId must be non-empty');
  const seat = (seatId: CoopSeatId): CoopSeatState => ({
    seatId,
    clientId: null,
    connected: false,
    ready: false,
    control: 'PLAYER',
    deckSlotIds: [],
    lastSequence: -1,
  });
  return {
    matchId,
    stageId,
    phase: 'LOBBY',
    committedTick: -1,
    seats: { A: seat('A'), B: seat('B') },
    pendingInputs: { A: {}, B: {} },
  };
}

export function getCoopRoomSnapshot(state: CoopRoomState): CoopRoomSnapshot {
  return {
    matchId: state.matchId,
    stageId: state.stageId,
    phase: state.phase,
    committedTick: state.committedTick,
    seats: COOP_SEATS.map((seatId) => {
      const seat = state.seats[seatId];
      return {
        seatId,
        clientId: seat.clientId,
        connected: seat.connected,
        ready: seat.ready,
        control: seat.control,
        deckSize: seat.deckSlotIds.length,
      };
    }),
  };
}

export function connectCoopSeat(state: CoopRoomState, seatId: CoopSeatId, clientId: string): void {
  if (!isNonEmptyString(clientId)) throw new Error('clientId must be non-empty');
  const seat = state.seats[seatId];
  seat.clientId = clientId;
  seat.connected = true;
  seat.control = 'PLAYER';
}

export function disconnectCoopSeat(state: CoopRoomState, seatId: CoopSeatId, clientId: string): void {
  const seat = state.seats[seatId];
  if (seat.clientId !== clientId) return;
  seat.connected = false;
  seat.clientId = null;
  if (state.phase === 'LOBBY') {
    seat.ready = false;
    seat.deckSlotIds = [];
  } else if (state.phase === 'BATTLE') {
    seat.control = 'AI';
  }
}

function validateDeck(deckSlotIds: readonly string[]): string[] {
  if (deckSlotIds.length < 1 || deckSlotIds.length > COOP_DECK_SLOTS_PER_PLAYER) {
    throw new Error(`co-op deck must contain 1..${COOP_DECK_SLOTS_PER_PLAYER} characters`);
  }
  if (!deckSlotIds.every(isNonEmptyString)) throw new Error('co-op deck ids must be non-empty strings');
  if (new Set(deckSlotIds).size !== deckSlotIds.length) throw new Error('co-op deck must not contain duplicates');
  return [...deckSlotIds];
}

export function setCoopSeatReady(
  state: CoopRoomState,
  seatId: CoopSeatId,
  clientId: string,
  deckSlotIds: readonly string[],
): { readonly battleStarted: boolean } {
  if (state.phase !== 'LOBBY') throw new Error('room is not in lobby');
  const seat = requireSeat(state, seatId, clientId);
  seat.deckSlotIds = validateDeck(deckSlotIds);
  seat.ready = true;
  const battleStarted = COOP_SEATS.every((candidate) => state.seats[candidate].connected && state.seats[candidate].ready);
  if (battleStarted) state.phase = 'BATTLE';
  return { battleStarted };
}

export function setCoopSeatUnready(state: CoopRoomState, seatId: CoopSeatId, clientId: string): void {
  if (state.phase !== 'LOBBY') throw new Error('room is not in lobby');
  const seat = requireSeat(state, seatId, clientId);
  seat.ready = false;
  seat.deckSlotIds = [];
}

function validateSeatCommands(seat: CoopSeatState, input: CoopFrameInput): void {
  for (const command of input.commands) {
    if (command.type === 'SPAWN' && !seat.deckSlotIds.includes(command.slotId)) {
      throw new Error(`seat ${seat.seatId} cannot spawn unselected slot ${command.slotId}`);
    }
  }
}

function aiInput(tick: number): CoopFrameInput {
  return { tick, sequence: 0, commands: [] };
}

function drainCommittedFrames(state: CoopRoomState): CoopCommittedFrame[] {
  const frames: CoopCommittedFrame[] = [];
  while (state.phase === 'BATTLE') {
    const tick = state.committedTick + 1;
    const a = state.pendingInputs.A[String(tick)] ?? (state.seats.A.control === 'AI' ? aiInput(tick) : undefined);
    const b = state.pendingInputs.B[String(tick)] ?? (state.seats.B.control === 'AI' ? aiInput(tick) : undefined);
    if (!a || !b) break;
    delete state.pendingInputs.A[String(tick)];
    delete state.pendingInputs.B[String(tick)];
    state.committedTick = tick;
    frames.push({ tick, inputs: { A: a, B: b } });
  }
  return frames;
}

export function submitCoopFrameInput(
  state: CoopRoomState,
  seatId: CoopSeatId,
  clientId: string,
  input: CoopFrameInput,
): SubmitFrameResult {
  if (state.phase !== 'BATTLE') throw new Error('room is not in battle');
  const seat = requireSeat(state, seatId, clientId);
  assertNonNegativeInteger(input.tick, 'input.tick');
  assertNonNegativeInteger(input.sequence, 'input.sequence');
  if (input.tick <= state.committedTick) throw new Error('input tick is already committed');
  if (input.tick > state.committedTick + COOP_MAX_INPUT_LEAD) throw new Error('input tick is too far ahead');
  if (input.sequence <= seat.lastSequence) throw new Error('input sequence must increase');
  if (input.commands.length > COOP_MAX_COMMANDS_PER_FRAME) throw new Error('too many commands in one frame');
  validateSeatCommands(seat, input);
  if (state.pendingInputs[seatId][String(input.tick)]) throw new Error('seat already submitted this tick');
  state.pendingInputs[seatId][String(input.tick)] = {
    tick: input.tick,
    sequence: input.sequence,
    commands: [...input.commands],
  };
  seat.lastSequence = input.sequence;
  return { accepted: true, committedFrames: drainCommittedFrames(state) };
}
