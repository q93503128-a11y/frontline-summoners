import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('active meta authority delegates guest writes but routes online accounts through revisioned server mutations', async () => {
  const source = await readSource('../src/active-meta-progression.ts');

  assert.match(source, /getAccountClientState/);
  assert.match(source, /mutateAuthenticatedAccountMeta/);
  assert.match(source, /mutateAuthenticatedAccountRecruitment/);
  assert.match(source, /accountSnapshotToGuestProgress/);
  assert.match(source, /state\.kind === 'GUEST_LOCAL'/);
  assert.match(source, /state\.kind !== 'AUTHENTICATED_ONLINE'/);
  assert.match(source, /계정 진행 저장은 온라인 연결이 필요합니다/);

  assert.match(source, /return recordGuestCharacterLevel\(characterId, targetLevel\)/);
  assert.match(source, /return recordGuestCharacterPlusLevel\(characterId, targetPlusLevel\)/);
  assert.match(source, /return recordGuestEvolutionUnlock\(characterId, formId\)/);
  assert.match(source, /return selectGuestEvolutionForm\(characterId, formId\)/);
  assert.match(source, /return recordGuestDeck\(deckSlotIds\)/);
  assert.match(source, /return resetGuestDeckToAutomatic\(\)/);
  assert.match(source, /return selectGuestBaseWeapon\(baseWeaponId\)/);
  assert.match(source, /performGuestRecruitment\(count, rng, banner, duplicatePolicy\)/);

  assert.match(source, /action: 'CHARACTER_LEVEL'/);
  assert.match(source, /action: 'CHARACTER_PLUS_LEVEL'/);
  assert.match(source, /action: 'EVOLUTION_UNLOCK'/);
  assert.match(source, /action: 'EVOLUTION_SELECT'/);
  assert.match(source, /action: 'DECK_SET'/);
  assert.match(source, /action: 'BASE_WEAPON_SELECT'/);
  assert.doesNotMatch(source, /fetch\(/);
});

test('account recruitment uses the server result and does not run a second local duplicate-growth transaction', async () => {
  const source = await readSource('../src/active-meta-progression.ts');

  assert.match(source, /mutateAuthenticatedAccountRecruitment\(\{/);
  assert.match(source, /parseAccountRecruitmentResult\(response\.result, banner\.id, pullCount, duplicatePolicy\)/);
  assert.match(source, /duplicateResolution !== 'PLUS' && duplicateResolution !== 'DISMANTLE'/);
  assert.match(source, /spentBetween\(before, progress\)/);
  assert.doesNotMatch(source, /performGuestRecruitmentWithDuplicateGrowth/);
  assert.doesNotMatch(source, /applyDuplicateGrowth/);
});

test('growth, recruitment, deck, and base-weapon scenes load the active authority and never call guest mutation APIs directly', async () => {
  const [growth, recruitment, deck, baseWeapon] = await Promise.all([
    readSource('../src/growth-scene.ts'),
    readSource('../src/recruitment-scene.ts'),
    readSource('../src/deck-scene.ts'),
    readSource('../src/base-weapon-scene.ts'),
  ]);

  for (const source of [growth, recruitment, deck, baseWeapon]) {
    assert.match(source, /loadActiveProgress/);
  }

  assert.match(growth, /recordActiveCharacterLevel/);
  assert.match(growth, /recordActiveCharacterPlusLevel/);
  assert.match(growth, /recordActiveEvolutionUnlock/);
  assert.match(growth, /selectActiveEvolutionForm/);
  assert.doesNotMatch(growth, /recordGuestCharacterLevel\(/);
  assert.doesNotMatch(growth, /recordGuestCharacterPlusLevel\(/);
  assert.doesNotMatch(growth, /recordGuestEvolutionUnlock\(/);
  assert.doesNotMatch(growth, /selectGuestEvolutionForm\(/);

  assert.match(recruitment, /performActiveRecruitment/);
  assert.doesNotMatch(recruitment, /performGuestRecruitment\(/);
  assert.doesNotMatch(recruitment, /saveGuestProgress/);

  assert.match(deck, /recordActiveDeck/);
  assert.match(deck, /resetActiveDeckToAutomatic/);
  assert.doesNotMatch(deck, /recordGuestDeck\(/);
  assert.doesNotMatch(deck, /resetGuestDeckToAutomatic\(/);

  assert.match(baseWeapon, /selectActiveBaseWeapon/);
  assert.doesNotMatch(baseWeapon, /selectGuestBaseWeapon\(/);
});

test('account auto formation persists a concrete owned ten-slot snapshot instead of inventing a new save-schema mode', async () => {
  const source = await readSource('../src/active-meta-progression.ts');

  assert.match(source, /getOwnedCharacterIds\(before\)\.slice\(0, MAX_DECK_SLOTS\)/);
  assert.match(source, /action: 'DECK_SET'/);
  assert.doesNotMatch(source, /autoDeckMode|automaticDeckMode|deckMode/);
});
