import {
  initializeAccountSave,
  replaceAccountSave,
  type AccountSaveRecord,
  type AccountSaveSnapshotV2,
} from './account-save-authority.ts';
import { ACCOUNT_ENEMY_IDS } from './account-content.ts';

export type AccountEnemyDiscoveryApplyResult =
  | { readonly ok: true; readonly changed: boolean; readonly record: AccountSaveRecord }
  | { readonly ok: false; readonly reason: 'revision_conflict'; readonly currentRevision: number };

export function normalizeServerEnemyDiscoveries(value: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) throw new Error('server enemy discoveries must be an array');
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawId of value) {
    if (typeof rawId !== 'string' || rawId.length < 1) throw new Error('server enemy discovery id must be a non-empty string');
    if (!ACCOUNT_ENEMY_IDS.has(rawId)) throw new Error(`server replay discovered unknown enemy:${rawId}`);
    if (seen.has(rawId)) continue;
    seen.add(rawId);
    normalized.push(rawId);
  }
  return normalized;
}

export function mergeAccountEnemyDiscoveries(
  snapshot: AccountSaveSnapshotV2,
  discoveredEnemyIds: readonly string[],
): { readonly changed: boolean; readonly snapshot: AccountSaveSnapshotV2 } {
  const encountered = normalizeServerEnemyDiscoveries(discoveredEnemyIds);
  if (encountered.length === 0) return { changed: false, snapshot };
  const merged = [...snapshot.discoveredEnemyIds];
  const known = new Set(merged);
  for (const enemyId of encountered) {
    if (known.has(enemyId)) continue;
    known.add(enemyId);
    merged.push(enemyId);
  }
  if (merged.length === snapshot.discoveredEnemyIds.length) return { changed: false, snapshot };
  return { changed: true, snapshot: { ...snapshot, discoveredEnemyIds: merged } };
}

export async function applyAccountEnemyDiscoveries(
  db: D1Database,
  accountId: string,
  expectedRevision: number,
  discoveredEnemyIds: readonly string[],
  nowMs = Date.now(),
): Promise<AccountEnemyDiscoveryApplyResult> {
  const current = await initializeAccountSave(db, accountId, undefined, nowMs);
  const merged = mergeAccountEnemyDiscoveries(current.snapshot, discoveredEnemyIds);
  if (!merged.changed) return { ok: true, changed: false, record: current };
  if (current.revision !== expectedRevision) {
    return { ok: false, reason: 'revision_conflict', currentRevision: current.revision };
  }
  const replaced = await replaceAccountSave(db, accountId, expectedRevision, merged.snapshot, nowMs);
  if (!replaced.ok) return replaced;
  return { ok: true, changed: true, record: replaced.record };
}
