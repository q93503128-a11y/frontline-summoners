import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __accountProfileNetworkTestOnly } from '../src/account-profile-network.ts';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('account profile parser requires independent profile revision, snapshot and evaluations', () => {
  const parsed = __accountProfileNetworkTestOnly.parseAccountRemoteProfile({
    revision: 4,
    schemaVersion: 1,
    profile: { schemaVersion: 1, profileLoadout: {} },
    evaluations: [{ achievementId: 'ach_main_c1', current: 1, target: 1, complete: true }],
    completedCount: 1,
  });
  assert.equal(parsed?.revision, 4);
  assert.equal(parsed?.schemaVersion, 1);
  assert.equal(parsed?.completedCount, 1);
  assert.equal(__accountProfileNetworkTestOnly.parseAccountRemoteProfile({ revision: -1, schemaVersion: 1, profile: {}, evaluations: [], completedCount: 0 }), null);
  assert.equal(__accountProfileNetworkTestOnly.parseAccountRemoteProfile({ revision: 0, schemaVersion: 1, profile: {}, evaluations: [null], completedCount: 0 }), null);
});

test('profile mutation parser requires replayed result while preserving authoritative profile response', () => {
  const parsed = __accountProfileNetworkTestOnly.parseMutationResponse({
    revision: 5,
    schemaVersion: 1,
    profile: { schemaVersion: 1 },
    evaluations: [],
    completedCount: 0,
    replayed: false,
    result: { profileLoadout: {} },
  });
  assert.equal(parsed?.revision, 5);
  assert.equal(parsed?.replayed, false);
  assert.deepEqual(parsed?.result, { profileLoadout: {} });
});

test('profile transport shares the authenticated session token surface and keeps cache plus live memory fingerprint-bound', async () => {
  const [profileNetwork, accountNetwork] = await Promise.all([
    readSource('../src/account-profile-network.ts'),
    readSource('../src/account-network.ts'),
  ]);
  assert.match(profileNetwork, /frontline\.account\.sessionToken\.v1/);
  assert.match(accountNetwork, /frontline\.account\.sessionToken\.v1/);
  assert.match(profileNetwork, /sessionFingerprint/);
  assert.match(profileNetwork, /frontline\.account\.profileReadCache\.v1/);
  assert.match(profileNetwork, /currentProfileSessionFingerprint/);
  assert.match(profileNetwork, /currentProfileSessionFingerprint !== fingerprint/);
  assert.match(profileNetwork, /currentProfile && currentProfileSessionFingerprint === fingerprint/);
  assert.match(profileNetwork, /authorization.*Bearer/s);
  assert.match(profileNetwork, /\/api\/account\/profile/);
  assert.match(profileNetwork, /expectedRevision: current\.revision/);
  assert.match(profileNetwork, /AUTHENTICATED_ONLINE/);
});

test('profile scene loads server profile online, mutates loadout, and keeps offline account cache read-only', async () => {
  const profile = await readSource('../src/profile-scene.ts');
  assert.match(profile, /loadAuthenticatedAccountProfile\(\)/);
  assert.match(profile, /deriveAccountAchievementProfile\(view\.progress, remote\.profile, view\.authority === 'ACCOUNT_ONLINE'\)/);
  assert.match(profile, /mutateAuthenticatedAccountProfile\(\{ requestId: newRequestId\(\), profileLoadout: next \}\)/);
  assert.match(profile, /this\.authority !== 'ACCOUNT_ONLINE'/);
  assert.match(profile, /계정 지휘관 · 오프라인 캐시/);
  assert.match(profile, /계정 프로필 서버 저장 완료/);
});
