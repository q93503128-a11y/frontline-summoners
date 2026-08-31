import { getAccountClientState, refreshAuthenticatedAccount } from './account-network';
import { resolveCoopApiOrigin } from './coop-network';

export interface SocialPublicProfile {
  readonly friendCode: string;
  readonly displayName: string;
  readonly online: boolean;
  readonly portraitCharacterId?: string;
  readonly titleId?: string;
  readonly frameId: string;
}

export interface SocialRecentPlayer {
  readonly profile: SocialPublicProfile;
  readonly lastMatchId: string;
  readonly lastStageId: string;
  readonly playCount: number;
  readonly lastPlayedAtMs: number;
  readonly interactionAllowed: boolean;
}

export interface SocialCoopInviteView {
  readonly inviteId: string;
  readonly inviter: SocialPublicProfile;
  readonly matchId: string;
  readonly stageId: string;
  readonly expiresAtMs: number;
}

export interface SocialSummary {
  readonly self: SocialPublicProfile;
  readonly friends: readonly SocialPublicProfile[];
  readonly incomingRequests: readonly SocialPublicProfile[];
  readonly outgoingRequests: readonly SocialPublicProfile[];
  readonly blocked: readonly SocialPublicProfile[];
  readonly recentPlayers: readonly SocialRecentPlayer[];
  readonly coopInvites: readonly SocialCoopInviteView[];
}

export interface FriendCoopHostResult {
  readonly inviteId: string;
  readonly matchId: string;
  readonly stageId: string;
  readonly hostPath: string;
}

export interface FriendCoopJoinResult {
  readonly inviteId: string;
  readonly matchId: string;
  readonly stageId: string;
  readonly guestPath: string;
}

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function browserWindow(): Window | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

function currentSessionToken(): string {
  if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('친구 기능은 온라인 로그인 상태에서만 사용할 수 있습니다.');
  const browser = browserWindow();
  const token = browser?.sessionStorage.getItem(SESSION_TOKEN_KEY) ?? null;
  if (!token || !SESSION_TOKEN_PATTERN.test(token)) throw new Error('로그인 세션을 찾을 수 없습니다.');
  return token;
}

async function requestSocial(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = currentSessionToken();
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${resolveCoopApiOrigin()}${path}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) await refreshAuthenticatedAccount();
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP_${response.status}`;
    throw new Error(code);
  }
  return payload;
}

function profile(value: unknown): SocialPublicProfile {
  if (!isRecord(value) || typeof value.friendCode !== 'string' || typeof value.displayName !== 'string' || typeof value.online !== 'boolean' || typeof value.frameId !== 'string') {
    throw new Error('소셜 프로필 응답 형식이 올바르지 않습니다.');
  }
  return {
    friendCode: value.friendCode,
    displayName: value.displayName,
    online: value.online,
    ...(typeof value.portraitCharacterId === 'string' ? { portraitCharacterId: value.portraitCharacterId } : {}),
    ...(typeof value.titleId === 'string' ? { titleId: value.titleId } : {}),
    frameId: value.frameId,
  };
}

function profileArray(value: unknown): readonly SocialPublicProfile[] {
  if (!Array.isArray(value)) throw new Error('소셜 목록 응답 형식이 올바르지 않습니다.');
  return value.map(profile);
}

function summary(value: unknown): SocialSummary {
  if (!isRecord(value) || !Array.isArray(value.recentPlayers) || !Array.isArray(value.coopInvites)) throw new Error('소셜 요약 응답 형식이 올바르지 않습니다.');
  return {
    self: profile(value.self),
    friends: profileArray(value.friends),
    incomingRequests: profileArray(value.incomingRequests),
    outgoingRequests: profileArray(value.outgoingRequests),
    blocked: profileArray(value.blocked),
    recentPlayers: value.recentPlayers.map((entry): SocialRecentPlayer => {
      if (!isRecord(entry) || typeof entry.lastMatchId !== 'string' || typeof entry.lastStageId !== 'string' || typeof entry.playCount !== 'number' || typeof entry.lastPlayedAtMs !== 'number' || typeof entry.interactionAllowed !== 'boolean') {
        throw new Error('최근 플레이어 응답 형식이 올바르지 않습니다.');
      }
      return {
        profile: profile(entry.profile),
        lastMatchId: entry.lastMatchId,
        lastStageId: entry.lastStageId,
        playCount: entry.playCount,
        lastPlayedAtMs: entry.lastPlayedAtMs,
        interactionAllowed: entry.interactionAllowed,
      };
    }),
    coopInvites: value.coopInvites.map((entry): SocialCoopInviteView => {
      if (!isRecord(entry) || typeof entry.inviteId !== 'string' || typeof entry.matchId !== 'string' || typeof entry.stageId !== 'string' || typeof entry.expiresAtMs !== 'number') {
        throw new Error('협동 초대 응답 형식이 올바르지 않습니다.');
      }
      return { inviteId: entry.inviteId, inviter: profile(entry.inviter), matchId: entry.matchId, stageId: entry.stageId, expiresAtMs: entry.expiresAtMs };
    }),
  };
}

async function post(path: string, body: Readonly<Record<string, unknown>>): Promise<unknown> {
  return requestSocial(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function loadSocialSummary(): Promise<SocialSummary> {
  return summary(await requestSocial('/api/social'));
}

export async function updateSocialDisplayName(displayName: string): Promise<SocialPublicProfile> {
  const payload = await post('/api/social/profile', { displayName });
  if (!isRecord(payload)) throw new Error('프로필 변경 응답 형식이 올바르지 않습니다.');
  return profile(payload.profile);
}

export function sendFriendRequest(friendCode: string): Promise<unknown> {
  return post('/api/social/friends/request', { friendCode });
}

export function acceptFriendRequest(friendCode: string): Promise<unknown> {
  return post('/api/social/friends/accept', { friendCode });
}

export function removeFriend(friendCode: string): Promise<unknown> {
  return post('/api/social/friends/remove', { friendCode });
}

export function blockSocialUser(friendCode: string): Promise<unknown> {
  return post('/api/social/block', { friendCode });
}

export function unblockSocialUser(friendCode: string): Promise<unknown> {
  return post('/api/social/unblock', { friendCode });
}

export async function createFriendCoopInvite(stageId: string, friendCode: string): Promise<FriendCoopHostResult> {
  const payload = await post('/api/social/coop/invite', { stageId, friendCode });
  if (!isRecord(payload) || !isRecord(payload.invite) || typeof payload.invite.inviteId !== 'string' || typeof payload.matchId !== 'string' || typeof payload.stageId !== 'string' || !isRecord(payload.host) || typeof payload.host.websocketPath !== 'string') {
    throw new Error('친구 협동 초대 응답 형식이 올바르지 않습니다.');
  }
  return { inviteId: payload.invite.inviteId, matchId: payload.matchId, stageId: payload.stageId, hostPath: payload.host.websocketPath };
}

export async function acceptFriendCoopInvite(inviteId: string): Promise<FriendCoopJoinResult> {
  const payload = await post('/api/social/coop/accept', { inviteId });
  if (!isRecord(payload) || typeof payload.inviteId !== 'string' || typeof payload.matchId !== 'string' || typeof payload.stageId !== 'string' || !isRecord(payload.guest) || typeof payload.guest.websocketPath !== 'string') {
    throw new Error('친구 협동 참가 응답 형식이 올바르지 않습니다.');
  }
  return { inviteId: payload.inviteId, matchId: payload.matchId, stageId: payload.stageId, guestPath: payload.guest.websocketPath };
}

export function declineFriendCoopInvite(inviteId: string): Promise<unknown> {
  return post('/api/social/coop/decline', { inviteId });
}

export const __socialNetworkTestOnly = { summary, profile };
