import { DurableObject } from 'cloudflare:workers';
import { SIM_TICK_RATE } from '@frontline/shared';

export interface Env {
  DB: D1Database;
  BATTLE_ROOM: DurableObjectNamespace<BattleRoom>;
}

type SocketAttachment = {
  clientId: string;
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
} as const;

const json = (data: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(JSON.stringify(data), { ...init, headers });
};

const matchSocketPattern = /^\/api\/matches\/([A-Za-z0-9_-]{1,128})\/websocket$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'frontline-summoners-api', simTickRate: SIM_TICK_RATE });
    }

    if (request.method === 'GET' && url.pathname === '/api/db-health') {
      const row = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
      return json({ ok: row?.ok === 1 });
    }

    if (request.method === 'POST' && url.pathname === '/api/matches') {
      const matchId = crypto.randomUUID();
      return json({ matchId, websocketPath: `/api/matches/${matchId}/websocket` }, { status: 201 });
    }

    const socketMatch = url.pathname.match(matchSocketPattern);
    if (request.method === 'GET' && socketMatch) {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
        return json({ error: 'websocket_upgrade_required' }, { status: 426 });
      }
      const matchId = socketMatch[1]!;
      const roomId = env.BATTLE_ROOM.idFromName(matchId);
      return env.BATTLE_ROOM.get(roomId).fetch(request);
    }

    return json({ error: 'not_found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export class BattleRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'websocket_upgrade_required' }, { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const clientId = crypto.randomUUID();
    server.serializeAttachment({ clientId } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: 'WELCOME', clientId, simTickRate: SIM_TICK_RATE }));
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'binary_not_supported' }));
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'invalid_json' }));
      return;
    }

    if (typeof payload === 'object' && payload !== null && 'type' in payload && payload.type === 'PING') {
      ws.send(JSON.stringify({ type: 'PONG' }));
      return;
    }

    ws.send(JSON.stringify({ type: 'ERROR', code: 'unsupported_message' }));
  }

  webSocketClose(): void {
    this.broadcastPresence();
  }

  webSocketError(): void {
    this.broadcastPresence();
  }

  private broadcastPresence(): void {
    const sockets = this.ctx.getWebSockets();
    const message = JSON.stringify({ type: 'PRESENCE', connections: sockets.length });
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }
}
