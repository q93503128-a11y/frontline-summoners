import Phaser from 'phaser';
import type { SignatureSilhouetteOverlaySpec, SignatureSilhouetteShape } from './common-silhouette-overlays.ts';

function drawDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha)
    .fillTriangle(x, y - h / 2, x + w / 2, y, x, y + h / 2)
    .fillTriangle(x, y - h / 2, x - w / 2, y, x, y + h / 2);
}

function drawSignatureShape(g: Phaser.GameObjects.Graphics, spec: SignatureSilhouetteOverlaySpec): void {
  const s = spec.scale;
  const d = spec.formOrder;
  const p = (value: number): number => value * s;
  const primary = spec.primaryColor;
  const secondary = spec.secondaryColor;
  const accent = spec.accentColor;

  const basicPolearm = (length: number, y = -8): void => {
    g.lineStyle(p(4), secondary, 1).lineBetween(p(-30), p(y), p(length), p(y));
    g.fillStyle(accent, 0.98).fillTriangle(p(length + 25), p(y), p(length), p(y - 9), p(length), p(y + 9));
  };

  switch (spec.shape as SignatureSilhouetteShape) {
    case 'TURNIP_RIDER':
      g.fillStyle(primary, 0.96).fillEllipse(p(-5), p(17), p(72 + d * 7), p(48 + d * 5));
      g.lineStyle(p(3), secondary, 0.9).strokeEllipse(p(-5), p(17), p(72 + d * 7), p(48 + d * 5));
      for (let i = 0; i < d + 1; i += 1) g.fillStyle(secondary, 0.95).fillTriangle(p(-20 + i * 15), p(-6), p(-7 + i * 15), p(-28 - i * 2), p(3 + i * 15), p(-4));
      basicPolearm(52 + d * 8, -16);
      break;
    case 'TIN_SQUIRE': {
      const w = 48 + d * 7; const h = 72 + d * 8;
      g.fillStyle(primary, 0.97).fillRoundedRect(p(5 - w / 2), p(-h / 2 + 8), p(w), p(h), p(5));
      g.lineStyle(p(4), secondary, 1).strokeRoundedRect(p(5 - w / 2), p(-h / 2 + 8), p(w), p(h), p(5));
      g.fillStyle(accent, 0.95).fillCircle(p(5), p(-10), p(5 + d));
      if (d === 3) for (const x of [-15, 0, 15]) g.fillStyle(primary, 1).fillRect(p(x), p(-h / 2), p(10), p(10));
      break;
    }
    case 'SLINGER':
      g.lineStyle(p(3), secondary, 1).lineBetween(p(-5), p(-3), p(28 + d * 8), p(-30 - d * 4));
      g.lineStyle(p(2), primary, 0.9).lineBetween(p(28 + d * 8), p(-30 - d * 4), p(48 + d * 12), p(-5));
      g.fillStyle(accent, 1).fillCircle(p(48 + d * 12), p(-5), p(5 + d));
      if (d === 3) g.fillStyle(primary, 0.95).fillCircle(p(-14), p(15), p(11));
      break;
    case 'BELL_CRAB':
      g.fillStyle(primary, 0.96).fillEllipse(0, p(10), p(76 + d * 9), p(45 + d * 5));
      g.lineStyle(p(4), secondary, 0.95).strokeEllipse(0, p(10), p(76 + d * 9), p(45 + d * 5));
      for (const side of [-1, 1]) for (let i = 0; i < 3; i += 1) g.lineStyle(p(4), secondary, 1).lineBetween(p(side * (20 + i * 7)), p(25), p(side * (42 + i * 7)), p(39 + i * 3));
      g.fillStyle(accent, 0.96).fillEllipse(0, p(-15 - d * 4), p(30 + d * 5), p(25 + d * 4));
      g.lineStyle(p(3), secondary, 0.9).lineBetween(0, p(-2), 0, p(-34 - d * 5));
      break;
    case 'LANTERN_MOTH':
      g.fillStyle(primary, 0.68).fillEllipse(p(-22), p(-4), p(45 + d * 7), p(68 + d * 8)).fillEllipse(p(22), p(-4), p(45 + d * 7), p(68 + d * 8));
      g.lineStyle(p(2), secondary, 0.75).strokeEllipse(p(-22), p(-4), p(45 + d * 7), p(68 + d * 8)).strokeEllipse(p(22), p(-4), p(45 + d * 7), p(68 + d * 8));
      g.fillStyle(accent, 0.98).fillEllipse(0, p(13), p(18 + d * 3), p(40 + d * 5));
      g.fillStyle(secondary, 1).fillCircle(0, p(-14), p(8));
      break;
    case 'LANTERN_WITCH':
      g.fillStyle(secondary, 0.98).fillTriangle(p(-32), p(-27), p(34), p(-27), p(3), p(-64 - d * 3)).fillRect(p(-38), p(-27), p(76), p(8));
      g.lineStyle(p(3), primary, 1).lineBetween(p(22), p(-5), p(28), p(38 + d * 4));
      g.fillStyle(accent, 0.96).fillRoundedRect(p(13), p(24), p(29 + d * 4), p(32 + d * 5), p(4));
      g.lineStyle(p(3), primary, 0.9).strokeRoundedRect(p(13), p(24), p(29 + d * 4), p(32 + d * 5), p(4));
      break;
    case 'CLOCK_DUCK':
      g.fillStyle(primary, 0.98).fillEllipse(p(-5), p(10), p(72 + d * 6), p(48 + d * 5));
      g.fillCircle(p(25), p(-11), p(18 + d * 2));
      g.fillStyle(accent, 1).fillTriangle(p(42), p(-11), p(63 + d * 3), p(-3), p(42), p(4));
      g.lineStyle(p(4), secondary, 1).lineBetween(p(-34), p(-5), p(-51 - d * 4), p(-25)).lineBetween(p(-51 - d * 4), p(-25), p(-51 - d * 4), p(2));
      g.lineBetween(p(-61 - d * 4), p(-13), p(-41 - d * 4), p(-13));
      break;
    case 'COFFIN_MERCHANT':
      g.fillStyle(primary, 0.98).fillRect(p(-40 - d * 3), p(-48 - d * 4), p(52 + d * 6), p(96 + d * 8));
      g.fillStyle(secondary, 0.96).fillTriangle(p(-40 - d * 3), p(-48 - d * 4), p(-14), p(-65 - d * 4), p(12 + d * 3), p(-48 - d * 4));
      g.lineStyle(p(4), accent, 0.8).strokeRect(p(-40 - d * 3), p(-48 - d * 4), p(52 + d * 6), p(96 + d * 8));
      g.lineStyle(p(3), accent, 0.75).lineBetween(p(-14), p(-30), p(-14), p(30)).lineBetween(p(-30), 0, p(2), 0);
      break;
    case 'MOSS_GOLEM':
      g.fillStyle(primary, 0.98).fillCircle(p(-23), p(2), p(27 + d * 3)).fillCircle(p(22), p(3), p(30 + d * 4)).fillCircle(0, p(-26), p(25 + d * 3));
      g.fillStyle(secondary, 1).fillRect(p(-36), p(18), p(72), p(35 + d * 5));
      for (let i = 0; i < d + 2; i += 1) g.fillStyle(accent, 0.95).fillTriangle(p(-30 + i * 15), p(-45), p(-23 + i * 15), p(-62 - i * 2), p(-15 + i * 15), p(-43));
      break;
    case 'INK_RAVEN':
      g.fillStyle(primary, 0.96).fillTriangle(0, p(-5), p(-65 - d * 8), p(-32 - d * 3), p(-30), p(20)).fillTriangle(0, p(-5), p(65 + d * 8), p(-32 - d * 3), p(30), p(20));
      g.fillStyle(secondary, 1).fillCircle(0, p(-12), p(15)).fillTriangle(p(8), p(-16), p(30), p(-9), p(8), p(-2));
      for (let i = 0; i < d; i += 1) g.fillStyle(accent, 0.7).fillTriangle(p(-8 + i * 8), p(16), p(-22 + i * 6), p(43 + i * 4), p(5 + i * 5), p(22));
      break;
    case 'GLASS_KEEPER':
      g.fillStyle(primary, 0.9).fillRect(p(-17 - d * 2), p(-45 - d * 4), p(34 + d * 4), p(88 + d * 8));
      g.lineStyle(p(3), secondary, 0.95).strokeRect(p(-17 - d * 2), p(-45 - d * 4), p(34 + d * 4), p(88 + d * 8));
      g.fillStyle(accent, 0.92).fillCircle(0, p(-48 - d * 5), p(16 + d * 3));
      g.lineStyle(p(3), accent, 0.7).lineBetween(p(12), p(-48), p(62 + d * 14), p(-56));
      break;
    case 'BONE_DRUM':
      g.fillStyle(primary, 0.96).fillCircle(0, p(8), p(34 + d * 5));
      g.lineStyle(p(5), secondary, 1).strokeCircle(0, p(8), p(34 + d * 5));
      for (const x of [-1, 1]) g.lineStyle(p(5), accent, 1).lineBetween(p(x * 15), p(-18), p(x * (34 + d * 4)), p(-55 - d * 5));
      break;
    case 'PAPER_DRAGON':
      g.fillStyle(primary, 0.93).fillTriangle(p(-50 - d * 6), p(15), 0, p(-25 - d * 3), p(-8), p(28)).fillTriangle(p(8), p(28), 0, p(-25 - d * 3), p(56 + d * 8), p(9));
      g.fillTriangle(p(35), p(5), p(72 + d * 8), p(-18), p(52), p(24));
      g.lineStyle(p(3), secondary, 0.85).lineBetween(p(-50), p(15), p(56), p(9));
      g.fillStyle(accent, 1).fillCircle(p(52), p(3), p(3 + d));
      break;
    case 'METEOR_CART':
      g.fillStyle(primary, 0.98).fillRect(p(-43 - d * 4), p(5), p(86 + d * 8), p(34 + d * 4));
      g.fillStyle(secondary, 1).fillCircle(p(-28), p(40), p(13 + d)).fillCircle(p(28), p(40), p(13 + d));
      g.lineStyle(p(7), accent, 1).lineBetween(p(-20), p(4), p(20 + d * 5), p(-48 - d * 7));
      g.fillStyle(accent, 0.92).fillCircle(p(28 + d * 5), p(-55 - d * 7), p(12 + d * 2));
      break;
    case 'MIRROR_GUIDE':
      for (let i = 0; i < 3 + d; i += 1) {
        const angle = (Math.PI * 2 * i) / (3 + d);
        drawDiamond(g, p(Math.cos(angle) * (30 + d * 5)), p(Math.sin(angle) * (38 + d * 4)), p(15 + d * 2), p(27 + d * 3), i % 2 ? primary : accent, 0.9);
      }
      g.lineStyle(p(2), secondary, 0.65).strokeEllipse(0, 0, p(74 + d * 10), p(92 + d * 8));
      break;
    case 'HOUND':
      g.fillStyle(primary, 0.98).fillEllipse(p(-5), p(10), p(76), p(36)).fillCircle(p(34), p(-3), p(16));
      g.fillStyle(secondary, 1).fillTriangle(p(25), p(-15), p(33), p(-34), p(42), p(-12));
      for (const x of [-28, -8, 18, 32]) g.lineStyle(p(5), secondary, 1).lineBetween(p(x), p(24), p(x - 8), p(46));
      break;
    case 'LONG_SPEAR': basicPolearm(105, -9); break;
    case 'POT_SHIELD':
      g.fillStyle(primary, 0.98).fillEllipse(p(12), p(7), p(64), p(78));
      g.lineStyle(p(5), secondary, 1).strokeEllipse(p(12), p(7), p(64), p(78));
      g.fillStyle(accent, 0.9).fillCircle(p(12), p(7), p(7));
      break;
    case 'BLACK_FLAG':
      g.lineStyle(p(5), secondary, 1).lineBetween(p(-16), p(45), p(-16), p(-62));
      g.fillStyle(primary, 0.98).fillTriangle(p(-14), p(-55), p(56), p(-43), p(-14), p(-8));
      g.fillStyle(accent, 0.9).fillCircle(p(3), p(-31), p(7));
      break;
    case 'GLASS_ROD':
      g.lineStyle(p(6), secondary, 1).lineBetween(p(-32), p(14), p(65), p(-35));
      drawDiamond(g, p(65), p(-35), p(17), p(31), accent, 0.95);
      g.lineStyle(p(2), primary, 0.8).lineBetween(p(70), p(-37), p(105), p(-55));
      break;
    case 'BOAR':
    case 'MOSS_BOAR':
      g.fillStyle(primary, 0.98).fillEllipse(p(-4), p(9), p(88), p(52)).fillCircle(p(37), p(3), p(22));
      g.fillStyle(accent, 1).fillTriangle(p(47), p(4), p(68), p(-4), p(49), p(12));
      if (spec.shape === 'MOSS_BOAR') for (const x of [-32, -10, 12]) g.fillStyle(accent, 0.9).fillTriangle(p(x), p(-15), p(x + 7), p(-34), p(x + 15), p(-14));
      break;
    case 'MACE':
      g.lineStyle(p(7), secondary, 1).lineBetween(p(-22), p(22), p(54), p(-28));
      g.fillStyle(primary, 1).fillCircle(p(61), p(-33), p(18));
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI * 2 * i) / 6;
        g.lineStyle(p(4), accent, 1).lineBetween(p(61 + Math.cos(a) * 14), p(-33 + Math.sin(a) * 14), p(61 + Math.cos(a) * 25), p(-33 + Math.sin(a) * 25));
      }
      break;
    case 'GOLD_MASK':
      g.fillStyle(primary, 0.98).fillEllipse(p(12), p(-23), p(68), p(83));
      g.lineStyle(p(5), secondary, 1).strokeEllipse(p(12), p(-23), p(68), p(83));
      g.fillStyle(secondary, 1).fillEllipse(p(-1), p(-34), p(9), p(15)).fillEllipse(p(25), p(-34), p(9), p(15));
      g.lineStyle(p(4), accent, 0.9).lineBetween(p(-2), p(2), p(26), p(2));
      break;
    case 'IRON_GATE':
      g.fillStyle(primary, 0.98).fillRect(p(-38), p(-55), p(76), p(108));
      g.lineStyle(p(5), secondary, 1).strokeRect(p(-38), p(-55), p(76), p(108));
      for (const x of [-24, -8, 8, 24]) g.lineStyle(p(5), accent, 0.75).lineBetween(p(x), p(-48), p(x), p(48));
      break;
    case 'MUSHROOM':
      g.fillStyle(primary, 0.98).fillEllipse(0, p(-25), p(94), p(48));
      g.fillStyle(secondary, 1).fillRect(p(-18), p(-20), p(36), p(68));
      for (const x of [-25, 0, 25]) g.fillStyle(accent, 0.8).fillCircle(p(x), p(-28), p(6));
      break;
    case 'VINE_RIDER':
      basicPolearm(86, -11);
      g.lineStyle(p(5), primary, 1).lineBetween(p(-36), p(20), p(-8), p(-28)).lineBetween(p(-8), p(-28), p(22), p(17));
      g.fillStyle(accent, 0.95).fillTriangle(p(-17), p(-6), p(-39), p(-18), p(-23), p(7));
      break;
    case 'SEED_CANNON':
      g.fillStyle(primary, 0.98).fillRect(p(-45), p(5), p(72), p(43));
      g.fillStyle(secondary, 1).fillCircle(p(-27), p(47), p(12)).fillCircle(p(12), p(47), p(12));
      g.lineStyle(p(13), secondary, 1).lineBetween(p(5), p(3), p(74), p(-31));
      g.fillStyle(accent, 0.98).fillCircle(p(80), p(-34), p(11));
      break;
    case 'BONE_WHEEL':
      g.lineStyle(p(6), primary, 1).strokeCircle(0, p(5), p(39));
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI * 2 * i) / 8;
        g.lineStyle(p(4), accent, 0.95).lineBetween(0, p(5), p(Math.cos(a) * 39), p(5 + Math.sin(a) * 39));
      }
      break;
    case 'COFFIN_BUG':
      g.fillStyle(primary, 0.98).fillRect(p(-35), p(-40), p(70), p(82));
      g.lineStyle(p(5), secondary, 1).strokeRect(p(-35), p(-40), p(70), p(82));
      for (const side of [-1, 1]) for (let i = 0; i < 3; i += 1) g.lineStyle(p(4), accent, 0.85).lineBetween(p(side * 35), p(-18 + i * 20), p(side * 58), p(-27 + i * 24));
      break;
    case 'GRAVE_BELL':
      g.fillStyle(primary, 0.98).fillEllipse(0, p(2), p(70), p(68));
      g.fillStyle(secondary, 1).fillRect(p(-38), p(24), p(76), p(15));
      g.lineStyle(p(5), accent, 0.85).lineBetween(0, p(-31), 0, p(-61));
      g.fillStyle(accent, 0.95).fillCircle(0, p(34), p(8));
      break;
    case 'EMPTY_ARMOR':
      g.fillStyle(primary, 0.98).fillRoundedRect(p(-30), p(-35), p(60), p(75), p(8));
      g.fillStyle(secondary, 1).fillEllipse(0, p(-49), p(42), p(32));
      g.lineStyle(p(4), accent, 0.8).lineBetween(p(-16), p(-48), p(16), p(-48));
      break;
    case 'ROOT_SPIDER':
      g.fillStyle(primary, 0.98).fillEllipse(0, p(-4), p(82), p(52));
      for (const side of [-1, 1]) for (let i = 0; i < 4; i += 1) {
        const y = -18 + i * 12;
        g.lineStyle(p(6), secondary, 1).lineBetween(p(side * 29), p(y), p(side * (64 + i * 5)), p(y + (i - 1.5) * 12));
      }
      g.fillStyle(accent, 0.95).fillCircle(p(-14), p(-9), p(5)).fillCircle(p(14), p(-9), p(5));
      break;
    case 'FUNERAL_KING':
      g.fillStyle(primary, 0.98).fillRect(p(-32), p(-28), p(64), p(78));
      g.fillStyle(secondary, 1).fillEllipse(0, p(-34), p(48), p(42));
      for (const x of [-18, 0, 18]) g.fillStyle(accent, 0.95).fillTriangle(p(x - 9), p(-57), p(x), p(-78), p(x + 9), p(-57));
      g.lineStyle(p(5), accent, 0.9).lineBetween(p(35), p(-10), p(64), p(44));
      break;
  }
}

/** Shared lightweight identity renderer for common recruitment and chapter 1-2 enemy placeholders. */
export function createSignatureSilhouetteOverlayGraphics(
  scene: Phaser.Scene,
  spec: SignatureSilhouetteOverlaySpec,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(4);
  drawSignatureShape(graphics, spec);
  return graphics;
}
