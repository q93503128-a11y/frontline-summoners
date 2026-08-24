import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART, type ArtFamily, type AttackFxStyle } from './assets';
import { isCompactMobileViewport } from './viewport';

export const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
export const COLORS = {
  ink: 0x14171f,
  panel: 0x242936,
  panel2: 0x303746,
  line: 0x657086,
  cream: '#fff4cf',
  gold: '#f5cf68',
  blue: '#7ec8ff',
  green: '#8ee3aa',
  red: '#ff8d86',
  muted: '#b8c0ce',
} as const;

export const rarityColor: Readonly<Record<string, string>> = {
  C: '#b9c2cf', B: '#8bd6a3', A: '#79baff', S: '#d79aff', SS: '#ffd56f',
};

export const BATTLE_UNIT_HOTKEY_CODES: readonly string[] = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
];

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 28,
  color = '#ffffff',
  align: 'left' | 'center' | 'right' = 'left',
): Phaser.GameObjects.Text {
  const renderedSize = isCompactMobileViewport() ? Math.max(size, 16) : size;
  return scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${renderedSize}px`,
    color,
    align,
    stroke: '#11151d',
    strokeThickness: renderedSize >= 30 ? 4 : 0,
  });
}

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  accent = 0x59677f,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, height, 0x252b38, 0.98).setStrokeStyle(3, accent, 1);
  const shine = scene.add.rectangle(0, -height / 2 + 4, width - 8, 5, accent, 0.45);
  const text = addText(scene, 0, 0, label, Math.max(18, Math.floor(height * 0.3)), '#ffffff', 'center').setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, shine, text]);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => bg.setFillStyle(0x343c4d, 1));
  bg.on('pointerout', () => {
    bg.setFillStyle(0x252b38, 0.98);
    container.setScale(1);
  });
  bg.on('pointerdown', () => container.setScale(0.98));
  bg.on('pointerupoutside', () => container.setScale(1));
  bg.on('pointerup', () => { container.setScale(1); onClick(); });
  return container;
}

export function drawBackdrop(scene: Phaser.Scene, variant: 'menu' | 'map' = 'menu'): void {
  scene.cameras.main.setBackgroundColor('#171c27');
  const g = scene.add.graphics();
  g.fillStyle(0x171c27).fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
  g.fillStyle(variant === 'map' ? 0x26344a : 0x20283a, 1).fillCircle(1080, 130, 240);
  g.fillStyle(0x263247, 1).fillTriangle(0, 570, 330, 250, 630, 570);
  g.fillStyle(0x222d40, 1).fillTriangle(430, 570, 760, 200, 1080, 570);
  g.fillStyle(0x1f2939, 1).fillTriangle(870, 570, 1110, 300, 1280, 570);
  g.fillStyle(0x111722).fillRect(0, 570, INTERNAL_WIDTH, 150);
  if (variant === 'map') {
    g.lineStyle(5, 0x53627a, 0.5);
    for (let i = 0; i < 9; i += 1) {
      const x = 100 + i * 145;
      g.lineBetween(x, 485 - (i % 3) * 24, x + 80, 450 - ((i + 1) % 3) * 24);
      g.fillStyle(i % 2 === 0 ? 0x788aa5 : 0x64758f, 0.6).fillCircle(x, 485 - (i % 3) * 24, 7);
    }
  }
}

export function familyForUnit(unitId: string): { family: ArtFamily; tint: number; displayScale: number; attackFx: AttackFxStyle } {
  const variant = UNIT_ART[unitId] ?? { familyId: 'warrior', tint: 0xffffff, attackFx: 'SLASH' as const };
  const family = ART_BY_ID[variant.familyId] ?? ART_FAMILIES[0]!;
  return { family, tint: variant.tint, displayScale: variant.displayScale ?? 1, attackFx: variant.attackFx };
}

export function battleUiFontSize(regular: number, compact: number): number {
  return isCompactMobileViewport() ? compact : regular;
}

export function getUnitHotkeyLabel(index: number): string {
  return index === 9 ? '0' : String(index + 1);
}
