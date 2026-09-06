import Phaser from 'phaser';
import { SettingsScene as BaseSettingsScene } from './settings-scene.ts';

type SettingsCarrier = Phaser.Scene & Record<string, unknown>;

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteSettingsCopy(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '접근성, 전장 표현, 소리를 즉시 조정합니다.': '화면, 전장 표현, 소리를 바로 조정합니다.',
    '변경 내용은 이 기기에 저장됩니다.': '변경 내용은 이 기기에 저장',
    '위험 표시는 색이나 소리 하나에만 의존하지 않습니다.': '위험 표시는 색과 소리를 함께 사용합니다.',
    '낮은 품질·VFX·배터리 절약은 장식 효과만 줄입니다.': '낮은 품질·VFX·배터리 절약은 장식 효과만 줄입니다.',
    '스토리를 건너뛰어도 전투 판정은 그대로 유지됩니다.': '스토리 건너뛰기는 전투 판정에 영향을 주지 않습니다.',
    '전체 음량 0%는 모든 게임 소리를 음소거합니다.': '전체 음량 0%는 모든 소리를 끕니다.',
    '세부 음량은 전체 음량과 함께 적용됩니다.': '세부 음량은 전체 음량 안에서 적용됩니다.',
  };
  return direct[value] ?? value;
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const next = rewriteSettingsCopy(normalize(value));
    const target = original(x, y, next, style);
    const originalSetText = target.setText.bind(target);
    target.setText = ((updated: string | string[]) => originalSetText(rewriteSettingsCopy(normalize(updated)))) as typeof target.setText;
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

function directLabel(container: Phaser.GameObjects.Container): string {
  const text = container.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
  return text?.text ?? '';
}

function polishSettings(scene: Phaser.Scene): void {
  visit(scene.children.list, (object) => {
    if (object instanceof Phaser.GameObjects.Graphics) object.setAlpha(Math.min(object.alpha, 0.88));
    if (object instanceof Phaser.GameObjects.Rectangle) {
      if (object.height <= 2 && object.width >= 250) object.setAlpha(Math.min(object.alpha, 0.24));
    }
    if (object instanceof Phaser.GameObjects.Text) {
      if (['접근성', '전장 표현', '오디오'].includes(object.text)) object.setAlpha(0.92).setColor('#dce5ee');
      if (object.y >= 500 && object.fontSize <= 14) object.setAlpha(0.68);
      if (object.text === '변경 내용은 이 기기에 저장') object.setAlpha(0.62);
    }
    if (object instanceof Phaser.GameObjects.Container) {
      const label = directLabel(object);
      if (label === '기본값으로 되돌리기') object.setAlpha(0.82).setDepth(4);
      if (/^(켜짐|꺼짐|\d+%|낮음|보통|높음)$/.test(label)) object.setDepth(6);
    }
  });
}

function wrapAfter(carrier: SettingsCarrier, name: string, after: () => void): (() => void) | undefined {
  const original = carrier[name];
  if (typeof original !== 'function') return undefined;
  carrier[name] = (...args: unknown[]) => {
    const result = (original as (...values: unknown[]) => unknown).apply(carrier, args);
    after();
    return result;
  };
  return () => { carrier[name] = original; };
}

/** Presentation-only settings layer. Persistence and control semantics remain in the base scene. */
export class SettingsScene extends BaseSettingsScene {
  override create(): void {
    const restoreText = installTextFactory(this);
    super.create();
    const carrier = this as unknown as SettingsCarrier;
    const restoreRender = wrapAfter(carrier, 'render', () => polishSettings(this));
    polishSettings(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreRender?.();
      restoreText();
    });
  }
}
