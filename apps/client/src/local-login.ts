import { setAuthenticatedAccountSession, type AccountClientState } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
const USERNAME_PATTERN = /^[a-z0-9_]{4,24}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) throw new Error('아이디는 영문 소문자·숫자·_ 조합 4~24자로 입력하세요.');
  return normalized;
}

function validatePassword(password: string): string {
  if (password.length < 10 || password.length > 128) throw new Error('비밀번호는 10~128자로 입력하세요.');
  return password;
}

function sessionFromPayload(value: unknown): { readonly sessionToken: string; readonly expiresAtMs: number } | null {
  if (!isRecord(value) || typeof value.sessionToken !== 'string' || !SESSION_TOKEN_PATTERN.test(value.sessionToken)) return null;
  if (!Number.isSafeInteger(value.expiresAtMs) || (value.expiresAtMs as number) <= 0) return null;
  return { sessionToken: value.sessionToken, expiresAtMs: value.expiresAtMs as number };
}

function errorMessage(payload: unknown, status: number, mode: 'login' | 'register'): string {
  const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : '';
  if (code === 'username_taken') return '이미 사용 중인 아이디입니다.';
  if (code === 'invalid_credentials') return '아이디 또는 비밀번호가 올바르지 않습니다.';
  if (code === 'auth_origin_denied') return '현재 사이트 주소가 계정 서버의 허용 목록에 없습니다.';
  if (code === 'invalid_request' && isRecord(payload) && typeof payload.message === 'string') {
    return payload.message.includes('username')
      ? '아이디는 영문 소문자·숫자·_ 조합 4~24자로 입력하세요.'
      : payload.message.includes('password')
        ? '비밀번호는 10~128자로 입력하세요.'
        : '계정 입력값을 확인해 주세요.';
  }
  if (status === 404 || status === 405) return '계정 API 서버에 로그인 기능이 아직 배포되지 않았습니다.';
  return mode === 'login' ? `아이디 로그인에 실패했습니다. (HTTP ${status})` : `아이디 생성에 실패했습니다. (HTTP ${status})`;
}

async function requestLocalSession(mode: 'login' | 'register', username: string, password: string): Promise<AccountClientState> {
  const normalizedUsername = normalizeUsername(username);
  const checkedPassword = validatePassword(password);
  const response = await fetch(`${resolveCoopApiOrigin()}/api/auth/local/${mode}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: normalizedUsername, password: checkedPassword }),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};
  if (!response.ok) throw new Error(errorMessage(payload, response.status, mode));
  const session = sessionFromPayload(payload);
  if (!session) {
    throw new Error('계정 API 서버 응답이 올바르지 않습니다. 웹 페이지와 API 서버 연결 설정을 확인하세요.');
  }
  return setAuthenticatedAccountSession(session.sessionToken);
}

export function loginWithLocalCredentials(username: string, password: string): Promise<AccountClientState> {
  return requestLocalSession('login', username, password);
}

export function registerLocalCredentials(username: string, password: string): Promise<AccountClientState> {
  return requestLocalSession('register', username, password);
}

export const __localLoginTestOnly = {
  normalizeUsername,
  validatePassword,
  sessionFromPayload,
  errorMessage,
};
