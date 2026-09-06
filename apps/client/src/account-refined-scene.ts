import Phaser from 'phaser';
import { AccountCommandScene as BaseAccountCommandScene } from './account-command-scene.ts';

function rewriteAccountLine(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '계 정': '계정',
    '저장 위치와 로그인 상태를 확인하고, 필요한 경우에만 진행을 이전한다.': '저장 상태와 로그인 상태를 확인합니다.',
    '현재 저장 상태': '저장 상태',
    '계정 작업': '계정 관리',
    '로컬 저장 관리': '이 기기',
    '개발자 테스트 도구': '테스트 도구',
    '위 두 기능은 일반 계정 작업과 별개입니다.': '로컬 저장과 테스트 기능은 계정 진행과 별개입니다.',
    '온라인 계정 관리': '온라인 계정',
    '서버 새로고침': '진행 동기화',
    '게스트 진행 다시 비교': '게스트 진행 비교',
    '게스트 장식 취향 가져오기': '게스트 프로필 가져오기',
  };
  if (direct[value]) return direct[value]!;
  if (/^서버에도 진행이 있으면 비교 후 직접 선택합니다/.test(value)) return '계정과 게스트 양쪽에 진행이 있으면 비교 후 직접 선택합니다.';
  if (/^전투·모집·성장·소셜 변경이 서버 진행에 저장됩니다\.$/.test(value)) return '플레이 진행이 계정에 저장됩니다.';
  if (/^오프라인에서는 진행을 확인할 수 있지만/.test(value)) return '오프라인에서는 진행을 볼 수 있지만 변경할 수 없습니다.';
  return value;
}

function rewriteAccountText(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(rewriteAccountLine) : rewriteAccountLine(value);
}

export class AccountScene extends BaseAccountCommandScene {
  override create(): void {
    const factory = this.add;
    const originalText = factory.text;
    factory.text = ((x, y, value, style) => {
      const text = originalText.call(factory, x, y, rewriteAccountText(value), style);
      const originalSetText = text.setText.bind(text);
      text.setText = ((next: string | string[]) => originalSetText(rewriteAccountText(next))) as typeof text.setText;
      return text;
    }) as typeof factory.text;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { factory.text = originalText; });
    super.create();
  }
}
