import Phaser from 'phaser';
import type {
  ArcaneFrameOverlaySpec,
  DuelistBladeOverlaySpec,
  FurnaceOverlaySpec,
  GreatbladeOverlaySpec,
  GuardShieldOverlaySpec,
  HunterPolearmOverlaySpec,
  LancerSpearOverlaySpec,
  RitualOverlaySpec,
  StorySilhouetteOverlaySpec,
  VoidOrbitOverlaySpec,
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
  for (const x of [left + 7, right - 7]) for (const y of [top + 10, bottom - 10]) graphics.fillCircle(x, y, 2.4);
  if (spec.battlementCount > 0) {
    const toothWidth = Math.max(7, Math.floor(spec.shieldWidth / (spec.battlementCount * 1.8)));
    const spacing = spec.shieldWidth / spec.battlementCount;
    for (let index = 0; index < spec.battlementCount; index += 1) {
      const x = left + spacing * index + (spacing - toothWidth) / 2;
      graphics.fillStyle(spec.fillColor, 0.98).fillRect(x, top - 8, toothWidth, 10);
      graphics.lineStyle(2, spec.rimColor, 0.9).strokeRect(x, top - 8, toothWidth, 10);
    }
  }
  if (spec.skidWidth > 0) graphics.lineStyle(5, spec.rimColor, 0.88).lineBetween(spec.frontOffsetX - spec.skidWidth / 2, bottom + 4, spec.frontOffsetX + spec.skidWidth / 2, bottom + 4);
  if (spec.wheelRadius > 0) {
    graphics.fillStyle(0x222a33, 1);
    const wheelLeft = spec.frontOffsetX - spec.shieldWidth * 0.3;
    const wheelRight = spec.frontOffsetX + spec.shieldWidth * 0.3;
    graphics.fillCircle(wheelLeft, bottom + 6, spec.wheelRadius).fillCircle(wheelRight, bottom + 6, spec.wheelRadius);
    graphics.lineStyle(2, spec.rimColor, 0.8).strokeCircle(wheelLeft, bottom + 6, spec.wheelRadius).strokeCircle(wheelRight, bottom + 6, spec.wheelRadius);
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
  graphics.fillStyle(0x9eafbd, 0.95).fillRect(front - 5, y - spec.bladeHalfHeight - 2, 6, spec.bladeHalfHeight * 2 + 4);
  const bannerRoot = rear + 20;
  graphics.fillStyle(spec.bannerColor, 0.94).fillTriangle(bannerRoot, y + 3, bannerRoot + 28, y + 6, bannerRoot + 8, y + spec.bannerDrop);
}

function drawHunterPolearm(graphics: Phaser.GameObjects.Graphics, spec: HunterPolearmOverlaySpec): void {
  const y = -7;
  const rear = -spec.rearExtent;
  const front = spec.shaftForward;
  const tip = front + spec.bladeLength;
  graphics.lineStyle(spec.shaftThickness, spec.shaftColor, 1).lineBetween(rear, y, front, y);
  graphics.fillStyle(spec.bladeColor, 0.98).fillTriangle(tip, y, front, y - spec.bladeHalfHeight, front, y + spec.bladeHalfHeight);
  if (spec.hookDepth > 0) {
    graphics.lineStyle(4, spec.bladeColor, 0.94).lineBetween(front + 5, y + 2, front + 13, y + spec.hookDepth);
    graphics.lineStyle(3, spec.bladeColor, 0.94).lineBetween(front + 13, y + spec.hookDepth, front + 20, y + spec.hookDepth - 5);
  }
  graphics.fillStyle(spec.trophyColor, 0.95);
  for (let index = 0; index < spec.trophyCount; index += 1) {
    const x = rear + 19 + index * 8;
    graphics.fillTriangle(x, y + 5, x + 4, y + 13, x + 8, y + 5);
  }
  if (spec.bannerDrop > 0) graphics.fillTriangle(rear + 14, y + 2, rear + 38, y + 5, rear + 21, y + spec.bannerDrop);
}

function drawDuelistBlade(graphics: Phaser.GameObjects.Graphics, spec: DuelistBladeOverlaySpec): void {
  const y = -7;
  graphics.lineStyle(spec.bladeWidth, spec.bladeColor, 1).lineBetween(7, y, 7 + spec.bladeLength, y - 5);
  graphics.lineStyle(3, spec.accentColor, 1).lineBetween(3, y - spec.guardWidth / 2, 3, y + spec.guardWidth / 2);
  if (spec.scabbardLength > 0) graphics.lineStyle(6, spec.accentColor, 0.92).lineBetween(-7, 4, -7 - spec.scabbardLength * 0.42, 4 + spec.scabbardLength * 0.9);
  if (spec.offhandDaggerLength > 0) graphics.lineStyle(4, spec.bladeColor, 0.96).lineBetween(-5, 1, -5 - spec.offhandDaggerLength, 15);
  if (spec.coatTailLength > 0) {
    graphics.fillStyle(spec.accentColor, 0.72).fillTriangle(-10, 10, -2, 11, -8, 10 + spec.coatTailLength);
    if (spec.coatTailLength > 20) graphics.fillTriangle(-1, 10, 7, 11, 4, 10 + spec.coatTailLength - 4);
  }
}

function drawArcaneFrame(graphics: Phaser.GameObjects.Graphics, spec: ArcaneFrameOverlaySpec): void {
  const cx = spec.frameOffsetX;
  const cy = spec.frameOffsetY;
  graphics.lineStyle(3, spec.frameColor, 0.72).strokeCircle(cx, cy, spec.frameRadius);
  graphics.lineStyle(2, spec.glowColor, 0.55).strokeCircle(cx, cy, Math.max(5, spec.frameRadius - 5));
  for (let index = 0; index < spec.plateCount; index += 1) {
    const angle = (Math.PI * 2 * index) / spec.plateCount - Math.PI / 2;
    const x1 = cx + Math.cos(angle) * (spec.frameRadius - 3);
    const y1 = cy + Math.sin(angle) * (spec.frameRadius - 3);
    const x2 = cx + Math.cos(angle) * (spec.frameRadius + spec.plateLength);
    const y2 = cy + Math.sin(angle) * (spec.frameRadius + spec.plateLength);
    graphics.lineStyle(5, spec.frameColor, 0.9).lineBetween(x1, y1, x2, y2);
  }
  graphics.lineStyle(4, spec.frameColor, 0.92).lineBetween(-9, 14, -9 + spec.staffLength * 0.35, 14 - spec.staffLength);
  graphics.fillStyle(spec.glowColor, 0.9).fillCircle(cx, cy, 4);
}

function drawFurnace(graphics: Phaser.GameObjects.Graphics, spec: FurnaceOverlaySpec): void {
  const left = spec.backOffsetX - spec.furnaceWidth / 2;
  const top = spec.verticalOffset - spec.furnaceHeight / 2;
  graphics.fillStyle(spec.bodyColor, 0.98).fillRoundedRect(left, top, spec.furnaceWidth, spec.furnaceHeight, 6);
  graphics.lineStyle(3, 0xa49688, 0.8).strokeRoundedRect(left, top, spec.furnaceWidth, spec.furnaceHeight, 6);
  graphics.fillStyle(spec.emberColor, 0.88).fillRect(left + 5, top + spec.furnaceHeight * 0.55, Math.max(4, spec.furnaceWidth - 10), 5);
  for (let index = 0; index < spec.crackCount; index += 1) {
    const x = left + 5 + ((index * 11) % Math.max(6, spec.furnaceWidth - 10));
    const y = top + 8 + ((index * 9) % Math.max(8, spec.furnaceHeight - 16));
    graphics.lineStyle(2, spec.emberColor, 0.82).lineBetween(x, y, x + (index % 2 === 0 ? 7 : -6), y + 8);
  }
  if (spec.ringRadius > 0) {
    const ringX = spec.floating ? spec.backOffsetX + 5 : spec.backOffsetX;
    const ringY = spec.floating ? spec.verticalOffset - 12 : spec.verticalOffset;
    graphics.lineStyle(7, spec.bodyColor, 0.92).strokeCircle(ringX, ringY, spec.ringRadius);
    graphics.lineStyle(3, spec.emberColor, 0.9).strokeCircle(ringX, ringY, spec.ringRadius - 4);
  }
}

function drawGreatblade(graphics: Phaser.GameObjects.Graphics, spec: GreatbladeOverlaySpec): void {
  const y = -8;
  const start = 4 - spec.rearOffset;
  const bladeStart = 8;
  const bladeEnd = bladeStart + spec.bladeLength;
  graphics.fillStyle(spec.bladeColor, 0.96).fillRect(bladeStart, y - spec.bladeWidth / 2, spec.bladeLength, spec.bladeWidth);
  graphics.fillTriangle(bladeEnd + 15, y, bladeEnd, y - spec.bladeWidth / 2, bladeEnd, y + spec.bladeWidth / 2);
  graphics.lineStyle(5, spec.accentColor, 0.95).lineBetween(bladeStart - 4, y - spec.guardWidth / 2, bladeStart - 4, y + spec.guardWidth / 2);
  graphics.lineStyle(6, 0x4b4039, 1).lineBetween(start, y, bladeStart, y);
  if (spec.featherHeight > 0) {
    graphics.fillStyle(spec.accentColor, 0.86).fillTriangle(-8, -30, 0, -30 - spec.featherHeight, 6, -29);
    graphics.fillTriangle(-2, -29, 9, -27 - spec.featherHeight * 0.78, 12, -25);
  }
}

function drawRitual(graphics: Phaser.GameObjects.Graphics, spec: RitualOverlaySpec): void {
  const cx = spec.offsetX;
  const cy = -8;
  if (spec.ringRadius > 0) {
    graphics.lineStyle(3, spec.ritualColor, 0.72).strokeCircle(cx - 10, cy, spec.ringRadius);
    graphics.lineStyle(2, spec.ritualColor, 0.5).strokeCircle(cx - 10, cy, Math.max(5, spec.ringRadius - 7));
  }
  graphics.fillStyle(spec.paperColor, 0.93);
  for (let index = 0; index < spec.talismanCount; index += 1) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    graphics.fillRect(cx - 29 + column * 10, cy - 20 + row * 17, 6, 14);
  }
  graphics.lineStyle(4, spec.ritualColor, 0.96).lineBetween(cx + 3, cy + 11, cx + 3 + spec.toolLength, cy - 12);
  if (spec.splitTools) graphics.lineStyle(4, spec.ritualColor, 0.96).lineBetween(cx + 1, cy + 12, cx + 1 + spec.toolLength * 0.8, cy + 28);
}

function drawVoidOrbit(graphics: Phaser.GameObjects.Graphics, spec: VoidOrbitOverlaySpec): void {
  for (let index = 0; index < spec.shardCount; index += 1) {
    const angle = (Math.PI * 2 * index) / spec.shardCount - Math.PI / 2;
    const cx = spec.offsetX + Math.cos(angle) * spec.radiusX;
    const cy = Math.sin(angle) * spec.radiusY;
    const dx = Math.cos(angle + 0.55) * spec.shardLength / 2;
    const dy = Math.sin(angle + 0.55) * spec.shardLength / 2;
    const px = Math.cos(angle + Math.PI / 2) * spec.shardWidth / 2;
    const py = Math.sin(angle + Math.PI / 2) * spec.shardWidth / 2;
    graphics.fillStyle(spec.shardColor, 0.96).fillTriangle(cx - dx - px, cy - dy - py, cx + dx, cy + dy, cx - dx + px, cy - dy + py);
    graphics.lineStyle(2, spec.rimColor, 0.72).lineBetween(cx - dx, cy - dy, cx + dx, cy + dy);
  }
}

/** Shared presentation renderer for battle, deck, and growth previews. */
export function createStorySilhouetteOverlayGraphics(scene: Phaser.Scene, spec: StorySilhouetteOverlaySpec): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(4);
  switch (spec.kind) {
    case 'GUARD_SHIELD': drawGuardShield(graphics, spec); break;
    case 'LANCER_SPEAR': drawLancerSpear(graphics, spec); break;
    case 'HUNTER_POLEARM': drawHunterPolearm(graphics, spec); break;
    case 'DUELIST_BLADE': drawDuelistBlade(graphics, spec); break;
    case 'ARCANE_FRAME': drawArcaneFrame(graphics, spec); break;
    case 'FURNACE': drawFurnace(graphics, spec); break;
    case 'GREATBLADE': drawGreatblade(graphics, spec); break;
    case 'RITUAL': drawRitual(graphics, spec); break;
    case 'VOID_ORBIT': drawVoidOrbit(graphics, spec); break;
  }
  return graphics;
}

export function getStorySilhouettePreviewScale(sourceDisplayHeight: number, targetDisplayHeight: number): number {
  if (!Number.isFinite(sourceDisplayHeight) || sourceDisplayHeight <= 0) return 1;
  if (!Number.isFinite(targetDisplayHeight) || targetDisplayHeight <= 0) return 1;
  return targetDisplayHeight / sourceDisplayHeight;
}
