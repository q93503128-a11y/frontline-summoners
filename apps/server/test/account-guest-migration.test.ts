import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ACCOUNT_GUEST_REPLACE_CONFIRMATION,
  __accountGuestMigrationTestOnly,
} from '../src/account-guest-migration-authority.ts';
import { createInitialAccountSave, type AccountSaveRecord } from '../src/account-save-authority.ts';

const NOW = Date.parse('2026-08-31T01:00:00Z');
const initial = createInitialAccountSave();

function guestSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    clearedStageIds: initial.clearedStageIds,
    normalClearSourceByStage: initial.normalClearSourceByStage,
    mainRewardedStageIds: initial.mainRewardedStageIds,
    specialClearedStageIds: initial.specialClearedStageIds,
    permanentRewardIds: initial.permanentRewardIds,
    discoveredEnemyIds: initial.discoveredEnemyIds,
    ownedRecruitmentCharacterIds: initial.ownedRecruitmentCharacterIds,
    characterProgressById: initial.characterProgressById,
    deckSlotIds: initial.deckSlotIds,
    selectedBaseWeaponId: initial.selectedBaseWeaponId,
    resourceLedgerById: initial.resourceLedgerById,
    periodicRewardChargeByCollection: initial.periodicRewardChargeByCollection,
    recordModeProgress: initial.recordModeProgress,
    ...overrides,
  };
}

test('guest v15 progress maps through strict account save authority without minting or dropping core fields', () => {
  const mapped = __accountGuestMigrationTestOnly.mapGuestProgressToAccountSave(guestSnapshot({
    characterProgressById: {
      militia: {
        ...initial.characterProgressById.militia,
        level: 7,
        plusLevel: 2,
      },
    },
    resourceLedgerById: { gold: { earned: 500, spent: 125 } },
    recordModeProgress: {
      endlessBestTimeMs: 120_000,
      endlessBestReachedMinute: 2,
      endlessRewardedMinute: 2,
      bossRushBestDefeated: 0,
      bossRushRewardedDefeated: 0,
    },
  }), NOW);
  assert.equal(mapped.characterProgressById.militia?.level, 7);
  assert.equal(mapped.characterProgressById.militia?.plusLevel, 2);
  assert.deepEqual(mapped.resourceLedgerById.gold, { earned: 500, spent: 125 });
  assert.equal(mapped.recordModeProgress.endlessBestReachedMinute, 2);
  assert.equal(mapped.selectedBaseWeaponId, 'base_weapon_front_cannon');
});

test('guest migration mapping rejects impossible local ledgers instead of weakening server validation', () => {
  assert.throws(() => __accountGuestMigrationTestOnly.mapGuestProgressToAccountSave(guestSnapshot({
    resourceLedgerById: { gold: { earned: 10, spent: 11 } },
  }), NOW), /spent exceeds earned/);
});

test('only untouched revision-zero canonical account save counts as empty migration target', () => {
  const record: AccountSaveRecord = { accountId: 'acct', revision: 0, snapshot: initial, updatedAt: 0 };
  assert.equal(__accountGuestMigrationTestOnly.isPristineAccountSave(record), true);
  assert.equal(__accountGuestMigrationTestOnly.isPristineAccountSave({ ...record, revision: 1 }), false);
  assert.equal(__accountGuestMigrationTestOnly.isPristineAccountSave({
    ...record,
    snapshot: { ...initial, resourceLedgerById: { gold: { earned: 1, spent: 0 } } },
  }), false);
});

test('migration summary exposes comparable progression without leaking raw account identity', () => {
  const summary = __accountGuestMigrationTestOnly.summarizeAccountProgress({
    ...initial,
    resourceLedgerById: { gold: { earned: 200, spent: 50 }, summon_crystal: { earned: 20, spent: 5 } },
  });
  assert.equal(summary.mainClearCount, 0);
  assert.equal(summary.ownedCharacterCount, 1);
  assert.deepEqual(summary.resourceBalances, { gold: 150, summon_crystal: 15 });
  assert.equal('accountId' in summary, false);
});

test('guest replacement requires explicit destructive confirmation and migration SQL archives both save and profile', async () => {
  assert.equal(ACCOUNT_GUEST_REPLACE_CONFIRMATION, 'REPLACE_SERVER_PROGRESS');
  const [authority, sql, entry, wrangler] = await Promise.all([
    readFile(new URL('../src/account-guest-migration-authority.ts', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/0010_guest_account_migrations.sql', import.meta.url), 'utf8'),
    readFile(new URL('../src/entry.ts', import.meta.url), 'utf8'),
    readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
  ]);
  assert.match(authority, /REPLACE_EXISTING/);
  assert.match(authority, /replacement requires explicit confirmation/);
  assert.match(authority, /db\.batch\(\[/);
  assert.match(authority, /UPDATE account_saves/);
  assert.match(authority, /UPDATE account_profiles/);
  assert.match(authority, /INSERT INTO account_guest_migrations/);
  assert.match(authority, /rollbackGuestAccountMigration/);
  assert.match(sql, /previous_snapshot_json TEXT NOT NULL/);
  assert.match(sql, /previous_profile_snapshot_json TEXT NOT NULL/);
  assert.match(sql, /restored_at INTEGER/);
  assert.match(entry, /resolveGuestMigrationHttp/);
  assert.match(entry, /return worker\.fetch\(request, env\)/);
  assert.match(wrangler, /"main": "src\/entry\.ts"/);
});
