import Phaser from 'phaser';
import { RecordHubScene as BaseRecordHubScene } from './record-hub-scene.ts';
import { RecordResultScene as BaseRecordResultScene } from './record-result-scene.ts';
import { fitTextToWidth } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

type RuntimeCarrier = Phaser.Scene & Record<string, unknown>;

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteRecordCopy(value: string): string {
  if (/HTTP_|revision|request_|account_/i.test(value)) return '기록 정보를 처리하지 못했습니다. 연결 상태를 확인해 주세요.';
  const direct: Readonly<Record<string, string>> = {
    '반복 파밍이 아니라 개인 최고 기록을 갱신하는 도전입니다.': '최고 기록과 다음 명예를 노리는 별도 도전 전선입니다.',
    '도전 선택': '기록전 선택',
    '내 기록': '최고 기록',
    '1× 고정 · 혼자 도전 · 소탕 없음': '1× 고정 · 단독 도전 · 소탕 없음',
    '기록 도전': '도전 시작',
    '기록 종료': '도전 종료',
    '이번 기록': '이번 도전',
    '정산': '기록 정산',
    '기록전으로': '기록전 선택',
    '다시 도전': '같은 기록전 재도전',
  };
  if (direct[value]) return direct[value]!;
  if (value === '다음 목표  한 분 더 버티기') return '다음 목표 · 한 분 더 버티기';
  if (value === '다음 목표  한 보스 더 돌파') return '다음 목표 · 한 보스 더 돌파';
  return value;
}

function decorateRecordText(target: Phaser.GameObjects.Text, value: string): void {
  const compact = isCompactMobileViewport();
  if (value === '기록전') target.setColor('#f1e5c7').setFontSize(compact ? 40 : 42);
  if (value.startsWith('최고 기록과 다음 명예')) target.setColor('#929eac').setFontSize(compact ? 16 : 14);
  if (value === '기록전 선택' || value === '최고 기록' || value === '기록 정산') target.setColor('#dce4ed');
  if (value.startsWith('최고 생존') || value.startsWith('최고 ') || value.startsWith('생존 ')) {
    target.setColor('#f0d88f');
    fitTextToWidth(target, 440, compact ? 18 : 14);
  }
  if (value.startsWith('다음 명예 ·') || value.startsWith('명예 달성 ·')) {
    target.setColor('#d9c287');
    fitTextToWidth(target, 430, compact ? 14 : 11);
  }
  if (value === '도전 종료' || value === '전 구간 격파') target.setColor(value === '전 구간 격파' ? '#f2d785' : '#eee3c8');
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const rewritten = rewriteRecordCopy(normalize(value));
    const target = original(x, y, rewritten, style);
    decorateRecordText(target, rewritten);
    const originalSetText = target.setText.bind(target);
    target.setText = ((nextValue: string | string[]) => {
      const next = rewriteRecordCopy(normalize(nextValue));
      const result = originalSetText(next);
      decorateRecordText(target, next);
      return result;
    }) as typeof target.setText;
    return target;
  }) as typeof scene.add.text;
  return () => { scene.add.text = original; };
}

function directText(container: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return container.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
}

function polishHub(scene: Phaser.Scene): void {
  const visit = (object: Phaser.GameObjects.GameObject): void => {
    if (object instanceof Phaser.GameObjects.Container) {
      const label = directText(object)?.text ?? '';
      const body = object.list.find((child): child is Phaser.GameObjects.Rectangle => child instanceof Phaser.GameObjects.Rectangle && child.width >= 500 && child.height >= 400);
      if (body) {
        body.setFillStyle(body.fillColor, 0.9).setStrokeStyle(1, body.strokeColor || 0x687889, 0.16);
        object.setDepth(1);
      }
      if (label === '도전 시작') object.setDepth(9);
      object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
      return;
    }
    if (object instanceof Phaser.GameObjects.Text) {
      if (object.text.includes('소탕 없음')) object.setAlpha(0.72);
      if (object.text.startsWith('보상 경계') || object.text.startsWith('보상 구간')) object.setAlpha(0.7);
    }
  };
  scene.children.list.forEach(visit);
}

function drawHubGuides(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(3);
  g.lineStyle(1, 0x596777, 0.26).lineBetween(54, 151, 1222, 151);
  g.lineStyle(1, 0x596777, 0.22).lineBetween(640, 196, 640, 660);
  g.lineStyle(3, 0x72899d, 0.42).lineBetween(54, 157, 178, 157);
  return g;
}

function polishResult(scene: Phaser.Scene): void {
  const visit = (object: Phaser.GameObjects.GameObject): void => {
    if (object instanceof Phaser.GameObjects.Container) {
      const label = directText(object)?.text ?? '';
      const body = object.list.find((child): child is Phaser.GameObjects.Rectangle => child instanceof Phaser.GameObjects.Rectangle && child.width >= 1000 && child.height >= 300);
      if (body) body.setFillStyle(0x171f28, 0.9).setStrokeStyle(1, body.strokeColor || 0x687889, 0.15);
      if (label === '같은 기록전 재도전') object.setDepth(9);
      if (label === '기록전 선택') object.setDepth(8);
      object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
      return;
    }
    if (object instanceof Phaser.GameObjects.Text) {
      if (object.text === '이번 도전') object.setAlpha(0.78);
      if (object.text === '기록 정산') object.setAlpha(0.88);
      if (object.text.startsWith('다음 목표 ·')) object.setAlpha(0.82);
      if (object.text.includes('계산 중') || object.text.includes('저장하는 중')) object.setAlpha(0.78);
    }
  };
  scene.children.list.forEach(visit);
}

function drawResultGuides(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const compact = isCompactMobileViewport();
  const g = scene.add.graphics().setDepth(3);
  g.lineStyle(1, 0x5d6b7a, 0.28).lineBetween(640, 198, 640, compact ? 520 : 508);
  g.lineStyle(1, 0x5d6b7a, 0.24).lineBetween(80, compact ? 558 : 550, 1200, compact ? 558 : 550);
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

/** Keeps record progression rules untouched while making the challenge choice read before its chrome. */
export class RecordHubScene extends BaseRecordHubScene {
  override create(): void {
    const restoreText = installTextFactory(this);
    super.create();
    const carrier = this as unknown as RuntimeCarrier;
    const restoreRender = wrapAfter(carrier, 'renderModes', () => polishHub(this));
    const guides = drawHubGuides(this);
    polishHub(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreRender?.();
      restoreText();
      guides.destroy();
    });
  }
}

/** Keeps trusted/local settlement authority intact while foregrounding score, improvement, and next action. */
export class RecordResultScene extends BaseRecordResultScene {
  override create(): void {
    const restoreText = installTextFactory(this);
    super.create();
    const guides = drawResultGuides(this);
    polishResult(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreText();
      guides.destroy();
    });
  }
}
