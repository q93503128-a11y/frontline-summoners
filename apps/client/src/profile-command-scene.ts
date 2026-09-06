import { ProfileScene as BaseProfileScene } from './profile-scene.ts';

interface ProfilePresentationCarrier extends BaseProfileScene {
  loadingText?: Phaser.GameObjects.Text;
}

function safeProfileLoadText(value: string): string {
  if (/불러오는 중/.test(value)) return value;
  if (/HTTP_|fetch|network|state hash|revision|request|account_|profile_|\b[A-Z_]{4,}\b/i.test(value)) {
    return '지휘관 기록을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  return '지휘관 기록을 불러오지 못했습니다. 다시 시도해 주세요.';
}

/** Presentation-only guard over the existing profile/account authority. */
export class ProfileScene extends BaseProfileScene {
  override create(): void {
    super.create();
    const carrier = this as unknown as ProfilePresentationCarrier;
    const loading = carrier.loadingText;
    if (!loading) return;
    const originalSetText = loading.setText.bind(loading);
    loading.setText = ((value: string | string[]) => {
      const text = Array.isArray(value) ? value.join(' ') : value;
      return originalSetText(safeProfileLoadText(text));
    }) as typeof loading.setText;
  }
}
