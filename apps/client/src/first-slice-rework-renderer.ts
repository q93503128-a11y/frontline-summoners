import Phaser from 'phaser';
import type { FirstSliceReworkOverlaySpec } from './first-slice-rework-overlays.ts';

function drawWearMarks(g: Phaser.GameObjects.Graphics, spec: FirstSliceReworkOverlaySpec): void {
  if (spec.wearMarks <= 0) return;
  g.lineStyle(1, spec.accentColor, 0.8);
  for (let i = 0; i < spec.wearMarks; i += 1) {
    const y = -12 + i * 5;
    g.lineBetween(-spec.packWidth / 2 + 2, y, -spec.packWidth / 2 + 6, y - 2);
  }
}

function drawMilitia(g: Phaser.GameObjects.Graphics, spec: FirstSliceReworkOverlaySpec): void {
  const y = spec.stanceDrop;
  g.fillStyle(spec.primaryColor, 1)
    .fillRoundedRect(
      spec.packOffsetX - spec.packWidth / 2,
      spec.packOffsetY - spec.packHeight / 2 + y,
      spec.packWidth,
      spec.packHeight,
      spec.formOrder === 1 ? 2 : 1,
    );

  if (spec.formOrder === 1) {
    g.fillStyle(spec.secondaryColor, 1)
      .fillTriangle(-18, -5 + y, -10, -15 + y, -8, 3 + y)
      .fillRect(-7, 0 + y, 5, 7);
  } else if (spec.formOrder === 2) {
    g.fillStyle(spec.secondaryColor, 1)
      .fillRect(-7, -14 + y, 9, 5)
      .fillRect(-5, 1 + y, 9, 4);
  } else {
    g.fillStyle(spec.secondaryColor, 1)
      .fillRect(-5, -10 + y, 8, 4)
      .fillTriangle(-9, 2 + y, -1, -2 + y, 1, 6 + y);
  }

  g.lineStyle(spec.weaponThickness, spec.accentColor, 1)
    .lineBetween(4, -1 + y, 4 + spec.weaponLength, -4 + y);
  g.fillStyle(spec.accentColor, 1)
    .fillTriangle(
      4 + spec.weaponLength + 5,
      -4 + y,
      4 + spec.weaponLength - 1,
      -8 + y,
      4 + spec.weaponLength - 1,
      0 + y,
    );

  drawWearMarks(g, spec);
}

function drawRaider(g: Phaser.GameObjects.Graphics, spec: FirstSliceReworkOverlaySpec): void {
  const y = spec.stanceDrop;
  g.fillStyle(spec.primaryColor, 1)
    .fillEllipse(spec.packOffsetX - 2, spec.packOffsetY + y, spec.packWidth, spec.packHeight)
    .fillEllipse(spec.packOffsetX - 8, spec.packOffsetY - 5 + y, spec.packWidth * 0.58, spec.packHeight * 0.72);
  g.fillStyle(spec.accentColor, 1)
    .fillRect(spec.packOffsetX - 17, spec.packOffsetY - 12 + y, 5, 10)
    .fillTriangle(spec.packOffsetX - 10, spec.packOffsetY - 13 + y, spec.packOffsetX - 2, spec.packOffsetY - 18 + y, spec.packOffsetX, spec.packOffsetY - 7 + y);

  g.lineStyle(spec.weaponThickness, spec.secondaryColor, 1)
    .lineBetween(5, 1 + y, 5 + spec.weaponLength, 3 + y);
  g.fillStyle(spec.secondaryColor, 1)
    .fillRect(5 + spec.weaponLength - 1, -1 + y, 6, 8);

  drawWearMarks(g, spec);
}

export function createFirstSliceReworkOverlayGraphics(
  scene: Phaser.Scene,
  spec: FirstSliceReworkOverlaySpec,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.setDepth(9);
  if (spec.kind === 'MILITIA') drawMilitia(g, spec);
  else drawRaider(g, spec);
  return g;
}
