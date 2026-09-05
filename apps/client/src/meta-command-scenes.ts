import Phaser from 'phaser';
import { CatalogScene as BaseCatalogScene } from './catalog-scene';
import { GrowthScene as BaseGrowthScene } from './growth-scene';
import { setButtonState } from './scene-ui';

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

export class GrowthScene extends BaseGrowthScene {
  override create(): void {
    super.create();
    const carrier = this as unknown as RuntimeCarrier;
    const restore = wrapAfter(carrier, 'renderList', () => syncPagination(this, carrier));
    syncPagination(this, carrier);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => restore?.());
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
