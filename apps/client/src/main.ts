import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { AccountScene } from './account-scene';
import { ReplayBattleScene as BattleScene } from './replay-battle-scene';
import { BaseWeaponScene } from './base-weapon-scene';
import { CatalogScene } from './catalog-scene';
import { CoopBattleScene, CoopLobbyScene } from './coop-scenes';
import { DeckScene } from './deck-scene';
import { GrowthScene } from './growth-scene';
import { RecruitmentScene } from './recruitment-scene';
import { BootScene, MainMenuScene as BaseMainMenuScene } from './navigation-scenes';
import { RecordBattleScene } from './record-battle-scene';
import { RecordHubScene } from './record-hub-scene';
import { RecordResultScene } from './record-result-scene';
import { StageHubScene } from './stage-hub-scene';
import { StageSelectScene } from './stage-select-scene';
import { ResultScene } from './result-scene';
import { addButton } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

class MainMenuScene extends BaseMainMenuScene {
  create(): void {
    super.create();
    const compact = isCompactMobileViewport();
    addButton(this, INTERNAL_WIDTH / 2, compact ? 540 : 542, 300, compact ? 84 : 60, '2인 협동', () => this.scene.start('coop-lobby'), 0x5f7897);
    addButton(this, 1110, compact ? 540 : 542, 220, compact ? 84 : 60, '계 정', () => this.scene.start('account'), 0x6f7f96);
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
game.scene.add('record-hub', RecordHubScene, false);
game.scene.add('record-battle', RecordBattleScene, false);
game.scene.add('record-result', RecordResultScene, false);
game.scene.add('account', AccountScene, false);
