import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  hashAuthSessionToken,
  parseAuthorizationBearerHeader,
} from '../src/auth-session-authority.ts';

test('bearer parser accepts only the fixed 256-bit hex session token surface', () => {
  const token = 'ab'.repeat(32);
  assert.equal(parseAuthorizationBearerHeader(`Bearer ${token}`), token);
  assert.equal(parseAuthorizationBearerHeader(`bearer ${token}`), token);
  assert.equal(parseAuthorizationBearerHeader(null), null);
  assert.equal(parseAuthorizationBearerHeader('Bearer short'), null);
  assert.equal(parseAuthorizationBearerHeader(`Basic ${token}`), null);
  assert.equal(parseAuthorizationBearerHeader(`Bearer ${'zz'.repeat(32)}`), null);
});

test('session tokens are represented by deterministic SHA-256 hashes rather than plaintext DB lookup keys', async () => {
  const token = '01'.repeat(32);
  const hashA = await hashAuthSessionToken(token);
  const hashB = await hashAuthSessionToken(token);
  const other = await hashAuthSessionToken('02'.repeat(32));
  assert.match(hashA, /^[0-9a-f]{64}$/);
  assert.equal(hashA, hashB);
  assert.notEqual(hashA, token);
  assert.notEqual(hashA, other);
});

test('D1 auth session migration stores only token hashes with expiry, revocation and user ownership', async () => {
  const sql = await readFile(new URL('../migrations/0007_auth_sessions.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS auth_sessions/);
  assert.match(sql, /user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(sql, /expires_at INTEGER NOT NULL/);
  assert.match(sql, /revoked_at INTEGER/);
  assert.doesNotMatch(sql, /\btoken\s+TEXT\b/i);
  assert.match(sql, /auth_sessions_expiry_idx/);
});

test('verified identity binding is restricted to google/email and session issue stays behind that verified boundary', async () => {
  const source = await readFile(new URL('../src/auth-session-authority.ts', import.meta.url), 'utf8');
  assert.match(source, /AUTH_IDENTITY_PROVIDERS = \['google', 'email'\]/);
  assert.match(source, /resolveOrCreateUserForVerifiedIdentity/);
  assert.match(source, /issueAuthSessionForVerifiedIdentity/);
  assert.match(source, /INSERT INTO auth_identities/);
  assert.match(source, /INSERT INTO auth_sessions/);
  assert.match(source, /token_hash/);
  assert.match(source, /resolveAuthSession/);
  assert.match(source, /revoked_at !== null/);
  assert.match(source, /expiresAtMs <= nowMs/);
});
