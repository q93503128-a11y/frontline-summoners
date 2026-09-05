import Phaser from 'phaser';
import { CoopBattleScene, CoopLobbyScene } from './coop-scenes';
import { getAuthenticatedCoopClientProgress } from './coop-account-progress';
import { CoopSession, type CoopServerMessage } from './coop-network';
import { FriendCoopBattleScene, FriendCoopLobbyScene } from './friend-coop-scenes';
import { ALL_STAGES } from './prototype';
import { PublicCoopLobbyScene } from './public-coop-scenes';
import { loadGuestProgress } from './save';
import { addButton, addCommandPanel, addSectionHeading, addText, COLORS, setButtonState } from './scene-ui';
import { isSortieStageUnlocked } from './stage-navigation';
import { getPostStageStory, getPreStageStory } from './story-content';
import { presentStoryOverlay, type StoryOverlayHandle } from './story-overlay';
import { isCompactMobileViewport } from './viewport';

/**
 * The existing lobby scenes own their sessions internally. These narrow adapters only observe that already-created
 * session/progress state to attach optional local narrative; they never mutate room/session authority.
 */
type CoopLobbySessionCarrier = Phaser.Scene & { readonly session?: CoopSession | null };
type GuestLobbyCarrier = CoopLobbySessionCarrier & {
  readonly progress?: { readonly clearedStageIds?: readonly string[] };
};
type GuestLobbyPageCarrier = Phaser.Scene & {
  page?: number;
  render?: () => void;
};
type GuestLobbyPresentationCarrier = GuestLobbyCarrier & GuestLobbyPageCarrier & {
  host?: (stageId: string) => Promise<void>;
  promptJoin?: () => void;
};
type GuestBattleResultCarrier = Phaser.Scene & {
  readonly resultLayer?: Phaser.GameObjects.Container;
};

const guestClearSnapshotBySession = new WeakMap<CoopSession, ReadonlySet<string>>();

function lobbySession(scene: Phaser.Scene): CoopSession | null {
  return (scene as CoopLobbySessionCarrier).session ?? null;
}

function formatCoopPermille(permille: number): string {
  const percent = permille / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function attachLobbyPreStory(scene: Phaser.Scene): void {
  let handledStageId: string | undefined;
  let overlay: StoryOverlayHandle | null = null;
  const poll = scene.time.addEvent({
    delay: 80,
    loop: true,
    callback: () => {
      if (overlay?.active) return;
      const session = lobbySession(scene);
      const room = session?.room;
      if (!room || room.phase !== 'LOBBY' || room.stageId === handledStageId) return;
      handledStageId = room.stageId;
      poll.destroy();
      overlay = presentStoryOverlay(scene, getPreStageStory(room.stageId), () => { overlay = null; });
    },
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => poll.destroy());
}

/**
 * Guest code-coop also snapshots the local clear set while the room is still in LOBBY. The battle adapter later
 * uses this immutable pre-battle view so a first-clear outro cannot be confused with a replay after local save.
 */
function attachGuestLobbyPreStory(scene: Phaser.Scene): void {
  let handledStageId: string | undefined;
  let overlay: StoryOverlayHandle | null = null;
  const poll = scene.time.addEvent({
    delay: 80,
    loop: true,
    callback: () => {
      const session = lobbySession(scene);
      const room = session?.room;
      if (!session || !room || room.phase !== 'LOBBY') return;

      const clearIds = (scene as GuestLobbyCarrier).progress?.clearedStageIds;
      if (clearIds) guestClearSnapshotBySession.set(session, new Set(clearIds));

      if (overlay?.active || room.stageId === handledStageId) return;
      handledStageId = room.stageId;
      overlay = presentStoryOverlay(scene, getPreStageStory(room.stageId), () => { overlay = null; });
    },
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => poll.destroy());
}

function guestResultText(scene: Phaser.Scene): string {
  const layer = (scene as GuestBattleResultCarrier).resultLayer;
  if (!layer) return '';
  return layer.list
    .filter((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text)
    .map((child) => child.text)
    .join('\n');
}

export class StoryGuestCoopLobbyScene extends CoopLobbyScene {
  private preferredStageId: string | undefined;
  private commandOverlay: Phaser.GameObjects.Container | undefined;
  private restoreGuestLobbyRender: (() => void) | undefined;

  init(data: { preferredStageId?: string } = {}): void {
    this.preferredStageId = data.preferredStageId;
  }

  override create(): void {
    super.create();
    attachGuestLobbyPreStory(this);
    this.installGuestCommandOverlay();
    const preferredStageId = this.preferredStageId;
    if (!preferredStageId) return;

    // CoopLobbyScene keeps guest save/session authority private. This adapter only focuses its existing stage picker
    // after the base async progress load; it does not create a second room path or mutate the chosen stage later.
    void Promise.resolve().then(() => loadGuestProgress()).then((progress) => {
      if (!this.scene.isActive()) return;
      const eligible = ALL_STAGES.filter((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP' && isSortieStageUnlocked(stage.id, progress.clearedStageIds));
      const index = eligible.findIndex((stage) => stage.id === preferredStageId);
      if (index < 0) return;
      const carrier = this as unknown as GuestLobbyPageCarrier;
      carrier.page = Math.floor(index / 5);
      carrier.render?.();
    }).catch(() => undefined);
  }

  private installGuestCommandOverlay(): void {
    const carrier = this as unknown as GuestLobbyPresentationCarrier;
    const originalRender = carrier.render;
    if (!originalRender) return;

    carrier.render = () => {
      originalRender.call(this);
      this.renderGuestCommandOverlay();
    };
    this.restoreGuestLobbyRender = () => { carrier.render = originalRender; };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.commandOverlay?.destroy(true);
      this.commandOverlay = undefined;
      this.restoreGuestLobbyRender?.();
      this.restoreGuestLobbyRender = undefined;
    });
    carrier.render();
  }

  private renderGuestCommandOverlay(): void {
    this.commandOverlay?.destroy(true);
    this.commandOverlay = this.add.container(0, 0).setDepth(60);
    const overlay = this.commandOverlay;
    const compact = isCompactMobileViewport();
    const carrier = this as unknown as GuestLobbyPresentationCarrier;

    if (lobbySession(this)) {
      const roomFooter = this.add.rectangle(640, 666, 1240, 78, 0x0f151d, 1).setStrokeStyle(2, 0x354356, 0.55).setInteractive();
      overlay.add(roomFooter);
      overlay.add(addText(this, 640, 662, '협동 방 준비 중 · 전장 선택과 참가 코드 입력은 방을 나간 뒤 다시 사용할 수 있습니다.', compact ? 17 : 14, '#9eabba', 'center').setOrigin(0.5));
      return;
    }

    const clears = carrier.progress?.clearedStageIds ?? [];
    const stages = ALL_STAGES.filter((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP' && isSortieStageUnlocked(stage.id, clears));
    const pageSize = 5;
    const pageCount = Math.max(1, Math.ceil(stages.length / pageSize));
    const page = Math.max(0, Math.min(carrier.page ?? 0, pageCount - 1));
    carrier.page = page;
    const visible = stages.slice(page * pageSize, page * pageSize + pageSize);

    const blocker = this.add.rectangle(640, 365, 1220, 410, 0x161d25, 1).setStrokeStyle(3, 0x526474, 0.9).setInteractive();
    overlay.add(blocker);
    overlay.add(addCommandPanel(this, 640, 365, 1200, 394, 0x657b8e, 0x1a232c, 0.99));
    overlay.add(addSectionHeading(this, 74, 183, '협동 전선 선택', 1105, 0x7190a6));
    overlay.add(addText(this, 1175, 172, `협동 가능 ${stages.length}개 · ${page + 1}/${pageCount}`, compact ? 17 : 14, '#b8c7d6', 'right').setOrigin(1, 0));

    if (visible.length === 0) {
      overlay.add(addText(this, 640, 365, '현재 진행도에서 협동 가능한 전장이 없습니다.', compact ? 27 : 22, '#9aa4b3', 'center').setOrigin(0.5));
    } else {
      const route = this.add.graphics();
      route.lineStyle(6, 0x657b8e, 0.48).lineBetween(105, 316, 1175, 316);
      overlay.add(route);

      visible.forEach((stage, index) => {
        const x = 140 + index * 250;
        const special = stage.stageType === 'SPECIAL';
        const accent = special ? 0x8a6aa0 : 0x6991aa;
        const order = page * pageSize + index + 1;
        overlay.add(this.add.rectangle(x, 244, 214, 76, 0x202a34, 0.94).setStrokeStyle(2, accent, 0.55));
        overlay.add(addText(this, x, 226, stage.name, compact ? 21 : 18, '#ffffff', 'center').setOrigin(0.5).setWordWrapWidth(196));
        overlay.add(addText(this, x, 263, special ? 'SPECIAL 전장' : `협동 전장 ${order}`, compact ? 15 : 12, special ? '#d6b5e8' : '#9fb8cc', 'center').setOrigin(0.5));
        overlay.add(this.add.line(0, 0, x, 280, x, 300, accent, 0.78).setOrigin(0));
        overlay.add(this.add.circle(x, 316, special ? 23 : 19, accent, 0.96).setStrokeStyle(3, 0xe9dec3, 0.55));
        overlay.add(addText(this, x, 306, String(order), compact ? 17 : 14, '#ffffff', 'center').setOrigin(0.5));
        overlay.add(addText(this, x, 353, `난이도 ${stage.difficulty}/12 · ${stage.mapLength}m`, compact ? 17 : 14, COLORS.gold, 'center').setOrigin(0.5));
        const scaling = stage.coopStatScaling;
        overlay.add(addText(this, x, 387, `적 HP ${formatCoopPermille(scaling.enemyHpPermille)} · ATK ${formatCoopPermille(scaling.enemyAttackPermille)}\n기지 ${formatCoopPermille(scaling.enemyBaseHpPermille)}`, compact ? 15 : 12, '#c9b7a8', 'center').setOrigin(0.5));
        const hostButton = addButton(this, x, 465, 176, compact ? 76 : 54, '방 만들기', () => { void carrier.host?.(stage.id); }, accent, { tone: index === 0 ? 'primary' : 'secondary' });
        overlay.add(hostButton);
        if (!carrier.host) setButtonState(hostButton, 'disabled', '협동 방 생성 기능을 불러오지 못했습니다.');
      });
    }

    const previous = addButton(this, 90, compact ? 650 : 658, 120, compact ? 84 : 56, '◀', () => {
      carrier.page = Math.max(0, page - 1);
      carrier.render?.();
    }, 0x586f84, { tone: 'quiet' });
    const next = addButton(this, 230, compact ? 650 : 658, 120, compact ? 84 : 56, '▶', () => {
      carrier.page = Math.min(pageCount - 1, page + 1);
      carrier.render?.();
    }, 0x586f84, { tone: 'quiet' });
    const join = addButton(this, 1055, compact ? 650 : 658, 300, compact ? 84 : 56, '참가 코드 입력', () => carrier.promptJoin?.(), 0x745d91, { tone: 'quiet' });
    overlay.add([previous, next, join]);
    if (page <= 0) setButtonState(previous, 'disabled', '첫 번째 협동 전선 묶음입니다.');
    if (page >= pageCount - 1) setButtonState(next, 'disabled', '마지막 협동 전선 묶음입니다.');
    if (!carrier.promptJoin) setButtonState(join, 'disabled', '참가 코드 입력 기능을 불러오지 못했습니다.');
  }
}

export class StoryGuestCoopBattleScene extends CoopBattleScene {
  private storySession: CoopSession | undefined;
  private storyStageId = '';
  private stageWasClearedBeforeBattle = true;
  private storySubscription: (() => void) | undefined;
  private postStoryPoll: Phaser.Time.TimerEvent | undefined;
  private postStoryHandled = false;

  override init(data: { session?: CoopSession } = {}): void {
    this.storySession = data.session;
    this.storyStageId = data.session?.room?.stageId ?? '';
    const preBattleClears = data.session ? guestClearSnapshotBySession.get(data.session) : undefined;
    // Missing snapshot is treated as already-cleared: presentation may be omitted, but a reconnect/race can never
    // fabricate a first-clear chapter outro.
    this.stageWasClearedBeforeBattle = preBattleClears?.has(this.storyStageId) ?? true;
    this.storySubscription = undefined;
    this.postStoryPoll = undefined;
    this.postStoryHandled = false;
    super.init(data);
  }

  override create(): void {
    const session = this.storySession;
    if (session) this.storySubscription = session.subscribe((message) => this.onStoryServerMessage(message));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.storySubscription?.();
      this.storySubscription = undefined;
      this.postStoryPoll?.destroy();
      this.postStoryPoll = undefined;
    });
    super.create();
  }

  private onStoryServerMessage(message: CoopServerMessage): void {
    if (this.postStoryHandled || !this.scene.isActive() || message.type !== 'BATTLE_FINISHED') return;
    const session = this.storySession;
    if (!session || message.battle.winner !== 'PLAYER' || this.stageWasClearedBeforeBattle) return;
    const story = getPostStageStory(this.storyStageId);
    if (!story) return;

    // Guest completion is local IndexedDB authority. Base CoopBattleScene writes the clear first and only then
    // renders the exact success text. Polling that presentation boundary keeps the story adapter out of save logic
    // while still refusing to show a false chapter outro after a failed durable write.
    let checks = 0;
    this.postStoryPoll?.destroy();
    this.postStoryPoll = this.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        checks += 1;
        const text = guestResultText(this);
        if (text.includes('협동 NORMAL_CLEAR 저장 완료')) {
          this.postStoryHandled = true;
          this.postStoryPoll?.destroy();
          this.postStoryPoll = undefined;
          presentStoryOverlay(this, story);
          return;
        }
        if (text.includes('현재 탭에서 클리어 유지') || checks >= 50) {
          this.postStoryPoll?.destroy();
          this.postStoryPoll = undefined;
        }
      },
    });
  }
}

export class StoryFriendCoopLobbyScene extends FriendCoopLobbyScene {
  override create(): void {
    super.create();
    attachLobbyPreStory(this);
  }
}

export class StoryPublicCoopLobbyScene extends PublicCoopLobbyScene {
  override create(): void {
    super.create();
    attachLobbyPreStory(this);
  }
}

export class StoryFriendCoopBattleScene extends FriendCoopBattleScene {
  private storySession: CoopSession | undefined;
  private storyStageId = '';
  private stageWasClearedBeforeBattle = false;
  private storySubscription: (() => void) | undefined;
  private postStoryHandled = false;

  override init(data: { session?: CoopSession } = {}): void {
    this.storySession = data.session;
    this.storyStageId = data.session?.room?.stageId ?? '';
    const progress = getAuthenticatedCoopClientProgress();
    this.stageWasClearedBeforeBattle = this.storyStageId.length > 0
      ? progress?.clearedStageIds.includes(this.storyStageId) ?? false
      : false;
    this.postStoryHandled = false;
    this.storySubscription = undefined;
    super.init(data);
  }

  override create(): void {
    const session = this.storySession;
    if (session) this.storySubscription = session.subscribe((message) => this.onStoryServerMessage(message));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.storySubscription?.();
      this.storySubscription = undefined;
    });
    super.create();
  }

  private onStoryServerMessage(message: CoopServerMessage): void {
    if (this.postStoryHandled || !this.scene.isActive() || message.type !== 'ACCOUNT_SETTLED') return;
    const session = this.storySession;
    if (!session || message.seatId !== session.seatId || message.stageId !== this.storyStageId) return;

    // ACCOUNT_SETTLED is the authoritative per-seat persistence signal. Only a genuine first cooperative
    // NORMAL_CLEAR may open a chapter outro; reconnects/reclears cannot replay it as a new completion.
    if (session.battle?.winner !== 'PLAYER' || this.stageWasClearedBeforeBattle) return;
    const story = getPostStageStory(this.storyStageId);
    if (!story) return;
    this.postStoryHandled = true;
    presentStoryOverlay(this, story);
  }
}
