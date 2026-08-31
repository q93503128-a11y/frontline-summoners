import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { COOP_QUICK_MESSAGE_IDS, COOP_QUICK_MESSAGE_LABELS } from '@frontline/shared';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main menu registers friends and account-bound friend coop scenes', async () => {
  const source = await readSource('../src/main.ts');
  assert.match(source, /'친구·초대'/);
  assert.match(source, /game\.scene\.add\('social', SocialScene/);
  assert.match(source, /game\.scene\.add\('friend-coop-lobby', FriendCoopLobbyScene/);
  assert.match(source, /game\.scene\.add\('friend-coop-battle', FriendCoopBattleScene/);
});

test('friend coop scenes use account progress and never import guest save persistence', async () => {
  const source = await readSource('../src/friend-coop-scenes.ts');
  assert.match(source, /getAuthenticatedCoopClientProgress/);
  assert.match(source, /accountCoopLoadout/);
  assert.match(source, /ACCOUNT_SETTLED/);
  assert.match(source, /refreshAuthenticatedAccount\(\)/);
  assert.doesNotMatch(source, /from '\.\/save'/);
  assert.doesNotMatch(source, /recordNormalStageClear|recordSpecialStageClear|recordGuestEnemyDiscoveries/);
});

test('quick communication UI exposes only the canonical eight fixed phrases', async () => {
  assert.equal(COOP_QUICK_MESSAGE_IDS.length, 8);
  assert.deepEqual(COOP_QUICK_MESSAGE_IDS.map((id) => COOP_QUICK_MESSAGE_LABELS[id]), [
    '준비됐어', '보급 올릴게', '전열 부탁', '후열 부탁', '병기 쓸게', '위험!', '기다려', '좋아!',
  ]);
  const source = await readSource('../src/friend-coop-scenes.ts');
  assert.match(source, /COOP_QUICK_MESSAGE_IDS\.forEach/);
  assert.match(source, /sendQuickMessage\(messageId\)/);
  assert.doesNotMatch(source, /chatInput|freeText|sendChat/);
});

test('social scene includes friend requests, direct coop invites, recent players and block management', async () => {
  const source = await readSource('../src/social-scene.ts');
  assert.match(source, /sendFriendRequest/);
  assert.match(source, /acceptFriendRequest/);
  assert.match(source, /createFriendCoopInvite/);
  assert.match(source, /acceptFriendCoopInvite/);
  assert.match(source, /recentPlayers/);
  assert.match(source, /blockSocialUser/);
  assert.match(source, /unblockSocialUser/);
  assert.match(source, /친구 코드는 계정 식별용 · 자유 채팅 없음 · 차단 우선/);
});

test('social transport requires authenticated online state before reading bearer session', async () => {
  const source = await readSource('../src/social-network.ts');
  assert.match(source, /getAccountClientState\(\)\.kind !== 'AUTHENTICATED_ONLINE'/);
  assert.match(source, /headers\.set\('authorization', `Bearer \$\{token\}`\)/);
  assert.match(source, /response\.status === 401/);
  assert.match(source, /refreshAuthenticatedAccount\(\)/);
});
