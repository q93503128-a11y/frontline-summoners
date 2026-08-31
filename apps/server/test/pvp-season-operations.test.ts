import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __pvpSeasonOperationsTestOnly } from '../src/pvp-season-operations-authority.ts';
import { __pvpSeasonOperationsHttpTestOnly } from '../src/pvp-season-operations-http.ts';

test('season operation ids reject empty and overlong next-season ids', () => {
  assert.equal(__pvpSeasonOperationsTestOnly.nonEmptyId(' season_2 ', 'nextSeasonId'), 'season_2');
  assert.throws(() => __pvpSeasonOperationsTestOnly.nonEmptyId('   ', 'nextSeasonId'));
  assert.throws(() => __pvpSeasonOperationsTestOnly.nonEmptyId('x'.repeat(129), 'nextSeasonId'));
});

test('operations API is internal, bearer protected, and unavailable without a configured secret', () => {
  assert.equal(__pvpSeasonOperationsHttpTestOnly.BASE_PATH, '/api/internal/pvp-season-operations');
  const request = new Request('https://example.test/api/internal/pvp-season-operations', {
    headers: { authorization: `Bearer ${'a'.repeat(24)}` },
  });
  assert.equal(__pvpSeasonOperationsHttpTestOnly.authorized(request, { DB: {} as D1Database }), 'UNCONFIGURED');
  assert.equal(__pvpSeasonOperationsHttpTestOnly.authorized(request, { DB: {} as D1Database, PVP_OPERATIONS_TOKEN: 'b'.repeat(24) }), 'DENIED');
  assert.equal(__pvpSeasonOperationsHttpTestOnly.authorized(request, { DB: {} as D1Database, PVP_OPERATIONS_TOKEN: 'a'.repeat(24) }), 'OK');
});

test('D1 season latch encodes OPEN -> DRAINING -> CLOSED_PENDING_DEPLOY invariants', async () => {
  const sql = await readFile(new URL('../migrations/0020_pvp_season_operations.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE pvp_season_operations/);
  assert.match(sql, /'OPEN','DRAINING','CLOSED_PENDING_DEPLOY'/);
  assert.match(sql, /state = 'OPEN' AND queue_open = 1 AND next_season_id IS NULL/);
  assert.match(sql, /state = 'DRAINING' AND queue_open = 0 AND next_season_id IS NOT NULL/);
  assert.match(sql, /state = 'CLOSED_PENDING_DEPLOY' AND queue_open = 0 AND next_season_id IS NOT NULL/);
});

test('public 1v1 and 2v2 matchmaking both consult the season queue latch before admission', async () => {
  const oneVOne = await readFile(new URL('../src/pvp-http.ts', import.meta.url), 'utf8');
  const twoVTwo = await readFile(new URL('../src/pvp-2v2-http.ts', import.meta.url), 'utf8');
  assert.match(oneVOne, /await assertPvpPublicQueueAdmission\(env\.DB, nowMs\);[\s\S]*await enterPublicPvpQueue/);
  assert.match(twoVTwo, /await assertPvpPublicQueueAdmission\(env\.DB, nowMs\);[\s\S]*await enterPublicPvpQueue/);
  assert.match(oneVOne, /pvp_public_queue_closed_for_season_settlement/);
  assert.match(twoVTwo, /pvp_public_queue_closed_for_season_settlement/);
});

test('closure authority remains the only final-rank snapshot and soft-reset implementation', async () => {
  const operations = await readFile(new URL('../src/pvp-season-operations-authority.ts', import.meta.url), 'utf8');
  const season = await readFile(new URL('../src/pvp-season-authority.ts', import.meta.url), 'utf8');
  assert.match(operations, /finalizePvpSeason\(db, row\.season_id, row\.next_season_id, nowMs\)/);
  assert.match(operations, /rollClosedPvpSeasonToCurrent\(db, row\.season_id, nowMs\)/);
  assert.match(season, /ROW_NUMBER\(\) OVER \(ORDER BY mmr DESC, ranked_wins DESC, updated_at ASC, user_id ASC\)/);
  assert.match(season, /ROUND\(1000 \+ \(mmr - 1000\) \* 0\.60\)/);
  assert.match(season, /MIN\(1750/);
  assert.match(season, /MAX\(800/);
});

test('worker entry routes operations before public PvP season endpoints', async () => {
  const entry = await readFile(new URL('../src/entry.ts', import.meta.url), 'utf8');
  const operationsIndex = entry.indexOf('resolvePvpSeasonOperationsHttp(request, env)');
  const publicSeasonIndex = entry.indexOf('resolvePvpSeasonHttp(request, env)');
  assert.ok(operationsIndex >= 0);
  assert.ok(publicSeasonIndex > operationsIndex);
});
