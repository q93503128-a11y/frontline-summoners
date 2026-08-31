import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('guest to account profile import is explicit and sends loadout preference only', async () => {
  const scene = await readSource('../src/account-scene.ts');
  assert.match(scene, /'게스트 프로필 가져오기'/);
  assert.match(scene, /loadGuestProgress\(\)/);
  assert.match(scene, /loadGuestAchievementProfile\(guestProgress\)/);
  assert.match(scene, /mutateAuthenticatedAccountProfile\(\{\s*requestId: newRequestId\(\),\s*profileLoadout: guestProfile\.profileLoadout/s);
  const mutationBlock = scene.slice(scene.indexOf('private async importGuestProfilePreferences'), scene.indexOf('private async refresh'));
  assert.doesNotMatch(mutationBlock, /claimedAchievementIds|ownedCosmeticIds|factIds|pvpBestTier/);
  assert.match(scene, /서버 미해금 장식과 로컬 업적 소유권은 이전하지 않았습니다/);
});

test('profile authority stays separate from combat save v2 revision surface', async () => {
  const [profileAuthority, saveAuthority] = await Promise.all([
    readSource('../../server/src/account-profile-authority.ts'),
    readSource('../../server/src/account-save-authority.ts'),
  ]);
  assert.match(profileAuthority, /account_profiles/);
  assert.match(profileAuthority, /account_profile_mutation_receipts/);
  assert.doesNotMatch(profileAuthority, /UPDATE account_saves/);
  assert.match(saveAuthority, /ACCOUNT_SAVE_SCHEMA_VERSION = 2/);
});
