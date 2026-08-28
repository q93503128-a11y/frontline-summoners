export type CoopSeatId = 'A' | 'B';
export type CoopRoomPhase = 'LOBBY' | 'BATTLE' | 'FINISHED';

export type CoopCommand =
  | { readonly type: 'SPAWN'; readonly slotId: string }
  | { readonly type: 'UPGRADE_SUPPLY' }
  | { readonly type: 'FIRE_BASE_WEAPON' };

export interface CoopRoomSnapshot {
  readonly matchId: string;
  readonly stageId: string;
  readonly phase: CoopRoomPhase;
  readonly committedTick: number;
  readonly seats: readonly {
    readonly seatId: CoopSeatId;
    readonly clientId: string | null;
    readonly connected: boolean;
    readonly ready: boolean;
    readonly control: 'PLAYER' | 'AI';
    readonly deckSize: number;
  }[];
}

export interface CoopBattleSnapshot {
  readonly tick: number;
  readonly stateHash: string;
  readonly winner: 'PLAYER' | 'ENEMY' | null;
  readonly bases: {
    readonly playerHp: number;
    readonly playerMaxHp: number;
    readonly enemyHp: number;
    readonly enemyMaxHp: number;
  };
  readonly baseWeaponCooldownFrames: number;
  readonly players: readonly {
    readonly seatId: CoopSeatId;
    readonly supply: number;
    readonly maxSupply: number;
    readonly supplyLevel: number;
    readonly cooldowns: Readonly<Record<string, number>>;
  }[];
  readonly units: readonly {
    readonly simulationId: number;
    readonly definitionId: string;
    readonly team: 'PLAYER' | 'ENEMY';
    readonly ownerSeatId?: CoopSeatId;
    readonly hp: number;
    readonly maxHp: number;
    readonly anchorX: number;
    readonly state: string;
  }[];
}

export type CoopServerMessage =
  | { readonly type: 'WELCOME'; readonly clientId: string; readonly seatId: CoopSeatId; readonly simTickRate: number; readonly room: CoopRoomSnapshot; readonly battle?: CoopBattleSnapshot }
  | { readonly type: 'ROOM_STATE'; readonly room: CoopRoomSnapshot; readonly battle?: CoopBattleSnapshot }
  | { readonly type: 'BATTLE_STARTED'; readonly stageId: string; readonly firstInputTick: number; readonly simTickRate: number; readonly battle: CoopBattleSnapshot }
  | { readonly type: 'BATTLE_RESUME'; readonly committedTick: number; readonly battle: CoopBattleSnapshot }
  | { readonly type: 'FRAME_COMMITTED'; readonly battle: CoopBattleSnapshot; readonly outcomes: readonly unknown[] }
  | { readonly type: 'BATTLE_FINISHED'; readonly stageId?: string; readonly winner?: 'PLAYER' | 'ENEMY' | null; readonly clearFrames?: number; readonly committedTick?: number; readonly battle: CoopBattleSnapshot }
  | { readonly type: 'INPUT_ACK'; readonly tick: number; readonly sequence: number }
  | { readonly type: 'PONG'; readonly committedTick: number; readonly simulationTick?: number; readonly stateHash?: string }
  | { readonly type: 'ERROR'; readonly code: string; readonly message?: string };

export interface CoopInvite {
  readonly matchId: string;
  readonly joinToken: string;
}

export interface CreatedCoopMatch {
  readonly matchId: string;
  readonly stageId: string;
  readonly hostPath: string;
  readonly guestInvite: CoopInvite;
}

type CoopSubscriber = (message: CoopServerMessage) => void;
type ConnectionSubscriber = (state: 'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'CLOSED') => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function runtimeWindow(): Window | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

export function resolveCoopApiOrigin(): string {
  const browser = runtimeWindow();
  if (!browser) return 'http://127.0.0.1:8787';
  const query = new URLSearchParams(browser.location.search).get('api');
  if (query) {
    const normalized = new URL(query, browser.location.href).origin;
    try { browser.localStorage.setItem('frontline.coop.apiOrigin', normalized); } catch { /* storage is optional */ }
    return normalized;
  }
  try {
    const stored = browser.localStorage.getItem('frontline.coop.apiOrigin');
    if (stored) return new URL(stored).origin;
  } catch { /* storage is optional */ }
  if (browser.location.hostname === 'localhost' || browser.location.hostname === '127.0.0.1') {
    return `${browser.location.protocol}//${browser.location.hostname}:8787`;
  }
  return browser.location.origin;
}

function websocketUrl(path: string): string {
  const url = new URL(path, `${resolveCoopApiOrigin()}/`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function encodeCoopInvite(invite: CoopInvite): string {
  return `${invite.matchId}.${invite.joinToken}`;
}

export function decodeCoopInvite(code: string): CoopInvite {
  const trimmed = code.trim();
  const separator = trimmed.indexOf('.');
  if (separator <= 0 || separator >= trimmed.length - 1) throw new Error('참가 코드 형식이 올바르지 않습니다.');
  const matchId = trimmed.slice(0, separator);
  const joinToken = trimmed.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(matchId)) throw new Error('참가 코드의 방 ID가 올바르지 않습니다.');
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(joinToken)) throw new Error('참가 코드의 인증 토큰이 올바르지 않습니다.');
  return { matchId, joinToken };
}

export async function createCoopMatch(stageId: string): Promise<CreatedCoopMatch> {
  const response = await fetch(`${resolveCoopApiOrigin()}/api/matches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stageId }),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok || !isRecord(payload)) {
    const error = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    throw new Error(`협동 방을 만들지 못했습니다: ${error}`);
  }
  const host = isRecord(payload.host) ? payload.host : {};
  const guest = isRecord(payload.guest) ? payload.guest : {};
  if (typeof payload.matchId !== 'string' || typeof payload.stageId !== 'string' || typeof host.websocketPath !== 'string' || typeof guest.joinToken !== 'string') {
    throw new Error('협동 서버 응답 형식이 올바르지 않습니다.');
  }
  return {
    matchId: payload.matchId,
    stageId: payload.stageId,
    hostPath: host.websocketPath,
    guestInvite: { matchId: payload.matchId, joinToken: guest.joinToken },
  };
}

export function guestWebsocketPath(invite: CoopInvite): string {
  return `/api/matches/${encodeURIComponent(invite.matchId)}/websocket?token=${encodeURIComponent(invite.joinToken)}`;
}

function parseServerMessage(value: unknown): CoopServerMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  return value as unknown as CoopServerMessage;
}

export class CoopSession {
  private socket: WebSocket | null = null;
  private readonly subscribers = new Set<CoopSubscriber>();
  private readonly connectionSubscribers = new Set<ConnectionSubscriber>();
  private readonly queuedCommands: CoopCommand[] = [];
  private inputTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private sequence = 0;
  private lastSubmittedTick = -1;
  private deliberatelyClosed = false;
  private readySent = false;

  seatId: CoopSeatId | null = null;
  clientId: string | null = null;
  room: CoopRoomSnapshot | null = null;
  battle: CoopBattleSnapshot | null = null;
  connectionState: 'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'CLOSED' = 'CLOSED';

  constructor(readonly websocketPath: string) {}

  subscribe(subscriber: CoopSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  subscribeConnection(subscriber: ConnectionSubscriber): () => void {
    this.connectionSubscribers.add(subscriber);
    subscriber(this.connectionState);
    return () => this.connectionSubscribers.delete(subscriber);
  }

  connect(): void {
    this.deliberatelyClosed = false;
    this.openSocket(this.connectionState === 'CLOSED' ? 'CONNECTING' : 'RECONNECTING');
  }

  private openSocket(state: 'CONNECTING' | 'RECONNECTING'): void {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) return;
    this.setConnectionState(state);
    const socket = new WebSocket(websocketUrl(this.websocketPath));
    this.socket = socket;
    socket.addEventListener('open', () => this.setConnectionState('OPEN'));
    socket.addEventListener('message', (event) => this.handleMessage(event.data));
    socket.addEventListener('close', () => this.handleClose(socket));
    socket.addEventListener('error', () => {
      if (socket.readyState !== WebSocket.CLOSED) socket.close();
    });
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let decoded: unknown;
    try { decoded = JSON.parse(raw); } catch { return; }
    const message = parseServerMessage(decoded);
    if (!message) return;
    if (message.type === 'WELCOME') {
      this.seatId = message.seatId;
      this.clientId = message.clientId;
      this.room = message.room;
      if (message.battle) this.battle = message.battle;
    } else if (message.type === 'ROOM_STATE') {
      this.room = message.room;
      if (message.battle) this.battle = message.battle;
    } else if (message.type === 'BATTLE_STARTED' || message.type === 'BATTLE_RESUME' || message.type === 'FRAME_COMMITTED' || message.type === 'BATTLE_FINISHED') {
      this.battle = message.battle;
      if (message.type === 'BATTLE_FINISHED') this.stopInputPump();
    }
    for (const subscriber of this.subscribers) subscriber(message);
  }

  sendReady(deckSlotIds: readonly string[]): void {
    if (deckSlotIds.length < 1 || deckSlotIds.length > 5) throw new Error('협동 덱은 1~5명이어야 합니다.');
    this.send({ type: 'READY', deckSlotIds });
    this.readySent = true;
  }

  sendUnready(): void {
    this.send({ type: 'UNREADY' });
    this.readySent = false;
  }

  get isReadySent(): boolean { return this.readySent; }

  queueCommand(command: CoopCommand): void {
    if (this.queuedCommands.length >= 8) return;
    this.queuedCommands.push(command);
  }

  startInputPump(tickRate = 30): void {
    if (this.inputTimer !== null) return;
    const browser = runtimeWindow();
    if (!browser) return;
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
    this.inputTimer = browser.setInterval(pump, interval);
    pump();
  }

  stopInputPump(): void {
    const browser = runtimeWindow();
    if (this.inputTimer !== null && browser) browser.clearInterval(this.inputTimer);
    this.inputTimer = null;
  }

  ping(): void { this.send({ type: 'PING' }); }

  close(): void {
    this.deliberatelyClosed = true;
    this.stopInputPump();
    const browser = runtimeWindow();
    if (this.reconnectTimer !== null && browser) browser.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close(1000, 'client_leave');
    this.socket = null;
    this.setConnectionState('CLOSED');
  }

  private send(payload: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('협동 서버와 연결되어 있지 않습니다.');
    this.socket.send(JSON.stringify(payload));
  }

  private handleClose(socket: WebSocket): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.stopInputPump();
    if (this.deliberatelyClosed) {
      this.setConnectionState('CLOSED');
      return;
    }
    this.setConnectionState('RECONNECTING');
    const browser = runtimeWindow();
    if (!browser || this.reconnectTimer !== null) return;
    this.reconnectTimer = browser.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.deliberatelyClosed) this.openSocket('RECONNECTING');
    }, 1000);
  }

  private setConnectionState(state: 'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'CLOSED'): void {
    this.connectionState = state;
    for (const subscriber of this.connectionSubscribers) subscriber(state);
  }
}
