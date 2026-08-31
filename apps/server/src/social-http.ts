import { resolveAuthSession } from './auth-session-authority.ts';
import { getAccountCoopSeatAuthority } from './account-coop-authority.ts';
import {
  acceptSocialFriendRequest,
  blockSocialUser,
  createSocialCoopInvite,
  declineSocialCoopInvite,
  getPendingCoopInviteForInvitee,
  getSocialSummary,
  markSocialCoopInviteAccepted,
  removeSocialFriend,
  resolveSocialUserByFriendCode,
  sendSocialFriendRequest,
  touchSocialPresence,
  unblockSocialUser,
  updateSocialDisplayName,
} from './social-authority.ts';

export interface SocialHttpEnv {
  readonly DB: D1Database;
  readonly BATTLE_ROOM: DurableObjectNamespace;
}

export interface SocialHttpResult {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function requireTargetByFriendCode(db: D1Database, raw: unknown): Promise<string> {
  const friendCode = text(raw);
  if (!friendCode) throw new Error('social_friend_code_required');
  const target = await resolveSocialUserByFriendCode(db, friendCode);
  if (!target) throw new Error('social_target_not_found');
  return target;
}

function errorStatus(message: string): number {
  if (message.includes('not_found') || message.includes('missing')) return 404;
  if (message.includes('blocked') || message.includes('already') || message.includes('pending') || message.includes('conflict') || message.includes('friend_required')) return 409;
  if (message.includes('locked') || message.includes('not currently available') || message.includes('not_coop_eligible')) return 403;
  return 400;
}

async function createFriendCoopInvite(
  request: Request,
  env: SocialHttpEnv,
  userId: string,
): Promise<SocialHttpResult> {
  const body = await readJson(request);
  const friendCode = body.friendCode;
  const stageId = text(body.stageId);
  if (!stageId) return { status: 400, body: { error: 'stage_id_required' } };
  const inviteeId = await requireTargetByFriendCode(env.DB, friendCode);
  if (inviteeId === userId) throw new Error('social_self_target');

  await Promise.all([
    getAccountCoopSeatAuthority(env.DB, userId, stageId),
    getAccountCoopSeatAuthority(env.DB, inviteeId, stageId),
  ]);

  const matchId = crypto.randomUUID();
  const hostToken = crypto.randomUUID();
  const guestToken = crypto.randomUUID();
  const roomId = env.BATTLE_ROOM.idFromName(matchId);
  const stub = env.BATTLE_ROOM.get(roomId);
  const initialized = await stub.fetch(new Request('https://battle-room.internal/initialize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      matchId,
      stageId,
      joinTokens: { A: hostToken, B: guestToken },
      seatAccountIds: { A: userId, B: inviteeId },
      matchKind: 'FRIEND',
    }),
  }));
  if (!initialized.ok) return { status: 503, body: { error: 'match_initialization_failed' } };

  try {
    const invite = await createSocialCoopInvite(env.DB, userId, inviteeId, matchId, stageId);
    return {
      status: 201,
      body: {
        invite,
        matchId,
        stageId,
        host: {
          seatId: 'A',
          websocketPath: `/api/matches/${encodeURIComponent(matchId)}/websocket?token=${encodeURIComponent(hostToken)}`,
        },
      },
    };
  } catch (error) {
    await stub.fetch(new Request('https://battle-room.internal/cancel', { method: 'POST' })).catch(() => undefined);
    throw error;
  }
}

async function acceptFriendCoopInvite(
  request: Request,
  env: SocialHttpEnv,
  userId: string,
): Promise<SocialHttpResult> {
  const body = await readJson(request);
  const inviteId = text(body.inviteId);
  if (!inviteId) return { status: 400, body: { error: 'invite_id_required' } };
  const invite = await getPendingCoopInviteForInvitee(env.DB, userId, inviteId);
  await getAccountCoopSeatAuthority(env.DB, userId, invite.stageId);
  const roomId = env.BATTLE_ROOM.idFromName(invite.matchId);
  const response = await env.BATTLE_ROOM.get(roomId).fetch(new Request('https://battle-room.internal/seat-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seatId: 'B', accountId: userId }),
  }));
  if (!response.ok) return { status: response.status === 404 ? 410 : 409, body: { error: 'social_coop_room_unavailable' } };
  const payload = await response.json() as { token?: unknown };
  if (typeof payload.token !== 'string') return { status: 503, body: { error: 'social_coop_seat_token_missing' } };
  await markSocialCoopInviteAccepted(env.DB, userId, inviteId);
  return {
    status: 200,
    body: {
      inviteId,
      matchId: invite.matchId,
      stageId: invite.stageId,
      guest: {
        seatId: 'B',
        websocketPath: `/api/matches/${encodeURIComponent(invite.matchId)}/websocket?token=${encodeURIComponent(payload.token)}`,
      },
    },
  };
}

export async function resolveSocialHttp(request: Request, env: SocialHttpEnv): Promise<SocialHttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/social')) return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'));
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };

  try {
    await touchSocialPresence(env.DB, principal.userId);
    if (request.method === 'GET' && url.pathname === '/api/social') {
      return { status: 200, body: await getSocialSummary(env.DB, principal.userId) };
    }

    const body = request.method === 'POST' ? await readJson(request.clone()) : {};
    if (request.method === 'POST' && url.pathname === '/api/social/profile') {
      const displayName = text(body.displayName);
      if (!displayName) return { status: 400, body: { error: 'display_name_required' } };
      return { status: 200, body: { profile: await updateSocialDisplayName(env.DB, principal.userId, displayName) } };
    }

    if (request.method === 'POST' && url.pathname === '/api/social/friends/request') {
      const target = await requireTargetByFriendCode(env.DB, body.friendCode);
      await sendSocialFriendRequest(env.DB, principal.userId, target);
      return { status: 200, body: { ok: true } };
    }
    if (request.method === 'POST' && url.pathname === '/api/social/friends/accept') {
      const target = await requireTargetByFriendCode(env.DB, body.friendCode);
      await acceptSocialFriendRequest(env.DB, principal.userId, target);
      return { status: 200, body: { ok: true } };
    }
    if (request.method === 'POST' && url.pathname === '/api/social/friends/remove') {
      const target = await requireTargetByFriendCode(env.DB, body.friendCode);
      await removeSocialFriend(env.DB, principal.userId, target);
      return { status: 200, body: { ok: true } };
    }
    if (request.method === 'POST' && url.pathname === '/api/social/block') {
      const target = await requireTargetByFriendCode(env.DB, body.friendCode);
      await blockSocialUser(env.DB, principal.userId, target);
      return { status: 200, body: { ok: true } };
    }
    if (request.method === 'POST' && url.pathname === '/api/social/unblock') {
      const target = await requireTargetByFriendCode(env.DB, body.friendCode);
      await unblockSocialUser(env.DB, principal.userId, target);
      return { status: 200, body: { ok: true } };
    }
    if (request.method === 'POST' && url.pathname === '/api/social/coop/invite') {
      return createFriendCoopInvite(request, env, principal.userId);
    }
    if (request.method === 'POST' && url.pathname === '/api/social/coop/accept') {
      return acceptFriendCoopInvite(request, env, principal.userId);
    }
    if (request.method === 'POST' && url.pathname === '/api/social/coop/decline') {
      const inviteId = text(body.inviteId);
      if (!inviteId) return { status: 400, body: { error: 'invite_id_required' } };
      await declineSocialCoopInvite(env.DB, principal.userId, inviteId);
      return { status: 200, body: { ok: true } };
    }
    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'social_request_failed';
    return { status: errorStatus(message), body: { error: message } };
  }
}
