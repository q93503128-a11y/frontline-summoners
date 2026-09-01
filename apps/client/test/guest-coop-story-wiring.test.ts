import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('guest code co-op uses local story adapters without changing co-op authority', async () => {
  const [main, adapter, guestCoop] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/coop-story-scenes.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/coop-scenes.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(main, /StoryGuestCoopLobbyScene as CoopLobbyScene/);
  assert.match(main, /StoryGuestCoopBattleScene as CoopBattleScene/);
  assert.match(adapter, /guestClearSnapshotBySession/);
  assert.match(adapter, /getPreStageStory\(room\.stageId\)/);
  assert.match(adapter, /message\.type !== 'BATTLE_FINISHED'/);
  assert.match(adapter, /협동 NORMAL_CLEAR 저장 완료/);
  assert.match(adapter, /presentStoryOverlay\(this, story\)/);
  assert.match(guestCoop, /result\.persisted \? '협동 NORMAL_CLEAR 저장 완료' : '현재 탭에서 클리어 유지'/);
});
