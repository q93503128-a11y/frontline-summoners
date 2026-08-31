import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { restoreAuthenticatedAccountSession } from './account-network';
import { AccountScene } from './account-scene';
import { ReplayBattleScene as BattleScene } from './replay-battle-scene';
import { BaseWeaponScene } from './base-weapon-scene';
import { CatalogScene } from './catalog-scene';
import { CoopBattleScene, CoopLobbyScene } from './coop-scenes';
import { DeckScene } from './deck-scene';
import { FriendCoopBattleScene, FriendCoopLobbyScene } from './friend-coop-scenes';
import { GrowthScene } from './growth-scene';
import { RecruitmentScene } from './recruitment-scene';
import { BootScene as BaseBootScene, MainMenuScene as BaseMainMenuScene } from './navigation-scenes';
import { ProfileScene } from './profile-scene';
import { RecordBattleScene } from './record-battle-scene';
import { RecordHubScene } from './record-hub-scene';
import { RecordResultScene } from './record-result-scene';
import { SocialScene } from './social-scene';
import { StageHubScene } from './stage-hub-scene';
import { StageSelectScene } from './stage-select-scene';
import { ResultScene } from './result-scene';
import { TrustedBattleResultScene } from './trusted-battle-result-scene';
import { addButton } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

class BootScene extends BaseBootScene {
  override create(): void {
    void restoreAuthenticatedAccountSession().finally(() => {
      if (this.scene.isActive()) this.scene.start('main-menu');
    });
  }
}

class MainMenuScene extends BaseMainMenuScene {
  create(): void {
    super.create();
    const compact = isCompactMobileViewport();
    const h = compact ? 84 : 60;
    addButton(this, 185, compact ? 540 : 542, 210, h, '프로필·업적', () => this.scene.start('profile'), 0x7b6a91);
    addButton(this, 455, compact ? 540 : 542, 220, h, '2인 협동', () => this.scene.start('coop-lobby'), 0x5f7897);
    addButton(this, 735, compact ? 540 : 542, 220, h, '친구·초대', () => this.scene.start('social'), 0x6b628f);
    addButton(this, 1015, compact ? 540 : 542, 210, h, '계 정', () => this.scene.start('account'), 0x6f7f96);
  }
}

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

game.scene.add('recruitment', RecruitmentScene, false);
game.scene.add('growth', GrowthScene, false);
game.scene.add('coop-lobby', CoopLobbyScene, false);
game.scene.add('coop-battle', CoopBattleScene, false);
game.scene.add('friend-coop-lobby', FriendCoopLobbyScene, false);
game.scene.add('friend-coop-battle', FriendCoopBattleScene, false);
game.scene.add('record-hub', RecordHubScene, false);
game.scene.add('record-battle', RecordBattleScene, false);
game.scene.add('record-result', RecordResultScene, false);
game.scene.add('trusted-result', TrustedBattleResultScene, false);
game.scene.add('account', AccountScene, false);
game.scene.add('profile', ProfileScene, false);
game.scene.add('social', SocialScene, false);
