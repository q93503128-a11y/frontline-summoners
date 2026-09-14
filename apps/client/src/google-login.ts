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

async function readJsonApiResponse(response: Response, purpose: string): Promise<unknown> {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new Error(`${purpose} 계정 API가 게임 페이지와 연결되지 않았습니다. API 서버 주소/배포 연결을 확인해 주세요.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${purpose} 계정 API가 올바른 JSON을 반환하지 않았습니다.`);
  }
}

export async function fetchGoogleAuthConfig(): Promise<GoogleAuthConfig> {
  const response = await fetch(`${resolveCoopApiOrigin()}/api/auth/config`, { method: 'GET' });
  const payload = await readJsonApiResponse(response, 'Google 로그인');
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    if (code === 'auth_origin_denied') throw new Error('현재 게임 주소가 계정 API 허용 목록에 없습니다.');
    throw new Error(`Google 로그인 설정을 불러오지 못했습니다: ${code}`);
  }
  const config = parseGoogleAuthConfig(payload);
  if (!config) throw new Error('Google 로그인 설정 JSON 구조가 올바르지 않습니다. 계정 API 배포 버전을 확인해 주세요.');
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
  const payload = await readJsonApiResponse(response, 'Google 로그인');
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    if (code === 'google_auth_not_configured') throw new Error('Google 로그인이 계정 서버에 아직 설정되지 않았습니다.');
    if (code === 'auth_origin_denied') throw new Error('현재 게임 주소가 계정 API 허용 목록에 없습니다.');
    if (code === 'invalid_google_credential') throw new Error('Google 로그인 정보가 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.');
    throw new Error(`Google 로그인에 실패했습니다: ${code}`);
  }
  const session = parseGoogleSessionResponse(payload);
  if (!session) throw new Error('Google 로그인 세션 JSON 구조가 올바르지 않습니다. 계정 API 배포 버전을 확인해 주세요.');
  return setAuthenticatedAccountSession(session.sessionToken);
}

export const __googleLoginTestOnly = {
  parseGoogleAuthConfig,
  parseGoogleSessionResponse,
  readJsonApiResponse,
};
