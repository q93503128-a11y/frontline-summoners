import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';

const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

/** Purely visual warning. It never changes simulation time, input state, or combat data. */
export function showBossArrival(scene: Phaser.Scene, bossName: string): void {
  const layer = scene.add.container(INTERNAL_WIDTH / 2, 205).setDepth(80).setAlpha(0);
  const dim = scene.add.rectangle(0, 0, 700, 108, 0x120e12, 0.9).setStrokeStyle(3, 0xd06762, 0.95);
  const upper = scene.add.rectangle(0, -46, 684, 5, 0xe17369, 0.9);
  const lower = scene.add.rectangle(0, 46, 684, 5, 0x7e3536, 0.9);
  const title = scene.add.text(0, -24, '우 두 머 리  출 현', {
    fontFamily: FONT,
    fontSize: '24px',
    color: '#ffbbb1',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const name = scene.add.text(0, 20, bossName, {
    fontFamily: FONT,
    fontSize: '31px',
    color: '#fff0cf',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  layer.add([dim, upper, lower, title, name]);

  scene.cameras.main.shake(110, 0.0014);
  scene.tweens.add({
    targets: layer,
    alpha: 1,
    y: 220,
    duration: 150,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.time.delayedCall(1050, () => {
        if (!layer.active) return;
        scene.tweens.add({
          targets: layer,
          alpha: 0,
          y: 205,
          duration: 260,
          ease: 'Quad.easeIn',
          onComplete: () => layer.destroy(true),
        });
      });
    },
  });
}
