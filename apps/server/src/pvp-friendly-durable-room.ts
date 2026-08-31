import { DurableObject } from 'cloudflare:workers';
import { SIM_TICK_RATE } from '@frontline/shared';
import { computeStateHash } from '@frontline/sim';
import { PVP_ARENA_DUEL_V1 } from '@frontline/sim/pvp-arena-content';
import { PVP_RECONNECT_GRACE_FRAMES, type PvpTimedResult } from '@frontline/sim/pvp-content';
import {
  computePvp1v1StateHash,
  createPvp1v1Battle,
  type Pvp1v1BattleState,
} from '@frontline/sim/pvp-playable';
import {
  applyPvp1v1Frame,
  getPvp1v1Snapshot,
  type Pvp1v1Command,
} from '@frontline/sim/pvp-playable-frame';
import { getBaseWeaponDefinition } from '@frontline/sim/playable';
import {
  assertFriendlyPvpPairAllowed,
  createFriendlyPvpDatabaseMatch,
  getAccountFriendlyPvpAuthority,
  parseFriendlyPvpGrowthPolicy,
  settleFriendlyPvpMatch,
  voidFriendlyPvpMatch,
  type FriendlyPvpGrowthPolicy,
} from './pvp-friendly-authority.ts';
import { markPvpMatchActive } from './pvp-authority.ts';
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

export interface FriendlyPvpRoomEnv {
  readonly DB: D1Database;
}

type SocketAttachment = {
  readonly clientId: string;
  readonly seatId: PvpRoomSeatId;
};

type StoredFriendlyPvpRoom = {
  readonly inviteCode: string;
  readonly growthPolicy: FriendlyPvpGrowthPolicy;
  readonly hostAccountId: string;
  guestAccountId: string | null;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly room: PvpRoomState;
  readonly joinTokens: { A: string; B: string | null };
  battle: Pvp1v1BattleState | null;
  settled: boolean;
  terminalResult: PvpTimedResult | null;
  terminalReason: 'BATTLE' | 'FORFEIT' | 'VOID' | null;
};

const STORAGE_KEY = 'friendly-pvp-room-v1';
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

export class FriendlyPvpRoom extends DurableObject<FriendlyPvpRoomEnv> {
  private record: StoredFriendlyPvpRoom | null = null;
  private loaded = false;

  private async loadRecord(): Promise<StoredFriendlyPvpRoom | null> {
    if (!this.loaded) {
      this.record = await this.ctx.storage.get<StoredFriendlyPvpRoom>(STORAGE_KEY) ?? null;
      this.loaded = true;
    }
    return this.record;
  }

  private async saveRecord(): Promise<void> {
    if (this.record) await this.ctx.storage.put(STORAGE_KEY, this.record);
  }

  private publicSnapshot(record: StoredFriendlyPvpRoom) {
    if (!record.battle) throw new Error('friendly_pvp_battle_not_initialized');
    return {
      room: getPvpRoomSnapshot(record.room),
      battle: getPvp1v1Snapshot(record.battle),
      terminalResult: record.terminalResult,
      terminalReason: record.terminalReason,
      growthPolicy: record.growthPolicy,
    };
  }

  private accountSeat(record: StoredFriendlyPvpRoom, accountId: string): PvpRoomSeatId | null {
    if (accountId === record.hostAccountId) return 'A';
    if (record.guestAccountId === accountId) return 'B';
    return null;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/initialize-host') {
      const body = await readObject(request);
      const inviteCode = nonEmptyString(body.inviteCode);
      const accountId = nonEmptyString(body.accountId);
      const hostToken = nonEmptyString(body.hostToken);
      const growthPolicy = parseFriendlyPvpGrowthPolicy(body.growthPolicy);
      const expiresAtMs = typeof body.expiresAtMs === 'number' && Number.isFinite(body.expiresAtMs) ? Math.trunc(body.expiresAtMs) : 0;
      if (!inviteCode || !accountId || !hostToken || !growthPolicy || expiresAtMs <= Date.now()) {
        return json({ error: 'invalid_friendly_pvp_initialization' }, { status: 400 });
      }
      const existing = await this.loadRecord();
      if (existing) {
        if (existing.inviteCode === inviteCode && existing.hostAccountId === accountId) {
          return json({ ok: true, alreadyInitialized: true, expiresAtMs: existing.expiresAtMs });
        }
        return json({ error: 'friendly_pvp_room_already_initialized' }, { status: 409 });
      }
      await getAccountFriendlyPvpAuthority(this.env.DB, accountId, growthPolicy);
      this.record = {
        inviteCode,
        growthPolicy,
        hostAccountId: accountId,
        guestAccountId: null,
        createdAtMs: Date.now(),
        expiresAtMs,
        room: createPvpRoom(inviteCode, 'pvp_friendly_1v1'),
        joinTokens: { A: hostToken, B: null },
        battle: null,
        settled: false,
        terminalResult: null,
        terminalReason: null,
      };
      this.loaded = true;
      await this.saveRecord();
      await this.ctx.storage.setAlarm(expiresAtMs);
      return json({ ok: true, expiresAtMs });
    }

    if (request.method === 'POST' && url.pathname === '/join-guest') {
      const record = await this.loadRecord();
      if (!record) return json({ error: 'friendly_pvp_lobby_not_found' }, { status: 404 });
      if (Date.now() >= record.expiresAtMs && record.guestAccountId === null) {
        await this.ctx.storage.deleteAll();
        this.record = null;
        return json({ error: 'friendly_pvp_lobby_expired' }, { status: 410 });
      }
      const body = await readObject(request);
      const accountId = nonEmptyString(body.accountId);
      if (!accountId) return json({ error: 'friendly_pvp_guest_required' }, { status: 400 });
      if (record.guestAccountId !== null) {
        if (record.guestAccountId !== accountId || !record.joinTokens.B) return json({ error: 'friendly_pvp_lobby_full' }, { status: 409 });
        return json({
          ok: true,
          alreadyJoined: true,
          seatId: 'B',
          token: record.joinTokens.B,
          growthPolicy: record.growthPolicy,
        });
      }
      await assertFriendlyPvpPairAllowed(this.env.DB, record.hostAccountId, accountId);
      const [host, guest] = await Promise.all([
        getAccountFriendlyPvpAuthority(this.env.DB, record.hostAccountId, record.growthPolicy),
        getAccountFriendlyPvpAuthority(this.env.DB, accountId, record.growthPolicy),
      ]);
      await createFriendlyPvpDatabaseMatch(this.env.DB, record.inviteCode, record.hostAccountId, accountId);
      const battle = createPvp1v1Battle({
        mapLength: PVP_ARENA_DUEL_V1.mapLength,
        baseHp: PVP_ARENA_DUEL_V1.baseHp,
        sideA: {
          slots: host.playerSlots,
          baseWeapon: getBaseWeaponDefinition(host.selectedBaseWeaponId),
          startingSupply: host.startingSupply,
          supplyLevels: host.supplyLevels,
          unitCap: host.unitCap,
        },
        sideB: {
          slots: guest.playerSlots,
          baseWeapon: getBaseWeaponDefinition(guest.selectedBaseWeaponId),
          startingSupply: guest.startingSupply,
          supplyLevels: guest.supplyLevels,
          unitCap: guest.unitCap,
        },
      });
      battle.battle.bases.PLAYER = { ...battle.battle.bases.PLAYER, maxHp: host.baseHp, hp: host.baseHp };
      battle.battle.bases.ENEMY = { ...battle.battle.bases.ENEMY, maxHp: guest.baseHp, hp: guest.baseHp };
      battle.battle.stateHash = computeStateHash(battle.battle);
      battle.stateHash = computePvp1v1StateHash(battle);
      const guestToken = crypto.randomUUID();
      record.guestAccountId = accountId;
      record.joinTokens.B = guestToken;
      record.battle = battle;
      await this.ctx.storage.deleteAlarm();
      await this.saveRecord();
      return json({ ok: true, seatId: 'B', token: guestToken, growthPolicy: record.growthPolicy });
    }

    if (request.method === 'POST' && url.pathname === '/status') {
      const record = await this.loadRecord();
      if (!record) return json({ error: 'friendly_pvp_lobby_not_found' }, { status: 404 });
      const body = await readObject(request);
      const accountId = nonEmptyString(body.accountId);
      if (!accountId) return json({ error: 'friendly_pvp_account_required' }, { status: 400 });
      const seatId = this.accountSeat(record, accountId);
      if (!seatId) return json({ error: 'friendly_pvp_lobby_forbidden' }, { status: 403 });
      if (record.guestAccountId === null) {
        if (Date.now() >= record.expiresAtMs) return json({ state: 'EXPIRED', inviteCode: record.inviteCode, growthPolicy: record.growthPolicy });
        return json({ state: 'WAITING', inviteCode: record.inviteCode, growthPolicy: record.growthPolicy, expiresAtMs: record.expiresAtMs });
      }
      const token = record.joinTokens[seatId];
      if (!token || !record.battle) return json({ error: 'friendly_pvp_match_not_ready' }, { status: 503 });
      return json({
        state: 'MATCHED',
        inviteCode: record.inviteCode,
        matchId: record.inviteCode,
        seatId,
        token,
        growthPolicy: record.growthPolicy,
      });
    }

    if (request.method === 'POST' && url.pathname === '/cancel') {
      const record = await this.loadRecord();
      if (!record) return json({ ok: true, alreadyMissing: true });
      const body = await readObject(request);
      const accountId = nonEmptyString(body.accountId);
      if (!accountId || accountId !== record.hostAccountId) return json({ error: 'friendly_pvp_cancel_forbidden' }, { status: 403 });
      if (record.room.phase === 'BATTLE') return json({ error: 'friendly_pvp_battle_already_started' }, { status: 409 });
      if (record.guestAccountId !== null) await voidFriendlyPvpMatch(this.env.DB, record.inviteCode).catch(() => undefined);
      this.record = null;
      this.loaded = true;
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket_upgrade_required' }, { status: 426 });
    const record = await this.loadRecord();
    if (!record || !record.battle || record.guestAccountId === null) return json({ error: 'friendly_pvp_match_not_ready' }, { status: 404 });
    const token = url.searchParams.get('token');
    const seatId: PvpRoomSeatId | null = token === record.joinTokens.A ? 'A' : token === record.joinTokens.B ? 'B' : null;
    if (!seatId) return json({ error: 'invalid_friendly_pvp_join_token' }, { status: 403 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const clientId = crypto.randomUUID();
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.seatId === seatId && socket.readyState === WebSocket.OPEN) socket.close(4001, 'replaced_by_reconnect');
    }
    connectPvpSeat(record.room, seatId, clientId);
    server.serializeAttachment({ clientId, seatId } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    if (record.room.seats.A.connected && record.room.seats.B.connected) await this.ctx.storage.deleteAlarm();
    await this.saveRecord();
    server.send(JSON.stringify({
      type: 'WELCOME',
      clientId,
      seatId,
      simTickRate: SIM_TICK_RATE,
      ...this.publicSnapshot(record),
    }));
    if (record.room.phase === 'FINISHED') await this.settle(record);
    this.broadcastState(record);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const record = await this.loadRecord();
    if (!record || !record.battle) return;
    if (typeof message !== 'string') {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'binary_not_supported' }));
      return;
    }
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
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
          await markPvpMatchActive(this.env.DB, record.inviteCode);
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
        this.broadcast({ type: 'FRAME_COMMITTED', frame, outcomes: applied.outcomes, battle: getPvp1v1Snapshot(applied.state) });
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
        message: error instanceof Error ? error.message : 'invalid friendly PvP message',
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
    if (!record) return;
    if (record.guestAccountId === null && record.room.phase === 'LOBBY') {
      if (Date.now() < record.expiresAtMs) return void await this.ctx.storage.setAlarm(record.expiresAtMs);
      this.record = null;
      this.loaded = true;
      await this.ctx.storage.deleteAll();
      return;
    }
    if (record.room.phase !== 'BATTLE') return;
    const now = Date.now();
    const aAt = record.room.seats.A.disconnectedAtMs;
    const bAt = record.room.seats.B.disconnectedAtMs;
    if (aAt !== null && bAt !== null) {
      const deadline = Math.max(aAt + RECONNECT_GRACE_MS, bAt + RECONNECT_GRACE_MS);
      if (now < deadline) return void await this.ctx.storage.setAlarm(deadline);
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
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!record || !attachment) return;
    const controlled = record.room.seats[attachment.seatId].clientId === attachment.clientId;
    disconnectPvpSeat(record.room, attachment.seatId, attachment.clientId);
    if (controlled && record.room.phase === 'BATTLE') {
      const disconnectedAt = record.room.seats[attachment.seatId].disconnectedAtMs;
      if (disconnectedAt !== null) await this.ctx.storage.setAlarm(disconnectedAt + RECONNECT_GRACE_MS);
    }
    await this.saveRecord();
    if (record.battle) this.broadcastState(record);
  }

  private async finish(record: StoredFriendlyPvpRoom, result: PvpTimedResult, reason: 'BATTLE' | 'FORFEIT'): Promise<void> {
    if (!record.battle || record.room.phase === 'FINISHED') return;
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

  private async finishVoid(record: StoredFriendlyPvpRoom): Promise<void> {
    if (record.room.phase === 'FINISHED') return;
    finishPvpRoom(record.room);
    record.terminalResult = null;
    record.terminalReason = 'VOID';
    await voidFriendlyPvpMatch(this.env.DB, record.inviteCode).catch(() => undefined);
    record.settled = true;
    await this.saveRecord();
    this.broadcast({ type: 'BATTLE_VOID', reason: 'both_players_disconnected' });
    this.broadcastState(record);
  }

  private async settle(record: StoredFriendlyPvpRoom): Promise<void> {
    if (record.settled || record.room.phase !== 'FINISHED' || !record.terminalResult || record.terminalReason === 'VOID') return;
    try {
      await settleFriendlyPvpMatch(this.env.DB, record.inviteCode, record.terminalResult);
      record.settled = true;
      await this.saveRecord();
      this.broadcast({
        type: 'ACCOUNT_SETTLED',
        settlement: {
          matchId: record.inviteCode,
          modeId: 'pvp_friendly_1v1',
          result: record.terminalResult,
          rated: false,
          growthPolicy: record.growthPolicy,
        },
      });
    } catch (error) {
      this.broadcast({
        type: 'ACCOUNT_SETTLEMENT_ERROR',
        message: error instanceof Error ? error.message : 'friendly PvP settlement failed',
      });
    }
  }

  private broadcastState(record: StoredFriendlyPvpRoom): void {
    this.broadcast({ type: 'ROOM_STATE', ...this.publicSnapshot(record) });
  }

  private broadcast(payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) if (socket.readyState === WebSocket.OPEN) socket.send(message);
  }
}
