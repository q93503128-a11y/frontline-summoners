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
import { PvpMatchmakingScene } from './pvp-scenes';
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

    addText(this, 62, 34, '전선소환전', compact ? 48 : 52, COLORS.cream);
    addText(this, 64, compact ? 94 : 92, '동료를 모으고, 보급과 타이밍으로 전선을 지휘한다.', compact ? 19 : 16, '#c9d1dc');

    const statusLayer = this.add.container(0, 0);
    statusLayer.add(addCommandPanel(this, 1032, 70, compact ? 410 : 390, compact ? 104 : 82, 0x65768a, 0x19212b, 0.9));
    const authorityText = addText(this, 858, 47, '진행 상태 확인 중…', compact ? 20 : 18, '#ffffff');
    const progressText = addText(this, 858, compact ? 79 : 76, '전선 정보를 불러오는 중…', compact ? 16 : 13, COLORS.muted);
    statusLayer.add([authorityText, progressText]);

    addSectionHeading(this, 64, 154, '오늘의 작전', 520, 0xb89a55);
    addSectionHeading(this, 672, 154, '병력 운영', 540, 0x6689a7);

    addCommandPanel(this, 330, 344, 540, 330, 0xb89a55, 0x1b222c, 0.94);
    addText(this, 104, 212, '전선 지휘', compact ? 30 : 28, '#f5e8c6');
    addText(this, 106, 251, '메인 · 특수 전선 · 기록전', compact ? 18 : 15, '#b6c1cd');
    addText(this, 106, 286, '전장을 고르고 보상과 협동 가능 여부를 확인한 뒤 출정합니다.', compact ? 16 : 13, '#8793a1').setWordWrapWidth(440);
    addButton(this, 330, 390, 390, compact ? 96 : 74, '전선 지도', () => this.scene.start('stage-hub'), 0xb89a55, { tone: 'primary' });
    addButton(this, 210, 474, 185, compact ? 74 : 52, '기록전', () => this.scene.start('record-hub'), 0x667e91, { tone: 'quiet' });
    addButton(this, 450, 474, 185, compact ? 74 : 52, '거점 병기', () => this.scene.start('base-weapon'), 0x667e91, { tone: 'quiet' });

    addCommandPanel(this, 950, 344, 560, 330, 0x6689a7, 0x1c2530, 0.94);
    addText(this, 704, 212, '전투 준비', compact ? 30 : 28, '#eef4fb');
    addText(this, 706, 251, '편성 → 성장 → 모집 → 도감', compact ? 18 : 15, '#b6c5d3');
    addText(this, 706, 286, '출정 전에 병력을 정비하고 필요한 동료를 확인합니다.', compact ? 16 : 13, '#8795a4');
    const actionHeight = compact ? 78 : 56;
    addButton(this, 820, 364, 210, actionHeight, '편성', () => this.scene.start('deck'), 0x6593b4, { tone: 'primary' });
    addButton(this, 1080, 364, 210, actionHeight, '성장', () => this.scene.start('growth'), 0x708c68, { tone: 'secondary' });
    addButton(this, 820, 442, 210, actionHeight, '모집', () => this.scene.start('recruitment'), 0x8e6fac, { tone: 'secondary' });
    addButton(this, 1080, 442, 210, actionHeight, '도감', () => this.scene.start('catalog'), 0x8a7754, { tone: 'quiet' });

    addSectionHeading(this, 64, 548, '지휘관 메뉴', 1148, 0x5f7084);
    const utilityY = compact ? 633 : 624;
    const utilityHeight = compact ? 80 : 54;
    addButton(this, 150, utilityY, 190, utilityHeight, '프로필 · 업적', () => this.scene.start('profile'), 0x796a91, { tone: 'quiet' });
    addButton(this, 385, utilityY, 190, utilityHeight, 'PvP 대전', () => this.scene.start('pvp-hub'), 0x85634f, { tone: 'quiet' });
    addButton(this, 620, utilityY, 190, utilityHeight, '친구 · 초대', () => this.scene.start('social'), 0x6f668f, { tone: 'quiet' });
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
