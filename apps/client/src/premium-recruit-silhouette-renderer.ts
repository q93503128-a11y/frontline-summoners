import Phaser from 'phaser';
import type { PremiumRecruitSilhouetteShape, PremiumRecruitSilhouetteSpec } from './premium-recruit-silhouette-overlays.ts';

function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha)
    .fillTriangle(x, y - h / 2, x + w / 2, y, x, y + h / 2)
    .fillTriangle(x, y - h / 2, x - w / 2, y, x, y + h / 2);
}

function humanoid(
  g: Phaser.GameObjects.Graphics,
  p: (value: number) => number,
  primary: number,
  secondary: number,
  headY = -35,
): void {
  g.fillStyle(primary, 0.98).fillCircle(0, p(headY), p(11));
  g.fillStyle(secondary, 0.98).fillRoundedRect(p(-14), p(headY + 11), p(28), p(48), p(7));
  g.lineStyle(p(5), secondary, 1).lineBetween(p(-9), p(headY + 54), p(-15), p(37)).lineBetween(p(9), p(headY + 54), p(15), p(37));
}

function drawPremiumShape(g: Phaser.GameObjects.Graphics, spec: PremiumRecruitSilhouetteSpec): void {
  const s = spec.scale;
  const d = spec.formOrder;
  const p = (value: number): number => value * s;
  const primary = spec.primaryColor;
  const secondary = spec.secondaryColor;
  const accent = spec.accentColor;

  switch (spec.shape as PremiumRecruitSilhouetteShape) {
    case 'STAR_LANCE': {
      humanoid(g, p, primary, secondary);
      const length = 92 + d * 20;
      g.lineStyle(p(5), secondary, 1).lineBetween(p(-38), p(-5), p(length), p(-13));
      diamond(g, p(length + 15), p(-14), p(24 + d * 3), p(34 + d * 4), accent, 1);
      g.fillStyle(accent, 0.9).fillTriangle(p(-18), p(-22), p(-42 - d * 4), p(5), p(-10), p(18));
      if (d >= 2) g.lineStyle(p(3), accent, 0.85).lineBetween(p(18), p(-50), p(18), p(22));
      if (d === 3) diamond(g, p(18), p(-58), p(20), p(27), accent, 0.95);
      break;
    }
    case 'RELIC_MAUL': {
      humanoid(g, p, primary, secondary, -33);
      const headW = 46 + d * 10;
      const headH = 32 + d * 7;
      g.lineStyle(p(7), secondary, 1).lineBetween(p(9), p(3), p(61), p(-45));
      g.fillStyle(primary, 0.99).fillRoundedRect(p(54 - headW / 2), p(-49 - headH / 2), p(headW), p(headH), p(6));
      g.lineStyle(p(4), accent, 0.95).strokeRoundedRect(p(54 - headW / 2), p(-49 - headH / 2), p(headW), p(headH), p(6));
      g.lineStyle(p(2), accent, 0.8).lineBetween(p(48), p(-61), p(58), p(-50)).lineBetween(p(58), p(-50), p(51), p(-36));
      if (d >= 2) g.lineStyle(p(3), accent, 0.65).strokeCircle(0, p(-35), p(24 + d * 4));
      if (d === 3) for (const x of [-31, 31]) diamond(g, p(x), p(-48), p(10), p(16), accent, 0.8);
      break;
    }
    case 'CRYSTAL_BOW': {
      humanoid(g, p, primary, secondary);
      const r = 42 + d * 7;
      g.lineStyle(p(5), accent, 1)
        .lineBetween(p(13), p(-r), p(38), 0)
        .lineBetween(p(38), 0, p(13), p(r));
      g.lineStyle(p(2), primary, 0.9).lineBetween(p(13), p(-r), p(13), p(r));
      g.lineStyle(p(4), secondary, 1).lineBetween(p(-18), 0, p(62 + d * 14), p(-8));
      diamond(g, p(69 + d * 14), p(-9), p(15), p(25), accent, 1);
      if (d >= 2) diamond(g, p(33), p(-r + 7), p(12), p(19), primary, 0.9);
      if (d === 3) diamond(g, p(33), p(r - 7), p(12), p(19), primary, 0.9);
      break;
    }
    case 'BLACK_ROSE_KNIGHT': {
      g.fillStyle(secondary, 0.99).fillRoundedRect(p(-30), p(-35), p(58 + d * 5), p(82 + d * 5), p(8));
      g.fillStyle(primary, 1).fillEllipse(p(-5), p(-48), p(44), p(34));
      g.fillStyle(primary, 1).fillCircle(p(-29), p(-20), p(21 + d * 3));
      const swordLen = 76 + d * 12;
      g.lineStyle(p(9), secondary, 1).lineBetween(p(14), p(3), p(swordLen), p(-47));
      g.fillStyle(accent, 0.95).fillTriangle(p(swordLen - 4), p(-51), p(swordLen + 24), p(-63), p(swordLen + 8), p(-36));
      g.fillStyle(accent, 0.95).fillCircle(p(-25), p(-18), p(7 + d));
      if (d === 3) for (const a of [-18, 0, 18]) g.fillStyle(accent, 0.75).fillCircle(p(-25 + a / 3), p(-18 + a / 2), p(4));
      break;
    }
    case 'PUPPET_MASTER': {
      humanoid(g, p, primary, secondary, -37);
      const puppetX = 54 + d * 8;
      const puppetScale = 1 + d * 0.16;
      g.lineStyle(p(2), accent, 0.8).lineBetween(p(-4), p(-49), p(puppetX - 10), p(-62)).lineBetween(p(6), p(-43), p(puppetX + 13), p(-55));
      g.fillStyle(primary, 0.97).fillCircle(p(puppetX), p(-35), p(12 * puppetScale));
      g.fillStyle(secondary, 0.98).fillRoundedRect(p(puppetX - 13 * puppetScale), p(-24), p(26 * puppetScale), p(48 * puppetScale), p(5));
      g.lineStyle(p(5), secondary, 1).lineBetween(p(puppetX - 11), p(5), p(puppetX - 24), p(32)).lineBetween(p(puppetX + 11), p(5), p(puppetX + 27), p(29));
      if (d >= 2) diamond(g, p(puppetX), p(3), p(12 + d * 2), p(20 + d * 2), accent, 0.95);
      if (d === 3) for (const x of [-1, 1]) g.lineStyle(p(4), accent, 0.9).lineBetween(p(puppetX + x * 16), p(-10), p(puppetX + x * 36), p(-28));
      break;
    }
    case 'STAR_PRINCESS': {
      humanoid(g, p, primary, secondary, -40);
      g.fillStyle(accent, 0.95).fillTriangle(p(-13), p(-54), 0, p(-75 - d * 2), p(13), p(-54));
      const count = d === 3 ? 4 : 3;
      const rx = 44 + d * 7;
      const ry = 38 + d * 5;
      g.lineStyle(p(2), accent, 0.45).strokeEllipse(0, p(-3), p(rx * 2), p(ry * 2));
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count - Math.PI / 2;
        diamond(g, p(Math.cos(a) * rx), p(-3 + Math.sin(a) * ry), p(15 + d * 2), p(23 + d * 3), accent, 0.98);
      }
      if (d >= 2) g.lineStyle(p(3), primary, 0.75).strokeCircle(0, p(-3), p(24 + d * 2));
      break;
    }
    case 'MOUNTAIN_SHELL': {
      g.fillStyle(primary, 0.99).fillEllipse(p(-6), p(13), p(105 + d * 12), p(62 + d * 8));
      g.fillStyle(secondary, 1).fillCircle(p(46), p(7), p(21 + d));
      for (const x of [-37, -10, 18]) g.lineStyle(p(8), secondary, 1).lineBetween(p(x), p(36), p(x - 8), p(54));
      for (let i = 0; i < d + 2; i += 1) {
        const x = -36 + i * (72 / (d + 1));
        g.fillStyle(accent, 0.9).fillTriangle(p(x - 13), p(-4), p(x), p(-35 - i * 3), p(x + 13), p(-4));
      }
      break;
    }
    case 'SCYTHE_TAIL': {
      g.fillStyle(primary, 0.99).fillEllipse(p(-4), p(14), p(82), p(40)).fillCircle(p(32), p(5), p(16));
      for (const x of [-28, -8, 15, 31]) g.lineStyle(p(5), secondary, 1).lineBetween(p(x), p(28), p(x - 12), p(46));
      g.lineStyle(p(6), secondary, 1).lineBetween(p(-39), p(12), p(-66 - d * 9), p(-8)).lineBetween(p(-66 - d * 9), p(-8), p(-78 - d * 13), p(-40));
      g.fillStyle(accent, 1).fillTriangle(p(-86 - d * 13), p(-54), p(-62 - d * 9), p(-42), p(-80 - d * 10), p(-25));
      if (d === 3) g.fillStyle(accent, 0.8).fillTriangle(p(18), p(-9), p(28), p(-30), p(37), p(-8));
      break;
    }
    case 'SPORE_BALLOON': {
      g.fillStyle(primary, 0.96).fillEllipse(0, p(-30), p(94 + d * 8), p(64 + d * 8));
      g.fillStyle(secondary, 0.98).fillRoundedRect(p(-17), p(-10), p(34), p(57), p(12));
      for (const x of [-28, 0, 28]) g.lineStyle(p(4), secondary, 0.9).lineBetween(p(x), p(24), p(x + (x === 0 ? 7 : -Math.sign(x) * 8)), p(54));
      const spores = 2 + d * 2;
      for (let i = 0; i < spores; i += 1) {
        const a = (Math.PI * 2 * i) / spores;
        g.fillStyle(accent, 0.7).fillCircle(p(Math.cos(a) * (48 + d * 3)), p(-12 + Math.sin(a) * (38 + d * 2)), p(4 + (i % 2)));
      }
      break;
    }
    case 'SKY_JAW': {
      const width = 102 + d * 12;
      g.fillStyle(primary, 0.99).fillEllipse(p(-7), p(8), p(width), p(68 + d * 6));
      g.fillStyle(secondary, 1).fillTriangle(p(-30), p(-4), p(58 + d * 6), p(-28), p(58 + d * 6), p(10));
      g.fillStyle(secondary, 1).fillTriangle(p(-30), p(12), p(58 + d * 6), p(38), p(58 + d * 6), p(4));
      for (let i = 0; i < 4 + d; i += 1) {
        const x = 3 + i * (48 / (3 + d));
        g.fillStyle(accent, 1).fillTriangle(p(x - 5), p(-10), p(x), p(1), p(x + 5), p(-10));
        g.fillTriangle(p(x - 5), p(17), p(x), p(6), p(x + 5), p(17));
      }
      for (const x of [-32, 12]) g.lineStyle(p(7), secondary, 1).lineBetween(p(x), p(35), p(x - 10), p(53));
      break;
    }
    case 'CRYSTAL_BEETLE': {
      g.fillStyle(primary, 0.99).fillEllipse(0, p(8), p(86 + d * 6), p(53 + d * 5));
      g.lineStyle(p(5), secondary, 1).lineBetween(0, p(-14), 0, p(35));
      for (const side of [-1, 1]) for (let i = 0; i < 3; i += 1) g.lineStyle(p(4), secondary, 1).lineBetween(p(side * (20 + i * 5)), p(-2 + i * 13), p(side * (48 + i * 6)), p(-9 + i * 18));
      for (let i = 0; i < 2 + d; i += 1) {
        const x = -26 + i * (52 / (1 + d));
        diamond(g, p(x), p(-28 - (i % 2) * 7), p(16 + d), p(33 + d * 4), accent, 0.96);
      }
      break;
    }
    case 'WORLD_BACK': {
      g.fillStyle(primary, 1).fillEllipse(p(-8), p(16), p(122 + d * 11), p(70 + d * 7));
      g.fillStyle(secondary, 1).fillCircle(p(50), p(8), p(23 + d));
      for (const x of [-38, -5, 27, 48]) g.lineStyle(p(9), secondary, 1).lineBetween(p(x), p(42), p(x - 7), p(61));
      const towers = 2 + d;
      for (let i = 0; i < towers; i += 1) {
        const x = -41 + i * (76 / Math.max(1, towers - 1));
        const h = 23 + (i % 2) * 14 + d * 3;
        g.fillStyle(accent, 0.82).fillRect(p(x - 7), p(-10 - h), p(14), p(h));
        g.fillStyle(secondary, 0.95).fillTriangle(p(x - 9), p(-10 - h), p(x), p(-24 - h), p(x + 9), p(-10 - h));
      }
      if (d === 3) g.lineStyle(p(3), accent, 0.65).lineBetween(p(-56), p(-12), p(49), p(-12));
      break;
    }
    case 'DUAL_BLADE': {
      humanoid(g, p, primary, secondary, -36);
      const bladeLen = 55 + d * 12;
      for (const side of [-1, 1]) {
        g.lineStyle(p(6), secondary, 1).lineBetween(p(side * 12), p(-6), p(side * 35), p(10));
        g.lineStyle(p(8 + d), accent, 0.95).lineBetween(p(side * 34), p(10), p(side * bladeLen), p(-23));
      }
      g.fillStyle(accent, 0.9).fillRect(p(-7), p(-23), p(14), p(12));
      if (d === 3) for (const side of [-1, 1]) diamond(g, p(side * 25), p(-42), p(10), p(20), accent, 0.75);
      break;
    }
    case 'RAIL_CORE': {
      const bodyW = 68 + d * 8;
      g.fillStyle(primary, 0.99).fillRoundedRect(p(-bodyW / 2), p(-27), p(bodyW), p(58), p(10));
      g.fillStyle(secondary, 1).fillCircle(p(-10), 0, p(18 + d * 2));
      g.fillStyle(accent, 0.98).fillCircle(p(-10), 0, p(7 + d));
      const barrel = 80 + d * 20;
      g.lineStyle(p(15 + d * 2), secondary, 1).lineBetween(p(10), p(-4), p(barrel), p(-18));
      g.lineStyle(p(5), accent, 0.95).lineBetween(p(22), p(-4), p(barrel + 18), p(-21));
      for (const y of [-1, 1]) g.lineStyle(p(4), primary, 0.9).lineBetween(p(-25), p(y * 22), p(-48 - d * 5), p(y * 38));
      break;
    }
    case 'DRONE_OPERATOR': {
      humanoid(g, p, primary, secondary, -36);
      const count = 4 + (d === 3 ? 2 : 0);
      const rx = 48 + d * 6;
      const ry = 36 + d * 4;
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count;
        const x = Math.cos(a) * rx;
        const y = -9 + Math.sin(a) * ry;
        g.fillStyle(secondary, 1).fillRoundedRect(p(x - 8), p(y - 5), p(16), p(10), p(3));
        g.lineStyle(p(3), accent, 0.95).lineBetween(p(x - 12), p(y), p(x + 12), p(y));
        g.fillStyle(accent, 1).fillCircle(p(x), p(y), p(3));
      }
      if (d >= 2) g.lineStyle(p(2), accent, 0.5).strokeEllipse(0, p(-9), p(rx * 2), p(ry * 2));
      break;
    }
    case 'BULWARK_ROBOT': {
      const shieldW = 63 + d * 9;
      const shieldH = 91 + d * 7;
      g.fillStyle(primary, 1).fillRoundedRect(p(-32), p(-shieldH / 2 + 5), p(shieldW), p(shieldH), p(8));
      g.lineStyle(p(5), secondary, 1).strokeRoundedRect(p(-32), p(-shieldH / 2 + 5), p(shieldW), p(shieldH), p(8));
      g.fillStyle(accent, 0.9).fillCircle(p(-2), p(-4), p(7 + d));
      g.fillStyle(secondary, 1).fillRect(p(29), p(-18), p(22 + d * 3), p(42));
      if (d === 3) {
        g.fillStyle(secondary, 1).fillCircle(p(-18), p(52), p(12)).fillCircle(p(21), p(52), p(12));
        g.lineStyle(p(4), accent, 0.8).lineBetween(p(-24), p(-36), p(24), p(-36));
      }
      break;
    }
    case 'BLADE_HOUND_PREMIUM': {
      g.fillStyle(primary, 0.99).fillEllipse(p(-7), p(12), p(88 + d * 5), p(38 + d * 3)).fillCircle(p(34), p(2), p(16));
      for (const x of [-29, -7, 15, 31]) g.lineStyle(p(5), secondary, 1).lineBetween(p(x), p(27), p(x - 10), p(47));
      const blades = 2 + d;
      for (let i = 0; i < blades; i += 1) {
        const x = -31 + i * (57 / Math.max(1, blades - 1));
        g.fillStyle(accent, 0.95).fillTriangle(p(x - 7), p(-4), p(x + 3), p(-31 - i * 3), p(x + 10), p(-1));
      }
      g.fillStyle(accent, 1).fillTriangle(p(42), p(-3), p(66 + d * 5), p(3), p(42), p(10));
      if (d === 3) g.lineStyle(p(4), accent, 0.75).lineBetween(p(-48), p(7), p(-74), p(-22));
      break;
    }
    case 'ASTRA_ARRAY': {
      g.fillStyle(secondary, 1).fillCircle(0, p(-2), p(25 + d * 2));
      g.fillStyle(primary, 1).fillCircle(0, p(-2), p(15 + d));
      g.fillStyle(accent, 1).fillCircle(0, p(-2), p(6 + d));
      const count = d === 1 ? 4 : 6;
      const r = 46 + d * 8;
      g.lineStyle(p(2), accent, 0.45).strokeCircle(0, p(-2), p(r));
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count - Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = -2 + Math.sin(a) * r;
        const tangentX = -Math.sin(a) * 15;
        const tangentY = Math.cos(a) * 15;
        g.lineStyle(p(7), accent, 0.96).lineBetween(p(x - tangentX), p(y - tangentY), p(x + tangentX), p(y + tangentY));
      }
      if (d === 3) {
        g.lineStyle(p(8), primary, 0.9).lineBetween(0, p(-r - 29), 0, p(-r + 10));
        g.lineStyle(p(8), primary, 0.9).lineBetween(0, p(r - 6), 0, p(r + 30));
      }
      break;
    }
  }
}

/** Shared presentation-only renderer for S/SS recruitment identity scaffolding. */
export function createPremiumRecruitSilhouetteGraphics(
  scene: Phaser.Scene,
  spec: PremiumRecruitSilhouetteSpec,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(5);
  drawPremiumShape(graphics, spec);
  return graphics;
}
