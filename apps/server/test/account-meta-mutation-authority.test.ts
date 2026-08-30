import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { grantResources, getResourceBalance } from '@frontline/sim/resource-ledger';
import { MAIN_STAGE_RESOURCE_REWARDS } from '@frontline/sim/main-stage-rewards';
import { createInitialAccountSave, normalizeAccountSaveSnapshot } from '../src/account-save-authority.ts';
import { __accountMutationTestOnly } from '../src/account-mutation-authority.ts';
import { __accountMetaMutationTestOnly } from '../src/account-meta-mutation-authority.ts';
import { SERVER_EVOLUTION_FORMS, SERVER_EVOLUTION_RECIPES } from '../src/meta-content-v2.ts';

const NOW = Date.parse('2026-08-30T10:30:00Z');

function clearThrough(count: number) {
  let snapshot = createInitialAccountSave();
  for (const reward of MAIN_STAGE_RESOURCE_REWARDS.slice(0, count)) {
    snapshot = __accountMutationTestOnly.buildMainBattleResult(snapshot, reward.stageId, 'SOLO_BATTLE').snapshot;
  }
  return snapshot;
}

function fundAll(snapshot = createInitialAccountSave()) {
  return normalizeAccountSaveSnapshot({
    ...snapshot,
    resourceLedgerById: grantResources(snapshot.resourceLedgerById, {
      gold: 1_000_000,
      soul_essence: 100_000,
      evo_fragment: 10_000,
      evo_core: 1_000,
      evo_crown: 100,
    }),
  }, NOW);
}

test('account character Base Lv mutation spends canonical Gold and enforces chapter cap', () => {
  const funded = fundAll();
  const upgraded = __accountMetaMutationTestOnly.buildMetaProgressionResult(funded, {
    requestId: 'level-1', expectedRevision: 0, action: 'CHARACTER_LEVEL', characterId: 'militia', targetLevel: 5,
  }, NOW);
  if (upgraded.result.action !== 'CHARACTER_LEVEL') assert.fail('expected CHARACTER_LEVEL result');
  assert.equal(upgraded.snapshot.characterProgressById.militia?.level, 5);
  assert.deepEqual(upgraded.result.spentResources, { gold: 580 });
  assert.equal(getResourceBalance(upgraded.snapshot.resourceLedgerById, 'gold'), 999_420);

  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(funded, {
    requestId: 'level-locked', expectedRevision: 0, action: 'CHARACTER_LEVEL', characterId: 'militia', targetLevel: 11,
  }, NOW), /Base level cap is Lv10/);

  const chapterOne = fundAll(clearThrough(20));
  const level20 = __accountMetaMutationTestOnly.buildMetaProgressionResult(chapterOne, {
    requestId: 'level-20', expectedRevision: 0, action: 'CHARACTER_LEVEL', characterId: 'militia', targetLevel: 20,
  }, NOW);
  assert.equal(level20.snapshot.characterProgressById.militia?.level, 20);
  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(chapterOne, {
    requestId: 'level-21', expectedRevision: 0, action: 'CHARACTER_LEVEL', characterId: 'militia', targetLevel: 21,
  }, NOW), /Base level cap is Lv20/);
});

test('account +Lv mutation spends rarity-aware soul essence and cannot decrease', () => {
  const story = fundAll();
  const storyPlus = __accountMetaMutationTestOnly.buildMetaProgressionResult(story, {
    requestId: 'plus-story', expectedRevision: 0, action: 'CHARACTER_PLUS_LEVEL', characterId: 'militia', targetPlusLevel: 3,
  }, NOW);
  if (storyPlus.result.action !== 'CHARACTER_PLUS_LEVEL') assert.fail('expected CHARACTER_PLUS_LEVEL result');
  assert.deepEqual(storyPlus.result.spentResources, { soul_essence: 240 });
  assert.equal(storyPlus.snapshot.characterProgressById.militia?.plusLevel, 3);

  const recruitment = fundAll(normalizeAccountSaveSnapshot({
    ...createInitialAccountSave(),
    ownedRecruitmentCharacterIds: ['char_common_c_turnip_rider'],
  }, NOW));
  const recruitmentPlus = __accountMetaMutationTestOnly.buildMetaProgressionResult(recruitment, {
    requestId: 'plus-c', expectedRevision: 0, action: 'CHARACTER_PLUS_LEVEL', characterId: 'char_common_c_turnip_rider', targetPlusLevel: 3,
  }, NOW);
  if (recruitmentPlus.result.action !== 'CHARACTER_PLUS_LEVEL') assert.fail('expected CHARACTER_PLUS_LEVEL result');
  assert.deepEqual(recruitmentPlus.result.spentResources, { soul_essence: 48 });
  assert.equal(recruitmentPlus.snapshot.characterProgressById.char_common_c_turnip_rider?.plusLevel, 3);
  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(recruitmentPlus.snapshot, {
    requestId: 'plus-down', expectedRevision: 0, action: 'CHARACTER_PLUS_LEVEL', characterId: 'char_common_c_turnip_rider', targetPlusLevel: 2,
  }, NOW), /cannot decrease/);
});

test('account evolution unlock checks previous form, Base Lv and canonical recipe cost before form selection', () => {
  const f2 = SERVER_EVOLUTION_FORMS.find((form) => form.characterId === 'militia' && form.formOrder === 2)!;
  const f3 = SERVER_EVOLUTION_FORMS.find((form) => form.characterId === 'militia' && form.formOrder === 3)!;
  const recipe = SERVER_EVOLUTION_RECIPES.find((entry) => entry.formId === f2.formId)!;
  let snapshot = fundAll(clearThrough(80));
  snapshot = __accountMetaMutationTestOnly.buildMetaProgressionResult(snapshot, {
    requestId: 'evo-level', expectedRevision: 0, action: 'CHARACTER_LEVEL', characterId: 'militia', targetLevel: recipe.requiredBaseLevel,
  }, NOW).snapshot;

  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(snapshot, {
    requestId: 'evo-f3-first', expectedRevision: 0, action: 'EVOLUTION_UNLOCK', characterId: 'militia', formId: f3.formId,
  }, NOW), /previous evolution form/);
  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(snapshot, {
    requestId: 'evo-select-locked', expectedRevision: 0, action: 'EVOLUTION_SELECT', characterId: 'militia', formId: f2.formId,
  }, NOW), /not unlocked/);

  const unlocked = __accountMetaMutationTestOnly.buildMetaProgressionResult(snapshot, {
    requestId: 'evo-unlock', expectedRevision: 0, action: 'EVOLUTION_UNLOCK', characterId: 'militia', formId: f2.formId,
  }, NOW);
  if (unlocked.result.action !== 'EVOLUTION_UNLOCK') assert.fail('expected EVOLUTION_UNLOCK result');
  assert.deepEqual(unlocked.result.spentResources, recipe.cost);
  assert.ok(unlocked.snapshot.characterProgressById.militia?.unlockedFormIds.includes(f2.formId));

  const selected = __accountMetaMutationTestOnly.buildMetaProgressionResult(unlocked.snapshot, {
    requestId: 'evo-select', expectedRevision: 0, action: 'EVOLUTION_SELECT', characterId: 'militia', formId: f2.formId,
  }, NOW);
  assert.equal(selected.snapshot.characterProgressById.militia?.selectedFormId, f2.formId);
});

test('account deck mutation is exact, unique and owned-only', () => {
  const snapshot = normalizeAccountSaveSnapshot({
    ...createInitialAccountSave(),
    ownedRecruitmentCharacterIds: ['char_common_c_turnip_rider'],
  }, NOW);
  const set = __accountMetaMutationTestOnly.buildMetaProgressionResult(snapshot, {
    requestId: 'deck-1', expectedRevision: 0, action: 'DECK_SET', deckSlotIds: ['char_common_c_turnip_rider', 'militia'],
  }, NOW);
  assert.deepEqual(set.snapshot.deckSlotIds, ['char_common_c_turnip_rider', 'militia']);
  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(snapshot, {
    requestId: 'deck-dup', expectedRevision: 0, action: 'DECK_SET', deckSlotIds: ['militia', 'militia'],
  }, NOW), /duplicate/);
  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(snapshot, {
    requestId: 'deck-unowned', expectedRevision: 0, action: 'DECK_SET', deckSlotIds: ['char_s01_mireille'],
  }, NOW), /unowned/);
});

test('account base weapon selection is server-unlock-authoritative', () => {
  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(createInitialAccountSave(), {
    requestId: 'weapon-locked', expectedRevision: 0, action: 'BASE_WEAPON_SELECT', baseWeaponId: 'base_weapon_aegis_emitter',
  }, NOW), /locked/);

  const unlocked = clearThrough(30);
  const selected = __accountMetaMutationTestOnly.buildMetaProgressionResult(unlocked, {
    requestId: 'weapon-aegis', expectedRevision: 0, action: 'BASE_WEAPON_SELECT', baseWeaponId: 'base_weapon_aegis_emitter',
  }, NOW);
  assert.equal(selected.snapshot.selectedBaseWeaponId, 'base_weapon_aegis_emitter');
});

test('account meta mutation rejects insufficient wallet instead of trusting client affordability', () => {
  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(createInitialAccountSave(), {
    requestId: 'level-poor', expectedRevision: 0, action: 'CHARACTER_LEVEL', characterId: 'militia', targetLevel: 2,
  }, NOW), /Insufficient meta resource: gold/);
  assert.throws(() => __accountMetaMutationTestOnly.buildMetaProgressionResult(createInitialAccountSave(), {
    requestId: 'plus-poor', expectedRevision: 0, action: 'CHARACTER_PLUS_LEVEL', characterId: 'militia', targetPlusLevel: 1,
  }, NOW), /Insufficient meta resource: soul_essence/);
});

test('D1 meta progression migration expands receipt kind without weakening battle id uniqueness', async () => {
  const sql = await readFile(new URL('../migrations/0006_account_meta_progression_mutations.sql', import.meta.url), 'utf8');
  assert.match(sql, /META_PROGRESSION/);
  assert.match(sql, /PRIMARY KEY \(user_id, mutation_kind, mutation_id\)/);
  assert.match(sql, /CREATE UNIQUE INDEX account_battle_mutation_id_idx/);
  assert.match(sql, /MAIN_BATTLE_RESULT/);
  assert.match(sql, /SPECIAL_BATTLE_RESULT/);
  assert.match(sql, /RECORD_RESULT/);
});

test('account meta mutation source uses revision CAS and request receipt replay guard', async () => {
  const source = await readFile(new URL('../src/account-meta-mutation-authority.ts', import.meta.url), 'utf8');
  assert.match(source, /revision = CASE WHEN revision = \?3 THEN revision \+ 1 ELSE -1 END/);
  assert.match(source, /META_PROGRESSION/);
  assert.match(source, /INSERT INTO account_mutation_receipts/);
  assert.match(source, /idempotency key reused with different input/);
  assert.match(source, /expectedRevision/);
});
