import Phaser from 'phaser';
import { CatalogScene as BaseCatalogScene } from './catalog-scene';
import { fitTextToWidth, setButtonState } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

type RuntimeCarrier = Phaser.Scene & Record<string, unknown>;

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteCatalogCopy(value: string): string {
  if (/HTTP_|state hash|revision|request_|account_/i.test(value)) {
    return '기록을 불러오지 못했습니다. 연결 상태를 확인해 주세요.';
  }
  if (value === '도 감') return '전선 기록고';
  if (value === '획득한 동료와 실제로 조우한 적, 확보한 전과만 기록된다.') {
    return '합류·조우·직접 클리어로 확보한 기록만 보관됩니다.';
  }
  const allyTab = /^동료 (\d+)종$/.exec(value);
  if (allyTab) return `동료 · ${allyTab[1]}`;
  const enemyTab = /^적 (\d+)종$/.exec(value);
  if (enemyTab) return `적 · ${enemyTab[1]}`;
  const rewardTab = /^영구 보상 (\d+)개$/.exec(value);
  if (rewardTab) return `전과 · ${rewardTab[1]}`;
  const specialTab = /^특수 기록 (\d+)개$/.exec(value);
  if (specialTab) return `특수 · ${specialTab[1]}`;
  if (value.startsWith('동료 명부 · ')) return value.replace('동료 명부', '동료 기록');
  if (value.startsWith('영구 전과 · ')) return value.replace('영구 전과', '전과 기록');
  if (value.startsWith('특수 작전 기록 · ')) return value.replace('특수 작전 기록', '특수 기록');
  if (value.startsWith('영구 보상 #')) return value.replace('영구 보상 #', '전과 #');
  if (value === '획득 후 정보 공개') return '합류 시 정보 공개';
  if (value === '전투에서 조우하면 정보 공개') return '조우 시 정보 공개';
  if (value === '특수 작전 클리어 기록') return '클리어 기록';
  if (value === '메인 영구 성장과 별도 기록') return '영구 성장과 별도 기록';
  if (value === '첫 직접 클리어 시 확정') return '직접 클리어 시 획득';
  return value;
}

function decorateCatalogText(
  target: Phaser.GameObjects.Text,
  value: string,
  x: number,
  y: number,
): void {
  const compact = isCompactMobileViewport();
  if (value === '전선 기록고') {
    target.setPosition(52, compact ? 24 : 26).setFontSize(compact ? 38 : 40);
  }
  if (value.startsWith('합류·조우·직접 클리어')) {
    target.setPosition(54, compact ? 78 : 80).setFontSize(compact ? 16 : 14).setColor('#8f9aa8');
  }
  if (/^(동료|적|전과|특수) · \d+$/.test(value)) {
    fitTextToWidth(target, 164, compact ? 14 : 12);
  }
  if (/^(동료 기록|조우 기록|전과 기록|특수 기록) · \d+ \/ \d+$/.test(value)) {
    target.setColor('#8f9daf').setFontSize(compact ? 18 : 15);
  }
  if (value === '미획득' || value === '미발견') {
    target.setColor('#747f8d').setFontSize(compact ? 19 : 14);
  }
  if (value === '합류 시 정보 공개' || value === '조우 시 정보 공개') {
    target.setColor('#66717f');
  }
  if (value.startsWith('HP ') || value.startsWith('처치 보급 +') || value.includes(' 보급')) {
    fitTextToWidth(target, 184, compact ? 14 : 11);
  }
  if ((y >= 330 && y <= 575) && x > 24 && target.width > 188) {
    fitTextToWidth(target, 188, compact ? 14 : 11);
  }
}

function installCatalogTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const rewritten = rewriteCatalogCopy(normalize(value));
    const target = original(x, y, rewritten, style);
    decorateCatalogText(target, rewritten, x, y);
    const originalSetText = target.setText.bind(target);
    target.setText = ((nextValue: string | string[]) => {
      const next = rewriteCatalogCopy(normalize(nextValue));
      const result = originalSetText(next);
      decorateCatalogText(target, next, target.x, target.y);
      return result;
    }) as typeof target.setText;
    return target;
  }) as typeof scene.add.text;
  return () => { scene.add.text = original; };
}

function visitContainers(object: Phaser.GameObjects.GameObject, out: Phaser.GameObjects.Container[]): void {
  if (!(object instanceof Phaser.GameObjects.Container)) return;
  if (object.getData('frontlineCommandButton')) out.push(object);
  object.list.forEach((child) => visitContainers(child as Phaser.GameObjects.GameObject, out));
}

function commandButtons(scene: Phaser.Scene): Phaser.GameObjects.Container[] {
  const result: Phaser.GameObjects.Container[] = [];
  scene.children.list.forEach((child) => visitContainers(child, result));
  return result;
}

function buttonLabel(button: Phaser.GameObjects.Container): string {
  const label = button.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
  return label?.text ?? '';
}

function syncPagination(scene: Phaser.Scene, carrier: RuntimeCarrier): void {
  const previous = commandButtons(scene).find((button) => buttonLabel(button) === '◀ 이전');
  const next = commandButtons(scene).find((button) => buttonLabel(button) === '다음 ▶');
  if (!previous || !next) return;

  const rawPage = carrier.page;
  const page = typeof rawPage === 'number' && Number.isFinite(rawPage) ? Math.max(0, Math.trunc(rawPage)) : 0;
  const getPageCount = carrier.getPageCount;
  const rawCount = typeof getPageCount === 'function' ? (getPageCount as () => unknown).call(carrier) : 1;
  const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? Math.max(1, Math.trunc(rawCount)) : 1;

  setButtonState(previous, page <= 0 ? 'disabled' : 'default', page <= 0 ? '첫 번째 기록 묶음입니다.' : undefined);
  setButtonState(next, page >= count - 1 ? 'disabled' : 'default', page >= count - 1 ? '마지막 기록 묶음입니다.' : undefined);
}

function visitObjects(
  objects: readonly Phaser.GameObjects.GameObject[],
  visitor: (object: Phaser.GameObjects.GameObject) => void,
): void {
  objects.forEach((object) => {
    visitor(object);
    if (object instanceof Phaser.GameObjects.Container) visitObjects(object.list, visitor);
  });
}

function polishCatalogScene(scene: Phaser.Scene): void {
  visitObjects(scene.children.list, (object) => {
    if (object instanceof Phaser.GameObjects.Container && Math.abs(object.y - 398) <= 1) {
      const body = object.list.find((child): child is Phaser.GameObjects.Rectangle => (
        child instanceof Phaser.GameObjects.Rectangle && child.width === 220 && child.height === 430 && Math.abs(child.x) < 1
      ));
      const spine = object.list.find((child): child is Phaser.GameObjects.Rectangle => (
        child instanceof Phaser.GameObjects.Rectangle && child.width <= 6 && child.height > 380
      ));
      const rule = object.list.find((child): child is Phaser.GameObjects.Rectangle => (
        child instanceof Phaser.GameObjects.Rectangle && child.width > 190 && child.height <= 3
      ));
      if (body) body.setStrokeStyle(1, spine?.fillColor ?? 0x657086, body.fillAlpha > 0.9 ? 0.34 : 0.16);
      if (spine) spine.setDisplaySize(3, 408).setAlpha(body && body.fillAlpha > 0.9 ? 0.9 : 0.42);
      if (rule) rule.setAlpha(body && body.fillAlpha > 0.9 ? 0.58 : 0.24);
    }

    if (object instanceof Phaser.GameObjects.Sprite && (Math.abs(object.y - 270) <= 2 || Math.abs(object.y - 285) <= 2)) {
      object.setScale(object.scaleX * 1.04, object.scaleY * 1.04);
    }
  });
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

/** Presentation layer for the field archive. Catalog rules and discovery gates remain in the base scene. */
export class CatalogScene extends BaseCatalogScene {
  override create(): void {
    const restoreTextFactory = installCatalogTextFactory(this);
    super.create();
    const carrier = this as unknown as RuntimeCarrier;
    const restoreRender = wrapAfter(carrier, 'render', () => {
      syncPagination(this, carrier);
      polishCatalogScene(this);
    });
    syncPagination(this, carrier);
    polishCatalogScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreRender?.();
      restoreTextFactory();
    });
  }
}
