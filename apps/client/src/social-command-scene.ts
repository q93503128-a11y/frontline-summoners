import Phaser from 'phaser';
import { SocialScene } from './social-scene.ts';

/**
 * Presentation-only social adapter. SocialScene keeps all server/friend/invite/block authority;
 * this layer only removes implementation vocabulary that should never leak into player-facing copy.
 */
export class SocialCommandScene extends SocialScene {
  private vocabularyTimer?: Phaser.Time.TimerEvent;

  override create(): void {
    super.create();
    this.sanitizePlayerFacingVocabulary();
    this.vocabularyTimer = this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => this.sanitizePlayerFacingVocabulary(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.vocabularyTimer?.destroy();
      this.vocabularyTimer = undefined;
    });
  }

  private sanitizePlayerFacingVocabulary(): void {
    for (const child of this.children.list) {
      if (!(child instanceof Phaser.GameObjects.Text)) continue;
      if (/^내 상태 (온라인|오프라인) · 프레임 /.test(child.text)) {
        child.setText(child.text.replace(/ · 프레임 .+$/, ' · 프로필 장식 적용'));
      }
    }
  }
}
