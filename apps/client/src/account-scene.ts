import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import {
  getAccountClientState,
  logoutAuthenticatedAccount,
  refreshAuthenticatedAccount,
  restoreAuthenticatedAccountSession,
  subscribeAccountClientState,
  type AccountClientState,
} from './account-network.ts';
import {
  loadAuthenticatedAccountProfile,
  mutateAuthenticatedAccountProfile,
} from './account-profile-network.ts';
import { loadGuestAchievementProfile } from './achievement-profile.ts';
import { fetchGoogleAuthConfig, loginWithGoogleCredential } from './google-login.ts';
import { loadGuestProgress } from './save.ts';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

type GoogleCredentialResponse = { readonly credential?: string };
type GoogleIdentityApi = {
  initialize(options: { readonly client_id: string; readonly callback: (response: GoogleCredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: Readonly<Record<string, unknown>>): void;
  cancel(): void;
};

declare global {
  interface Window {
    google?: { readonly accounts?: { readonly id?: GoogleIdentityApi } };
  }
}

const GOOGLE_GSI_SCRIPT_ID = 'frontline-google-gsi';
const GOOGLE_GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let googleScriptPromise: Promise<void> | null = null;

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `guest-profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensureGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_GSI_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    const onLoad = () => window.google?.accounts?.id ? resolve() : reject(new Error('Google Identity Services를 초기화하지 못했습니다.'));
    const onError = () => reject(new Error('Google Identity Services 스크립트를 불러오지 못했습니다.'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.id = GOOGLE_GSI_SCRIPT_ID;
      script.src = GOOGLE_GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    googleScriptPromise = null;
    throw error;
  });
  return googleScriptPromise;
}

function stateSummary(state: AccountClientState): { readonly title: string; readonly detail: string; readonly color: string } {
  if (state.kind === 'GUEST_LOCAL') {
    return { title: '게스트 로컬', detail: '이 기기의 게스트 저장으로 플레이 중', color: COLORS.muted };
  }
  if (state.kind === 'AUTHENTICATED_ONLINE') {
    return {
      title: '로그인 계정 · 온라인',
      detail: `서버 저장 revision ${state.remote.revision} · 서버 정본 사용 가능`,
      color: COLORS.green,
    };
  }
  return {
    title: '로그인 계정 · 오프라인 캐시',
    detail: state.remote ? `읽기 전용 revision ${state.remote.revision} · 온라인 복구 전 재화 변경 불가` : '읽기 캐시 없음 · 서버 연결 필요',
    color: COLORS.gold,
  };
}

export class AccountScene extends Phaser.Scene {
  private stateText?: Phaser.GameObjects.Text;
  private detailText?: Phaser.GameObjects.Text;
  private messageText?: Phaser.GameObjects.Text;
  private googleHost: HTMLDivElement | null = null;
  private unsubscribeState: (() => void) | null = null;
  private destroyed = false;

  constructor() { super('account'); }

  create(): void {
    this.destroyed = false;
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    addText(this, 62, 46, '계 정', compact ? 48 : 44, COLORS.cream);
    addText(this, 64, 104, '로그인 계정은 서버 저장이 정본입니다.', compact ? 22 : 19, COLORS.muted);

    this.add.rectangle(INTERNAL_WIDTH / 2, 305, compact ? 850 : 760, 300, 0x202735, 0.98).setStrokeStyle(3, 0x657086);
    this.stateText = addText(this, INTERNAL_WIDTH / 2, 200, '', compact ? 32 : 30, '#ffffff', 'center').setOrigin(0.5);
    this.detailText = addText(this, INTERNAL_WIDTH / 2, 250, '', compact ? 21 : 18, COLORS.muted, 'center').setOrigin(0.5);
    this.messageText = addText(this, INTERNAL_WIDTH / 2, 425, '계정 상태 확인 중…', compact ? 21 : 18, COLORS.muted, 'center').setOrigin(0.5);

    addButton(this, INTERNAL_WIDTH / 2, 510, 330, compact ? 82 : 58, '게스트 프로필 가져오기', () => void this.importGuestProfilePreferences(), 0x6b7194);
    addText(this, INTERNAL_WIDTH / 2, 552, '장착 취향만 가져오며 업적/장식 소유권은 서버가 다시 검증합니다.', compact ? 17 : 15, COLORS.muted, 'center').setOrigin(0.5);

    addButton(this, 180, INTERNAL_HEIGHT - 72, 220, compact ? 82 : 58, '메 인', () => this.scene.start('main-menu'), 0x586275);
    addButton(this, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 72, 250, compact ? 82 : 58, '서버 새로고침', () => void this.refresh(), 0x5f8fb8);
    addButton(this, INTERNAL_WIDTH - 180, INTERNAL_HEIGHT - 72, 220, compact ? 82 : 58, '로그아웃', () => void this.logout(), 0x8c5f62);

    this.unsubscribeState = subscribeAccountClientState((state) => this.renderState(state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await restoreAuthenticatedAccountSession();
      if (this.destroyed) return;
      await this.setupGoogleLogin();
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : '계정 초기화에 실패했습니다.', COLORS.red);
    }
  }

  private renderState(state: AccountClientState): void {
    if (this.destroyed || !this.stateText || !this.detailText) return;
    const summary = stateSummary(state);
    this.stateText.setText(summary.title).setColor(summary.color);
    this.detailText.setText(summary.detail);
    if (this.googleHost) this.googleHost.style.display = state.kind === 'GUEST_LOCAL' ? 'block' : 'none';
  }

  private async setupGoogleLogin(): Promise<void> {
    const state = getAccountClientState();
    if (state.kind !== 'GUEST_LOCAL') {
      this.setMessage('현재 로그인 세션이 활성화되어 있습니다.', COLORS.green);
      return;
    }
    const config = await fetchGoogleAuthConfig();
    if (this.destroyed) return;
    if (!config.enabled || !config.clientId) {
      this.setMessage('Google 로그인이 아직 서버에 설정되지 않았습니다.', COLORS.muted);
      return;
    }
    await ensureGoogleIdentityScript();
    if (this.destroyed) return;
    const api = window.google?.accounts?.id;
    if (!api) throw new Error('Google Identity Services API를 찾지 못했습니다.');

    this.removeGoogleHost();
    const host = document.createElement('div');
    host.dataset.frontlineGoogleLogin = 'true';
    host.style.position = 'fixed';
    host.style.left = '50%';
    host.style.top = '55%';
    host.style.transform = 'translate(-50%, -50%)';
    host.style.zIndex = '1000';
    host.style.pointerEvents = 'auto';
    host.style.touchAction = 'auto';
    document.body.appendChild(host);
    this.googleHost = host;

    api.initialize({
      client_id: config.clientId,
      callback: (response) => void this.handleGoogleCredential(response),
    });
    api.renderButton(host, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      width: 280,
      locale: 'ko',
    });
    this.setMessage('Google 계정으로 로그인할 수 있습니다.', COLORS.blue);
  }

  private async handleGoogleCredential(response: GoogleCredentialResponse): Promise<void> {
    if (!response.credential) {
      this.setMessage('Google에서 로그인 credential을 받지 못했습니다.', COLORS.red);
      return;
    }
    this.setMessage('Google 계정 확인 중…', COLORS.muted);
    try {
      await loginWithGoogleCredential(response.credential);
      if (this.destroyed) return;
      this.setMessage('로그인 완료 · 서버 계정 저장을 불러왔습니다.', COLORS.green);
      this.removeGoogleHost();
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.', COLORS.red);
    }
  }

  private async importGuestProfilePreferences(): Promise<void> {
    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      this.setMessage('온라인 로그인 계정에서만 게스트 프로필 취향을 가져올 수 있습니다.', COLORS.gold);
      return;
    }
    this.setMessage('게스트 프로필 장착 취향을 서버에서 검증 중…', COLORS.muted);
    try {
      const guestProgress = await loadGuestProgress();
      const guestProfile = loadGuestAchievementProfile(guestProgress);
      const accountProfile = await loadAuthenticatedAccountProfile();
      if (!accountProfile) throw new Error('계정 프로필을 불러오지 못했습니다.');
      await mutateAuthenticatedAccountProfile({
        requestId: newRequestId(),
        profileLoadout: guestProfile.profileLoadout,
      });
      if (this.destroyed) return;
      this.setMessage('게스트 장착 취향을 가져왔습니다 · 서버 미해금 장식과 로컬 업적 소유권은 이전하지 않았습니다.', COLORS.green);
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : '게스트 프로필 가져오기에 실패했습니다.', COLORS.red);
    }
  }

  private async refresh(): Promise<void> {
    const state = getAccountClientState();
    if (state.kind === 'GUEST_LOCAL') {
      this.setMessage('게스트 상태입니다. Google 로그인 후 서버 계정을 새로고침할 수 있습니다.', COLORS.muted);
      return;
    }
    this.setMessage('서버 계정 확인 중…', COLORS.muted);
    const remote = await refreshAuthenticatedAccount();
    if (this.destroyed) return;
    this.setMessage(remote ? '서버 계정이 최신 상태입니다.' : '서버에 연결하지 못해 읽기 캐시 상태로 전환했습니다.', remote ? COLORS.green : COLORS.gold);
  }

  private async logout(): Promise<void> {
    if (getAccountClientState().kind === 'GUEST_LOCAL') {
      this.setMessage('현재 로그인된 계정이 없습니다.', COLORS.muted);
      return;
    }
    const result = await logoutAuthenticatedAccount();
    if (this.destroyed) return;
    this.setMessage(result.serverRevoked ? '로그아웃했습니다.' : '로컬 로그아웃 완료 · 서버 revoke 확인은 실패했습니다.', result.serverRevoked ? COLORS.green : COLORS.gold);
    await this.setupGoogleLogin().catch((error) => this.setMessage(error instanceof Error ? error.message : 'Google 로그인 준비에 실패했습니다.', COLORS.red));
  }

  private setMessage(message: string, color: string): void {
    this.messageText?.setText(message).setColor(color);
  }

  private removeGoogleHost(): void {
    this.googleHost?.remove();
    this.googleHost = null;
  }

  private cleanup(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribeState?.();
    this.unsubscribeState = null;
    this.removeGoogleHost();
    window.google?.accounts?.id?.cancel();
  }
}

export const __accountSceneTestOnly = {
  stateSummary,
  googleScriptSrc: GOOGLE_GSI_SCRIPT_SRC,
};
