import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { loadActiveProgress } from './active-progress';
import { restoreAuthenticatedAccountSession } from './account-network';
import { AccountCommandScene as AccountScene } from './account-command-scene';
import { ReplayBattleScene as BattleScene } from './replay-battle-scene';
import { BaseWeaponScene } from './base-weapon-scene';
import {
  StoryGuestCoopBattleScene as CoopBattleScene,
  StoryGuestCoopLobbyScene as CoopLobbyScene,
  StoryFriendCoopBattleScene as FriendCoopBattleScene,
  StoryFriendCoopLobbyScene as FriendCoopLobbyScene,
  StoryPublicCoopLobbyScene as PublicCoopLobbyScene,
} from './coop-command-battle-scenes';
import { CatalogScene } from './catalog-command-scene';
import { DeckScene } from './deck-command-scene';
import { FirstSliceProductionCaptureScene, isFirstSliceCaptureMode } from './first-slice-production-capture-scene.ts';
import { isFirstSliceProductionReviewMode } from './first-slice-production-review-runtime.ts';
import { GrowthScene } from './meta-command-scenes';
import { RecruitmentScene } from './recruitment-command-scene';
import { BootScene as BaseBootScene, MainMenuScene as BaseMainMenuScene } from './navigation-scenes';
import { ProfileScene } from './profile-command-scene';
import { PublicCoopMatchmakingScene } from './public-coop-scenes';
import { Pvp2v2BattleScene, Pvp2v2MatchmakingScene } from './pvp-2v2-mobile-safe-scenes';
import { PvpHubScene } from './pvp-expanded-hub-scene';
import { FriendlyPvp2v2LobbyScene } from './pvp-friendly-2v2-command-scene';
import { FriendlyPvpLobbyScene, FriendlyPvpMatchScene, PvpMatchScene } from './pvp-mobile-safe-match-scenes';
import { PvpLeaderboardScene } from './pvp-leaderboard-scene';
import { PvpMatchmakingScene } from './pvp-matchmaking-command-scene';
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

    addText(this, 62, 30, '전선소환전', compact ? 48 : 50, COLORS.cream);
    addText(this, 64, compact ? 88 : 84, '동료를 모으고 보급과 타이밍으로 전선을 지휘한다.', compact ? 18 : 15, '#c9d1dc');

    const statusLayer = this.add.container(0, 0);
    const statusPlate = this.add.graphics();
    statusPlate.fillStyle(0x151d27, 0.82).fillRoundedRect(840, 24, 390, 82, 10);
    statusPlate.lineStyle(1, 0x617185, 0.36).strokeRoundedRect(840, 24, 390, 82, 10);
    statusLayer.add(statusPlate);
    const authorityText = addText(this, 862, 42, '진행 상태 확인 중…', compact ? 19 : 17, '#ffffff');
    const progressText = addText(this, 862, compact ? 74 : 72, '전선 정보를 불러오는 중…', compact ? 15 : 12, COLORS.muted);
    statusLayer.add([authorityText, progressText]);

    addCommandPanel(this, 340, 342, 560, 360, 0xb89a55, 0x19212a, 0.95);
    addText(this, 92, 182, '작전', compact ? 18 : 15, '#c7b98f');
    addText(this, 92, 218, '전선 지도', compact ? 34 : 32, '#f5e8c6');
    addText(this, 94, 266, '메인·특수 전선을 고르고 출정합니다.', compact ? 18 : 15, '#aab6c4');
    addButton(this, 340, 365, 420, compact ? 100 : 76, '전선 지도 열기', () => this.scene.start('stage-hub'), 0xb89a55, { tone: 'primary' });
    addButton(this, 220, 470, 190, compact ? 76 : 54, '기록전', () => this.scene.start('record-hub'), 0x667e91, { tone: 'quiet' });
    addButton(this, 460, 470, 190, compact ? 76 : 54, '거점 병기', () => this.scene.start('base-weapon'), 0x667e91, { tone: 'quiet' });

    addCommandPanel(this, 950, 342, 560, 360, 0x6689a7, 0x19212a, 0.95);
    addText(this, 700, 182, '출정 준비', compact ? 18 : 15, '#9fb6c9');
    addText(this, 700, 218, '병력 정비', compact ? 34 : 32, '#eef4fb');
    addText(this, 702, 266, '편성·성장·모집·도감을 한곳에서 정리합니다.', compact ? 17 : 14, '#aab6c4');
    const actionHeight = compact ? 82 : 58;
    addButton(this, 820, 354, 210, actionHeight, '편성', () => this.scene.start('deck'), 0x6593b4, { tone: 'primary' });
    addButton(this, 1080, 354, 210, actionHeight, '성장', () => this.scene.start('growth'), 0x708c68, { tone: 'secondary' });
    addButton(this, 820, 445, 210, actionHeight, '모집', () => this.scene.start('recruitment'), 0x8e6fac, { tone: 'secondary' });
    addButton(this, 1080, 445, 210, actionHeight, '도감', () => this.scene.start('catalog'), 0x8a7754, { tone: 'quiet' });

    const rail = this.add.graphics();
    rail.lineStyle(1, 0x5f6d7d, 0.4).lineBetween(64, 555, 1216, 555);
    addText(this, 64, 574, '지휘관', compact ? 16 : 13, '#8794a4');
    const utilityY = compact ? 640 : 626;
    const utilityHeight = compact ? 80 : 54;
    addButton(this, 150, utilityY, 190, utilityHeight, '프로필', () => this.scene.start('profile'), 0x796a91, { tone: 'quiet' });
    addButton(this, 385, utilityY, 190, utilityHeight, 'PvP', () => this.scene.start('pvp-hub'), 0x85634f, { tone: 'quiet' });
    addButton(this, 620, utilityY, 190, utilityHeight, '친구', () => this.scene.start('social'), 0x6f668f, { tone: 'quiet' });
    addButton(this, 855, utilityY, 190, utilityHeight, '계정', () => this.scene.start('account'), 0x6a7b92, { tone: 'quiet' });
    addButton(this, 1090, utilityY, 190, utilityHeight, '설정', () => this.scene.start('settings'), 0x667984, { tone: 'quiet' });

    if (isFirstSliceProductionReviewMode()) {
      addButton(this, 1030, 132, 360, compact ? 68 : 46, '제작 검수 · 캡처 프리플라이트', () => {
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
      const label = view.authority === 'GUEST_LOCAL' ? '게스트 지휘관' : view.authority === 'ACCOUNT_ONLINE' ? '계정 지휘관 · 온라인' : '계정 지휘관 · 오프라인';
      const kind = view.authority === 'ACCOUNT_ONLINE' ? 'online' : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? 'offline' : 'neutral';
      authorityText.setText(label);
      authorityText.setColor(view.authority === 'ACCOUNT_ONLINE' ? COLORS.green : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : '#ffffff');
      progressText.setText(`메인 ${progress.clearedStageIds.length}/${STAGES.length} · 특수 ${progress.specialClearedStageIds.length}/${SPECIAL_STAGES.length} · 동료 ${owned}`);
      statusLayer.add(addStatusPill(this, compact ? 1122 : 1138, compact ? 47 : 40, view.authority === 'ACCOUNT_ONLINE' ? '동기화' : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? '읽기 전용' : '로컬', kind));
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
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
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
