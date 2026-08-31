import { resolveAuthSession } from './auth-session-authority.ts';
import { getAccountCoopSeatAuthority } from './account-coop-authority.ts';
import { getAccountFriendlyPvpAuthority, parseFriendlyPvpGrowthPolicy } from './pvp-friendly-authority.ts';
import {
  resolveFriendlyPvp2v2Http,
  type FriendlyPvp2v2HttpEnv,
} from './pvp-friendly-2v2-http.ts';
import {
  cancelFriendlyPvpLobbyForAccount,
  createFriendlyPvpLobbyForAccount,
  joinFriendlyPvpLobbyForAccount,
  type FriendlyPvpHttpEnv,
} from './pvp-friendly-http.ts';
import {
  acceptSocialFriendRequest,
  areSocialFriends,
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
import {
  createSocialPvp2v2Invite,
  declineSocialPvp2v2Invite,
  getIncomingSocialPvp2v2Invites,
  getPendingSocialPvp2v2InviteForInvitee,
  markSocialPvp2v2InviteAccepted,
} from './social-pvp-2v2-authority.ts';
import {
  cancelSocialPvpInviteByInviter,
  createSocialPvpInvite,
  declineSocialPvpInvite,
  getIncomingSocialPvpInvites,
  getPendingSocialPvpInviteForInvitee,
  getSocialPvpInviterSummary,
  markSocialPvpInviteAccepted,
} from './social-pvp-authority.ts';

export interface SocialHttpEnv extends FriendlyPvpHttpEnv, FriendlyPvp2v2HttpEnv {
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
  if (message.includes('expired') || message.includes('cancelled')) return 410;
  if (message.includes('not_found') || message.includes('missing')) return 404;
  if (message.includes('blocked') || message.includes('already') || message.includes('pending') || message.includes('conflict') || message.includes('friend_required') || message.includes('full')) return 409;
  if (message.includes('locked') || message.includes('not currently available') || message.includes('not_coop_eligible') || message.includes('required') || message.includes('host_only')) return 403;
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

async function createFriendPvpInvite(
  request: Request,
  env: SocialHttpEnv,
  userId: string,
  nowMs: number,
): Promise<SocialHttpResult> {
  const body = await readJson(request);
  const inviteeId = await requireTargetByFriendCode(env.DB, body.friendCode);
  if (inviteeId === userId) throw new Error('social_self_target');
  if (!await areSocialFriends(env.DB, userId, inviteeId)) throw new Error('social_friend_required');
  const growthPolicy = parseFriendlyPvpGrowthPolicy(body.growthPolicy);
  if (!growthPolicy) return { status: 400, body: { error: 'friendly_pvp_growth_policy_required' } };

  await getAccountFriendlyPvpAuthority(env.DB, inviteeId, growthPolicy, nowMs);
  const lobbyResult = await createFriendlyPvpLobbyForAccount(env, userId, growthPolicy, nowMs);
  if (lobbyResult.status >= 400 || !isRecord(lobbyResult.body)) return lobbyResult;
  const inviteCode = text(lobbyResult.body.inviteCode);
  const expiresAtMs = lobbyResult.body.expiresAtMs;
  if (!inviteCode || typeof expiresAtMs !== 'number') {
    return { status: 503, body: { error: 'social_pvp_lobby_payload_invalid' } };
  }
  try {
    const invite = await createSocialPvpInvite(env.DB, userId, inviteeId, inviteCode, growthPolicy, expiresAtMs, nowMs);
    return {
      status: 201,
      body: {
        invite: { inviteId: invite.inviteId, inviteCode, growthPolicy, expiresAtMs },
        lobby: lobbyResult.body,
      },
    };
  } catch (error) {
    await cancelFriendlyPvpLobbyForAccount(env, userId, inviteCode).catch(() => undefined);
    throw error;
  }
}

async function acceptFriendPvpInvite(
  request: Request,
  env: SocialHttpEnv,
  userId: string,
  nowMs: number,
): Promise<SocialHttpResult> {
  const body = await readJson(request);
  const inviteId = text(body.inviteId);
  if (!inviteId) return { status: 400, body: { error: 'invite_id_required' } };
  const invite = await getPendingSocialPvpInviteForInvitee(env.DB, userId, inviteId, nowMs);
  await getAccountFriendlyPvpAuthority(env.DB, userId, invite.growthPolicy, nowMs);
  const joined = await joinFriendlyPvpLobbyForAccount(env, userId, invite.inviteCode);
  if (joined.status >= 400) return joined;
  await markSocialPvpInviteAccepted(env.DB, userId, inviteId);
  return { status: 200, body: { inviteId, match: joined.body } };
}

async function createFriendPvp2v2Invite(
  request: Request,
  env: SocialHttpEnv,
  userId: string,
  nowMs: number,
): Promise<SocialHttpResult> {
  const body = await readJson(request);
  const inviteCode = text(body.inviteCode);
  if (!inviteCode) return { status: 400, body: { error: 'friendly_2v2_invite_code_invalid' } };
  const inviteeId = await requireTargetByFriendCode(env.DB, body.friendCode);
  const invite = await createSocialPvp2v2Invite(env.DB, userId, inviteeId, inviteCode, nowMs);
  return {
    status: 201,
    body: {
      inviteId: invite.inviteId,
      inviteCode: invite.inviteCode,
      modeId: invite.modeId,
      expiresAtMs: invite.expiresAtMs,
    },
  };
}

async function acceptFriendPvp2v2Invite(
  request: Request,
  env: SocialHttpEnv,
  userId: string,
  nowMs: number,
): Promise<SocialHttpResult> {
  const body = await readJson(request);
  const inviteId = text(body.inviteId);
  if (!inviteId) return { status: 400, body: { error: 'invite_id_required' } };
  const invite = await getPendingSocialPvp2v2InviteForInvitee(env.DB, userId, inviteId, nowMs);
  const authorization = request.headers.get('authorization');
  const joined = await resolveFriendlyPvp2v2Http(new Request('https://social.internal/api/pvp/friendly-2v2/join', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization === null ? {} : { authorization }),
    },
    body: JSON.stringify({ inviteCode: invite.inviteCode }),
  }), env, nowMs);
  if (!joined) return { status: 503, body: { error: 'social_pvp_2v2_join_unavailable' } };
  if (joined.status >= 400) return joined;
  await markSocialPvp2v2InviteAccepted(env.DB, userId, inviteId);
  return { status: 200, body: { inviteId, lobby: joined.body } };
}

export async function resolveSocialHttp(request: Request, env: SocialHttpEnv, nowMs = Date.now()): Promise<SocialHttpResult | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/social')) return null;
  const principal = await resolveAuthSession(env.DB, request.headers.get('authorization'), nowMs);
  if (!principal) return { status: 401, body: { error: 'authentication_required' } };

  try {
    await touchSocialPresence(env.DB, principal.userId, nowMs);
    if (request.method === 'GET' && url.pathname === '/api/social') {
      const [summary, pvpInvites, pvp2v2Invites] = await Promise.all([
        getSocialSummary(env.DB, principal.userId, nowMs),
        getIncomingSocialPvpInvites(env.DB, principal.userId, nowMs),
        getIncomingSocialPvp2v2Invites(env.DB, principal.userId, nowMs),
      ]);
      const [pvpInviteViews, pvp2v2InviteViews] = await Promise.all([
        Promise.all(pvpInvites.map(async (invite) => ({
          inviteId: invite.inviteId,
          inviter: await getSocialPvpInviterSummary(env.DB, invite.inviterId, nowMs),
          inviteCode: invite.inviteCode,
          modeId: invite.modeId,
          growthPolicy: invite.growthPolicy,
          expiresAtMs: invite.expiresAtMs,
        }))),
        Promise.all(pvp2v2Invites.map(async (invite) => ({
          inviteId: invite.inviteId,
          inviter: await getSocialPvpInviterSummary(env.DB, invite.hostId, nowMs),
          inviteCode: invite.inviteCode,
          modeId: invite.modeId,
          expiresAtMs: invite.expiresAtMs,
        }))),
      ]);
      return { status: 200, body: { ...summary, pvpInvites: pvpInviteViews, pvp2v2Invites: pvp2v2InviteViews } };
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
    if (request.method === 'POST' && url.pathname === '/api/social/pvp/invite') {
      return createFriendPvpInvite(request, env, principal.userId, nowMs);
    }
    if (request.method === 'POST' && url.pathname === '/api/social/pvp/accept') {
      return acceptFriendPvpInvite(request, env, principal.userId, nowMs);
    }
    if (request.method === 'POST' && url.pathname === '/api/social/pvp/decline') {
      const inviteId = text(body.inviteId);
      if (!inviteId) return { status: 400, body: { error: 'invite_id_required' } };
      const invite = await declineSocialPvpInvite(env.DB, principal.userId, inviteId);
      await cancelFriendlyPvpLobbyForAccount(env, invite.inviterId, invite.inviteCode).catch(() => undefined);
      return { status: 200, body: { ok: true } };
    }
    if (request.method === 'POST' && url.pathname === '/api/social/pvp/cancel') {
      const inviteId = text(body.inviteId);
      if (!inviteId) return { status: 400, body: { error: 'invite_id_required' } };
      const invite = await cancelSocialPvpInviteByInviter(env.DB, principal.userId, inviteId);
      await cancelFriendlyPvpLobbyForAccount(env, principal.userId, invite.inviteCode).catch(() => undefined);
      return { status: 200, body: { ok: true } };
    }
    if (request.method === 'POST' && url.pathname === '/api/social/pvp-2v2/invite') {
      return createFriendPvp2v2Invite(request, env, principal.userId, nowMs);
    }
    if (request.method === 'POST' && url.pathname === '/api/social/pvp-2v2/accept') {
      return acceptFriendPvp2v2Invite(request, env, principal.userId, nowMs);
    }
    if (request.method === 'POST' && url.pathname === '/api/social/pvp-2v2/decline') {
      const inviteId = text(body.inviteId);
      if (!inviteId) return { status: 400, body: { error: 'invite_id_required' } };
      await declineSocialPvp2v2Invite(env.DB, principal.userId, inviteId, nowMs);
      return { status: 200, body: { ok: true } };
    }
    return { status: 404, body: { error: 'not_found' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'social_request_failed';
    return { status: errorStatus(message), body: { error: message } };
  }
}
