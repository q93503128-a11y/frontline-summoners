import type { Pvp2v2Command } from '@frontline/sim/pvp-2v2-playable-frame';
import type { Pvp2v2SeatId, Pvp2v2TeamId } from '@frontline/sim/pvp-2v2-playable';
import type { BaseWeaponId } from '@frontline/sim/playable';
import { getAccountClientState, refreshAuthenticatedAccount } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export type Pvp2v2ConnectionState = 'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'CLOSED';
export type Pvp2v2MatchmakingState =
  | { readonly state: 'IDLE' }
  | { readonly state: 'QUEUED' | 'PAIRING'; readonly modeId: 'pvp_casual_2v2'; readonly queuedAtMs: number; readonly expiresAtMs: number }
  | { readonly state: 'MATCHED'; readonly modeId: 'pvp_casual_2v2'; readonly matchId: string; readonly seatId: Pvp2v2SeatId; readonly websocketPath: string; readonly matchedAtMs: number };

export interface Pvp2v2RoomSnapshot {
  readonly matchId: string;
  readonly modeId: 'pvp_casual_2v2' | 'pvp_friendly_2v2';
  readonly phase: 'LOBBY' | 'BATTLE' | 'FINISHED';
  readonly committedTick: number;
  readonly seats: readonly {
    readonly seatId: Pvp2v2SeatId;
    readonly teamId: Pvp2v2TeamId;
    readonly connected: boolean;
    readonly ready: boolean;
    readonly reconnecting: boolean;
    readonly nextSequence: number;
  }[];
}

export interface Pvp2v2BattleSnapshot {
  readonly tick: number;
  readonly stateHash: string;
  readonly winner: 'PLAYER' | 'ENEMY' | 'DRAW' | null;
  readonly timedResult: 'A' | 'B' | 'DRAW' | null;
  readonly timeLimitFrames: number;
  readonly bases: { readonly aHp: number; readonly aMaxHp: number; readonly bHp: number; readonly bMaxHp: number; readonly aBaseDamageDealt: number; readonly bBaseDamageDealt: number };
  readonly teams: readonly {
    readonly teamId: Pvp2v2TeamId;
    readonly unitCap: number;
    readonly aliveUnits: number;
    readonly baseWeaponId: BaseWeaponId | null;
    readonly baseWeaponCooldownFrames: number;
    readonly baseWeaponLastActivatedSeatId: Pvp2v2SeatId | null;
  }[];
  readonly seats: readonly {
    readonly seatId: Pvp2v2SeatId;
    readonly teamId: Pvp2v2TeamId;
    readonly supply: number;
    readonly maxSupply: number;
    readonly supplyLevel: number;
    readonly nextSupplyUpgradeCost: number | null;
    readonly costs: Readonly<Record<string, number>>;
    readonly cooldowns: Readonly<Record<string, number>>;
  }[];
  readonly units: readonly {
    readonly simulationId: number;
    readonly definitionId: string;
    readonly teamId: Pvp2v2TeamId;
    readonly ownerSeatId?: Pvp2v2SeatId;
    readonly hp: number;
    readonly maxHp: number;
    readonly anchorX: number;
    readonly state: string;
  }[];
}

export type Pvp2v2ServerMessage =
  | { readonly type: 'WELCOME'; readonly clientId: string; readonly seatId: Pvp2v2SeatId; readonly simTickRate: number; readonly room: Pvp2v2RoomSnapshot; readonly battle: Pvp2v2BattleSnapshot; readonly teamBaseWeaponRule?: string }
  | { readonly type: 'ROOM_STATE'; readonly room: Pvp2v2RoomSnapshot; readonly battle: Pvp2v2BattleSnapshot; readonly terminalResult?: 'A' | 'B' | 'DRAW' | null; readonly terminalReason?: string | null }
  | { readonly type: 'BATTLE_STARTED'; readonly firstInputTick: number; readonly simTickRate: number; readonly battle: Pvp2v2BattleSnapshot }
  | { readonly type: 'FRAME_COMMITTED'; readonly battle: Pvp2v2BattleSnapshot; readonly outcomes: readonly unknown[] }
  | { readonly type: 'BATTLE_FINISHED'; readonly result: 'A' | 'B' | 'DRAW'; readonly reason: string; readonly clearFrames: number; readonly battle: Pvp2v2BattleSnapshot }
  | { readonly type: 'BATTLE_VOID'; readonly reason: string }
  | { readonly type: 'ACCOUNT_SETTLED'; readonly settlement: unknown }
  | { readonly type: 'ACCOUNT_SETTLEMENT_ERROR'; readonly message: string }
  | { readonly type: 'INPUT_ACK'; readonly tick: number; readonly sequence: number }
  | { readonly type: 'PONG'; readonly committedTick: number; readonly simulationTick: number; readonly stateHash: string }
  | { readonly type: 'ERROR'; readonly code: string; readonly message?: string };

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function token(): string { if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('2v2 PvP는 온라인 로그인 상태에서만 사용할 수 있습니다.'); const value = typeof window === 'undefined' ? null : window.sessionStorage.getItem(SESSION_TOKEN_KEY); if (!value || !SESSION_TOKEN_PATTERN.test(value)) throw new Error('로그인 세션을 찾을 수 없습니다.'); return value; }
async function request(path: string, init: RequestInit = {}): Promise<unknown> { const headers = new Headers(init.headers); headers.set('authorization', `Bearer ${token()}`); if (init.body !== undefined) headers.set('content-type', 'application/json'); const response = await fetch(`${resolveCoopApiOrigin()}${path}`, { ...init, headers }); const payload: unknown = await response.json().catch(() => ({})); if (!response.ok) { if (response.status === 401) await refreshAuthenticatedAccount(); const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP_${response.status}`; throw new Error(code); } return payload; }

function parseState(value: unknown): Pvp2v2MatchmakingState {
  if (!isRecord(value) || typeof value.state !== 'string') throw new Error('2v2 PvP 매칭 응답 형식이 올바르지 않습니다.');
  if (value.state === 'IDLE') return { state: 'IDLE' };
  if (value.state === 'QUEUED' || value.state === 'PAIRING') {
    if (value.modeId !== 'pvp_casual_2v2' || typeof value.queuedAtMs !== 'number' || typeof value.expiresAtMs !== 'number') throw new Error('2v2 PvP 대기열 응답 형식이 올바르지 않습니다.');
    return { state: value.state, modeId: 'pvp_casual_2v2', queuedAtMs: value.queuedAtMs, expiresAtMs: value.expiresAtMs };
  }
  if (value.state === 'MATCHED') {
    if (value.modeId !== 'pvp_casual_2v2' || typeof value.matchId !== 'string' || !['A1','A2','B1','B2'].includes(String(value.seatId)) || typeof value.websocketPath !== 'string' || typeof value.matchedAtMs !== 'number') throw new Error('2v2 PvP 매치 응답 형식이 올바르지 않습니다.');
    return { state: 'MATCHED', modeId: 'pvp_casual_2v2', matchId: value.matchId, seatId: value.seatId as Pvp2v2SeatId, websocketPath: value.websocketPath, matchedAtMs: value.matchedAtMs };
  }
  throw new Error(`알 수 없는 2v2 PvP 상태: ${value.state}`);
}

export async function joinPvp2v2Matchmaking(): Promise<Pvp2v2MatchmakingState> { return parseState(await request('/api/pvp/2v2/matchmaking/join', { method: 'POST' })); }
export async function getPvp2v2MatchmakingStatus(): Promise<Pvp2v2MatchmakingState> { return parseState(await request('/api/pvp/2v2/matchmaking/status')); }
export async function leavePvp2v2Matchmaking(): Promise<Pvp2v2MatchmakingState> { return parseState(await request('/api/pvp/2v2/matchmaking/leave', { method: 'POST' })); }
function websocketUrl(path: string): string { const url = new URL(path, `${resolveCoopApiOrigin()}/`); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; return url.toString(); }

type MessageSubscriber = (message: Pvp2v2ServerMessage) => void;
type ConnectionSubscriber = (state: Pvp2v2ConnectionState) => void;

export class Pvp2v2Session {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private inputTimer: number | null = null;
  private readonly subscribers = new Set<MessageSubscriber>();
  private readonly connectionSubscribers = new Set<ConnectionSubscriber>();
  private readonly queuedCommands: Pvp2v2Command[] = [];
  private sequence = 0;
  private lastSubmittedTick = -1;
  private deliberatelyClosed = false;
  seatId: Pvp2v2SeatId | null = null;
  clientId: string | null = null;
  room: Pvp2v2RoomSnapshot | null = null;
  battle: Pvp2v2BattleSnapshot | null = null;
  connectionState: Pvp2v2ConnectionState = 'CLOSED';

  constructor(readonly websocketPath: string) {}
  subscribe(subscriber: MessageSubscriber): () => void { this.subscribers.add(subscriber); return () => this.subscribers.delete(subscriber); }
  subscribeConnection(subscriber: ConnectionSubscriber): () => void { this.connectionSubscribers.add(subscriber); subscriber(this.connectionState); return () => this.connectionSubscribers.delete(subscriber); }
  connect(): void { this.deliberatelyClosed = false; this.open(this.connectionState === 'CLOSED' ? 'CONNECTING' : 'RECONNECTING'); }
  private open(state: 'CONNECTING' | 'RECONNECTING'): void { if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) return; this.setConnectionState(state); const socket = new WebSocket(websocketUrl(this.websocketPath)); this.socket = socket; socket.addEventListener('open', () => this.setConnectionState('OPEN')); socket.addEventListener('message', (event) => this.handleMessage(event.data)); socket.addEventListener('close', () => this.handleClose(socket)); socket.addEventListener('error', () => { if (socket.readyState !== WebSocket.CLOSED) socket.close(); }); }
  private syncCursor(room: Pvp2v2RoomSnapshot): void { if (!this.seatId) return; const mine = room.seats.find((seat) => seat.seatId === this.seatId); if (mine) this.sequence = Math.max(this.sequence, mine.nextSequence); this.lastSubmittedTick = Math.max(this.lastSubmittedTick, room.committedTick); }
  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return; let decoded: unknown; try { decoded = JSON.parse(raw); } catch { return; } if (!isRecord(decoded) || typeof decoded.type !== 'string') return;
    const message = decoded as unknown as Pvp2v2ServerMessage;
    if (message.type === 'WELCOME') { this.seatId = message.seatId; this.clientId = message.clientId; this.room = message.room; this.battle = message.battle; this.syncCursor(message.room); }
    else if (message.type === 'ROOM_STATE') { this.room = message.room; this.battle = message.battle; this.syncCursor(message.room); }
    else if (message.type === 'BATTLE_STARTED' || message.type === 'FRAME_COMMITTED' || message.type === 'BATTLE_FINISHED') { this.battle = message.battle; if (message.type === 'BATTLE_FINISHED') this.stopInputPump(); }
    else if (message.type === 'BATTLE_VOID') this.stopInputPump();
    else if (message.type === 'INPUT_ACK') { this.sequence = Math.max(this.sequence, message.sequence + 1); this.lastSubmittedTick = Math.max(this.lastSubmittedTick, message.tick); }
    for (const subscriber of this.subscribers) subscriber(message);
  }
  sendReady(): void { this.send({ type: 'READY' }); }
  queueCommand(command: Pvp2v2Command): void { if (this.queuedCommands.length < 8) this.queuedCommands.push(command); }
  startInputPump(tickRate = 30): void { if (this.inputTimer !== null || typeof window === 'undefined') return; const interval = Math.max(16, Math.round(1000 / Math.max(1, tickRate))); const pump = () => { const battle = this.battle; if (!battle || battle.winner !== null || this.connectionState !== 'OPEN') return; const tick = battle.tick; if (tick <= this.lastSubmittedTick) return; const commands = this.queuedCommands.splice(0, this.queuedCommands.length); this.send({ type: 'FRAME_INPUT', input: { tick, sequence: this.sequence, commands } }); this.sequence += 1; this.lastSubmittedTick = tick; }; this.inputTimer = window.setInterval(pump, interval); pump(); }
  stopInputPump(): void { if (this.inputTimer !== null && typeof window !== 'undefined') window.clearInterval(this.inputTimer); this.inputTimer = null; }
  close(): void { this.deliberatelyClosed = true; this.stopInputPump(); if (this.reconnectTimer !== null && typeof window !== 'undefined') window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.socket?.close(1000, 'client_close'); this.socket = null; this.setConnectionState('CLOSED'); }
  private handleClose(socket: WebSocket): void { if (this.socket !== socket) return; this.socket = null; this.stopInputPump(); if (this.deliberatelyClosed || typeof window === 'undefined') { this.setConnectionState('CLOSED'); return; } this.setConnectionState('RECONNECTING'); this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.open('RECONNECTING'); }, 900); }
  private send(payload: unknown): void { if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('2v2 PvP 서버에 연결되어 있지 않습니다.'); this.socket.send(JSON.stringify(payload)); }
  private setConnectionState(state: Pvp2v2ConnectionState): void { if (this.connectionState === state) return; this.connectionState = state; for (const subscriber of this.connectionSubscribers) subscriber(state); }
}

export const __pvp2v2NetworkTestOnly = { parseState };
