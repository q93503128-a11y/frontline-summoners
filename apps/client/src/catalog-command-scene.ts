import Phaser from 'phaser';
import { ALL_PLAYER_SLOTS, ENEMIES, SPECIAL_STAGES, STAGES } from './prototype';
import { CatalogScene as BaseCatalogScene } from './catalog-scene';
import { getOwnedCharacterIds, type GuestProgress } from './save';
import { fitTextToWidth, setButtonState } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

type CatalogMode = 'ALLIES' | 'ENEMIES' | 'REWARDS' | 'SPECIAL';
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
    return '합류한 동료, 조우한 적, 직접 확보한 전과만 기록됩니다.';
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
    target.setPosition(52, compact ? 24 : 26).setFontSize(compact ? 38 : 40).setColor('#f2e6c8');
  }
  if (value.startsWith('합류한 동료, 조우한 적')) {
    target.setPosition(54, compact ? 78 : 80).setFontSize(compact ? 16 : 14).setColor('#8f9aa8');
  }
  if (/^(동료|적|전과|특수) · \d+$/.test(value)) {
    target.setColor('#d8e0e8');
    fitTextToWidth(target, 164, compact ? 14 : 12);
  }
  if (/^(동료 기록|조우 기록|전과 기록|특수 기록) · \d+ \/ \d+/.test(value)) {
    target.setColor('#9aa8b9').setFontSize(compact ? 18 : 15);
  }
  if (value === '미획득' || value === '미발견' || value === '미클리어') {
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

function pageState(carrier: RuntimeCarrier): { readonly page: number; readonly count: number } {
  const rawPage = carrier.page;
  const page = typeof rawPage === 'number' && Number.isFinite(rawPage) ? Math.max(0, Math.trunc(rawPage)) : 0;
  const getPageCount = carrier.getPageCount;
  const rawCount = typeof getPageCount === 'function' ? (getPageCount as () => unknown).call(carrier) : 1;
  const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? Math.max(1, Math.trunc(rawCount)) : 1;
  return { page, count };
}

function syncPagination(scene: Phaser.Scene, carrier: RuntimeCarrier): void {
  const previous = commandButtons(scene).find((button) => buttonLabel(button) === '◀ 이전');
  const next = commandButtons(scene).find((button) => buttonLabel(button) === '다음 ▶');
  if (!previous || !next) return;
  const { page, count } = pageState(carrier);

  setButtonState(previous, page <= 0 ? 'disabled' : 'default', page <= 0 ? '첫 번째 기록 묶음입니다.' : undefined);
  setButtonState(next, page >= count - 1 ? 'disabled' : 'default', page >= count - 1 ? '마지막 기록 묶음입니다.' : undefined);
}

function catalogCompletion(carrier: RuntimeCarrier): { readonly current: number; readonly total: number; readonly noun: string } {
  const progress = carrier.progress as GuestProgress | undefined;
  const mode = carrier.mode as CatalogMode | undefined;
  if (!progress || mode === undefined) return { current: 0, total: 1, noun: '기록' };
  if (mode === 'ALLIES') return { current: getOwnedCharacterIds(progress).length, total: ALL_PLAYER_SLOTS.length, noun: '합류' };
  if (mode === 'ENEMIES') return { current: new Set(progress.discoveredEnemyIds ?? []).size, total: ENEMIES.length, noun: '조우' };
  if (mode === 'REWARDS') return { current: new Set(progress.permanentRewardIds).size, total: STAGES.length, noun: '확보' };
  return { current: new Set(progress.specialClearedStageIds).size, total: SPECIAL_STAGES.length, noun: '완료' };
}

function updateArchiveProgress(scene: Phaser.Scene, carrier: RuntimeCarrier, graphics: Phaser.GameObjects.Graphics): void {
  const { current, total, noun } = catalogCompletion(carrier);
  const ratio = Phaser.Math.Clamp(total <= 0 ? 0 : current / total, 0, 1);
  const compact = isCompactMobileViewport();
  const pageText = carrier.pageText;
  if (pageText instanceof Phaser.GameObjects.Text) {
    const base = pageText.text.replace(/ · (합류|조우|확보|완료) \d+\/\d+$/, '');
    pageText.setText(`${base} · ${noun} ${current}/${total}`);
  }

  graphics.clear();
  const x1 = compact ? 260 : 300;
  const x2 = compact ? 1020 : 980;
  const y = compact ? 626 : 626;
  graphics.lineStyle(compact ? 5 : 4, 0x394552, 0.8).lineBetween(x1, y, x2, y);
  graphics.lineStyle(compact ? 5 : 4, 0x8fa6ba, 0.92).lineBetween(x1, y, x1 + (x2 - x1) * ratio, y);
  graphics.lineStyle(1, 0x596676, 0.24).lineBetween(52, compact ? 184 : 171, 1228, compact ? 184 : 171);
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
      const shadow = object.list.find((child): child is Phaser.GameObjects.Rectangle => (
        child instanceof Phaser.GameObjects.Rectangle && Math.abs(child.x - 4) <= 1 && Math.abs(child.y - 5) <= 1
      ));
      const active = !!body && body.fillAlpha > 0.9;
      if (body) {
        body.setFillStyle(body.fillColor, active ? 0.93 : 0.56);
        body.setStrokeStyle(1, spine?.fillColor ?? 0x657086, active ? 0.25 : 0.08);
      }
      if (spine) spine.setDisplaySize(active ? 4 : 3, 408).setAlpha(active ? 0.94 : 0.34);
      if (rule) rule.setDisplaySize(190, 1).setAlpha(active ? 0.42 : 0.12);
      if (shadow) shadow.setAlpha(active ? 0.28 : 0.12);
      object.setDepth(active ? 3 : 1);
    }

    if (object instanceof Phaser.GameObjects.Sprite && (Math.abs(object.y - 270) <= 2 || Math.abs(object.y - 285) <= 2)) {
      object.setY(object.y - 5);
      object.setScale(object.scaleX * 1.08, object.scaleY * 1.08);
      object.setDepth(5);
    }

    if (object instanceof Phaser.GameObjects.Text) {
      if (object.y >= 430 && object.y <= 560 && object.fontSize <= 15) object.setAlpha(0.76);
      if (object.text === '미획득' || object.text === '미발견' || object.text === '미클리어') object.setAlpha(0.72);
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
    const progressGuide = this.add.graphics().setDepth(7);
    const polish = (): void => {
      syncPagination(this, carrier);
      polishCatalogScene(this);
      updateArchiveProgress(this, carrier, progressGuide);
    };
    const restoreRender = wrapAfter(carrier, 'render', polish);
    polish();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreRender?.();
      restoreTextFactory();
      progressGuide.destroy();
    });
  }
}
