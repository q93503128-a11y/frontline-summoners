import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import type { BattlefieldThemeId, PrototypeStage } from './prototype';

interface ThemeStyle {
  readonly label: string;
  readonly sky: number;
  readonly skyBand: number;
  readonly sun: number;
  readonly far: number;
  readonly mid: number;
  readonly field: number;
  readonly verge: number;
  readonly soil: number;
  readonly accent: number;
  readonly playerBase: number;
  readonly playerRoof: number;
  readonly enemyBase: number;
  readonly enemyRoof: number;
}

const THEMES: Readonly<Record<BattlefieldThemeId, ThemeStyle>> = {
  meadow: { label: '풀바람 평원', sky: 0xb7dce5, skyBand: 0xd8edf0, sun: 0xf2dfa0, far: 0x8eabb0, mid: 0x769282, field: 0x7da663, verge: 0x5d774f, soil: 0x443a31, accent: 0xcee39e, playerBase: 0x627fa0, playerRoof: 0x7894b5, enemyBase: 0x9b625d, enemyRoof: 0xb4776c },
  canyon: { label: '붉은 협곡', sky: 0xd8b997, skyBand: 0xefcfaa, sun: 0xf5e0a2, far: 0xad755b, mid: 0x845746, field: 0x9b7650, verge: 0x74523d, soil: 0x49362d, accent: 0xd7a06b, playerBase: 0x667f93, playerRoof: 0x7f9caf, enemyBase: 0x9e594d, enemyRoof: 0xc16d5d },
  burning: { label: '불붙은 곡창지대', sky: 0xb9876f, skyBand: 0xd5a17e, sun: 0xffc66f, far: 0x806050, mid: 0x68493e, field: 0x7a6a45, verge: 0x534b37, soil: 0x3a302b, accent: 0xe87549, playerBase: 0x5c728c, playerRoof: 0x7189a5, enemyBase: 0x8f4d43, enemyRoof: 0xb45d4e },
  ruins: { label: '안개 폐허', sky: 0x9faeb4, skyBand: 0xc5ced0, sun: 0xd8d9c8, far: 0x777f83, mid: 0x62696a, field: 0x6f7966, verge: 0x525b50, soil: 0x3b3a37, accent: 0xb8beb2, playerBase: 0x5a7086, playerRoof: 0x71869b, enemyBase: 0x7e5657, enemyRoof: 0x9c6967 },
  moon: { label: '달그늘 고개', sky: 0x263553, skyBand: 0x33466a, sun: 0xe6e5c6, far: 0x36445b, mid: 0x2f3a4b, field: 0x4f6855, verge: 0x394c3f, soil: 0x292d2d, accent: 0x91a7d2, playerBase: 0x506b89, playerRoof: 0x6382a3, enemyBase: 0x754b58, enemyRoof: 0x915a69 },
  fortress: { label: '철문 요새권', sky: 0x8799a8, skyBand: 0xaab6bf, sun: 0xd9d4b4, far: 0x59636a, mid: 0x454e55, field: 0x66705d, verge: 0x485146, soil: 0x333536, accent: 0xaeb8bb, playerBase: 0x526f91, playerRoof: 0x6989aa, enemyBase: 0x734b4a, enemyRoof: 0x965e58 },
  golden: { label: '황금가면 관문', sky: 0xd5b58e, skyBand: 0xf0d2a2, sun: 0xffe19a, far: 0x96705c, mid: 0x6f594e, field: 0x777149, verge: 0x575139, soil: 0x39332d, accent: 0xe6b756, playerBase: 0x58789c, playerRoof: 0x7596b8, enemyBase: 0x8c5e3e, enemyRoof: 0xc18c4c },
};

export const BATTLEFIELD_THEME_LABELS: Readonly<Record<BattlefieldThemeId, string>> = Object.fromEntries(
  Object.entries(THEMES).map(([id, theme]) => [id, theme.label]),
) as Readonly<Record<BattlefieldThemeId, string>>;

function seeded(seed: number, index: number): number {
  const value = Math.sin((seed + 1) * 19.137 + index * 73.317) * 43758.5453;
  return value - Math.floor(value);
}

function xAt(seed: number, index: number, min = 150, max = 1130): number {
  return min + seeded(seed, index) * (max - min);
}

export function getBattlefieldBasePalette(stage: PrototypeStage): { player: number; playerRoof: number; enemy: number; enemyRoof: number } {
  const theme = THEMES[stage.theme];
  return { player: theme.playerBase, playerRoof: theme.playerRoof, enemy: theme.enemyBase, enemyRoof: theme.enemyRoof };
}

export function drawBattlefield(scene: Phaser.Scene, stage: PrototypeStage): void {
  const theme = THEMES[stage.theme];
  const seed = stage.decorSeed;
  scene.cameras.main.setBackgroundColor(theme.sky);
  const g = scene.add.graphics();

  g.fillStyle(theme.sky).fillRect(0, 0, INTERNAL_WIDTH, 440);
  g.fillStyle(theme.skyBand, 0.72).fillRect(0, 270, INTERNAL_WIDTH, 170);

  if (stage.theme === 'moon') {
    g.fillStyle(theme.sun, 0.95).fillCircle(1030, 102, 52);
    for (let i = 0; i < 22; i += 1) {
      g.fillStyle(0xe9edf7, 0.55 + seeded(seed, i) * 0.35).fillCircle(xAt(seed, i, 70, 1220), 35 + seeded(seed + 4, i) * 205, 1 + Math.floor(seeded(seed + 7, i) * 2));
    }
  } else {
    g.fillStyle(theme.sun, 0.68).fillCircle(1035, 102, stage.theme === 'burning' ? 68 : 50);
  }

  if (stage.theme === 'meadow') {
    g.fillStyle(theme.far).fillTriangle(0, 445, 270, 245, 530, 445);
    g.fillStyle(theme.far).fillTriangle(350, 445, 690, 220, 1010, 445);
    g.fillStyle(theme.mid).fillTriangle(730, 445, 1030, 275, 1280, 445);
    for (let i = 0; i < 7; i += 1) {
      const x = xAt(seed, i, 90, 1170);
      const y = 120 + seeded(seed + 2, i) * 125;
      g.fillStyle(0xf0f4ee, 0.55).fillCircle(x, y, 20).fillCircle(x + 22, y + 5, 26).fillCircle(x + 46, y, 18);
    }
  } else if (stage.theme === 'canyon') {
    for (let i = 0; i < 5; i += 1) {
      const x = xAt(seed, i, 20, 1100);
      const width = 120 + seeded(seed + 3, i) * 150;
      const top = 265 + seeded(seed + 5, i) * 65;
      g.fillStyle(i % 2 === 0 ? theme.far : theme.mid).fillRect(x, top, width, 445 - top);
      g.fillTriangle(x - 32, top, x + width / 2, top - 55, x + width + 28, top);
    }
  } else if (stage.theme === 'burning') {
    g.fillStyle(theme.far).fillTriangle(0, 445, 260, 285, 520, 445);
    g.fillStyle(theme.mid).fillTriangle(420, 445, 790, 250, 1100, 445);
    for (let i = 0; i < 9; i += 1) {
      const x = xAt(seed, i);
      const height = 42 + seeded(seed + 5, i) * 74;
      g.lineStyle(7, 0x40342d, 1).lineBetween(x, 438, x + (seeded(seed + 8, i) - 0.5) * 20, 438 - height);
      if (i % 3 === 0) g.fillStyle(theme.accent, 0.78).fillTriangle(x - 12, 434, x + 4, 395, x + 18, 434);
    }
    for (let i = 0; i < 5; i += 1) g.fillStyle(0x4a4544, 0.22).fillCircle(xAt(seed + 20, i), 185 + seeded(seed, i) * 95, 34 + seeded(seed + 1, i) * 35);
  } else if (stage.theme === 'ruins') {
    g.fillStyle(theme.far).fillTriangle(0, 445, 330, 260, 660, 445);
    g.fillStyle(theme.mid).fillTriangle(590, 445, 940, 285, 1280, 445);
    for (let i = 0; i < 7; i += 1) {
      const x = xAt(seed, i);
      const h = 55 + seeded(seed + 1, i) * 95;
      g.fillStyle(0x5a5d5b, 0.9).fillRect(x, 438 - h, 18 + seeded(seed + 3, i) * 22, h);
      g.fillStyle(0x777b77, 0.9).fillRect(x - 7, 438 - h, 34 + seeded(seed + 3, i) * 22, 9);
    }
    g.fillStyle(0xd9e1df, 0.12).fillRect(0, 300, INTERNAL_WIDTH, 80);
  } else if (stage.theme === 'fortress') {
    g.fillStyle(theme.far).fillRect(0, 305, INTERNAL_WIDTH, 140);
    for (let x = 30; x < INTERNAL_WIDTH; x += 120) {
      g.fillStyle(theme.mid).fillRect(x, 260, 86, 185);
      g.fillStyle(theme.mid).fillRect(x - 10, 246, 24, 28).fillRect(x + 62, 246, 24, 28);
    }
    g.fillStyle(0x343c43, 0.85).fillRect(0, 385, INTERNAL_WIDTH, 60);
  } else if (stage.theme === 'golden') {
    g.fillStyle(theme.far).fillTriangle(0, 445, 300, 270, 600, 445);
    g.fillStyle(theme.mid).fillTriangle(530, 445, 900, 220, 1280, 445);
    for (let i = 0; i < 6; i += 1) {
      const x = 160 + i * 190 + (seeded(seed, i) - 0.5) * 40;
      g.fillStyle(0x54483e).fillRect(x, 285, 9, 155);
      g.fillStyle(theme.accent, 0.88).fillTriangle(x + 9, 300, x + 62, 318, x + 9, 338);
    }
  } else {
    g.fillStyle(theme.far).fillTriangle(0, 445, 280, 250, 550, 445);
    g.fillStyle(theme.mid).fillTriangle(420, 445, 760, 230, 1080, 445);
    g.fillStyle(theme.mid).fillTriangle(880, 445, 1100, 310, 1280, 445);
  }

  g.fillStyle(theme.field).fillRect(0, 430, INTERNAL_WIDTH, 88);
  g.fillStyle(theme.verge).fillRect(0, 512, INTERNAL_WIDTH, 22);
  g.fillStyle(theme.soil).fillRect(0, 534, INTERNAL_WIDTH, INTERNAL_HEIGHT - 534);
  g.fillStyle(0x1e2226, 0.16).fillRect(0, 548, INTERNAL_WIDTH, 6);

  for (let i = 0; i < 14; i += 1) {
    const x = xAt(seed + 30, i, 155, 1125);
    const width = 7 + seeded(seed + 12, i) * 10;
    const height = 5 + seeded(seed + 15, i) * 10;
    g.fillStyle(i % 4 === 0 ? theme.accent : theme.verge, 0.65).fillTriangle(x, 512, x + width / 2, 512 - height, x + width, 512);
  }
}
