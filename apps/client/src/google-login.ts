import { setAuthenticatedAccountSession, type AccountClientState } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export interface GoogleAuthConfig {
  readonly enabled: boolean;
  readonly clientId: string | null;
}

type GoogleSessionResponse = {
  readonly sessionToken: string;
  readonly expiresAtMs: number;
};

const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseGoogleAuthConfig(value: unknown): GoogleAuthConfig | null {
  if (!isRecord(value) || !isRecord(value.google) || typeof value.google.enabled !== 'boolean') return null;
  const clientId = value.google.clientId;
  if (clientId !== null && typeof clientId !== 'string') return null;
  if (value.google.enabled && (typeof clientId !== 'string' || clientId.trim().length === 0)) return null;
  return { enabled: value.google.enabled, clientId: typeof clientId === 'string' ? clientId : null };
}

function parseGoogleSessionResponse(value: unknown): GoogleSessionResponse | null {
  if (!isRecord(value) || typeof value.sessionToken !== 'string' || !SESSION_TOKEN_PATTERN.test(value.sessionToken)) return null;
  if (!Number.isSafeInteger(value.expiresAtMs) || (value.expiresAtMs as number) <= 0) return null;
  return { sessionToken: value.sessionToken, expiresAtMs: value.expiresAtMs as number };
}

export async function fetchGoogleAuthConfig(): Promise<GoogleAuthConfig> {
  const response = await fetch(`${resolveCoopApiOrigin()}/api/auth/config`, { method: 'GET' });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    throw new Error(`Google 로그인 설정을 불러오지 못했습니다: ${code}`);
  }
  const config = parseGoogleAuthConfig(payload);
  if (!config) throw new Error('Google 로그인 설정 응답 형식이 올바르지 않습니다.');
  return config;
}

export async function loginWithGoogleCredential(credential: string): Promise<AccountClientState> {
  const trimmed = credential.trim();
  if (trimmed.length < 32 || trimmed.length > 16_384) throw new Error('Google 로그인 credential 형식이 올바르지 않습니다.');
  const response = await fetch(`${resolveCoopApiOrigin()}/api/auth/google`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential: trimmed }),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    throw new Error(`Google 로그인에 실패했습니다: ${code}`);
  }
  const session = parseGoogleSessionResponse(payload);
  if (!session) throw new Error('Google 로그인 세션 응답 형식이 올바르지 않습니다.');
  return setAuthenticatedAccountSession(session.sessionToken);
}

export const __googleLoginTestOnly = {
  parseGoogleAuthConfig,
  parseGoogleSessionResponse,
};
