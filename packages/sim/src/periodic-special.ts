export const PERIODIC_REWARD_COLLECTION_IDS = [
  'special_gold_convoy',
  'special_soul_forge',
  'special_evolution_gate',
  'special_starlight_rift',
] as const;
export type PeriodicRewardCollectionId = (typeof PERIODIC_REWARD_COLLECTION_IDS)[number];

export const PERIODIC_REWARD_CHARGE_MAX = 4;
export const PERIODIC_REWARD_RECHARGE_MS = 12 * 60 * 60 * 1000;

export interface PeriodicRewardChargeState {
  readonly charges: number;
  /** Null while capped. Otherwise the absolute instant at which the next charge is earned. */
  readonly nextChargeAtMs: number | null;
}
export type PeriodicRewardChargeMap = Readonly<Record<PeriodicRewardCollectionId, PeriodicRewardChargeState>>;

export interface PeriodicCollectionSchedule {
  readonly collectionId: PeriodicRewardCollectionId;
  readonly epochMs: number;
  readonly cycleMs: number;
  readonly openMs: number;
  readonly offsetMs: number;
}
export interface PeriodicCollectionWindowState {
  readonly available: boolean;
  readonly opensAtMs: number;
  readonly closesAtMs: number;
}

function safeNow(nowMs: number): number {
  return Number.isFinite(nowMs) ? Math.max(0, Math.trunc(nowMs)) : 0;
}
function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
function normalizeChargeCount(value: unknown): number {
  return Number.isInteger(value) ? Math.max(0, Math.min(PERIODIC_REWARD_CHARGE_MAX, value as number)) : PERIODIC_REWARD_CHARGE_MAX;
}

export function createFullPeriodicRewardChargeState(): PeriodicRewardChargeState {
  return { charges: PERIODIC_REWARD_CHARGE_MAX, nextChargeAtMs: null };
}
export function createFullPeriodicRewardChargeMap(): PeriodicRewardChargeMap {
  return Object.fromEntries(PERIODIC_REWARD_COLLECTION_IDS.map((id) => [id, createFullPeriodicRewardChargeState()])) as unknown as PeriodicRewardChargeMap;
}

export function normalizePeriodicRewardChargeState(value: unknown, nowMs = Date.now()): PeriodicRewardChargeState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return createFullPeriodicRewardChargeState();
  const raw = value as Record<string, unknown>;
  const charges = normalizeChargeCount(raw.charges);
  if (charges >= PERIODIC_REWARD_CHARGE_MAX) return createFullPeriodicRewardChargeState();
  const nextChargeAtMs = Number.isFinite(raw.nextChargeAtMs) && (raw.nextChargeAtMs as number) >= 0
    ? Math.trunc(raw.nextChargeAtMs as number)
    : safeNow(nowMs) + PERIODIC_REWARD_RECHARGE_MS;
  return refreshPeriodicRewardChargeState({ charges, nextChargeAtMs }, nowMs);
}

export function refreshPeriodicRewardChargeState(state: PeriodicRewardChargeState, nowMs = Date.now()): PeriodicRewardChargeState {
  const now = safeNow(nowMs);
  const charges = normalizeChargeCount(state.charges);
  if (charges >= PERIODIC_REWARD_CHARGE_MAX) return createFullPeriodicRewardChargeState();
  const next = state.nextChargeAtMs === null || !Number.isFinite(state.nextChargeAtMs)
    ? now + PERIODIC_REWARD_RECHARGE_MS
    : Math.max(0, Math.trunc(state.nextChargeAtMs));
  if (now < next) return { charges, nextChargeAtMs: next };
  const gained = 1 + Math.floor((now - next) / PERIODIC_REWARD_RECHARGE_MS);
  const replenished = Math.min(PERIODIC_REWARD_CHARGE_MAX, charges + gained);
  if (replenished >= PERIODIC_REWARD_CHARGE_MAX) return createFullPeriodicRewardChargeState();
  return { charges: replenished, nextChargeAtMs: next + gained * PERIODIC_REWARD_RECHARGE_MS };
}

export function consumePeriodicRewardCharge(
  state: PeriodicRewardChargeState,
  nowMs = Date.now(),
): { readonly state: PeriodicRewardChargeState; readonly consumed: boolean } {
  const refreshed = refreshPeriodicRewardChargeState(state, nowMs);
  if (refreshed.charges <= 0) return { state: refreshed, consumed: false };
  return {
    consumed: true,
    state: {
      charges: refreshed.charges - 1,
      nextChargeAtMs: refreshed.nextChargeAtMs ?? safeNow(nowMs) + PERIODIC_REWARD_RECHARGE_MS,
    },
  };
}

export function normalizePeriodicRewardChargeMap(value: unknown, nowMs = Date.now()): PeriodicRewardChargeMap {
  const raw = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(PERIODIC_REWARD_COLLECTION_IDS.map((id) => [id, normalizePeriodicRewardChargeState(raw[id], nowMs)])) as unknown as PeriodicRewardChargeMap;
}

export function mergePeriodicRewardChargeMaps(
  a: unknown,
  b: unknown,
  nowMs = Date.now(),
): PeriodicRewardChargeMap {
  const left = normalizePeriodicRewardChargeMap(a, nowMs);
  const right = normalizePeriodicRewardChargeMap(b, nowMs);
  const merged = PERIODIC_REWARD_COLLECTION_IDS.map((id) => {
    const x = left[id]; const y = right[id];
    if (x.charges < y.charges) return [id, x] as const;
    if (y.charges < x.charges) return [id, y] as const;
    if (x.charges >= PERIODIC_REWARD_CHARGE_MAX) return [id, createFullPeriodicRewardChargeState()] as const;
    const xNext = x.nextChargeAtMs ?? Number.MAX_SAFE_INTEGER;
    const yNext = y.nextChargeAtMs ?? Number.MAX_SAFE_INTEGER;
    return [id, xNext >= yNext ? x : y] as const;
  });
  return Object.fromEntries(merged) as unknown as PeriodicRewardChargeMap;
}

export function getPeriodicCollectionWindowState(
  schedule: PeriodicCollectionSchedule,
  nowMs = Date.now(),
): PeriodicCollectionWindowState {
  const now = safeNow(nowMs);
  if (!Number.isFinite(schedule.epochMs) || !Number.isFinite(schedule.cycleMs) || !Number.isFinite(schedule.openMs) || !Number.isFinite(schedule.offsetMs)) {
    throw new Error(`Periodic schedule contains non-finite values: ${schedule.collectionId}`);
  }
  if (schedule.cycleMs <= 0 || schedule.openMs <= 0 || schedule.openMs > schedule.cycleMs) throw new Error(`Invalid periodic schedule duration: ${schedule.collectionId}`);
  const firstOpen = Math.trunc(schedule.epochMs + schedule.offsetMs);
  const phase = positiveModulo(now - firstOpen, Math.trunc(schedule.cycleMs));
  const currentOpenStart = now - phase;
  if (phase < schedule.openMs) {
    return { available: true, opensAtMs: currentOpenStart, closesAtMs: currentOpenStart + schedule.openMs };
  }
  const nextOpen = currentOpenStart + schedule.cycleMs;
  return { available: false, opensAtMs: nextOpen, closesAtMs: nextOpen + schedule.openMs };
}
