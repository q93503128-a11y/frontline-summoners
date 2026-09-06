import Phaser from 'phaser';
import { PvpLeaderboardScene as BasePvpLeaderboardScene } from './pvp-leaderboard-scene.ts';

type LeaderboardCarrier = Phaser.Scene & Record<string, unknown>;

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteLeaderboardCopy(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '배치를 마친 지휘관의 시즌 위치만 표시합니다.': '배치를 마친 지휘관의 현재 시즌 위치를 확인합니다.',
    '전체 순위': '전체 전선',
    '내 주변': '내 주변 전선',
    '친구 순위': '친구 전선',
    '순위 기록 동기화 중…': '전선 기록 확인 중…',
  };
  if (direct[value]) return direct[value]!;
  if (/HTTP_|requestId|revision|state hash|leaderboard_/i.test(value)) {
    return '순위 기록을 불러오지 못했습니다. 연결 상태를 확인해 주세요.';
  }
  return value;
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const next = rewriteLeaderboardCopy(normalize(value));
    const target = original(x, y, next, style);
    const originalSetText = target.setText.bind(target);
    target.setText = ((updated: string | string[]) => originalSetText(rewriteLeaderboardCopy(normalize(updated)))) as typeof target.setText;
    return target;
  }) as typeof scene.add.text;
  return () => { scene.add.text = original; };
}

function visit(objects: readonly Phaser.GameObjects.GameObject[], visitor: (object: Phaser.GameObjects.GameObject) => void): void {
  objects.forEach((object) => {
    visitor(object);
    if (object instanceof Phaser.GameObjects.Container) visit(object.list, visitor);
  });
}

function polishLeaderboard(scene: Phaser.Scene): void {
  visit(scene.children.list, (object) => {
    if (object instanceof Phaser.GameObjects.Rectangle) {
      if (object.width >= 1100 && object.height >= 450) {
        object.setFillStyle(0x171f28, 0.24).setStrokeStyle(1, 0x657184, 0.1);
      }
      if (object.width >= 1000 && object.height >= 30 && object.height <= 40) {
        object.setAlpha(Math.min(object.alpha, 0.78));
      }
      if (object.height <= 2 && object.width >= 900) object.setAlpha(Math.min(object.alpha, 0.16));
    }
    if (object instanceof Phaser.GameObjects.Text) {
      if (object.text === '전체 전선' || object.text === '내 주변 전선' || object.text === '친구 전선') {
        object.setColor('#dbe4ee').setAlpha(0.9);
      }
      if (object.text.includes(' · 나')) object.setColor('#fff0b8').setAlpha(1);
      if (/^#(1|2|3)$/.test(object.text)) object.setFontSize(Math.max(object.fontSize, 17)).setAlpha(1);
      if (['순위', '지휘관', '티어', '평점', '승수'].includes(object.text)) object.setAlpha(0.68);
    }
  });
}

function wrapAfter(carrier: LeaderboardCarrier, name: string, after: () => void): (() => void) | undefined {
  const original = carrier[name];
  if (typeof original !== 'function') return undefined;
  carrier[name] = (...args: unknown[]) => {
    const result = (original as (...values: unknown[]) => unknown).apply(carrier, args);
    after();
    return result;
  };
  return () => { carrier[name] = original; };
}

/** Presentation-only leaderboard layer. Scope, pagination and ranking authority remain in the base scene. */
export class PvpLeaderboardScene extends BasePvpLeaderboardScene {
  override create(): void {
    const restoreText = installTextFactory(this);
    super.create();
    const carrier = this as unknown as LeaderboardCarrier;
    const restoreRender = wrapAfter(carrier, 'render', () => polishLeaderboard(this));
    polishLeaderboard(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreRender?.();
      restoreText();
    });
  }
}
