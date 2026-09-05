import Phaser from 'phaser';
import { SocialScene } from './social-scene.ts';

/**
 * Presentation-only social adapter. SocialScene keeps all server/friend/invite/block authority;
 * this layer only removes implementation vocabulary that should never leak into player-facing copy.
 */
export class SocialCommandScene extends SocialScene {
  override create(): void {
    const factory = this.add;
    const originalText = factory.text;
    const wrappedText: typeof originalText = (x, y, text, style) => originalText.call(
      factory,
      x,
      y,
      this.sanitizePlayerFacingText(text),
      style,
    );
    factory.text = wrappedText;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      factory.text = originalText;
    });
    super.create();
  }

  private sanitizePlayerFacingText(value: string | string[]): string | string[] {
    if (Array.isArray(value)) return value.map((entry) => this.sanitizePlayerFacingLine(entry));
    return this.sanitizePlayerFacingLine(value);
  }

  private sanitizePlayerFacingLine(text: string): string {
    return text
      .replace(/^내 상태 (온라인|오프라인) · 프레임 .+$/, '내 상태 $1 · 프로필 장식 적용')
      .replace(/\b(?:main|special)_[a-z0-9_]+\b/gi, '알 수 없는 전장');
  }
}
