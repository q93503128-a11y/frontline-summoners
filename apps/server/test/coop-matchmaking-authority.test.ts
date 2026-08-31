import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __coopMatchmakingHttpTestOnly } from '../src/coop-matchmaking-http.ts';

const row = {
  user_id: 'user-a',
  stage_id: 'main_01_001',
  state: 'QUEUED' as const,
  queued_at: 100,
  expires_at: 280,
  match_id: null,
  seat_id: null,
  paired_at: null,
};

test('public coop queue response exposes no account id or join token', () => {
  assert.deepEqual(__coopMatchmakingHttpTestOnly.queueBody(row), {
    state: 'QUEUED',
    stageId: 'main_01_001',
    queuedAtMs: 100000,
    expiresAtMs: 280000,
  });
});

test('public coop matchmaking migration enforces queue pairing state and unique match seats', async () => {
  const sql = await readFile(new URL('../migrations/0013_public_coop_matchmaking.sql', import.meta.url), 'utf8');
  assert.match(sql, /state IN \('QUEUED','PAIRING','MATCHED'\)/);
  assert.match(sql, /PRIMARY KEY REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /idx_coop_matchmaking_stage_queue/);
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS idx_coop_matchmaking_match_seat/);
  assert.doesNotMatch(sql, /join_token|host_token|guest_token/i);
});

test('matchmaking authority uses same-stage CAS pairing and excludes both-direction blocks', async () => {
  const source = await readFile(new URL('../src/coop-matchmaking-authority.ts', import.meta.url), 'utf8');
  assert.match(source, /q\.stage_id = \?1/);
  assert.match(source, /b\.blocker_id = \?2 AND b\.blocked_id = q\.user_id/);
  assert.match(source, /b\.blocker_id = q\.user_id AND b\.blocked_id = \?2/);
  assert.match(source, /SET state = 'PAIRING'/);
  assert.match(source, /claimedA === 1 && claimedB === 1/);
  assert.match(source, /SET state = 'MATCHED'/);
  assert.match(source, /SET state = 'QUEUED'.*match_id = NULL/s);
});

test('matchmaking HTTP revalidates both accounts and keeps tokens inside BattleRoom', async () => {
  const source = await readFile(new URL('../src/coop-matchmaking-http.ts', import.meta.url), 'utf8');
  assert.match(source, /getAccountCoopSeatAuthority\(env\.DB, accountId, stageId, nowMs\)/);
  assert.match(source, /getAccountCoopSeatAuthority\(env\.DB, candidateId, stageId, nowMs\)/);
  assert.match(source, /joinTokens: \{ A: hostToken, B: guestToken \}/);
  assert.match(source, /seatAccountIds: \{ A: pair\.accountA, B: pair\.accountB \}/);
  assert.match(source, /battle-room\.internal\/seat-token/);
  assert.doesNotMatch(source, /INSERT[^\n]*joinToken|INSERT[^\n]*hostToken|INSERT[^\n]*guestToken/i);
});

test('worker entry routes matchmaking before legacy worker fallback', async () => {
  const source = await readFile(new URL('../src/entry.ts', import.meta.url), 'utf8');
  assert.match(source, /resolveCoopMatchmakingHttp/);
  assert.match(source, /const matchmaking = await resolveCoopMatchmakingHttp\(request, env\)/);
  assert.match(source, /if \(matchmaking\) return json/);
});
