import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCoopPlayableFrame } from '@frontline/sim/coop-playable';
import {
  connectCoopSeat,
  createCoopRoom,
  setCoopSeatReady,
  submitCoopFrameInput,
  type CoopPlayerLoadout,
} from '../src/coop-room.ts';
import {
  createServerCoopBattle,
  getServerCoopDeck,
  getServerCoopLoadout,
  getServerCoopStage,
  getServerRuntimeCoopStageIds,
} from '../src/runtime-content.ts';

function loadout(
  characters: readonly { readonly characterId: string; readonly level?: number; readonly plusLevel?: number; readonly selectedFormId?: string }[],
  permanentRewardIds: readonly string[] = [],
): CoopPlayerLoadout {
  return {
    characters: characters.map((character) => ({
      characterId: character.characterId,
      level: character.level ?? 1,
      plusLevel: character.plusLevel ?? 0,
      ...(character.selectedFormId === undefined ? {} : { selectedFormId: character.selectedFormId }),
    })),
    permanentRewardIds,
  };
}

const militiaLoadout = (): CoopPlayerLoadout => loadout([{ characterId: 'militia' }]);

test('server runtime refuses SOLO_ONLY stages and exposes only current executable co-op stages', () => {
  assert.throws(() => getServerCoopStage('main_01_001'), /stage_not_coop_eligible/);
  assert.throws(() => getServerCoopStage('missing-stage'), /unknown_server_stage/);
  assert.equal(getServerCoopStage('main_01_003').policy.multiplayerPolicy, 'SOLO_OR_COOP');
  const ids = getServerRuntimeCoopStageIds();
  assert.equal(ids.includes('main_01_001'), false);
  assert.equal(ids.includes('main_01_003'), true);
  assert.equal(ids.includes('special-01'), true);
});

test('server validates canonical character ids and meta bounds before a co-op battle can start', () => {
  assert.equal(getServerCoopDeck(['militia']).length, 1);
  assert.throws(() => getServerCoopDeck(['militia', 'militia']), /duplicates/);
  assert.throws(() => getServerCoopDeck(['definitely-not-a-unit']), /unknown_coop_character/);

  assert.equal(getServerCoopLoadout(militiaLoadout()).playerSlots.length, 1);
  assert.throws(() => getServerCoopLoadout(loadout([{ characterId: 'militia', level: 51 }])), /invalid_coop_level/);
  assert.throws(() => getServerCoopLoadout(loadout([{ characterId: 'militia', plusLevel: 51 }])), /invalid_coop_plus_level/);
  assert.throws(() => getServerCoopLoadout(loadout([{ characterId: 'militia', selectedFormId: 'char_s01_mireille_f3' }])), /invalid_coop_form_owner/);
  assert.throws(() => getServerCoopLoadout(loadout([{ characterId: 'militia' }], ['not-a-reward'])), /unknown_coop_permanent_reward/);
});

test('server computes level plus and evolution stats from canonical content instead of accepting raw combat stats', () => {
  const base = getServerCoopLoadout(loadout([{ characterId: 'char_s01_mireille' }])).playerSlots[0]!;
  const progressed = getServerCoopLoadout(loadout([{
    characterId: 'char_s01_mireille',
    level: 30,
    plusLevel: 10,
    selectedFormId: 'char_s01_mireille_f3',
  }])).playerSlots[0]!;

  assert.ok(progressed.definition.maxHp > base.definition.maxHp);
  assert.ok(progressed.definition.attackDamage > base.definition.attackDamage);
  assert.ok(progressed.definition.standingRange > base.definition.standingRange);
  assert.ok(progressed.cost > base.cost);
});

test('server co-op battle applies canonical stage scaling to the shared battlefield', () => {
  const battle = createServerCoopBattle('main_01_003', militiaLoadout(), militiaLoadout());
  assert.equal(battle.shared.battle.bases.PLAYER.maxHp, 1050);
  assert.equal(battle.shared.battle.bases.ENEMY.maxHp, 1176, '1050 enemy base HP × 1.12 co-op policy');
  assert.equal(battle.players.A.slots[0]?.slotId, 'militia');
  assert.equal(battle.players.B.slots[0]?.slotId, 'militia');
  assert.equal(battle.shared.playerSlots.some((slot) => slot.slotId === 'A:militia'), true);
  assert.equal(battle.shared.playerSlots.some((slot) => slot.slotId === 'B:militia'), true);
});

test('each co-op seat retains its own growth and permanent economy modifiers', () => {
  const a = loadout([{
    characterId: 'char_s01_mireille',
    level: 30,
    plusLevel: 10,
    selectedFormId: 'char_s01_mireille_f3',
  }], ['wind-badge', 'black-banner', 'charred-grain']);
  const b = loadout([{ characterId: 'char_s01_mireille' }]);
  const battle = createServerCoopBattle('main_01_003', a, b);

  assert.ok(battle.players.A.slots[0]!.definition.maxHp > battle.players.B.slots[0]!.definition.maxHp);
  assert.ok(battle.players.A.slots[0]!.definition.attackDamage > battle.players.B.slots[0]!.definition.attackDamage);
  assert.ok(battle.players.A.supply > battle.players.B.supply, 'starting supply bonus remains personal');
  assert.ok(battle.players.A.supplyLevels[1]!.upgradeCost < battle.players.B.supplyLevels[1]!.upgradeCost, 'worker discount remains personal');
  assert.ok(battle.enemyRewardSupplyBySeat.A.grunt > battle.enemyRewardSupplyBySeat.B.grunt, 'kill supply bonus remains personal');
});

test('shared base HP uses only permanent base rewards held by both players', () => {
  const none = createServerCoopBattle('main_01_003', militiaLoadout(), militiaLoadout());
  const oneSided = createServerCoopBattle(
    'main_01_003',
    loadout([{ characterId: 'militia' }], ['rust-nail']),
    militiaLoadout(),
  );
  const shared = createServerCoopBattle(
    'main_01_003',
    loadout([{ characterId: 'militia' }], ['rust-nail']),
    loadout([{ characterId: 'militia' }], ['rust-nail']),
  );

  assert.equal(oneSided.shared.battle.bases.PLAYER.maxHp, none.shared.battle.bases.PLAYER.maxHp);
  assert.equal(shared.shared.battle.bases.PLAYER.maxHp, 1103);
});

test('room lockstep frames drive the actual shared simulation one frame at a time', () => {
  const room = createCoopRoom('match-runtime', 'main_01_003');
  connectCoopSeat(room, 'A', 'client-a');
  connectCoopSeat(room, 'B', 'client-b');
  setCoopSeatReady(room, 'A', 'client-a', militiaLoadout());
  assert.equal(setCoopSeatReady(room, 'B', 'client-b', militiaLoadout()).battleStarted, true);
  const loadoutA = room.seats.A.loadout!;
  const loadoutB = room.seats.B.loadout!;
  const battle = createServerCoopBattle(room.stageId, loadoutA, loadoutB);

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
