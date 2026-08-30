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
    ownedRecruitmentCharacterIds: ['char_s01_mireille', 'char_common_a_meteor_cart'],
    recruitmentProgressByBanner: {},
    characterProgressById: {},
    ...overrides,
  };
}

test('explicit saved deck order becomes the actual battle slot order', () => {
  const guest = progress({ deckSlotIds: ['char_s01_mireille', 'militia', 'char_common_a_meteor_cart'] });
  const slots = buildGuestDeckSlots(guest);
  assert.deepEqual(slots.map((slot) => slot.slotId), ['char_s01_mireille', 'militia', 'char_common_a_meteor_cart']);

  const battle = createGuestPrototypeBattle(firstStageId, guest);
  assert.deepEqual(battle.playerSlots.map((slot) => slot.slotId), ['char_s01_mireille', 'militia', 'char_common_a_meteor_cart']);
});

test('saved level, plus level, and selected evolution form alter the battle-ready definition rather than only UI metadata', () => {
  const baseGuest = progress({ deckSlotIds: ['char_s01_mireille'] });
  const base = buildGuestDeckSlots(baseGuest)[0]!;
  const baseBattle = createGuestPrototypeBattle(firstStageId, baseGuest);
  const baseBattleMireille = baseBattle.playerSlots[0]!;

  const evolvedGuest = progress({
    deckSlotIds: ['char_s01_mireille'],
    characterProgressById: {
      char_s01_mireille: {
        level: 30,
        plusLevel: 0,
        unlockedFormIds: ['char_s01_mireille_f1', 'char_s01_mireille_f2', 'char_s01_mireille_f3'],
        selectedFormId: 'char_s01_mireille_f3',
      },
    },
  });
  const evolved = buildGuestDeckSlots(evolvedGuest)[0]!;

  assert.ok(evolved.definition.maxHp > base.definition.maxHp);
  assert.ok(evolved.definition.attackDamage > base.definition.attackDamage);
  assert.ok(evolved.definition.standingRange > base.definition.standingRange);
  assert.ok(evolved.definition.attackMinRange > base.definition.attackMinRange);
  assert.ok(evolved.cost > base.cost);

  const battle = createGuestPrototypeBattle(firstStageId, evolvedGuest);
  const battleMireille = battle.playerSlots[0]!;
  assert.equal(battleMireille.slotId, 'char_s01_mireille');
  assert.ok(battleMireille.definition.maxHp >= evolved.definition.maxHp, 'earned permanent HP rewards layer on after character growth');
  assert.ok(battleMireille.definition.attackDamage >= evolved.definition.attackDamage, 'earned permanent attack rewards layer on after character growth');
  assert.ok(battleMireille.definition.standingRange >= evolved.definition.standingRange);
  assert.ok(battleMireille.definition.maxHp > baseBattleMireille.definition.maxHp);
});

test('durable selected base weapon becomes the actual solo simulation weapon', () => {
  const supplyDrop = createGuestPrototypeBattle(firstStageId, progress({ selectedBaseWeaponId: 'base_weapon_supply_drop' }));
  assert.equal(supplyDrop.baseWeapon.id, 'base_weapon_supply_drop');
  assert.equal(supplyDrop.baseWeapon.kind, 'SUPPLY_DROP');
});

test('locked selected base weapon is normalized back to the front cannon before battle creation', () => {
  const onlyChapterOne = STAGES.slice(0, 20).map((stage) => stage.id);
  const guest = progress({ clearedStageIds: onlyChapterOne, selectedBaseWeaponId: 'base_weapon_supply_drop' });
  const battle = createGuestPrototypeBattle(firstStageId, guest);
  assert.equal(battle.baseWeapon.id, 'base_weapon_front_cannon');
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
