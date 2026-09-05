import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  GUEST_DEVELOPER_RESOURCE_BALANCE,
  GUEST_DEVELOPER_RESOURCE_CODE,
  __guestMaintenanceTestOnly,
} from '../src/guest-maintenance.ts';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('guest reset deletes durable guest progress and guest-profile metadata without touching client settings', async () => {
  const source = await readSource('../src/guest-maintenance.ts');
  assert.equal(__guestMaintenanceTestOnly.DB_NAME, 'frontline-summoners');
  assert.equal(__guestMaintenanceTestOnly.STORE_NAME, 'guest-progress');
  assert.equal(__guestMaintenanceTestOnly.KEY, 'progress');
  assert.match(source, /objectStore\(STORE_NAME\)\.delete\(KEY\)/);
  assert.match(source, /clearLegacyPeriodicSpecialChargeState\(\)/);
  assert.match(source, /frontline-summoners:achievement-profile:v1/);
  assert.match(source, /frontline\.guest\.migratedToAccount\.v1/);
  assert.doesNotMatch(source, /frontline-summoners:client-settings/);
});

test('developer resource code is guest-local, uses every canonical resource id, and tops balances to a practical infinite test amount', async () => {
  const source = await readSource('../src/guest-maintenance.ts');
  assert.equal(GUEST_DEVELOPER_RESOURCE_CODE, 'FRONTLINE-DEV-INFINITE');
  assert.equal(GUEST_DEVELOPER_RESOURCE_BALANCE, 999_999_999);
  assert.match(source, /for \(const id of META_RESOURCE_IDS\)/);
  assert.match(source, /GUEST_DEVELOPER_RESOURCE_BALANCE - current/);
  assert.match(source, /grantResources\(before, grants as ResourceAmounts\)/);
  assert.match(source, /developer-resource-sandbox:v1/);
});

test('account scene exposes explicit guest reset and developer-code actions and blocks sandbox guest migration', async () => {
  const source = await readSource('../src/account-scene.ts');
  assert.match(source, /게스트 초기화/);
  assert.match(source, /개발자 코드/);
  assert.match(source, /resetGuestLocalAccountData/);
  assert.match(source, /applyGuestDeveloperResourceCode/);
  assert.match(source, /isGuestDeveloperResourceSandboxActive/);
  assert.match(source, /개발자 테스트 재화가 적용된 게스트 진행은 서버 계정으로 이전할 수 없습니다/);
  assert.match(source, /RESET/);
});

test('social guest controls visibly respond and route account-required actions to login instead of appearing dead', async () => {
  const source = await readSource('../src/social-scene.ts');
  assert.match(source, /requireOnlineSocial/);
  assert.match(source, /계정에서 로그인/);
  assert.match(source, /`\$\{TAB_LABELS\[this\.tab\]\} 기능은 온라인 로그인 후 사용할 수 있습니다\.`/);
  assert.match(source, /if \(!this\.requireOnlineSocial\(\)\) return/);
  assert.match(source, /this\.scene\.start\('account'\)/);
});
