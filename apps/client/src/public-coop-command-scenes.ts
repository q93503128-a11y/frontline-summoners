import Phaser from 'phaser';
import type { CoopSession } from './coop-network.ts';
import { StoryPublicCoopLobbyScene as BasePublicCoopLobbyScene } from './coop-command-battle-scenes.ts';
import { PublicCoopMatchmakingScene as BasePublicCoopMatchmakingScene } from './public-coop-scenes.ts';
import { fitTextToWidth, setButtonState } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

type PublicCoopPresentationCarrier = Phaser.Scene & {
  render?: () => void;
  readonly session?: CoopSession | null;
};

function rewritePublicCoopLine(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '공개 협동 매칭': '공개 협동',
    '같은 전장의 온라인 지휘관과 자동 매칭 · 계정 귀속 전투': '전장을 고르면 같은 전장의 지휘관을 찾습니다.',
    '공개 협동 전선': '전장 선택',
    '전장 선택 가능': '출전 준비',
    '대기열 참가 중': '상대 찾는 중',
    '상대 좌석 확정 중': '상대 연결 중',
    '상대 배정 완료': '전우 합류',
    '이 전장으로 매칭 시작': '협동 찾기',
    '공개 협동 대기열 참가를 요청하는 중…': '협동 상대를 찾기 시작하는 중…',
    '공개 협동 대기열을 취소하는 중…': '협동 찾기를 취소하는 중…',
    '전장을 고르고 공개 매칭을 시작하세요.': '전장을 고르고 협동 상대를 찾아보세요.',
    '공개 협동 로비': '협동 출전 준비',
    '자동 매칭 · 계정 편성 · 개인 보급 · 공유 기지/병기': '각자 편성 · 개인 보급 · 공유 거점/병기',
    'PUBLIC MATCH · 계정 귀속 좌석': '출전 인원',
    '공개 매칭용 계정 귀속 방이 아닙니다.': '협동 방 정보를 확인하지 못했습니다. 다시 매칭해 주세요.',
    '매칭 화면': '협동 찾기',
    '병기 불일치 · 같은 병기를 선택해야 준비할 수 있습니다.': '공유 병기를 맞추면 출전할 수 있습니다.',
    '출정': '전선으로',
    '상대와 연결됨': '전우 연결됨',
    '매칭된 상대의 접속을 기다리는 중…': '전우의 접속을 기다리는 중…',
  };
  if (direct[value]) return direct[value]!;
  if (/^협동 가능 전장 \d+ \/ \d+$/.test(value)) return value.replace('협동 가능 전장', '전장');
  if (/^상대 좌석을 확정하는 중/.test(value)) return '상대와 연결하는 중…';
  if (/^공개 협동 대기열/.test(value)) return value.replace('공개 협동 대기열', '협동 찾기');
  if (/^공유 병기 합의 · /.test(value)) return value.replace('공유 병기 합의 · ', '공유 병기 · ');
  if (/^[AB]\s*지휘관/.test(value)) return value.replace(/^[AB]\s*/, '');
  if (/HTTP_|state hash|requestId|revision|seatId|matchId|roomId|queueId|accountBound|matchKind|websocketPath|websocket|public_coop_|coop_/i.test(value)) {
    return '협동 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
  }
  return value;
}

function rewritePublicCoopText(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(rewritePublicCoopLine) : rewritePublicCoopLine(value);
}

function fitPublicCoopText(target: Phaser.GameObjects.Text): void {
  const compact = isCompactMobileViewport();
  if (target.text.length < 14) return;
  const centered = Math.abs(target.originX - 0.5) < 0.05;
  const maxWidth = centered
    ? 900
    : target.x <= 120
      ? 1040
      : target.x >= 820
        ? 340
        : target.x >= 520
          ? 520
          : 430;
  if (target.width > maxWidth) fitTextToWidth(target, maxWidth, compact ? 14 : 11);
}

function installTextPresentation(scene: Phaser.Scene): () => void {
  const factory = scene.add;
  const originalText = factory.text;
  factory.text = ((x, y, value, style) => {
    const text = originalText.call(factory, x, y, rewritePublicCoopText(value), style);
    fitPublicCoopText(text);
    const originalSetText = text.setText.bind(text);
    text.setText = ((next: string | string[]) => {
      const result = originalSetText(rewritePublicCoopText(next));
      fitPublicCoopText(text);
      return result;
    }) as typeof text.setText;
    return text;
  }) as typeof factory.text;
  return () => { factory.text = originalText; };
}

function collectCommandButtons(object: Phaser.GameObjects.GameObject, output: Phaser.GameObjects.Container[]): void {
  if (!(object instanceof Phaser.GameObjects.Container)) return;
  if (object.getData('frontlineCommandButton') !== undefined) output.push(object);
  object.list.forEach((child) => collectCommandButtons(child as Phaser.GameObjects.GameObject, output));
}

function commandLabel(button: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return button.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
}

function polishPublicCoopGeometry(scene: Phaser.Scene): void {
  const visit = (object: Phaser.GameObjects.GameObject): void => {
    if (object instanceof Phaser.GameObjects.Rectangle) {
      if (object.width >= 900 && object.height >= 330) {
        object.setFillStyle(0x17212a, 0.34).setStrokeStyle(1, 0x60758a, 0.14);
      } else if (object.width >= 340 && object.width <= 410 && object.height >= 220 && object.height <= 280) {
        object.setFillStyle(0x1a2330, 0.66).setStrokeStyle(1, 0x61758a, 0.24);
      }
    }
    if (object instanceof Phaser.GameObjects.Text) {
      if (object.text === '출전 인원' || object.text === '전장 선택') object.setAlpha(0.88);
      if (object.text.includes('각자 편성 · 개인 보급')) object.setAlpha(0.72);
      fitPublicCoopText(object);
    }
    if (object instanceof Phaser.GameObjects.Container) {
      object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
    }
  };
  scene.children.list.forEach(visit);

  const carrier = scene as unknown as PublicCoopPresentationCarrier;
  const session = carrier.session ?? null;
  const mine = session?.room?.seats.find((seat) => seat.seatId === session.seatId);
  if (!mine) return;

  const buttons: Phaser.GameObjects.Container[] = [];
  scene.children.list.forEach((object) => collectCommandButtons(object, buttons));
  for (const button of buttons) {
    const label = commandLabel(button)?.text ?? '';
    if ((label.startsWith('병기 변경') || label === '공유 병기 변경') && mine.ready) {
      setButtonState(button, 'locked', '준비를 취소한 뒤 공유 병기를 변경할 수 있습니다.');
    }
    if (label === '준비 취소') setButtonState(button, 'selected');
  }
}

function installRenderPolish(scene: Phaser.Scene): () => void {
  const carrier = scene as unknown as PublicCoopPresentationCarrier;
  const originalRender = carrier.render;
  if (!originalRender) {
    polishPublicCoopGeometry(scene);
    return () => undefined;
  }
  carrier.render = () => {
    originalRender.call(scene);
    polishPublicCoopGeometry(scene);
  };
  polishPublicCoopGeometry(scene);
  return () => { carrier.render = originalRender; };
}

export class PublicCoopMatchmakingScene extends BasePublicCoopMatchmakingScene {
  override create(): void {
    const restoreText = installTextPresentation(this);
    super.create();
    const restoreRender = installRenderPolish(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreText();
      restoreRender();
    });
  }
}

export class PublicCoopLobbyScene extends BasePublicCoopLobbyScene {
  override create(): void {
    const restoreText = installTextPresentation(this);
    super.create();
    const restoreRender = installRenderPolish(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreText();
      restoreRender();
    });
  }
}
