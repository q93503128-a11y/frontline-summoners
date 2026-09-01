import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_CLIENT_SETTINGS, normalizeClientSettings } from '../src/client-settings.ts';
import {
  MAIN_STORY_PRESENTATIONS,
  getPostStageStory,
  getPreStageStory,
} from '../src/story-content.ts';
import {
  STORY_VIEWED_STORAGE_KEY,
  hasViewedStory,
  markStoryViewed,
  shouldPresentStory,
  type StoryProgressStorage,
} from '../src/story-progress.ts';

class MemoryStorage implements StoryProgressStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

test('first main arc authors chapter intro, final-boss prelude and chapter outro for all four chapters', () => {
  assert.equal(MAIN_STORY_PRESENTATIONS.length, 12);
  for (let chapter = 1; chapter <= 4; chapter += 1) {
    const stories = MAIN_STORY_PRESENTATIONS.filter((story) => story.chapter === chapter);
    assert.deepEqual(stories.map((story) => story.kind).sort(), ['BOSS_PRELUDE', 'CHAPTER_INTRO', 'CHAPTER_OUTRO']);
    for (const story of stories) {
      assert.ok(story.beats.length >= 2 && story.beats.length <= 5);
      assert.ok(story.beats.every((beat) => beat.speaker.trim().length > 0 && beat.text.trim().length > 0));
    }
  }
});

test('main story routing is attached only to authored chapter starts/finals and chapter-final clears', () => {
  assert.equal(getPreStageStory('main_01_001')?.id, 'story_ch1_intro');
  assert.equal(getPreStageStory('main_01_020')?.id, 'story_ch1_final');
  assert.equal(getPreStageStory('main_02_001')?.id, 'story_ch2_intro');
  assert.equal(getPreStageStory('main_02_020')?.id, 'story_ch2_final');
  assert.equal(getPreStageStory('main_03_001')?.id, 'story_ch3_intro');
  assert.equal(getPreStageStory('main_03_020')?.id, 'story_ch3_final');
  assert.equal(getPreStageStory('main_04_001')?.id, 'story_ch4_intro');
  assert.equal(getPreStageStory('main_04_020')?.id, 'story_ch4_final');
  assert.equal(getPreStageStory('main_01_010'), undefined);
  assert.equal(getPostStageStory('main_01_020')?.id, 'story_ch1_outro');
  assert.equal(getPostStageStory('main_02_020')?.id, 'story_ch2_outro');
  assert.equal(getPostStageStory('main_03_020')?.id, 'story_ch3_outro');
  assert.equal(getPostStageStory('main_04_020')?.id, 'story_ch4_outro');
  assert.equal(getPostStageStory('main_04_019'), undefined);
});

test('viewed story state is idempotent and auto-skip marks the presentation without rendering it', () => {
  const storage = new MemoryStorage();
  const story = getPreStageStory('main_01_001')!;
  assert.equal(hasViewedStory(story.id, storage), false);
  assert.equal(shouldPresentStory(story, false, storage), true);
  assert.equal(markStoryViewed(story.id, storage), true);
  assert.equal(markStoryViewed(story.id, storage), true);
  assert.equal(hasViewedStory(story.id, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(STORY_VIEWED_STORAGE_KEY) ?? '[]'), [story.id]);

  const autoStorage = new MemoryStorage();
  assert.equal(shouldPresentStory(story, true, autoStorage), false);
  assert.equal(hasViewedStory(story.id, autoStorage), true);
});

test('old settings payloads default story auto-skip off and explicit preference survives normalization', () => {
  const oldPayload = normalizeClientSettings({ ...DEFAULT_CLIENT_SETTINGS, autoSkipStory: undefined });
  assert.equal(oldPayload.autoSkipStory, false);
  const enabled = normalizeClientSettings({ ...DEFAULT_CLIENT_SETTINGS, autoSkipStory: true });
  assert.equal(enabled.autoSkipStory, true);
});

test('client wiring keeps story optional, immediately skippable, and after authoritative clear persistence', async () => {
  const [main, stageRoute, storyScene, result, trustedResult, settings] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/story-stage-select-scene.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/story-scene.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/result-scene.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/trusted-battle-result-scene.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/settings-scene.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(main, /StoryStageSelectScene as StageSelectScene/);
  assert.match(main, /game\.scene\.add\('story', StoryScene, false\)/);
  assert.match(stageRoute, /getPreStageStory\(stageId\)/);
  assert.match(stageRoute, /shouldPresentStory\(story, getClientSettings\(\)\.autoSkipStory\)/);
  assert.match(storyScene, /'건너뛰기'/);
  assert.match(storyScene, /keydown-ESC/);
  assert.match(storyScene, /getClientSettings\(\)\.autoSkipStory/);
  assert.match(result, /result\.firstClear && result\.persisted \? getPostStageStory/);
  assert.match(trustedResult, /reward\.firstClear/);
  assert.match(trustedResult, /getPostStageStory\(this\.stage\.id\)/);
  assert.match(settings, /스토리 자동 건너뛰기/);
});
