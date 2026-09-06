import Phaser from 'phaser';
import { StoryScene as BaseStoryScene } from './story-scene.ts';

function rewriteStoryLine(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '선택형 스토리 · 전투 규칙과 해금 정보는 시스템 UI에 별도 표시됩니다.': 'ENTER 진행 · ESC 건너뛰기',
    '다 음': '다음',
    '건너뛰기': '스토리 건너뛰기',
  };
  return direct[value] ?? value;
}

function rewriteStoryText(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(rewriteStoryLine) : rewriteStoryLine(value);
}

export class StoryScene extends BaseStoryScene {
  override create(): void {
    const factory = this.add;
    const originalText = factory.text;
    factory.text = ((x, y, value, style) => {
      const text = originalText.call(factory, x, y, rewriteStoryText(value), style);
      const originalSetText = text.setText.bind(text);
      text.setText = ((next: string | string[]) => originalSetText(rewriteStoryText(next))) as typeof text.setText;
      return text;
    }) as typeof factory.text;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { factory.text = originalText; });
    super.create();
    this.polishNarrativeFrame();
  }

  private polishNarrativeFrame(): void {
    const rectangles = this.children.list.filter((child): child is Phaser.GameObjects.Rectangle => child instanceof Phaser.GameObjects.Rectangle);
    const dialogue = rectangles.find((rect) => rect.width > 800 && rect.width < 1200 && rect.height > 300);
    if (dialogue) dialogue.setFillStyle(0x151c27, 0.94).setStrokeStyle(1, 0x76859b, 0.46);
    for (const child of this.children.list) {
      if (child instanceof Phaser.GameObjects.Text && child.text.includes('ENTER 진행')) child.setAlpha(0.46);
      if (child instanceof Phaser.GameObjects.Text && child.text === '스토리 건너뛰기') child.setAlpha(0.88);
    }
  }
}
