import Phaser from 'phaser';
import { getAuthenticatedCoopClientProgress } from './coop-account-progress';
import { CoopSession, type CoopServerMessage } from './coop-network';
import { FriendCoopBattleScene, FriendCoopLobbyScene } from './friend-coop-scenes';
import { PublicCoopLobbyScene } from './public-coop-scenes';
import { getPostStageStory, getPreStageStory } from './story-content';
import { presentStoryOverlay, type StoryOverlayHandle } from './story-overlay';

/**
 * The existing lobby scenes own their session internally. This narrow adapter reads that already-created
 * session only to attach optional local narrative; it never mutates room/session authority.
 */
type CoopLobbySessionCarrier = Phaser.Scene & { readonly session?: CoopSession | null };

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
