import type { BaseWeaponId } from '@frontline/sim/playable';
import type { Pvp1v1Command } from '@frontline/sim/pvp-playable-frame';
import type { PvpModeId, PvpTierId } from '@frontline/sim/pvp-content';
import { getAccountClientState, refreshAuthenticatedAccount } from './account-network.ts';
import { resolveCoopApiOrigin } from './coop-network.ts';

export type PvpSeatId = 'A' | 'B';
export type PvpConnectionState = 'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'CLOSED';

export type PvpMatchmakingState =
  | { readonly state: 'IDLE' }
  | { readonly state: 'QUEUED' | 'PAIRING'; readonly modeId: PvpModeId; readonly queuedAtMs: number; readonly expiresAtMs: number }
  | { readonly state: 'MATCHED'; readonly modeId: PvpModeId; readonly matchId: string; readonly seatId: PvpSeatId; readonly websocketPath: string; readonly matchedAtMs: number };

export interface PvpRatingView {
  readonly seasonId: string;
  readonly mmr: number;
  readonly bestMmr: number;
  readonly displayedTier: PvpTierId;
  readonly placementMatches: number;
  readonly placementComplete: boolean;
  readonly rankedWins: number;
  readonly rankedLosses: number;
  readonly rankedDraws: number;
  readonly casualWins: number;
  readonly casualLosses: number;
  readonly casualDraws: number;
  readonly revision: number;
}

export interface PvpEligibilityView {
  readonly eligible: boolean;
  readonly failure: string | null;
  readonly chapter1Complete: boolean;
  readonly ownedCharacterCount: number;
  readonly deckSize: number;
  readonly displayName: string;
}

export interface PvpAccountOverview {
  readonly rating: PvpRatingView;
  readonly eligibility: PvpEligibilityView;
}

export interface PvpLeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly mmr: number;
  readonly displayedTier: PvpTierId;
  readonly rankedWins: number;
  readonly rank: number;
}

export interface PvpRoomSnapshot {
  readonly matchId: string;
  readonly modeId: PvpModeId;
  readonly phase: 'LOBBY' | 'BATTLE' | 'FINISHED';
  readonly committedTick: number;
  readonly seats: readonly {
    readonly seatId: PvpSeatId;
    readonly connected: boolean;
    readonly ready: boolean;
    readonly reconnecting: boolean;
  }[];
}

export interface PvpBattleSnapshot {
  readonly tick: number;
  readonly stateHash: string;
  readonly winner: 'PLAYER' | 'ENEMY' | 'DRAW' | null;
  readonly timedResult: 'A' | 'B' | 'DRAW' | null;
  readonly timeLimitFrames: number;
  readonly bases: {
    readonly aHp: number;
    readonly aMaxHp: number;
    readonly bHp: number;
    readonly bMaxHp: number;
    readonly aBaseDamageDealt: number;
    readonly bBaseDamageDealt: number;
  };
  readonly sides: readonly {
    readonly sideId: PvpSeatId;
    readonly supply: number;
    readonly maxSupply: number;
    readonly supplyLevel: number;
    readonly nextSupplyUpgradeCost: number | null;
    readonly baseWeaponId: BaseWeaponId | null;
    readonly baseWeaponCooldownFrames: number;
    readonly costs: Readonly<Record<string, number>>;
    readonly cooldowns: Readonly<Record<string, number>>;
  }[];
  readonly units: readonly {
    readonly simulationId: number;
    readonly definitionId: string;
    readonly sideId: PvpSeatId;
    readonly hp: number;
    readonly maxHp: number;
    readonly anchorX: number;
    readonly state: string;
  }[];
}

export type PvpServerMessage =
  | { readonly type: 'WELCOME'; readonly clientId: string; readonly seatId: PvpSeatId; readonly simTickRate: number; readonly room: PvpRoomSnapshot; readonly battle: PvpBattleSnapshot }
  | { readonly type: 'ROOM_STATE'; readonly room: PvpRoomSnapshot; readonly battle: PvpBattleSnapshot; readonly terminalResult?: 'A' | 'B' | 'DRAW' | null; readonly terminalReason?: string | null }
  | { readonly type: 'BATTLE_STARTED'; readonly firstInputTick: number; readonly simTickRate: number; readonly battle: PvpBattleSnapshot }
  | { readonly type: 'FRAME_COMMITTED'; readonly battle: PvpBattleSnapshot; readonly outcomes: readonly unknown[] }
  | { readonly type: 'BATTLE_FINISHED'; readonly result: 'A' | 'B' | 'DRAW'; readonly reason: string; readonly clearFrames: number; readonly battle: PvpBattleSnapshot }
  | { readonly type: 'BATTLE_VOID'; readonly reason: string }
  | { readonly type: 'ACCOUNT_SETTLED'; readonly settlement: unknown }
  | { readonly type: 'ACCOUNT_SETTLEMENT_ERROR'; readonly message: string }
  | { readonly type: 'INPUT_ACK'; readonly tick: number; readonly sequence: number }
  | { readonly type: 'PONG'; readonly committedTick: number; readonly simulationTick: number; readonly stateHash: string }
  | { readonly type: 'ERROR'; readonly code: string; readonly message?: string };

const SESSION_TOKEN_KEY = 'frontline.account.sessionToken.v1';
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sessionToken(): string {
  if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') throw new Error('PvP는 온라인 로그인 상태에서만 사용할 수 있습니다.');
  const value = typeof window === 'undefined' ? null : window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!value || !SESSION_TOKEN_PATTERN.test(value)) throw new Error('로그인 세션을 찾을 수 없습니다.');
  return value;
}

async function accountRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${sessionToken()}`);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`${resolveCoopApiOrigin()}${path}`, { ...init, headers });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) await refreshAuthenticatedAccount();
    const code = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP_${response.status}`;
    throw new Error(code);
  }
  return payload;
}

function parseMatchmakingState(value: unknown): PvpMatchmakingState {
  if (!isRecord(value) || typeof value.state !== 'string') throw new Error('PvP 매칭 응답 형식이 올바르지 않습니다.');
  if (value.state === 'IDLE') return { state: 'IDLE' };
  if (value.state === 'QUEUED' || value.state === 'PAIRING') {
    if (typeof value.modeId !== 'string' || typeof value.queuedAtMs !== 'number' || typeof value.expiresAtMs !== 'number') throw new Error('PvP 대기열 응답 형식이 올바르지 않습니다.');
    return { state: value.state, modeId: value.modeId as PvpModeId, queuedAtMs: value.queuedAtMs, expiresAtMs: value.expiresAtMs };
  }
  if (value.state === 'MATCHED') {
    if (typeof value.modeId !== 'string' || typeof value.matchId !== 'string' || (value.seatId !== 'A' && value.seatId !== 'B') || typeof value.websocketPath !== 'string' || typeof value.matchedAtMs !== 'number') throw new Error('PvP 매칭 완료 응답 형식이 올바르지 않습니다.');
    return { state: 'MATCHED', modeId: value.modeId as PvpModeId, matchId: value.matchId, seatId: value.seatId, websocketPath: value.websocketPath, matchedAtMs: value.matchedAtMs };
  }
  throw new Error(`알 수 없는 PvP 매칭 상태: ${value.state}`);
}

export async function getPvpAccountOverview(): Promise<PvpAccountOverview> {
  const payload = await accountRequest('/api/pvp/me');
  if (!isRecord(payload) || !isRecord(payload.rating) || !isRecord(payload.eligibility)) throw new Error('PvP 계정 응답 형식이 올바르지 않습니다.');
  return { rating: payload.rating as unknown as PvpRatingView, eligibility: payload.eligibility as unknown as PvpEligibilityView };
}

export async function getPvpLeaderboard(limit = 100): Promise<readonly PvpLeaderboardEntry[]> {
  const payload = await accountRequest(`/api/pvp/leaderboard?limit=${encodeURIComponent(String(limit))}`);
  if (!isRecord(payload) || !Array.isArray(payload.entries)) throw new Error('PvP 순위표 응답 형식이 올바르지 않습니다.');
  return payload.entries as unknown as readonly PvpLeaderboardEntry[];
}

export async function joinPvpMatchmaking(modeId: 'pvp_casual_1v1' | 'pvp_ranked_1v1'): Promise<PvpMatchmakingState> {
  return parseMatchmakingState(await accountRequest('/api/pvp/matchmaking/join', { method: 'POST', body: JSON.stringify({ modeId }) }));
}

export async function getPvpMatchmakingStatus(): Promise<PvpMatchmakingState> {
  return parseMatchmakingState(await accountRequest('/api/pvp/matchmaking/status'));
}

export async function leavePvpMatchmaking(): Promise<PvpMatchmakingState> {
  return parseMatchmakingState(await accountRequest('/api/pvp/matchmaking/leave', { method: 'POST' }));
}

function websocketUrl(path: string): string {
  const url = new URL(path, `${resolveCoopApiOrigin()}/`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

type PvpSubscriber = (message: PvpServerMessage) => void;
type PvpConnectionSubscriber = (state: PvpConnectionState) => void;

export class PvpSession {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private inputTimer: number | null = null;
  private readonly subscribers = new Set<PvpSubscriber>();
  private readonly connectionSubscribers = new Set<PvpConnectionSubscriber>();
  private readonly queuedCommands: Pvp1v1Command[] = [];
  private sequence = 0;
  private lastSubmittedTick = -1;
  private deliberatelyClosed = false;

  seatId: PvpSeatId | null = null;
  clientId: string | null = null;
  room: PvpRoomSnapshot | null = null;
  battle: PvpBattleSnapshot | null = null;
  connectionState: PvpConnectionState = 'CLOSED';

  constructor(readonly websocketPath: string) {}

  subscribe(subscriber: PvpSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  subscribeConnection(subscriber: PvpConnectionSubscriber): () => void {
    this.connectionSubscribers.add(subscriber);
    subscriber(this.connectionState);
    return () => this.connectionSubscribers.delete(subscriber);
  }

  connect(): void {
    this.deliberatelyClosed = false;
    this.open(this.connectionState === 'CLOSED' ? 'CONNECTING' : 'RECONNECTING');
  }

  private open(state: 'CONNECTING' | 'RECONNECTING'): void {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) return;
    this.setConnectionState(state);
    const socket = new WebSocket(websocketUrl(this.websocketPath));
    this.socket = socket;
    socket.addEventListener('open', () => this.setConnectionState('OPEN'));
    socket.addEventListener('message', (event) => this.handleMessage(event.data));
    socket.addEventListener('close', () => this.handleClose(socket));
    socket.addEventListener('error', () => { if (socket.readyState !== WebSocket.CLOSED) socket.close(); });
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let decoded: unknown;
    try { decoded = JSON.parse(raw); } catch { return; }
    if (!isRecord(decoded) || typeof decoded.type !== 'string') return;
    const message = decoded as unknown as PvpServerMessage;
    if (message.type === 'WELCOME') {
      this.seatId = message.seatId;
      this.clientId = message.clientId;
      this.room = message.room;
      this.battle = message.battle;
    } else if (message.type === 'ROOM_STATE') {
      this.room = message.room;
      this.battle = message.battle;
    } else if (message.type === 'BATTLE_STARTED' || message.type === 'FRAME_COMMITTED' || message.type === 'BATTLE_FINISHED') {
      this.battle = message.battle;
      if (message.type === 'BATTLE_FINISHED') this.stopInputPump();
    } else if (message.type === 'BATTLE_VOID') {
      this.stopInputPump();
    }
    for (const subscriber of this.subscribers) subscriber(message);
  }

  sendReady(): void {
    this.send({ type: 'READY' });
  }

  queueCommand(command: Pvp1v1Command): void {
    if (this.queuedCommands.length >= 8) return;
    this.queuedCommands.push(command);
  }

  startInputPump(tickRate = 30): void {
    if (this.inputTimer !== null || typeof window === 'undefined') return;
    const interval = Math.max(16, Math.round(1000 / Math.max(1, tickRate)));
    const pump = () => {
      const battle = this.battle;
      if (!battle || battle.winner !== null || this.connectionState !== 'OPEN') return;
      const tick = battle.tick;
      if (tick <= this.lastSubmittedTick) return;
      const commands = this.queuedCommands.splice(0, this.queuedCommands.length);
      this.send({ type: 'FRAME_INPUT', input: { tick, sequence: this.sequence, commands } });
      this.sequence += 1;
      this.lastSubmittedTick = tick;
    };
    this.inputTimer = window.setInterval(pump, interval);
    pump();
  }

  stopInputPump(): void {
    if (this.inputTimer !== null && typeof window !== 'undefined') window.clearInterval(this.inputTimer);
    this.inputTimer = null;
  }

  close(): void {
    this.deliberatelyClosed = true;
    this.stopInputPump();
    if (this.reconnectTimer !== null && typeof window !== 'undefined') window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, 'client_close');
    this.socket = null;
    this.setConnectionState('CLOSED');
  }

  private handleClose(socket: WebSocket): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.stopInputPump();
    if (this.deliberatelyClosed || typeof window === 'undefined') {
      this.setConnectionState('CLOSED');
      return;
    }
    this.setConnectionState('RECONNECTING');
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open('RECONNECTING');
    }, 900);
  }

  private send(payload: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('PvP 서버에 연결되어 있지 않습니다.');
    this.socket.send(JSON.stringify(payload));
  }

  private setConnectionState(state: PvpConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    for (const subscriber of this.connectionSubscribers) subscriber(state);
  }
}

export const __pvpNetworkTestOnly = { parseMatchmakingState };
