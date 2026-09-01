import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_PLAYER_SLOTS } from '../src/prototype.ts';
import {
  DEFAULT_ROSTER_BROWSER_QUERY,
  filterRosterSlots,
  summarizeRosterBrowserQuery,
  type RosterBrowserQuery,
} from '../src/roster-browser.ts';
import { sanitizeRosterFavoriteIds } from '../src/roster-favorites.ts';
import type { GuestProgress } from '../src/save.ts';

const progress: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  characterProgressById: {},
};

function query(overrides: Partial<Omit<RosterBrowserQuery, 'favoriteIds'>> = {}, favorites: readonly string[] = []): RosterBrowserQuery {
  return { ...DEFAULT_ROSTER_BROWSER_QUERY, ...overrides, favoriteIds: new Set(favorites) };
}

test('quick rarity/story and favorites filters never fabricate roster entries', () => {
  const story = filterRosterSlots(ALL_PLAYER_SLOTS, progress, query({ quick: 'STORY' }));
  assert.ok(story.length > 0);
  assert.ok(story.every((slot) => slot.acquisitionClass === 'STORY'));

  const s = filterRosterSlots(ALL_PLAYER_SLOTS, progress, query({ quick: 'S' }));
  assert.ok(s.length > 0);
  assert.ok(s.every((slot) => slot.rarity === 'S'));

  const favoriteId = ALL_PLAYER_SLOTS[3]!.slotId;
  const favorites = filterRosterSlots(ALL_PLAYER_SLOTS, progress, query({ quick: 'FAVORITE' }, [favoriteId]));
  assert.deepEqual(favorites.map((slot) => slot.slotId), [favoriteId]);
});

test('detail filters compose instead of replacing each other', () => {
  const candidate = ALL_PLAYER_SLOTS.find((slot) => slot.definition.targetMode === 'AREA');
  assert.ok(candidate);
  const results = filterRosterSlots(ALL_PLAYER_SLOTS, progress, query({
    role: candidate.role,
    attack: 'AREA',
  }));
  assert.ok(results.length > 0);
  assert.ok(results.every((slot) => slot.role === candidate.role && slot.definition.targetMode === 'AREA'));
});

test('attribute-counter filter derives from authored damage bonuses', () => {
  const candidate = ALL_PLAYER_SLOTS.find((slot) => slot.definition.damageBonuses.some((bonus) => bonus.targetKind === 'ATTRIBUTE'));
  assert.ok(candidate);
  const bonus = candidate.definition.damageBonuses.find((entry) => entry.targetKind === 'ATTRIBUTE');
  assert.ok(bonus && bonus.targetKind === 'ATTRIBUTE');
  const results = filterRosterSlots(ALL_PLAYER_SLOTS, progress, query({ counter: bonus.target }));
  assert.ok(results.includes(candidate));
  assert.ok(results.every((slot) => slot.definition.damageBonuses.some((entry) => entry.targetKind === 'ATTRIBUTE' && entry.target === bonus.target)));
});

test('growth filters use durable +level and selected F2/F3 state', () => {
  const plusId = ALL_PLAYER_SLOTS[0]!.slotId;
  const evolvedId = ALL_PLAYER_SLOTS[1]!.slotId;
  const grown: GuestProgress = {
    ...progress,
    characterProgressById: {
      [plusId]: { level: 12, plusLevel: 3, unlockedFormIds: [`${plusId}_f1`], selectedFormId: `${plusId}_f1` },
      [evolvedId]: { level: 30, plusLevel: 0, unlockedFormIds: [`${evolvedId}_f1`, `${evolvedId}_f2`], selectedFormId: `${evolvedId}_f2` },
    },
  };
  assert.deepEqual(filterRosterSlots(ALL_PLAYER_SLOTS, grown, query({ growth: 'PLUS' })).map((slot) => slot.slotId), [plusId]);
  assert.deepEqual(filterRosterSlots(ALL_PLAYER_SLOTS, grown, query({ growth: 'EVOLVED' })).map((slot) => slot.slotId), [evolvedId]);
});

test('search matches authored identity text and empty search restores the roster', () => {
  const candidate = ALL_PLAYER_SLOTS[0]!;
  const results = filterRosterSlots(ALL_PLAYER_SLOTS, progress, query({ search: candidate.displayName }));
  assert.ok(results.some((slot) => slot.slotId === candidate.slotId));
  assert.equal(filterRosterSlots(ALL_PLAYER_SLOTS, progress, query({ search: '   ' })).length, ALL_PLAYER_SLOTS.length);
});

test('favorite persistence sanitizer drops unknown ids and duplicates', () => {
  const known = new Set(ALL_PLAYER_SLOTS.map((slot) => slot.slotId));
  const first = ALL_PLAYER_SLOTS[0]!.slotId;
  const second = ALL_PLAYER_SLOTS[1]!.slotId;
  assert.deepEqual(sanitizeRosterFavoriteIds([first, 'unknown', first, second, 42], known), [first, second]);
});

test('active filter summary exposes combined state to the UI', () => {
  const summary = summarizeRosterBrowserQuery(query({ quick: 'S', role: '원거리', search: '별' }));
  assert.match(summary, /분류 S/);
  assert.match(summary, /역할 원거리/);
  assert.match(summary, /검색 “별”/);
});
