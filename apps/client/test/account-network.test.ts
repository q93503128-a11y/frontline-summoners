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

test('trusted battle transport parsers require server-derived terminal fields and revisioned claims', () => {
  const start = __accountNetworkTestOnly.parseTrustedBattleStart({
    battleId: 'battle-1', kind: 'MAIN', targetId: 'main_01_001', startRevision: 7, initialStateHash: 'abc123', expiresAtMs: 123456,
  });
  assert.equal(start?.startRevision, 7);
  const completion = __accountNetworkTestOnly.parseTrustedBattleCompletion({
    battleId: 'battle-1', kind: 'MAIN', targetId: 'main_01_001', winner: 'PLAYER', clearFrames: 1234,
    finalStateHash: 'deadbeef', playerBaseHp: 900, enemyBaseHp: 0, completedAtMs: 123456,
  });
  assert.equal(completion?.winner, 'PLAYER');
  assert.equal(__accountNetworkTestOnly.parseTrustedBattleCompletion({
    battleId: 'battle-1', kind: 'MAIN', targetId: 'main_01_001', winner: 'FORGED', clearFrames: 1,
    finalStateHash: 'x', playerBaseHp: 1, enemyBaseHp: 0, completedAtMs: 1,
  }), null);
  const claim = __accountNetworkTestOnly.parseTrustedBattleClaimResponse({
    replayed: false, awarded: true, completion, revision: 8, schemaVersion: 2, snapshot: { schemaVersion: 2 }, result: { firstClear: true },
  });
  assert.equal(claim?.revision, 8);
  assert.equal(claim?.awarded, true);
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
  assert.match(source, /async function handleOnlineActionError/);
  assert.match(source, /error instanceof AccountRevisionConflictError[\s\S]*await refreshAuthenticatedAccount\(\)[\s\S]*throw error/);
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

test('trusted battle client sends only target or command log and derives claim revision locally', async () => {
  const source = await readFile(new URL('../src/account-network.ts', import.meta.url), 'utf8');
  assert.match(source, /\/api\/account\/battles\/start/);
  assert.match(source, /JSON\.stringify\(\{ kind, targetId \}\)/);
  assert.match(source, /\/api\/account\/battles\/complete/);
  assert.match(source, /JSON\.stringify\(\{ battleId, commands \}\)/);
  assert.match(source, /\/api\/account\/battles\/claim/);
  assert.match(source, /JSON\.stringify\(\{ battleId, expectedRevision \}\)/);
  assert.match(source, /result\.startRevision !== localRevision/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{[^}]*winner|JSON\.stringify\(\{[^}]*clearFrames|JSON\.stringify\(\{[^}]*reward/);
});
