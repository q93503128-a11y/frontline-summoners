import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getServerCoopLoadout } from '../src/runtime-content.ts';
import {
  ACCOUNT_PROGRESSION_SCHEMA_VERSION,
  buildAuthoritativeCoopLoadout,
  createInitialAccountProgression,
  getAccountOwnedCharacterIds,
  normalizeAccountProgressionSnapshot,
} from '../src/progression-authority.ts';

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: ACCOUNT_PROGRESSION_SCHEMA_VERSION,
    clearedStageIds: [],
    normalClearSourceByStage: {},
    specialClearedStageIds: [],
    permanentRewardIds: [],
    discoveredEnemyIds: [],
    ownedRecruitmentCharacterIds: [],
    characterProgressById: {},
    deckSlotIds: ['militia'],
    ...overrides,
  };
}

test('new server account progression starts from the canonical starter only', () => {
  const initial = createInitialAccountProgression();
  assert.deepEqual(initial.clearedStageIds, []);
  assert.deepEqual(initial.deckSlotIds, ['militia']);
  assert.deepEqual(getAccountOwnedCharacterIds(initial), ['militia']);
  assert.equal(initial.characterProgressById.militia?.level, 1);
  assert.equal(initial.characterProgressById.militia?.plusLevel, 0);
});

test('main progression must be a contiguous prefix and grants story ownership from stage unlocks', () => {
  const normalized = normalizeAccountProgressionSnapshot(snapshot({
    clearedStageIds: ['main_01_001', 'main_01_002'],
    normalClearSourceByStage: {
      main_01_001: 'SOLO_BATTLE',
      main_01_002: 'COOP_BATTLE',
    },
    permanentRewardIds: ['wind-badge', 'barefoot-ribbon'],
    deckSlotIds: ['militia', 'guard', 'hunter'],
  }));
  assert.deepEqual(getAccountOwnedCharacterIds(normalized), ['militia', 'guard', 'hunter']);
  assert.equal(normalized.characterProgressById.guard?.level, 1);
  assert.throws(() => normalizeAccountProgressionSnapshot(snapshot({
    clearedStageIds: ['main_01_002'],
    permanentRewardIds: ['barefoot-ribbon'],
  })), /contiguous prefix/);
});

test('server progression cannot claim a later guaranteed permanent reward before clearing its stage', () => {
  assert.throws(() => normalizeAccountProgressionSnapshot(snapshot({
    permanentRewardIds: ['rust-nail'],
  })), /ahead of progression/);
  assert.throws(() => normalizeAccountProgressionSnapshot(snapshot({
    clearedStageIds: ['main_01_001'],
    normalClearSourceByStage: { main_01_001: 'SOLO_BATTLE' },
    permanentRewardIds: [],
  })), /missing guaranteed permanent reward/);
});

test('SPECIAL clear authority remains locked behind main_01_020 NORMAL_CLEAR', () => {
  assert.throws(() => normalizeAccountProgressionSnapshot(snapshot({
    specialClearedStageIds: ['special-01'],
  })), /require main_01_020/);
});

test('server progression rejects unknown discovery, unowned deck slots and future schemas', () => {
  assert.throws(() => normalizeAccountProgressionSnapshot(snapshot({ discoveredEnemyIds: ['enemy-does-not-exist'] })), /unknown account enemy discovery/);
  assert.throws(() => normalizeAccountProgressionSnapshot(snapshot({ deckSlotIds: ['char_s01_mireille'] })), /unowned character/);
  assert.throws(() => normalizeAccountProgressionSnapshot({ ...snapshot(), schemaVersion: 99 }), /unsupported account progression schema/);
});

test('authoritative co-op loadout is derived from stored ownership, level, plus and selected form', () => {
  const progression = normalizeAccountProgressionSnapshot(snapshot({
    ownedRecruitmentCharacterIds: ['char_s01_mireille'],
    characterProgressById: {
      char_s01_mireille: {
        level: 30,
        plusLevel: 10,
        unlockedFormIds: ['char_s01_mireille_f1', 'char_s01_mireille_f2', 'char_s01_mireille_f3'],
        selectedFormId: 'char_s01_mireille_f3',
      },
    },
    deckSlotIds: ['militia', 'char_s01_mireille'],
  }));
  const loadout = buildAuthoritativeCoopLoadout(progression, ['char_s01_mireille']);
  assert.deepEqual(loadout.characters, [{
    characterId: 'char_s01_mireille',
    level: 30,
    plusLevel: 10,
    selectedFormId: 'char_s01_mireille_f3',
  }]);
  const resolved = getServerCoopLoadout(loadout).playerSlots[0]!;
  const base = getServerCoopLoadout(buildAuthoritativeCoopLoadout(createInitialAccountProgression(), ['militia'])).playerSlots[0]!;
  assert.ok(resolved.definition.maxHp > base.definition.maxHp);
  assert.ok(resolved.definition.attackDamage > base.definition.attackDamage);
  assert.ok(resolved.definition.standingRange > 0);
});

test('authoritative co-op selection cannot request a character absent from the server snapshot', () => {
  assert.throws(() => buildAuthoritativeCoopLoadout(createInitialAccountProgression(), ['char_s01_mireille']), /unowned/);
});

test('selected evolution form must be both owned by the character and unlocked in the snapshot', () => {
  assert.throws(() => normalizeAccountProgressionSnapshot(snapshot({
    ownedRecruitmentCharacterIds: ['char_s01_mireille'],
    characterProgressById: {
      char_s01_mireille: {
        level: 1,
        plusLevel: 0,
        unlockedFormIds: ['char_s01_mireille_f1'],
        selectedFormId: 'char_s01_mireille_f3',
      },
    },
  })), /selected form is not unlocked/);
});

test('D1 migration introduces one revisioned authoritative progression row per account', async () => {
  const sql = await readFile(new URL('../migrations/0002_account_progression.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_progression_saves/);
  assert.match(sql, /user_id TEXT PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /revision INTEGER NOT NULL DEFAULT 0 CHECK \(revision >= 0\)/);
  assert.match(sql, /snapshot_json TEXT NOT NULL/);
});
