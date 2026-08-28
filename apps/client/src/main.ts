import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { ReplayBattleScene as BattleScene } from './replay-battle-scene';
import { CatalogScene } from './catalog-scene';
import { DeckScene } from './deck-scene';
import { GrowthScene } from './growth-scene';
import { RecruitmentScene } from './recruitment-scene';
import { BootScene, MainMenuScene, StageHubScene, StageSelectScene } from './navigation-scenes';
import { ResultScene } from './result-scene';

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
