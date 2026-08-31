import type { ProfileLoadout } from '@frontline/sim/achievement-profile';
import { getAccountClientState } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export interface AccountRemoteProfile {
  readonly revision: number;
  readonly schemaVersion: number;
  readonly profile: Readonly<Record<string, unknown>>;
  readonly evaluations: readonly Readonly<Record<string, unknown>>[];
  readonly completedCount: number;
}

export interface AccountProfileMutationResponse extends AccountRemoteProfile {
  readonly replayed: boolean;
  readonly result: unknown;
}

export interface AccountProfileLoadoutRequest {
  readonly requestId: string;
  readonly profileLoadout: ProfileLoadout;
}

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const PROFILE_CACHE_KEY = 'frontline.account.profileReadCache.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

let currentProfile: AccountRemoteProfile | null = null;
let currentProfileSessionFingerprint: string | null = null;

type CachedProfile = {
  readonly sessionFingerprint: string;
  readonly remote: AccountRemoteProfile;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : null;
}

function loadSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
    return token && SESSION_TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

async function sessionFingerprint(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function setCurrentProfile(remote: AccountRemoteProfile | null, fingerprint: string | null): AccountRemoteProfile | null {
  currentProfile = remote;
  currentProfileSessionFingerprint = remote ? fingerprint : null;
  return remote;
}

export function parseAccountRemoteProfile(value: unknown): AccountRemoteProfile | null {
  if (!isRecord(value)) return null;
  const revision = nonNegativeInteger(value.revision);
  const schemaVersion = nonNegativeInteger(value.schemaVersion);
  const completedCount = nonNegativeInteger(value.completedCount);
  if (revision === null || schemaVersion === null || completedCount === null || !isRecord(value.profile) || !Array.isArray(value.evaluations)) return null;
  if (!value.evaluations.every((entry) => isRecord(entry))) return null;
  return { revision, schemaVersion, profile: value.profile, evaluations: value.evaluations, completedCount };
}

function parseMutationResponse(value: unknown): AccountProfileMutationResponse | null {
  if (!isRecord(value) || typeof value.replayed !== 'boolean' || !Object.hasOwn(value, 'result')) return null;
  const remote = parseAccountRemoteProfile(value);
  return remote ? { ...remote, replayed: value.replayed, result: value.result } : null;
}

async function saveCache(token: string, remote: AccountRemoteProfile): Promise<void> {
  if (typeof window === 'undefined') return;
  const cached: CachedProfile = { sessionFingerprint: await sessionFingerprint(token), remote };
  try { window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached)); } catch { /* read cache only */ }
}

async function loadCache(token: string): Promise<AccountRemoteProfile | null> {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const decoded: unknown = JSON.parse(raw);
    if (!isRecord(decoded) || typeof decoded.sessionFingerprint !== 'string') return null;
    if (decoded.sessionFingerprint !== await sessionFingerprint(token)) return null;
    return parseAccountRemoteProfile(decoded.remote);
  } catch {
    return null;
  }
}

async function requestProfile(token: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init?.body !== undefined) headers.set('content-type', 'application/json');
  return fetch(`${resolveCoopApiOrigin()}/api/account/profile`, { ...init, headers });
}

export async function loadAuthenticatedAccountProfile(): Promise<AccountRemoteProfile | null> {
  const token = loadSessionToken();
  if (!token) return setCurrentProfile(null, null);
  const fingerprint = await sessionFingerprint(token);
  if (currentProfileSessionFingerprint !== fingerprint) setCurrentProfile(null, null);
  const state = getAccountClientState();
  if (state.kind === 'AUTHENTICATED_OFFLINE_CACHE') {
    return setCurrentProfile(await loadCache(token), fingerprint);
  }
  if (state.kind === 'GUEST_LOCAL') return setCurrentProfile(null, null);
  try {
    const response = await requestProfile(token);
    if (!response.ok) {
      if (response.status === 401) return setCurrentProfile(null, null);
      throw new Error(`account profile read failed:${response.status}`);
    }
    const payload: unknown = await response.json();
    const remote = parseAccountRemoteProfile(payload);
    if (!remote) throw new Error('account profile response shape is invalid');
    setCurrentProfile(remote, fingerprint);
    await saveCache(token, remote);
    return remote;
  } catch {
    return setCurrentProfile(await loadCache(token), fingerprint);
  }
}

export class AccountProfileRevisionConflictError extends Error {
  constructor(readonly currentRevision: number | null) {
    super(`account profile revision conflict:${currentRevision ?? 'unknown'}`);
  }
}

export async function mutateAuthenticatedAccountProfile(request: AccountProfileLoadoutRequest): Promise<AccountProfileMutationResponse> {
  const token = loadSessionToken();
  if (!token) throw new Error('authenticated account session is not available');
  if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('account profile mutation requires AUTHENTICATED_ONLINE state');
  const fingerprint = await sessionFingerprint(token);
  const current = currentProfile && currentProfileSessionFingerprint === fingerprint
    ? currentProfile
    : await loadAuthenticatedAccountProfile();
  if (!current) throw new Error('authoritative account profile is not available');
  const response = await requestProfile(token, {
    method: 'POST',
    body: JSON.stringify({ ...request, expectedRevision: current.revision }),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409 && isRecord(payload) && payload.error === 'revision_conflict') {
      const revision = nonNegativeInteger(payload.currentRevision);
      await loadAuthenticatedAccountProfile();
      throw new AccountProfileRevisionConflictError(revision);
    }
    throw new Error(`account profile mutation failed:${response.status}`);
  }
  const parsed = parseMutationResponse(payload);
  if (!parsed) throw new Error('account profile mutation response shape is invalid');
  setCurrentProfile(parsed, fingerprint);
  await saveCache(token, parsed);
  return parsed;
}

export function clearAccountProfileNetworkState(): void {
  setCurrentProfile(null, null);
}

export const __accountProfileNetworkTestOnly = {
  SESSION_TOKEN_KEY,
  PROFILE_CACHE_KEY,
  parseAccountRemoteProfile,
  parseMutationResponse,
};
