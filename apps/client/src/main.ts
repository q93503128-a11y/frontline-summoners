import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { loadActiveProgress } from './active-progress';
import { restoreAuthenticatedAccountSession } from './account-network';
import { AccountCommandScene as AccountScene } from './account-command-scene';
import { ReplayBattleScene as BattleScene } from './replay-battle-scene';
import { BaseWeaponScene } from './base-weapon-scene';
import { CatalogScene } from './catalog-scene';
import {
  StoryGuestCoopBattleScene as CoopBattleScene,
  StoryGuestCoopLobbyScene as CoopLobbyScene,
  StoryFriendCoopBattleScene as FriendCoopBattleScene,
  StoryFriendCoopLobbyScene as FriendCoopLobbyScene,
  StoryPublicCoopLobbyScene as PublicCoopLobbyScene,
} from './coop-command-battle-scenes';
import { DeckScene } from './deck-scene';
import { FirstSliceProductionCaptureScene, isFirstSliceCaptureMode } from './first-slice-production-capture-scene.ts';
import { isFirstSliceProductionReviewMode } from './first-slice-production-review-runtime.ts';
import { GrowthScene } from './growth-scene';
import { RecruitmentScene } from './recruitment-scene';
import { BootScene as BaseBootScene, MainMenuScene as BaseMainMenuScene } from './navigation-scenes';
import { ProfileScene } from './profile-scene';
import { PublicCoopMatchmakingScene } from './public-coop-scenes';
import { Pvp2v2BattleScene, Pvp2v2MatchmakingScene } from './pvp-2v2-scenes';
import { PvpHubScene } from './pvp-expanded-hub-scene';
import { FriendlyPvp2v2LobbyScene } from './pvp-friendly-2v2-scene';
import { FriendlyPvpLobbyScene, FriendlyPvpMatchScene } from './pvp-friendly-scenes';
import { PvpLeaderboardScene } from './pvp-leaderboard-scene';
import { PvpMatchmakingScene, PvpMatchScene } from './pvp-scenes';
import { PvpSeasonScene } from './pvp-season-scene';
import { QuirkRecordBattleScene as RecordBattleScene } from './quirk-record-battle-scene';
import { RecordHubScene } from './record-hub-scene';
import { RecordResultScene } from './record-result-scene';
import { getOwnedCharacterIds } from './save';
import { SocialCommandScene as SocialScene } from './social-command-scene';
import { StageHubScene } from './stage-hub-scene';
import { StageSortieModeScene } from './stage-sortie-mode-scene';
import { StoryStageSelectScene as StageSelectScene } from './story-stage-select-scene';
import { ResultScene } from './result-scene';
import { SettingsScene } from './settings-scene';
import { installStorySilhouetteScenePreviews } from './story-silhouette-preview-scenes.ts';
import { StoryScene } from './story-scene';
import { TrustedBattleResultScene } from './trusted-battle-result-scene';
import {
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
} from './scene-ui';
import { SPECIAL_STAGES, STAGES } from './prototype';
import { isCompactMobileViewport } from './viewport';

class BootScene extends BaseBootScene {
  override create(): void {
    this.scene.add('first-slice-capture', FirstSliceProductionCaptureScene, false);
    void restoreAuthenticatedAccountSession().finally(() => {
      if (!this.scene.isActive()) return;
      this.scene.start(isFirstSliceCaptureMode() ? 'first-slice-capture' : 'main-menu');
    });
  }
}

class MainMenuScene extends BaseMainMenuScene {
  override create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();

    addText(this, 66, 46, '전선소환전', compact ? 54 : 60, COLORS.cream);
    addText(this, 70, compact ? 112 : 120, '별난 동료를 모으고, 보급과 타이밍으로 전선을 지휘한다.', compact ? 22 : 20, '#d9e0e9');

    const statusLayer = this.add.container(0, 0);
    const statusPanel = addCommandPanel(this, 1012, 85, compact ? 430 : 420, compact ? 118 : 100, 0x6e7f91, 0x1b222d, 0.92);
    statusLayer.add(statusPanel);
    const authorityText = addText(this, 830, 60, '진행 상태 확인 중…', compact ? 22 : 20, '#ffffff');
    const progressText = addText(this, 830, compact ? 94 : 92, '전선과 동료 정보를 불러오는 중…', compact ? 17 : 15, COLORS.muted);
    statusLayer.add([authorityText, progressText]);

    addSectionHeading(this, 66, 182, '오늘의 작전', 522, 0xc6a75a);
    addSectionHeading(this, 670, 182, '병력 운영', 542, 0x6e91b0);

    addCommandPanel(this, 330, 350, 540, 294, 0xc6a75a, 0x20262f, 0.95);
    addText(this, 104, 244, '전선 지휘', compact ? 31 : 29, '#fff4d0');
    addText(this, 106, 286, '메인 · SPECIAL · 기록전으로 이어지는 작전 지도', compact ? 19 : 16, '#b9c4d0');
    addText(this, 106, 326, '스테이지마다 솔로/협동 가능 여부와 보상을 확인하고 출정한다.', compact ? 17 : 14, '#8f9aa8').setWordWrapWidth(440);
    addButton(this, 330, 420, 390, compact ? 104 : 84, '출 정 · 전선 지도 열기', () => this.scene.start('stage-hub'), 0xc6a75a, { tone: 'primary' });
    addButton(this, 210, 494, 185, compact ? 78 : 58, '기록전', () => this.scene.start('record-hub'), 0x667e91, { tone: 'quiet' });
    addButton(this, 450, 494, 185, compact ? 78 : 58, '거점 병기', () => this.scene.start('base-weapon'), 0x667e91, { tone: 'quiet' });

    addCommandPanel(this, 950, 350, 560, 294, 0x6e91b0, 0x202833, 0.95);
    addText(this, 704, 244, '전투 준비', compact ? 31 : 29, '#eef5ff');
    addText(this, 706, 286, '편성 → 성장 → 모집 → 도감의 준비 루프', compact ? 19 : 16, '#b9c8d7');
    const actionHeight = compact ? 82 : 62;
    addButton(this, 820, 365, 210, actionHeight, '편 성', () => this.scene.start('deck'), 0x6593b4, { tone: 'primary' });
    addButton(this, 1080, 365, 210, actionHeight, '성 장', () => this.scene.start('growth'), 0x708c68, { tone: 'primary' });
    addButton(this, 820, 450, 210, actionHeight, '모 집', () => this.scene.start('recruitment'), 0x8e6fac);
    addButton(this, 1080, 450, 210, actionHeight, '도 감', () => this.scene.start('catalog'), 0x8a7754);

    addSectionHeading(this, 66, 555, '지휘관 네트워크', 1146, 0x65768c);
    const utilityY = compact ? 635 : 628;
    const utilityHeight = compact ? 84 : 60;
    addButton(this, 150, utilityY, 190, utilityHeight, '프로필 · 업적', () => this.scene.start('profile'), 0x796a91, { tone: 'quiet' });
    addButton(this, 385, utilityY, 190, utilityHeight, 'PvP 대전', () => this.scene.start('pvp-hub'), 0x85634f, { tone: 'quiet' });
    addButton(this, 620, utilityY, 190, utilityHeight, '친구 · 초대', () => this.scene.start('social'), 0x6f668f, { tone: 'quiet' });
    addButton(this, 855, utilityY, 190, utilityHeight, '계 정', () => this.scene.start('account'), 0x6a7b92, { tone: 'quiet' });
    addButton(this, 1090, utilityY, 190, utilityHeight, '설 정', () => this.scene.start('settings'), 0x667984, { tone: 'quiet' });

    if (isFirstSliceProductionReviewMode()) {
      addButton(this, 1030, 162, 360, compact ? 70 : 50, '제작 검수 · 캡처 프리플라이트', () => {
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('capture', 'first-slice');
          window.history.replaceState(null, '', url);
        }
        this.scene.start('first-slice-capture');
      }, 0x8a6f35, { tone: 'quiet', state: 'warning' });
    }

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      const progress = view.progress;
      const owned = getOwnedCharacterIds(progress).length;
      const label = view.authority === 'GUEST_LOCAL'
        ? '게스트 지휘관'
        : view.authority === 'ACCOUNT_ONLINE'
          ? '계정 지휘관 · 온라인'
          : '계정 지휘관 · 오프라인';
      const kind = view.authority === 'ACCOUNT_ONLINE' ? 'online' : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? 'offline' : 'neutral';
      authorityText.setText(label);
      authorityText.setColor(view.authority === 'ACCOUNT_ONLINE' ? COLORS.green : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : '#ffffff');
      progressText.setText(`메인 ${progress.clearedStageIds.length}/${STAGES.length} · SPECIAL ${progress.specialClearedStageIds.length}/${SPECIAL_STAGES.length} · 동료 ${owned}`);
      statusLayer.add(addStatusPill(this, compact ? 1125 : 1142, compact ? 57 : 50, view.authority === 'ACCOUNT_ONLINE' ? '동기화됨' : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? '읽기 전용' : '로컬 저장', kind));
    }).catch(() => {
      if (!this.scene.isActive()) return;
      authorityText.setText('진행 정보를 읽지 못했습니다.').setColor(COLORS.red);
      progressText.setText('계정 또는 로컬 저장 상태를 확인해 주세요.');
    });
  }
}

installStorySilhouetteScenePreviews();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: INTERNAL_WIDTH,
  height: INTERNAL_HEIGHT,
  backgroundColor: '#111722',
  antialias: true,
  pixelArt: false,
  roundPixels: false,
  scene: [BootScene, MainMenuScene, StageHubScene, StageSelectScene, BaseWeaponScene, DeckScene, CatalogScene, BattleScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

game.scene.add('sortie-mode', StageSortieModeScene, false);
game.scene.add('recruitment', RecruitmentScene, false);
game.scene.add('growth', GrowthScene, false);
game.scene.add('coop-lobby', CoopLobbyScene, false);
game.scene.add('coop-battle', CoopBattleScene, false);
game.scene.add('friend-coop-lobby', FriendCoopLobbyScene, false);
game.scene.add('friend-coop-battle', FriendCoopBattleScene, false);
game.scene.add('public-coop-matchmaking', PublicCoopMatchmakingScene, false);
game.scene.add('public-coop-lobby', PublicCoopLobbyScene, false);
game.scene.add('pvp-hub', PvpHubScene, false);
game.scene.add('pvp-matchmaking', PvpMatchmakingScene, false);
game.scene.add('pvp-match', PvpMatchScene, false);
game.scene.add('pvp-friendly-lobby', FriendlyPvpLobbyScene, false);
game.scene.add('pvp-friendly-match', FriendlyPvpMatchScene, false);
game.scene.add('pvp-2v2-matchmaking', Pvp2v2MatchmakingScene, false);
game.scene.add('pvp-2v2-match', Pvp2v2BattleScene, false);
game.scene.add('pvp-friendly-2v2-lobby', FriendlyPvp2v2LobbyScene, false);
game.scene.add('pvp-season', PvpSeasonScene, false);
game.scene.add('pvp-leaderboard', PvpLeaderboardScene, false);
game.scene.add('record-hub', RecordHubScene, false);
game.scene.add('record-battle', RecordBattleScene, false);
game.scene.add('record-result', RecordResultScene, false);
game.scene.add('trusted-result', TrustedBattleResultScene, false);
game.scene.add('account', AccountScene, false);
game.scene.add('profile', ProfileScene, false);
game.scene.add('social', SocialScene, false);
game.scene.add('settings', SettingsScene, false);
game.scene.add('story', StoryScene, false);
