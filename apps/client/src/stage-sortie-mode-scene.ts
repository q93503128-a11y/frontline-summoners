import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress.ts';
import { getClientSettings } from './client-settings.ts';
import { joinPublicCoopMatchmaking } from './coop-matchmaking-network.ts';
import { getGuestStageFormationViolation } from './player-loadout.ts';
import { STAGES, getStage, type PrototypeStage } from './prototype.ts';
import { type GuestProgress } from './save.ts';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import {
  getCollectionStagePageIndexForStage,
  getStageCollectionForStage,
  isSortieStageUnlocked,
} from './stage-navigation.ts';
import { createFriendCoopInvite, loadSocialSummary, type SocialPublicProfile } from './social-network.ts';
import { getPreStageStory } from './story-content.ts';
import { shouldPresentStory } from './story-progress.ts';
import { isCompactMobileViewport } from './viewport.ts';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  discoveredEnemyIds: [],
};

function formatPermille(permille: number): string {
  const percent = permille / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
  const labels: Readonly<Record<string, string>> = {
    social_friend_required: '친구에게만 협동 초대를 보낼 수 있습니다.',
    social_coop_invite_pending: '이 친구에게 같은 전장 초대가 이미 대기 중입니다.',
    social_blocked: '차단 관계에서는 협동 초대를 보낼 수 없습니다.',
    public_coop_already_matched: '이미 공개 협동 상대가 배정되었습니다.',
    public_coop_room_unavailable: '배정된 공개 협동 방을 복구하지 못했습니다.',
    stage_not_coop_eligible: '이 전장은 협동할 수 없습니다.',
  };
  return labels[message] ?? message;
}

export class StageSortieModeScene extends Phaser.Scene {
  private stage: PrototypeStage = STAGES[0]!;
  private progress: GuestProgress = EMPTY_PROGRESS;
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private content: Phaser.GameObjects.Container | undefined;
  private status: Phaser.GameObjects.Text | undefined;
  private friends: readonly SocialPublicProfile[] = [];
  private friendPage = 0;
  private busy = false;

  constructor() { super('sortie-mode'); }

  init(data: { stageId?: string } = {}): void {
    this.stage = getStage(data.stageId ?? STAGES[0]!.id);
    this.progress = EMPTY_PROGRESS;
    this.authority = 'GUEST_LOCAL';
    this.content = undefined;
    this.status = undefined;
    this.friends = [];
    this.friendPage = 0;
    this.busy = false;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 50, 34, '출정 방식', compact ? 44 : 46, COLORS.cream);
    addText(this, 52, 88, `${this.stage.name} · 난이도 ${this.stage.difficulty}/12`, compact ? 24 : 20, '#d8e0eb');
    addButton(this, 1170, 62, 160, compact ? 80 : 50, '스테이지', () => this.returnToStage(), 0x586275);
    this.status = addText(this, INTERNAL_WIDTH / 2, 650, '진행 정보를 확인하는 중…', compact ? 20 : 16, '#a9b5c5', 'center').setOrigin(0.5);
    this.renderLoading();

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      this.authority = view.authority;
      if (!isSortieStageUnlocked(this.stage.id, view.progress.clearedStageIds, view.progress.specialClearedStageIds)) {
        this.status?.setText('현재 진행도에서는 이 전장에 출정할 수 없습니다.').setColor('#ff9a91');
        this.renderBlocked('전장 잠김');
        return;
      }
      const formationViolation = getGuestStageFormationViolation(this.stage.id, view.progress);
      if (formationViolation) {
        this.status?.setText(formationViolation).setColor('#ffd493');
        this.renderBlocked('편성 수정 필요', true);
        return;
      }
      if (view.authority === 'ACCOUNT_OFFLINE_CACHE') {
        this.status?.setText('로그인 계정 전투·협동은 서버 연결이 필요합니다.').setColor('#ffd493');
      } else {
        this.status?.setText(view.authority === 'ACCOUNT_ONLINE' ? '계정 서버 진행 · 출정 방식 선택' : '게스트 로컬 진행 · 출정 방식 선택').setColor(view.authority === 'ACCOUNT_ONLINE' ? '#8ee3aa' : '#a9b5c5');
      }
      this.renderHome();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.status?.setText(friendlyError(error)).setColor('#ff9a91');
      this.renderBlocked('진행 정보 오류');
    });
  }

  private renderLoading(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 350, '출정 조건 확인 중…', 28, '#b8c2cf', 'center').setOrigin(0.5));
  }

  private renderBlocked(label: string, deckAction = false): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 310, label, 34, '#ffd3a6', 'center').setOrigin(0.5));
    this.content.add(addButton(this, INTERNAL_WIDTH / 2, 420, 300, 64, deckAction ? '편성으로 이동' : '스테이지로 돌아가기', () => {
      if (deckAction) this.scene.start('deck');
      else this.returnToStage();
    }, deckAction ? 0x6d88a7 : 0x586275));
  }

  private renderHome(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const coop = this.stage.multiplayerPolicy === 'SOLO_OR_COOP';
    const scaling = this.stage.coopStatScaling;

    this.content.add(this.add.rectangle(INTERNAL_WIDTH / 2, 330, compact ? 1020 : 940, 390, 0x242b38, 0.98).setStrokeStyle(3, coop ? 0x6688a7 : 0x6c7380, 1));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 185, this.stage.subtitle, compact ? 28 : 24, '#fff4cf', 'center').setOrigin(0.5).setWordWrapWidth(850));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 235, `전장 ${this.stage.mapLength}m · ${coop ? 'SOLO_OR_COOP' : 'SOLO ONLY'}`, compact ? 20 : 17, '#aebbd0', 'center').setOrigin(0.5));

    if (coop) {
      this.content.add(addText(
        this,
        INTERNAL_WIDTH / 2,
        282,
        `협동 보정 · 적 HP ${formatPermille(scaling.enemyHpPermille)} · ATK ${formatPermille(scaling.enemyAttackPermille)} · 적 기지 ${formatPermille(scaling.enemyBaseHpPermille)}`,
        compact ? 18 : 15,
        '#d7bda7',
        'center',
      ).setOrigin(0.5));
    }

    const y = coop ? 395 : 385;
    this.content.add(addButton(this, coop ? 330 : INTERNAL_WIDTH / 2, y, 270, compact ? 88 : 68, '혼자 시작', () => this.startSolo(), 0x6d88a7));

    if (coop) {
      const friendLabel = this.authority === 'GUEST_LOCAL' ? '친구 코드 협동' : this.authority === 'ACCOUNT_ONLINE' ? '친구 초대' : '친구 협동 · 온라인';
      this.content.add(addButton(this, 640, y, 270, compact ? 88 : 68, friendLabel, () => { void this.openFriendCoop(); }, this.authority === 'ACCOUNT_OFFLINE_CACHE' ? 0x454d58 : 0x6b628f));
      const publicLabel = this.authority === 'ACCOUNT_ONLINE' ? '공개 협동' : '공개 협동 · 로그인';
      this.content.add(addButton(this, 950, y, 270, compact ? 88 : 68, publicLabel, () => { void this.startPublicCoop(); }, this.authority === 'ACCOUNT_ONLINE' ? 0x5f7897 : 0x454d58));
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 485, this.authority === 'GUEST_LOCAL'
        ? '게스트는 참가 코드 방을 사용한다. 공개 매칭과 계정 친구 초대는 로그인 후 사용할 수 있다.'
        : this.authority === 'ACCOUNT_ONLINE'
          ? '친구 초대는 이 전장을 그대로 고정해 방을 만들고, 공개 협동은 같은 전장 대기열에 바로 참가한다.'
          : '오프라인 계정 캐시는 읽기 전용이다. 서버 연결 후 전투·협동을 시작할 수 있다.', compact ? 18 : 15, '#9faaba', 'center').setOrigin(0.5).setWordWrapWidth(900));
    }
  }

  private startSolo(): void {
    if (this.authority === 'ACCOUNT_OFFLINE_CACHE') {
      this.scene.start('account');
      return;
    }
    const story = getPreStageStory(this.stage.id);
    if (story && shouldPresentStory(story, getClientSettings().autoSkipStory)) {
      this.scene.start('story', { storyId: story.id, nextScene: 'battle', nextData: { stageId: this.stage.id } });
      return;
    }
    this.scene.start('battle', { stageId: this.stage.id });
  }

  private async openFriendCoop(): Promise<void> {
    if (this.busy) return;
    if (this.authority === 'ACCOUNT_OFFLINE_CACHE') {
      this.scene.start('account');
      return;
    }
    if (this.authority === 'GUEST_LOCAL') {
      this.scene.start('coop-lobby', { preferredStageId: this.stage.id });
      return;
    }

    this.busy = true;
    this.status?.setText('친구 목록 불러오는 중…').setColor('#a9b5c5');
    try {
      const summary = await loadSocialSummary();
      if (!this.scene.isActive()) return;
      this.friends = summary.friends;
      this.friendPage = 0;
      this.status?.setText(this.friends.length > 0 ? '초대할 친구를 선택하세요.' : '친구가 없습니다. 친구 메뉴에서 먼저 추가하세요.').setColor(this.friends.length > 0 ? '#8ee3aa' : '#ffd493');
      this.renderFriends();
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(friendlyError(error)).setColor('#ff9a91');
    } finally {
      this.busy = false;
    }
  }

  private renderFriends(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const pageSize = 4;
    const pageCount = Math.max(1, Math.ceil(this.friends.length / pageSize));
    this.friendPage = Math.max(0, Math.min(pageCount - 1, this.friendPage));
    const visible = this.friends.slice(this.friendPage * pageSize, this.friendPage * pageSize + pageSize);

    this.content.add(addText(this, INTERNAL_WIDTH / 2, 160, `${this.stage.name} · 친구 협동 초대`, compact ? 30 : 27, '#fff4cf', 'center').setOrigin(0.5));
    this.content.add(addButton(this, 250, 590, 180, compact ? 80 : 54, '◀ 이전', () => { this.friendPage = Math.max(0, this.friendPage - 1); this.renderFriends(); }, 0x586275));
    this.content.add(addButton(this, 1030, 590, 180, compact ? 80 : 54, '다음 ▶', () => { this.friendPage = Math.min(pageCount - 1, this.friendPage + 1); this.renderFriends(); }, 0x586275));
    this.content.add(addButton(this, INTERNAL_WIDTH / 2, 590, 220, compact ? 80 : 54, '출정 방식으로', () => this.renderHome(), 0x6b628f));
    this.content.add(addText(this, INTERNAL_WIDTH / 2, 548, `${this.friendPage + 1} / ${pageCount}`, 16, '#9ca8b8', 'center').setOrigin(0.5));

    if (visible.length === 0) {
      this.content.add(addText(this, INTERNAL_WIDTH / 2, 350, '초대할 친구가 없습니다.', compact ? 27 : 23, '#abb5c2', 'center').setOrigin(0.5));
      this.content.add(addButton(this, INTERNAL_WIDTH / 2, 430, 260, compact ? 82 : 58, '친구 메뉴 열기', () => this.scene.start('social'), 0x5f7897));
      return;
    }

    visible.forEach((profile, index) => {
      const y = 235 + index * 75;
      this.content!.add(this.add.rectangle(INTERNAL_WIDTH / 2, y, 920, 62, 0x252c38, 0.98).setStrokeStyle(2, profile.online ? 0x5c846a : 0x505966, 1));
      this.content!.add(addText(this, 235, y - 12, `${profile.displayName} · ${profile.friendCode}`, compact ? 20 : 17, '#ffffff'));
      this.content!.add(addText(this, 235, y + 14, profile.online ? '● 온라인' : '○ 오프라인', compact ? 16 : 13, profile.online ? '#8ee3aa' : '#a6afbb'));
      this.content!.add(addButton(this, 1020, y, 180, compact ? 64 : 44, '이 전장 초대', () => { void this.inviteFriend(profile); }, profile.online ? 0x5f7897 : 0x536273));
    });
  }

  private async inviteFriend(profile: SocialPublicProfile): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.status?.setText(`${profile.displayName}에게 ${this.stage.name} 협동 초대 만드는 중…`).setColor('#a9b5c5');
    try {
      const result = await createFriendCoopInvite(this.stage.id, profile.friendCode);
      if (!this.scene.isActive()) return;
      this.scene.start('friend-coop-lobby', { websocketPath: result.hostPath });
    } catch (error) {
      if (this.scene.isActive()) this.status?.setText(friendlyError(error)).setColor('#ff9a91');
    } finally {
      this.busy = false;
    }
  }

  private async startPublicCoop(): Promise<void> {
    if (this.busy) return;
    if (this.authority !== 'ACCOUNT_ONLINE') {
      this.scene.start('account');
      return;
    }
    this.busy = true;
    this.status?.setText(`${this.stage.name} 공개 협동 대기열 참가 중…`).setColor('#a9b5c5');
    try {
      await joinPublicCoopMatchmaking(this.stage.id);
      if (!this.scene.isActive()) return;
      this.scene.start('public-coop-matchmaking');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'public_coop_already_matched' && this.scene.isActive()) {
        this.scene.start('public-coop-matchmaking');
        return;
      }
      if (this.scene.isActive()) this.status?.setText(friendlyError(error)).setColor('#ff9a91');
    } finally {
      this.busy = false;
    }
  }

  private returnToStage(): void {
    const collection = getStageCollectionForStage(this.stage.id);
    this.scene.start('stage-select', {
      collectionId: collection.id,
      page: getCollectionStagePageIndexForStage(collection, this.stage.id),
    });
  }
}
