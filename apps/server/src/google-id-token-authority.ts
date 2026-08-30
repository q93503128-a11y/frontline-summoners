const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const DEFAULT_JWKS_CACHE_MS = 5 * 60 * 1000;
const MAX_JWKS_CACHE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 300;

export class GoogleIdTokenValidationError extends Error {}
export class GoogleIdTokenProviderError extends Error {}

export interface VerifiedGoogleIdentity {
  readonly provider: 'google';
  readonly providerSubject: string;
}

type GoogleJwtHeader = {
  readonly alg?: unknown;
  readonly kid?: unknown;
};

type GoogleJwtClaims = {
  readonly iss?: unknown;
  readonly aud?: unknown;
  readonly azp?: unknown;
  readonly sub?: unknown;
  readonly exp?: unknown;
  readonly iat?: unknown;
  readonly nbf?: unknown;
};

type GoogleJwk = JsonWebKey & {
  readonly kid?: string;
  readonly alg?: string;
  readonly use?: string;
};

type CachedJwks = {
  readonly expiresAtMs: number;
  readonly keys: readonly GoogleJwk[];
};

let jwksCache: CachedJwks | null = null;

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new GoogleIdTokenValidationError('google id token contains invalid base64url');
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new GoogleIdTokenValidationError('google id token contains undecodable base64url');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeJsonSegment<T>(segment: string, context: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment))) as T;
  } catch (error) {
    if (error instanceof GoogleIdTokenValidationError) throw error;
    throw new GoogleIdTokenValidationError(`google id token ${context} is invalid JSON`);
  }
}

function parseJwt(token: string): {
  readonly signingInput: Uint8Array;
  readonly signature: Uint8Array;
  readonly header: GoogleJwtHeader;
  readonly claims: GoogleJwtClaims;
} {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new GoogleIdTokenValidationError('google id token must be a compact JWT');
  }
  const [encodedHeader, encodedClaims, encodedSignature] = parts as [string, string, string];
  return {
    signingInput: new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`),
    signature: decodeBase64Url(encodedSignature),
    header: decodeJsonSegment<GoogleJwtHeader>(encodedHeader, 'header'),
    claims: decodeJsonSegment<GoogleJwtClaims>(encodedClaims, 'claims'),
  };
}

function requiredString(value: unknown, context: string, maxLength: number): string {
  if (typeof value !== 'string') throw new GoogleIdTokenValidationError(`google id token ${context} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxLength) {
    throw new GoogleIdTokenValidationError(`google id token ${context} must be 1..${maxLength} characters`);
  }
  return trimmed;
}

function integerClaim(value: unknown, context: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new GoogleIdTokenValidationError(`google id token ${context} must be a non-negative integer`);
  }
  return value as number;
}

function audienceIncludes(value: unknown, clientId: string): { readonly matches: boolean; readonly multiple: boolean } {
  if (typeof value === 'string') return { matches: value === clientId, multiple: false };
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string')) {
    throw new GoogleIdTokenValidationError('google id token aud claim is invalid');
  }
  return { matches: value.includes(clientId), multiple: value.length > 1 };
}

function parseCacheMaxAgeMs(header: string | null): number {
  if (!header) return DEFAULT_JWKS_CACHE_MS;
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(header);
  if (!match) return DEFAULT_JWKS_CACHE_MS;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_JWKS_CACHE_MS;
  return Math.min(MAX_JWKS_CACHE_MS, Math.floor(seconds * 1000));
}

function parseJwks(value: unknown): readonly GoogleJwk[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GoogleIdTokenProviderError('google jwks response must be an object');
  }
  const keys = (value as { readonly keys?: unknown }).keys;
  if (!Array.isArray(keys) || keys.length === 0) throw new GoogleIdTokenProviderError('google jwks response contains no keys');
  return keys.filter((key): key is GoogleJwk => typeof key === 'object' && key !== null && !Array.isArray(key));
}

async function fetchGoogleJwks(fetcher: typeof fetch, nowMs: number): Promise<CachedJwks> {
  let response: Response;
  try {
    response = await fetcher(GOOGLE_JWKS_URL, { headers: { accept: 'application/json' } });
  } catch {
    throw new GoogleIdTokenProviderError('google jwks request failed');
  }
  if (!response.ok) throw new GoogleIdTokenProviderError(`google jwks request failed:${response.status}`);
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new GoogleIdTokenProviderError('google jwks response is invalid JSON');
  }
  const cached = {
    expiresAtMs: nowMs + parseCacheMaxAgeMs(response.headers.get('cache-control')),
    keys: parseJwks(parsed),
  } satisfies CachedJwks;
  jwksCache = cached;
  return cached;
}

async function getGoogleJwk(kid: string, fetcher: typeof fetch, nowMs: number): Promise<GoogleJwk> {
  const usableCache = jwksCache && jwksCache.expiresAtMs > nowMs ? jwksCache : await fetchGoogleJwks(fetcher, nowMs);
  let key = usableCache.keys.find((candidate) => candidate.kid === kid);
  if (!key) {
    const refreshed = await fetchGoogleJwks(fetcher, nowMs);
    key = refreshed.keys.find((candidate) => candidate.kid === kid);
  }
  if (!key) throw new GoogleIdTokenValidationError('google id token signing key is unknown');
  if (key.kty !== 'RSA' || (key.alg !== undefined && key.alg !== 'RS256') || (key.use !== undefined && key.use !== 'sig')) {
    throw new GoogleIdTokenValidationError('google id token signing key is not an RS256 signature key');
  }
  return key;
}

function validateClaims(claims: GoogleJwtClaims, clientId: string, nowMs: number): string {
  const issuer = requiredString(claims.iss, 'iss', 128);
  if (!GOOGLE_ISSUERS.has(issuer)) throw new GoogleIdTokenValidationError('google id token issuer is invalid');

  const audience = audienceIncludes(claims.aud, clientId);
  if (!audience.matches) throw new GoogleIdTokenValidationError('google id token audience does not match this app');
  if (audience.multiple && claims.azp !== clientId) {
    throw new GoogleIdTokenValidationError('google id token authorized party does not match this app');
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  const expiresAt = integerClaim(claims.exp, 'exp');
  if (expiresAt <= nowSeconds) throw new GoogleIdTokenValidationError('google id token is expired');

  if (claims.iat !== undefined) {
    const issuedAt = integerClaim(claims.iat, 'iat');
    if (issuedAt > nowSeconds + CLOCK_SKEW_SECONDS) throw new GoogleIdTokenValidationError('google id token was issued in the future');
  }
  if (claims.nbf !== undefined) {
    const notBefore = integerClaim(claims.nbf, 'nbf');
    if (notBefore > nowSeconds + CLOCK_SKEW_SECONDS) throw new GoogleIdTokenValidationError('google id token is not active yet');
  }

  return requiredString(claims.sub, 'sub', 255);
}

export async function verifyGoogleIdToken(
  rawCredential: string,
  rawClientId: string,
  nowMs = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<VerifiedGoogleIdentity> {
  const credential = rawCredential.trim();
  if (credential.length < 32 || credential.length > 16_384) {
    throw new GoogleIdTokenValidationError('google credential length is invalid');
  }
  const clientId = rawClientId.trim();
  if (clientId.length < 16 || clientId.length > 512) throw new GoogleIdTokenValidationError('google client id configuration is invalid');

  const parsed = parseJwt(credential);
  if (parsed.header.alg !== 'RS256') throw new GoogleIdTokenValidationError('google id token must use RS256');
  const kid = requiredString(parsed.header.kid, 'kid', 256);
  const providerSubject = validateClaims(parsed.claims, clientId, nowMs);
  const jwk = await getGoogleJwk(kid, fetcher, nowMs);

  let publicKey: CryptoKey;
  try {
    publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    throw new GoogleIdTokenProviderError('google jwks key import failed');
  }

  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    parsed.signature,
    parsed.signingInput,
  );
  if (!validSignature) throw new GoogleIdTokenValidationError('google id token signature is invalid');

  return { provider: 'google', providerSubject };
}

export const __googleIdTokenTestOnly = {
  resetJwksCache(): void { jwksCache = null; },
  parseCacheMaxAgeMs,
};
