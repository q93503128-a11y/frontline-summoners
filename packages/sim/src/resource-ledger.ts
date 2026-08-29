export const META_RESOURCE_IDS = ['gold', 'evo_fragment', 'evo_core', 'evo_crown', 'soul_essence', 'summon_crystal'] as const;
export type MetaResourceId = (typeof META_RESOURCE_IDS)[number];

export interface ResourceLedgerEntry {
  readonly earned: number;
  readonly spent: number;
}
export type ResourceLedger = Readonly<Partial<Record<MetaResourceId, ResourceLedgerEntry>>>;
export type ResourceAmounts = Readonly<Partial<Record<MetaResourceId, number>>>;

const KNOWN_IDS = new Set<string>(META_RESOURCE_IDS);

function nonNegativeInteger(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : 0;
}

export function normalizeResourceLedger(value: unknown): ResourceLedger {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: Partial<Record<MetaResourceId, ResourceLedgerEntry>> = {};
  for (const id of META_RESOURCE_IDS) {
    const entry = raw[id];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const earned = nonNegativeInteger(record.earned);
    const spent = Math.min(earned, nonNegativeInteger(record.spent));
    if (earned > 0 || spent > 0) result[id] = { earned, spent };
  }
  return result;
}

export function mergeResourceLedgers(a: ResourceLedger, b: ResourceLedger): ResourceLedger {
  const result: Partial<Record<MetaResourceId, ResourceLedgerEntry>> = {};
  for (const id of META_RESOURCE_IDS) {
    const left = a[id] ?? { earned: 0, spent: 0 };
    const right = b[id] ?? { earned: 0, spent: 0 };
    const earned = Math.max(left.earned, right.earned);
    const spent = Math.min(earned, Math.max(left.spent, right.spent));
    if (earned > 0 || spent > 0) result[id] = { earned, spent };
  }
  return result;
}

export function getResourceBalance(ledger: ResourceLedger, id: MetaResourceId): number {
  const entry = ledger[id];
  return entry ? Math.max(0, entry.earned - entry.spent) : 0;
}

function validateAmounts(amounts: ResourceAmounts): void {
  for (const [rawId, amount] of Object.entries(amounts)) {
    if (!KNOWN_IDS.has(rawId)) throw new Error(`Unknown meta resource: ${rawId}`);
    if (!Number.isInteger(amount) || (amount as number) < 0) throw new Error(`Meta resource amount must be a non-negative integer: ${rawId}`);
  }
}

export function grantResources(ledger: ResourceLedger, amounts: ResourceAmounts): ResourceLedger {
  validateAmounts(amounts);
  const result: Partial<Record<MetaResourceId, ResourceLedgerEntry>> = { ...ledger };
  for (const id of META_RESOURCE_IDS) {
    const amount = amounts[id] ?? 0;
    if (amount === 0) continue;
    const entry = result[id] ?? { earned: 0, spent: 0 };
    result[id] = { earned: entry.earned + amount, spent: entry.spent };
  }
  return result;
}

export function spendResources(ledger: ResourceLedger, amounts: ResourceAmounts): ResourceLedger {
  validateAmounts(amounts);
  for (const id of META_RESOURCE_IDS) {
    const required = amounts[id] ?? 0;
    if (getResourceBalance(ledger, id) < required) {
      throw new Error(`Insufficient meta resource: ${id} (${getResourceBalance(ledger, id)}/${required})`);
    }
  }
  const result: Partial<Record<MetaResourceId, ResourceLedgerEntry>> = { ...ledger };
  for (const id of META_RESOURCE_IDS) {
    const amount = amounts[id] ?? 0;
    if (amount === 0) continue;
    const entry = result[id] ?? { earned: 0, spent: 0 };
    result[id] = { earned: entry.earned, spent: entry.spent + amount };
  }
  return result;
}
