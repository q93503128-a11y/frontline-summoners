import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGuestDeckSlots, createGuestPrototypeBattle } from '../src/player-loadout.ts';
import { STAGES } from '../src/prototype.ts';
import type { GuestProgress } from '../src/save.ts';

const fullChapter = STAGES.map((stage) => stage.id);
const firstStageId = STAGES[0]!.id;

function progress(overrides: Partial<GuestProgress> = {}): GuestProgress {
  return {
    clearedStageIds: fullChapter,
    specialClearedStageIds: [],
    permanentRewardIds: [],
    ownedRecruitmentCharacterIds: ['moon-eater', 'castle-crab'],
    recruitmentProgressByBanner: {},
    characterProgressById: {},
    ...overrides,
  };
}

test('explicit saved deck order becomes the actual battle slot order', () => {
  const guest = progress({ deckSlotIds: ['moon-eater', 'militia', 'castle-crab'] });
  const slots = buildGuestDeckSlots(guest);
  assert.deepEqual(slots.map((slot) => slot.slotId), ['moon-eater', 'militia', 'castle-crab']);

  const battle = createGuestPrototypeBattle(firstStageId, guest);
  assert.deepEqual(battle.playerSlots.map((slot) => slot.slotId), ['moon-eater', 'militia', 'castle-crab']);
});

test('saved level, plus level, and selected evolution form alter the battle-ready definition rather than only UI metadata', () => {
  const baseGuest = progress({ deckSlotIds: ['moon-eater'] });
  const base = buildGuestDeckSlots(baseGuest)[0]!;

  const evolvedGuest = progress({
    deckSlotIds: ['moon-eater'],
    characterProgressById: {
      'moon-eater': {
        level: 30,
        plusLevel: 0,
        unlockedFormIds: ['moon-eater-base', 'moon-eater-hollow', 'moon-eater-eclipse'],
        selectedFormId: 'moon-eater-eclipse',
      },
    },
  });
  const evolved = buildGuestDeckSlots(evolvedGuest)[0]!;

  assert.ok(evolved.definition.maxHp > base.definition.maxHp);
  assert.ok(evolved.definition.attackDamage > base.definition.attackDamage);
  assert.ok(evolved.definition.standingRange < base.definition.standingRange);
  assert.ok(evolved.cost > base.cost);
  assert.equal(evolved.definition.damageBonuses?.[0]?.trait, 'BOSS');
  assert.equal(evolved.definition.damageBonuses?.[0]?.multiplierPermille, 1700);

  const battle = createGuestPrototypeBattle(firstStageId, evolvedGuest);
  const battleMoon = battle.playerSlots[0]!;
  assert.equal(battleMoon.slotId, 'moon-eater');
  assert.equal(battleMoon.definition.maxHp, evolved.definition.maxHp);
  assert.equal(battleMoon.definition.attackDamage, evolved.definition.attackDamage);
  assert.equal(battleMoon.definition.standingRange, evolved.definition.standingRange);
});

test('automatic formation still selects the first ten owned definitions in canonical roster order', () => {
  const guest = progress();
  const slots = buildGuestDeckSlots(guest);
  assert.equal(slots.length, 10);
  assert.deepEqual(slots.map((slot) => slot.slotId), [
    'militia',
    'guard',
    'hunter',
    'duelist',
    'lancer',
    'battlemage',
    'pyromancer',
    'royal',
    'heretic',
    'voidsage',
  ]);
});
