import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createInitialAccountSave, type AccountSaveSnapshotV2 } from '../src/account-save-authority.ts';
import {
  ACCOUNT_PROFILE_SCHEMA_VERSION,
  __accountProfileTestOnly,
  createInitialAccountProfile,
} from '../src/account-profile-authority.ts';
import { __accountHttpTestOnly } from '../src/account-http.ts';

function save(overrides: Partial<AccountSaveSnapshotV2> = {}): AccountSaveSnapshotV2 {
  return { ...createInitialAccountSave(), ...overrides };
}

test('fresh account profile derives only defaults and no fabricated achievement ownership', () => {
  const initial = createInitialAccountProfile(save());
  assert.equal(initial.schemaVersion, ACCOUNT_PROFILE_SCHEMA_VERSION);
  assert.deepEqual(initial.claimedAchievementIds, []);
  assert.deepEqual(initial.ownedCosmeticIds.sort(), ['banner_default_frontline', 'emblem_default', 'frame_default_wood'].sort());
  assert.equal(initial.profileLoadout.frameId, 'frame_default_wood');
  assert.equal(initial.profileLoadout.bannerId, 'banner_default_frontline');
  assert.equal(initial.profileLoadout.emblemId, 'emblem_default');
});

test('account MAIN progression auto-claims matching cosmetic achievement on the server', () => {
  const account = save({ clearedStageIds: ['main_01_020'] });
  const normalized = __accountProfileTestOnly.normalizeAccountProfileSnapshot(undefined, account);
  assert.equal(normalized.evaluations.find((entry) => entry.achievementId === 'ach_main_c1')?.complete, true);
  assert.ok(normalized.snapshot.claimedAchievementIds.includes('ach_main_c1'));
  assert.ok(normalized.snapshot.ownedCosmeticIds.includes('title_border_breaker'));
  assert.ok(normalized.snapshot.ownedCosmeticIds.includes('frame_border_iron'));
});

test('stored or client-forged known cosmetics are discarded unless backed by a server claim', () => {
  const normalized = __accountProfileTestOnly.normalizeAccountProfileSnapshot({
    schemaVersion: 1,
    claimedAchievementIds: [],
    ownedCosmeticIds: ['frame_pvp_master', 'badge_boss_8'],
    profileLoadout: {
      frameId: 'frame_pvp_master',
      bannerId: 'banner_default_frontline',
      emblemId: 'emblem_default',
      badgeIds: ['badge_boss_8'],
    },
    factIds: [],
  }, save());
  assert.ok(!normalized.snapshot.ownedCosmeticIds.includes('frame_pvp_master'));
  assert.ok(!normalized.snapshot.ownedCosmeticIds.includes('badge_boss_8'));
  assert.equal(normalized.snapshot.profileLoadout.frameId, 'frame_default_wood');
  assert.deepEqual(normalized.snapshot.profileLoadout.badgeIds, []);
});

test('server achievement input derives co-op, growth and record axes from account save instead of client facts', () => {
  const initial = createInitialAccountSave();
  const militia = initial.characterProgressById.militia!;
  const account = save({
    normalClearSourceByStage: { main_01_001: 'COOP_BATTLE', main_01_002: 'SOLO_BATTLE' },
    characterProgressById: { ...initial.characterProgressById, militia: { ...militia, level: 50, plusLevel: 50 } },
    recordModeProgress: {
      endlessBestTimeMs: 600_000,
      endlessBestReachedMinute: 10,
      endlessRewardedMinute: 10,
      bossRushBestDefeated: 8,
      bossRushRewardedDefeated: 8,
    },
  });
  const input = __accountProfileTestOnly.buildAccountAchievementEvaluationInput(account);
  assert.equal(input.maxCharacterLevel, 50);
  assert.equal(input.maxCharacterPlusLevel, 50);
  assert.deepEqual(input.coopClearedStageIds, ['main_01_001']);
  assert.equal(input.endlessBestReachedMinute, 10);
  assert.equal(input.bossRushBestDefeated, 8);
  assert.deepEqual(input.factIds, []);
  assert.equal(input.pvpBestTier, undefined);
});

test('public profile mutation parser accepts only loadout preference and cannot self-report claims, facts or PvP tier', () => {
  const parsed = __accountHttpTestOnly.parseProfileMutation({
    requestId: 'profile-1',
    expectedRevision: 2,
    profileLoadout: {
      portraitCharacterId: 'militia',
      titleId: 'title_border_breaker',
      frameId: 'frame_border_iron',
      bannerId: 'banner_default_frontline',
      emblemId: 'emblem_default',
      badgeIds: [],
    },
    claimedAchievementIds: ['ach_main_80'],
    factIds: ['quirk_turnip_five'],
    pvpBestTier: 'MASTER',
  });
  assert.equal(parsed.requestId, 'profile-1');
  assert.equal(parsed.expectedRevision, 2);
  assert.deepEqual(Object.keys(parsed).sort(), ['expectedRevision', 'profileLoadout', 'requestId'].sort());
});

test('account profile D1 migration has independent revision and idempotency receipt authority', async () => {
  const sql = await readFile(new URL('../migrations/0009_account_profile_authority.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_profiles/);
  assert.match(sql, /user_id TEXT PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /schema_version INTEGER NOT NULL CHECK \(schema_version = 1\)/);
  assert.match(sql, /revision INTEGER NOT NULL DEFAULT 0 CHECK \(revision >= 0\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_profile_mutation_receipts/);
  assert.match(sql, /PRIMARY KEY \(user_id, request_id\)/);
});

test('profile mutation source uses profile-local CAS and receipt batch instead of account save revision', async () => {
  const source = await readFile(new URL('../src/account-profile-authority.ts', import.meta.url), 'utf8');
  assert.match(source, /UPDATE account_profiles/);
  assert.match(source, /CASE WHEN revision = \?3 THEN revision \+ 1 ELSE -1 END/);
  assert.match(source, /INSERT INTO account_profile_mutation_receipts/);
  assert.match(source, /db\.batch\(/);
  assert.doesNotMatch(source, /UPDATE account_saves/);
});
