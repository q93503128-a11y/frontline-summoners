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
import {
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
} from './scene-ui';
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

const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  gold: '골드',
  evo_fragment: '진화 조각',
  evo_core: '진화 핵',
  evo_crown: '진화 왕관',
  soul_essence: '혼의 파편',
  summon_crystal: '모집 결정',
  sweep_ticket: '소탕권',
};

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
  const resource = Object.entries(summary.resourceBalances)
    .filter(([, value]) => value > 0)
    .slice(0, 3)
    .map(([id, value]) => `${RESOURCE_LABELS[id] ?? '재화'} ${value.toLocaleString('ko-KR')}`)
    .join(' · ');
  return `${label} · 메인 ${summary.mainClearCount} · SPECIAL ${summary.specialClearCount} · 동료 ${summary.ownedCharacterCount}${resource ? ` · ${resource}` : ''}`;
}

function ensureGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_GSI_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    const onLoad = () => window.google?.accounts?.id ? resolve() : reject(new Error('Google 로그인을 초기화하지 못했습니다.'));
    const onError = () => reject(new Error('Google 로그인 화면을 불러오지 못했습니다.'));
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

function stateSummary(state: AccountClientState): { readonly title: string; readonly detail: string; readonly kind: 'neutral' | 'online' | 'offline' } {
  if (state.kind === 'GUEST_LOCAL') {
    return { title: '게스트 지휘관', detail: '이 기기의 로컬 저장으로 플레이 중입니다.', kind: 'neutral' };
  }
  if (state.kind === 'AUTHENTICATED_ONLINE') {
    return { title: '계정 지휘관 · 온라인', detail: '서버 진행과 동기화되어 있습니다.', kind: 'online' };
  }
  return {
    title: '계정 지휘관 · 오프라인',
    detail: state.remote ? '마지막으로 동기화된 진행을 읽기 전용으로 보고 있습니다.' : '저장된 서버 진행을 읽을 수 없습니다. 인터넷 연결이 필요합니다.',
    kind: 'offline',
  };
}

export class AccountCommandScene extends Phaser.Scene {
  private stateLayer?: Phaser.GameObjects.Container;
  private actionLayer?: Phaser.GameObjects.Container;
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
    addText(this, 52, 30, '계 정', compact ? 46 : 48, COLORS.cream);
    addText(this, 54, 84, '저장 위치와 로그인 상태를 확인하고, 필요한 경우에만 진행을 이전한다.', compact ? 20 : 17, COLORS.muted);
    addButton(this, 1170, 58, 160, compact ? 82 : 50, '지휘소', () => this.scene.start('main-menu'), 0x5b6879, { tone: 'quiet' });

    addSectionHeading(this, 56, 137, '현재 저장 상태', 1168, 0x6d8195);
    addCommandPanel(this, INTERNAL_WIDTH / 2, 225, 1160, 138, 0x6d8195, 0x1c2430, 0.94);
    this.stateLayer = this.add.container(0, 0);

    addSectionHeading(this, 56, 320, '계정 작업', 1168, 0x73856e);
    addCommandPanel(this, INTERNAL_WIDTH / 2, 458, 1160, 235, 0x647667, 0x1d252c, 0.9);
    this.actionLayer = this.add.container(0, 0);

    this.messageText = addText(this, INTERNAL_WIDTH / 2, 586, '계정 상태 확인 중…', compact ? 18 : 15, COLORS.muted, 'center')
      .setOrigin(0.5)
      .setWordWrapWidth(compact ? 1060 : 1010);

    addSectionHeading(this, 56, 628, '로컬 저장 관리', 1168, 0x765f66);
    addButton(this, 380, 674, 260, compact ? 82 : 54, '게스트 저장 초기화', () => { void this.resetGuestLocalAccount(); }, 0x8a6262, { tone: 'danger' });
    addButton(this, 690, 674, 260, compact ? 82 : 54, '개발자 테스트 도구', () => { void this.applyDeveloperCode(); }, 0x765f8d, { tone: 'quiet' });
    addText(this, 850, 674, '위 두 기능은 일반 계정 작업과 별개입니다.', compact ? 16 : 13, '#8d96a3').setOrigin(0, 0.5);

    this.unsubscribeState = subscribeAccountClientState((state) => {
      this.renderState(state);
      this.renderActions(state);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    window.addEventListener('resize', this.positionGoogleHost);
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await restoreAuthenticatedAccountSession();
      if (this.destroyed) return;
      const state = getAccountClientState();
      this.renderState(state);
      this.renderActions(state);
      await this.setupGoogleLogin();
      if (state.kind === 'AUTHENTICATED_ONLINE') await this.prepareMigrationPreview(true);
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : '계정 초기화에 실패했습니다.', COLORS.red);
    }
  }

  private renderState(state: AccountClientState): void {
    if (this.destroyed) return;
    this.stateLayer?.destroy(true);
    this.stateLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const summary = stateSummary(state);
    this.stateLayer.add(addStatusPill(this, 88, 200, summary.title, summary.kind));
    this.stateLayer.add(addText(this, 88, 243, summary.detail, compact ? 21 : 18, state.kind === 'AUTHENTICATED_OFFLINE' ? COLORS.warning : '#d9e2ec'));
    const support = state.kind === 'GUEST_LOCAL'
      ? '로그인하지 않아도 플레이할 수 있습니다. 나중에 계정으로 이전할 수 있습니다.'
      : state.kind === 'AUTHENTICATED_ONLINE'
        ? '전투·모집·성장·소셜 변경이 서버 진행에 저장됩니다.'
        : '오프라인에서는 진행을 확인할 수 있지만 서버 진행을 바꾸는 행동은 사용할 수 없습니다.';
    this.stateLayer.add(addText(this, 88, 275, support, compact ? 17 : 14, '#97a3b2'));
    if (this.googleHost) this.googleHost.style.display = state.kind === 'GUEST_LOCAL' ? 'block' : 'none';
  }

  private renderActions(state: AccountClientState): void {
    this.actionLayer?.destroy(true);
    this.actionLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const h = compact ? 82 : 58;

    if (state.kind === 'GUEST_LOCAL') {
      this.actionLayer.add(addText(this, 110, 382, 'Google 계정으로 로그인', compact ? 27 : 24, '#ffffff'));
      this.actionLayer.add(addText(this, 110, 422, '로그인 후 서버 진행이 비어 있으면 게스트 진행을 그대로 옮길 수 있습니다.', compact ? 18 : 15, '#aeb8c5'));
      this.actionLayer.add(addText(this, 110, 455, '서버에도 진행이 있으면 비교 후 직접 선택합니다. 자동으로 합치지 않습니다.', compact ? 17 : 14, '#8f9aa8'));
      return;
    }

    if (state.kind === 'AUTHENTICATED_OFFLINE') {
      this.actionLayer.add(addText(this, 110, 385, '온라인 연결이 필요합니다.', compact ? 28 : 24, COLORS.warning));
      this.actionLayer.add(addText(this, 110, 425, '현재 화면은 읽기 전용입니다. 서버 연결을 복구한 뒤 진행을 변경할 수 있습니다.', compact ? 19 : 16, '#b8c1cd'));
      this.actionLayer.add(addButton(this, 430, 500, 280, h, '다시 연결', () => { void this.refresh(); }, 0x5f86a7, { tone: 'primary' }));
      this.actionLayer.add(addButton(this, 810, 500, 280, h, '로그아웃', () => { void this.logout(); }, 0x815d61, { tone: 'danger' }));
      return;
    }

    this.actionLayer.add(addText(this, 110, 370, '온라인 계정 관리', compact ? 27 : 24, '#ffffff'));
    this.actionLayer.add(addButton(this, 240, 430, 240, h, '서버 새로고침', () => { void this.refresh(); }, 0x5f86a7, { tone: 'primary' }));
    this.actionLayer.add(addButton(this, 1020, 430, 240, h, '로그아웃', () => { void this.logout(); }, 0x815d61, { tone: 'danger' }));

    if (!this.migrationPreview) {
      this.actionLayer.add(addText(this, 640, 430, '이전할 게스트 진행이 있으면 자동으로 비교 항목이 나타납니다.', compact ? 18 : 15, '#9ba6b4', 'center').setOrigin(0.5));
      return;
    }

    this.actionLayer.add(addButton(this, 390, 505, 250, h, '게스트 진행 다시 비교', () => { void this.prepareMigrationPreview(false); }, 0x687d98));
    this.actionLayer.add(addButton(this, 665, 505, 250, h, this.replacementArmed ? '한 번 더 눌러 교체' : '게스트 진행 적용', () => { void this.applyGuestMigration(); }, 0x70845f, { tone: 'primary', state: this.replacementArmed ? 'warning' : 'default' }));
    this.actionLayer.add(addButton(this, 940, 505, 250, h, '서버 진행 유지', () => this.keepServerProgress(), 0x6e6974, { tone: 'quiet' }));
    if (this.lastMigrationId) {
      this.actionLayer.add(addButton(this, 665, 560, 270, compact ? 72 : 48, '직전 이전 되돌리기', () => { void this.rollbackGuestMigration(); }, 0x8a6262, { tone: 'danger' }));
    }
  }

  private async setupGoogleLogin(): Promise<void> {
    const state = getAccountClientState();
    if (state.kind !== 'GUEST_LOCAL') {
      this.removeGoogleHost();
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
    if (!api) throw new Error('Google 로그인 API를 찾지 못했습니다.');

    this.removeGoogleHost();
    const host = document.createElement('div');
    host.dataset.frontlineGoogleLogin = 'true';
    host.style.position = 'fixed';
    host.style.zIndex = '1000';
    host.style.pointerEvents = 'auto';
    host.style.touchAction = 'auto';
    host.style.transformOrigin = 'center center';
    document.body.appendChild(host);
    this.googleHost = host;
    this.positionGoogleHost();

    api.initialize({
      client_id: config.clientId,
      callback: (response) => { void this.handleGoogleCredential(response); },
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

  private positionGoogleHost = (): void => {
    if (!this.googleHost || !this.game?.canvas) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / INTERNAL_WIDTH, rect.height / INTERNAL_HEIGHT);
    this.googleHost.style.left = `${rect.left + rect.width * 0.5}px`;
    this.googleHost.style.top = `${rect.top + rect.height * (485 / INTERNAL_HEIGHT)}px`;
    this.googleHost.style.transform = `translate(-50%, -50%) scale(${Math.max(0.7, Math.min(1, scale))})`;
  };

  private async handleGoogleCredential(response: GoogleCredentialResponse): Promise<void> {
    if (!response.credential) {
      this.setMessage('Google에서 로그인 정보를 받지 못했습니다.', COLORS.red);
      return;
    }
    this.setMessage('Google 계정을 확인하는 중…', COLORS.muted);
    try {
      await loginWithGoogleCredential(response.credential);
      if (this.destroyed) return;
      this.removeGoogleHost();
      const state = getAccountClientState();
      this.renderState(state);
      this.renderActions(state);
      await this.prepareMigrationPreview(true);
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : 'Google 로그인에 실패했습니다.', COLORS.red);
    }
  }

  private async prepareMigrationPreview(automatic: boolean): Promise<void> {
    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      if (!automatic) this.setMessage('게스트 진행 이전은 온라인 로그인 상태에서만 가능합니다.', COLORS.warning);
      return;
    }
    if (isGuestDeveloperResourceSandboxActive()) {
      this.migrationEnvelope = null;
      this.migrationPreview = null;
      this.replacementArmed = false;
      this.setMessage('개발자 테스트 재화가 적용된 게스트 진행은 서버 계정으로 이전할 수 없습니다.', COLORS.red);
      this.renderActions(getAccountClientState());
      return;
    }
    const guestProgress = await loadGuestProgress();
    if (!hasMeaningfulGuestProgress(guestProgress)) {
      this.migrationEnvelope = null;
      this.migrationPreview = null;
      this.replacementArmed = false;
      this.setMessage(automatic ? '로그인 완료 · 서버 계정 진행을 사용합니다.' : '이전할 게스트 진행이 없습니다.', automatic ? COLORS.green : COLORS.muted);
      this.renderActions(getAccountClientState());
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
      ? '서버 진행이 비어 있습니다. 게스트 진행 적용을 누르면 이전됩니다.'
      : '서버에도 진행이 있습니다. 자동 병합하지 않습니다. 교체 전 두 진행을 확인하세요.';
    this.setMessage(`${summaryText('게스트', preview.guest)}\n${summaryText('서버', preview.server)}\n${guidance}`, preview.serverEmpty ? COLORS.green : COLORS.warning);
    this.renderActions(getAccountClientState());
  }

  private async applyGuestMigration(): Promise<void> {
    if (!this.migrationEnvelope || !this.migrationPreview) {
      await this.prepareMigrationPreview(false);
      if (!this.migrationEnvelope || !this.migrationPreview) return;
    }
    const preview = this.migrationPreview;
    if (!preview.serverEmpty && !this.replacementArmed) {
      this.replacementArmed = true;
      this.setMessage(`${summaryText('게스트', preview.guest)}\n${summaryText('서버', preview.server)}\n주의: 다음 확인은 서버의 게임 진행·재화·보유 정보를 게스트 진행으로 교체합니다. 친구와 PvP 계정 식별 정보는 유지됩니다.`, COLORS.red);
      this.renderActions(getAccountClientState());
      return;
    }
    this.setMessage('게스트 진행을 계정으로 이전하는 중…', COLORS.muted);
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
      this.setMessage('게스트 진행 이전 완료 · 계정 진행으로 전환되었습니다. 직후 상태라면 되돌릴 수 있습니다.', COLORS.green);
      this.renderActions(getAccountClientState());
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : '게스트 진행 이전에 실패했습니다.', COLORS.red);
    }
  }

  private keepServerProgress(): void {
    this.migrationEnvelope = null;
    this.migrationPreview = null;
    this.replacementArmed = false;
    this.setMessage('서버 진행을 유지합니다. 게스트 진행은 이 기기에 그대로 남습니다.', COLORS.green);
    this.renderActions(getAccountClientState());
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
      this.setMessage('직전 이전을 되돌렸습니다. 서버 진행이 이전 상태로 복구되었습니다.', COLORS.green);
      this.renderActions(getAccountClientState());
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : '이전을 되돌릴 수 없습니다.', COLORS.red);
    }
  }

  private async importGuestProfilePreferences(): Promise<void> {
    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      this.setMessage('온라인 로그인 계정에서만 게스트 프로필 취향을 가져올 수 있습니다.', COLORS.warning);
      return;
    }
    this.setMessage('게스트 프로필 장착 취향을 확인하는 중…', COLORS.muted);
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
      this.setMessage('게스트 프로필 장착 취향을 가져왔습니다. 서버에서 해금되지 않은 장식은 추가하지 않았습니다.', COLORS.green);
    } catch (error) {
      if (!this.destroyed) this.setMessage(error instanceof Error ? error.message : '게스트 프로필 가져오기에 실패했습니다.', COLORS.red);
    }
  }

  private async resetGuestLocalAccount(): Promise<void> {
    if (typeof window === 'undefined') return;
    const confirmation = window.prompt('이 기기의 게스트 진행, 재화, 도감, 모집, 성장, 기록, 게스트 프로필을 모두 삭제합니다. 로그인 서버 계정은 변경하지 않습니다.\n초기화하려면 RESET을 입력하세요.');
    if (confirmation === null) return;
    if (confirmation.trim() !== 'RESET') {
      this.setMessage('게스트 초기화를 취소했습니다. RESET을 정확히 입력해야 합니다.', COLORS.warning);
      return;
    }
    this.setMessage('게스트 로컬 저장을 초기화하는 중…', COLORS.muted);
    const reset = await resetGuestLocalAccountData();
    if (!reset) {
      this.setMessage('게스트 저장 초기화에 실패했습니다. 브라우저 저장소를 확인하세요.', COLORS.red);
      return;
    }
    this.setMessage('게스트 로컬 저장을 초기화했습니다. 서버 계정은 변경하지 않았습니다.', COLORS.green);
    window.setTimeout(() => window.location.reload(), 250);
  }

  private async applyDeveloperCode(): Promise<void> {
    if (getAccountClientState().kind !== 'GUEST_LOCAL') {
      this.setMessage('개발자 테스트 도구는 게스트 로컬 테스트에서만 사용할 수 있습니다.', COLORS.warning);
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
      this.setMessage('개발자 테스트 재화를 적용했습니다. 이 게스트 저장은 서버 이전이 차단됩니다.', COLORS.green);
      window.setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      this.setMessage(error instanceof Error ? error.message : '개발자 테스트 재화 적용에 실패했습니다.', COLORS.red);
    }
  }

  private async refresh(): Promise<void> {
    const state = getAccountClientState();
    if (state.kind === 'GUEST_LOCAL') {
      this.setMessage('게스트 상태입니다. 로그인 후 서버 계정을 새로고침할 수 있습니다.', COLORS.muted);
      return;
    }
    this.setMessage('서버 계정 확인 중…', COLORS.muted);
    const remote = await refreshAuthenticatedAccount();
    if (this.destroyed) return;
    const next = getAccountClientState();
    this.renderState(next);
    this.renderActions(next);
    this.setMessage(remote ? '서버 계정이 최신 상태입니다.' : '서버에 연결하지 못해 읽기 전용 상태로 전환했습니다.', remote ? COLORS.green : COLORS.warning);
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
    const state = getAccountClientState();
    this.renderState(state);
    this.renderActions(state);
    this.setMessage(result.serverRevoked ? '로그아웃했습니다.' : '로컬 로그아웃은 완료했지만 서버 연결 확인에 실패했습니다.', result.serverRevoked ? COLORS.green : COLORS.warning);
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
    window.removeEventListener('resize', this.positionGoogleHost);
    this.removeGoogleHost();
    window.google?.accounts?.id?.cancel();
  }
}

export const __accountCommandSceneTestOnly = {
  stateSummary,
  hasMeaningfulGuestProgress,
  summaryText,
  googleScriptSrc: GOOGLE_GSI_SCRIPT_SRC,
};
