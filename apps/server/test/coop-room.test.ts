import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COOP_MAX_INPUT_LEAD,
  connectCoopSeat,
  createCoopRoom,
  disconnectCoopSeat,
  getCoopRoomSnapshot,
  parseCoopClientMessage,
  setCoopSeatBaseWeapon,
  setCoopSeatReady,
  setCoopSeatUnready,
  submitCoopFrameInput,
  type CoopPlayerLoadout,
} from '../src/coop-room.ts';

function loadout(ids: readonly string[], permanentRewardIds: readonly string[] = []): CoopPlayerLoadout {
  return {
    characters: ids.map((characterId) => ({ characterId, level: 1, plusLevel: 0 })),
    permanentRewardIds,
    clearedStageIds: [],
  };
}

function readyBattle() {
  const room = createCoopRoom('match-1', 'main_01_005');
  connectCoopSeat(room, 'A', 'client-a');
  connectCoopSeat(room, 'B', 'client-b');
  assert.equal(setCoopSeatReady(room, 'A', 'client-a', loadout(['a1', 'a2', 'a3', 'a4', 'a5'])).battleStarted, false);
  assert.equal(setCoopSeatReady(room, 'B', 'client-b', loadout(['b1', 'b2', 'b3', 'b4', 'b5'])).battleStarted, true);
  return room;
}

test('co-op room is exactly two seats and only starts after both connected seats ready', () => {
  const room = createCoopRoom('match-1', 'main_01_005');
  connectCoopSeat(room, 'A', 'client-a');
  connectCoopSeat(room, 'B', 'client-b');
  const first = setCoopSeatReady(room, 'A', 'client-a', loadout(['a1', 'a2', 'a3']));
  assert.equal(first.battleStarted, false);
  assert.equal(room.phase, 'LOBBY');
  const second = setCoopSeatReady(room, 'B', 'client-b', loadout(['b1', 'b2']));
  assert.equal(second.battleStarted, true);
  assert.equal(room.phase, 'BATTLE');
  assert.equal(room.committedTick, -1);
  assert.deepEqual(room.seats.A.deckSlotIds, ['a1', 'a2', 'a3']);
  assert.equal(room.seats.A.loadout?.characters.length, 3);

  const snapshot = getCoopRoomSnapshot(room);
  assert.deepEqual(snapshot.seats.map((seat) => [seat.seatId, seat.deckSize]), [['A', 3], ['B', 2]]);
  assert.equal(snapshot.agreedBaseWeaponId, 'base_weapon_front_cannon');
});

test('co-op shared weapon is negotiated before ready and cannot be changed while ready', () => {
  const room = createCoopRoom('match-weapon', 'main_03_010');
  connectCoopSeat(room, 'A', 'client-a');
  connectCoopSeat(room, 'B', 'client-b');
  setCoopSeatBaseWeapon(room, 'A', 'client-a', 'base_weapon_supply_drop');
  assert.equal(getCoopRoomSnapshot(room).agreedBaseWeaponId, null);
  setCoopSeatBaseWeapon(room, 'B', 'client-b', 'base_weapon_supply_drop');
  assert.equal(getCoopRoomSnapshot(room).agreedBaseWeaponId, 'base_weapon_supply_drop');
  assert.equal(setCoopSeatReady(room, 'A', 'client-a', loadout(['a1'])).battleStarted, false);
  assert.throws(() => setCoopSeatBaseWeapon(room, 'A', 'client-a', 'base_weapon_front_cannon'), /ready seat cannot change/);
  setCoopSeatUnready(room, 'A', 'client-a');
  setCoopSeatBaseWeapon(room, 'A', 'client-a', 'base_weapon_front_cannon');
  assert.equal(getCoopRoomSnapshot(room).agreedBaseWeaponId, null);
});

test('second ready is rejected until both seats select the same shared weapon', () => {
  const room = createCoopRoom('match-mismatch', 'main_02_010');
  connectCoopSeat(room, 'A', 'client-a');
  connectCoopSeat(room, 'B', 'client-b');
  setCoopSeatBaseWeapon(room, 'A', 'client-a', 'base_weapon_aegis_emitter');
  assert.equal(setCoopSeatReady(room, 'A', 'client-a', loadout(['a1'])).battleStarted, false);
  assert.throws(() => setCoopSeatReady(room, 'B', 'client-b', loadout(['b1'])), /base_weapon_mismatch/);
  setCoopSeatBaseWeapon(room, 'B', 'client-b', 'base_weapon_aegis_emitter');
  assert.equal(setCoopSeatReady(room, 'B', 'client-b', loadout(['b1'])).battleStarted, true);
});

test('co-op ready enforces one-to-five unique characters and a bounded metadata shape', () => {
  const room = createCoopRoom('match-1', 'main_01_005');
  connectCoopSeat(room, 'A', 'client-a');
  assert.throws(() => setCoopSeatReady(room, 'A', 'client-a', loadout([])), /1\.\.5/);
  assert.throws(() => setCoopSeatReady(room, 'A', 'client-a', loadout(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'])), /1\.\.5/);
  assert.throws(() => setCoopSeatReady(room, 'A', 'client-a', loadout(['a1', 'a1'])), /duplicates/);
  assert.throws(() => parseCoopClientMessage({ type: 'READY', loadout: { characters: [{ characterId: 'a1', level: 0, plusLevel: 0 }], permanentRewardIds: [], clearedStageIds: [] } }), /positive integer/);
  assert.throws(() => parseCoopClientMessage({ type: 'READY', loadout: { characters: [{ characterId: 'a1', level: 1, plusLevel: -1 }], permanentRewardIds: [], clearedStageIds: [] } }), /non-negative integer/);
  assert.throws(() => parseCoopClientMessage({ type: 'READY', loadout: { characters: [{ characterId: 'a1', level: 1, plusLevel: 0 }], permanentRewardIds: ['r1', 'r1'], clearedStageIds: [] } }), /duplicates/);
});

test('lockstep commits a frame only when both player inputs for that exact tick exist', () => {
  const room = readyBattle();
  const a = submitCoopFrameInput(room, 'A', 'client-a', {
    tick: 0,
    sequence: 0,
    commands: [{ type: 'SPAWN', slotId: 'a1' }],
  });
  assert.equal(a.committedFrames.length, 0);
  assert.equal(room.committedTick, -1);

  const b = submitCoopFrameInput(room, 'B', 'client-b', {
    tick: 0,
    sequence: 0,
    commands: [{ type: 'UPGRADE_SUPPLY' }],
  });
  assert.equal(b.committedFrames.length, 1);
  assert.equal(room.committedTick, 0);
  assert.deepEqual(b.committedFrames[0]?.inputs.A.commands, [{ type: 'SPAWN', slotId: 'a1' }]);
  assert.deepEqual(b.committedFrames[0]?.inputs.B.commands, [{ type: 'UPGRADE_SUPPLY' }]);
});

test('input authority rejects out-of-deck spawns, duplicate submissions, stale sequence and excessive lead', () => {
  const room = readyBattle();
  assert.throws(() => submitCoopFrameInput(room, 'A', 'client-a', {
    tick: 0,
    sequence: 0,
    commands: [{ type: 'SPAWN', slotId: 'b1' }],
  }), /cannot spawn unselected slot/);

  submitCoopFrameInput(room, 'A', 'client-a', { tick: 0, sequence: 0, commands: [] });
  assert.throws(() => submitCoopFrameInput(room, 'A', 'client-a', { tick: 0, sequence: 1, commands: [] }), /already submitted/);
  assert.throws(() => submitCoopFrameInput(room, 'A', 'client-a', { tick: 1, sequence: 0, commands: [] }), /sequence must increase/);
  assert.throws(() => submitCoopFrameInput(room, 'B', 'client-b', {
    tick: COOP_MAX_INPUT_LEAD,
    sequence: 0,
    commands: [],
  }), /too far ahead/);
});

test('disconnect hands the seat to AI no-op control so the remaining player cannot deadlock the room', () => {
  const room = readyBattle();
  disconnectCoopSeat(room, 'B', 'client-b');
  assert.equal(room.seats.B.connected, false);
  assert.equal(room.seats.B.control, 'AI');
  assert.ok(room.seats.B.loadout, 'battle loadout survives disconnect for reconnect/AI control');

  const result = submitCoopFrameInput(room, 'A', 'client-a', {
    tick: 0,
    sequence: 0,
    commands: [{ type: 'SPAWN', slotId: 'a1' }],
  });
  assert.equal(result.committedFrames.length, 1);
  assert.deepEqual(result.committedFrames[0]?.inputs.B.commands, []);
  assert.equal(room.committedTick, 0);
});

test('reconnecting the same seat restores player control without rewinding committed frames', () => {
  const room = readyBattle();
  disconnectCoopSeat(room, 'B', 'client-b');
  submitCoopFrameInput(room, 'A', 'client-a', { tick: 0, sequence: 0, commands: [] });
  assert.equal(room.committedTick, 0);

  connectCoopSeat(room, 'B', 'client-b2');
  assert.equal(room.seats.B.control, 'PLAYER');
  assert.equal(room.seats.B.connected, true);
  assert.equal(room.committedTick, 0);

  submitCoopFrameInput(room, 'A', 'client-a', { tick: 1, sequence: 1, commands: [] });
  const result = submitCoopFrameInput(room, 'B', 'client-b2', { tick: 1, sequence: 0, commands: [] });
  assert.equal(result.committedFrames[0]?.tick, 1);
});

test('client message parser accepts only the explicit co-op protocol surface', () => {
  assert.deepEqual(parseCoopClientMessage({ type: 'PING' }), { type: 'PING' });
  assert.deepEqual(parseCoopClientMessage({ type: 'SELECT_BASE_WEAPON', baseWeaponId: 'base_weapon_aegis_emitter' }), { type: 'SELECT_BASE_WEAPON', baseWeaponId: 'base_weapon_aegis_emitter' });
  assert.throws(() => parseCoopClientMessage({ type: 'SELECT_BASE_WEAPON', baseWeaponId: 'base_weapon_cheat' }), /baseWeaponId is invalid/);
  const ready = {
    characters: [{ characterId: 'a1', level: 20, plusLevel: 3, selectedFormId: 'a1_f2' }],
    permanentRewardIds: ['reward-1'],
    clearedStageIds: ['main_01_001'],
  };
  assert.deepEqual(parseCoopClientMessage({ type: 'READY', loadout: ready }), { type: 'READY', loadout: ready });
  assert.deepEqual(parseCoopClientMessage({
    type: 'FRAME_INPUT',
    input: { tick: 0, sequence: 0, commands: [{ type: 'FIRE_BASE_WEAPON' }] },
  }), {
    type: 'FRAME_INPUT',
    input: { tick: 0, sequence: 0, commands: [{ type: 'FIRE_BASE_WEAPON' }] },
  });
  assert.throws(() => parseCoopClientMessage({ type: 'READY', loadout: { characters: 'a1', permanentRewardIds: [], clearedStageIds: [] } }), /characters/);
  assert.throws(() => parseCoopClientMessage({ type: 'READY', deckSlotIds: ['a1'] }), /loadout/);
  assert.throws(() => parseCoopClientMessage({ type: 'CHEAT', value: 999 }), /unsupported_message/);
});
