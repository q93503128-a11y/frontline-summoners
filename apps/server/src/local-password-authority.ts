import { initializeAccountSave } from './account-save-authority.ts';
import { issueAuthSession, type IssuedAuthSession } from './auth-session-authority.ts';

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const VERIFIER_BYTES = 32;
const USERNAME_PATTERN = /^[a-z0-9_]{4,24}$/;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;
const DUMMY_SALT = new Uint8Array([
  0x66, 0x72, 0x6f, 0x6e, 0x74, 0x6c, 0x69, 0x6e,
  0x65, 0x2d, 0x61, 0x75, 0x74, 0x68, 0x2d, 0x31,
]);

export class LocalAuthInputError extends Error {}
export class LocalAuthUsernameTakenError extends Error {}
export class LocalAuthInvalidCredentialsError extends Error {}

type PasswordCredentialRow = {
  readonly user_id: string;
  readonly salt_hex: string;
  readonly verifier_hex: string;
  readonly iterations: number;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const output = new Uint8Array(value.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    const byte = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    if (!Number.isInteger(byte)) return null;
    output[index] = byte;
  }
  return output;
}

export function normalizeLocalUsername(value: unknown): string {
  if (typeof value !== 'string') throw new LocalAuthInputError('username must be a string');
  const normalized = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new LocalAuthInputError('username must be 4..24 lowercase letters, numbers, or underscore');
  }
  return normalized;
}

export function normalizeLocalPassword(value: unknown): string {
  if (typeof value !== 'string') throw new LocalAuthInputError('password must be a string');
  if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
    throw new LocalAuthInputError(`password must be ${MIN_PASSWORD_LENGTH}..${MAX_PASSWORD_LENGTH} characters`);
  }
  if (new TextEncoder().encode(value).byteLength > 256) throw new LocalAuthInputError('password is too long after UTF-8 encoding');
  return value;
}

async function deriveVerifier(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    VERIFIER_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function findCredential(db: D1Database, username: string): Promise<PasswordCredentialRow | null> {
  return db.prepare(
    `SELECT user_id, salt_hex, verifier_hex, iterations
     FROM auth_password_credentials
     WHERE username = ?1 COLLATE NOCASE`,
  ).bind(username).first<PasswordCredentialRow>();
}

export async function registerLocalPasswordAccount(
  db: D1Database,
  rawUsername: unknown,
  rawPassword: unknown,
  expiresAtMs: number,
  nowMs = Date.now(),
): Promise<IssuedAuthSession> {
  const username = normalizeLocalUsername(rawUsername);
  const password = normalizeLocalPassword(rawPassword);
  if (await findCredential(db, username)) throw new LocalAuthUsernameTakenError('username already exists');

  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const verifier = await deriveVerifier(password, salt, PBKDF2_ITERATIONS);
  const userId = crypto.randomUUID();

  try {
    await db.batch([
      db.prepare('INSERT INTO users (id) VALUES (?1)').bind(userId),
      db.prepare(
        'INSERT INTO auth_identities (provider, provider_subject, user_id) VALUES (?1, ?2, ?3)',
      ).bind('local', username, userId),
      db.prepare(
        `INSERT INTO auth_password_credentials
         (user_id, username, salt_hex, verifier_hex, iterations)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      ).bind(userId, username, bytesToHex(salt), bytesToHex(verifier), PBKDF2_ITERATIONS),
    ]);
  } catch (error) {
    if (await findCredential(db, username)) throw new LocalAuthUsernameTakenError('username already exists');
    throw error;
  }

  await initializeAccountSave(db, userId, undefined, nowMs);
  return issueAuthSession(db, userId, expiresAtMs, nowMs);
}

export async function loginLocalPasswordAccount(
  db: D1Database,
  rawUsername: unknown,
  rawPassword: unknown,
  expiresAtMs: number,
  nowMs = Date.now(),
): Promise<IssuedAuthSession> {
  const username = normalizeLocalUsername(rawUsername);
  const password = normalizeLocalPassword(rawPassword);
  const row = await findCredential(db, username);

  const salt = row ? hexToBytes(row.salt_hex) : DUMMY_SALT;
  const iterations = row && Number.isInteger(row.iterations) ? row.iterations : PBKDF2_ITERATIONS;
  const expected = row ? hexToBytes(row.verifier_hex) : new Uint8Array(VERIFIER_BYTES);
  if (!salt || !expected || expected.length !== VERIFIER_BYTES || iterations < 100_000 || iterations > 1_000_000) {
    throw new LocalAuthInvalidCredentialsError('invalid username or password');
  }

  const actual = await deriveVerifier(password, salt, iterations);
  if (!row || !constantTimeEqual(actual, expected)) {
    throw new LocalAuthInvalidCredentialsError('invalid username or password');
  }

  return issueAuthSession(db, row.user_id, expiresAtMs, nowMs);
}

export const __localPasswordAuthorityTestOnly = {
  PBKDF2_ITERATIONS,
  USERNAME_PATTERN,
  bytesToHex,
  hexToBytes,
  constantTimeEqual,
};
