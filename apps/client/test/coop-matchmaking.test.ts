import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { __coopMatchmakingNetworkTestOnly } from '../src/coop-matchmaking-network.ts';

test('public matchmaking parser accepts idle, queued, pairing and matched states', () => {
  assert.deepEqual(__coopMatchmakingNetworkTestOnly.parseState({ state: 'IDLE' }), { state: 'IDLE' });
  assert.deepEqual(__coopMatchmakingNetworkTestOnly.parseState({
    state: 'QUEUED', stageId: 'main_01_001', queuedAtMs: 1000, expiresAtMs: 2000,
  }), { state: 'QUEUED', stageId: 'main_01_001', queuedAtMs: 1000, expiresAtMs: 2000 });
  assert.deepEqual(__coopMatchmakingNetworkTestOnly.parseState({
    state: 'PAIRING', stageId: 'main_01_001', queuedAtMs: 1000, expiresAtMs: 2000,
  }), { state: 'PAIRING', stageId: 'main_01_001', queuedAtMs: 1000, expiresAtMs: 2000 });
  assert.deepEqual(__coopMatchmakingNetworkTestOnly.parseState({
    state: 'MATCHED', stageId: 'main_01_001', matchId: 'm1', seatId: 'B', websocketPath: '/api/matches/m1/websocket?token=x', matchedAtMs: 3000,
  }), { state: 'MATCHED', stageId: 'main_01_001', matchId: 'm1', seatId: 'B', websocketPath: '/api/matches/m1/websocket?token=x', matchedAtMs: 3000 });
  assert.throws(() => __coopMatchmakingNetworkTestOnly.parseState({ state: 'MATCHED', stageId: 'main_01_001' }), /응답 형식/);
});

test('public matchmaking transport is authenticated and exposes join/status/leave only', async () => {
  const source = await readFile(new URL('../src/coop-matchmaking-network.ts', import.meta.url), 'utf8');
  assert.match(source, /AUTHENTICATED_ONLINE/);
  assert.match(source, /\/api\/coop\/matchmaking\/join/);
  assert.match(source, /\/api\/coop\/matchmaking\/status/);
  assert.match(source, /\/api\/coop\/matchmaking\/leave/);
  assert.match(source, /authorization.*Bearer/s);
  assert.doesNotMatch(source, /accountId/);
});

test('public matchmaking scene uses account coop progress and routes matched seats into account-bound coop', async () => {
  const source = await readFile(new URL('../src/public-coop-scenes.ts', import.meta.url), 'utf8');
  assert.match(source, /getAuthenticatedCoopClientProgress/);
  assert.match(source, /multiplayerPolicy === 'SOLO_OR_COOP'/);
  assert.match(source, /joinPublicCoopMatchmaking/);
  assert.match(source, /getPublicCoopMatchmakingStatus/);
  assert.match(source, /public-coop-lobby/);
  assert.match(source, /room\.matchKind !== 'CODE'/);
  assert.match(source, /room\.seats\.every\(\(seat\) => seat\.accountBound === true\)/);
  assert.match(source, /accountCoopLoadout/);
  assert.match(source, /friend-coop-battle/);
});

test('stage-context sortie picker and Phaser registry expose public matchmaking entry points', async () => {
  const sortie = await readFile(new URL('../src/stage-sortie-mode-scene.ts', import.meta.url), 'utf8');
  const hub = await readFile(new URL('../src/stage-hub-scene.ts', import.meta.url), 'utf8');
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(sortie, /'공개 협동'/);
  assert.match(sortie, /joinPublicCoopMatchmaking\(this\.stage\.id\)/);
  assert.match(sortie, /this\.scene\.start\('public-coop-matchmaking'\)/);
  assert.doesNotMatch(hub, /this\.scene\.start\('public-coop-matchmaking'\)/);
  assert.match(main, /PublicCoopMatchmakingScene/);
  assert.match(main, /PublicCoopLobbyScene/);
  assert.match(main, /game\.scene\.add\('public-coop-matchmaking'/);
  assert.match(main, /game\.scene\.add\('public-coop-lobby'/);
});
