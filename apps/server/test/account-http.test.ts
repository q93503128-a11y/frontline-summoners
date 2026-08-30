import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __accountHttpTestOnly } from '../src/account-http.ts';

test('authenticated account meta parser accepts the six authoritative progression actions without account identity input', () => {
  assert.deepEqual(__accountHttpTestOnly.parseMetaMutation({
    requestId: 'level-1', expectedRevision: 4, action: 'CHARACTER_LEVEL', characterId: 'militia', targetLevel: 2,
  }), {
    requestId: 'level-1', expectedRevision: 4, action: 'CHARACTER_LEVEL', characterId: 'militia', targetLevel: 2,
  });
  assert.equal(__accountHttpTestOnly.parseMetaMutation({
    requestId: 'weapon-1', expectedRevision: 4, action: 'BASE_WEAPON_SELECT', baseWeaponId: 'base_weapon_front_cannon',
  }).action, 'BASE_WEAPON_SELECT');
  assert.equal(__accountHttpTestOnly.parseMetaMutation({
    requestId: 'deck-1', expectedRevision: 4, action: 'DECK_SET', deckSlotIds: ['militia'],
  }).action, 'DECK_SET');
  assert.throws(() => __accountHttpTestOnly.parseMetaMutation({
    requestId: 'bad', expectedRevision: 0, action: 'DECK_SET', deckSlotIds: [],
  }), /1\.\.10/);
  assert.throws(() => __accountHttpTestOnly.parseMetaMutation({
    requestId: 'bad', expectedRevision: 0, action: 'BASE_WEAPON_SELECT', baseWeaponId: 'forged_weapon',
  }), /unknown/);
});

test('authenticated recruitment and sweep parsers retain request idempotency and revision inputs only', () => {
  assert.deepEqual(__accountHttpTestOnly.parseRecruitmentMutation({
    requestId: 'recruit-1', expectedRevision: 8, bannerId: 'banner-01', count: 10, duplicatePolicy: 'APPLY_PLUS', accountId: 'ignored-forged-id',
  }), {
    requestId: 'recruit-1', expectedRevision: 8, bannerId: 'banner-01', count: 10, duplicatePolicy: 'APPLY_PLUS',
  });
  assert.deepEqual(__accountHttpTestOnly.parseSweepMutation({
    requestId: 'sweep-1', expectedRevision: 9, stageId: 'main_01_001', accountId: 'ignored-forged-id',
  }), {
    requestId: 'sweep-1', expectedRevision: 9, stageId: 'main_01_001',
  });
  assert.throws(() => __accountHttpTestOnly.parseRecruitmentMutation({
    requestId: 'bad', expectedRevision: 0, bannerId: 'banner-01', count: 5, duplicatePolicy: 'APPLY_PLUS',
  }), /1 or 10/);
});

test('account HTTP source derives account ownership exclusively from bearer session and does not expose battle-result proofless routes', async () => {
  const source = await readFile(new URL('../src/account-http.ts', import.meta.url), 'utf8');
  assert.match(source, /resolveAuthSession\(db, request\.headers\.get\('authorization'\), nowMs\)/);
  assert.match(source, /principal\.userId/);
  assert.match(source, /\/api\/account\/meta/);
  assert.match(source, /\/api\/account\/recruitment/);
  assert.match(source, /\/api\/account\/sweep/);
  assert.match(source, /\/api\/account\/logout/);
  assert.doesNotMatch(source, /body\.accountId/);
  assert.doesNotMatch(source, /applyAccountMainBattleResult/);
  assert.doesNotMatch(source, /applyAccountSpecialBattleResult/);
  assert.doesNotMatch(source, /applyAccountRecordResult/);
  assert.match(source, /status: 401/);
  assert.match(source, /status: 409/);
  assert.match(source, /AUTHENTICATED_ONLINE/);
});

test('worker routes authenticated account requests and allows Authorization through CORS', async () => {
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /resolveAuthenticatedAccountHttp/);
  assert.match(source, /authorization,content-type|content-type,authorization/);
  assert.match(source, /accountHttpResult/);
});
