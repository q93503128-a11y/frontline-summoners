import {
  type CoopCommittedFrame,
  type CoopFrameInput,
  type CoopRoomState,
  type CoopSeatId,
} from './coop-room.ts';

function aiInput(tick: number): CoopFrameInput {
  return { tick, sequence: 0, commands: [] };
}

function resolveSeatInput(state: CoopRoomState, seatId: CoopSeatId, tick: number): CoopFrameInput | undefined {
  return state.pendingInputs[seatId][String(tick)] ?? (state.seats[seatId].control === 'AI' ? aiInput(tick) : undefined);
}

/**
 * A disconnect can happen after the remaining player already submitted the next frame.
 * The room must immediately pair that pending player input with the disconnected seat's
 * AI no-op input. We deliberately require at least one real pending input per drained
 * frame so two AI seats never free-run the simulation without a connected player.
 */
export function drainCoopFramesAfterAiHandoff(state: CoopRoomState): readonly CoopCommittedFrame[] {
  const frames: CoopCommittedFrame[] = [];
  while (state.phase === 'BATTLE') {
    const tick = state.committedTick + 1;
    const pendingA = state.pendingInputs.A[String(tick)];
    const pendingB = state.pendingInputs.B[String(tick)];
    if (!pendingA && !pendingB) break;

    const a = resolveSeatInput(state, 'A', tick);
    const b = resolveSeatInput(state, 'B', tick);
    if (!a || !b) break;

    delete state.pendingInputs.A[String(tick)];
    delete state.pendingInputs.B[String(tick)];
    state.committedTick = tick;
    frames.push({ tick, inputs: { A: a, B: b } });
  }
  return frames;
}
