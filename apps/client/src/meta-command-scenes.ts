import Phaser from 'phaser';
import { CatalogScene as BaseCatalogScene } from './catalog-scene';
import { GrowthScene as BaseGrowthScene } from './growth-scene';
import { fitTextToWidth, setButtonState } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

type RuntimeCarrier = Phaser.Scene & Record<string, unknown>;

function visitContainers(object: Phaser.GameObjects.GameObject, out: Phaser.GameObjects.Container[]): void {
  if (object instanceof Phaser.GameObjects.Container) {
    if (object.getData('frontlineCommandButton')) out.push(object);
    object.list.forEach((child) => visitContainers(child as Phaser.GameObjects.GameObject, out));
  }
}

function commandButtons(scene: Phaser.Scene): Phaser.GameObjects.Container[] {
  const result: Phaser.GameObjects.Container[] = [];
  scene.children.list.forEach((child) => visitContainers(child, result));
  return result;
}

function buttonLabel(button: Phaser.GameObjects.Container): string {
  const text = button.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
  return text?.text ?? '';
}

function pageInfo(carrier: RuntimeCarrier): { page: number; count: number } {
  const rawPage = carrier.page;
  const page = typeof rawPage === 'number' && Number.isFinite(rawPage) ? Math.max(0, Math.trunc(rawPage)) : 0;
  const rawCount = carrier.pageCount;
  if (typeof rawCount === 'number' && Number.isFinite(rawCount)) {
    return { page, count: Math.max(1, Math.trunc(rawCount)) };
  }
  const getPageCount = carrier.getPageCount;
  if (typeof getPageCount === 'function') {
    const value = (getPageCount as () => unknown).call(carrier);
    if (typeof value === 'number' && Number.isFinite(value)) return { page, count: Math.max(1, Math.trunc(value)) };
  }
  return { page, count: 1 };
}

function syncPagination(scene: Phaser.Scene, carrier: RuntimeCarrier): void {
  const buttons = commandButtons(scene);
  const previous = buttons.find((button) => buttonLabel(button) === '◀ 이전');
  const next = buttons.find((button) => buttonLabel(button) === '다음 ▶');
  if (!previous || !next) return;

  const { page, count } = pageInfo(carrier);
  if (count <= 1) {
    setButtonState(previous, 'disabled', '현재 한 페이지만 있습니다.');
    setButtonState(next, 'disabled', '현재 한 페이지만 있습니다.');
    return;
  }
  setButtonState(previous, page <= 0 ? 'disabled' : 'default', page <= 0 ? '첫 번째 페이지입니다.' : undefined);
  setButtonState(next, page >= count - 1 ? 'disabled' : 'default', page >= count - 1 ? '마지막 페이지입니다.' : undefined);
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

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function compactKoreanAmount(value: number): string {
  const trim = (amount: number): string => {
    const digits = amount >= 10 ? 1 : 2;
    return amount.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  };
  if (Math.abs(value) >= 100_000_000) return `${trim(value / 100_000_000)}억`;
  if (Math.abs(value) >= 10_000) return `${trim(value / 10_000)}만`;
  return value.toLocaleString('ko-KR');
}

function compactInlineGold(value: string): string {
  return value.replace(/G\s?([\d,]+)/g, (match, raw: string) => {
    const numeric = Number(raw.replaceAll(',', ''));
    return Number.isFinite(numeric) ? `G${compactKoreanAmount(numeric)}` : match;
  });
}

function rewriteGrowthCopy(value: string): string {
  if (value === '성 장') return '성장';
  if (/HTTP_|state hash|revision|request_|account_/i.test(value)) return '성장 정보를 불러오지 못했습니다. 다시 시도해 주세요.';
  if (value === '전투 경험을 훈련 기록으로 정리하고, 진화 계보를 따라 다음 형태를 개방한다.') {
    return '동료를 강화하고, 진화 형태를 열어 전투 역할을 바꿉니다.';
  }
  if (value === '훈련 명부') return '동료 선택';
  if (value === '훈련 기록 · 현재 전투 성능') return '현재 동료 · 전투 성능';
  if (value === '기본 훈련 · 초월 강화') return '기본 강화 · 초월';
  if (value === '진화 계보 · 형태를 선택하거나 다음 단계를 개방') return '진화 계보 · 형태 선택 / 개방';

  const match = /^(G|혼|조각|핵심|왕관)\s+([\d,]+)$/.exec(value);
  if (match) {
    const numeric = Number(match[2]!.replaceAll(',', ''));
    if (Number.isFinite(numeric)) return `${match[1]} ${compactKoreanAmount(numeric)}`;
  }
  return compactInlineGold(value);
}

function decorateGrowthText(target: Phaser.GameObjects.Text, value: string): void {
  const compact = isCompactMobileViewport();
  if (value === '성장') target.setPosition(52, compact ? 22 : 20).setFontSize(compact ? 40 : 42);
  if (value.startsWith('동료를 강화하고')) target.setY(compact ? 80 : 78).setFontSize(compact ? 17 : 14).setColor('#8f9aa8');
  if (value === '동료 선택' || value === '현재 동료 · 전투 성능' || value === '기본 강화 · 초월' || value === '진화 계보 · 형태 선택 / 개방') {
    target.setColor('#dfe6ef');
  }
  if (value.startsWith('HP ') && value.includes('재생산')) fitTextToWidth(target, 520, 11);
  if (value.startsWith('이동 ') && value.includes('공격 범위')) fitTextToWidth(target, 520, 10);
  if (value.includes(' · Lv') && value.includes(' +')) fitTextToWidth(target, compact ? 280 : 250, compact ? 14 : 11);
  if (value.startsWith('Lv +') || value.startsWith('+레벨 +')) fitTextToWidth(target, 176, compact ? 14 : 11);
  if (/^\d+ \/ \d+ · 보유 /.test(value)) target.setColor('#8593a5');
}

function installGrowthTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const rewritten = rewriteGrowthCopy(normalize(value));
    const target = original(x, y, rewritten, style);
    decorateGrowthText(target, rewritten);
    const originalSetText = target.setText.bind(target);
    target.setText = ((nextValue: string | string[]) => {
      const next = rewriteGrowthCopy(normalize(nextValue));
      const result = originalSetText(next);
      decorateGrowthText(target, next);
      return result;
    }) as typeof target.setText;
    return target;
  }) as typeof scene.add.text;
  return () => { scene.add.text = original; };
}

function directText(container: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return container.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
}

function polishGrowthObject(object: Phaser.GameObjects.GameObject): void {
  if (object instanceof Phaser.GameObjects.Container) {
    const label = directText(object)?.text ?? '';
    if (label === '동료 선택' || label === '현재 동료 · 전투 성능' || label === '기본 강화 · 초월' || label === '진화 계보 · 형태 선택 / 개방') {
      object.setDepth(4);
    }

    if (Math.abs(object.x - 246) <= 1 && Math.abs(object.y - 384) <= 1) {
      const body = object.list.find((child): child is Phaser.GameObjects.Rectangle => child instanceof Phaser.GameObjects.Rectangle && child.width >= 380);
      body?.setFillStyle(0x171f29, 0.95).setStrokeStyle(1, 0x58718d, 0.34);
    }
    if (Math.abs(object.x - 850) <= 1 && Math.abs(object.y - 242) <= 1) {
      const body = object.list.find((child): child is Phaser.GameObjects.Rectangle => child instanceof Phaser.GameObjects.Rectangle && child.width >= 720);
      body?.setFillStyle(0x1a222d, 0.96).setStrokeStyle(1, 0x92784d, 0.38);
    }
  }

  if (object instanceof Phaser.GameObjects.Sprite && Math.abs(object.x - 548) <= 2 && Math.abs(object.y - 232) <= 2) {
    object.setPosition(556, 234).setScale(object.scaleX * 1.1, object.scaleY * 1.1);
  }
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

function installGrowthPolish(scene: Phaser.Scene): () => void {
  const polished = new WeakSet<Phaser.GameObjects.GameObject>();
  const apply = (): void => {
    visitGameObjects(scene.children.list, (object) => {
      if (polished.has(object)) return;
      polished.add(object);
      polishGrowthObject(object);
    });
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, apply);
  apply();
  return () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, apply);
}

function drawGrowthGuides(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const guides = scene.add.graphics().setDepth(3);
  guides.lineStyle(1, 0x52677e, 0.28).lineBetween(448, 126, 448, 660);
  guides.lineStyle(1, 0x536172, 0.3).lineBetween(52, 672, 1228, 672);
  return guides;
}

export class GrowthScene extends BaseGrowthScene {
  override create(): void {
    const restoreTextFactory = installGrowthTextFactory(this);
    super.create();
    const carrier = this as unknown as RuntimeCarrier;
    const restoreList = wrapAfter(carrier, 'renderList', () => syncPagination(this, carrier));
    const restorePolish = installGrowthPolish(this);
    const guides = drawGrowthGuides(this);
    syncPagination(this, carrier);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreList?.();
      restorePolish();
      restoreTextFactory();
      guides.destroy();
    });
  }
}

export class CatalogScene extends BaseCatalogScene {
  override create(): void {
    super.create();
    const carrier = this as unknown as RuntimeCarrier;
    const restore = wrapAfter(carrier, 'render', () => syncPagination(this, carrier));
    syncPagination(this, carrier);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => restore?.());
  }
}
