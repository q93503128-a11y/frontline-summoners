const ROSTER_FAVORITES_KEY = 'frontline.rosterFavorites.v1';

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

export function sanitizeRosterFavoriteIds(value: unknown, knownIds: ReadonlySet<string>): readonly string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && knownIds.has(entry)) unique.add(entry);
  }
  return [...unique];
}

export function loadRosterFavoriteIds(knownIds: ReadonlySet<string>): readonly string[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ROSTER_FAVORITES_KEY);
    return raw === null ? [] : sanitizeRosterFavoriteIds(JSON.parse(raw), knownIds);
  } catch {
    return [];
  }
}

export function saveRosterFavoriteIds(ids: readonly string[], knownIds: ReadonlySet<string>): readonly string[] {
  const clean = sanitizeRosterFavoriteIds(ids, knownIds);
  const storage = browserStorage();
  if (!storage) return clean;
  try { storage.setItem(ROSTER_FAVORITES_KEY, JSON.stringify(clean)); } catch { /* presentation preference is best-effort */ }
  return clean;
}

export function toggleRosterFavoriteId(
  currentIds: readonly string[],
  characterId: string,
  knownIds: ReadonlySet<string>,
): readonly string[] {
  if (!knownIds.has(characterId)) return sanitizeRosterFavoriteIds(currentIds, knownIds);
  const next = new Set(sanitizeRosterFavoriteIds(currentIds, knownIds));
  if (next.has(characterId)) next.delete(characterId); else next.add(characterId);
  return saveRosterFavoriteIds([...next], knownIds);
}
