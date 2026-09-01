import type { StoryPresentation } from './story-content';

export const STORY_VIEWED_STORAGE_KEY = 'frontline-summoners:story-viewed:v1';

export interface StoryProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StoryProgressStorage | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

export function loadViewedStoryIds(storage: StoryProgressStorage | null = browserStorage()): ReadonlySet<string> {
  if (!storage) return new Set<string>();
  try {
    const raw = storage.getItem(STORY_VIEWED_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value): value is string => typeof value === 'string' && value.length > 0));
  } catch {
    return new Set<string>();
  }
}

export function hasViewedStory(storyId: string, storage: StoryProgressStorage | null = browserStorage()): boolean {
  return loadViewedStoryIds(storage).has(storyId);
}

export function markStoryViewed(storyId: string, storage: StoryProgressStorage | null = browserStorage()): boolean {
  if (!storage) return false;
  const viewed = new Set(loadViewedStoryIds(storage));
  viewed.add(storyId);
  try {
    storage.setItem(STORY_VIEWED_STORAGE_KEY, JSON.stringify([...viewed].sort()));
    return true;
  } catch {
    return false;
  }
}

export function shouldPresentStory(
  story: StoryPresentation | undefined,
  autoSkipStory: boolean,
  storage: StoryProgressStorage | null = browserStorage(),
): story is StoryPresentation {
  if (!story) return false;
  if (autoSkipStory) {
    markStoryViewed(story.id, storage);
    return false;
  }
  return !hasViewedStory(story.id, storage);
}
