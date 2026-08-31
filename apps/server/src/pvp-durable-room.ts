import { DurableObject } from 'cloudflare:workers';
import { SIM_TICK_RATE } from '@frontline/shared';
import { PVP_ARENA_DUEL_V1 } from '@frontline/sim/pvp-arena-content';
import {
  createPvp1v1Battle,
  type Pvp1v1BattleState,
  type Pvp1v1SideId,
} from '@frontline/sim/pvp-playable';
import {
  applyPvp1v1Frame,
  getPvp1v1Snapshot,
  type Pvp1v1Command,
} from '@frontline/sim/pvp-playable-frame';
import { PVP_RECONNECT_GRACE_FRAMES, type PvpTimedResult } from '@frontline/sim/pvp-content';
import { getBaseWeaponDefinition } from '@frontline/sim/playable';
import { getAccountPvpSeatAuthority } from './account-pvp-authority.ts';
import {
  loadPvpMatch,
  loadPvpMatchParticipants,
  markPvpMatchActive,
} from './pvp-authority.ts';
import {
  completeTrustedPvp1v1Result,
  voidTrustedPvpMatch,
} from './pvp-result-authority.ts';
import {
  connectPvpSeat,
  createPvpRoom,
  disconnectPvpSeat,
  finishPvpRoom,
  getPvpRoomSnapshot,
  parsePvpRoomClientMessage,
  setPvpSeatReady,
  submitPvpFrameInput,
  type PvpRoomSeatId,
  type PvpRoomState,
} from './pvp-room.ts';

export interface PvpRoomEnv {
  DB: D1Database;
}

type PvpSocketAttachment = {
  readonly clientId: string;
  readonly seatId: PvpRoomSeatId;
};

type StoredPvpRoom = {
  room: PvpRoomState;
  joinTokens: Record<PvpRoomSeatId, string>;
  seatAccountIds: Record<PvpRoomSeatId, string>;
  battle: Pvp1v1BattleState;
  settled: boolean;
  terminalResult: PvpTimedResult | null;
  terminalReason: 'BATTLE' | 'FORFEIT' | 'VOID' | null;
};

const PVP_ROOM_STORAGE_KEY = 'pvp-room-v1';
const RECONNECT_GRACE_MS = Math.round(PVP_RECONNECT_GRACE_FRAMES * 1000 / SIM_TICK_RATE);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isSeatId(value: unknown): value is PvpRoomSeatId {
  return value === 'A' || value === 'B';
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function readObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function simulationResult(battle: Pvp1v1BattleState): PvpTimedResult | null {
  if (battle.battle.winner === 'PLAYER') return 'A';
  if (battle.battle.winner === 'ENEMY') return 'B';
  if (battle.battle.winner === 'DRAW') return 'DRAW';
  return null;
}

export class PvpRoom extends DurableObject<PvpRoomEnv> {
  private record: StoredPvpRoom | null = null;
  private loaded = false;

  private async loadRecord(): Promise<StoredPvpRoom | null> {
    if (!this.loaded) {
      this.record = await this.ctx.storage.get<StoredPvpRoom>(PVP_ROOM_STORAGE_KEY) ?? null;
      this.loaded = true;
    }
    return this.record;
  }

  private async saveRecord(): Promise<void> {
    if (this.record) await this.ctx.storage.put(PVP_ROOM_STORAGE_KEY, this.record);
  }

  private publicSnapshot(record: StoredPvpRoom) {
    return {
      room: getPvpRoomSnapshot(record.room),
      battle: getPvp1v1Snapshot(record.battle),
      terminalResult: record.terminalResult,
      terminalReason: record.terminalReason,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/initialize') {
      const existing = await this.loadRecord();
      const body = await readObject(request);
      const matchId = nonEmptyString(body.matchId);
      const joinTokens = isRecord(body.joinTokens) ? body.joinTokens : {};
      const tokenA = nonEmptyString(joinTokens.A);
      const tokenB = nonEmptyString(joinTokens.B);
      if (!matchId || !tokenA || !tokenB || tokenA === tokenB) return json({ error: 'invalid_pvp_initialization' }, { status: 400 });
      if (existing) {
        if (existing.room.matchId === matchId) return json({ ok: true, alreadyInitialized: true });
        return json({ error: 'pvp_room_already_initialized' }, { status: 409 });
      }

      const match = await loadPvpMatch(this.env.DB, matchId);
      if (!match || (match.mode_id !== 'pvp_casual_1v1' && match.mode_id !== 'pvp_ranked_1v1')) {
        return json({ error: 'pvp_match_not_live_1v1' }, { status: 400 });
      }
      if (match.state !== 'CREATED') return json({ error: 'pvp_match_not_creatable' }, { status: 409 });
      const participants = await loadPvpMatchParticipants(this.env.DB, matchId);
      const participantA = participants.find((entry) => entry.team_id === 'A' && entry.seat_index === 0);
      const participantB = participants.find((entry) => entry.team_id === 'B' && entry.seat_index === 0);
      if (!participantA || !participantB || participants.length !== 2) return json({ error: 'pvp_match_seats_invalid' }, { status: 400 });

      const [authorityA, authorityB] = await Promise.all([
        getAccountPvpSeatAuthority(this.env.DB, participantA.user_id, match.mode_id),
        getAccountPvpSeatAuthority(this.env.DB, participantB.user_id, match.mode_id),
      ]);
      const battle = createPvp1v1Battle({
        mapLength: PVP_ARENA_DUEL_V1.mapLength,
        baseHp: PVP_ARENA_DUEL_V1.baseHp,
        sideA: {
          slots: authorityA.playerSlots,
          baseWeapon: getBaseWeaponDefinition(authorityA.selectedBaseWeaponId),
          startingSupply: PVP_ARENA_DUEL_V1.startingSupplyPerPlayer,
          unitCap: PVP_ARENA_DUEL_V1.unitCapPerSide,
        },
        sideB: {
          slots: authorityB.playerSlots,
          baseWeapon: getBaseWeaponDefinition(authorityB.selectedBaseWeaponId),
          startingSupply: PVP_ARENA_DUEL_V1.startingSupplyPerPlayer,
          unitCap: PVP_ARENA_DUEL_V1.unitCapPerSide,
        },
      });
      this.record = {
        room: createPvpRoom(matchId, match.mode_id),
        joinTokens: { A: tokenA, B: tokenB },
        seatAccountIds: { A: participantA.user_id, B: participantB.user_id },
        battle,
        settled: false,
        terminalResult: null,
        terminalReason: null,
      };
      this.loaded = true;
      await this.saveRecord();
      return json({ ok: true });
    }

    if (request.method === 'POST' && url.pathname === '/seat-token') {
      const record = await this.loadRecord();
      if (!record) return json({ error: 'pvp_match_not_initialized' }, { status: 404 });
      const body = await readObject(request);
      const seatId = body.seatId;
      const accountId = nonEmptyString(body.accountId);
      if (!isSeatId(seatId) || !accountId) return json({ error: 'invalid_pvp_seat_token_request' }, { status: 400 });
      if (record.seatAccountIds[seatId] !== accountId) return json({ error: 'pvp_seat_account_mismatch' }, { status: 403 });
      return json({ token: record.joinTokens[seatId] });
    }

    if (request.method === 'POST' && url.pathname === '/cancel') {
      const record = await this.loadRecord();
      if (!record) return json({ ok: true, alreadyMissing: true });
      if (record.room.phase !== 'LOBBY') return json({ error: 'pvp_room_already_started' }, { status: 409 });
      await voidTrustedPvpMatch(this.env.DB, record.room.matchId);
      this.record = null;
      this.loaded = true;
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket_upgrade_required' }, { status: 426 });
    const record = await this.loadRecord();
    if (!record) return json({ error: 'pvp_match_not_initialized' }, { status: 404 });
    const token = url.searchParams.get('token');
    const seatId: PvpRoomSeatId | null = token === record.joinTokens.A ? 'A' : token === record.joinTokens.B ? 'B' : null;
    if (!seatId) return json({ error: 'invalid_pvp_join_token' }, { status: 403 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const clientId = crypto.randomUUID();
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as PvpSocketAttachment | null;
      if (attachment?.seatId === seatId && socket.readyState === WebSocket.OPEN) socket.close(4001, 'replaced_by_reconnect');
    }
    connectPvpSeat(record.room, seatId, clientId);
    server.serializeAttachment({ clientId, seatId } satisfies PvpSocketAttachment);
    this.ctx.acceptWebSocket(server);
    if (record.room.seats.A.connected && record.room.seats.B.connected) await this.ctx.storage.deleteAlarm();
    await this.saveRecord();
    server.send(JSON.stringify({
      type: 'WELCOME',
      clientId,
      seatId,
      accountId: record.seatAccountIds[seatId],
      simTickRate: SIM_TICK_RATE,
      ...this.publicSnapshot(record),
    }));
    if (record.room.phase === 'FINISHED') await this.settle(record);
    this.broadcastState(record);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const record = await this.loadRecord();
    if (!record) return;
    if (typeof message !== 'string') {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'binary_not_supported' }));
      return;
    }
    const attachment = ws.deserializeAttachment() as PvpSocketAttachment | null;
    if (!attachment) return;
    try {
      const parsed = parsePvpRoomClientMessage(JSON.parse(message) as unknown);
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({
          type: 'PONG',
          committedTick: record.room.committedTick,
          simulationTick: record.battle.battle.tick,
          stateHash: record.battle.stateHash,
        }));
        return;
      }
      if (parsed.type === 'READY') {
        const ready = setPvpSeatReady(record.room, attachment.seatId, attachment.clientId);
        if (ready.battleStarted) {
          await markPvpMatchActive(this.env.DB, record.room.matchId);
          this.broadcast({
            type: 'BATTLE_STARTED',
            firstInputTick: 0,
            simTickRate: SIM_TICK_RATE,
            battle: getPvp1v1Snapshot(record.battle),
          });
        }
        await this.saveRecord();
        this.broadcastState(record);
        return;
      }
      const side = record.battle.sides[attachment.seatId];
      const allowedSlotIds = new Set(side.slots.map((slot) => slot.slotId));
      const frames = submitPvpFrameInput(record.room, attachment.seatId, attachment.clientId, parsed.input, allowedSlotIds);
      ws.send(JSON.stringify({ type: 'INPUT_ACK', tick: parsed.input.tick, sequence: parsed.input.sequence }));
      for (const frame of frames) {
        const applied = applyPvp1v1Frame(record.battle, {
          tick: frame.tick,
          commands: {
            A: frame.inputs.A.commands as readonly Pvp1v1Command[],
            B: frame.inputs.B.commands as readonly Pvp1v1Command[],
          },
        });
        const snapshot = getPvp1v1Snapshot(applied.state);
        this.broadcast({ type: 'FRAME_COMMITTED', frame, outcomes: applied.outcomes, battle: snapshot });
        const result = simulationResult(record.battle);
        if (result) {
          await this.finish(record, result, 'BATTLE');
          break;
        }
      }
      await this.saveRecord();
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'ERROR',
        code: 'invalid_message',
        message: error instanceof Error ? error.message : 'invalid PvP message',
      }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async alarm(): Promise<void> {
    const record = await this.loadRecord();
    if (!record || record.room.phase !== 'BATTLE') return;
    const now = Date.now();
    const aAt = record.room.seats.A.disconnectedAtMs;
    const bAt = record.room.seats.B.disconnectedAtMs;
    if (aAt !== null && bAt !== null) {
      const aDeadline = aAt + RECONNECT_GRACE_MS;
      const bDeadline = bAt + RECONNECT_GRACE_MS;
      const finalDeadline = Math.max(aDeadline, bDeadline);
      if (now < finalDeadline) {
        await this.ctx.storage.setAlarm(finalDeadline);
        return;
      }
      await this.finishVoid(record);
      return;
    }
    if (aAt !== null) {
      const deadline = aAt + RECONNECT_GRACE_MS;
      if (now < deadline) return void await this.ctx.storage.setAlarm(deadline);
      await this.finish(record, 'B', 'FORFEIT');
      return;
    }
    if (bAt !== null) {
      const deadline = bAt + RECONNECT_GRACE_MS;
      if (now < deadline) return void await this.ctx.storage.setAlarm(deadline);
      await this.finish(record, 'A', 'FORFEIT');
    }
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const record = await this.loadRecord();
    const attachment = ws.deserializeAttachment() as PvpSocketAttachment | null;
    if (!record || !attachment) return;
    const controlled = record.room.seats[attachment.seatId].clientId === attachment.clientId;
    disconnectPvpSeat(record.room, attachment.seatId, attachment.clientId);
    if (controlled && record.room.phase === 'BATTLE') {
      const disconnectedAt = record.room.seats[attachment.seatId].disconnectedAtMs;
      if (disconnectedAt !== null) await this.ctx.storage.setAlarm(disconnectedAt + RECONNECT_GRACE_MS);
    }
    await this.saveRecord();
    this.broadcastState(record);
  }

  private async finish(record: StoredPvpRoom, result: PvpTimedResult, reason: 'BATTLE' | 'FORFEIT'): Promise<void> {
    if (record.room.phase === 'FINISHED') return;
    finishPvpRoom(record.room);
    record.terminalResult = result;
    record.terminalReason = reason;
    await this.saveRecord();
    this.broadcast({
      type: 'BATTLE_FINISHED',
      result,
      reason,
      clearFrames: record.battle.battle.tick,
      battle: getPvp1v1Snapshot(record.battle),
    });
    this.broadcastState(record);
    await this.settle(record);
  }

  private async finishVoid(record: StoredPvpRoom): Promise<void> {
    if (record.room.phase === 'FINISHED') return;
    finishPvpRoom(record.room);
    record.terminalResult = null;
    record.terminalReason = 'VOID';
    await voidTrustedPvpMatch(this.env.DB, record.room.matchId);
    record.settled = true;
    await this.saveRecord();
    this.broadcast({ type: 'BATTLE_VOID', reason: 'both_players_disconnected' });
    this.broadcastState(record);
  }

  private async settle(record: StoredPvpRoom): Promise<void> {
    if (record.settled || record.room.phase !== 'FINISHED' || !record.terminalResult || record.terminalReason === 'VOID') return;
    try {
      const settlement = await completeTrustedPvp1v1Result(this.env.DB, record.room.matchId, record.terminalResult);
      record.settled = true;
      await this.saveRecord();
      this.broadcast({ type: 'ACCOUNT_SETTLED', settlement });
    } catch (error) {
      this.broadcast({
        type: 'ACCOUNT_SETTLEMENT_ERROR',
        message: error instanceof Error ? error.message : 'PvP settlement failed',
      });
    }
  }

  private broadcastState(record: StoredPvpRoom): void {
    this.broadcast({ type: 'ROOM_STATE', ...this.publicSnapshot(record) });
  }

  private broadcast(payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) if (socket.readyState === WebSocket.OPEN) socket.send(message);
  }
}
