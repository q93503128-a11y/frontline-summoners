import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { getBattleFeedbackPolicy } from './battle-feedback-policy';
import { playFirstSliceBossWarningAudio } from './first-slice-production-review-audio.ts';
import { isFirstSliceProductionReviewMode } from './first-slice-production-review-runtime.ts';

const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

function addGoldenMaskReviewWarning(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const mask = scene.add.container(-292, 0);
  const outer = scene.add.ellipse(0, 0, 58, 76, 0x8b6a30, 0.96).setStrokeStyle(3, 0xf2cd71, 1);
  const inner = scene.add.ellipse(0, 2, 42, 58, 0xc49a43, 0.95);
  const brow = scene.add.rectangle(0, -14, 35, 5, 0x5d432e, 0.96);
  const leftEye = scene.add.rectangle(-11, -5, 10, 5, 0x211820, 1).setAngle(-9);
  const rightEye = scene.add.rectangle(11, -5, 10, 5, 0x211820, 1).setAngle(9);
  const mouth = scene.add.rectangle(0, 18, 22, 4, 0x5a352b, 0.9);
  const halo = scene.add.ellipse(0, 0, 82, 98, 0x000000, 0).setStrokeStyle(2, 0xffdd82, 0.65);
  mask.add([halo, outer, inner, brow, leftEye, rightEye, mouth]);
  layer.add(mask);

  const rightRune = scene.add.ellipse(292, 0, 58, 58, 0x000000, 0).setStrokeStyle(3, 0xd2aa58, 0.75);
  const rightRuneInner = scene.add.ellipse(292, 0, 34, 34, 0x000000, 0).setStrokeStyle(2, 0x7c5462, 0.9);
  const runeSlashA = scene.add.rectangle(292, 0, 4, 44, 0xe0bc69, 0.8).setAngle(45);
  const runeSlashB = scene.add.rectangle(292, 0, 4, 44, 0xe0bc69, 0.8).setAngle(-45);
  layer.add([rightRune, rightRuneInner, runeSlashA, runeSlashB]);

  const policy = getBattleFeedbackPolicy();
  if (!policy.reducedMotion) {
    scene.tweens.add({ targets: halo, angle: 28, scaleX: 1.16, scaleY: 1.16, duration: 880, yoyo: true, repeat: 0, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: [rightRune, rightRuneInner, runeSlashA, runeSlashB], angle: -34, duration: 980, ease: 'Sine.easeInOut' });
  }
}

/** Purely visual warning. It never changes simulation time, input state, or combat data. */
export function showBossArrival(scene: Phaser.Scene, bossName: string): void {
  const policy = getBattleFeedbackPolicy();
  const review = isFirstSliceProductionReviewMode();
  const layer = scene.add.container(INTERNAL_WIDTH / 2, 205).setDepth(80).setAlpha(policy.reducedMotion ? 1 : 0);
  const dim = scene.add.rectangle(0, 0, 700, 108, review ? 0x181016 : 0x120e12, 0.92)
    .setStrokeStyle(3, review ? 0xd7aa51 : 0xd06762, 0.95);
  const title = scene.add.text(0, -24, review ? '황 금 가 면 · 우 두 머 리  출 현' : '우 두 머 리  출 현', {
    fontFamily: FONT,
    fontSize: review ? '21px' : '24px',
    color: review ? '#f2cb6b' : '#ffbbb1',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const name = scene.add.text(0, 20, bossName, {
    fontFamily: FONT,
    fontSize: '31px',
    color: '#fff0cf',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  layer.add([dim, title, name]);

  if (!policy.reducedDecorativeEffects) {
    const upper = scene.add.rectangle(0, -46, 684, 5, review ? 0xe0b657 : 0xe17369, 0.9);
    const lower = scene.add.rectangle(0, 46, 684, 5, review ? 0x6c4e35 : 0x7e3536, 0.9);
    layer.add([upper, lower]);
    if (review) addGoldenMaskReviewWarning(scene, layer);
  }

  if (review) playFirstSliceBossWarningAudio(scene);
  if (policy.screenShakeFactor > 0) scene.cameras.main.shake(review ? 145 : 110, review ? 0.0017 : 0.0014);

  if (policy.reducedMotion) {
    scene.time.delayedCall(1050, () => {
      if (layer.active) layer.destroy(true);
    });
    return;
  }

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
