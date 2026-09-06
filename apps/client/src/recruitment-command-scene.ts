import Phaser from 'phaser';
import { RecruitmentScene as BaseRecruitmentScene } from './recruitment-scene.ts';
import { fitTextToWidth } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function rewriteRecruitmentCopy(value: string): string {
  if (/HTTP_|state hash|revision|request_|account_/i.test(value)) return '모집 정보를 불러오지 못했습니다. 연결 상태를 확인해 주세요.';
  if (value === '모집 공고실') return '전선 모집';
  if (value === '전선 인력과 · 봉인된 공고를 골라 소환 명령을 발행한다.') return '시리즈와 공개 확률을 확인하고, 필요한 만큼 모집합니다.';
  if (value === '각 모집은 독립 추첨') return '독립 추첨';
  if (value === '보장 횟수 없음') return '보장 없음';
  if (value === '대표 인장') return '대표 SS';
  if (value.startsWith('공통 C ')) return value.replace(/^공통 /, '공통 풀 · ').replaceAll(' · ', ' / ');
  if (value.startsWith('전용 S ')) return value.replace(/^전용 /, '시리즈 전용 · ').replace(' · ', ' / ');
  if (value === '10회 추가 할인 없음') return '10회 할인 없음';
  if (value === '최소 희귀도 보장 없음') return '최소 희귀도 보장 없음';
  if (value === '모집 장부') return '현재 기록';
  if (value === '중복 처리') return '중복 방침';
  if (value === '분해 재화는 성장 화면에서 원하는 동료의 +레벨에 사용할 수 있습니다.') return '분해한 혼은 성장에서 원하는 동료의 +레벨에 사용합니다.';
  if (value === '최종 모집 명령') return '모집';
  if (value === '모집 준비 완료 · 확률과 비용을 확인한 뒤 모집 명령을 선택하세요.') return '준비 완료 · 확률, 비용, 중복 방침을 확인하세요.';
  if (value.startsWith('모집 결정 ')) return value.replace(/^모집 결정 /, '결정 ');
  if (value.startsWith('혼의 파편 ')) return value.replace(/^혼의 파편 /, '혼 ');
  if (value.startsWith('획득 ') && value.endsWith('종')) return value.replace(/^획득 /, '시리즈 보유 ');
  if (value.includes('영구 저장 실패 · 현재 실행에서는 결과 유지')) return value.replace('영구 저장 실패 · 현재 실행에서는 결과 유지', '저장 실패 · 이번 결과는 현재 실행에서 유지');
  return value;
}

function decorateRecruitmentText(target: Phaser.GameObjects.Text, value: string): void {
  const compact = isCompactMobileViewport();
  if (value === '전선 모집') target.setPosition(52, compact ? 20 : 18).setFontSize(compact ? 40 : 42).setColor('#f5e7c7');
  if (value.startsWith('시리즈와 공개 확률을')) target.setY(compact ? 74 : 72).setFontSize(compact ? 16 : 13).setColor('#909baa');
  if (value === '시리즈 선택' || value === '현재 기록' || value === '모집') target.setColor('#e2e7ed');
  if (value === '공개 확률') target.setColor('#f0e4ca');
  if (value === '대표 SS') target.setColor('#bda7ca');
  if (value.startsWith('공통 풀 ·') || value.startsWith('시리즈 전용 ·')) {
    target.setColor(value.startsWith('시리즈') ? '#cdb2dc' : '#9ea9b7');
    fitTextToWidth(target, 400, compact ? 13 : 11);
  }
  if (value === '10회 할인 없음' || value === '최소 희귀도 보장 없음') target.setFontSize(compact ? 14 : 11).setColor('#8f9aaa');
  if (value.startsWith('+1 우선 ·') || value.startsWith('분해 우선 ·')) fitTextToWidth(target, 214, compact ? 13 : 10);
  if (value.startsWith('분해한 혼은')) target.setColor('#8995a4').setWordWrapWidth(216);
  if (/^(결정|혼) [\d,]+/.test(value)) target.setColor('#e3e7ed');
  if (/^\d+회 · 결정 /.test(value)) fitTextToWidth(target, 245, compact ? 14 : 11);
  if (/^(합류 통지서|10건 합류 통지서)$/.test(value)) target.setColor('#f3e5c5');
  if (value.startsWith('시리즈 보유 ')) target.setColor('#c6d0dd');
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const rewritten = rewriteRecruitmentCopy(normalize(value));
    const target = original(x, y, rewritten, style);
    decorateRecruitmentText(target, rewritten);
    const originalSetText = target.setText.bind(target);
    target.setText = ((nextValue: string | string[]) => {
      const next = rewriteRecruitmentCopy(normalize(nextValue));
      const result = originalSetText(next);
      decorateRecruitmentText(target, next);
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
  const label = directText(container)?.text ?? '';
  if (label === '시리즈 선택' || label === '현재 기록' || label === '모집') container.setDepth(4);
  if (Math.abs(container.x - 1081) <= 1 && Math.abs(container.y - 334) <= 1) {
    const body = container.list.find((child): child is Phaser.GameObjects.Rectangle => child instanceof Phaser.GameObjects.Rectangle && child.width >= 270);
    body?.setFillStyle(0x171d1b, 0.78).setStrokeStyle(1, 0x9a7b4a, 0.24);
  }
  if (label === '독립 추첨' || label === '보장 없음') container.setScale(0.9).setDepth(5);
  if (label === '+1 우선' || label === '분해 우선') container.setScale(0.94).setDepth(6);
  if (label.startsWith('1회 · 결정 ')) container.setScale(0.97).setDepth(7);
  if (label.startsWith('10회 · 결정 ')) container.setScale(1.035, 1.05).setDepth(9);
  if (label === '통지 확인') container.setDepth(55);
}

function polishRectangle(rectangle: Phaser.GameObjects.Rectangle): void {
  const oneTicket = Math.abs(rectangle.width - 390) <= 1 && Math.abs(rectangle.height - 202) <= 1;
  const tenTicket = Math.abs(rectangle.width - 200) <= 1 && Math.abs(rectangle.height - 188) <= 1;
  if ((oneTicket || tenTicket) && rectangle.fillColor === 0x292820) rectangle.setFillStyle(0x1c2027, 0.99).setStrokeStyle(1, 0xa48958, 0.5);
}

function polishSprite(sprite: Phaser.GameObjects.Sprite): void {
  const singleResult = Math.abs(sprite.x - 640) <= 2 && Math.abs(sprite.y - 322) <= 3;
  const tenResultRow = (Math.abs(sprite.y - 216) <= 3 || Math.abs(sprite.y - 420) <= 3) && sprite.x >= 100 && sprite.x <= 1180;
  if (singleResult || tenResultRow) sprite.setScale(sprite.scaleX * 1.12, sprite.scaleY * 1.12);
}

function visitGameObjects(objects: readonly Phaser.GameObjects.GameObject[], visitor: (object: Phaser.GameObjects.GameObject) => void): void {
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
  guides.lineStyle(1, 0x786347, 0.24).lineBetween(52, 500, 1228, 500);
  guides.lineStyle(1, 0x586779, 0.2).lineBetween(936, 160, 936, 486);
  guides.lineStyle(1, 0x9c8251, 0.34).lineBetween(500, 642, 1218, 642);
  guides.fillStyle(0x9c8251, 0.58).fillTriangle(1208, 638, 1218, 642, 1208, 646);
  return guides;
}

/** Keeps recruitment odds and economy rules intact while foregrounding the actual summon decision. */
export class RecruitmentScene extends BaseRecruitmentScene {
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
