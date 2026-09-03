import Phaser from 'phaser';
import type { LateEnemySilhouetteOverlaySpec } from './late-enemy-silhouette-overlays.ts';

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha)
    .fillTriangle(x, y - h / 2, x + w / 2, y, x, y + h / 2)
    .fillTriangle(x, y - h / 2, x - w / 2, y, x, y + h / 2);
}

function gear(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, teeth = 8): void {
  g.lineStyle(Math.max(3, r * 0.18), color, 1).strokeCircle(x, y, r);
  for (let i = 0; i < teeth; i += 1) {
    const a = (Math.PI * 2 * i) / teeth;
    g.lineBetween(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8));
  }
}

function drawLateEnemy(g: Phaser.GameObjects.Graphics, spec: LateEnemySilhouetteOverlaySpec): void {
  const s = spec.scale;
  const v = spec.variant;
  const p = (value: number): number => value * s;
  const a = spec.primaryColor;
  const b = spec.secondaryColor;
  const c = spec.accentColor;

  switch (spec.shape) {
    case 'ARCANE_EYE':
      g.fillStyle(a, 0.92).fillEllipse(0, p(-8), p(76), p(54));
      g.lineStyle(p(5), b, 1).strokeEllipse(0, p(-8), p(76), p(54));
      g.fillStyle(c, 1).fillCircle(0, p(-8), p(12));
      g.fillStyle(b, 1).fillCircle(0, p(-8), p(5));
      for (let i = 0; i < 3; i += 1) diamond(g, p(-28 + i * 28), p(31), p(10), p(22), c, 0.75);
      break;
    case 'ARCHIVE':
      for (let i = 0; i < 3 + Math.min(2, v); i += 1) {
        const y = p(28 - i * 20);
        g.fillStyle(i % 2 ? a : b, 0.98).fillRect(p(-31 - i * 2), y - p(15), p(62 + i * 4), p(17));
        g.lineStyle(p(2), c, 0.65).strokeRect(p(-31 - i * 2), y - p(15), p(62 + i * 4), p(17));
      }
      if (v >= 3) g.lineStyle(p(3), c, 0.8).strokeCircle(0, p(-55), p(17));
      break;
    case 'BEAST': {
      const longBody = v >= 4 ? 104 : 82;
      g.fillStyle(a, 0.98).fillEllipse(p(-5), p(10), p(longBody), p(48 + Math.min(v, 4) * 3));
      g.fillCircle(p(37 + Math.min(v, 4) * 3), p(-2), p(19 + Math.min(v, 4)));
      g.fillStyle(c, 1).fillTriangle(p(48), p(1), p(72 + v * 3), p(-7), p(51), p(13));
      for (const x of [-32, -10, 15, 34]) g.lineStyle(p(5), b, 1).lineBetween(p(x), p(27), p(x - 7), p(49));
      if (v >= 3) for (const x of [-28, -6, 18]) g.fillStyle(c, 0.85).fillTriangle(p(x), p(-15), p(x + 7), p(-35), p(x + 15), p(-14));
      if (v >= 6) g.lineStyle(p(5), c, 0.8).lineBetween(p(-46), p(5), p(-78), p(-28));
      break;
    }
    case 'CHAIN_DEMON':
      g.fillStyle(a, 0.98).fillRoundedRect(p(-28), p(-35), p(56), p(78), p(10));
      g.fillStyle(b, 1).fillTriangle(p(-20), p(-35), p(-35), p(-61), p(-6), p(-41)).fillTriangle(p(20), p(-35), p(35), p(-61), p(6), p(-41));
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4 + v; i += 1) g.lineStyle(p(3), c, 0.9).strokeCircle(p(side * (31 + i * 8)), p(-12 + i * 11), p(7));
      }
      break;
    case 'ARTILLERY':
      g.fillStyle(a, 0.98).fillRect(p(-45), p(4), p(74), p(42));
      g.fillStyle(b, 1).fillCircle(p(-28), p(47), p(12)).fillCircle(p(12), p(47), p(12));
      for (let i = 0; i < v; i += 1) {
        const y = -17 - i * 13;
        g.lineStyle(p(10), b, 1).lineBetween(p(2), p(y + 18), p(69 + i * 6), p(y - 8));
        diamond(g, p(75 + i * 6), p(y - 11), p(13), p(22), c, 0.95);
      }
      break;
    case 'MIRROR':
      for (let i = 0; i < 3 + v; i += 1) {
        const theta = (Math.PI * 2 * i) / (3 + v);
        diamond(g, p(Math.cos(theta) * 38), p(Math.sin(theta) * 45), p(17), p(31), i % 2 ? a : c, 0.92);
      }
      g.lineStyle(p(2), b, 0.7).strokeEllipse(0, 0, p(84), p(98));
      break;
    case 'MAGE':
      g.fillStyle(a, 0.98).fillTriangle(p(-35), p(48), 0, p(-56 - v * 5), p(35), p(48));
      g.fillStyle(b, 1).fillEllipse(0, p(-38), p(42), p(28));
      g.lineStyle(p(4), c, 0.9).lineBetween(p(30), p(36), p(49), p(-52));
      for (let i = 0; i < Math.min(4, v + 1); i += 1) g.fillStyle(c, 0.8).fillCircle(p(-24 + i * 18), p(-62 - (i % 2) * 8), p(5));
      break;
    case 'DEMON_NOBLE':
      g.fillStyle(a, 0.98).fillRect(p(-30), p(-24), p(60), p(72));
      g.fillStyle(b, 1).fillTriangle(p(-28), p(-28), p(-52), p(-58 - v * 3), p(-10), p(-37)).fillTriangle(p(28), p(-28), p(52), p(-58 - v * 3), p(10), p(-37));
      g.fillStyle(c, 0.88).fillTriangle(p(-30), p(0), p(-63), p(48), p(-17), p(31)).fillTriangle(p(30), p(0), p(63), p(48), p(17), p(31));
      if (v >= 3) g.lineStyle(p(4), c, 0.9).lineBetween(p(38), p(12), p(70), p(-44));
      break;
    case 'SAW_BIRD':
      g.fillStyle(a, 0.98).fillEllipse(0, 0, p(62), p(34));
      g.fillStyle(b, 1).fillTriangle(p(-12), 0, p(-63), p(-31), p(-39), p(16)).fillTriangle(p(12), 0, p(63), p(-31), p(39), p(16));
      gear(g, p(28), p(5), p(15), c, 9);
      break;
    case 'MAGNET_SPIDER':
      g.fillStyle(a, 0.98).fillEllipse(0, p(-3), p(62), p(42));
      for (const side of [-1, 1]) for (let i = 0; i < 4; i += 1) {
        const y = -20 + i * 13;
        g.lineStyle(p(5), b, 1).lineBetween(p(side * 25), p(y), p(side * (55 + i * 3)), p(y + (i - 1.5) * 10));
      }
      g.lineStyle(p(8), c, 1).lineBetween(p(-17), p(-8), p(-17), p(17)).lineBetween(p(17), p(-8), p(17), p(17));
      g.lineBetween(p(-17), p(17), p(17), p(17));
      break;
    case 'RAIL_WORM':
      for (let i = 0; i < 5; i += 1) g.fillStyle(i % 2 ? b : a, 0.98).fillEllipse(p(-48 + i * 24), p(8 - Math.sin(i) * 8), p(34), p(30));
      g.lineStyle(p(5), c, 0.8).lineBetween(p(-62), p(29), p(62), p(29));
      g.fillStyle(c, 0.95).fillTriangle(p(58), p(1), p(89), p(-4), p(59), p(14));
      break;
    case 'FURNACE':
      g.fillStyle(a, 0.98).fillRoundedRect(p(-37), p(-42), p(74), p(88), p(8));
      g.lineStyle(p(6), b, 1).strokeRoundedRect(p(-37), p(-42), p(74), p(88), p(8));
      g.fillStyle(c, 0.96).fillEllipse(0, p(8), p(36), p(43));
      for (let i = 0; i < 2 + v; i += 1) g.lineStyle(p(4), c, 0.8).lineBetween(p(-25 + i * 14), p(-34), p(-18 + i * 12), p(-52 - i * 4));
      break;
    case 'PAPER':
      g.fillStyle(a, 0.93).fillTriangle(p(-34), p(46), 0, p(-49), p(34), p(46));
      g.fillTriangle(p(-12), p(-8), p(-55), p(6), p(-18), p(23)).fillTriangle(p(12), p(-8), p(55), p(6), p(18), p(23));
      g.lineStyle(p(3), b, 0.9).lineBetween(0, p(-47), 0, p(46));
      g.fillStyle(c, 0.95).fillTriangle(p(17), p(-12), p(63), p(-2), p(18), p(2));
      break;
    case 'ERROR':
      for (let i = 0; i < 7; i += 1) {
        const x = ((i * 29) % 67) - 33;
        const y = ((i * 41) % 73) - 35;
        if (i % 2) diamond(g, p(x), p(y), p(24), p(32), i % 3 ? a : c, 0.82);
        else g.fillStyle(i % 3 ? a : b, 0.82).fillRect(p(x - 12), p(y - 9), p(31), p(25));
      }
      g.lineStyle(p(3), c, 0.8).strokeCircle(0, 0, p(44));
      break;
    case 'VOID_LENS':
      g.fillStyle(a, 0.93).fillEllipse(0, 0, p(88), p(63));
      g.lineStyle(p(6), b, 1).strokeEllipse(0, 0, p(88), p(63));
      g.fillStyle(c, 0.95).fillCircle(0, 0, p(18));
      g.fillStyle(b, 1).fillCircle(0, 0, p(8));
      for (let i = 0; i < 4; i += 1) diamond(g, p(-51 + i * 34), p(i % 2 ? 39 : -39), p(10), p(20), c, 0.75);
      break;
    case 'CAVALRY':
      g.fillStyle(a, 0.98).fillEllipse(p(-9), p(17), p(91), p(43));
      g.fillStyle(b, 1).fillRoundedRect(p(-6), p(-36), p(43), p(64), p(7));
      g.lineStyle(p(5), c, 1).lineBetween(p(12), p(-11), p(83), p(-28));
      g.fillStyle(c, 1).fillTriangle(p(100), p(-32), p(80), p(-39), p(82), p(-18));
      for (const x of [-33, -12, 19, 36]) g.lineStyle(p(5), b, 1).lineBetween(p(x), p(31), p(x - 6), p(51));
      break;
    case 'THRONE':
      g.fillStyle(a, 0.98).fillRect(p(-43), p(-28), p(86), p(77));
      g.fillStyle(b, 1).fillRect(p(-31), p(-65), p(62), p(43));
      for (const x of [-25, 0, 25]) g.fillStyle(c, 0.95).fillTriangle(p(x - 9), p(-62), p(x), p(-86), p(x + 9), p(-62));
      for (const x of [-31, 31]) gear(g, p(x), p(49), p(14), b, 8);
      break;
    case 'ENGINE':
      g.fillStyle(a, 0.98).fillCircle(0, 0, p(46));
      gear(g, 0, 0, p(48), b, 12);
      g.fillStyle(c, 0.92).fillCircle(0, 0, p(21));
      g.fillStyle(b, 1).fillCircle(0, 0, p(9));
      for (const side of [-1, 1]) g.lineStyle(p(9), a, 1).lineBetween(p(side * 37), p(-8), p(side * 78), p(-36));
      break;
    case 'KING':
      g.fillStyle(a, 0.98).fillRect(p(-31), p(-28), p(62), p(78));
      g.fillStyle(b, 1).fillEllipse(0, p(-36), p(49), p(42));
      for (const x of [-17, 0, 17]) g.fillStyle(c, 0.95).fillTriangle(p(x - 9), p(-58), p(x), p(-80), p(x + 9), p(-58));
      g.lineStyle(p(5), c, 0.9).lineBetween(p(36), p(-4), p(64), p(48));
      break;
    case 'CASTLE':
      g.fillStyle(a, 0.98).fillRect(p(-55), p(-34), p(110), p(86));
      g.lineStyle(p(5), b, 1).strokeRect(p(-55), p(-34), p(110), p(86));
      for (const x of [-43, -14, 15, 44]) g.fillStyle(a, 1).fillRect(p(x - 9), p(-51), p(18), p(19));
      g.fillStyle(c, 0.8).fillRect(p(-13), p(8), p(26), p(44));
      if (v >= 2) for (const x of [-42, 42]) gear(g, p(x), p(55), p(13), b, 8);
      break;
    case 'ANOMALY':
      g.fillStyle(a, 0.75).fillCircle(0, 0, p(39));
      for (let i = 0; i < 7; i += 1) {
        const theta = (Math.PI * 2 * i) / 7;
        diamond(g, p(Math.cos(theta) * (42 + (i % 2) * 9)), p(Math.sin(theta) * (42 + (i % 2) * 9)), p(16), p(29), i % 2 ? c : b, 0.85);
      }
      g.lineStyle(p(3), c, 0.8).strokeEllipse(0, 0, p(112), p(72));
      break;
    case 'VEHICLE': {
      const length = 76 + v * 17;
      g.fillStyle(a, 0.98).fillRect(p(-length / 2), p(-8), p(length), p(47));
      g.fillStyle(b, 1).fillRect(p(-length / 2 + 10), p(-34), p(Math.max(32, length * 0.45)), p(29));
      const wheels = v >= 2 ? [-length * 0.32, 0, length * 0.32] : [-length * 0.27, length * 0.27];
      for (const x of wheels) g.fillStyle(b, 1).fillCircle(p(x), p(40), p(12));
      g.fillStyle(c, 0.9).fillRect(p(length / 2 - 20), p(3), p(17), p(9));
      break;
    }
    case 'GOLEM':
      g.fillStyle(a, 0.98).fillRoundedRect(p(-38 - v * 2), p(-39 - v * 3), p(76 + v * 4), p(86 + v * 6), p(8));
      g.fillStyle(b, 1).fillRect(p(-51), p(-18), p(18), p(53)).fillRect(p(33), p(-18), p(18), p(53));
      g.lineStyle(p(4), c, 0.85).strokeRect(p(-23), p(-18), p(46), p(38));
      if (v >= 2) g.fillStyle(c, 0.85).fillCircle(0, 0, p(9));
      break;
    case 'CARRIER':
      g.fillStyle(a, 0.98).fillEllipse(p(-7), p(7), p(88 + v * 8), p(51 + v * 5));
      g.fillStyle(b, 1).fillRect(p(-31), p(-42 - v * 4), p(58 + v * 6), p(48 + v * 5));
      g.lineStyle(p(5), c, 0.8).strokeRect(p(-31), p(-42 - v * 4), p(58 + v * 6), p(48 + v * 5));
      for (const x of [-28, -5, 22]) g.lineStyle(p(5), b, 1).lineBetween(p(x), p(28), p(x - 6), p(50));
      break;
    case 'SOUL':
      if (v === 1) {
        g.fillStyle(c, 0.72).fillCircle(0, p(-5), p(23)).fillTriangle(p(-20), p(8), 0, p(51), p(20), p(8));
      } else if (v === 2) {
        g.fillStyle(a, 0.88).fillRoundedRect(p(-29), p(-34), p(58), p(76), p(7));
        g.fillStyle(c, 0.8).fillCircle(0, p(-46), p(17));
      } else if (v === 3) {
        g.fillStyle(c, 0.75).fillCircle(p(-16), p(-7), p(21));
        g.lineStyle(p(9), b, 1).lineBetween(p(3), p(11), p(63), p(-39));
        g.fillStyle(a, 1).fillCircle(p(69), p(-44), p(20));
      } else {
        for (let i = 0; i < 5; i += 1) g.fillStyle(i % 2 ? a : c, 0.72).fillCircle(p(-34 + i * 17), p((i % 2) * 12 - 6), p(14));
      }
      break;
    case 'FORGE':
      g.fillStyle(a, 0.98).fillRoundedRect(p(-48 - v * 5), p(-43 - v * 4), p(96 + v * 10), p(91 + v * 8), p(9));
      g.lineStyle(p(6), b, 1).strokeRoundedRect(p(-48 - v * 5), p(-43 - v * 4), p(96 + v * 10), p(91 + v * 8), p(9));
      g.fillStyle(c, 0.9).fillEllipse(0, p(7), p(48 + v * 7), p(49 + v * 4));
      for (let i = 0; i < 4 + v; i += 1) g.fillStyle(c, 0.65).fillCircle(p(-36 + i * 15), p(-48 - (i % 2) * 10), p(5 + (i % 3)));
      break;
    case 'SEAL':
      g.lineStyle(p(5), b, 1).strokeCircle(0, 0, p(29 + v * 7));
      for (let i = 0; i < 3 + v; i += 1) {
        const theta = (Math.PI * 2 * i) / (3 + v);
        diamond(g, p(Math.cos(theta) * (36 + v * 6)), p(Math.sin(theta) * (36 + v * 6)), p(16 + v), p(27 + v * 2), i % 2 ? a : c, 0.92);
      }
      if (v >= 3) g.fillStyle(a, 0.9).fillRoundedRect(p(-23), p(-31), p(46), p(66), p(7));
      break;
    case 'RIFT':
      if (v === 1) {
        for (let i = 0; i < 4; i += 1) diamond(g, p(-30 + i * 20), p(i % 2 ? 15 : -12), p(15), p(29), i % 2 ? a : c, 0.9);
      } else if (v === 2) {
        g.lineStyle(p(5), b, 1).strokeCircle(0, 0, p(34));
        diamond(g, 0, 0, p(35), p(58), c, 0.9);
      } else if (v === 3) {
        g.fillStyle(a, 0.8).fillEllipse(0, 0, p(78), p(53));
        g.fillStyle(c, 0.95).fillCircle(0, 0, p(14));
        g.lineStyle(p(3), c, 0.75).lineBetween(p(20), 0, p(91), p(-38));
      } else {
        g.fillStyle(a, 0.6).fillCircle(0, 0, p(47));
        for (let i = 0; i < 8; i += 1) {
          const theta = (Math.PI * 2 * i) / 8;
          diamond(g, p(Math.cos(theta) * 58), p(Math.sin(theta) * 46), p(18), p(33), i % 2 ? c : b, 0.88);
        }
      }
      break;
    case 'EVENT_CREATURE':
      if (v === 1) {
        g.fillStyle(a, 0.98).fillEllipse(0, p(10), p(79), p(46));
        for (const side of [-1, 1]) for (let i = 0; i < 3; i += 1) g.lineStyle(p(4), b, 1).lineBetween(p(side * (21 + i * 7)), p(24), p(side * (42 + i * 7)), p(42));
        g.fillStyle(c, 0.9).fillTriangle(p(-14), p(-8), 0, p(-28), p(14), p(-8));
      } else {
        g.fillStyle(a, 0.72).fillEllipse(0, p(-15), p(76), p(55));
        for (let i = 0; i < 6; i += 1) g.lineStyle(p(4), c, 0.75).lineBetween(p(-30 + i * 12), p(7), p(-38 + i * 15), p(52));
        for (const x of [-22, 0, 22]) g.fillStyle(c, 0.9).fillCircle(p(x), p(-18), p(6));
      }
      break;
    case 'EVENT_MACHINE':
      if (v === 1) {
        g.fillStyle(a, 0.98).fillEllipse(0, 0, p(72), p(29));
        g.fillStyle(c, 0.9).fillCircle(0, 0, p(9));
        for (const x of [-30, 30]) g.lineStyle(p(5), b, 1).lineBetween(p(x), 0, p(x * 1.45), p(20));
      } else if (v === 2) {
        g.fillStyle(a, 0.98).fillCircle(0, 0, p(31));
        for (let i = 0; i < 6; i += 1) {
          const theta = (Math.PI * 2 * i) / 6;
          g.fillStyle(c, 0.95).fillTriangle(p(Math.cos(theta) * 24), p(Math.sin(theta) * 24), p(Math.cos(theta) * 61 - 8), p(Math.sin(theta) * 61 - 8), p(Math.cos(theta) * 61 + 8), p(Math.sin(theta) * 61 + 8));
        }
      } else if (v === 3) {
        g.fillStyle(a, 0.98).fillRoundedRect(p(-42), p(-49), p(84), p(98), p(7));
        g.lineStyle(p(6), b, 1).strokeRoundedRect(p(-42), p(-49), p(84), p(98), p(7));
        g.fillStyle(c, 0.9).fillCircle(p(10), 0, p(8));
      } else if (v === 4) {
        g.fillStyle(a, 0.98).fillRect(p(-49), p(6), p(79), p(39));
        g.fillStyle(b, 1).fillCircle(p(-30), p(45), p(11)).fillCircle(p(12), p(45), p(11));
        g.lineStyle(p(10), b, 1).lineBetween(p(0), p(2), p(79), p(-38));
        diamond(g, p(84), p(-41), p(15), p(25), c, 0.95);
      } else {
        g.fillStyle(a, 0.98).fillRoundedRect(p(-38), p(-38), p(76), p(77), p(10));
        for (const x of [-43, 43]) gear(g, p(x), p(4), p(14), b, 8);
        g.fillStyle(c, 0.9).fillCircle(0, p(-4), p(12));
        g.lineStyle(p(6), c, 0.7).lineBetween(p(-25), p(35), p(-45), p(63)).lineBetween(p(25), p(35), p(45), p(63));
      }
      break;
  }
}

/** Shared presentation-only renderer for chapter 3-4 and special/event enemy identities. */
export function createLateEnemySilhouetteGraphics(
  scene: Phaser.Scene,
  spec: LateEnemySilhouetteOverlaySpec,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(4);
  drawLateEnemy(graphics, spec);
  return graphics;
}
