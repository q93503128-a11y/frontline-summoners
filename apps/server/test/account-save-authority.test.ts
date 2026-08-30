import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createFullPeriodicRewardChargeMap } from '@frontline/sim/periodic-special';
import {
  ACCOUNT_SAVE_SCHEMA_VERSION,
  createInitialAccountSave,
  migrateAccountProgressionV1ToSaveV2,
  normalizeAccountSaveSnapshot,
} from '../src/account-save-authority.ts';
import { createInitialAccountProgression } from '../src/progression-authority.ts';

const NOW = Date.parse('2026-08-30T09:00:00Z');

function accountSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    ...createInitialAccountSave(),
    ...overrides,
  };
}

test('account save v2 starts with canonical server-owned economy and record defaults', () => {
  const initial = createInitialAccountSave();
  assert.equal(initial.schemaVersion, ACCOUNT_SAVE_SCHEMA_VERSION);
  assert.deepEqual(initial.deckSlotIds, ['militia']);
  assert.equal(initial.selectedBaseWeaponId, 'base_weapon_front_cannon');
  assert.deepEqual(initial.resourceLedgerById, {});
  assert.deepEqual(initial.recordModeProgress, {
    endlessBestTimeMs: 0,
    endlessBestReachedMinute: 0,
    endlessRewardedMinute: 0,
    bossRushBestDefeated: 0,
    bossRushRewardedDefeated: 0,
  });
  for (const state of Object.values(initial.periodicRewardChargeByCollection)) {
    assert.equal(state.charges, 4);
    assert.equal(state.nextChargeAtMs, null);
  }
});

test('legacy server progression migrates to v2 without inventing wallet value or duplicate first-clear eligibility', () => {
  const legacy = createInitialAccountProgression();
  const migrated = migrateAccountProgressionV1ToSaveV2(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.clearedStageIds, legacy.clearedStageIds);
  assert.deepEqual(migrated.characterProgressById, legacy.characterProgressById);
  assert.deepEqual(migrated.resourceLedgerById, {});
  assert.deepEqual(migrated.mainRewardedStageIds, legacy.clearedStageIds);
});

test('v2 rejects resource ledgers that could mint value or contain unknown currencies', () => {
  assert.throws(() => normalizeAccountSaveSnapshot(accountSnapshot({
    resourceLedgerById: { gold: { earned: 10, spent: 11 } },
  }), NOW), /spent exceeds earned/);
  assert.throws(() => normalizeAccountSaveSnapshot(accountSnapshot({
    resourceLedgerById: { premium_gem: { earned: 999, spent: 0 } },
  }), NOW), /unknown account meta resource/);
});

test('v2 requires a complete periodic charge map and refreshes elapsed charge time server-side', () => {
  const full = createFullPeriodicRewardChargeMap();
  const missing = { ...full } as Record<string, unknown>;
  delete missing.special_gold_convoy;
  assert.throws(() => normalizeAccountSaveSnapshot(accountSnapshot({
    periodicRewardChargeByCollection: missing,
  }), NOW), /missing collection:special_gold_convoy/);

  const normalized = normalizeAccountSaveSnapshot(accountSnapshot({
    periodicRewardChargeByCollection: {
      ...full,
      special_gold_convoy: { charges: 1, nextChargeAtMs: NOW - 24 * 60 * 60 * 1000 },
    },
  }), NOW);
  assert.equal(normalized.periodicRewardChargeByCollection.special_gold_convoy.charges, 4);
  assert.equal(normalized.periodicRewardChargeByCollection.special_gold_convoy.nextChargeAtMs, null);
});

test('v2 rejects forged record high-water and runtime-impossible boss scores', () => {
  assert.throws(() => normalizeAccountSaveSnapshot(accountSnapshot({
    recordModeProgress: {
      endlessBestTimeMs: 120_000,
      endlessBestReachedMinute: 1,
      endlessRewardedMinute: 1,
      bossRushBestDefeated: 0,
      bossRushRewardedDefeated: 0,
    },
  }), NOW), /reached minute must match best time/);
  assert.throws(() => normalizeAccountSaveSnapshot(accountSnapshot({
    recordModeProgress: {
      endlessBestTimeMs: 0,
      endlessBestReachedMinute: 0,
      endlessRewardedMinute: 0,
      bossRushBestDefeated: 10,
      bossRushRewardedDefeated: 0,
    },
  }), NOW), /best exceeds runtime boss count/);
  assert.throws(() => normalizeAccountSaveSnapshot(accountSnapshot({
    recordModeProgress: {
      endlessBestTimeMs: 60_000,
      endlessBestReachedMinute: 1,
      endlessRewardedMinute: 2,
      bossRushBestDefeated: 0,
      bossRushRewardedDefeated: 0,
    },
  }), NOW), /rewarded minute exceeds best reached minute/);
});

test('v2 refuses a base weapon selection that the account progression has not unlocked', () => {
  assert.throws(() => normalizeAccountSaveSnapshot(accountSnapshot({
    selectedBaseWeaponId: 'base_weapon_aegis_emitter',
  }), NOW), /base weapon is locked/);
  assert.throws(() => normalizeAccountSaveSnapshot(accountSnapshot({
    selectedBaseWeaponId: 'base_weapon_supply_drop',
  }), NOW), /base weapon is locked/);
});

test('future account save schemas are write-protected instead of silently truncated', () => {
  assert.throws(() => normalizeAccountSaveSnapshot({ ...accountSnapshot(), schemaVersion: 99 }, NOW), /unsupported account save schema:99/);
});

test('D1 migration adds one revisioned canonical account save row per account', async () => {
  const sql = await readFile(new URL('../migrations/0003_account_save_v2.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS account_saves/);
  assert.match(sql, /user_id TEXT PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /schema_version INTEGER NOT NULL CHECK \(schema_version = 2\)/);
  assert.match(sql, /revision INTEGER NOT NULL DEFAULT 0 CHECK \(revision >= 0\)/);
  assert.match(sql, /snapshot_json TEXT NOT NULL/);
});
