import assert from 'node:assert/strict';
import test from 'node:test';
import type { CoopPlayerLoadout } from '../src/coop-room.ts';
import { createServerCoopBattle, getServerCoopStage, getServerRuntimeCoopStageIds, isServerStageAvailable } from '../src/runtime-content.ts';

function loadout(ids: readonly string[]): CoopPlayerLoadout {
  return { characters: ids.map((characterId) => ({ characterId, level: 1, plusLevel: 0 })), permanentRewardIds: [] };
}

const one = loadout(['militia']);

test('authoritative co-op enforces three characters per player in 다섯 깃발', () => {
  assert.doesNotThrow(() => createServerCoopBattle('special_five_banners_01', loadout(['militia','guard','hunter']), one));
  assert.throws(
    () => createServerCoopBattle('special_five_banners_01', loadout(['militia','guard','hunter','duelist']), one),
    /stage_formation_restricted:special_five_banners_01/,
  );
});

test('authoritative co-op enforces resolved production cost 400 in 가벼운 주머니', () => {
  assert.doesNotThrow(() => createServerCoopBattle('special_light_purse_01', loadout(['militia','lancer']), one));
  assert.throws(
    () => createServerCoopBattle('special_light_purse_01', loadout(['militia','battlemage']), one),
    /stage_formation_restricted:special_light_purse_01/,
  );
});

test('event windows are deterministic and current active events are exposed to co-op', () => {
  assert.equal(isServerStageAvailable('event_summer_01_01', Date.parse('2026-08-29T12:00:00+09:00')), true);
  assert.equal(isServerStageAvailable('event_summer_01_01', Date.parse('2026-10-01T12:00:00+09:00')), false);
  assert.equal(isServerStageAvailable('event_summer_01_01', Date.parse('2027-08-29T12:00:00+09:00')), true);
  assert.equal(getServerCoopStage('event_summer_01_06').policy.multiplayerPolicy, 'SOLO_OR_COOP');
  const ids = getServerRuntimeCoopStageIds();
  assert.ok(ids.includes('event_summer_01_01'));
  assert.ok(ids.includes('event_zero_edge_01_05'));
});
