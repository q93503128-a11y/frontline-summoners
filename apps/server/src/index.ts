import { DurableObject } from 'cloudflare:workers';
import { COOP_QUICK_MESSAGE_IDS, SIM_TICK_RATE, type CoopQuickMessageId } from '@frontline/shared';
import {
  applyCoopPlayableFrame,
  getCoopPlayableSnapshot,
  type CoopPlayableBattleState,
  type CoopPlayableCommand,
} from '@frontline/sim/coop-playable';
import { resolveAuthenticatedAccountHttp } from './account-http.ts';
import { resolveAuthHttp, type AuthHttpResult } from './auth-http.ts';
import { getAccountCoopSeatAuthority, settleAuthenticatedCoopWin } from './account-coop-authority.ts';
import { drainCoopFramesAfterAiHandoff } from './coop-ai-handoff.ts';
import {
  connectCoopSeat,
  createCoopRoom,
  disconnectCoopSeat,
  getCoopRoomSnapshot,
  parseCoopClientMessage,
  setCoopSeatBaseWeapon,
  setCoopSeatReady,
  setCoopSeatUnready,
  submitCoopFrameInput,
  type CoopCommittedFrame,
  type CoopRoomState,
  type CoopSeatId,
} from './coop-room.ts';
import {
  assertServerCoopBaseWeaponUnlocked,
  createServerCoopBattle,
  getServerCoopLoadout,
  getServerCoopStage,
} from './runtime-content.ts';
import { isEitherSocialBlocked, recordRecentCoopPlayers } from './social-authority.ts';

export interface Env {
  DB: D1Database;
  BATTLE_ROOM: DurableObjectNamespace<BattleRoom>;
  GOOGLE_CLIENT_ID?: string;
  AUTH_ALLOWED_ORIGINS?: string;
}

type SocketAttachment = {
  clientId: string;
  seatId: CoopSeatId;
};

type StoredCoopRoom = {
  room: CoopRoomState;
  joinTokens: Record<CoopSeatId, string>;
  seatAccountIds: Record<CoopSeatId, string | null>;
  matchKind: 'CODE' | 'FRIEND';
  reconnectedSeats: Record<CoopSeatId, boolean>;
  quickMessageTimesMs: Record<CoopSeatId, number[]>;
  settledSeats: Record<CoopSeatId, boolean>;
  recentPlayersRecorded: boolean;
  battleStartedAtMs: number | null;
  battle: CoopPlayableBattleState | null;
};

const ROOM_STORAGE_KEY = 'coop-room-v5';
const QUICK_MESSAGE_COOLDOWN_MS = 900;
const QUICK_MESSAGE_BURST_WINDOW_MS = 8_000;
const QUICK_MESSAGE_BURST_MAX = 4;
const QUICK_MESSAGE_ID_SET = new Set<string>(COOP_QUICK_MESSAGE_IDS);

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
} as const;

const json = (data: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(JSON.stringify(data), { ...init, headers });
};

function authResponse(result: AuthHttpResult): Response {
  const headers = new Headers(result.headers);
  if (result.status === 204) return new Response(null, { status: 204, headers });
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}

const matchSocketPattern = /^\/api\/matches\/([A-Za-z0-9_-]{1,128})\/websocket$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isSeatId(value: unknown): value is CoopSeatId {
  return value === 'A' || value === 'B';
}

function isQuickMessageId(value: unknown): value is CoopQuickMessageId {
  return typeof value === 'string' && QUICK_MESSAGE_ID_SET.has(value);
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

    const authHttpResult = await resolveAuthHttp(request, {
      DB: env.DB,
      ...(env.GOOGLE_CLIENT_ID === undefined ? {} : { GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID }),
      ...(env.AUTH_ALLOWED_ORIGINS === undefined ? {} : { AUTH_ALLOWED_ORIGINS: env.AUTH_ALLOWED_ORIGINS }),
    });
    if (authHttpResult) return authResponse(authHttpResult);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'frontline-summoners-api', simTickRate: SIM_TICK_RATE });
    }

    if (request.method === 'GET' && url.pathname === '/api/db-health') {
      const row = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
      return json({ ok: row?.ok === 1 });
    }

    const accountHttpResult = await resolveAuthenticatedAccountHttp(request, env.DB);
    if (accountHttpResult) {
      return json(accountHttpResult.body, {
        status: accountHttpResult.status,
        ...(accountHttpResult.headers === undefined ? {} : { headers: accountHttpResult.headers }),
      });
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

  private publicRoomSnapshot(record: StoredCoopRoom) {
    const room = getCoopRoomSnapshot(record.room);
    return {
      ...room,
      matchKind: record.matchKind,
      seats: room.seats.map((seat) => ({
        ...seat,
        accountBound: record.seatAccountIds[seat.seatId] !== null,
      })),
    };
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
      const seatAccountIds = isRecord(body.seatAccountIds) ? body.seatAccountIds : {};
      const accountA = nonEmptyString(seatAccountIds.A);
      const accountB = nonEmptyString(seatAccountIds.B);
      const matchKind = body.matchKind === 'FRIEND' ? 'FRIEND' : 'CODE';
      if (!matchId || !stageId || !tokenA || !tokenB || tokenA === tokenB) {
        return json({ error: 'invalid_match_initialization' }, { status: 400 });
      }
      if ((accountA === null) !== (accountB === null) || (accountA !== null && accountA === accountB)) {
        return json({ error: 'invalid_account_bound_seats' }, { status: 400 });
      }
      if (matchKind === 'FRIEND' && (!accountA || !accountB)) return json({ error: 'friend_match_requires_accounts' }, { status: 400 });
      if (coopStageRequestError(stageId)) return json({ error: 'invalid_coop_stage' }, { status: 400 });
      if (existing) {
        if (existing.room.matchId === matchId && existing.room.stageId === stageId) return json({ ok: true, alreadyInitialized: true });
        return json({ error: 'room_already_initialized' }, { status: 409 });
      }
      const room = createCoopRoom(matchId, stageId);
      if (accountA && accountB) {
        const [authorityA, authorityB] = await Promise.all([
          getAccountCoopSeatAuthority(this.env.DB, accountA, stageId),
          getAccountCoopSeatAuthority(this.env.DB, accountB, stageId),
        ]);
        room.seats.A.selectedBaseWeaponId = authorityA.selectedBaseWeaponId;
        room.seats.B.selectedBaseWeaponId = authorityB.selectedBaseWeaponId;
      }
      this.record = {
        room,
        joinTokens: { A: tokenA, B: tokenB },
        seatAccountIds: { A: accountA, B: accountB },
        matchKind,
        reconnectedSeats: { A: false, B: false },
        quickMessageTimesMs: { A: [], B: [] },
        settledSeats: { A: false, B: false },
        recentPlayersRecorded: false,
        battleStartedAtMs: null,
        battle: null,
      };
      this.loaded = true;
      await this.saveRecord();
      return json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/cancel') {
      const record = await this.loadRecord();
      if (!record) return json({ ok: true, alreadyMissing: true });
      if (record.room.phase !== 'LOBBY') return json({ error: 'room_already_started' }, { status: 409 });
      this.record = null;
      this.loaded = true;
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/seat-token') {
      const record = await this.loadRecord();
      if (!record) return json({ error: 'match_not_initialized' }, { status: 404 });
      const body = await readJsonObject(request);
      const seatId = body.seatId;
      const accountId = nonEmptyString(body.accountId);
      if (!isSeatId(seatId) || !accountId) return json({ error: 'invalid_seat_token_request' }, { status: 400 });
      if (record.seatAccountIds[seatId] !== accountId) return json({ error: 'seat_account_mismatch' }, { status: 403 });
      return json({ token: record.joinTokens[seatId] });
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
    const reconnectingFromAi = record.room.phase === 'BATTLE' && record.room.seats[seatId].control === 'AI';

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.seatId === seatId && socket.readyState === WebSocket.OPEN) {
        socket.close(4001, 'replaced_by_reconnect');
      }
    }

    connectCoopSeat(record.room, seatId, clientId);
    if (reconnectingFromAi) record.reconnectedSeats[seatId] = true;
    server.serializeAttachment({ clientId, seatId } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    await this.saveRecord();

    server.send(JSON.stringify({
      type: 'WELCOME',
      clientId,
      seatId,
      simTickRate: SIM_TICK_RATE,
      room: this.publicRoomSnapshot(record),
      ...(record.battle === null ? {} : { battle: getCoopPlayableSnapshot(record.battle) }),
    }));
    if (record.battle) {
      server.send(JSON.stringify({
        type: record.room.phase === 'FINISHED' ? 'BATTLE_FINISHED' : 'BATTLE_RESUME',
        committedTick: record.room.committedTick,
        battle: getCoopPlayableSnapshot(record.battle),
      }));
    }
    if (record.room.phase === 'FINISHED') {
      await this.settleAuthenticatedOutcome(record);
      await this.saveRecord();
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
      const decoded: unknown = JSON.parse(message);
      if (isRecord(decoded) && decoded.type === 'QUICK_MESSAGE') {
        await this.handleQuickMessage(record, attachment, decoded.messageId, ws);
        return;
      }
      const parsed = parseCoopClientMessage(decoded);
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({
          type: 'PONG',
          committedTick: record.room.committedTick,
          ...(record.battle === null ? {} : { simulationTick: record.battle.shared.battle.tick, stateHash: record.battle.stateHash }),
        }));
        return;
      }
      if (parsed.type === 'SELECT_BASE_WEAPON') {
        setCoopSeatBaseWeapon(record.room, attachment.seatId, attachment.clientId, parsed.baseWeaponId);
        await this.saveRecord();
        this.broadcastRoomState();
        return;
      }
      if (parsed.type === 'READY') {
        const accountId = record.seatAccountIds[attachment.seatId];
        const loadout = accountId
          ? (await getAccountCoopSeatAuthority(this.env.DB, accountId, record.room.stageId)).loadout
          : getServerCoopLoadout(parsed.loadout);
        const selectedBaseWeaponId = record.room.seats[attachment.seatId].selectedBaseWeaponId;
        assertServerCoopBaseWeaponUnlocked(selectedBaseWeaponId, loadout.clearedStageIds);
        const result = setCoopSeatReady(record.room, attachment.seatId, attachment.clientId, loadout);
        if (result.battleStarted) {
          const loadoutA = record.room.seats.A.loadout;
          const loadoutB = record.room.seats.B.loadout;
          const weaponA = record.room.seats.A.selectedBaseWeaponId;
          const weaponB = record.room.seats.B.selectedBaseWeaponId;
          if (!loadoutA || !loadoutB) throw new Error('co-op ready state is missing validated loadout');
          if (weaponA !== weaponB) throw new Error('co-op ready state is missing shared base weapon agreement');
          record.battle = createServerCoopBattle(record.room.stageId, loadoutA, loadoutB, weaponA);
          record.battleStartedAtMs = Date.now();
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
      if (finished) await this.finishBattle(record);
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

  private async handleQuickMessage(
    record: StoredCoopRoom,
    attachment: SocketAttachment,
    rawMessageId: unknown,
    ws: WebSocket,
  ): Promise<void> {
    if (!isQuickMessageId(rawMessageId)) throw new Error('invalid_quick_message_id');
    const seat = record.room.seats[attachment.seatId];
    if (!seat.connected || seat.clientId !== attachment.clientId || seat.control !== 'PLAYER') throw new Error('quick_message_seat_not_controlled');
    const nowMs = Date.now();
    const recent = record.quickMessageTimesMs[attachment.seatId].filter((time) => nowMs - time <= QUICK_MESSAGE_BURST_WINDOW_MS);
    const last = recent[recent.length - 1];
    if (last !== undefined && nowMs - last < QUICK_MESSAGE_COOLDOWN_MS) {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'quick_message_rate_limited' }));
      return;
    }
    if (recent.length >= QUICK_MESSAGE_BURST_MAX) {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'quick_message_rate_limited' }));
      return;
    }
    recent.push(nowMs);
    record.quickMessageTimesMs[attachment.seatId] = recent;
    await this.saveRecord();

    const payload = { type: 'QUICK_MESSAGE', seatId: attachment.seatId, messageId: rawMessageId, serverTimeMs: nowMs };
    this.sendToSeat(attachment.seatId, payload);
    const otherSeatId: CoopSeatId = attachment.seatId === 'A' ? 'B' : 'A';
    const senderAccountId = record.seatAccountIds[attachment.seatId];
    const receiverAccountId = record.seatAccountIds[otherSeatId];
    if (senderAccountId && receiverAccountId && await isEitherSocialBlocked(this.env.DB, senderAccountId, receiverAccountId)) return;
    this.sendToSeat(otherSeatId, payload);
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

  private async finishBattle(record: StoredCoopRoom): Promise<void> {
    if (!record.battle || record.room.phase === 'FINISHED') return;
    record.room.phase = 'FINISHED';
    await this.saveRecord();
    this.broadcast({
      type: 'BATTLE_FINISHED',
      stageId: record.room.stageId,
      clearFrames: record.battle.shared.battle.tick,
      winner: record.battle.shared.battle.winner,
      battle: getCoopPlayableSnapshot(record.battle),
    });
    this.broadcastRoomState();
    await this.settleAuthenticatedOutcome(record);
  }

  private async settleAuthenticatedOutcome(record: StoredCoopRoom): Promise<void> {
    if (!record.battle || record.room.phase !== 'FINISHED') return;
    const accountA = record.seatAccountIds.A;
    const accountB = record.seatAccountIds.B;
    if (accountA && accountB && !record.recentPlayersRecorded) {
      await recordRecentCoopPlayers(this.env.DB, accountA, accountB, record.room.matchId, record.room.stageId);
      record.recentPlayersRecorded = true;
    }
    if (record.battle.shared.battle.winner !== 'PLAYER') {
      await this.saveRecord();
      return;
    }
    for (const seatId of ['A', 'B'] as const) {
      const accountId = record.seatAccountIds[seatId];
      if (!accountId || record.settledSeats[seatId]) continue;
      try {
        await settleAuthenticatedCoopWin(this.env.DB, accountId, record.room.stageId, record.room.matchId, {
          friendMatch: record.matchKind === 'FRIEND',
          reconnected: record.reconnectedSeats[seatId],
          ...(record.battleStartedAtMs === null ? {} : { battleStartedAtMs: record.battleStartedAtMs }),
        });
        record.settledSeats[seatId] = true;
        this.sendToSeat(seatId, { type: 'ACCOUNT_SETTLED', seatId, stageId: record.room.stageId });
      } catch (error) {
        this.sendToSeat(seatId, {
          type: 'ACCOUNT_SETTLEMENT_ERROR',
          seatId,
          message: error instanceof Error ? error.message : 'account settlement failed',
        });
      }
    }
    await this.saveRecord();
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
      if (finished) await this.finishBattle(record);
    }
    await this.saveRecord();
    this.broadcastRoomState();
  }

  private broadcastRoomState(): void {
    if (!this.record) return;
    this.broadcast({
      type: 'ROOM_STATE',
      room: this.publicRoomSnapshot(this.record),
      ...(this.record.battle === null ? {} : { battle: getCoopPlayableSnapshot(this.record.battle) }),
    });
  }

  private sendToSeat(seatId: CoopSeatId, payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.seatId === seatId && socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }

  private broadcast(payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }
}
