import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { COOP_QUICK_MESSAGE_IDS, COOP_QUICK_MESSAGE_LABELS } from '@frontline/shared';
import { createInitialAccountSave } from '../src/account-save-authority.ts';
import { __accountCoopTestOnly } from '../src/account-coop-authority.ts';

test('social graph migration stores relationships and invites without persisting coop join tokens', async () => {
  const sql = await readFile(new URL('../migrations/0011_social_graph.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS social_profiles/);
  assert.match(sql, /friend_code TEXT NOT NULL UNIQUE/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS social_friend_requests/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS social_friendships/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS social_blocks/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS social_recent_players/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS social_coop_invites/);
  assert.match(sql, /status IN \('PENDING','ACCEPTED','DECLINED','CANCELLED'\)/);
  assert.doesNotMatch(sql, /join_token|joinToken/i);
});

test('canonical quick communication contains exactly the eight authored phrases', () => {
  assert.deepEqual(COOP_QUICK_MESSAGE_IDS, ['READY', 'SUPPLY_UP', 'FRONTLINE', 'BACKLINE', 'BASE_WEAPON', 'DANGER', 'WAIT', 'NICE']);
  assert.deepEqual(COOP_QUICK_MESSAGE_IDS.map((id) => COOP_QUICK_MESSAGE_LABELS[id]), [
    '준비됐어', '보급 올릴게', '전열 부탁', '후열 부탁', '병기 쓸게', '위험!', '기다려', '좋아!',
  ]);
});

test('account coop loadout is rebuilt from account deck and account character growth', () => {
  const initial = createInitialAccountSave();
  const built = __accountCoopTestOnly.buildAccountCoopLoadout(initial);
  assert.deepEqual(built.characters.map((entry) => entry.characterId), initial.deckSlotIds.slice(0, 5));
  assert.deepEqual(built.permanentRewardIds, initial.permanentRewardIds);
  assert.deepEqual(built.clearedStageIds, initial.clearedStageIds);
});

test('worker actually routes authenticated social HTTP before anonymous match creation', async () => {
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /import \{ resolveSocialHttp \} from '\.\/social-http\.ts'/);
  assert.match(source, /const socialHttpResult = await resolveSocialHttp\(request, env\)/);
  assert.match(source, /if \(socialHttpResult\)/);
});

test('all authenticated social requests refresh presence ttl', async () => {
  const source = await readFile(new URL('../src/social-http.ts', import.meta.url), 'utf8');
  assert.match(source, /touchSocialPresence/);
  assert.match(source, /await touchSocialPresence\(env\.DB, principal\.userId, nowMs\)/);
});

test('friend coop room binds accounts, rate-limits quick messages, tracks reconnect and settles server rewards', async () => {
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /seatAccountIds: Record<CoopSeatId, string \| null>/);
  assert.match(source, /matchKind: 'CODE' \| 'FRIEND'/);
  assert.match(source, /getAccountCoopSeatAuthority\(this\.env\.DB, accountId, record\.room\.stageId\)/);
  assert.match(source, /if \(!accountId\) getServerCoopLoadout\(loadout\)/);
  assert.match(source, /QUICK_MESSAGE_COOLDOWN_MS = 900/);
  assert.match(source, /QUICK_MESSAGE_BURST_MAX = 4/);
  assert.match(source, /isEitherSocialBlocked\(this\.env\.DB, senderAccountId, receiverAccountId\)/);
  assert.match(source, /record\.reconnectedSeats\[seatId\] = true/);
  assert.match(source, /settleAuthenticatedCoopWin\(/);
  assert.match(source, /recordRecentCoopPlayers\(/);
});

test('authenticated coop records only enemies actually present in authoritative snapshots and persists them on win or loss', async () => {
  const roomSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const authoritySource = await readFile(new URL('../src/account-coop-authority.ts', import.meta.url), 'utf8');
  assert.match(roomSource, /encounteredEnemyIds\?: string\[\]/);
  assert.match(roomSource, /private recordEncounteredEnemies/);
  assert.match(roomSource, /if \(unit\.team === 'ENEMY'\) encountered\.add\(unit\.definitionId\)/);
  assert.match(roomSource, /this\.recordEncounteredEnemies\(record, applied\.snapshot\)/);
  assert.match(roomSource, /settleAuthenticatedCoopDiscoveries\(this\.env\.DB, accountId, discoveredEnemyIds\)/);
  assert.match(roomSource, /discoveredEnemyIds,/);
  assert.match(authoritySource, /applyAccountEnemyDiscoveries/);
  assert.match(authoritySource, /discoveredEnemyIds,/);
  assert.match(authoritySource, /source: 'COOP_BATTLE'/);
});

test('friend and reconnect achievement facts are server-derived from authenticated coop settlement', async () => {
  const source = await readFile(new URL('../src/account-coop-authority.ts', import.meta.url), 'utf8');
  assert.match(source, /source: 'COOP_BATTLE'/);
  assert.match(source, /recordAccountAchievementFact\(db, accountId, 'coop_friend_first'/);
  assert.match(source, /recordAccountAchievementFact\(db, accountId, 'coop_reconnected_win'/);
  assert.match(source, /battleStartedAtMs/);
  assert.match(source, /availabilityAtMs/);
});

test('blocking removes friendship, pending requests and direct invites', async () => {
  const source = await readFile(new URL('../src/social-authority.ts', import.meta.url), 'utf8');
  const start = source.indexOf('export async function blockSocialUser');
  const end = source.indexOf('export async function unblockSocialUser');
  const block = source.slice(start, end);
  assert.match(block, /INSERT OR IGNORE INTO social_blocks/);
  assert.match(block, /DELETE FROM social_friendships/);
  assert.match(block, /DELETE FROM social_friend_requests/);
  assert.match(block, /UPDATE social_coop_invites SET status = 'CANCELLED'/);
});

test('authenticated friend invite never returns seat token by friend code alone', async () => {
  const source = await readFile(new URL('../src/social-http.ts', import.meta.url), 'utf8');
  assert.match(source, /resolveAuthSession\(env\.DB, request\.headers\.get\('authorization'\), nowMs\)/);
  assert.match(source, /getPendingCoopInviteForInvitee/);
  assert.match(source, /https:\/\/battle-room\.internal\/seat-token/);
  assert.match(source, /body: JSON\.stringify\(\{ seatId: 'B', accountId: userId \}\)/);
  assert.doesNotMatch(source, /social_coop_invites[^\n]*joinToken/);
});

test('authenticated co-op persists combat hidden facts for the owning seat on wins or losses', async () => {
  const [roomSource, authoritySource] = await Promise.all([
    readSource('../src/index.ts'),
    readSource('../src/account-coop-authority.ts'),
  ]);
  assert.match(roomSource, /combatQuirkFactIdsBySeat\?: Record<CoopSeatId, CombatQuirkFactId\[\]>/);
  assert.match(roomSource, /recordCombatQuirkFacts\(record, applied\.quirkFactsBySeat\)/);
  assert.match(roomSource, /record\.combatQuirkFactIdsBySeat\?\.\[seatId\] \?\? \[\]/);
  assert.match(roomSource, /await settleAuthenticatedCoopCombatFacts\(/);
  assert.match(authoritySource, /COMBAT_QUIRK_FACT_IDS/);
  assert.match(authoritySource, /recordAccountAchievementFact\(db, accountId, factId, nowMs\)/);
});
