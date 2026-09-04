import Phaser from 'phaser';

export type FirstSliceReviewFamilyKey = 'militia_f1' | 'militia_f2' | 'militia_f3' | 'enemy-raider' | 'enemy-boss';
export type FirstSliceReviewCrowdTier = 'OPEN' | 'DENSE' | 'SATURATED';

export function getFirstSliceReviewCrowdTier(unitCount: number): FirstSliceReviewCrowdTier {
  if (unitCount >= 12) return 'SATURATED';
  if (unitCount >= 8) return 'DENSE';
  return 'OPEN';
}

function fadeAndDestroy(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.GameObject[],
  duration: number,
  scaleX = 1.35,
  scaleY = 1.2,
): void {
  scene.tweens.add({
    targets,
    alpha: 0,
    scaleX,
    scaleY,
    duration,
    ease: 'Quad.easeOut',
    onComplete: () => targets.forEach((target) => target.destroy()),
  });
}

function densityAlpha(tier: FirstSliceReviewCrowdTier): number {
  return tier === 'SATURATED' ? 0.62 : tier === 'DENSE' ? 0.78 : 1;
}

/** Review-only contact language for the first production slice. Never changes simulation or hit timing. */
export function playFirstSliceReviewContactFx(
  scene: Phaser.Scene,
  familyKey: FirstSliceReviewFamilyKey,
  x: number,
  y: number,
  direction: 1 | -1,
  unitCount: number,
): void {
  const tier = getFirstSliceReviewCrowdTier(unitCount);
  const alpha = densityAlpha(tier);

  if (familyKey === 'militia_f1') {
    const main = scene.add.arc(x + direction * 5, y + 1, 29, direction > 0 ? 218 : 38, direction > 0 ? 322 : 142, false, 0x000000, 0)
      .setStrokeStyle(5, 0xe4c78d, 0.9 * alpha).setDepth(14).setAngle(direction > 0 ? -8 : 8);
    const objects: Phaser.GameObjects.GameObject[] = [main];
    if (tier === 'OPEN') {
      objects.push(scene.add.rectangle(x - direction * 5, y + 9, 24, 3, 0xb18c5d, 0.62).setAngle(direction > 0 ? 18 : -18).setDepth(14));
    }
    fadeAndDestroy(scene, objects, tier === 'OPEN' ? 150 : 118, 1.22, 1.16);
    return;
  }

  if (familyKey === 'militia_f2') {
    const shaft = scene.add.rectangle(x + direction * 24, y - 2, tier === 'SATURATED' ? 68 : 86, 3, 0xd8e4dc, 0.88 * alpha).setDepth(14);
    const tip = scene.add.triangle(x + direction * (tier === 'SATURATED' ? 59 : 70), y - 2, -8 * direction, -6, -8 * direction, 6, 9 * direction, 0, 0xf4ead0, 0.94 * alpha).setDepth(15);
    fadeAndDestroy(scene, [shaft, tip], tier === 'OPEN' ? 135 : 105, 1.16, 1.05);
    return;
  }

  if (familyKey === 'militia_f3') {
    const thrust = scene.add.rectangle(x + direction * 15, y + 10, 52, 5, 0xb7aa91, 0.9 * alpha)
      .setAngle(direction > 0 ? -8 : 8).setDepth(14);
    const objects: Phaser.GameObjects.GameObject[] = [thrust];
    if (tier !== 'SATURATED') {
      objects.push(scene.add.rectangle(x - direction * 2, y + 16, 19, 3, 0x776f65, 0.66 * alpha)
        .setAngle(direction > 0 ? 23 : -23).setDepth(13));
    }
    fadeAndDestroy(scene, objects, tier === 'OPEN' ? 126 : 100, 1.2, 1.08);
    return;
  }

  if (familyKey === 'enemy-raider') {
    const chop = scene.add.rectangle(x + direction * 8, y + 7, 40, 7, 0xc48a55, 0.86 * alpha)
      .setAngle(direction > 0 ? 24 : -24).setDepth(14);
    const objects: Phaser.GameObjects.GameObject[] = [chop];
    if (tier !== 'SATURATED') {
      objects.push(scene.add.ellipse(x - direction * 8, y + 23, 46, 12, 0x8a765f, 0.28 * alpha).setDepth(12));
    }
    fadeAndDestroy(scene, objects, tier === 'OPEN' ? 165 : 125, 1.38, 1.18);
    return;
  }

  const contactX = x + direction * 8;
  const mask = scene.add.ellipse(contactX, y - 12, tier === 'SATURATED' ? 58 : 76, tier === 'SATURATED' ? 72 : 94, 0x3e284c, 0.18 * alpha)
    .setStrokeStyle(tier === 'SATURATED' ? 3 : 4, 0xe1b85a, 0.92 * alpha).setDepth(15);
  const core = scene.add.ellipse(contactX, y - 12, 26, 34, 0xc69b45, 0.2 * alpha)
    .setStrokeStyle(2, 0xffdf8c, 0.82 * alpha).setDepth(16);
  const objects: Phaser.GameObjects.GameObject[] = [mask, core];
  if (tier !== 'SATURATED') {
    objects.push(
      scene.add.rectangle(contactX - 9, y - 18, 11, 4, 0x271826, 0.94 * alpha).setAngle(-8).setDepth(16),
      scene.add.rectangle(contactX + 9, y - 18, 11, 4, 0x271826, 0.94 * alpha).setAngle(8).setDepth(16),
    );
  }
  fadeAndDestroy(scene, objects, tier === 'OPEN' ? 260 : 205, tier === 'SATURATED' ? 1.42 : 1.75, tier === 'SATURATED' ? 1.28 : 1.55);
}

/** Dense battles keep hit acknowledgement local instead of stacking full white flashes over every unit. */
export function playFirstSliceReviewImpactFx(
  scene: Phaser.Scene,
  familyKey: FirstSliceReviewFamilyKey,
  x: number,
  y: number,
  damageRatio: number,
  unitCount: number,
): void {
  const tier = getFirstSliceReviewCrowdTier(unitCount);
  const boss = familyKey === 'enemy-boss';
  const heavy = damageRatio >= 0.12;

  if (tier === 'OPEN' || boss || heavy) {
    const radius = boss ? 17 : heavy ? 12 : 9;
    const color = boss ? 0xe0b85d : familyKey === 'enemy-raider' ? 0xd4a06b : 0xe8dfc5;
    const ring = scene.add.circle(x, y + (familyKey === 'enemy-raider' ? 8 : 0), radius, color, 0.12)
      .setStrokeStyle(boss ? 3 : 2, color, boss ? 0.82 : 0.66).setDepth(13);
    fadeAndDestroy(scene, [ring], boss ? 190 : 125, boss ? 1.75 : 1.45, boss ? 1.55 : 1.35);
    return;
  }

  const tick = scene.add.circle(x, y + 2, tier === 'SATURATED' ? 4 : 6, familyKey === 'enemy-raider' ? 0xc59062 : 0xded6c3, tier === 'SATURATED' ? 0.48 : 0.6)
    .setDepth(12);
  fadeAndDestroy(scene, [tick], tier === 'SATURATED' ? 72 : 90, 1.25, 1.25);
}
