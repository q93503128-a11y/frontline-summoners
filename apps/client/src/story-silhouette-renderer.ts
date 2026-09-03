import Phaser from 'phaser';
import type {
  GuardShieldOverlaySpec,
  LancerSpearOverlaySpec,
  StorySilhouetteOverlaySpec,
} from './story-silhouette-overlays.ts';

function drawGuardShield(graphics: Phaser.GameObjects.Graphics, spec: GuardShieldOverlaySpec): void {
  const left = spec.frontOffsetX - spec.shieldWidth / 2;
  const top = spec.verticalOffset - spec.shieldHeight / 2;
  const right = left + spec.shieldWidth;
  const bottom = top + spec.shieldHeight;

  graphics.fillStyle(spec.fillColor, 0.96).fillRoundedRect(left, top, spec.shieldWidth, spec.shieldHeight, 5);
  graphics.lineStyle(4, spec.rimColor, 0.96).strokeRoundedRect(left, top, spec.shieldWidth, spec.shieldHeight, 5);
  graphics.lineStyle(3, spec.rimColor, 0.55).lineBetween(spec.frontOffsetX, top + 8, spec.frontOffsetX, bottom - 8);
  graphics.lineStyle(2, spec.rimColor, 0.42).lineBetween(left + 7, spec.verticalOffset, right - 7, spec.verticalOffset);

  graphics.fillStyle(spec.rimColor, 0.92);
  for (const x of [left + 7, right - 7]) {
    for (const y of [top + 10, bottom - 10]) graphics.fillCircle(x, y, 2.4);
  }

  if (spec.battlementCount > 0) {
    const toothWidth = Math.max(7, Math.floor(spec.shieldWidth / (spec.battlementCount * 1.8)));
    const spacing = spec.shieldWidth / spec.battlementCount;
    for (let index = 0; index < spec.battlementCount; index += 1) {
      const x = left + spacing * index + (spacing - toothWidth) / 2;
      graphics.fillStyle(spec.fillColor, 0.98).fillRect(x, top - 8, toothWidth, 10);
      graphics.lineStyle(2, spec.rimColor, 0.9).strokeRect(x, top - 8, toothWidth, 10);
    }
  }

  if (spec.skidWidth > 0) {
    graphics.lineStyle(5, spec.rimColor, 0.88).lineBetween(
      spec.frontOffsetX - spec.skidWidth / 2,
      bottom + 4,
      spec.frontOffsetX + spec.skidWidth / 2,
      bottom + 4,
    );
  }
  if (spec.wheelRadius > 0) {
    graphics.fillStyle(0x222a33, 1);
    const wheelLeft = spec.frontOffsetX - spec.shieldWidth * 0.3;
    const wheelRight = spec.frontOffsetX + spec.shieldWidth * 0.3;
    graphics.fillCircle(wheelLeft, bottom + 6, spec.wheelRadius).fillCircle(wheelRight, bottom + 6, spec.wheelRadius);
    graphics.lineStyle(2, spec.rimColor, 0.8)
      .strokeCircle(wheelLeft, bottom + 6, spec.wheelRadius)
      .strokeCircle(wheelRight, bottom + 6, spec.wheelRadius);
  }
}

function drawLancerSpear(graphics: Phaser.GameObjects.Graphics, spec: LancerSpearOverlaySpec): void {
  const y = spec.verticalOffset;
  const rear = -spec.rearExtent;
  const front = spec.shaftForward;
  const tip = front + spec.bladeLength;

  graphics.lineStyle(spec.shaftThickness, spec.shaftColor, 1).lineBetween(rear, y, front + 2, y);
  graphics.lineStyle(2, 0xd9e8f2, 0.42).lineBetween(rear + 3, y - 1.5, front - 2, y - 1.5);
  graphics.fillStyle(spec.bladeColor, 0.98).fillTriangle(tip, y, front, y - spec.bladeHalfHeight, front, y + spec.bladeHalfHeight);
  graphics.lineStyle(2, 0xf0f7fb, 0.78).lineBetween(front, y - spec.bladeHalfHeight, tip, y);
  graphics.lineStyle(2, 0x75899d, 0.9).lineBetween(front, y + spec.bladeHalfHeight, tip, y);
  graphics.fillStyle(0x9eafbd, 0.95).fillRect(front - 5, y - spec.bladeHalfHeight - 2, 6, spec.bladeHalfHeight * 2 + 4);

  const bannerRoot = rear + 20;
  graphics.fillStyle(spec.bannerColor, 0.94).fillTriangle(
    bannerRoot, y + 3,
    bannerRoot + 28, y + 6,
    bannerRoot + 8, y + spec.bannerDrop,
  );
  graphics.lineStyle(2, 0xb9d5ed, 0.55).lineBetween(bannerRoot, y + 3, bannerRoot + 8, y + spec.bannerDrop);
}

/** Shared presentation renderer for battle, deck, and growth previews. */
export function createStorySilhouetteOverlayGraphics(
  scene: Phaser.Scene,
  spec: StorySilhouetteOverlaySpec,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(4);
  if (spec.kind === 'GUARD_SHIELD') drawGuardShield(graphics, spec);
  else drawLancerSpear(graphics, spec);
  return graphics;
}

export function getStorySilhouettePreviewScale(sourceDisplayHeight: number, targetDisplayHeight: number): number {
  if (!Number.isFinite(sourceDisplayHeight) || sourceDisplayHeight <= 0) return 1;
  if (!Number.isFinite(targetDisplayHeight) || targetDisplayHeight <= 0) return 1;
  return targetDisplayHeight / sourceDisplayHeight;
}
