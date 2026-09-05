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
import {
  GUEST_REPLACE_CONFIRMATION,
  captureGuestMigrationEnvelope,
  commitAuthenticatedGuestMigration,
  previewAuthenticatedGuestMigration,
  rollbackAuthenticatedGuestMigration,
  type AccountGuestMigrationPreviewClient,
  type AccountProgressSummaryClient,
  type GuestMigrationEnvelopeClient,
} from './account-guest-migration-network.ts';
import { loadGuestAchievementProfile } from './achievement-profile.ts';
import { fetchGoogleAuthConfig, loginWithGoogleCredential } from './google-login.ts';
import { loadGuestProgress, type GuestProgress } from './save.ts';
import {
  applyGuestDeveloperResourceCode,
  isGuestDeveloperResourceSandboxActive,
  resetGuestLocalAccountData,
} from './guest-maintenance.ts';
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

function hasMeaningfulGuestProgress(progress: GuestProgress): boolean {
  if (progress.clearedStageIds.length > 0 || progress.specialClearedStageIds.length > 0) return true;
  if ((progress.ownedRecruitmentCharacterIds?.length ?? 0) > 0 || (progress.discoveredEnemyIds?.length ?? 0) > 0) return true;
  if ((progress.recordModeProgress?.endlessBestTimeMs ?? 0) > 0 || (progress.recordModeProgress?.bossRushBestDefeated ?? 0) > 0) return true;
  for (const entry of Object.values(progress.characterProgressById ?? {})) {
    if (entry.level > 1 || entry.plusLevel > 0 || entry.unlockedFormIds.length > 1) return true;
  }
  for (const ledger of Object.values(progress.resourceLedgerById ?? {})) {
    if ((ledger?.earned ?? 0) > (ledger?.spent ?? 0)) return true;
  }
  return false;
}

function summaryText(label: string, summary: AccountProgressSummaryClient): string {
  const highest = summary.highestMainStageId ? ` · 최고 ${summary.highestMainStageId}` : '';
  const resource = Object.entries(summary.resourceBalances)
    .filter(([, value]) => value > 0)
    .slice(0, 3)
    .map(([id, value]) => `${id} ${value}`)
    .join(', ');
  return `${label}: MAIN ${summary.mainClearCount}${highest} · SPECIAL ${summary.specialClearCount} · 캐릭터 ${summary.ownedCharacterCount}${resource ? ` · ${resource}` : ''}`;
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
  private migrationEnvelope: GuestMigrationEnvelopeClient | null = null;
  private migrationPreview: AccountGuestMigrationPreviewClient | null = null;
  private replacementArmed = false;
  private lastMigrationId: string | null = null;

  constructor() { super('account'); }

  create(): void {
    this.destroyed = false;
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    addText(this, 62, 46, '계 정', compact ? 48 : 44, COLORS.cream);
    addText(this, 64, 104, '로그인 계정은 서버 저장이 정본입니다.', compact ? 22 : 19, COLORS.muted);
    addButton(this, 1015, 60, 185, compact ? 64 : 44, '게스트 초기화', () => { void this.resetGuestLocalAccount(); }, 0x8a6262);
    addButton(this, 1190, 60, 150, compact ? 64 : 44, '개발자 코드', () => { void this.applyDeveloperCode(); }, 0x765f8d);

    this.add.rectangle(INTERNAL_WIDTH / 2, 285, compact ? 980 : 900, 330, 0x202735, 0.98).setStrokeStyle(3, 0x657086);
    this.stateText = addText(this, INTERNAL_WIDTH / 2, 175, '', compact ? 32 : 30, '#ffffff', 'center').setOrigin(0.5);
    this.detailText = addText(this, INTERNAL_WIDTH / 2, 225, '', compact ? 21 : 18, COLORS.muted, 'center').setOrigin(0.5);
    this.messageText = addText(this, INTERNAL_WIDTH / 2, 360, '계정 상태 확인 중…', compact ? 18 : 16, COLORS.muted, 'center')
      .setOrigin(0.5)
      .setWordWrapWidth(compact ? 900 : 820);

    addButton(this, 350, 495, 240, compact ? 78 : 54, '게스트 진행 비교', () => void this.prepareMigrationPreview(false), 0x647a98);
    addButton(this, 680, 495, 260, compact ? 78 : 54, '게스트 진행 적용', () => void this.applyGuestMigration(), 0x6f835e);
    addButton(this, 1015, 495, 250, compact ? 78 : 54, '취소 · 서버 유지', () => this.keepServerProgress(), 0x6d6672);
    addButton(this, 500, 565, 270, compact ? 78 : 54, '직전 이전 되돌리기', () => void this.rollbackGuestMigration(), 0x8a6262);
    addButton(this, 855, 565, 300, compact ? 78 : 54, '장식 취향만 가져오기', () => void this.importGuestProfilePreferences(), 0x6b7194);

    addButton(this, 180, INTERNAL_HEIGHT - 58, 220, compact ? 76 : 52, '메 인', () => this.scene.start('main-menu'), 0x586275);
    addButton(this, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT - 58, 250, compact ? 76 : 52, '서버 새로고침', () => void this.refresh(), 0x5f8fb8);
    addButton(this, INTERNAL_WIDTH - 180, INTERNAL_HEIGHT - 58, 220, compact ? 76 : 52, '로그아웃', () => void this.logout(), 0x8c5f62);

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
      if (getAccountClientState().kind === 'AUTHENTICATED_ONLINE') await this.prepareMigrationPreview(true);
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
      this.removeGoogleHost();
      await this.prepareMigrationPreview(true);
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.', COLORS.red);
    }
  }

  private async prepareMigrationPreview(automatic: boolean): Promise<void> {
    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      if (!automatic) this.setMessage('게스트 진행 이전은 온라인 로그인 상태에서만 가능합니다.', COLORS.gold);
      return;
    }
    if (isGuestDeveloperResourceSandboxActive()) {
      this.migrationEnvelope = null;
      this.migrationPreview = null;
      this.replacementArmed = false;
      this.setMessage('개발자 테스트 재화가 적용된 게스트 진행은 서버 계정으로 이전할 수 없습니다. 게스트 초기화 후 정상 진행을 사용하세요.', COLORS.red);
      return;
    }
    const guestProgress = await loadGuestProgress();
    if (!hasMeaningfulGuestProgress(guestProgress)) {
      this.migrationEnvelope = null;
      this.migrationPreview = null;
      this.replacementArmed = false;
      if (!automatic) this.setMessage('이전할 게스트 진행이 없습니다.', COLORS.muted);
      else this.setMessage('로그인 완료 · 서버 계정 저장을 불러왔습니다.', COLORS.green);
      return;
    }
    const guestProfile = loadGuestAchievementProfile(guestProgress);
    const envelope = captureGuestMigrationEnvelope(guestProgress, guestProfile.profileLoadout);
    const preview = await previewAuthenticatedGuestMigration(envelope);
    if (this.destroyed) return;
    this.migrationEnvelope = envelope;
    this.migrationPreview = preview;
    this.replacementArmed = false;
    const guidance = preview.serverEmpty
      ? '서버 계정이 비어 있습니다. 게스트 진행 적용을 누르면 이전합니다.'
      : '서버에도 진행이 있습니다. 자동 합치기하지 않습니다. 교체하려면 게스트 진행 적용을 두 번 눌러 확인하세요.';
    this.setMessage(`${summaryText('게스트', preview.guest)}\n${summaryText('서버', preview.server)}\n${guidance}`, preview.serverEmpty ? COLORS.green : COLORS.gold);
  }

  private async applyGuestMigration(): Promise<void> {
    if (!this.migrationEnvelope || !this.migrationPreview) {
      await this.prepareMigrationPreview(false);
      if (!this.migrationEnvelope || !this.migrationPreview) return;
    }
    const preview = this.migrationPreview;
    if (!preview.serverEmpty && !this.replacementArmed) {
      this.replacementArmed = true;
      this.setMessage(`${summaryText('게스트', preview.guest)}\n${summaryText('서버', preview.server)}\n주의: 다음 '게스트 진행 적용' 클릭은 서버 게임 진행/재화/보유를 게스트 snapshot으로 교체합니다. 친구·PvP 계정 식별 데이터는 대상이 아닙니다.`, COLORS.red);
      return;
    }
    this.setMessage('게스트 진행을 서버 transaction으로 이전 중…', COLORS.muted);
    try {
      const result = await commitAuthenticatedGuestMigration(
        this.migrationEnvelope,
        preview,
        preview.serverEmpty ? 'IMPORT_IF_EMPTY' : 'REPLACE_EXISTING',
        preview.serverEmpty ? undefined : GUEST_REPLACE_CONFIRMATION,
      );
      if (this.destroyed) return;
      this.lastMigrationId = result.migrationId;
      this.migrationEnvelope = null;
      this.migrationPreview = null;
      this.replacementArmed = false;
      this.setMessage('게스트 진행 이전 완료 · 진행/재화/캐릭터/기록과 프로필 장식 판정이 서버 정본으로 전환되었습니다. 직후 상태라면 되돌리기도 가능합니다.', COLORS.green);
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : '게스트 진행 이전에 실패했습니다.', COLORS.red);
    }
  }

  private keepServerProgress(): void {
    this.migrationEnvelope = null;
    this.migrationPreview = null;
    this.replacementArmed = false;
    this.setMessage('서버 진행을 유지합니다. 게스트 진행은 이 기기에 그대로 남아 있으며 자동 병합하지 않습니다.', COLORS.green);
  }

  private async rollbackGuestMigration(): Promise<void> {
    if (!this.lastMigrationId) {
      this.setMessage('이 화면에서 방금 완료한 되돌릴 이전 기록이 없습니다.', COLORS.muted);
      return;
    }
    this.setMessage('직전 게스트 진행 이전을 되돌리는 중…', COLORS.muted);
    try {
      await rollbackAuthenticatedGuestMigration(this.lastMigrationId);
      if (this.destroyed) return;
      this.lastMigrationId = null;
      this.setMessage('직전 이전을 되돌렸습니다. 서버 진행과 계정 프로필이 이전 snapshot으로 복구되었습니다.', COLORS.green);
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : '이전을 되돌릴 수 없습니다. 이전 후 다른 서버 변경이 있었을 수 있습니다.', COLORS.red);
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

  private async resetGuestLocalAccount(): Promise<void> {
    if (typeof window === 'undefined') return;
    const confirmation = window.prompt('이 기기의 게스트 진행, 재화, 도감, 모집, 성장, 기록, 게스트 프로필을 모두 삭제합니다. 로그인 서버 계정은 건드리지 않습니다.\n초기화하려면 RESET을 입력하세요.');
    if (confirmation === null) return;
    if (confirmation.trim() !== 'RESET') {
      this.setMessage('게스트 초기화를 취소했습니다. RESET을 정확히 입력해야 합니다.', COLORS.gold);
      return;
    }
    this.setMessage('게스트 로컬 저장을 초기화하는 중…', COLORS.muted);
    const reset = await resetGuestLocalAccountData();
    if (!reset) {
      this.setMessage('게스트 저장 초기화에 실패했습니다. 브라우저 저장소 사용 가능 여부를 확인하세요.', COLORS.red);
      return;
    }
    this.setMessage('게스트 로컬 저장을 초기화했습니다. 서버 계정은 변경하지 않았습니다. 새 상태를 불러옵니다.', COLORS.green);
    window.setTimeout(() => window.location.reload(), 250);
  }

  private async applyDeveloperCode(): Promise<void> {
    if (getAccountClientState().kind !== 'GUEST_LOCAL') {
      this.setMessage('개발자 재화 코드는 게스트 로컬 테스트에서만 사용할 수 있습니다. 서버 계정에는 적용하지 않습니다.', COLORS.gold);
      return;
    }
    if (typeof window === 'undefined') return;
    const code = window.prompt('개발자 테스트 코드를 입력하세요.');
    if (code === null) return;
    this.setMessage('개발자 테스트 재화를 적용하는 중…', COLORS.muted);
    try {
      const result = await applyGuestDeveloperResourceCode(code);
      if (!result.activated) {
        this.setMessage('개발자 코드가 일치하지 않습니다.', COLORS.red);
        return;
      }
      this.setMessage('개발자 테스트 재화 적용 완료 · 모든 재화를 999,999,999로 채웠습니다. 이 게스트 저장은 서버 이전이 차단됩니다.', COLORS.green);
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      this.setMessage(error instanceof Error ? error.message : '개발자 테스트 재화 적용에 실패했습니다.', COLORS.red);
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
    this.migrationEnvelope = null;
    this.migrationPreview = null;
    this.replacementArmed = false;
    this.lastMigrationId = null;
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
  hasMeaningfulGuestProgress,
  summaryText,
  googleScriptSrc: GOOGLE_GSI_SCRIPT_SRC,
};
