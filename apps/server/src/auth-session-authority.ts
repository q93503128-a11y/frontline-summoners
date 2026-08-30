import { initializeAccountSave } from './account-save-authority.ts';

export const AUTH_IDENTITY_PROVIDERS = ['google', 'email'] as const;
export type AuthIdentityProvider = (typeof AUTH_IDENTITY_PROVIDERS)[number];

export interface VerifiedAuthIdentity {
  readonly provider: AuthIdentityProvider;
  readonly providerSubject: string;
}

export interface AuthSessionPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly expiresAtMs: number;
}

export interface IssuedAuthSession extends AuthSessionPrincipal {
  readonly token: string;
}

type IdentityRow = {
  readonly user_id: string;
};

type SessionRow = {
  readonly session_id: string;
  readonly user_id: string;
  readonly expires_at: number;
  readonly revoked_at: number | null;
};

const AUTH_PROVIDER_SET = new Set<string>(AUTH_IDENTITY_PROVIDERS);
const SESSION_TOKEN_BYTES = 32;
const MAX_PROVIDER_SUBJECT_LENGTH = 512;

function normalizeProvider(value: string): AuthIdentityProvider {
  const provider = value.trim().toLowerCase();
  if (!AUTH_PROVIDER_SET.has(provider)) throw new Error(`unsupported auth identity provider:${provider}`);
  return provider as AuthIdentityProvider;
}

function normalizeProviderSubject(provider: AuthIdentityProvider, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_PROVIDER_SUBJECT_LENGTH) {
    throw new Error(`auth provider subject must be 1..${MAX_PROVIDER_SUBJECT_LENGTH} characters`);
  }
  return provider === 'email' ? trimmed.toLowerCase() : trimmed;
}

function normalizeVerifiedIdentity(identity: VerifiedAuthIdentity): VerifiedAuthIdentity {
  const provider = normalizeProvider(identity.provider);
  return { provider, providerSubject: normalizeProviderSubject(provider, identity.providerSubject) };
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(SESSION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function hashAuthSessionToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function parseAuthorizationBearerHeader(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer ([0-9a-f]{64})$/i.exec(header.trim());
  return match?.[1] ?? null;
}

async function lookupIdentityUserId(db: D1Database, identity: VerifiedAuthIdentity): Promise<string | null> {
  const row = await db.prepare(
    'SELECT user_id FROM auth_identities WHERE provider = ?1 AND provider_subject = ?2',
  ).bind(identity.provider, identity.providerSubject).first<IdentityRow>();
  return row?.user_id ?? null;
}

export async function resolveOrCreateUserForVerifiedIdentity(
  db: D1Database,
  rawIdentity: VerifiedAuthIdentity,
  nowMs = Date.now(),
): Promise<string> {
  const identity = normalizeVerifiedIdentity(rawIdentity);
  const existing = await lookupIdentityUserId(db, identity);
  if (existing) {
    await initializeAccountSave(db, existing, undefined, nowMs);
    return existing;
  }

  const userId = crypto.randomUUID();
  try {
    const writes = await db.batch([
      db.prepare('INSERT INTO users (id) VALUES (?1)').bind(userId),
      db.prepare(
        'INSERT INTO auth_identities (provider, provider_subject, user_id) VALUES (?1, ?2, ?3)',
      ).bind(identity.provider, identity.providerSubject, userId),
    ]);
    if ((writes[0]?.meta.changes ?? 0) !== 1 || (writes[1]?.meta.changes ?? 0) !== 1) {
      throw new Error('verified identity binding did not create both user and identity rows');
    }
  } catch (error) {
    const raced = await lookupIdentityUserId(db, identity);
    if (raced) {
      await initializeAccountSave(db, raced, undefined, nowMs);
      return raced;
    }
    throw error;
  }

  await initializeAccountSave(db, userId, undefined, nowMs);
  return userId;
}

export async function issueAuthSession(
  db: D1Database,
  userId: string,
  expiresAtMs: number,
  nowMs = Date.now(),
): Promise<IssuedAuthSession> {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) throw new Error('auth session expiry must be in the future');
  const user = await db.prepare('SELECT id FROM users WHERE id = ?1').bind(userId).first<{ id: string }>();
  if (!user) throw new Error('cannot issue auth session for unknown user');

  const token = generateSessionToken();
  const tokenHash = await hashAuthSessionToken(token);
  const sessionId = crypto.randomUUID();
  const expiresAtSeconds = Math.floor(expiresAtMs / 1000);
  const write = await db.prepare(
    `INSERT INTO auth_sessions
     (session_id, user_id, token_hash, expires_at)
     VALUES (?1, ?2, ?3, ?4)`,
  ).bind(sessionId, userId, tokenHash, expiresAtSeconds).run();
  if ((write.meta.changes ?? 0) !== 1) throw new Error('auth session insert did not create one row');
  return { userId, sessionId, expiresAtMs: expiresAtSeconds * 1000, token };
}

export async function issueAuthSessionForVerifiedIdentity(
  db: D1Database,
  identity: VerifiedAuthIdentity,
  expiresAtMs: number,
  nowMs = Date.now(),
): Promise<IssuedAuthSession> {
  const userId = await resolveOrCreateUserForVerifiedIdentity(db, identity, nowMs);
  return issueAuthSession(db, userId, expiresAtMs, nowMs);
}

export async function resolveAuthSession(
  db: D1Database,
  authorizationHeader: string | null,
  nowMs = Date.now(),
): Promise<AuthSessionPrincipal | null> {
  const token = parseAuthorizationBearerHeader(authorizationHeader);
  if (!token) return null;
  const tokenHash = await hashAuthSessionToken(token);
  const row = await db.prepare(
    `SELECT session_id, user_id, expires_at, revoked_at
     FROM auth_sessions
     WHERE token_hash = ?1`,
  ).bind(tokenHash).first<SessionRow>();
  if (!row || row.revoked_at !== null) return null;
  const expiresAtMs = row.expires_at * 1000;
  if (expiresAtMs <= nowMs) return null;
  return { userId: row.user_id, sessionId: row.session_id, expiresAtMs };
}

export async function revokeAuthSession(
  db: D1Database,
  principal: AuthSessionPrincipal,
): Promise<void> {
  await db.prepare(
    `UPDATE auth_sessions
     SET revoked_at = COALESCE(revoked_at, unixepoch())
     WHERE session_id = ?1 AND user_id = ?2`,
  ).bind(principal.sessionId, principal.userId).run();
}
