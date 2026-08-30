import { resolveCoopApiOrigin } from './coop-network.ts';

export type AccountClientState =
  | { readonly kind: 'GUEST_LOCAL' }
  | { readonly kind: 'AUTHENTICATED_ONLINE'; readonly remote: AccountRemoteSave; readonly lastOnlineAtMs: number }
  | { readonly kind: 'AUTHENTICATED_OFFLINE_CACHE'; readonly remote: AccountRemoteSave | null; readonly lastOnlineAtMs: number | null };

export interface AccountRemoteSave {
  readonly revision: number;
  readonly schemaVersion: number;
  readonly snapshot: Readonly<Record<string, unknown>>;
}

export type AccountMetaMutationRequest =
  | { readonly requestId: string; readonly action: 'CHARACTER_LEVEL'; readonly characterId: string; readonly targetLevel: number }
  | { readonly requestId: string; readonly action: 'CHARACTER_PLUS_LEVEL'; readonly characterId: string; readonly targetPlusLevel: number }
  | { readonly requestId: string; readonly action: 'EVOLUTION_UNLOCK' | 'EVOLUTION_SELECT'; readonly characterId: string; readonly formId: string }
  | { readonly requestId: string; readonly action: 'DECK_SET'; readonly deckSlotIds: readonly string[] }
  | { readonly requestId: string; readonly action: 'BASE_WEAPON_SELECT'; readonly baseWeaponId: string };

export interface AccountRecruitmentRequest {
  readonly requestId: string;
  readonly bannerId: string;
  readonly count: 1 | 10;
  readonly duplicatePolicy: 'APPLY_PLUS' | 'DISMANTLE';
}

export interface AccountSweepRequest {
  readonly requestId: string;
  readonly stageId: string;
}

export interface AccountMutationResponse extends AccountRemoteSave {
  readonly replayed: boolean;
  readonly result: unknown;
}

export type AccountTrustedBattleKind = 'MAIN' | 'SPECIAL';
export type AccountTrustedBattleCommand =
  | { readonly tick: number; readonly type: 'SPAWN'; readonly slotId: string }
  | { readonly tick: number; readonly type: 'UPGRADE_SUPPLY' }
  | { readonly tick: number; readonly type: 'FIRE_BASE_WEAPON' };

export interface AccountTrustedBattleStart {
  readonly battleId: string;
  readonly kind: AccountTrustedBattleKind;
  readonly targetId: string;
  readonly startRevision: number;
  readonly initialStateHash: string;
  readonly expiresAtMs: number;
}

export interface AccountTrustedBattleCompletion {
  readonly battleId: string;
  readonly kind: AccountTrustedBattleKind;
  readonly targetId: string;
  readonly winner: 'PLAYER' | 'ENEMY' | 'DRAW';
  readonly clearFrames: number;
  readonly finalStateHash: string;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
  readonly completedAtMs: number;
}

export interface AccountTrustedBattleCompleteResponse {
  readonly replayed: boolean;
  readonly result: AccountTrustedBattleCompletion;
}

export interface AccountTrustedBattleClaimResponse extends AccountRemoteSave {
  readonly replayed: boolean;
  readonly awarded: boolean;
  readonly completion: AccountTrustedBattleCompletion;
  readonly result: unknown;
}

type CachedAccountState = {
  readonly sessionFingerprint: string;
  readonly remote: AccountRemoteSave;
  readonly lastOnlineAtMs: number;
};

type StateSubscriber = (state: AccountClientState) => void;

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const ACCOUNT_CACHE_KEY = 'frontline.account.readCache.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

let currentToken: string | null = null;
let currentState: AccountClientState = { kind: 'GUEST_LOCAL' };
const subscribers = new Set<StateSubscriber>();

function browserWindow(): Window | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseRemoteSave(value: unknown): AccountRemoteSave | null {
  if (!isRecord(value)) return null;
  const revision = nonNegativeInteger(value.revision);
  const schemaVersion = nonNegativeInteger(value.schemaVersion);
  if (revision === null || schemaVersion === null || !isRecord(value.snapshot)) return null;
  return { revision, schemaVersion, snapshot: value.snapshot };
}

function parseMutationResponse(value: unknown): AccountMutationResponse | null {
  if (!isRecord(value)) return null;
  const remote = parseRemoteSave(value);
  if (!remote || typeof value.replayed !== 'boolean' || !Object.hasOwn(value, 'result')) return null;
  return { ...remote, replayed: value.replayed, result: value.result };
}

function parseTrustedBattleKind(value: unknown): AccountTrustedBattleKind | null {
  return value === 'MAIN' || value === 'SPECIAL' ? value : null;
}

function parseTrustedBattleStart(value: unknown): AccountTrustedBattleStart | null {
  if (!isRecord(value)) return null;
  const battleId = nonEmptyString(value.battleId);
  const kind = parseTrustedBattleKind(value.kind);
  const targetId = nonEmptyString(value.targetId);
  const startRevision = nonNegativeInteger(value.startRevision);
  const initialStateHash = nonEmptyString(value.initialStateHash);
  const expiresAtMs = nonNegativeInteger(value.expiresAtMs);
  if (!battleId || !kind || !targetId || startRevision === null || !initialStateHash || expiresAtMs === null) return null;
  return { battleId, kind, targetId, startRevision, initialStateHash, expiresAtMs };
}

function parseTrustedBattleCompletion(value: unknown): AccountTrustedBattleCompletion | null {
  if (!isRecord(value)) return null;
  const battleId = nonEmptyString(value.battleId);
  const kind = parseTrustedBattleKind(value.kind);
  const targetId = nonEmptyString(value.targetId);
  const winner = value.winner === 'PLAYER' || value.winner === 'ENEMY' || value.winner === 'DRAW' ? value.winner : null;
  const clearFrames = nonNegativeInteger(value.clearFrames);
  const finalStateHash = nonEmptyString(value.finalStateHash);
  const playerBaseHp = nonNegativeInteger(value.playerBaseHp);
  const enemyBaseHp = nonNegativeInteger(value.enemyBaseHp);
  const completedAtMs = nonNegativeInteger(value.completedAtMs);
  if (!battleId || !kind || !targetId || !winner || clearFrames === null || !finalStateHash || playerBaseHp === null || enemyBaseHp === null || completedAtMs === null) return null;
  return { battleId, kind, targetId, winner, clearFrames, finalStateHash, playerBaseHp, enemyBaseHp, completedAtMs };
}

function parseTrustedBattleCompleteResponse(value: unknown): AccountTrustedBattleCompleteResponse | null {
  if (!isRecord(value) || typeof value.replayed !== 'boolean') return null;
  const result = parseTrustedBattleCompletion(value.result);
  return result ? { replayed: value.replayed, result } : null;
}

function parseTrustedBattleClaimResponse(value: unknown): AccountTrustedBattleClaimResponse | null {
  if (!isRecord(value)) return null;
  const remote = parseRemoteSave(value);
  const completion = parseTrustedBattleCompletion(value.completion);
  if (!remote || !completion || typeof value.replayed !== 'boolean' || typeof value.awarded !== 'boolean' || !Object.hasOwn(value, 'result')) return null;
  return { ...remote, replayed: value.replayed, awarded: value.awarded, completion, result: value.result };
}

function setState(state: AccountClientState): void {
  currentState = state;
  for (const subscriber of subscribers) subscriber(state);
}

function storeSessionToken(token: string | null): void {
  const browser = browserWindow();
  if (!browser) return;
  try {
    if (token === null) browser.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    else browser.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch { /* session persistence is best-effort */ }
}

function loadSessionToken(): string | null {
  const browser = browserWindow();
  if (!browser) return null;
  try {
    const token = browser.sessionStorage.getItem(SESSION_TOKEN_KEY);
    return token && SESSION_TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

async function sessionFingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function saveReadCache(token: string, remote: AccountRemoteSave, lastOnlineAtMs: number): Promise<void> {
  const browser = browserWindow();
  if (!browser) return;
  const cached: CachedAccountState = { sessionFingerprint: await sessionFingerprint(token), remote, lastOnlineAtMs };
  try { browser.localStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(cached)); } catch { /* read cache is optional */ }
}

async function loadReadCache(token: string): Promise<CachedAccountState | null> {
  const browser = browserWindow();
  if (!browser) return null;
  try {
    const raw = browser.localStorage.getItem(ACCOUNT_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.sessionFingerprint !== 'string') return null;
    if (parsed.sessionFingerprint !== await sessionFingerprint(token)) return null;
    const remote = parseRemoteSave(parsed.remote);
    const lastOnlineAtMs = nonNegativeInteger(parsed.lastOnlineAtMs);
    if (!remote || lastOnlineAtMs === null) return null;
    return { sessionFingerprint: parsed.sessionFingerprint, remote, lastOnlineAtMs };
  } catch {
    return null;
  }
}

function clearReadCache(): void {
  const browser = browserWindow();
  if (!browser) return;
  try { browser.localStorage.removeItem(ACCOUNT_CACHE_KEY); } catch { /* optional */ }
}

class AccountApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`account api error:${status}:${code}`);
  }
}

export class AccountRevisionConflictError extends Error {
  constructor(readonly currentRevision: number | null) {
    super(`account revision conflict:${currentRevision ?? 'unknown'}`);
  }
}

async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!currentToken) throw new Error('authenticated account session is not available');
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${currentToken}`);
  if (init.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${resolveCoopApiOrigin()}${path}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'http_error';
    if (response.status === 409 && code === 'revision_conflict') {
      const revision = isRecord(payload) ? nonNegativeInteger(payload.currentRevision) : null;
      throw new AccountRevisionConflictError(revision);
    }
    throw new AccountApiError(response.status, code);
  }
  return payload;
}

async function enterOfflineCache(token: string): Promise<void> {
  const cached = await loadReadCache(token);
  setState({
    kind: 'AUTHENTICATED_OFFLINE_CACHE',
    remote: cached?.remote ?? null,
    lastOnlineAtMs: cached?.lastOnlineAtMs ?? null,
  });
}

async function acceptRemoteSave(token: string, remote: AccountRemoteSave, nowMs = Date.now()): Promise<AccountRemoteSave> {
  setState({ kind: 'AUTHENTICATED_ONLINE', remote, lastOnlineAtMs: nowMs });
  await saveReadCache(token, remote, nowMs);
  return remote;
}

export function getAccountClientState(): AccountClientState {
  return currentState;
}

export function subscribeAccountClientState(subscriber: StateSubscriber): () => void {
  subscribers.add(subscriber);
  subscriber(currentState);
  return () => subscribers.delete(subscriber);
}

export async function setAuthenticatedAccountSession(token: string): Promise<AccountClientState> {
  const normalized = token.trim();
  if (!SESSION_TOKEN_PATTERN.test(normalized)) throw new Error('authenticated account session token format is invalid');
  currentToken = normalized;
  storeSessionToken(normalized);
  await refreshAuthenticatedAccount();
  return currentState;
}

export async function restoreAuthenticatedAccountSession(): Promise<AccountClientState> {
  const token = loadSessionToken();
  if (!token) {
    currentToken = null;
    setState({ kind: 'GUEST_LOCAL' });
    return currentState;
  }
  currentToken = token;
  await refreshAuthenticatedAccount();
  return currentState;
}

export async function refreshAuthenticatedAccount(nowMs = Date.now()): Promise<AccountRemoteSave | null> {
  const token = currentToken;
  if (!token) {
    setState({ kind: 'GUEST_LOCAL' });
    return null;
  }
  try {
    const payload = await requestJson('/api/account');
    const remote = parseRemoteSave(payload);
    if (!remote) throw new Error('authenticated account response shape is invalid');
    return await acceptRemoteSave(token, remote, nowMs);
  } catch (error) {
    if (error instanceof AccountApiError && error.status === 401) {
      currentToken = null;
      storeSessionToken(null);
      clearReadCache();
      setState({ kind: 'GUEST_LOCAL' });
      return null;
    }
    await enterOfflineCache(token);
    return null;
  }
}

function requireOnlineRevision(): number {
  if (currentState.kind !== 'AUTHENTICATED_ONLINE') throw new Error('account mutation requires AUTHENTICATED_ONLINE state');
  return currentState.remote.revision;
}

async function handleOnlineActionError(token: string, error: unknown): Promise<never> {
  if (error instanceof AccountRevisionConflictError) {
    await refreshAuthenticatedAccount();
    throw error;
  }
  if (error instanceof AccountApiError && error.status === 401) {
    currentToken = null;
    storeSessionToken(null);
    clearReadCache();
    setState({ kind: 'GUEST_LOCAL' });
    throw error;
  }
  await enterOfflineCache(token);
  throw error;
}

async function mutate(path: string, request: Readonly<Record<string, unknown>>): Promise<AccountMutationResponse> {
  const token = currentToken;
  if (!token) throw new Error('authenticated account session is not available');
  const expectedRevision = requireOnlineRevision();
  try {
    const payload = await requestJson(path, {
      method: 'POST',
      body: JSON.stringify({ ...request, expectedRevision }),
    });
    const response = parseMutationResponse(payload);
    if (!response) throw new Error('authenticated account mutation response shape is invalid');
    await acceptRemoteSave(token, response);
    return response;
  } catch (error) {
    return handleOnlineActionError(token, error);
  }
}

export function mutateAuthenticatedAccountMeta(request: AccountMetaMutationRequest): Promise<AccountMutationResponse> {
  return mutate('/api/account/meta', request as unknown as Readonly<Record<string, unknown>>);
}

export function mutateAuthenticatedAccountRecruitment(request: AccountRecruitmentRequest): Promise<AccountMutationResponse> {
  return mutate('/api/account/recruitment', request as unknown as Readonly<Record<string, unknown>>);
}

export function mutateAuthenticatedAccountSweep(request: AccountSweepRequest): Promise<AccountMutationResponse> {
  return mutate('/api/account/sweep', request as unknown as Readonly<Record<string, unknown>>);
}

export async function startAuthenticatedTrustedBattle(kind: AccountTrustedBattleKind, targetId: string): Promise<AccountTrustedBattleStart> {
  const token = currentToken;
  if (!token) throw new Error('authenticated account session is not available');
  const localRevision = requireOnlineRevision();
  try {
    const payload = await requestJson('/api/account/battles/start', {
      method: 'POST',
      body: JSON.stringify({ kind, targetId }),
    });
    const result = parseTrustedBattleStart(payload);
    if (!result) throw new Error('trusted battle start response shape is invalid');
    if (result.startRevision !== localRevision) {
      await refreshAuthenticatedAccount();
      throw new AccountRevisionConflictError(result.startRevision);
    }
    return result;
  } catch (error) {
    return handleOnlineActionError(token, error);
  }
}

export async function completeAuthenticatedTrustedBattle(
  battleId: string,
  commands: readonly AccountTrustedBattleCommand[],
): Promise<AccountTrustedBattleCompleteResponse> {
  const token = currentToken;
  if (!token) throw new Error('authenticated account session is not available');
  requireOnlineRevision();
  try {
    const payload = await requestJson('/api/account/battles/complete', {
      method: 'POST',
      body: JSON.stringify({ battleId, commands }),
    });
    const result = parseTrustedBattleCompleteResponse(payload);
    if (!result) throw new Error('trusted battle completion response shape is invalid');
    return result;
  } catch (error) {
    return handleOnlineActionError(token, error);
  }
}

export async function claimAuthenticatedTrustedBattle(battleId: string): Promise<AccountTrustedBattleClaimResponse> {
  const token = currentToken;
  if (!token) throw new Error('authenticated account session is not available');
  const expectedRevision = requireOnlineRevision();
  try {
    const payload = await requestJson('/api/account/battles/claim', {
      method: 'POST',
      body: JSON.stringify({ battleId, expectedRevision }),
    });
    const result = parseTrustedBattleClaimResponse(payload);
    if (!result) throw new Error('trusted battle claim response shape is invalid');
    await acceptRemoteSave(token, result);
    return result;
  } catch (error) {
    return handleOnlineActionError(token, error);
  }
}

export async function logoutAuthenticatedAccount(): Promise<{ readonly serverRevoked: boolean }> {
  let serverRevoked = false;
  if (currentToken) {
    try {
      await requestJson('/api/account/logout', { method: 'POST' });
      serverRevoked = true;
    } catch { /* local logout must still remove the device credential */ }
  }
  currentToken = null;
  storeSessionToken(null);
  clearReadCache();
  setState({ kind: 'GUEST_LOCAL' });
  return { serverRevoked };
}

export const __accountNetworkTestOnly = {
  parseRemoteSave,
  parseMutationResponse,
  parseTrustedBattleStart,
  parseTrustedBattleCompletion,
  parseTrustedBattleCompleteResponse,
  parseTrustedBattleClaimResponse,
};
