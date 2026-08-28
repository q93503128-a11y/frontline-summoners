import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCoopPlayableFrame } from '@frontline/sim/coop-playable';
import {
  connectCoopSeat,
  createCoopRoom,
  setCoopSeatReady,
  submitCoopFrameInput,
} from '../src/coop-room.ts';
import {
  createServerCoopBattle,
  getServerCoopDeck,
  getServerCoopStage,
  getServerRuntimeCoopStageIds,
} from '../src/runtime-content.ts';

test('server runtime refuses SOLO_ONLY stages and exposes only current executable co-op stages', () => {
  assert.throws(() => getServerCoopStage('main_01_001'), /stage_not_coop_eligible/);
  assert.throws(() => getServerCoopStage('missing-stage'), /unknown_server_stage/);
  assert.equal(getServerCoopStage('main_01_003').policy.multiplayerPolicy, 'SOLO_OR_COOP');
  const ids = getServerRuntimeCoopStageIds();
  assert.equal(ids.includes('main_01_001'), false);
  assert.equal(ids.includes('main_01_003'), true);
  assert.equal(ids.includes('special-01'), true);
});

test('server validates canonical character ids before a co-op battle can start', () => {
  assert.equal(getServerCoopDeck(['militia']).length, 1);
  assert.throws(() => getServerCoopDeck(['militia', 'militia']), /duplicates/);
  assert.throws(() => getServerCoopDeck(['definitely-not-a-unit']), /unknown_coop_character/);
});

test('server co-op battle applies canonical stage scaling to the shared battlefield', () => {
  const battle = createServerCoopBattle('main_01_003', ['militia'], ['militia']);
  assert.equal(battle.shared.battle.bases.PLAYER.maxHp, 1050);
  assert.equal(battle.shared.battle.bases.ENEMY.maxHp, 1176, '1050 enemy base HP × 1.12 co-op policy');
  assert.equal(battle.players.A.slots[0]?.slotId, 'militia');
  assert.equal(battle.players.B.slots[0]?.slotId, 'militia');
  assert.equal(battle.shared.playerSlots.some((slot) => slot.slotId === 'A:militia'), true);
  assert.equal(battle.shared.playerSlots.some((slot) => slot.slotId === 'B:militia'), true);
});

test('room lockstep frames drive the actual shared simulation one frame at a time', () => {
  const room = createCoopRoom('match-runtime', 'main_01_003');
  connectCoopSeat(room, 'A', 'client-a');
  connectCoopSeat(room, 'B', 'client-b');
  setCoopSeatReady(room, 'A', 'client-a', ['militia']);
  assert.equal(setCoopSeatReady(room, 'B', 'client-b', ['militia']).battleStarted, true);
  const battle = createServerCoopBattle(room.stageId, room.seats.A.deckSlotIds, room.seats.B.deckSlotIds);

  const first = submitCoopFrameInput(room, 'A', 'client-a', {
    tick: 0,
    sequence: 0,
    commands: [{ type: 'SPAWN', slotId: 'militia' }],
  });
  assert.equal(first.committedFrames.length, 0);
  const second = submitCoopFrameInput(room, 'B', 'client-b', {
    tick: 0,
    sequence: 0,
    commands: [{ type: 'SPAWN', slotId: 'militia' }],
  });
  assert.equal(second.committedFrames.length, 1);
  const frame = second.committedFrames[0]!;
  const applied = applyCoopPlayableFrame(battle, frame.tick, {
    A: frame.inputs.A.commands,
    B: frame.inputs.B.commands,
  });
  assert.equal(applied.outcomes.length, 2);
  assert.equal(applied.outcomes.every((outcome) => outcome.ok), true);
  assert.equal(battle.shared.battle.tick, 1);
  assert.equal(applied.snapshot.units.filter((unit) => unit.team === 'PLAYER').length, 2);
});
