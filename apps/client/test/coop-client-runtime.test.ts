import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decodeCoopInvite, encodeCoopInvite } from '../src/coop-network.ts';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('co-op invite codes round-trip without putting the guest token in a progression save', () => {
  const invite = { matchId: 'match_123', joinToken: 'guest_token_abcdef' };
  assert.deepEqual(decodeCoopInvite(encodeCoopInvite(invite)), invite);
  assert.throws(() => decodeCoopInvite('broken'), /형식/);
});

test('main menu registers the real co-op lobby and authoritative battle scenes', async () => {
  const main = await readSource('../src/main.ts');
  assert.match(main, /'2인 협동', \(\) => this\.scene\.start\('coop-lobby'\)/);
  assert.match(main, /game\.scene\.add\('coop-lobby', CoopLobbyScene, false\)/);
  assert.match(main, /game\.scene\.add\('coop-battle', CoopBattleScene, false\)/);
  assert.match(main, /scene: \[BootScene, MainMenuScene, StageHubScene, StageSelectScene, DeckScene, CatalogScene, BattleScene, ResultScene\]/);
});

test('co-op lobby exposes only unlocked SOLO_OR_COOP stages and reads scaling from stage policy metadata', async () => {
  const scenes = await readSource('../src/coop-scenes.ts');
  assert.match(scenes, /stage\.multiplayerPolicy === 'SOLO_OR_COOP' && isSortieStageUnlocked\(stage\.id, progress\.clearedStageIds\)/);
  assert.match(scenes, /const scaling = stage\.coopStatScaling;/);
  assert.match(scenes, /formatPermille\(scaling\.enemyHpPermille\)/);
  assert.match(scenes, /formatPermille\(scaling\.enemyAttackPermille\)/);
  assert.match(scenes, /formatPermille\(scaling\.enemyBaseHpPermille\)/);
  assert.doesNotMatch(scenes, /'special-01'[^\n]*'chapter-01'/);
});

test('browser transport creates a stage-bound room and reconnects by the same token path', async () => {
  const network = await readSource('../src/coop-network.ts');
  assert.match(network, /body: JSON\.stringify\(\{ stageId \}\)/);
  assert.match(network, /\/api\/matches/);
  assert.match(network, /joinToken/);
  assert.match(network, /guestWebsocketPath/);
  assert.match(network, /RECONNECTING/);
  assert.match(network, /setTimeout\(\(\) =>/);
});

test('co-op READY carries saved level plus form and permanent rewards but never raw combat stats', async () => {
  const [network, scenes] = await Promise.all([
    readSource('../src/coop-network.ts'),
    readSource('../src/coop-scenes.ts'),
  ]);
  assert.match(network, /export interface CoopCharacterLoadout/);
  assert.match(network, /readonly level: number;/);
  assert.match(network, /readonly plusLevel: number;/);
  assert.match(network, /readonly selectedFormId\?: string;/);
  assert.match(network, /readonly permanentRewardIds: readonly string\[\];/);
  assert.match(network, /this\.send\(\{ type: 'READY', loadout \}\)/);
  assert.doesNotMatch(network, /maxHp.*READY|attackDamage.*READY|standingRange.*READY/);
  assert.match(scenes, /const characterProgress = progress\.characterProgressById \?\? \{\};/);
  assert.match(scenes, /level: meta\?\.level \?\? 1/);
  assert.match(scenes, /plusLevel: meta\?\.plusLevel \?\? 0/);
  assert.match(scenes, /selectedFormId: meta\.selectedFormId/);
  assert.match(scenes, /permanentRewardIds: \[\.\.\.progress\.permanentRewardIds\]/);
  assert.match(scenes, /this\.session\.sendReady\(coopLoadout\(this\.progress\)\)/);
});

test('co-op input pump submits at most one command packet per authoritative simulation tick', async () => {
  const network = await readSource('../src/coop-network.ts');
  assert.match(network, /const tick = battle\.tick;/);
  assert.match(network, /if \(tick <= this\.lastSubmittedTick\) return;/);
  assert.match(network, /type: 'FRAME_INPUT'/);
  assert.match(network, /sequence: this\.sequence/);
  assert.match(network, /this\.lastSubmittedTick = tick;/);
});

test('server victory becomes the existing COOP_BATTLE NORMAL_CLEAR and SPECIAL clear authorities', async () => {
  const scenes = await readSource('../src/coop-scenes.ts');
  assert.match(scenes, /recordNormalStageClear\(this\.stage\.id, 'COOP_BATTLE'\)/);
  assert.match(scenes, /recordSpecialStageClear\(this\.stage\.id\)/);
  assert.match(scenes, /snapshot\.winner === 'PLAYER'/);
  assert.match(scenes, /recordGuestEnemyDiscoveries\(fresh\)/);
});

test('co-op result returns to the canonical collection and page instead of hard-coded chapter ids', async () => {
  const scenes = await readSource('../src/coop-scenes.ts');
  assert.match(scenes, /getStageCollectionForStage\(stage\.id\)/);
  assert.match(scenes, /getCollectionStagePageIndexForStage\(collection, stage\.id\)/);
  assert.match(scenes, /this\.scene\.start\(target\.scene, target\.data\)/);
});

test('compact co-op controls retain the shared finger-sized 84px internal hitbox contract', async () => {
  const scenes = await readSource('../src/coop-scenes.ts');
  const compactHeights = scenes.match(/compact \? 84 : \d+/g) ?? [];
  assert.ok(compactHeights.length >= 8);
  assert.ok(84 * (390 / 720) >= 44);
});
