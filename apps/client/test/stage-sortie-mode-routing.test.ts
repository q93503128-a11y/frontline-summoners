import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('SOLO_OR_COOP stage cards route through a dedicated stage-context sortie picker', async () => {
  const [storySelect, main] = await Promise.all([
    readSource('../src/story-stage-select-scene.ts'),
    readSource('../src/main.ts'),
  ]);
  assert.match(storySelect, /stage\.multiplayerPolicy === 'SOLO_OR_COOP'/);
  assert.match(storySelect, /originalStart\('sortie-mode', \{ stageId \}\)/);
  assert.match(main, /import \{ StageSortieModeScene \} from '\.\/stage-sortie-mode-scene'/);
  assert.match(main, /game\.scene\.add\('sortie-mode', StageSortieModeScene, false\)/);
});

test('sortie picker preserves active progress authority and validates unlock and formation before routing', async () => {
  const source = await readSource('../src/stage-sortie-mode-scene.ts');
  assert.match(source, /loadActiveProgress\(\)/);
  assert.match(source, /isSortieStageUnlocked\(this\.stage\.id, view\.progress\.clearedStageIds, view\.progress\.specialClearedStageIds\)/);
  assert.match(source, /getGuestStageFormationViolation\(this\.stage\.id, view\.progress\)/);
  assert.match(source, /ACCOUNT_OFFLINE_CACHE/);
  assert.match(source, /this\.scene\.start\('account'\)/);
});

test('solo keeps pre-stage story while friend and public coop keep the selected stage id', async () => {
  const source = await readSource('../src/stage-sortie-mode-scene.ts');
  assert.match(source, /getPreStageStory\(this\.stage\.id\)/);
  assert.match(source, /nextScene: 'battle', nextData: \{ stageId: this\.stage\.id \}/);
  assert.match(source, /this\.scene\.start\('coop-lobby', \{ preferredStageId: this\.stage\.id \}\)/);
  assert.match(source, /createFriendCoopInvite\(this\.stage\.id, profile\.friendCode\)/);
  assert.match(source, /joinPublicCoopMatchmaking\(this\.stage\.id\)/);
  assert.match(source, /this\.scene\.start\('friend-coop-lobby', \{ websocketPath: result\.hostPath \}\)/);
  assert.match(source, /this\.scene\.start\('public-coop-matchmaking'\)/);
});

test('guest code-coop adapter focuses the already-authoritative lobby picker on the selected stage page', async () => {
  const source = await readSource('../src/coop-story-scenes.ts');
  assert.match(source, /private preferredStageId: string \| undefined/);
  assert.match(source, /init\(data: \{ preferredStageId\?: string \} = \{\}\)/);
  assert.match(source, /ALL_STAGES\.filter\(\(stage\) => stage\.multiplayerPolicy === 'SOLO_OR_COOP'/);
  assert.match(source, /const index = eligible\.findIndex\(\(stage\) => stage\.id === preferredStageId\)/);
  assert.match(source, /carrier\.page = Math\.floor\(index \/ 5\)/);
  assert.match(source, /carrier\.render\?\.\(\)/);
  assert.doesNotMatch(source, /createCoopMatch\(/);
});

test('stage-context return path preserves the exact collection page', async () => {
  const source = await readSource('../src/stage-sortie-mode-scene.ts');
  assert.match(source, /const collection = getStageCollectionForStage\(this\.stage\.id\)/);
  assert.match(source, /collectionId: collection\.id/);
  assert.match(source, /getCollectionStagePageIndexForStage\(collection, this\.stage\.id\)/);
});
