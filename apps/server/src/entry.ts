import worker, { BattleRoom, type Env } from './index.ts';
import { resolveGuestMigrationHttp } from './account-guest-migration-http.ts';
import { resolveCoopMatchmakingHttp } from './coop-matchmaking-http.ts';
import { Pvp2v2Room } from './pvp-2v2-durable-room.ts';
import { resolvePvp2v2Http, resolvePvp2v2WebSocket, type Pvp2v2HttpEnv } from './pvp-2v2-http.ts';
import {
  resolveFriendlyPvp2v2Http,
  resolveFriendlyPvp2v2WebSocket,
  type FriendlyPvp2v2HttpEnv,
} from './pvp-friendly-2v2-http.ts';
import { FriendlyPvpRoom } from './pvp-friendly-durable-room.ts';
import {
  resolveFriendlyPvpHttp,
  resolveFriendlyPvpWebSocket,
  type FriendlyPvpHttpEnv,
} from './pvp-friendly-http.ts';
import { PvpRoom } from './pvp-durable-room.ts';
import { resolvePvpHttp, resolvePvpWebSocket, type PvpHttpEnv } from './pvp-http.ts';
import { resolvePvpSeasonHttp, type PvpSeasonHttpEnv } from './pvp-season-http.ts';
import {
  resolvePvpSeasonOperationsHttp,
  type PvpSeasonOperationsHttpEnv,
} from './pvp-season-operations-http.ts';
import { resolveSocialHttp } from './social-http.ts';

export { BattleRoom, FriendlyPvpRoom, Pvp2v2Room, PvpRoom };

type EntryEnv = Env & PvpHttpEnv & FriendlyPvpHttpEnv & Pvp2v2HttpEnv & FriendlyPvp2v2HttpEnv & PvpSeasonHttpEnv & PvpSeasonOperationsHttpEnv;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
} as const;

function json(data: unknown, status: number, extra?: Readonly<Record<string, string>>): Response {
  const headers = new Headers(extra);
  headers.set('content-type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(CORS_HEADERS)) if (!headers.has(key)) headers.set(key, value);
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request: Request, env: EntryEnv): Promise<Response> {
    const friendlyPvp2v2Socket = await resolveFriendlyPvp2v2WebSocket(request, env);
    if (friendlyPvp2v2Socket) return friendlyPvp2v2Socket;
    const pvp2v2Socket = await resolvePvp2v2WebSocket(request, env);
    if (pvp2v2Socket) return pvp2v2Socket;
    const friendlyPvpSocket = await resolveFriendlyPvpWebSocket(request, env);
    if (friendlyPvpSocket) return friendlyPvpSocket;
    const pvpSocket = await resolvePvpWebSocket(request, env);
    if (pvpSocket) return pvpSocket;
    if (request.method !== 'OPTIONS') {
      const seasonOperations = await resolvePvpSeasonOperationsHttp(request, env);
      if (seasonOperations) return json(seasonOperations.body, seasonOperations.status);
      const season = await resolvePvpSeasonHttp(request, env);
      if (season) return json(season.body, season.status);
      const friendlyPvp2v2 = await resolveFriendlyPvp2v2Http(request, env);
      if (friendlyPvp2v2) return json(friendlyPvp2v2.body, friendlyPvp2v2.status);
      const pvp2v2 = await resolvePvp2v2Http(request, env);
      if (pvp2v2) return json(pvp2v2.body, pvp2v2.status);
      const friendlyPvp = await resolveFriendlyPvpHttp(request, env);
      if (friendlyPvp) return json(friendlyPvp.body, friendlyPvp.status);
      const pvp = await resolvePvpHttp(request, env);
      if (pvp) return json(pvp.body, pvp.status);
      const matchmaking = await resolveCoopMatchmakingHttp(request, env);
      if (matchmaking) return json(matchmaking.body, matchmaking.status);
      const social = await resolveSocialHttp(request, env);
      if (social) return json(social.body, social.status, social.headers);
      const migration = await resolveGuestMigrationHttp(request, env.DB);
      if (migration) return json(migration.body, migration.status, migration.headers);
    }
    return worker.fetch(request, env);
  },
};