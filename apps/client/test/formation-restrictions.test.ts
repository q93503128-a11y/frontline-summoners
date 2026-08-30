import assert from 'node:assert/strict';
import test from 'node:test';
import { getGuestStageFormationViolation } from '../src/player-loadout.ts';
import { STAGES } from '../src/prototype.ts';
import type { GuestProgress } from '../src/save.ts';

function progress(deckSlotIds: readonly string[]): GuestProgress {
  return {
    clearedStageIds: STAGES.slice(0, 60).map((stage) => stage.id),
    specialClearedStageIds: [],
    permanentRewardIds: [],
    discoveredEnemyIds: [],
    deckSlotIds,
  };
}

test('다섯 깃발 allows five distinct solo characters but rejects six', () => {
  assert.equal(getGuestStageFormationViolation('special_five_banners_01', progress(['militia','guard','hunter','duelist','lancer'])), undefined);
  assert.match(getGuestStageFormationViolation('special_five_banners_01', progress(['militia','guard','hunter','duelist','lancer','battlemage'])) ?? '', /최대 5종/);
});

test('가벼운 주머니 evaluates the resolved current production cost', () => {
  assert.equal(getGuestStageFormationViolation('special_light_purse_01', progress(['militia','guard','hunter','duelist','lancer'])), undefined);
  const violation = getGuestStageFormationViolation('special_light_purse_01', progress(['militia','guard','pyromancer']));
  assert.match(violation ?? '', /450/);
  assert.match(violation ?? '', /400/);
});
