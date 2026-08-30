import { issueAuthSessionForVerifiedIdentity } from './auth-session-authority.ts';
import {
  GoogleIdTokenProviderError,
  GoogleIdTokenValidationError,
  verifyGoogleIdToken,
} from './google-id-token-authority.ts';

export interface AuthHttpEnvironment {
  readonly DB: D1Database;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly AUTH_ALLOWED_ORIGINS?: string;
}

export interface AuthHttpResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

const AUTH_PATHS = new Set(['/api/auth/config', '/api/auth/google']);
const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_GOOGLE_CREDENTIAL_LENGTH = 16_384;

class AuthRequestError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function configuredOrigins(raw: string | undefined): ReadonlySet<string> {
  const origins = new Set<string>();
  if (!raw) return origins;
  for (const entry of raw.split(',')) {
    const normalized = normalizeOrigin(entry.trim());
    if (normalized) origins.add(normalized);
  }
  return origins;
}

export function isAuthRequestOriginAllowed(request: Request, rawAllowedOrigins: string | undefined): boolean {
  const originHeader = request.headers.get('origin');
  if (!originHeader) return true;
  const origin = normalizeOrigin(originHeader);
  if (!origin) return false;
  if (origin === new URL(request.url).origin) return true;
  return configuredOrigins(rawAllowedOrigins).has(origin);
}

function authCorsHeaders(request: Request, rawAllowedOrigins: string | undefined): Readonly<Record<string, string>> {
  const originHeader = request.headers.get('origin');
  const origin = originHeader ? normalizeOrigin(originHeader) : null;
  const headers: Record<string, string> = {
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store',
    vary: 'Origin',
  };
  if (origin && isAuthRequestOriginAllowed(request, rawAllowedOrigins)) headers['access-control-allow-origin'] = origin;
  return headers;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AuthRequestError('request body must be valid JSON');
  }
  if (!isRecord(value)) throw new AuthRequestError('request body must be an object');
  return value;
}

function googleCredential(value: unknown): string {
  if (typeof value !== 'string') throw new AuthRequestError('credential must be a string');
  const trimmed = value.trim();
  if (trimmed.length < 32 || trimmed.length > MAX_GOOGLE_CREDENTIAL_LENGTH) {
    throw new AuthRequestError(`credential must be 32..${MAX_GOOGLE_CREDENTIAL_LENGTH} characters`);
  }
  return trimmed;
}

function googleClientId(env: AuthHttpEnvironment): string | null {
  const value = env.GOOGLE_CLIENT_ID?.trim();
  return value && value.length > 0 ? value : null;
}

export async function resolveAuthHttp(
  request: Request,
  env: AuthHttpEnvironment,
  nowMs = Date.now(),
): Promise<AuthHttpResult | null> {
  const url = new URL(request.url);
  if (!AUTH_PATHS.has(url.pathname)) return null;
  const headers = authCorsHeaders(request, env.AUTH_ALLOWED_ORIGINS);

  if (!isAuthRequestOriginAllowed(request, env.AUTH_ALLOWED_ORIGINS)) {
    return { status: 403, body: { error: 'auth_origin_denied' }, headers };
  }

  if (request.method === 'OPTIONS') return { status: 204, body: null, headers };

  if (request.method === 'GET' && url.pathname === '/api/auth/config') {
    const clientId = googleClientId(env);
    return {
      status: 200,
      body: {
        google: {
          enabled: clientId !== null,
          clientId,
        },
      },
      headers,
    };
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/google') {
    const clientId = googleClientId(env);
    if (!clientId) return { status: 503, body: { error: 'google_auth_not_configured' }, headers };
    try {
      const body = await readJsonObject(request);
      const identity = await verifyGoogleIdToken(googleCredential(body.credential), clientId, nowMs);
      const session = await issueAuthSessionForVerifiedIdentity(env.DB, identity, nowMs + AUTH_SESSION_TTL_MS, nowMs);
      return {
        status: 200,
        body: {
          provider: 'google',
          sessionToken: session.token,
          expiresAtMs: session.expiresAtMs,
        },
        headers,
      };
    } catch (error) {
      if (error instanceof AuthRequestError) {
        return { status: 400, body: { error: 'invalid_request', message: error.message }, headers };
      }
      if (error instanceof GoogleIdTokenValidationError) {
        return { status: 401, body: { error: 'invalid_google_credential' }, headers };
      }
      if (error instanceof GoogleIdTokenProviderError) {
        return { status: 503, body: { error: 'google_verification_unavailable' }, headers };
      }
      throw error;
    }
  }

  return {
    status: 405,
    body: { error: 'method_not_allowed' },
    headers: { ...headers, allow: url.pathname === '/api/auth/config' ? 'GET,OPTIONS' : 'POST,OPTIONS' },
  };
}

export const __authHttpTestOnly = {
  configuredOrigins,
  googleCredential,
};
