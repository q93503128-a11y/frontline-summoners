import { DurableObject } from 'cloudflare:workers';
import { SIM_TICK_RATE } from '@frontline/shared';
import { PVP_ARENA_TEAM_V1 } from '@frontline/sim/pvp-arena-content';
import { PVP_RECONNECT_GRACE_FRAMES, type PvpTimedResult } from '@frontline/sim/pvp-content';
import {
  PVP_2V2_SEAT_IDS,
  createPvp2v2Battle,
  type Pvp2v2BattleState,
  type Pvp2v2SeatId,
} from '@frontline/sim/pvp-2v2-playable';
import { applyPvp2v2Frame, getPvp2v2Snapshot, type Pvp2v2Command } from '@frontline/sim/pvp-2v2-playable-frame';
import { FRONT_CANNON_BASE_WEAPON } from '@frontline/sim/playable';
import { getAccountFriendlyPvp2v2SeatAuthority, getAccountPvpSeatAuthority } from './account-pvp-authority.ts';
import { loadPvpMatch, loadPvpMatchParticipants, markPvpMatchActive } from './pvp-authority.ts';
import { completeTrustedCasualPvp2v2Result } from './pvp-2v2-result-authority.ts';
import {
  settleFriendlyPvp2v2Match,
  voidFriendlyPvp2v2Match,
} from './pvp-friendly-2v2-authority.ts';
import { voidTrustedPvpMatch } from './pvp-result-authority.ts';
import {
  connectPvp2v2Seat,
  createPvp2v2Room,
  disconnectPvp2v2Seat,
  finishPvp2v2Room,
  getExpiredPvp2v2Teams,
  getPvp2v2RoomSnapshot,
  parsePvp2v2RoomClientMessage,
  setPvp2v2SeatReady,
  submitPvp2v2FrameInput,
  type Pvp2v2RoomState,
} from './pvp-2v2-room.ts';

export interface Pvp2v2RoomEnv { readonly DB: D1Database; }
type SocketAttachment = { readonly clientId: string; readonly seatId: Pvp2v2SeatId };
type StoredRoom = {
  readonly room: Pvp2v2RoomState;
  readonly joinTokens: Record<Pvp2v2SeatId, string>;
  readonly seatAccountIds: Record<Pvp2v2SeatId, string>;
  readonly battle: Pvp2v2BattleState;
  settled: boolean;
  terminalResult: PvpTimedResult | null;
  terminalReason: 'BATTLE' | 'FORFEIT' | 'VOID' | null;
};

const STORAGE_KEY = 'pvp-2v2-room-v1';
const RECONNECT_GRACE_MS = Math.round(PVP_RECONNECT_GRACE_FRAMES * 1000 / SIM_TICK_RATE);

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function nonEmptyString(value: unknown): string | null { return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null; }
function isSeatId(value: unknown): value is Pvp2v2SeatId { return value === 'A1' || value === 'A2' || value === 'B1' || value === 'B2'; }
function json(data: unknown, init: ResponseInit = {}): Response { const headers = new Headers(init.headers); headers.set('content-type', 'application/json; charset=utf-8'); return new Response(JSON.stringify(data), { ...init, headers }); }
async function readObject(request: Request): Promise<Record<string, unknown>> { try { const value: unknown = await request.json(); return isRecord(value) ? value : {}; } catch { return {}; } }
function simulationResult(battle: Pvp2v2BattleState): PvpTimedResult | null { if (battle.battle.winner === 'PLAYER') return 'A'; if (battle.battle.winner === 'ENEMY') return 'B'; if (battle.battle.winner === 'DRAW') return 'DRAW'; return null; }
function participantSeat(teamId: 'A' | 'B', seatIndex: 0 | 1): Pvp2v2SeatId { return `${teamId}${seatIndex + 1}` as Pvp2v2SeatId; }

export class Pvp2v2Room extends DurableObject<Pvp2v2RoomEnv> {
  private record: StoredRoom | null = null;
  private loaded = false;

  private async loadRecord(): Promise<StoredRoom | null> {
    if (!this.loaded) { this.record = await this.ctx.storage.get<StoredRoom>(STORAGE_KEY) ?? null; this.loaded = true; }
    return this.record;
  }
  private async saveRecord(): Promise<void> { if (this.record) await this.ctx.storage.put(STORAGE_KEY, this.record); }
  private publicSnapshot(record: StoredRoom) { return { room: getPvp2v2RoomSnapshot(record.room), battle: getPvp2v2Snapshot(record.battle), terminalResult: record.terminalResult, terminalReason: record.terminalReason, teamBaseWeaponRule: 'SHARED_FRONT_CANNON_V1' as const }; }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/initialize') {
      const existing = await this.loadRecord();
      const body = await readObject(request);
      const matchId = nonEmptyString(body.matchId);
      const rawTokens = isRecord(body.joinTokens) ? body.joinTokens : {};
      const tokens = Object.fromEntries(PVP_2V2_SEAT_IDS.map((seatId) => [seatId, nonEmptyString(rawTokens[seatId])])) as Record<Pvp2v2SeatId, string | null>;
      if (!matchId || PVP_2V2_SEAT_IDS.some((seatId) => !tokens[seatId]) || new Set(PVP_2V2_SEAT_IDS.map((seatId) => tokens[seatId])).size !== 4) return json({ error: 'invalid_pvp_2v2_initialization' }, { status: 400 });
      if (existing) {
        if (existing.room.matchId === matchId) return json({ ok: true, alreadyInitialized: true });
        return json({ error: 'pvp_2v2_room_already_initialized' }, { status: 409 });
      }
      const match = await loadPvpMatch(this.env.DB, matchId);
      if (!match || (match.mode_id !== 'pvp_casual_2v2' && match.mode_id !== 'pvp_friendly_2v2')) return json({ error: 'pvp_match_not_live_2v2' }, { status: 400 });
      if (match.state !== 'CREATED') return json({ error: 'pvp_match_not_creatable' }, { status: 409 });
      const participants = await loadPvpMatchParticipants(this.env.DB, matchId);
      if (participants.length !== 4) return json({ error: 'pvp_2v2_match_seats_invalid' }, { status: 400 });
      const accountBySeat = {} as Record<Pvp2v2SeatId, string>;
      for (const participant of participants) accountBySeat[participantSeat(participant.team_id, participant.seat_index)] = participant.user_id;
      if (PVP_2V2_SEAT_IDS.some((seatId) => !accountBySeat[seatId])) return json({ error: 'pvp_2v2_match_seats_invalid' }, { status: 400 });
      const authorities = await Promise.all(PVP_2V2_SEAT_IDS.map((seatId) => match.mode_id === 'pvp_friendly_2v2'
        ? getAccountFriendlyPvp2v2SeatAuthority(this.env.DB, accountBySeat[seatId])
        : getAccountPvpSeatAuthority(this.env.DB, accountBySeat[seatId], 'pvp_casual_2v2')));
      const authorityBySeat = Object.fromEntries(PVP_2V2_SEAT_IDS.map((seatId, index) => [seatId, authorities[index]!])) as Record<Pvp2v2SeatId, Awaited<ReturnType<typeof getAccountPvpSeatAuthority>>>;
      const player = (seatId: Pvp2v2SeatId) => ({ slots: authorityBySeat[seatId].playerSlots, startingSupply: PVP_ARENA_TEAM_V1.startingSupplyPerPlayer });
      const battle = createPvp2v2Battle({
        mapLength: PVP_ARENA_TEAM_V1.mapLength,
        baseHp: PVP_ARENA_TEAM_V1.baseHp,
        teamA: { players: [player('A1'), player('A2')], baseWeapon: FRONT_CANNON_BASE_WEAPON, unitCap: PVP_ARENA_TEAM_V1.unitCapPerSide },
        teamB: { players: [player('B1'), player('B2')], baseWeapon: FRONT_CANNON_BASE_WEAPON, unitCap: PVP_ARENA_TEAM_V1.unitCapPerSide },
      });
      this.record = {
        room: createPvp2v2Room(matchId, match.mode_id),
        joinTokens: Object.fromEntries(PVP_2V2_SEAT_IDS.map((seatId) => [seatId, tokens[seatId]!])) as Record<Pvp2v2SeatId, string>,
        seatAccountIds: accountBySeat,
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
      if (!record) return json({ error: 'pvp_2v2_match_not_initialized' }, { status: 404 });
      const body = await readObject(request);
      const accountId = nonEmptyString(body.accountId);
      const seatId = body.seatId;
      if (!accountId || !isSeatId(seatId)) return json({ error: 'invalid_pvp_2v2_seat_token_request' }, { status: 400 });
      if (record.seatAccountIds[seatId] !== accountId) return json({ error: 'pvp_2v2_seat_account_mismatch' }, { status: 403 });
      return json({ token: record.joinTokens[seatId] });
    }

    if (request.method === 'POST' && url.pathname === '/cancel') {
      const record = await this.loadRecord();
      if (!record) return json({ ok: true, alreadyMissing: true });
      if (record.room.phase !== 'LOBBY') return json({ error: 'pvp_2v2_room_already_started' }, { status: 409 });
      if (record.room.modeId === 'pvp_friendly_2v2') await voidFriendlyPvp2v2Match(this.env.DB, record.room.matchId);
      else await voidTrustedPvpMatch(this.env.DB, record.room.matchId);
      this.record = null; this.loaded = true; await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }

    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket_upgrade_required' }, { status: 426 });
    const record = await this.loadRecord();
    if (!record) return json({ error: 'pvp_2v2_match_not_initialized' }, { status: 404 });
    const token = url.searchParams.get('token');
    const seatId = PVP_2V2_SEAT_IDS.find((candidate) => record.joinTokens[candidate] === token) ?? null;
    if (!seatId) return json({ error: 'invalid_pvp_2v2_join_token' }, { status: 403 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const clientId = crypto.randomUUID();
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment | null;
      if (attachment?.seatId === seatId && socket.readyState === WebSocket.OPEN) socket.close(4001, 'replaced_by_reconnect');
    }
    connectPvp2v2Seat(record.room, seatId, clientId);
    server.serializeAttachment({ clientId, seatId } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    if (PVP_2V2_SEAT_IDS.every((candidate) => record.room.seats[candidate].connected)) await this.ctx.storage.deleteAlarm();
    await this.saveRecord();
    server.send(JSON.stringify({ type: 'WELCOME', clientId, seatId, accountId: record.seatAccountIds[seatId], simTickRate: SIM_TICK_RATE, ...this.publicSnapshot(record) }));
    if (record.room.phase === 'FINISHED') await this.settle(record);
    this.broadcastState(record);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const record = await this.loadRecord();
    if (!record || typeof message !== 'string') return;
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment) return;
    try {
      const parsed = parsePvp2v2RoomClientMessage(JSON.parse(message) as unknown);
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', committedTick: record.room.committedTick, simulationTick: record.battle.battle.tick, stateHash: record.battle.stateHash }));
        return;
      }
      if (parsed.type === 'READY') {
        const ready = setPvp2v2SeatReady(record.room, attachment.seatId, attachment.clientId);
        if (ready.battleStarted) {
          await markPvpMatchActive(this.env.DB, record.room.matchId);
          this.broadcast({ type: 'BATTLE_STARTED', firstInputTick: 0, simTickRate: SIM_TICK_RATE, battle: getPvp2v2Snapshot(record.battle) });
        }
        await this.saveRecord(); this.broadcastState(record); return;
      }
      const seat = record.battle.seats[attachment.seatId];
      const allowedSlotIds = new Set(seat.slots.map((slot) => slot.slotId));
      const frames = submitPvp2v2FrameInput(record.room, attachment.seatId, attachment.clientId, parsed.input, allowedSlotIds);
      ws.send(JSON.stringify({ type: 'INPUT_ACK', tick: parsed.input.tick, sequence: parsed.input.sequence }));
      for (const frame of frames) {
        const commands = Object.fromEntries(PVP_2V2_SEAT_IDS.map((frameSeatId) => [frameSeatId, frame.inputs[frameSeatId].commands as readonly Pvp2v2Command[]])) as Record<Pvp2v2SeatId, readonly Pvp2v2Command[]>;
        const applied = applyPvp2v2Frame(record.battle, { tick: frame.tick, commands });
        this.broadcast({ type: 'FRAME_COMMITTED', frame, outcomes: applied.outcomes, battle: getPvp2v2Snapshot(record.battle) });
        const result = simulationResult(record.battle);
        if (result) { await this.finish(record, result, 'BATTLE'); break; }
      }
      await this.saveRecord();
    } catch (error) {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'invalid_message', message: error instanceof Error ? error.message : 'invalid PvP 2v2 message' }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> { await this.handleDisconnect(ws); }
  async webSocketError(ws: WebSocket): Promise<void> { await this.handleDisconnect(ws); }

  async alarm(): Promise<void> {
    const record = await this.loadRecord();
    if (!record || record.room.phase !== 'BATTLE') return;
    const expiredTeams = getExpiredPvp2v2Teams(record.room, Date.now(), RECONNECT_GRACE_MS);
    if (expiredTeams.length === 0) {
      const deadlines = PVP_2V2_SEAT_IDS.map((seatId) => record.room.seats[seatId].disconnectedAtMs).filter((value): value is number => value !== null).map((value) => value + RECONNECT_GRACE_MS);
      if (deadlines.length > 0) await this.ctx.storage.setAlarm(Math.min(...deadlines));
      return;
    }
    if (expiredTeams.length > 1) { await this.finishVoid(record); return; }
    await this.finish(record, expiredTeams[0] === 'A' ? 'B' : 'A', 'FORFEIT');
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const record = await this.loadRecord();
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!record || !attachment) return;
    const controlled = record.room.seats[attachment.seatId].clientId === attachment.clientId;
    disconnectPvp2v2Seat(record.room, attachment.seatId, attachment.clientId);
    if (controlled && record.room.phase === 'BATTLE') {
      const at = record.room.seats[attachment.seatId].disconnectedAtMs;
      if (at !== null) await this.ctx.storage.setAlarm(at + RECONNECT_GRACE_MS);
    }
    await this.saveRecord(); this.broadcastState(record);
  }

  private async finish(record: StoredRoom, result: PvpTimedResult, reason: 'BATTLE' | 'FORFEIT'): Promise<void> {
    if (record.room.phase === 'FINISHED') return;
    finishPvp2v2Room(record.room); record.terminalResult = result; record.terminalReason = reason;
    await this.saveRecord();
    this.broadcast({ type: 'BATTLE_FINISHED', result, reason, clearFrames: record.battle.battle.tick, battle: getPvp2v2Snapshot(record.battle) });
    this.broadcastState(record); await this.settle(record);
  }

  private async finishVoid(record: StoredRoom): Promise<void> {
    if (record.room.phase === 'FINISHED') return;
    finishPvp2v2Room(record.room); record.terminalResult = null; record.terminalReason = 'VOID';
    if (record.room.modeId === 'pvp_friendly_2v2') await voidFriendlyPvp2v2Match(this.env.DB, record.room.matchId).catch(() => undefined);
    else await voidTrustedPvpMatch(this.env.DB, record.room.matchId).catch(() => undefined);
    record.settled = true;
    await this.saveRecord(); this.broadcast({ type: 'BATTLE_VOID', reason: 'both_teams_disconnect_timeout' }); this.broadcastState(record);
  }

  private async settle(record: StoredRoom): Promise<void> {
    if (record.settled || record.room.phase !== 'FINISHED' || !record.terminalResult || record.terminalReason === 'VOID') return;
    try {
      const settlement = record.room.modeId === 'pvp_friendly_2v2'
        ? await settleFriendlyPvp2v2Match(this.env.DB, record.room.matchId, record.terminalResult)
        : await completeTrustedCasualPvp2v2Result(this.env.DB, record.room.matchId, record.terminalResult);
      record.settled = true; await this.saveRecord(); this.broadcast({ type: 'ACCOUNT_SETTLED', settlement });
    } catch (error) { this.broadcast({ type: 'ACCOUNT_SETTLEMENT_ERROR', message: error instanceof Error ? error.message : 'PvP 2v2 settlement failed' }); }
  }

  private broadcastState(record: StoredRoom): void { this.broadcast({ type: 'ROOM_STATE', ...this.publicSnapshot(record) }); }
  private broadcast(payload: unknown): void { const message = JSON.stringify(payload); for (const socket of this.ctx.getWebSockets()) if (socket.readyState === WebSocket.OPEN) socket.send(message); }
}
