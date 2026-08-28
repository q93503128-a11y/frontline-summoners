import { DurableObject } from 'cloudflare:workers';
import { SIM_TICK_RATE } from '@frontline/shared';
import {
  applyCoopPlayableFrame,
  getCoopPlayableSnapshot,
  type CoopPlayableBattleState,
  type CoopPlayableCommand,
} from '@frontline/sim/coop-playable';
import { drainCoopFramesAfterAiHandoff } from './coop-ai-handoff.ts';
import {
  connectCoopSeat,
  createCoopRoom,
  disconnectCoopSeat,
  getCoopRoomSnapshot,
  parseCoopClientMessage,
  setCoopSeatReady,
  setCoopSeatUnready,
  submitCoopFrameInput,
  type CoopCommittedFrame,
  type CoopRoomState,
  type CoopSeatId,
} from './coop-room.ts';
import {
  createServerCoopBattle,
  getServerCoopLoadout,
  getServerCoopStage,
} from './runtime-content.ts';

export interface Env {
  DB: D1Database;
  BATTLE_ROOM: DurableObjectNamespace<BattleRoom>;
}

type SocketAttachment = {
  clientId: string;
  seatId: CoopSeatId;
};

type StoredCoopRoom = {
  room: CoopRoomState;
  joinTokens: Record<CoopSeatId, string>;
  battle: CoopPlayableBattleState | null;
};

const ROOM_STORAGE_KEY = 'coop-room-v3';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function coopStageRequestError(stageId: string): string | null {
  try {
    getServerCoopStage(stageId);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('stage_not_coop_eligible:')) return 'stage_not_coop_eligible';
    if (message.startsWith('unknown_server_stage:')) return 'unknown_stage';
    return 'invalid_stage';
  }
}

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
      const body = await readJsonObject(request);
      const stageId = nonEmptyString(body.stageId);
      if (!stageId) return json({ error: 'stage_id_required' }, { status: 400 });
      const stageError = coopStageRequestError(stageId);
      if (stageError) return json({ error: stageError }, { status: 400 });

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
        }),
      }));
      if (!initialized.ok) return json({ error: 'match_initialization_failed' }, { status: 503 });

      const socketBase = `/api/matches/${matchId}/websocket`;
      return json({
        matchId,
        stageId,
        simTickRate: SIM_TICK_RATE,
        host: { seatId: 'A', joinToken: hostToken, websocketPath: `${socketBase}?token=${encodeURIComponent(hostToken)}` },
        guest: { seatId: 'B', joinToken: guestToken, websocketPath: `${socketBase}?token=${encodeURIComponent(guestToken)}` },
      }, { status: 201 });
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
  private record: StoredCoopRoom | null = null;
  private loaded = false;

  private async loadRecord(): Promise<StoredCoopRoom | null> {
    if (!this.loaded) {
      this.record = await this.ctx.storage.get<StoredCoopRoom>(ROOM_STORAGE_KEY) ?? null;
      this.loaded = true;
    }
    return this.record;
  }

  private async saveRecord(): Promise<void> {
    if (this.record) await this.ctx.storage.put(ROOM_STORAGE_KEY, this.record);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/initialize') {
      const existing = await this.loadRecord();
      const body = await readJsonObject(request);
      const matchId = nonEmptyString(body.matchId);
      const stageId = nonEmptyString(body.stageId);
      const joinTokens = isRecord(body.joinTokens) ? body.joinTokens : {};
      const tokenA = nonEmptyString(joinTokens.A);
      const tokenB = nonEmptyString(joinTokens.B);
      if (!matchId || !stageId || !tokenA || !tokenB || tokenA === tokenB) {
        return json({ error: 'invalid_match_initialization' }, { status: 400 });
      }
      if (coopStageRequestError(stageId)) return json({ error: 'invalid_coop_stage' }, { status: 400 });
      if (existing) {
        if (existing.room.matchId === matchId && existing.room.stageId === stageId) return json({ ok: true, alreadyInitialized: true });
        return json({ error: 'room_already_initialized' }, { status: 409 });
      }
      this.record = {
        room: createCoopRoom(matchId, stageId),
        joinTokens: { A: tokenA, B: tokenB },
        battle: null,
      };
      this.loaded = true;
      await this.saveRecord();
      return json({ ok: true });
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'websocket_upgrade_required' }, { status: 426 });
    }

    const record = await this.loadRecord();
    if (!record) return json({ error: 'match_not_initialized' }, { status: 404 });
    const token = url.searchParams.get('token');
    const seatId = token === record.joinTokens.A ? 'A' : token === record.joinTokens.B ? 'B' : null;
    if (!seatId) return json({ error: 'invalid_join_token' }, { status: 403 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const clientId = crypto.randomUUID();

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.seatId === seatId && socket.readyState === WebSocket.OPEN) {
        socket.close(4001, 'replaced_by_reconnect');
      }
    }

    connectCoopSeat(record.room, seatId, clientId);
    server.serializeAttachment({ clientId, seatId } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    await this.saveRecord();

    server.send(JSON.stringify({
      type: 'WELCOME',
      clientId,
      seatId,
      simTickRate: SIM_TICK_RATE,
      room: getCoopRoomSnapshot(record.room),
      ...(record.battle === null ? {} : { battle: getCoopPlayableSnapshot(record.battle) }),
    }));
    if (record.battle) {
      server.send(JSON.stringify({
        type: record.room.phase === 'FINISHED' ? 'BATTLE_FINISHED' : 'BATTLE_RESUME',
        committedTick: record.room.committedTick,
        battle: getCoopPlayableSnapshot(record.battle),
      }));
    }
    this.broadcastRoomState();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const record = await this.loadRecord();
    if (!record) {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'match_not_initialized' }));
      return;
    }
    if (typeof message !== 'string') {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'binary_not_supported' }));
      return;
    }
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'missing_socket_attachment' }));
      return;
    }

    try {
      const parsed = parseCoopClientMessage(JSON.parse(message) as unknown);
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({
          type: 'PONG',
          committedTick: record.room.committedTick,
          ...(record.battle === null ? {} : { simulationTick: record.battle.shared.battle.tick, stateHash: record.battle.stateHash }),
        }));
        return;
      }
      if (parsed.type === 'READY') {
        getServerCoopLoadout(parsed.loadout);
        const result = setCoopSeatReady(record.room, attachment.seatId, attachment.clientId, parsed.loadout);
        if (result.battleStarted) {
          const loadoutA = record.room.seats.A.loadout;
          const loadoutB = record.room.seats.B.loadout;
          if (!loadoutA || !loadoutB) throw new Error('co-op ready state is missing validated loadout');
          record.battle = createServerCoopBattle(record.room.stageId, loadoutA, loadoutB);
        }
        await this.saveRecord();
        this.broadcastRoomState();
        if (result.battleStarted && record.battle) {
          this.broadcast({
            type: 'BATTLE_STARTED',
            stageId: record.room.stageId,
            firstInputTick: 0,
            simTickRate: SIM_TICK_RATE,
            battle: getCoopPlayableSnapshot(record.battle),
          });
        }
        return;
      }
      if (parsed.type === 'UNREADY') {
        setCoopSeatUnready(record.room, attachment.seatId, attachment.clientId);
        await this.saveRecord();
        this.broadcastRoomState();
        return;
      }

      const result = submitCoopFrameInput(record.room, attachment.seatId, attachment.clientId, parsed.input);
      if (!record.battle) throw new Error('co-op simulation is not initialized');
      ws.send(JSON.stringify({ type: 'INPUT_ACK', tick: parsed.input.tick, sequence: parsed.input.sequence }));
      const finished = this.applyCommittedFrames(record, result.committedFrames);
      if (finished) this.finishBattle(record);
      await this.saveRecord();
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        code: 'invalid_message',
        message: error instanceof Error ? error.message : 'invalid message',
      }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  private applyCommittedFrames(record: StoredCoopRoom, frames: readonly CoopCommittedFrame[]): boolean {
    if (!record.battle) return false;
    let finished = record.room.phase === 'FINISHED';
    for (const frame of frames) {
      if (finished) {
        this.broadcast({
          type: 'FRAME_COMMITTED',
          frame,
          terminalNoop: true,
          outcomes: [],
          battle: getCoopPlayableSnapshot(record.battle),
        });
        continue;
      }
      const applied = applyCoopPlayableFrame(record.battle, frame.tick, {
        A: frame.inputs.A.commands as readonly CoopPlayableCommand[],
        B: frame.inputs.B.commands as readonly CoopPlayableCommand[],
      });
      this.broadcast({ type: 'FRAME_COMMITTED', frame, outcomes: applied.outcomes, battle: applied.snapshot });
      if (applied.snapshot.winner !== null) finished = true;
    }
    return finished;
  }

  private finishBattle(record: StoredCoopRoom): void {
    if (!record.battle || record.room.phase === 'FINISHED') return;
    record.room.phase = 'FINISHED';
    this.broadcast({
      type: 'BATTLE_FINISHED',
      stageId: record.room.stageId,
      clearFrames: record.battle.shared.battle.tick,
      winner: record.battle.shared.battle.winner,
      battle: getCoopPlayableSnapshot(record.battle),
    });
    this.broadcastRoomState();
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const record = await this.loadRecord();
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!record || !attachment) return;
    const wasController = record.room.seats[attachment.seatId].clientId === attachment.clientId;
    disconnectCoopSeat(record.room, attachment.seatId, attachment.clientId);
    if (wasController && record.room.phase === 'BATTLE' && record.battle) {
      const frames = drainCoopFramesAfterAiHandoff(record.room);
      const finished = this.applyCommittedFrames(record, frames);
      if (finished) this.finishBattle(record);
    }
    await this.saveRecord();
    this.broadcastRoomState();
  }

  private broadcastRoomState(): void {
    if (!this.record) return;
    this.broadcast({
      type: 'ROOM_STATE',
      room: getCoopRoomSnapshot(this.record.room),
      ...(this.record.battle === null ? {} : { battle: getCoopPlayableSnapshot(this.record.battle) }),
    });
  }

  private broadcast(payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }
}
