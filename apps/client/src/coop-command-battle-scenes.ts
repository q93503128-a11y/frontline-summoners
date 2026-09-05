import Phaser from 'phaser';
import type { CoopBattleSnapshot, CoopServerMessage, CoopSession } from './coop-network';
import { getSlotById } from './prototype';
import { loadGuestProgress } from './save';
import { setButtonState } from './scene-ui';
import {
  StoryFriendCoopBattleScene as BaseStoryFriendCoopBattleScene,
  StoryGuestCoopBattleScene as BaseStoryGuestCoopBattleScene,
} from './coop-story-scenes';
import { getPostStageStory } from './story-content';
import { presentStoryOverlay } from './story-overlay';
import { isCompactMobileViewport } from './viewport';

export {
  StoryFriendCoopLobbyScene,
  StoryGuestCoopLobbyScene,
  StoryPublicCoopLobbyScene,
} from './coop-story-scenes';

type CoopBattlePresentationCarrier = Phaser.Scene & {
  readonly snapshot?: CoopBattleSnapshot | null;
  readonly session?: CoopSession;
  readonly controlsLayer?: Phaser.GameObjects.Container;
  readonly deckIds?: readonly string[];
  readonly progress?: { readonly deckSlotIds?: readonly string[] };
};

type RuntimeCarrier = CoopBattlePresentationCarrier & Record<string, unknown>;

type GuestStoryRuntimeCarrier = RuntimeCarrier & {
  storySession?: CoopSession;
  storyStageId?: string;
  stageWasClearedBeforeBattle?: boolean;
  postStoryHandled?: boolean;
  onStoryServerMessage?: (message: CoopServerMessage) => void;
};

function visitTexts(object: Phaser.GameObjects.GameObject, action: (text: Phaser.GameObjects.Text) => void): void {
  if (object instanceof Phaser.GameObjects.Text) action(object);
  if (object instanceof Phaser.GameObjects.Container) {
    object.list.forEach((child) => visitTexts(child as Phaser.GameObjects.GameObject, action));
  }
}

function seatName(seatId: string, ownSeatId: string | null | undefined): string {
  return seatId === ownSeatId ? '나' : '동료';
}

function sanitizePlayerText(scene: Phaser.Scene, session: CoopSession | undefined): void {
  const ownSeatId = session?.seatId;
  scene.children.list.forEach((object) => visitTexts(object, (textObject) => {
    let text = textObject.text;
    if (text.startsWith('협동 오류 ·')) {
      text = '협동 명령을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
    text = text.replace(/30Hz 서버 전투 · frame \d+ · /g, '');
    text = text.replace(/보급소 Lv(\d+)/g, '보급소 $1단계');
    text = text.replace(/ · Lv(\d+)/g, ' · 보급소 $1단계');
    text = text.replace(/\bREADY\b/g, '사용 가능');
    text = text.replace(/\bMAX\b/g, '최대');
    text = text.replace(/협동 NORMAL_CLEAR 저장 완료/g, '협동 클리어 저장 완료');
    text = text.replace(/현재 탭에서 클리어 유지/g, '저장에 실패해 이번 실행에서만 클리어가 유지됩니다.');
    text = text.replace(/최근 사용 ([AB])/g, (_match, id: string) => `최근 사용 ${seatName(id, ownSeatId)}`);
    text = text.replace(/^([AB])·/g, (_match, id: string) => `${seatName(id, ownSeatId)}·`);
    text = text.replace(/\b(\d+)F\b/g, '재사용 대기');
    if (text !== textObject.text) textObject.setText(text);
  }));
}

function commandButtons(layer: Phaser.GameObjects.Container | undefined): Phaser.GameObjects.Container[] {
  if (!layer) return [];
  return layer.list.filter((child): child is Phaser.GameObjects.Container =>
    child instanceof Phaser.GameObjects.Container && Boolean(child.getData('frontlineCommandButton')),
  );
}

function buttonLabel(button: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return button.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
}

function presentationDeckIds(carrier: CoopBattlePresentationCarrier): readonly string[] {
  const ids = carrier.deckIds ?? carrier.progress?.deckSlotIds ?? [];
  return ids.slice(0, 5).filter((slotId) => Boolean(getSlotById(slotId)));
}

function disableAll(buttons: readonly Phaser.GameObjects.Container[], state: 'disabled' | 'locked' | 'loading', reason: string): void {
  buttons.forEach((button) => setButtonState(button, state, reason));
}

function refreshControlStates(carrier: CoopBattlePresentationCarrier): void {
  const buttons = commandButtons(carrier.controlsLayer);
  if (buttons.length === 0) return;
  const snapshot = carrier.snapshot;
  const session = carrier.session;
  if (!snapshot || !session) {
    disableAll(buttons, 'loading', '협동 전투 상태를 확인하는 중입니다.');
    return;
  }
  if (session.connectionState !== 'OPEN') {
    disableAll(buttons, 'locked', '협동 연결을 복구하는 중입니다.');
    return;
  }
  if (snapshot.winner !== null) {
    disableAll(buttons, 'disabled', '전투가 종료되었습니다.');
    return;
  }

  const mine = snapshot.players.find((player) => player.seatId === session.seatId);
  if (!mine) {
    disableAll(buttons, 'loading', '내 지휘 상태를 확인하는 중입니다.');
    return;
  }

  const compact = isCompactMobileViewport();
  const deckIds = presentationDeckIds(carrier);
  deckIds.forEach((slotId, index) => {
    const button = buttons[index];
    const slot = getSlotById(slotId);
    if (!button || !slot) return;
    const cooldown = mine.cooldowns[slotId] ?? 0;
    const cost = mine.costs[slotId] ?? slot.cost;
    const prefix = compact ? '' : `${index + 1} · `;
    buttonLabel(button)?.setText(`${prefix}${slot.displayName}\n${cooldown > 0 ? '재생산 대기' : `${cost} 보급`}`);
    if (cooldown > 0) {
      setButtonState(button, 'disabled', '이 동료는 아직 재생산 대기 중입니다.');
    } else if (mine.supply < cost) {
      setButtonState(button, 'disabled', `보급이 ${cost - mine.supply} 부족합니다.`);
    } else {
      setButtonState(button, 'default');
    }
  });

  const upgradeButton = buttons[deckIds.length];
  if (upgradeButton) {
    const upgradeCost = mine.nextSupplyUpgradeCost;
    if (upgradeCost === null) {
      buttonLabel(upgradeButton)?.setText('보급소 최대');
      setButtonState(upgradeButton, 'disabled', '보급소가 최대 단계입니다.');
    } else {
      buttonLabel(upgradeButton)?.setText(`보급소 강화\n${upgradeCost} 보급`);
      if (mine.supply < upgradeCost) setButtonState(upgradeButton, 'disabled', `보급이 ${upgradeCost - mine.supply} 부족합니다.`);
      else setButtonState(upgradeButton, 'default');
    }
  }

  const weaponButton = buttons[deckIds.length + 1];
  if (weaponButton) {
    if (snapshot.baseWeaponCooldownFrames > 0) {
      setButtonState(weaponButton, 'disabled', '공유 거점 병기는 아직 재사용 대기 중입니다.');
    } else {
      setButtonState(weaponButton, 'default');
    }
  }
}

function wrapAfter(carrier: RuntimeCarrier, methodName: string, after: () => void): (() => void) | undefined {
  const original = carrier[methodName];
  if (typeof original !== 'function') return undefined;
  carrier[methodName] = (...args: unknown[]) => {
    const result = (original as (...values: unknown[]) => unknown).apply(carrier, args);
    after();
    return result;
  };
  return () => { carrier[methodName] = original; };
}

function installGuestPersistedStoryBridge(scene: Phaser.Scene): (() => void) | undefined {
  const carrier = scene as unknown as GuestStoryRuntimeCarrier;
  const original = carrier.onStoryServerMessage;
  if (typeof original !== 'function') return undefined;

  carrier.onStoryServerMessage = (message: CoopServerMessage): void => {
    if (message.type !== 'BATTLE_FINISHED' || carrier.postStoryHandled === true || !scene.scene.isActive()) return;
    const stageId = typeof carrier.storyStageId === 'string' ? carrier.storyStageId : '';
    if (!stageId || message.battle.winner !== 'PLAYER' || carrier.stageWasClearedBeforeBattle === true) return;
    const story = getPostStageStory(stageId);
    if (!story) return;

    carrier.postStoryHandled = true;
    let checks = 0;
    let reading = false;
    const poll = scene.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        if (reading || !scene.scene.isActive()) return;
        reading = true;
        checks += 1;
        void loadGuestProgress()
          .then((progress) => {
            if (!scene.scene.isActive()) return;
            if (progress.clearedStageIds.includes(stageId)) {
              poll.destroy();
              presentStoryOverlay(scene, story);
            } else if (checks >= 50) {
              poll.destroy();
            }
          })
          .catch(() => {
            if (checks >= 50) poll.destroy();
          })
          .finally(() => { reading = false; });
      },
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => poll.destroy());
  };

  return () => { carrier.onStoryServerMessage = original; };
}

function installCoopBattleCommandSurface(scene: Phaser.Scene): void {
  const carrier = scene as unknown as RuntimeCarrier;
  const refresh = (): void => {
    refreshControlStates(carrier);
    sanitizePlayerText(scene, carrier.session);
  };
  const restores = [
    wrapAfter(carrier, 'renderControls', refresh),
    wrapAfter(carrier, 'renderSnapshot', refresh),
    wrapAfter(carrier, 'renderBattle', refresh),
    wrapAfter(carrier, 'onServerMessage', refresh),
    wrapAfter(carrier, 'onMessage', refresh),
    wrapAfter(carrier, 'showResult', refresh),
  ].filter((restore): restore is () => void => Boolean(restore));
  const unsubscribeConnection = carrier.session?.subscribeConnection(() => refresh());
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    unsubscribeConnection?.();
    restores.forEach((restore) => restore());
  });
  refresh();
}

export class StoryGuestCoopBattleScene extends BaseStoryGuestCoopBattleScene {
  override create(): void {
    const restoreStoryHandler = installGuestPersistedStoryBridge(this);
    super.create();
    installCoopBattleCommandSurface(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => restoreStoryHandler?.());
  }
}

export class StoryFriendCoopBattleScene extends BaseStoryFriendCoopBattleScene {
  override create(): void {
    super.create();
    installCoopBattleCommandSurface(this);
  }
}
