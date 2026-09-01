import Phaser from 'phaser';
import { CoopBattleScene, CoopLobbyScene } from './coop-scenes';
import { getAuthenticatedCoopClientProgress } from './coop-account-progress';
import { CoopSession, type CoopServerMessage } from './coop-network';
import { FriendCoopBattleScene, FriendCoopLobbyScene } from './friend-coop-scenes';
import { PublicCoopLobbyScene } from './public-coop-scenes';
import { getPostStageStory, getPreStageStory } from './story-content';
import { presentStoryOverlay, type StoryOverlayHandle } from './story-overlay';

/**
 * The existing lobby scenes own their sessions internally. These narrow adapters only observe that already-created
 * session/progress state to attach optional local narrative; they never mutate room/session authority.
 */
type CoopLobbySessionCarrier = Phaser.Scene & { readonly session?: CoopSession | null };
type GuestLobbyCarrier = CoopLobbySessionCarrier & {
  readonly progress?: { readonly clearedStageIds?: readonly string[] };
};
type GuestBattleResultCarrier = Phaser.Scene & {
  readonly resultLayer?: Phaser.GameObjects.Container;
};

const guestClearSnapshotBySession = new WeakMap<CoopSession, ReadonlySet<string>>();

function lobbySession(scene: Phaser.Scene): CoopSession | null {
  return (scene as CoopLobbySessionCarrier).session ?? null;
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
  override create(): void {
    super.create();
    attachGuestLobbyPreStory(this);
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
