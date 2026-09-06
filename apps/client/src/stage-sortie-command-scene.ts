import Phaser from 'phaser';
import { StageSortieModeScene as BaseStageSortieModeScene } from './stage-sortie-mode-scene.ts';

type SortieCarrier = Phaser.Scene & Record<string, unknown>;

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteSortieCopy(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '출정 확인': '출정 준비',
    '출정 방식을 선택하세요.': '출정 방식을 선택합니다.',
    '진행 기록 확인': '출정 조건 확인',
    '친구가 없습니다. 친구 메뉴에서 먼저 추가하세요.': '초대할 친구가 없습니다.',
    '게스트는 참가 코드 협동만 사용할 수 있습니다.': '게스트는 참가 코드 협동을 사용할 수 있습니다.',
    '계정 연결을 복구하면 단독·협동 출정을 다시 사용할 수 있습니다.': '온라인 연결을 복구하면 출정할 수 있습니다.',
  };
  if (direct[value]) return direct[value]!;
  if (value.startsWith('협동 보정  ')) return value.replace('협동 보정  ', '협동 보정 · ');
  if (value.startsWith('친구 초대는 지정한 친구와, 공개 협동은 같은 전장을 고른 지휘관과 연결됩니다.')) {
    return '친구 초대 또는 같은 전장을 고른 지휘관과 협동합니다.';
  }
  if (/HTTP_|requestId|revision|state hash|coop_|social_/i.test(value)) {
    return '출정 정보를 확인하지 못했습니다. 연결 상태를 확인해 주세요.';
  }
  return value;
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const next = rewriteSortieCopy(normalize(value));
    const target = original(x, y, next, style);
    const originalSetText = target.setText.bind(target);
    target.setText = ((updated: string | string[]) => originalSetText(rewriteSortieCopy(normalize(updated)))) as typeof target.setText;
    return target;
  }) as typeof scene.add.text;
  return () => { scene.add.text = original; };
}

function directLabel(container: Phaser.GameObjects.Container): string {
  const text = container.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
  return text?.text ?? '';
}

function visit(objects: readonly Phaser.GameObjects.GameObject[], visitor: (object: Phaser.GameObjects.GameObject) => void): void {
  objects.forEach((object) => {
    visitor(object);
    if (object instanceof Phaser.GameObjects.Container) visit(object.list, visitor);
  });
}

function polishSortie(scene: Phaser.Scene): void {
  visit(scene.children.list, (object) => {
    if (object instanceof Phaser.GameObjects.Rectangle) {
      if (object.width >= 1000 && object.height >= 390) {
        object.setFillStyle(0x171f28, 0.3).setStrokeStyle(1, 0x6688a7, 0.12);
      } else if (object.width >= 700 && object.height >= 240) {
        object.setFillStyle(0x171f28, 0.36).setStrokeStyle(1, 0x657086, 0.14);
      }
    }
    if (object instanceof Phaser.GameObjects.Text) {
      if (object.text === '출정 준비') object.setColor('#f1e7cc');
      if (object.text.startsWith('전장 ') || object.text.startsWith('협동 보정 · ')) object.setAlpha(0.78);
      if (object.text.includes('친구 초대 또는') || object.text.includes('참가 코드 협동')) object.setAlpha(0.72);
    }
    if (object instanceof Phaser.GameObjects.Container) {
      const label = directLabel(object);
      if (label === '혼자 출정' || label === '계정 연결 후 출정') object.setDepth(9);
      if (label === '친구 초대' || label === '코드 협동' || label === '공개 협동') object.setDepth(8);
      if (label === '편성으로 이동') object.setDepth(9);
    }
  });
}

function wrapAfter(carrier: SortieCarrier, name: string, after: () => void): (() => void) | undefined {
  const original = carrier[name];
  if (typeof original !== 'function') return undefined;
  carrier[name] = (...args: unknown[]) => {
    const result = (original as (...values: unknown[]) => unknown).apply(carrier, args);
    after();
    return result;
  };
  return () => { carrier[name] = original; };
}

/** Presentation-only pre-battle layer. Unlock, formation and co-op authority remain in the base scene. */
export class StageSortieModeScene extends BaseStageSortieModeScene {
  override create(): void {
    const restoreText = installTextFactory(this);
    super.create();
    const carrier = this as unknown as SortieCarrier;
    const restorers = ['renderLoading', 'renderBlocked', 'renderHome', 'renderFriends']
      .map((name) => wrapAfter(carrier, name, () => polishSortie(this)))
      .filter((restore): restore is () => void => restore !== undefined);
    polishSortie(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restorers.forEach((restore) => restore());
      restoreText();
    });
  }
}
