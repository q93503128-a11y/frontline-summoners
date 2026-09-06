import Phaser from 'phaser';
import { PvpSeasonScene as BasePvpSeasonScene } from './pvp-season-scene.ts';

type SeasonCarrier = Phaser.Scene & Record<string, unknown>;

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteSeasonCopy(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '현재 위치 · 최근 랭킹전 · 시즌 분포 · 지난 시즌 명예': '현재 위치와 최근 랭킹전, 지난 시즌 명예를 확인합니다.',
    '내 시즌 위치': '내 위치',
    '티어 분포': '시즌 분포',
    '지난 시즌 명예': '지난 시즌',
    '랭킹전만 시즌 평점에 반영 · 티어 최초 도달 보상은 계정당 1회': '랭킹전만 시즌 평점에 반영 · 티어 보상은 계정당 1회',
    '시즌 전황 동기화 완료': '시즌 전황 확인 완료',
  };
  if (direct[value]) return direct[value]!;
  if (/HTTP_|requestId|revision|state hash|season_/i.test(value)) {
    return '시즌 기록을 불러오지 못했습니다. 연결 상태를 확인해 주세요.';
  }
  return value;
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const next = rewriteSeasonCopy(normalize(value));
    const target = original(x, y, next, style);
    const originalSetText = target.setText.bind(target);
    target.setText = ((updated: string | string[]) => originalSetText(rewriteSeasonCopy(normalize(updated)))) as typeof target.setText;
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

function polishSeason(scene: Phaser.Scene): void {
  visit(scene.children.list, (object) => {
    if (object instanceof Phaser.GameObjects.Rectangle) {
      if (object.width >= 1100 && object.height >= 380) {
        object.setFillStyle(0x171f28, 0.24).setStrokeStyle(1, 0x657184, 0.1);
      } else if (object.width >= 1100 && object.height >= 90 && object.height <= 120) {
        object.setFillStyle(0x171f28, 0.32).setStrokeStyle(1, 0x786d83, 0.12);
      } else if (object.width <= 2 && object.height >= 300) {
        object.setAlpha(Math.min(object.alpha, 0.22));
      }
    }
    if (object instanceof Phaser.GameObjects.Text) {
      if (object.text === '내 위치') object.setColor('#dce7f2').setAlpha(0.94);
      if (object.text === '최근 랭킹전') object.setColor('#d9e1eb').setAlpha(0.9);
      if (object.text === '시즌 분포') object.setColor('#cbd3de').setAlpha(0.82);
      if (object.text === '지난 시즌') object.setColor('#d9c7a0').setAlpha(0.88);
      if (/^(브론즈|실버|골드|플래티넘|다이아|마스터|그랜드마스터|전선 최상위)$/.test(object.text) && object.x < 200) {
        object.setFontSize(Math.max(object.fontSize, 29)).setColor('#fff0bd');
      }
      if (object.text.startsWith('평점 ') && object.x < 200) object.setAlpha(0.92);
      if (object.text.startsWith('참가 ') || object.text.startsWith('시즌 ')) object.setAlpha(0.7);
    }
  });
}

function wrapAfter(carrier: SeasonCarrier, name: string, after: () => void): (() => void) | undefined {
  const original = carrier[name];
  if (typeof original !== 'function') return undefined;
  carrier[name] = (...args: unknown[]) => {
    const result = (original as (...values: unknown[]) => unknown).apply(carrier, args);
    after();
    return result;
  };
  return () => { carrier[name] = original; };
}

/** Presentation-only season layer. Rating, rewards and network authority remain in the base scene. */
export class PvpSeasonScene extends BasePvpSeasonScene {
  override create(): void {
    const restoreText = installTextFactory(this);
    super.create();
    const carrier = this as unknown as SeasonCarrier;
    const restoreRender = wrapAfter(carrier, 'render', () => polishSeason(this));
    polishSeason(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreRender?.();
      restoreText();
    });
  }
}
