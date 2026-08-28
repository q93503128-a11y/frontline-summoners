import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { ReplayBattleScene as BattleScene } from './replay-battle-scene';
import { CatalogScene } from './catalog-scene';
import { CoopBattleScene, CoopLobbyScene } from './coop-scenes';
import { DeckScene } from './deck-scene';
import { GrowthScene } from './growth-scene';
import { RecruitmentScene } from './recruitment-scene';
import { BootScene, MainMenuScene as BaseMainMenuScene, StageHubScene, StageSelectScene } from './navigation-scenes';
import { ResultScene } from './result-scene';
import { addButton } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

class MainMenuScene extends BaseMainMenuScene {
  create(): void {
    super.create();
    const compact = isCompactMobileViewport();
    addButton(this, INTERNAL_WIDTH / 2, compact ? 540 : 542, 300, compact ? 84 : 60, '2인 협동', () => this.scene.start('coop-lobby'), 0x5f7897);
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
  scene: [BootScene, MainMenuScene, StageHubScene, StageSelectScene, DeckScene, CatalogScene, BattleScene, ResultScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

game.scene.add('recruitment', RecruitmentScene, false);
game.scene.add('growth', GrowthScene, false);
game.scene.add('coop-lobby', CoopLobbyScene, false);
game.scene.add('coop-battle', CoopBattleScene, false);
