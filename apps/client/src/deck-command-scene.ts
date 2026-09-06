import Phaser from 'phaser';
import { DeckScene as BaseDeckScene } from './deck-scene.ts';
import { fitTextToWidth } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteDeckCopy(value: string): string {
  if (/HTTP_|state hash|revision|request_|account_/i.test(value)) {
    return '편성 정보를 불러오지 못했습니다. 연결 상태를 확인해 주세요.';
  }
  if (value === '출격 열 · 왼쪽부터 1 → 0 소환 순서') return '출격 부대 · 1 → 0 순서';
  if (value.includes('보유 캐릭터만 표시 · 드래그로 1~0 슬롯 배치')) {
    return '10명의 출격 순서를 정하고, 아래 명부에서 교체할 동료를 고르세요.';
  }
  if (value.includes('탭 추가·제외 · 길게 끌어 슬롯 배치')) {
    return '출격 순서를 정하고, 아래 명부에서 교체할 동료를 고르세요.';
  }
  if (/^출격 열 \d+\/10 · 보유 \d+명 · 현재 명부 \d+명$/.test(value)) {
    return value.replace(/^출격 열 /, '출격 ').replace('현재 명부', '표시');
  }
  if (value.startsWith('명부 조건 · ')) return value.replace('명부 조건 · ', '필터 · ');
  if (value.includes('탭 추가 · 드래그로 슬롯 배치') || value.includes('탭 제외 · 드래그로 순서 교환')) return '';
  return value;
}

function decorateText(target: Phaser.GameObjects.Text, value: string): void {
  const compact = isCompactMobileViewport();
  if (value === '출격 편성') target.setFontSize(compact ? 36 : 38);
  if (value.startsWith('출격 ') && value.includes('· 보유 ')) target.setFontSize(compact ? 16 : 14);
  if (value.startsWith('10명의 출격 순서를') || value.startsWith('출격 순서를 정하고')) {
    target.setFontSize(compact ? 15 : 12).setColor('#8793a3');
    target.setWordWrapWidth(880);
  }
  if (value.startsWith('필터 · ')) {
    target.setFontSize(compact ? 14 : 11).setColor('#8ca0b4');
    fitTextToWidth(target, 1080, compact ? 12 : 10);
  }
  if (value.includes(' · Lv') && !value.startsWith('출격 ')) fitTextToWidth(target, compact ? 170 : 124, compact ? 12 : 10);
  if (value === '') target.setVisible(false);
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const rewritten = rewriteDeckCopy(normalize(value));
    const target = original(x, y, rewritten, style);
    decorateText(target, rewritten);
    const originalSetText = target.setText.bind(target);
    target.setText = ((nextValue: string | string[]) => {
      const next = rewriteDeckCopy(normalize(nextValue));
      const result = originalSetText(next);
      decorateText(target, next);
      return result;
    }) as typeof target.setText;
    return target;
  }) as typeof scene.add.text;
  return () => { scene.add.text = original; };
}

function moveSortieHeading(scene: Phaser.Scene): void {
  scene.children.list.forEach((object) => {
    if (!(object instanceof Phaser.GameObjects.Container)) return;
    const label = object.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text && child.text === '출격 부대 · 1 → 0 순서');
    if (label) object.setY(118);
  });
}

/** Keeps deck rules intact while tightening player-facing density and typography. */
export class DeckScene extends BaseDeckScene {
  override create(): void {
    const restoreTextFactory = installTextFactory(this);
    super.create();
    moveSortieHeading(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, restoreTextFactory);
  }
}
