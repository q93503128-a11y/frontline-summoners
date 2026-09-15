import {
  LocalAuthInputError,
  LocalAuthInvalidCredentialsError,
  LocalAuthUsernameTakenError,
  loginLocalPasswordAccount,
  registerLocalPasswordAccount,
} from './local-password-authority.ts';

export interface AuthHttpEnvironment {
  readonly DB: D1Database;
  readonly AUTH_ALLOWED_ORIGINS?: string;
  // Kept only so older deployment bindings can be removed independently.
  readonly GOOGLE_CLIENT_ID?: string;
}

export interface AuthHttpResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

const AUTH_PATHS = new Set([
  '/api/auth/config',
  '/api/auth/login',
  '/api/auth/register',
]);
const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

function sessionBody(session: { readonly token: string; readonly expiresAtMs: number }): unknown {
  return {
    provider: 'local',
    sessionToken: session.token,
    expiresAtMs: session.expiresAtMs,
  };
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
    return {
      status: 200,
      body: {
        local: {
          enabled: true,
          usernameMinLength: 4,
          usernameMaxLength: 24,
          passwordMinLength: 10,
          passwordMaxLength: 128,
        },
      },
      headers,
    };
  }

  if (request.method === 'POST' && (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/register')) {
    try {
      const body = await readJsonObject(request);
      const expiresAtMs = nowMs + AUTH_SESSION_TTL_MS;
      const isRegister = url.pathname === '/api/auth/register';
      const session = isRegister
        ? await registerLocalPasswordAccount(env.DB, body.username, body.password, expiresAtMs, nowMs)
        : await loginLocalPasswordAccount(env.DB, body.username, body.password, expiresAtMs, nowMs);
      return { status: isRegister ? 201 : 200, body: sessionBody(session), headers };
    } catch (error) {
      if (error instanceof AuthRequestError || error instanceof LocalAuthInputError) {
        return { status: 400, body: { error: 'invalid_request', message: error.message }, headers };
      }
      if (error instanceof LocalAuthUsernameTakenError) {
        return { status: 409, body: { error: 'username_taken' }, headers };
      }
      if (error instanceof LocalAuthInvalidCredentialsError) {
        return { status: 401, body: { error: 'invalid_credentials' }, headers };
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
};
