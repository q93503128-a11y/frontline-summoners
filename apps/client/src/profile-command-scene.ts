import Phaser from 'phaser';
import { ProfileScene as BaseProfileScene } from './profile-scene.ts';

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function safeProfileText(value: string): string {
  if (/불러오는 중/.test(value)) return value;
  if (/HTTP_|fetch|network|state hash|revision|request|account_|profile_|\b[A-Z_]{4,}\b/i.test(value) && !/NORMAL_CLEAR/.test(value)) {
    return '지휘관 기록을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  return value
    .replace(/제(\d+)장 마지막 전장을 NORMAL_CLEAR/g, '제$1장 마지막 전장 클리어')
    .replace(/메인 NORMAL_CLEAR (\d+)개/g, '메인 전장 클리어 $1개')
    .replace(/NORMAL_CLEAR/g, '클리어');
}

/** Presentation-only guard over the existing profile/account authority. */
export class ProfileScene extends BaseProfileScene {
  override create(): void {
    const original = this.add.text.bind(this.add) as typeof this.add.text;
    this.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
      const rewritten = safeProfileText(normalize(value));
      const target = original(x, y, rewritten, style);
      const originalSetText = target.setText.bind(target);
      target.setText = ((nextValue: string | string[]) => originalSetText(safeProfileText(normalize(nextValue)))) as typeof target.setText;
      return target;
    }) as typeof this.add.text;
    super.create();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.add.text = original; });
  }
}
