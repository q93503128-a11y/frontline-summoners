import Phaser from 'phaser';
import { ResultScene as BaseResultScene } from './result-scene.ts';

function rewriteResultLine(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '전과 보고': '작전 결과',
    '재정비 보고': '작전 결과',
    '첫 직접 클리어 보상': '첫 클리어 보상',
    '일반 보상을 계산하고 있습니다…': '보상 계산 중…',
    '진행과 보상을 저장하는 중…': '진행과 보상을 정산하는 중…',
    '클리어 기록과 보상을 저장하는 중…': '기록과 보상을 정산하는 중…',
    '패배해도 에너지나 보상을 잃지 않습니다.': '패배 페널티 없음 · 바로 다시 도전할 수 있습니다.',
    '스테이지 선택': '전선으로',
    '특수 작전 클리어': '특수 작전 완료',
    '반복 보상': '이번 보상',
    '전선 재정비': '재정비',
  };
  if (direct[value]) return direct[value]!;
  if (/^브라우저 영구 저장 실패 · 현재 탭에서는/.test(value)) return '저장에 실패했습니다. 이번 결과는 현재 실행에 유지됩니다.';
  if (/^추천: /.test(value)) return value.replace(/^추천: /, '재도전 팁 · ');
  if (/^진행 저장 완료 · 다음 전장 개방/.test(value)) return value.replace('진행 저장 완료 · ', '정산 완료 · ');
  return value;
}

function rewriteResultText(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(rewriteResultLine) : rewriteResultLine(value);
}

export class ResultScene extends BaseResultScene {
  override create(): void {
    const factory = this.add;
    const originalText = factory.text;
    factory.text = ((x, y, value, style) => {
      const text = originalText.call(factory, x, y, rewriteResultText(value), style);
      const originalSetText = text.setText.bind(text);
      text.setText = ((next: string | string[]) => originalSetText(rewriteResultText(next))) as typeof text.setText;
      return text;
    }) as typeof factory.text;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { factory.text = originalText; });
    super.create();
    this.polishResultGeometry();
  }

  private polishResultGeometry(): void {
    const visit = (object: Phaser.GameObjects.GameObject): void => {
      if (object instanceof Phaser.GameObjects.Text) {
        if (object.text === '작전 결과') object.setAlpha(0.86);
        if (object.text === '이번 보상' || object.text === '첫 클리어 보상') object.setAlpha(0.9);
      }
      if (object instanceof Phaser.GameObjects.Rectangle) {
        if (object.width > 1000 && object.height > 250) {
          object.setFillStyle(0x171e26, 0.46).setStrokeStyle(1, 0x6d7784, 0.2);
        }
      }
      if (object instanceof Phaser.GameObjects.Container) {
        object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
      }
    };
    this.children.list.forEach(visit);
  }
}
