import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __accountNetworkTestOnly } from '../src/account-network.ts';

test('account remote save parser accepts only revisioned object snapshots', () => {
  assert.deepEqual(__accountNetworkTestOnly.parseRemoteSave({ revision: 3, schemaVersion: 2, snapshot: { schemaVersion: 2 } }), {
    revision: 3,
    schemaVersion: 2,
    snapshot: { schemaVersion: 2 },
  });
  assert.equal(__accountNetworkTestOnly.parseRemoteSave({ revision: -1, schemaVersion: 2, snapshot: {} }), null);
  assert.equal(__accountNetworkTestOnly.parseRemoteSave({ revision: 0, schemaVersion: 2, snapshot: [] }), null);
});

test('mutation response parser requires replay flag and exact server snapshot payload', () => {
  const parsed = __accountNetworkTestOnly.parseMutationResponse({
    replayed: false,
    revision: 4,
    schemaVersion: 2,
    snapshot: { schemaVersion: 2 },
    result: { action: 'DECK_SET' },
  });
  assert.equal(parsed?.revision, 4);
  assert.equal(parsed?.replayed, false);
  assert.deepEqual(parsed?.result, { action: 'DECK_SET' });
  assert.equal(__accountNetworkTestOnly.parseMutationResponse({ revision: 4, schemaVersion: 2, snapshot: {}, result: {} }), null);
});

test('authenticated client state follows canonical online/offline-cache/guest states without an offline mutation journal', async () => {
  const source = await readFile(new URL('../src/account-network.ts', import.meta.url), 'utf8');
  assert.match(source, /'GUEST_LOCAL'/);
  assert.match(source, /'AUTHENTICATED_ONLINE'/);
  assert.match(source, /'AUTHENTICATED_OFFLINE_CACHE'/);
  assert.match(source, /sessionStorage\.setItem\(SESSION_TOKEN_KEY/);
  assert.match(source, /sessionFingerprint/);
  assert.match(source, /localStorage\.setItem\(ACCOUNT_CACHE_KEY/);
  assert.match(source, /authorization.*Bearer/s);
  assert.match(source, /account mutation requires AUTHENTICATED_ONLINE state/);
  assert.match(source, /AccountRevisionConflictError/);
  assert.match(source, /await refreshAuthenticatedAccount\(\);\n      throw error;/);
  assert.doesNotMatch(source, /mutationJournal|offlineQueue|queuedMutation|retryMutation/);
  assert.doesNotMatch(source, /accountId/);
});

test('account mutations derive expectedRevision from current remote state rather than caller payload', async () => {
  const source = await readFile(new URL('../src/account-network.ts', import.meta.url), 'utf8');
  assert.match(source, /const expectedRevision = requireOnlineRevision\(\)/);
  assert.match(source, /JSON\.stringify\(\{ \.\.\.request, expectedRevision \}\)/);
  assert.match(source, /\/api\/account\/meta/);
  assert.match(source, /\/api\/account\/recruitment/);
  assert.match(source, /\/api\/account\/sweep/);
  assert.match(source, /\/api\/account\/logout/);
});
