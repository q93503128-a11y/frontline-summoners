import Phaser from 'phaser';
import { AccountCommandScene as BaseAccountCommandScene } from './account-command-scene.ts';
import { fitTextToWidth } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

type AccountPresentationCarrier = Phaser.Scene & Record<string, unknown>;

function rewriteAccountLine(value: string): string {
  const normalized = value
    .replace(/\bSPECIAL\b/g, '특수')
    .replace(/\bNORMAL_CLEAR\b/g, '클리어');
  const direct: Readonly<Record<string, string>> = {
    '계 정': '계정',
    '저장 위치와 로그인 상태를 확인하고, 필요한 경우에만 진행을 이전한다.': '현재 진행의 저장 위치와 계정 연결 상태를 확인합니다.',
    '현재 저장 상태': '저장 상태',
    '계정 작업': '계정 관리',
    '로컬 저장 관리': '이 기기',
    '개발자 테스트 도구': '테스트 도구',
    '위 두 기능은 일반 계정 작업과 별개입니다.': '로컬 초기화와 테스트 기능은 계정 진행과 별개입니다.',
    '온라인 계정 관리': '온라인 계정',
    '서버 새로고침': '진행 동기화',
    '게스트 진행 다시 비교': '게스트 진행 비교',
    '게스트 장식 취향 가져오기': '게스트 프로필 가져오기',
    '서버 진행 유지': '계정 진행 유지',
    '게스트 저장 초기화': '로컬 진행 초기화',
    'Google 계정으로 로그인': 'Google 계정 연결',
  };
  if (direct[normalized]) return direct[normalized]!;
  if (/^로그인 후 서버 진행이 비어 있으면/.test(normalized)) return '계정 진행이 비어 있으면 현재 게스트 진행을 옮길 수 있습니다.';
  if (/^서버에도 진행이 있으면 비교 후 직접 선택합니다/.test(normalized)) return '계정과 게스트 양쪽에 진행이 있으면 비교 후 직접 선택합니다.';
  if (/^전투·모집·성장·소셜 변경이 서버 진행에 저장됩니다\.$/.test(normalized)) return '플레이 진행이 계정에 저장됩니다.';
  if (/^오프라인에서는 진행을 확인할 수 있지만/.test(normalized)) return '오프라인에서는 진행을 볼 수 있지만 변경할 수 없습니다.';
  if (/^현재 화면은 읽기 전용입니다\./.test(normalized)) return '현재는 읽기 전용입니다. 온라인 연결을 복구하면 다시 변경할 수 있습니다.';
  if (/HTTP_|revision|requestId|migrationId|state hash|account_|profile_|guest_/i.test(normalized)) {
    return '계정 작업을 완료하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  return normalized;
}

function rewriteAccountText(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(rewriteAccountLine) : rewriteAccountLine(value);
}

function wrapAfter(carrier: AccountPresentationCarrier, methodName: string, after: () => void): (() => void) | undefined {
  const original = carrier[methodName];
  if (typeof original !== 'function') return undefined;
  carrier[methodName] = (...args: unknown[]) => {
    const result = (original as (...values: unknown[]) => unknown).apply(carrier, args);
    after();
    return result;
  };
  return () => { carrier[methodName] = original; };
}

function directButtonLabel(container: Phaser.GameObjects.Container): string {
  const text = container.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
  return text?.text ?? '';
}

export class AccountScene extends BaseAccountCommandScene {
  private accountGuides: Phaser.GameObjects.Graphics | undefined;

  override create(): void {
    const factory = this.add;
    const originalText = factory.text;
    factory.text = ((x, y, value, style) => {
      const text = originalText.call(factory, x, y, rewriteAccountText(value), style);
      const originalSetText = text.setText.bind(text);
      text.setText = ((next: string | string[]) => originalSetText(rewriteAccountText(next))) as typeof text.setText;
      return text;
    }) as typeof factory.text;

    super.create();
    const carrier = this as unknown as AccountPresentationCarrier;
    const restoreState = wrapAfter(carrier, 'renderState', () => this.polishAccountGeometry());
    const restoreActions = wrapAfter(carrier, 'renderActions', () => this.polishAccountGeometry());
    this.drawAccountGuides();
    this.polishAccountGeometry();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      factory.text = originalText;
      restoreState?.();
      restoreActions?.();
      this.accountGuides?.destroy();
      this.accountGuides = undefined;
    });
  }

  private drawAccountGuides(): void {
    this.accountGuides?.destroy();
    const guides = this.add.graphics().setDepth(3);
    guides.lineStyle(1, 0x5f6d7c, 0.26).lineBetween(56, 304, 1224, 304);
    guides.lineStyle(1, 0x6f5960, 0.34).lineBetween(56, 612, 1224, 612);
    guides.lineStyle(3, 0x8a6262, 0.38).lineBetween(56, 622, 184, 622);
    this.accountGuides = guides;
  }

  private polishAccountGeometry(): void {
    const compact = isCompactMobileViewport();
    const visit = (object: Phaser.GameObjects.GameObject): void => {
      if (object instanceof Phaser.GameObjects.Rectangle) {
        if (object.width >= 1100 && object.height >= 120 && object.height < 180) {
          object.setFillStyle(0x171f28, 0.3).setStrokeStyle(1, 0x647487, 0.12);
        } else if (object.width >= 1100 && object.height >= 200) {
          object.setFillStyle(0x171f28, 0.22).setStrokeStyle(1, 0x647487, 0.08);
        } else if (object.width >= 240 && object.width <= 310 && object.height <= 70) {
          object.setAlpha(Math.min(object.alpha, 0.92));
        }
      }
      if (object instanceof Phaser.GameObjects.Text) {
        if (object.text === '저장 상태') object.setAlpha(0.94).setColor('#dce5ee');
        if (object.text === '계정 관리') object.setAlpha(0.9).setColor('#d7e0e8');
        if (object.text === '이 기기') object.setAlpha(0.82).setColor('#b9a3a9');
        if (object.text.includes('계정 진행이 비어 있으면') || object.text.includes('양쪽에 진행이 있으면')) object.setAlpha(0.76);
        if (object.text.includes('로컬 초기화와 테스트 기능')) object.setAlpha(0.68);

        const centered = Math.abs(object.originX - 0.5) < 0.05;
        const maxWidth = centered
          ? 1000
          : object.x <= 130
            ? 1040
            : object.x >= 800
              ? 350
              : 560;
        if (object.width > maxWidth) fitTextToWidth(object, maxWidth, compact ? 14 : 11);
      }
      if (object instanceof Phaser.GameObjects.Container) {
        const label = directButtonLabel(object);
        if (label === '진행 동기화' || label === '다시 연결' || label === '게스트 진행 적용') object.setDepth(8);
        if (label === '로그아웃' || label === '로컬 진행 초기화') object.setDepth(7);
        if (label === '테스트 도구') object.setDepth(4).setAlpha(0.86);
        object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
      }
    };
    this.children.list.forEach(visit);
  }
}
