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
  if (value === '기존 자동 편성을 불러왔습니다. 저장하면 수동 편성이 권위가 됩니다.') {
    return '자동 편성을 불러왔습니다. 저장하면 현재 순서를 사용합니다.';
  }
  if (value.endsWith(' · 기기 UI 선호에 저장')) return value.replace(' · 기기 UI 선호에 저장', '');
  if (value.includes('선택된 순서가 1~0 소환 순서입니다.')) return '편성이 변경되었습니다. 위 출격 순서대로 전투에 투입됩니다.';
  return value;
}

function isStatusCopy(value: string): boolean {
  return /편성|저장|계정|오프라인|온라인|즐겨찾기|슬롯|자동|전투에는 반영|불러왔습니다|불러오지 못했습니다/.test(value);
}

function decorateText(target: Phaser.GameObjects.Text, value: string): void {
  const compact = isCompactMobileViewport();

  if (value === '출격 편성') {
    target.setPosition(52, compact ? 18 : 16).setFontSize(compact ? 36 : 38).setColor('#f5e7c7');
  }
  if (value.startsWith('출격 ') && value.includes('· 보유 ')) {
    target.setY(compact ? 70 : 68).setFontSize(compact ? 16 : 14).setColor('#cbd5e2');
  }
  if (value.startsWith('10명의 출격 순서를') || value.startsWith('출격 순서를 정하고')) {
    target.setY(compact ? 94 : 92).setFontSize(compact ? 15 : 12).setColor('#8793a3');
    target.setWordWrapWidth(860);
  }
  if (value.startsWith('필터 · ')) {
    target.setFontSize(compact ? 14 : 11).setColor('#8ca0b4');
    fitTextToWidth(target, 1080, compact ? 12 : 10);
  }
  if (/^(빠른 분류|역할|공격|대항|비용|사거리|성장|검색) · /.test(value)) {
    target.setFontSize(compact ? 15 : 12);
  }
  if (value.includes(' · Lv') && !value.startsWith('출격 ')) {
    target.setColor('#91b2cb');
    fitTextToWidth(target, compact ? 170 : 124, compact ? 12 : 10);
  }
  if (value.startsWith('◆')) {
    fitTextToWidth(target, compact ? 168 : 122, compact ? 12 : 10);
  }
  if (/^출격 [1-90]$/.test(value)) target.setColor('#f0d47a');
  if (/^\d+ \/ \d+ · 표시 /.test(value)) {
    target.setFontSize(compact ? 16 : 13).setColor('#8f9daf');
  }
  if (isStatusCopy(value)) {
    target.setFontSize(compact ? 16 : 13).setWordWrapWidth(880);
  }
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

function directText(container: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return container.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
}

function polishContainer(container: Phaser.GameObjects.Container): void {
  const compact = isCompactMobileViewport();
  const label = directText(container)?.text ?? '';

  if (label === '출격 부대 · 1 → 0 순서') {
    container.setY(116).setDepth(4);
    return;
  }
  if (label === '보유 명부 · 전선에 올릴 동료 선택') {
    container.setY(compact ? 342 : 300).setDepth(4);
    return;
  }
  if (label === '지휘소') {
    container.setDepth(8);
    return;
  }
  if (label === '편성 저장' || label === '자동 편성' || label === '◀ 이전' || label === '다음 ▶') {
    container.setDepth(8);
  }
}

function polishRectangle(rectangle: Phaser.GameObjects.Rectangle): void {
  const compact = isCompactMobileViewport();
  const near = (a: number, b: number, tolerance = 1): boolean => Math.abs(a - b) <= tolerance;

  if (near(rectangle.x, 640) && near(rectangle.width, 1190, 1) && near(rectangle.y, 164)) {
    rectangle.setFillStyle(0x111821, 0.97).setStrokeStyle(1, 0x8b7445, 0.58);
    return;
  }
  if (near(rectangle.x, 640) && near(rectangle.width, 1190, 1) && (near(rectangle.y, 250) || near(rectangle.y, 272))) {
    rectangle.setFillStyle(0x101720, 0.94).setStrokeStyle(1, 0x49627b, 0.48);
    return;
  }

  const deckHeight = compact ? 76 : 68;
  if (near(rectangle.y, 160) && rectangle.width > 90 && rectangle.width < 130 && near(rectangle.height, deckHeight)) {
    if (rectangle.fillColor === 0x283342) rectangle.setFillStyle(0x202b38, 1);
    else if (rectangle.fillColor === 0x181e27) rectangle.setFillStyle(0x111820, 1);
    return;
  }

  const isRosterCard = (near(rectangle.width, 222) && near(rectangle.height, 144))
    || (near(rectangle.width, 280) && near(rectangle.height, 132));
  if (isRosterCard) {
    if (rectangle.fillColor === 0x343329) rectangle.setFillStyle(0x2b2a22, 0.99);
    else rectangle.setFillStyle(0x1b2430, 0.99);
  }
}

function polishSprite(sprite: Phaser.GameObjects.Sprite): void {
  const compact = isCompactMobileViewport();
  const portraitRows = compact ? [408, 544] : [388, 536];
  if (!portraitRows.some((row) => Math.abs(sprite.y - row) <= 2)) return;
  sprite.setPosition(sprite.x - 2, sprite.y + 2);
  sprite.setScale(sprite.scaleX * 1.08, sprite.scaleY * 1.08);
}

function visitGameObjects(
  objects: readonly Phaser.GameObjects.GameObject[],
  visitor: (object: Phaser.GameObjects.GameObject) => void,
): void {
  objects.forEach((object) => {
    visitor(object);
    if (object instanceof Phaser.GameObjects.Container) visitGameObjects(object.list, visitor);
  });
}

function installDynamicPolish(scene: Phaser.Scene): () => void {
  const polished = new WeakSet<Phaser.GameObjects.GameObject>();
  const apply = (): void => {
    visitGameObjects(scene.children.list, (object) => {
      if (polished.has(object)) return;
      polished.add(object);
      if (object instanceof Phaser.GameObjects.Container) polishContainer(object);
      else if (object instanceof Phaser.GameObjects.Rectangle) polishRectangle(object);
      else if (object instanceof Phaser.GameObjects.Sprite) polishSprite(object);
    });
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, apply);
  apply();
  return () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, apply);
}

function drawHierarchyGuides(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const guides = scene.add.graphics().setDepth(3);
  guides.lineStyle(1, 0xb69a56, 0.28).lineBetween(52, 210, 1228, 210);
  guides.fillStyle(0xb69a56, 0.62).fillTriangle(1217, 206, 1228, 210, 1217, 214);
  guides.lineStyle(1, 0x52667b, 0.3).lineBetween(52, 660, 1228, 660);
  return guides;
}

/** Keeps deck rules intact while making formation order the dominant gameplay-meta surface. */
export class DeckScene extends BaseDeckScene {
  override create(): void {
    const restoreTextFactory = installTextFactory(this);
    super.create();
    const restoreDynamicPolish = installDynamicPolish(this);
    const guides = drawHierarchyGuides(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreDynamicPolish();
      restoreTextFactory();
      guides.destroy();
    });
  }
}
