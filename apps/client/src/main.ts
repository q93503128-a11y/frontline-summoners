import Phaser from 'phaser';
import { APP_NAME, INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';

class BootstrapScene extends Phaser.Scene {
  constructor() {
    super('bootstrap');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#17191f');
    this.add.text(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2 - 16, APP_NAME, {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2 + 18, '전투 코어 준비 중', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#b8beca',
    }).setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: INTERNAL_WIDTH,
  height: INTERNAL_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  scene: [BootstrapScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
