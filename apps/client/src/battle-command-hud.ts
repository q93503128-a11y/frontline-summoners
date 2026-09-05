import Phaser from 'phaser';
import type { PlayableBattleState } from '@frontline/sim/playable';
import { BASE_WEAPON_UNLOCKS } from './base-weapon-progression';
import { BATTLEFIELD_THEME_LABELS } from './battlefield';
import type { PrototypeRosterSlot, PrototypeStage } from './prototype';
import {
  BATTLE_UNIT_HOTKEY_CODES,
  COLORS,
  addButton,
  addText,
  battleUiFontSize,
  familyForUnit,
  getUnitHotkeyLabel,
  rarityColor,
} from './scene-ui';
import { getCurrentMinimumInternalTouchTarget, isCompactMobileViewport } from './viewport';

interface UnitButtonViewLike {
  readonly bg: Phaser.GameObjects.Rectangle;
  readonly shade: Phaser.GameObjects.Rectangle;
  readonly cooldown: Phaser.GameObjects.Text;
  readonly cost: Phaser.GameObjects.Text;
}

interface BattleHudCarrier extends Phaser.Scene {
  state: PlayableBattleState;
  stage: PrototypeStage;
  activeSlots: readonly PrototypeRosterSlot[];
  buttons: Map<string, UnitButtonViewLike>;
  supplyText: Phaser.GameObjects.Text;
  supplyBar: Phaser.GameObjects.Rectangle;
  supplyLevelText: Phaser.GameObjects.Text;
  supplyUpgradeText: Phaser.GameObjects.Text;
  baseWeaponText: Phaser.GameObjects.Text;
  baseWeaponBg: Phaser.GameObjects.Rectangle;
  timerText: Phaser.GameObjects.Text;
  drawHud(): void;
  drawUnitButtons(): void;
  trySpawnSlot(slotId: string): void;
  tryUpgradeSupplyInput(): void;
  tryFireBaseWeaponInput(): void;
  toggleManualPause(): void;
}

const INSTALLED = Symbol('frontline-command-hud-installed');
const STORY_BADGE_COLOR = '#d7c79f';
const SPECIAL_BADGE_COLOR = '#9fd7d0';

function getSlotBadge(slot: PrototypeRosterSlot): { readonly label: string; readonly color: string } {
  if (slot.rarity) return { label: slot.rarity, color: rarityColor[slot.rarity] ?? '#ffffff' };
  if (slot.acquisitionClass === 'STORY') return { label: '스토리', color: STORY_BADGE_COLOR };
  if (slot.acquisitionClass === 'SPECIAL') return { label: '특수', color: SPECIAL_BADGE_COLOR };
  return { label: '동료', color: '#ffffff' };
}

function getBaseWeaponDisplayName(state: PlayableBattleState): string {
  const id = state.baseWeapon.id;
  return BASE_WEAPON_UNLOCKS.find((weapon) => weapon.id === id)?.displayName
    ?? (state.baseWeapon.kind === 'AEGIS_EMITTER' ? '결계발진기' : state.baseWeapon.kind === 'SUPPLY_DROP' ? '보급낙하기' : '전선포격기');
}

function drawRailPlate(
  scene: Phaser.Scene,
  left: number,
  top: number,
  width: number,
  height: number,
  accent: number,
  fill = 0x121922,
  alpha = 0.9,
): void {
  const g = scene.add.graphics();
  const notch = Math.min(16, Math.max(9, height * 0.18));
  g.fillStyle(0x070a0f, 0.34);
  g.fillPoints([
    new Phaser.Math.Vector2(left + notch + 3, top + 4),
    new Phaser.Math.Vector2(left + width + 3, top + 4),
    new Phaser.Math.Vector2(left + width - notch + 3, top + height + 4),
    new Phaser.Math.Vector2(left + 3, top + height + 4),
  ], true);
  g.fillStyle(fill, alpha);
  g.fillPoints([
    new Phaser.Math.Vector2(left + notch, top),
    new Phaser.Math.Vector2(left + width, top),
    new Phaser.Math.Vector2(left + width - notch, top + height),
    new Phaser.Math.Vector2(left, top + height),
  ], true);
  g.lineStyle(2, accent, 0.68);
  g.lineBetween(left + notch + 3, top + 2, left + width - 4, top + 2);
  g.lineStyle(3, accent, 0.45);
  g.lineBetween(left + 4, top + height - 2, left + width - notch - 4, top + height - 2);
}

function installTopCommandRail(scene: BattleHudCarrier): void {
  const compact = isCompactMobileViewport();
  const top = compact ? 8 : 12;
  const height = compact ? 88 : 70;

  drawRailPlate(scene, 18, top, 404, height, 0x71839a, 0x111923, 0.88);
  drawRailPlate(scene, 438, top + (compact ? 0 : 4), 388, compact ? 88 : 66, 0x657992, 0x111822, 0.84);
  drawRailPlate(scene, 842, top, 420, height, 0xb59858, 0x191a19, 0.9);

  addText(scene, 34, compact ? 18 : 19, scene.stage.name, battleUiFontSize(22, 27), '#ffffff');
  addText(
    scene,
    35,
    compact ? 55 : 50,
    `${scene.stage.chapter} · ${BATTLEFIELD_THEME_LABELS[scene.stage.theme]} · ${scene.stage.mapLength}m`,
    battleUiFontSize(13, 18),
    COLORS.muted,
  );

  addText(scene, 603, compact ? 15 : 18, '전투 시간', battleUiFontSize(12, 16), COLORS.dim, 'center').setOrigin(0.5, 0);
  scene.timerText = addText(scene, 640, compact ? 40 : 37, '0:00', battleUiFontSize(22, 28), '#e7edf5', 'center').setOrigin(0.5, 0);
  addButton(
    scene,
    758,
    compact ? 53 : 49,
    compact ? 116 : 108,
    compact ? 84 : 42,
    compact ? '정지' : '일시정지',
    () => scene.toggleManualPause(),
    0x64768d,
    { tone: 'quiet' },
  ).setDepth(89);

  addText(scene, 860, compact ? 17 : 18, '보급선', battleUiFontSize(14, 18), COLORS.gold);
  scene.supplyText = addText(scene, 1240, compact ? 16 : 17, '', battleUiFontSize(16, 21), '#f5d87f', 'right').setOrigin(1, 0);
  scene.supplyLevelText = addText(scene, 860, compact ? 48 : 45, '', battleUiFontSize(13, 17), '#bcc7d5');
  scene.add.rectangle(1088, compact ? 75 : 65, 304, 14, 0x080c12, 0.92).setStrokeStyle(2, 0x6e6752, 0.8);
  scene.supplyBar = scene.add.rectangle(938, compact ? 75 : 65, 1, 8, 0xe9c965, 1).setOrigin(0, 0.5);
}

function installProductionRail(scene: BattleHudCarrier): void {
  const compact = isCompactMobileViewport();
  const minimumTouch = compact ? getCurrentMinimumInternalTouchTarget() : 0;
  const singleRowSlotWidth = Math.max(82, minimumTouch);
  const useTwoRows = compact && singleRowSlotWidth * 10 + 36 > 870;
  const slots = scene.activeSlots.slice(0, BATTLE_UNIT_HOTKEY_CODES.length);
  const slotWidth = useTwoRows ? 142 : singleRowSlotWidth;
  const slotHeight = useTwoRows ? Math.max(92, minimumTouch) : compact ? Math.max(96, minimumTouch) : 96;
  const gap = useTwoRows ? 8 : 4;
  const columns = useTwoRows ? 5 : 10;
  const rowGap = useTwoRows ? 8 : 0;
  const bottomTop = useTwoRows
    ? Math.max(456, 720 - (slotHeight * 2 + rowGap + 12))
    : 604;
  const firstY = bottomTop + 8 + slotHeight / 2;
  const g = scene.add.graphics();

  g.fillStyle(0x0b1017, 0.94).fillRect(0, bottomTop, 1280, 720 - bottomTop);
  g.lineStyle(3, 0x46566a, 0.6).lineBetween(0, bottomTop + 2, 1280, bottomTop + 2);
  g.lineStyle(1, 0xb89b5e, 0.32).lineBetween(20, bottomTop + 9, useTwoRows ? 762 : 876, bottomTop + 9);

  slots.forEach((slot, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = 20 + slotWidth / 2 + col * (slotWidth + gap);
    const y = firstY + row * (slotHeight + rowGap);
    const badge = getSlotBadge(slot);
    const border = Phaser.Display.Color.HexStringToColor(badge.color).color;
    const bg = scene.add.rectangle(x, y, slotWidth, slotHeight, 0x1b2531, 0.98).setStrokeStyle(2, border, 0.8);
    bg.setInteractive({ useHandCursor: true });
    const topRail = scene.add.rectangle(x, y - slotHeight / 2 + 3, slotWidth - 10, 4, border, 0.82).setDepth(4);
    const shade = scene.add.rectangle(x, y, slotWidth, slotHeight, 0x05070b, 0).setDepth(7);

    const art = familyForUnit(slot.definition.id);
    const portraitHeight = useTwoRows ? 48 : compact ? 45 : 40;
    const portrait = scene.add.sprite(x, y - slotHeight * 0.19, art.family.idle.key, 0).setTint(art.tint).setDepth(4);
    portrait.setScale((portraitHeight / art.family.idle.frameHeight) * art.displayScale);

    addText(scene, x - slotWidth / 2 + 7, y - slotHeight / 2 + 7, badge.label, battleUiFontSize(10, 14), badge.color)
      .setDepth(8);
    const nameSize = useTwoRows ? battleUiFontSize(13, 18) : battleUiFontSize(12, 16);
    addText(scene, x, y + slotHeight * 0.08, slot.displayName, nameSize, '#ffffff', 'center')
      .setOrigin(0.5, 0)
      .setDepth(5);
    const cost = addText(scene, x, y + slotHeight * 0.27, `보급 ${slot.cost}`, battleUiFontSize(11, 15), '#f0cf78', 'center')
      .setOrigin(0.5)
      .setDepth(5);
    const cooldown = addText(scene, x, y + slotHeight * 0.41, '', battleUiFontSize(11, 15), '#d8e1ef', 'center')
      .setOrigin(0.5)
      .setDepth(8);

    if (!compact) {
      const hotkey = getUnitHotkeyLabel(index);
      const keyBg = scene.add.rectangle(x + slotWidth / 2 - 13, y - slotHeight / 2 + 13, 20, 20, 0x0d131b, 0.92).setStrokeStyle(1, 0x71849b, 0.75).setDepth(8);
      const keyText = addText(scene, keyBg.x, keyBg.y - 1, hotkey, 12, '#c9d5e3', 'center').setOrigin(0.5).setDepth(9);
      keyBg.setAlpha(0.96);
      keyText.setAlpha(0.96);
    }

    bg.on('pointerover', () => bg.setFillStyle(0x263442, 1));
    bg.on('pointerout', () => bg.setFillStyle(0x1b2531, 0.98));
    bg.on('pointerdown', () => bg.setFillStyle(0x303d4a, 1));
    bg.on('pointerup', () => {
      bg.setFillStyle(0x263442, 1);
      scene.trySpawnSlot(slot.slotId);
    });
    bg.on('pointerupoutside', () => bg.setFillStyle(0x1b2531, 0.98));

    topRail.setAlpha(0.86);
    scene.buttons.set(slot.slotId, { bg, shade, cooldown, cost });
  });

  const commandY = useTwoRows ? (bottomTop + 720) / 2 : 659;
  const commandHeight = useTwoRows ? Math.min(190, Math.max(128, minimumTouch)) : compact ? Math.max(96, minimumTouch) : 96;
  const supplyX = useTwoRows ? 890 : 961;
  const supplyWidth = useTwoRows ? 214 : 158;
  const weaponX = useTwoRows ? 1142 : 1154;
  const weaponWidth = useTwoRows ? 260 : 204;

  const upgradeBg = scene.add.rectangle(supplyX, commandY, supplyWidth, commandHeight, 0x2a2518, 0.98)
    .setStrokeStyle(3, 0xc5a04c, 0.9)
    .setInteractive({ useHandCursor: true });
  addText(scene, supplyX, commandY - 27, compact ? '보급소' : 'Q · 보급소', battleUiFontSize(13, 17), '#ffffff', 'center').setOrigin(0.5);
  scene.supplyUpgradeText = addText(scene, supplyX, commandY + 3, '', battleUiFontSize(15, 19), '#ffe29a', 'center').setOrigin(0.5);
  addText(scene, supplyX, commandY + 30, '강화', battleUiFontSize(12, 16), '#cbb989', 'center').setOrigin(0.5);
  upgradeBg.on('pointerover', () => upgradeBg.setFillStyle(0x342e1d, 1));
  upgradeBg.on('pointerout', () => upgradeBg.setFillStyle(0x2a2518, 0.98));
  upgradeBg.on('pointerdown', () => upgradeBg.setFillStyle(0x40361f, 1));
  upgradeBg.on('pointerup', () => { upgradeBg.setFillStyle(0x342e1d, 1); scene.tryUpgradeSupplyInput(); });
  upgradeBg.on('pointerupoutside', () => upgradeBg.setFillStyle(0x2a2518, 0.98));

  const weaponName = getBaseWeaponDisplayName(scene.state);
  scene.baseWeaponBg = scene.add.rectangle(weaponX, commandY, weaponWidth, commandHeight, 0x26394a, 0.98)
    .setStrokeStyle(3, 0x72b7db, 0.92)
    .setInteractive({ useHandCursor: true });
  scene.baseWeaponText = addText(
    scene,
    weaponX,
    commandY,
    compact ? `${weaponName} · 사용 가능` : `E · ${weaponName} · 사용 가능`,
    battleUiFontSize(14, 18),
    '#bfe8ff',
    'center',
  ).setOrigin(0.5).setWordWrapWidth(weaponWidth - 18);
  scene.baseWeaponBg.on('pointerdown', () => scene.tryFireBaseWeaponInput());
}

/**
 * Presentation-only replacement for BattleScene's opaque prototype HUD. Authoritative simulation,
 * trusted command logging, hotkeys, cooldown calculations, and syncHud remain owned by BattleScene.
 */
export function installBattleCommandHud(scene: Phaser.Scene): void {
  const carrier = scene as unknown as BattleHudCarrier & { [INSTALLED]?: boolean };
  if (carrier[INSTALLED]) return;
  if (typeof carrier.drawHud !== 'function' || typeof carrier.drawUnitButtons !== 'function') {
    throw new Error('frontline command HUD requires BattleScene HUD methods');
  }
  carrier[INSTALLED] = true;
  carrier.drawHud = (): void => installTopCommandRail(carrier);
  carrier.drawUnitButtons = (): void => installProductionRail(carrier);
}
