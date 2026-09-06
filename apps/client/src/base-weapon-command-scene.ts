import Phaser from 'phaser';
import { BaseWeaponScene as BaseBaseWeaponScene } from './base-weapon-scene.ts';
import { fitTextToWidth } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

type RuntimeCarrier = Phaser.Scene & Record<string, unknown>;

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteBaseWeaponCopy(value: string): string {
  if (/HTTP_|revision|request_|account_/i.test(value)) return '병기 정보를 불러오지 못했습니다. 연결 상태를 확인해 주세요.';
  const direct: Readonly<Record<string, string>> = {
    '거점 병기고': '거점 병기고',
    '출정 전에 공유 거점 병기 하나를 선택합니다.': '출정에 사용할 거점 병기 1종을 선택합니다.',
    '병기 선택': '출정 병기',
    '전투 성능': '전장 효과',
    '일반전과 기록전에 같은 장착 병기가 적용됩니다.': '일반전과 기록전에 같은 병기가 적용됩니다.',
    '병기를 선택해 성능을 확인하고 장착하세요.': '병기를 비교한 뒤 출정 장비를 확정하세요.',
    '현재 장착 중': '장착 완료',
    '이 병기 장착': '출정 병기로 장착',
    '성능 보기': '비교',
  };
  return direct[value] ?? value;
}

function decorateText(target: Phaser.GameObjects.Text, value: string): void {
  const compact = isCompactMobileViewport();
  if (value === '거점 병기고') target.setFontSize(compact ? 40 : 42).setColor('#f1e5c7');
  if (value.startsWith('출정에 사용할 거점 병기')) target.setColor('#929eac').setFontSize(compact ? 16 : 14);
  if (value === '출정 병기' || value === '전장 효과') target.setColor('#dde5ed');
  if (value.includes('재사용') || value.includes('직격 피해') || value.includes('받는 피해') || value.includes('보급 상한')) {
    fitTextToWidth(target, 355, compact ? 15 : 12);
  }
  if (value === '장착 완료') target.setColor('#e5d29a');
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const rewritten = rewriteBaseWeaponCopy(normalize(value));
    const target = original(x, y, rewritten, style);
    decorateText(target, rewritten);
    const originalSetText = target.setText.bind(target);
    target.setText = ((nextValue: string | string[]) => {
      const next = rewriteBaseWeaponCopy(normalize(nextValue));
      const result = originalSetText(next);
      decorateText(target, next);
      return result;
    }) as typeof target.setText;
    return target;
  }) as typeof scene.add.text;
  return () => { scene.add.text = original; };
}

function directText(container: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return container.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
}

function polishScene(scene: Phaser.Scene): void {
  const visit = (object: Phaser.GameObjects.GameObject): void => {
    if (object instanceof Phaser.GameObjects.Container) {
      const label = directText(object)?.text ?? '';
      const body = object.list.find((child): child is Phaser.GameObjects.Rectangle => child instanceof Phaser.GameObjects.Rectangle && child.width >= 300 && child.height >= 70);
      if (Math.abs(object.y - 462) <= 2 && body && body.width >= 1100) {
        body.setFillStyle(0x171f28, 0.88).setStrokeStyle(1, body.strokeColor || 0x687889, 0.16);
        object.setDepth(1);
      }
      if (object.y >= 190 && object.y <= 220 && body && body.width >= 300 && body.width <= 350) {
        body.setAlpha(label.includes('장착 중') ? 0.98 : 0.78);
        object.setDepth(label.includes('장착 중') ? 7 : 4);
      }
      if (label === '출정 병기로 장착') object.setDepth(9);
      if (label === '장착 완료') object.setDepth(8);
      object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
      return;
    }
    if (object instanceof Phaser.GameObjects.Text) {
      if (object.text.startsWith('일반전과 기록전에')) object.setAlpha(0.68);
      if (object.text === '사용 가능') object.setAlpha(0.86);
    }
  };
  scene.children.list.forEach(visit);
}

function drawArsenalGuides(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const compact = isCompactMobileViewport();
  const g = scene.add.graphics().setDepth(3);
  g.lineStyle(1, 0x5c6878, 0.28).lineBetween(54, compact ? 256 : 252, 1222, compact ? 256 : 252);
  g.lineStyle(1, 0x5e6d7e, 0.26).lineBetween(760, 316, 760, 620);
  g.lineStyle(3, 0xa88d55, 0.42).lineBetween(54, 136, 176, 136);
  return g;
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

/** Presentation-only arsenal hierarchy over the existing unlock/equip authority. */
export class BaseWeaponScene extends BaseBaseWeaponScene {
  override create(): void {
    const restoreText = installTextFactory(this);
    super.create();
    const carrier = this as unknown as RuntimeCarrier;
    const restoreRender = wrapAfter(carrier, 'renderWeapons', () => polishScene(this));
    const guides = drawArsenalGuides(this);
    polishScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreRender?.();
      restoreText();
      guides.destroy();
    });
  }
}
