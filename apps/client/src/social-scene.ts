import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { getAccountClientState } from './account-network';
import { getAuthenticatedCoopClientProgress } from './coop-account-progress';
import { ALL_STAGES, getStage } from './prototype';
import { isSortieStageUnlocked } from './stage-navigation';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import {
  acceptFriendCoopInvite,
  acceptFriendRequest,
  blockSocialUser,
  createFriendCoopInvite,
  declineFriendCoopInvite,
  loadSocialSummary,
  removeFriend,
  sendFriendRequest,
  unblockSocialUser,
  updateSocialDisplayName,
  type SocialPublicProfile,
  type SocialSummary,
} from './social-network';
import { isCompactMobileViewport } from './viewport';

type SocialTab = 'FRIENDS' | 'REQUESTS' | 'RECENT' | 'BLOCKED';

const TAB_LABELS: Readonly<Record<SocialTab, string>> = {
  FRIENDS: '친구',
  REQUESTS: '요청·초대',
  RECENT: '최근 플레이어',
  BLOCKED: '차단',
};

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
  const friendly: Readonly<Record<string, string>> = {
    social_target_not_found: '해당 친구 코드를 찾을 수 없습니다.',
    social_self_target: '자기 자신에게는 요청할 수 없습니다.',
    social_blocked: '차단 관계에서는 이 기능을 사용할 수 없습니다.',
    social_already_friends: '이미 친구입니다.',
    social_incoming_request_exists: '상대가 이미 친구 요청을 보냈습니다.',
    social_friend_request_missing: '친구 요청이 더 이상 존재하지 않습니다.',
    social_friend_required: '친구에게만 직접 협동 초대를 보낼 수 있습니다.',
    social_coop_invite_pending: '같은 친구에게 해당 전장 초대가 이미 대기 중입니다.',
    social_coop_invite_expired: '협동 초대가 만료되었습니다.',
    social_coop_room_unavailable: '협동 방이 더 이상 유효하지 않습니다.',
  };
  return friendly[message] ?? message;
}

export class SocialScene extends Phaser.Scene {
  private summary: SocialSummary | null = null;
  private tab: SocialTab = 'FRIENDS';
  private page = 0;
  private selectedStageIndex = 0;
  private contentLayer?: Phaser.GameObjects.Container;
  private statusText?: Phaser.GameObjects.Text;
  private busy = false;

  constructor() { super('social'); }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    addText(this, 45, 30, '친구 · 협동', compact ? 42 : 44, COLORS.cream);
    addText(this, 47, 83, '친구 코드는 계정 식별용 · 자유 채팅 없음 · 차단 우선', compact ? 19 : 16, COLORS.muted);
    addButton(this, 1170, 58, 160, compact ? 78 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    addButton(this, 1040, 117, 210, compact ? 72 : 48, '친구 코드 추가', () => { void this.promptFriendRequest(); }, 0x5f7897);
    addButton(this, 810, 117, 210, compact ? 72 : 48, '닉네임 변경', () => { void this.promptRename(); }, 0x6b628f);
    this.statusText = addText(this, INTERNAL_WIDTH / 2, 684, '소셜 정보 불러오는 중…', compact ? 19 : 15, '#a9b5c5', 'center').setOrigin(0.5);

    (Object.keys(TAB_LABELS) as SocialTab[]).forEach((tab, index) => {
      addButton(this, 185 + index * 220, 172, 200, compact ? 70 : 46, TAB_LABELS[tab], () => {
        this.tab = tab;
        this.page = 0;
        this.render();
      }, tab === this.tab ? 0x7a8fb0 : 0x586275);
    });
    addButton(this, 1030, 172, 90, compact ? 70 : 46, '◀', () => { this.page = Math.max(0, this.page - 1); this.render(); }, 0x586275);
    addButton(this, 1135, 172, 90, compact ? 70 : 46, '▶', () => { this.page += 1; this.render(); }, 0x586275);

    if (getAccountClientState().kind !== 'AUTHENTICATED_ONLINE') {
      this.statusText.setText('친구 기능은 온라인 로그인 후 사용할 수 있습니다.').setColor('#ffd493');
      this.render();
      return;
    }
    void this.refresh();
  }

  private async refresh(message?: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      this.summary = await loadSocialSummary();
      if (!this.scene.isActive()) return;
      this.statusText?.setText(message ?? '온라인 소셜 동기화 완료').setColor('#8ee3aa');
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(errorText(error)).setColor('#ff9a91');
    } finally {
      this.busy = false;
      if (this.scene.isActive()) this.render();
    }
  }

  private render(): void {
    this.contentLayer?.destroy(true);
    this.contentLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    if (!this.summary) {
      const message = getAccountClientState().kind === 'AUTHENTICATED_ONLINE' ? '동기화 중…' : '계정 메뉴에서 로그인하세요.';
      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 365, message, compact ? 28 : 24, '#aeb8c5', 'center').setOrigin(0.5));
      return;
    }

    const self = this.summary.self;
    this.contentLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, 235, 1160, 78, 0x242b38, 0.98).setStrokeStyle(2, 0x58677d, 1));
    this.contentLayer.add(addText(this, 95, 212, `${self.displayName} · ${self.friendCode}`, compact ? 22 : 18, '#ffffff'));
    this.contentLayer.add(addText(this, 95, 245, `내 상태 ${self.online ? '온라인' : '오프라인'} · 프레임 ${self.frameId}`, compact ? 17 : 14, self.online ? '#8ee3aa' : '#a5afbc'));
    this.contentLayer.add(addButton(this, 1090, 235, 180, compact ? 68 : 44, '코드 복사', () => { void this.copyFriendCode(); }, 0x6b628f));

    if (this.tab === 'FRIENDS') this.renderFriends();
    else if (this.tab === 'REQUESTS') this.renderRequests();
    else if (this.tab === 'RECENT') this.renderRecent();
    else this.renderBlocked();
  }

  private pageSlice<T>(items: readonly T[], size = 4): { readonly items: readonly T[]; readonly page: number; readonly count: number } {
    const count = Math.max(1, Math.ceil(items.length / size));
    this.page = Math.min(this.page, count - 1);
    return { items: items.slice(this.page * size, this.page * size + size), page: this.page + 1, count };
  }

  private renderProfileRow(
    profile: SocialPublicProfile,
    y: number,
    subtitle: string,
    actions: readonly { label: string; accent: number; run: () => void }[],
  ): void {
    if (!this.contentLayer) return;
    const compact = isCompactMobileViewport();
    this.contentLayer.add(this.add.rectangle(INTERNAL_WIDTH / 2, y, 1120, 86, 0x242a36, 0.97).setStrokeStyle(2, profile.online ? 0x557d67 : 0x4f5968, 1));
    this.contentLayer.add(addText(this, 105, y - 25, `${profile.displayName} · ${profile.friendCode}`, compact ? 21 : 17, '#ffffff'));
    this.contentLayer.add(addText(this, 105, y + 9, `${profile.online ? '● 온라인' : '○ 오프라인'} · ${subtitle}`, compact ? 16 : 13, profile.online ? '#8ee3aa' : '#a8b1bd'));
    actions.slice(0, 3).forEach((action, index) => {
      this.contentLayer!.add(addButton(this, 820 + index * 145, y, 132, compact ? 66 : 46, action.label, action.run, action.accent));
    });
  }

  private renderFriends(): void {
    if (!this.summary || !this.contentLayer) return;
    const progress = getAuthenticatedCoopClientProgress();
    const eligibleStages = progress
      ? ALL_STAGES.filter((stage) => stage.multiplayerPolicy === 'SOLO_OR_COOP' && isSortieStageUnlocked(stage.id, progress.clearedStageIds))
      : [];
    this.selectedStageIndex = Math.min(this.selectedStageIndex, Math.max(0, eligibleStages.length - 1));
    const selectedStage = eligibleStages[this.selectedStageIndex];
    const stageLabel = selectedStage ? `${selectedStage.name} · ${this.selectedStageIndex + 1}/${eligibleStages.length}` : '협동 가능 전장 없음';
    this.contentLayer.add(addText(this, 100, 294, `직접 협동 초대 전장 · ${stageLabel}`, 16, '#d4c28e'));
    this.contentLayer.add(addButton(this, 935, 294, 90, 42, '◀', () => { if (eligibleStages.length) { this.selectedStageIndex = (this.selectedStageIndex - 1 + eligibleStages.length) % eligibleStages.length; this.render(); } }, 0x586275));
    this.contentLayer.add(addButton(this, 1040, 294, 90, 42, '▶', () => { if (eligibleStages.length) { this.selectedStageIndex = (this.selectedStageIndex + 1) % eligibleStages.length; this.render(); } }, 0x586275));
    const page = this.pageSlice(this.summary.friends);
    this.contentLayer.add(addText(this, 1160, 294, `${page.page}/${page.count}`, 14, '#9ca8b8', 'right').setOrigin(1, 0));
    if (page.items.length === 0) {
      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 450, '아직 친구가 없습니다. 친구 코드로 요청을 보내세요.', 23, '#abb5c2', 'center').setOrigin(0.5));
      return;
    }
    page.items.forEach((profile, index) => this.renderProfileRow(profile, 355 + index * 92, '친구', [
      { label: '협동 초대', accent: 0x5f7897, run: () => { if (selectedStage) void this.inviteFriend(profile, selectedStage.id); } },
      { label: '삭제', accent: 0x75685a, run: () => { void this.runAndRefresh(() => removeFriend(profile.friendCode), '친구를 삭제했습니다.'); } },
      { label: '차단', accent: 0x8d5f64, run: () => { void this.runAndRefresh(() => blockSocialUser(profile.friendCode), '차단했습니다.'); } },
    ]));
  }

  private renderRequests(): void {
    if (!this.summary || !this.contentLayer) return;
    const incoming = this.summary.incomingRequests;
    const invites = this.summary.coopInvites;
    this.contentLayer.add(addText(this, 100, 294, `받은 친구 요청 ${incoming.length} · 협동 초대 ${invites.length}`, 16, '#d4c28e'));
    const merged: readonly ({ kind: 'REQUEST'; profile: SocialPublicProfile } | { kind: 'INVITE'; inviteId: string; profile: SocialPublicProfile; stageId: string })[] = [
      ...incoming.map((profile) => ({ kind: 'REQUEST' as const, profile })),
      ...invites.map((invite) => ({ kind: 'INVITE' as const, inviteId: invite.inviteId, profile: invite.inviter, stageId: invite.stageId })),
    ];
    const page = this.pageSlice(merged);
    if (page.items.length === 0) {
      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 450, '대기 중인 요청이나 초대가 없습니다.', 23, '#abb5c2', 'center').setOrigin(0.5));
      return;
    }
    page.items.forEach((entry, index) => {
      if (entry.kind === 'REQUEST') {
        this.renderProfileRow(entry.profile, 355 + index * 92, '친구 요청', [
          { label: '수락', accent: 0x5f8f75, run: () => { void this.runAndRefresh(() => acceptFriendRequest(entry.profile.friendCode), '친구 요청을 수락했습니다.'); } },
          { label: '차단', accent: 0x8d5f64, run: () => { void this.runAndRefresh(() => blockSocialUser(entry.profile.friendCode), '요청자를 차단했습니다.'); } },
        ]);
      } else {
        const stageName = (() => { try { return getStage(entry.stageId).name; } catch { return entry.stageId; } })();
        this.renderProfileRow(entry.profile, 355 + index * 92, `협동 초대 · ${stageName}`, [
          { label: '참가', accent: 0x5f8f75, run: () => { void this.acceptInvite(entry.inviteId); } },
          { label: '거절', accent: 0x75685a, run: () => { void this.runAndRefresh(() => declineFriendCoopInvite(entry.inviteId), '협동 초대를 거절했습니다.'); } },
          { label: '차단', accent: 0x8d5f64, run: () => { void this.runAndRefresh(() => blockSocialUser(entry.profile.friendCode), '초대자를 차단했습니다.'); } },
        ]);
      }
    });
  }

  private renderRecent(): void {
    if (!this.summary || !this.contentLayer) return;
    const page = this.pageSlice(this.summary.recentPlayers);
    this.contentLayer.add(addText(this, 100, 294, `최근 함께 플레이한 지휘관 · ${this.summary.recentPlayers.length}명`, 16, '#d4c28e'));
    if (page.items.length === 0) {
      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 450, '최근 협동 플레이어가 없습니다.', 23, '#abb5c2', 'center').setOrigin(0.5));
      return;
    }
    page.items.forEach((entry, index) => {
      const stageName = (() => { try { return getStage(entry.lastStageId).name; } catch { return entry.lastStageId; } })();
      const actions = entry.interactionAllowed ? [
        { label: '친구 요청', accent: 0x5f7897, run: () => { void this.runAndRefresh(() => sendFriendRequest(entry.profile.friendCode), '친구 요청을 보냈습니다.'); } },
        { label: '차단', accent: 0x8d5f64, run: () => { void this.runAndRefresh(() => blockSocialUser(entry.profile.friendCode), '차단했습니다.'); } },
      ] : [];
      this.renderProfileRow(entry.profile, 355 + index * 92, `${stageName} · 함께 ${entry.playCount}회`, actions);
    });
  }

  private renderBlocked(): void {
    if (!this.summary || !this.contentLayer) return;
    const page = this.pageSlice(this.summary.blocked);
    this.contentLayer.add(addText(this, 100, 294, `차단한 지휘관 · ${this.summary.blocked.length}명`, 16, '#d4c28e'));
    if (page.items.length === 0) {
      this.contentLayer.add(addText(this, INTERNAL_WIDTH / 2, 450, '차단한 플레이어가 없습니다.', 23, '#abb5c2', 'center').setOrigin(0.5));
      return;
    }
    page.items.forEach((profile, index) => this.renderProfileRow(profile, 355 + index * 92, '친구 요청·직접 초대·빠른 통신 제한', [
      { label: '차단 해제', accent: 0x5f8f75, run: () => { void this.runAndRefresh(() => unblockSocialUser(profile.friendCode), '차단을 해제했습니다.'); } },
    ]));
  }

  private async inviteFriend(profile: SocialPublicProfile, stageId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.statusText?.setText(`${profile.displayName}에게 협동 초대를 만드는 중…`).setColor('#a9b5c5');
    try {
      const result = await createFriendCoopInvite(stageId, profile.friendCode);
      if (!this.scene.isActive()) return;
      this.scene.start('friend-coop-lobby', { websocketPath: result.hostPath });
    } catch (error) {
      this.busy = false;
      this.statusText?.setText(errorText(error)).setColor('#ff9a91');
    }
  }

  private async acceptInvite(inviteId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.statusText?.setText('협동 초대를 수락하는 중…').setColor('#a9b5c5');
    try {
      const result = await acceptFriendCoopInvite(inviteId);
      if (!this.scene.isActive()) return;
      this.scene.start('friend-coop-lobby', { websocketPath: result.guestPath });
    } catch (error) {
      this.busy = false;
      this.statusText?.setText(errorText(error)).setColor('#ff9a91');
      void this.refresh();
    }
  }

  private async runAndRefresh(action: () => Promise<unknown>, success: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await action();
      this.busy = false;
      await this.refresh(success);
    } catch (error) {
      this.busy = false;
      this.statusText?.setText(errorText(error)).setColor('#ff9a91');
    }
  }

  private async promptFriendRequest(): Promise<void> {
    if (typeof window === 'undefined') return;
    const code = window.prompt('친구 코드(FS-XXXXXXXX)를 입력하세요.');
    if (!code) return;
    await this.runAndRefresh(() => sendFriendRequest(code), '친구 요청을 보냈습니다.');
  }

  private async promptRename(): Promise<void> {
    if (!this.summary || typeof window === 'undefined') return;
    const name = window.prompt('새 닉네임을 입력하세요. (2~20자)', this.summary.self.displayName);
    if (!name) return;
    await this.runAndRefresh(() => updateSocialDisplayName(name), '닉네임을 변경했습니다.');
  }

  private async copyFriendCode(): Promise<void> {
    if (!this.summary) return;
    try {
      await navigator.clipboard.writeText(this.summary.self.friendCode);
      this.statusText?.setText('친구 코드를 복사했습니다.').setColor('#8ee3aa');
    } catch {
      if (typeof window !== 'undefined') window.prompt('친구 코드', this.summary.self.friendCode);
    }
  }
}
