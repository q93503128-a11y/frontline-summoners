import assert from 'node:assert/strict';
import test from 'node:test';
import { __pvpLeaderboardAuthorityTestOnly } from '../src/pvp-leaderboard-authority.ts';
import { __pvpLeaderboardHttpTestOnly } from '../src/pvp-leaderboard-http.ts';

test('leaderboard limit clamps public top queries to 1000', () => {
  assert.equal(__pvpLeaderboardAuthorityTestOnly.normalizeLimit(5000, 1000, 100), 1000);
  assert.equal(__pvpLeaderboardAuthorityTestOnly.normalizeLimit(-10, 1000, 100), 1);
  assert.equal(__pvpLeaderboardAuthorityTestOnly.normalizeLimit(Number.NaN, 1000, 100), 100);
});

test('leaderboard canonical ordering matches season final-rank ordering', () => {
  const sql = __pvpLeaderboardAuthorityTestOnly.rankedCte;
  assert.match(sql, /ROW_NUMBER\(\) OVER/);
  assert.match(sql, /r\.mmr DESC, r\.ranked_wins DESC, r\.updated_at ASC, r\.user_id ASC/);
  assert.match(sql, /placement_matches >= \?2/);
});

test('leaderboard row marks self without changing visible ranked values', () => {
  const view = __pvpLeaderboardAuthorityTestOnly.rowView({
    user_id: 'me',
    display_name: '지휘관 A',
    mmr: 1350,
    displayed_tier: 'PLATINUM',
    ranked_wins: 17,
    rank: 42,
  }, 'me');
  assert.equal(view.isSelf, true);
  assert.equal(view.rank, 42);
  assert.equal(view.mmr, 1350);
});

test('leaderboard HTTP view never exposes internal account ids', () => {
  const body = __pvpLeaderboardHttpTestOnly.publicView({
    seasonId: 'season_x',
    scope: 'TOP',
    selfRank: 1,
    totalPlayers: 1,
    entries: [{
      userId: 'private-account-id',
      displayName: '지휘관 A',
      mmr: 1500,
      displayedTier: 'DIAMOND',
      rankedWins: 20,
      rank: 1,
      isSelf: true,
    }],
  }) as { entries: Array<Record<string, unknown>> };
  assert.equal(Object.hasOwn(body.entries[0]!, 'userId'), false);
  assert.equal(body.entries[0]!.displayName, '지휘관 A');
});

test('leaderboard scope aliases accept top, around and friends only', () => {
  assert.equal(__pvpLeaderboardHttpTestOnly.scope(null), 'TOP');
  assert.equal(__pvpLeaderboardHttpTestOnly.scope('around'), 'AROUND_ME');
  assert.equal(__pvpLeaderboardHttpTestOnly.scope('friends'), 'FRIENDS');
  assert.equal(__pvpLeaderboardHttpTestOnly.scope('deck'), null);
});
