import Phaser from 'phaser';
import type { BaseWeaponId } from '@frontline/sim/playable';
import { BASE_WEAPON_UNLOCKS } from './base-weapon-progression';
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
  readonly inviteCode?: string | null;
  copyInvite?: () => Promise<void>;
  cycleBaseWeapon?: () => void;
  toggleReady?: () => void;
  leaveRoom?: () => void;
};
type AccountLobbyPresentationCarrier = CoopLobbySessionCarrier & {
  render?: () => void;
  cycleWeapon?: () => void;
  toggleReady?: () => void;
  leave?: (scene?: string) => void;
};
type GuestBattleResultCarrier = Phaser.Scene & {
  readonly resultLayer?: Phaser.GameObjects.Container;
};
type AccountCoopMode = 'FRIEND' | 'PUBLIC';

const guestClearSnapshotBySession = new WeakMap<CoopSession, ReadonlySet<string>>();

function lobbySession(scene: Phaser.Scene): CoopSession | null {
  return (scene as CoopLobbySessionCarrier).session ?? null;
}

function formatCoopPermille(permille: number): string {
  const percent = permille / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function coopWeaponName(id: BaseWeaponId | null | undefined): string {
  return BASE_WEAPON_UNLOCKS.find((entry) => entry.id === id)?.displayName ?? '기본 거점 병기';
}

function installAccountCoopCommandBoard(scene: Phaser.Scene, mode: AccountCoopMode): void {
  const carrier = scene as AccountLobbyPresentationCarrier;
  const originalRender = carrier.render;
  if (!originalRender) return;
  let overlay: Phaser.GameObjects.Container | undefined;

  const renderOverlay = (): void => {
    overlay?.destroy(true);
    overlay = scene.add.container(0, 0).setDepth(60);
    const compact = isCompactMobileViewport();
    const session = lobbySession(scene);
    const room = session?.room;
    const title = mode === 'FRIEND' ? '친구 협동 준비' : '공개 협동 준비';
    const accent = mode === 'FRIEND' ? 0x766e9d : 0x6388a5;

    const blocker = scene.add.rectangle(640, 374, 1220, 438, 0x131a22, 1).setStrokeStyle(3, 0x526474, 0.9).setInteractive();
    overlay.add(blocker);
    overlay.add(addCommandPanel(scene, 640, 374, 1200, 422, accent, 0x18212b, 0.995));
    overlay.add(addSectionHeading(scene, 74, 174, title, 1105, accent));

    if (!session || !room) {
      overlay.add(addText(scene, 640, 355, mode === 'FRIEND' ? '친구 협동 방에 연결하는 중…' : '매칭된 지휘관과 연결하는 중…', compact ? 28 : 23, '#c8d3df', 'center').setOrigin(0.5));
      overlay.add(addText(scene, 640, 402, '연결되면 두 지휘관의 편성·준비·공유 병기 합의 상태가 표시됩니다.', compact ? 17 : 14, '#8f9baa', 'center').setOrigin(0.5));
      const leave = addButton(scene, 640, 550, 230, compact ? 80 : 56, mode === 'FRIEND' ? '친구 화면으로' : '매칭으로 돌아가기', () => carrier.leave?.(mode === 'FRIEND' ? 'social' : undefined), 0x8d5f64, { tone: 'danger' });
      overlay.add(leave);
      if (!carrier.leave) setButtonState(leave, 'disabled', '나가기 기능을 불러오지 못했습니다.');
      return;
    }

    const stage = ALL_STAGES.find((entry) => entry.id === room.stageId);
    overlay.add(addText(scene, 1175, 164, session.connectionState === 'OPEN' ? '서버 연결됨' : session.connectionState === 'RECONNECTING' ? '재접속 중…' : '연결 중…', compact ? 17 : 14, session.connectionState === 'OPEN' ? '#8ee3aa' : '#ffd493', 'right').setOrigin(1, 0));
    overlay.add(addText(scene, 640, 202, stage?.name ?? '협동 전장', compact ? 25 : 22, '#fff4cf', 'center').setOrigin(0.5));

    const rail = scene.add.graphics();
    rail.lineStyle(5, accent, 0.5).lineBetween(265, 337, 1015, 337);
    rail.fillStyle(room.agreedBaseWeaponId ? 0x62a37b : 0xb28a4d, 0.96).fillCircle(640, 337, 28);
    rail.lineStyle(3, 0xe8dcc0, 0.55).strokeCircle(640, 337, 28);
    overlay.add(rail);

    room.seats.slice(0, 2).forEach((seat, index) => {
      const x = index === 0 ? 300 : 980;
      const mine = seat.seatId === session.seatId;
      const seatAccent = mine ? 0x6fa2d0 : 0x627184;
      overlay!.add(scene.add.circle(x, 337, 34, seatAccent, 0.96).setStrokeStyle(3, mine ? 0xd7eaff : 0xa9b4c1, 0.55));
      overlay!.add(addText(scene, x, 324, String(index + 1), compact ? 20 : 17, '#ffffff', 'center').setOrigin(0.5));
      overlay!.add(addText(scene, x, 240, `${index + 1}번 지휘관${mine ? ' · 나' : ''}`, compact ? 23 : 20, '#ffffff', 'center').setOrigin(0.5));
      overlay!.add(addText(scene, x, 275, seat.connected ? '● 접속됨' : '○ 접속 대기', compact ? 17 : 14, seat.connected ? '#8ee3aa' : '#a3adba', 'center').setOrigin(0.5));
      overlay!.add(addText(scene, x, 302, `편성 ${seat.deckSize}/5 · ${seat.ready ? '준비 완료' : '준비 전'}`, compact ? 17 : 14, seat.ready ? '#f0d67d' : '#b8c2cf', 'center').setOrigin(0.5));
      overlay!.add(addText(scene, x, 388, coopWeaponName(seat.selectedBaseWeaponId), compact ? 18 : 15, '#bfe8ff', 'center').setOrigin(0.5));
      overlay!.add(addText(scene, x, 418, seat.control === 'AI' ? '연결 이탈 · 임시 지휘' : '플레이어 지휘', compact ? 15 : 12, seat.control === 'AI' ? '#ffd493' : '#8fa4b8', 'center').setOrigin(0.5));
    });

    const agreementText = room.agreedBaseWeaponId
      ? `공유 병기 합의\n${coopWeaponName(room.agreedBaseWeaponId)}`
      : '병기 불일치\n같은 병기로 맞추기';
    overlay.add(addText(scene, 640, 306, agreementText, compact ? 17 : 14, room.agreedBaseWeaponId ? '#c9f1d6' : '#ffe0a0', 'center').setOrigin(0.5));
    overlay.add(addText(scene, 640, 464, mode === 'FRIEND' ? '친구 계정 편성 · 개인 보급 · 공유 기지와 거점 병기' : '자동 매칭 계정 편성 · 개인 보급 · 공유 기지와 거점 병기', compact ? 16 : 13, '#9aa8b8', 'center').setOrigin(0.5));

    const mine = room.seats.find((seat) => seat.seatId === session.seatId);
    const weapon = addButton(scene, 375, 548, 250, compact ? 80 : 58, '공유 병기 변경', () => carrier.cycleWeapon?.(), 0x4f7894, { tone: 'secondary' });
    const ready = addButton(scene, 650, 548, 220, compact ? 80 : 58, mine?.ready ? '준비 취소' : '준비 완료', () => carrier.toggleReady?.(), 0x5f8f75, { tone: 'primary' });
    const leave = addButton(scene, 930, 548, 230, compact ? 80 : 58, mode === 'FRIEND' ? '친구 화면으로' : '매칭으로 돌아가기', () => carrier.leave?.(mode === 'FRIEND' ? 'social' : undefined), 0x8d5f64, { tone: 'danger' });
    overlay.add([weapon, ready, leave]);

    if (mine?.ready) {
      setButtonState(weapon, 'locked', '준비를 취소한 뒤 공유 병기를 변경할 수 있습니다.');
      setButtonState(ready, 'selected');
    }
    if (!carrier.cycleWeapon) setButtonState(weapon, 'disabled', '병기 변경 기능을 불러오지 못했습니다.');
    if (!carrier.toggleReady) setButtonState(ready, 'disabled', '준비 상태 변경 기능을 불러오지 못했습니다.');
    if (!carrier.leave) setButtonState(leave, 'disabled', '나가기 기능을 불러오지 못했습니다.');
  };

  carrier.render = () => {
    originalRender.call(scene);
    renderOverlay();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    overlay?.destroy(true);
    overlay = undefined;
    carrier.render = originalRender;
  });
  carrier.render();
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
    const session = lobbySession(this);

    if (session) {
      this.renderGuestRoomCommandBoard(overlay, carrier, session, compact);
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

  private renderGuestRoomCommandBoard(
    overlay: Phaser.GameObjects.Container,
    carrier: GuestLobbyPresentationCarrier,
    session: CoopSession,
    compact: boolean,
  ): void {
    const blocker = this.add.rectangle(640, 374, 1220, 438, 0x131a22, 1).setStrokeStyle(3, 0x526474, 0.9).setInteractive();
    overlay.add(blocker);
    overlay.add(addCommandPanel(this, 640, 374, 1200, 422, 0x647a90, 0x18212b, 0.995));

    const room = session.room;
    if (!room) {
      overlay.add(addSectionHeading(this, 74, 174, '협동 지휘선 연결', 1105, 0x647a90));
      overlay.add(addText(this, 640, 360, '협동 방 정보를 받는 중…', compact ? 28 : 23, '#c8d3df', 'center').setOrigin(0.5));
      overlay.add(addText(this, 640, 402, '연결이 복구되면 지휘관 좌석과 공유 병기 합의 상태가 표시됩니다.', compact ? 17 : 14, '#8f9baa', 'center').setOrigin(0.5));
      const leave = addButton(this, 640, 550, 230, compact ? 80 : 56, '방 나가기', () => carrier.leaveRoom?.(), 0x8d5f64, { tone: 'danger' });
      overlay.add(leave);
      if (!carrier.leaveRoom) setButtonState(leave, 'disabled', '방 나가기 기능을 불러오지 못했습니다.');
      return;
    }

    const stage = ALL_STAGES.find((entry) => entry.id === room.stageId);
    overlay.add(addSectionHeading(this, 74, 174, `협동 준비 · ${stage?.name ?? '협동 전장'}`, 1105, 0x718da5));
    overlay.add(addText(this, 1175, 164, session.connectionState === 'OPEN' ? '서버 연결됨' : session.connectionState === 'RECONNECTING' ? '재접속 중…' : '연결 중…', compact ? 17 : 14, session.connectionState === 'OPEN' ? '#8ee3aa' : '#ffd493', 'right').setOrigin(1, 0));

    const route = this.add.graphics();
    route.lineStyle(5, 0x65798e, 0.5).lineBetween(265, 337, 1015, 337);
    route.fillStyle(room.agreedBaseWeaponId ? 0x62a37b : 0xb28a4d, 0.96).fillCircle(640, 337, 28);
    route.lineStyle(3, 0xe8dcc0, 0.55).strokeCircle(640, 337, 28);
    overlay.add(route);

    room.seats.slice(0, 2).forEach((seat, index) => {
      const x = index === 0 ? 300 : 980;
      const mine = seat.seatId === session.seatId;
      const accent = mine ? 0x6fa2d0 : 0x627184;
      overlay.add(this.add.circle(x, 337, 34, accent, 0.96).setStrokeStyle(3, mine ? 0xd7eaff : 0xa9b4c1, 0.55));
      overlay.add(addText(this, x, 324, String(index + 1), compact ? 20 : 17, '#ffffff', 'center').setOrigin(0.5));
      overlay.add(addText(this, x, 220, `${index + 1}번 지휘관${mine ? ' · 나' : ''}`, compact ? 23 : 20, '#ffffff', 'center').setOrigin(0.5));
      overlay.add(addText(this, x, 258, seat.connected ? '● 접속됨' : '○ 접속 대기', compact ? 17 : 14, seat.connected ? '#8ee3aa' : '#a3adba', 'center').setOrigin(0.5));
      overlay.add(addText(this, x, 286, `편성 ${seat.deckSize}/5 · ${seat.ready ? '준비 완료' : '준비 전'}`, compact ? 17 : 14, seat.ready ? '#f0d67d' : '#b8c2cf', 'center').setOrigin(0.5));
      overlay.add(addText(this, x, 388, coopWeaponName(seat.selectedBaseWeaponId), compact ? 18 : 15, '#bfe8ff', 'center').setOrigin(0.5));
      overlay.add(addText(this, x, 418, seat.control === 'AI' ? '연결 이탈 · 임시 지휘' : '플레이어 지휘', compact ? 15 : 12, seat.control === 'AI' ? '#ffd493' : '#8fa4b8', 'center').setOrigin(0.5));
    });

    const agreementText = room.agreedBaseWeaponId
      ? `공유 병기 합의\n${coopWeaponName(room.agreedBaseWeaponId)}`
      : '병기 불일치\n같은 병기로 맞추기';
    overlay.add(addText(this, 640, 306, agreementText, compact ? 17 : 14, room.agreedBaseWeaponId ? '#c9f1d6' : '#ffe0a0', 'center').setOrigin(0.5));

    const mine = room.seats.find((seat) => seat.seatId === session.seatId);
    if (carrier.inviteCode) {
      overlay.add(addText(this, 82, 472, `친구 참가 코드 · ${carrier.inviteCode}`, compact ? 16 : 13, '#cbd4e1').setWordWrapWidth(590));
    } else {
      overlay.add(addText(this, 82, 472, '참가자로 연결됨 · 방장의 준비 신호를 함께 기다립니다.', compact ? 16 : 13, '#95a4b4'));
    }

    const weapon = addButton(this, 285, 548, 250, compact ? 80 : 58, '공유 병기 변경', () => carrier.cycleBaseWeapon?.(), 0x4f7894, { tone: 'secondary' });
    const ready = addButton(this, 560, 548, 220, compact ? 80 : 58, mine?.ready ? '준비 취소' : '준비 완료', () => carrier.toggleReady?.(), 0x5f8f75, { tone: 'primary' });
    const invite = addButton(this, 810, 548, 210, compact ? 80 : 58, carrier.inviteCode ? '참가 코드 복사' : '코드 없음', () => { void carrier.copyInvite?.(); }, 0x6b628f, { tone: 'quiet' });
    const leave = addButton(this, 1070, 548, 190, compact ? 80 : 58, '방 나가기', () => carrier.leaveRoom?.(), 0x8d5f64, { tone: 'danger' });
    overlay.add([weapon, ready, invite, leave]);

    if (mine?.ready) {
      setButtonState(weapon, 'locked', '준비를 취소한 뒤 공유 병기를 변경할 수 있습니다.');
      setButtonState(ready, 'selected');
    }
    if (!carrier.cycleBaseWeapon) setButtonState(weapon, 'disabled', '병기 변경 기능을 불러오지 못했습니다.');
    if (!carrier.toggleReady) setButtonState(ready, 'disabled', '준비 상태 변경 기능을 불러오지 못했습니다.');
    if (!carrier.inviteCode || !carrier.copyInvite) setButtonState(invite, 'disabled', carrier.inviteCode ? '코드 복사 기능을 불러오지 못했습니다.' : '참가자는 별도 초대 코드를 공유하지 않습니다.');
    if (!carrier.leaveRoom) setButtonState(leave, 'disabled', '방 나가기 기능을 불러오지 못했습니다.');
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
    installAccountCoopCommandBoard(this, 'FRIEND');
  }
}

export class StoryPublicCoopLobbyScene extends PublicCoopLobbyScene {
  override create(): void {
    super.create();
    attachLobbyPreStory(this);
    installAccountCoopCommandBoard(this, 'PUBLIC');
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

    if (session.battle?.winner !== 'PLAYER' || this.stageWasClearedBeforeBattle) return;
    const story = getPostStageStory(this.storyStageId);
    if (!story) return;
    this.postStoryHandled = true;
    presentStoryOverlay(this, story);
  }
}
