import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('authenticated solo battle requires online active progress and a matching trusted start ticket', async () => {
  const battle = await readSource('../src/battle-scene.ts');
  assert.match(battle, /loadActiveProgress\(\)/);
  assert.match(battle, /view\.authority === 'ACCOUNT_OFFLINE_CACHE'/);
  assert.match(battle, /startAuthenticatedTrustedBattle\(kind, this\.stage\.id\)/);
  assert.match(battle, /account\.remote\.revision !== trustedStart\.startRevision/);
  assert.match(battle, /this\.state\.stateHash !== trustedStart\.initialStateHash/);
  assert.match(battle, /this\.battleAuthority = 'ACCOUNT_TRUSTED'/);
});

test('trusted battle records only accepted deterministic player commands and seals them at terminal state', async () => {
  const battle = await readSource('../src/battle-scene.ts');
  assert.match(battle, /this\.trustedRecorder\?\.recordSpawn\(tick, slotId, result\.ok\)/);
  assert.match(battle, /this\.trustedRecorder\?\.recordSupplyUpgrade\(tick, result\.ok\)/);
  assert.match(battle, /this\.trustedRecorder\?\.recordBaseWeapon\(tick, result\.ok\)/);
  assert.match(battle, /commands: recorder\.seal\(\)/);
  assert.match(battle, /localFinalStateHash: this\.state\.stateHash/);
  assert.match(battle, /localPlayerBaseHp: this\.state\.battle\.bases\.PLAYER\.hp/);
  assert.match(battle, /localEnemyBaseHp: this\.state\.battle\.bases\.ENEMY\.hp/);
});

test('authenticated terminal result bypasses guest result mutation and routes through trusted verification', async () => {
  const battle = await readSource('../src/battle-scene.ts');
  const trustedResult = await readSource('../src/trusted-battle-result-scene.ts');
  const guestResult = await readSource('../src/result-scene.ts');
  const main = await readSource('../src/main.ts');

  assert.match(battle, /this\.scene\.start\('trusted-result', \{ proof \}\)/);
  assert.match(trustedResult, /completeAuthenticatedTrustedBattle\(this\.proof\.battleId, this\.proof\.commands\)/);
  assert.match(trustedResult, /assertTrustedCompletionMatchesLocal\(this\.proof, completed\.result\)/);
  assert.match(trustedResult, /claimAuthenticatedTrustedBattle\(this\.proof\.battleId\)/);
  assert.match(trustedResult, /assertTrustedCompletionMatchesLocal\(this\.proof, claim\.completion\)/);
  assert.doesNotMatch(trustedResult, /recordNormalStageClear|recordSpecialStageClear|recordGuest/);
  assert.match(guestResult, /recordNormalStageClear|recordSpecialStageClear/);
  assert.match(main, /game\.scene\.add\('trusted-result', TrustedBattleResultScene, false\)/);
});

test('authenticated battle never writes enemy discoveries into guest storage', async () => {
  const battle = await readSource('../src/battle-scene.ts');
  const discoveryStart = battle.indexOf('private syncEnemyDiscoveries');
  const bossStart = battle.indexOf('private syncBossWarnings');
  assert.ok(discoveryStart >= 0 && bossStart > discoveryStart);
  const discoveryBlock = battle.slice(discoveryStart, bossStart);
  assert.match(discoveryBlock, /if \(this\.battleAuthority !== 'GUEST_LOCAL'\) return;/);
  assert.match(discoveryBlock, /recordGuestEnemyDiscoveries\(newlySeen\)/);
  assert.ok(
    discoveryBlock.indexOf("if (this.battleAuthority !== 'GUEST_LOCAL') return;")
      < discoveryBlock.indexOf('recordGuestEnemyDiscoveries(newlySeen)'),
    'account trusted branch must return before guest discovery persistence',
  );
});

test('trusted result blocks navigation until replay verification and authoritative claim finish', async () => {
  const source = await readSource('../src/trusted-battle-result-scene.ts');
  assert.match(source, /const guarded = \(action: \(\) => void\): void => \{ if \(!this\.finalized\) return; action\(\); \};/);
  assert.match(source, /if \(this\.finalized \|\| this\.finalizing\) return;/);
  assert.match(source, /this\.finalized = true;/);
  assert.match(source, /this\.retryButton\?\.setVisible\(true\)/);
  assert.match(source, /보상은 서버 검증이 완료될 때까지 지급되지 않는다/);
});
