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
import { loginWithLocalCredentials, registerLocalCredentials } from './local-login.ts';
import { loadGuestProgress, type GuestProgress } from './save.ts';
import {
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

const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  gold: '골드',
  evo_fragment: '진화 조각',
  evo_core: '진화 핵',
  evo_crown: '진화 왕관',
  soul_essence: '혼의 파편',
  summon_crystal: '모집 결정',
  sweep_ticket: '소탕권',
};

const ACCOUNT_ACTION_FAILED_MESSAGE = '계정 작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const INTERNAL_ACCOUNT_ERROR_MARKER = /(?:https?:\/\/|\b(?:http|api|fetch|network|json|token|session|auth|origin|d1|sqlite|migration|request|response)\b|failed\s+to\s+fetch|[A-Za-z_][A-Za-z0-9_.:/-]{2,})/i;

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
  return `${label} · 메인 ${summary.mainClearCount} · 특수 ${summary.specialClearCount} · 동료 ${summary.ownedCharacterCount}${resource ? ` · ${resource}` : ''}`;
}

function accountConnectionMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message || !/[가-힣]/.test(message) || INTERNAL_ACCOUNT_ERROR_MARKER.test(message)) {
    return ACCOUNT_ACTION_FAILED_MESSAGE;
  }
  return message;
}

function stateSummary(state: AccountClientState): { readonly title: string; readonly detail: string; readonly kind: 'neutral' | 'online' | 'offline' } {
  if (state.kind === 'GUEST_LOCAL') {
    return { title: '게스트 지휘관', detail: '이 기기의 로컬 저장으로 플레이 중입니다.', kind: 'neutral' };
  }
  if (state.kind === 'AUTHENTICATED_ONLINE') {
    return { title: '전용 계정 · 온라인', detail: '서버 진행과 동기화되어 있습니다.', kind: 'online' };
  }
  return {
    title: '전용 계정 · 오프라인',
    detail: state.remote ? '마지막으로 동기화된 진행을 읽기 전용으로 보고 있습니다.' : '저장된 서버 진행을 읽을 수 없습니다. 인터넷 연결이 필요합니다.',
    kind: 'offline',
  };
}

export class AccountCommandScene extends Phaser.Scene {
  private stateLayer?: Phaser.GameObjects.Container;
  private actionLayer?: Phaser.GameObjects.Container;
  private messageText?: Phaser.GameObjects.Text;
  private credentialHost: HTMLDivElement | null = null;
  private usernameInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private unsubscribeState: (() => void) | null = null;
  private destroyed = false;
  private authBusy = false;
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
    addText(this, 54, 84, '전용 계정으로 서버 진행을 저장하거나 게스트 진행을 이전한다.', compact ? 20 : 17, COLORS.muted);
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
    addButton(this, 300, 674, 300, compact ? 82 : 54, '게스트 저장 초기화', () => { void this.resetGuestLocalAccount(); }, 0x8a6262, { tone: 'danger' });
    addText(this, 500, 674, '이 기기의 로컬 게스트 저장만 삭제합니다. 로그인 계정의 서버 진행은 바뀌지 않습니다.', compact ? 16 : 13, '#8d96a3')
      .setOrigin(0, 0.5)
      .setWordWrapWidth(680);

    this.unsubscribeState = subscribeAccountClientState((state) => {
      this.renderState(state);
      this.renderActions(state);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    window.addEventListener('resize', this.positionCredentialHost);
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await restoreAuthenticatedAccountSession();
      if (this.destroyed) return;
      const state = getAccountClientState();
      this.renderState(state);
      this.renderActions(state);
      if (state.kind === 'AUTHENTICATED_ONLINE') await this.prepareMigrationPreview(true);
      else this.setMessage('아이디와 비밀번호로 전용 계정을 만들거나 로그인할 수 있습니다.', COLORS.blue);
    } catch (error) {
      if (!this.destroyed) this.setMessage(accountConnectionMessage(error), COLORS.warning);
    }
  }

  private renderState(state: AccountClientState): void {
    if (this.destroyed) return;
    this.stateLayer?.destroy(true);
    this.stateLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const summary = stateSummary(state);
    this.stateLayer.add(addStatusPill(this, 88, 200, summary.title, summary.kind));
    this.stateLayer.add(addText(this, 88, 243, summary.detail, compact ? 21 : 18, state.kind === 'AUTHENTICATED_OFFLINE_CACHE' ? COLORS.warning : '#d9e2ec'));
    const support = state.kind === 'GUEST_LOCAL'
      ? '로그인하지 않아도 플레이할 수 있습니다. 나중에 전용 계정으로 진행을 이전할 수 있습니다.'
      : state.kind === 'AUTHENTICATED_ONLINE'
        ? '전투·모집·성장·소셜·멀티플레이 진행이 이 계정에 연결됩니다.'
        : '오프라인에서는 진행을 확인할 수 있지만 서버 진행을 바꾸는 행동은 사용할 수 없습니다.';
    this.stateLayer.add(addText(this, 88, 275, support, compact ? 17 : 14, '#97a3b2'));
    this.setCredentialHostVisible(state.kind === 'GUEST_LOCAL');
  }

  private renderActions(state: AccountClientState): void {
    this.actionLayer?.destroy(true);
    this.actionLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const h = compact ? 82 : 58;

    if (state.kind === 'GUEST_LOCAL') {
      this.actionLayer.add(addText(this, 110, 372, '전용 계정 로그인', compact ? 27 : 24, '#ffffff'));
      this.actionLayer.add(addText(this, 110, 410, '아이디 4~24자 · 비밀번호 10~128자. 새 계정 생성과 기존 계정 로그인을 지원합니다.', compact ? 18 : 15, '#aeb8c5'));
      this.actionLayer.add(addText(this, 110, 445, '로그인 뒤 게스트 진행과 서버 진행을 비교한 후 직접 이전 여부를 선택합니다.', compact ? 17 : 14, '#8f9aa8'));
      this.ensureCredentialHost();
      return;
    }

    this.setCredentialHostVisible(false);
    if (state.kind === 'AUTHENTICATED_OFFLINE_CACHE') {
      this.actionLayer.add(addText(this, 110, 385, '온라인 연결이 필요합니다.', compact ? 28 : 24, COLORS.warning));
      this.actionLayer.add(addText(this, 110, 425, '현재 화면은 읽기 전용입니다. 서버 연결을 복구한 뒤 진행을 변경할 수 있습니다.', compact ? 19 : 16, '#b8c1cd'));
      this.actionLayer.add(addButton(this, 430, 500, 280, h, '다시 연결', () => { void this.refresh(); }, 0x5f86a7, { tone: 'primary' }));
      this.actionLayer.add(addButton(this, 810, 500, 280, h, '로그아웃', () => { void this.logout(); }, 0x815d61, { tone: 'danger' }));
      return;
    }

    this.actionLayer.add(addText(this, 110, 370, '전용 계정 관리', compact ? 27 : 24, '#ffffff'));
    this.actionLayer.add(addButton(this, 230, 430, 220, h, '서버 새로고침', () => { void this.refresh(); }, 0x5f86a7, { tone: 'primary' }));
    this.actionLayer.add(addButton(this, 640, 430, 270, h, '게스트 장식 취향 가져오기', () => { void this.importGuestProfilePreferences(); }, 0x6f7194, { tone: 'quiet' }));
    this.actionLayer.add(addButton(this, 1050, 430, 220, h, '로그아웃', () => { void this.logout(); }, 0x815d61, { tone: 'danger' }));

    if (!this.migrationPreview) {
      this.actionLayer.add(addText(this, 640, 510, '이전할 게스트 진행이 있으면 비교 항목이 자동으로 나타납니다.', compact ? 18 : 15, '#9ba6b4', 'center').setOrigin(0.5));
      return;
    }

    this.actionLayer.add(addButton(this, 390, 510, 250, h, '게스트 진행 다시 비교', () => { void this.prepareMigrationPreview(false); }, 0x687d98));
    this.actionLayer.add(addButton(this, 665, 510, 250, h, this.replacementArmed ? '한 번 더 눌러 교체' : '게스트 진행 적용', () => { void this.applyGuestMigration(); }, 0x70845f, { tone: 'primary', state: this.replacementArmed ? 'warning' : 'default' }));
    this.actionLayer.add(addButton(this, 940, 510, 250, h, '서버 진행 유지', () => this.keepServerProgress(), 0x6e6974, { tone: 'quiet' }));
    if (this.lastMigrationId) {
      this.actionLayer.add(addButton(this, 665, 562, 270, compact ? 72 : 46, '직전 이전 되돌리기', () => { void this.rollbackGuestMigration(); }, 0x8a6262, { tone: 'danger' }));
    }
  }

  private ensureCredentialHost(): void {
    if (this.credentialHost) {
      this.setCredentialHostVisible(true);
      return;
    }
    const host = document.createElement('div');
    host.dataset.frontlineLocalAccount = 'true';
    Object.assign(host.style, {
      position: 'fixed',
      zIndex: '1000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      boxSizing: 'border-box',
      width: '760px',
      gap: '10px',
      padding: '10px 12px',
      border: '1px solid rgba(184, 198, 214, 0.45)',
      borderRadius: '12px',
      background: 'rgba(18, 25, 34, 0.96)',
      boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
      transformOrigin: 'center center',
      pointerEvents: 'auto',
    });

    const username = document.createElement('input');
    username.type = 'text';
    username.autocomplete = 'username';
    username.placeholder = '아이디';
    username.maxLength = 24;
    username.spellcheck = false;

    const password = document.createElement('input');
    password.type = 'password';
    password.autocomplete = 'current-password';
    password.placeholder = '비밀번호';
    password.maxLength = 128;

    for (const input of [username, password]) {
      Object.assign(input.style, {
        flex: '1 1 170px',
        minWidth: '0',
        width: 'auto',
        height: '38px',
        padding: '0 12px',
        boxSizing: 'border-box',
        borderRadius: '8px',
        border: '1px solid #58697d',
        background: '#111923',
        color: '#f7f0df',
        fontSize: '15px',
        outline: 'none',
      });
    }

    const login = this.makeCredentialButton('로그인', () => { void this.submitCredentials('login'); });
    const register = this.makeCredentialButton('새 계정 만들기', () => { void this.submitCredentials('register'); });
    password.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void this.submitCredentials('login');
    });

    host.append(username, password, login, register);
    document.body.appendChild(host);
    this.credentialHost = host;
    this.usernameInput = username;
    this.passwordInput = password;
    this.positionCredentialHost();
  }

  private makeCredentialButton(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, {
      flex: label === '로그인' ? '1 1 120px' : '1 1 160px',
      minWidth: '112px',
      maxWidth: '220px',
      height: '40px',
      padding: '0 16px',
      boxSizing: 'border-box',
      borderRadius: '8px',
      border: '1px solid #71869d',
      background: '#34495f',
      color: '#ffffff',
      fontWeight: '700',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    });
    button.addEventListener('click', action);
    return button;
  }

  private setCredentialHostVisible(visible: boolean): void {
    if (!visible) {
      if (this.credentialHost) this.credentialHost.style.display = 'none';
      return;
    }
    this.ensureCredentialHost();
    if (this.credentialHost) this.credentialHost.style.display = 'flex';
    this.positionCredentialHost();
  }

  private positionCredentialHost = (): void => {
    if (!this.credentialHost || !this.game?.canvas) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const canvasScale = Math.min(rect.width / INTERNAL_WIDTH, rect.height / INTERNAL_HEIGHT);
    const appliedScale = Math.max(0.62, Math.min(1, canvasScale));
    const contentWidth = INTERNAL_WIDTH * canvasScale;
    const contentHeight = INTERNAL_HEIGHT * canvasScale;
    const contentLeft = rect.left + (rect.width - contentWidth) * 0.5;
    const contentTop = rect.top + (rect.height - contentHeight) * 0.5;
    const visibleLeft = Math.max(0, contentLeft);
    const visibleRight = Math.min(window.innerWidth, contentLeft + contentWidth);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const renderedWidthLimit = Math.max(0, visibleWidth - 24);
    const logicalWidth = renderedWidthLimit > 0 ? Math.min(760, renderedWidthLimit / appliedScale) : 760;
    this.credentialHost.style.width = `${Math.max(1, logicalWidth)}px`;
    this.credentialHost.style.maxWidth = `${Math.max(1, logicalWidth)}px`;
    this.credentialHost.style.left = `${contentLeft + contentWidth * 0.5}px`;
    this.credentialHost.style.top = `${contentTop + 500 * canvasScale}px`;
    this.credentialHost.style.transform = `translate(-50%, -50%) scale(${appliedScale})`;
  };

  private async submitCredentials(mode: 'login' | 'register'): Promise<void> {
    if (this.authBusy) return;
    const username = this.usernameInput?.value ?? '';
    const password = this.passwordInput?.value ?? '';
    this.authBusy = true;
    this.setMessage(mode === 'register' ? '전용 계정을 만드는 중…' : '로그인하는 중…', COLORS.muted);
    try {
      if (mode === 'register') await registerLocalCredentials(username, password);
      else await loginWithLocalCredentials(username, password);
      if (this.destroyed) return;
      if (this.passwordInput) this.passwordInput.value = '';
      const state = getAccountClientState();
      this.renderState(state);
      this.renderActions(state);
      await this.prepareMigrationPreview(true);
    } catch (error) {
      if (!this.destroyed) this.setMessage(accountConnectionMessage(error), COLORS.warning);
    } finally {
      this.authBusy = false;
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
      this.setMessage('이 게스트 저장은 계정 이전을 사용할 수 없습니다.', COLORS.warning);
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
      if (!this.destroyed) this.setMessage(accountConnectionMessage(error), COLORS.red);
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
      if (!this.destroyed) this.setMessage(accountConnectionMessage(error), COLORS.red);
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
      if (!this.destroyed) this.setMessage(accountConnectionMessage(error), COLORS.red);
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
  }

  private setMessage(message: string, color: string): void {
    this.messageText?.setText(message).setColor(color);
  }

  private removeCredentialHost(): void {
    this.credentialHost?.remove();
    this.credentialHost = null;
    this.usernameInput = null;
    this.passwordInput = null;
  }

  private cleanup(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribeState?.();
    this.unsubscribeState = null;
    window.removeEventListener('resize', this.positionCredentialHost);
    this.removeCredentialHost();
  }
}

export const __accountCommandSceneTestOnly = {
  stateSummary,
  hasMeaningfulGuestProgress,
  summaryText,
  accountConnectionMessage,
};