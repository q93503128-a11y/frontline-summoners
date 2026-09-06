import Phaser from 'phaser';
import type { PlayableBattleState } from '@frontline/sim/playable';
import type { ActiveProgressAuthority } from './active-progress.ts';
import { BASE_WEAPON_UNLOCKS } from './base-weapon-progression.ts';
import type { RecordModeId } from './record-content.ts';
import { getRecordModeDefinition } from './record-content.ts';
import type { PrototypeRosterSlot } from './prototype.ts';
import {
  BATTLE_UNIT_HOTKEY_CODES,
  COLORS,
  addButton,
  addText,
  battleUiFontSize,
  familyForUnit,
  getUnitHotkeyLabel,
  rarityColor,
} from './scene-ui.ts';
import { getCurrentMinimumInternalTouchTarget, isCompactMobileViewport } from './viewport.ts';

interface RecordRuntimeLike {
  readonly mode: 'ENDLESS_FRONT' | 'BOSS_RUSH';
  readonly battle: PlayableBattleState;
}

interface RecordButtonViewLike {
  readonly shade: Phaser.GameObjects.Rectangle;
  readonly cooldown: Phaser.GameObjects.Text;
}

interface RecordHudCarrier extends Phaser.Scene {
  modeId: RecordModeId;
  runtime: RecordRuntimeLike;
  activeSlots: readonly PrototypeRosterSlot[];
  authority: ActiveProgressAuthority;
  buttons: Map<string, RecordButtonViewLike>;
  supplyBar: Phaser.GameObjects.Rectangle;
  supplyText: Phaser.GameObjects.Text;
  supplyLevelText: Phaser.GameObjects.Text;
  supplyUpgradeText: Phaser.GameObjects.Text;
  baseWeaponBg: Phaser.GameObjects.Rectangle;
  baseWeaponText: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  recordText: Phaser.GameObjects.Text;
  drawHud(): void;
  drawUnitButtons(): void;
  syncHud(): void;
  trySpawn(slotId: string): void;
  tryUpgradeSupplyInput(): void;
  tryFireBaseWeaponInput(): void;
  togglePause(): void;
}

const INSTALLED = Symbol('record-command-hud-installed');
const STORY_BADGE_COLOR = '#d7c79f';
const SPECIAL_BADGE_COLOR = '#9fd7d0';

function slotBadge(slot: PrototypeRosterSlot): { readonly label: string; readonly color: string } {
  if (slot.rarity) return { label: slot.rarity, color: rarityColor[slot.rarity] ?? '#ffffff' };
  if (slot.acquisitionClass === 'STORY') return { label: '스토리', color: STORY_BADGE_COLOR };
  if (slot.acquisitionClass === 'SPECIAL') return { label: '특수', color: SPECIAL_BADGE_COLOR };
  return { label: '동료', color: '#ffffff' };
}

function baseWeaponName(state: PlayableBattleState): string {
  const id = state.baseWeapon.id;
  return BASE_WEAPON_UNLOCKS.find((weapon) => weapon.id === id)?.displayName
    ?? (state.baseWeapon.kind === 'AEGIS_EMITTER' ? '결계발진기' : state.baseWeapon.kind === 'SUPPLY_DROP' ? '보급낙하기' : '전선포격기');
}

function authorityLabel(authority: ActiveProgressAuthority): string {
  if (authority === 'ACCOUNT_ONLINE') return '계정 기록 · 동기화';
  if (authority === 'ACCOUNT_OFFLINE_CACHE') return '계정 기록 · 읽기 전용';
  return '게스트 기록 · 로컬';
}

function drawLedgerPlate(
  scene: Phaser.Scene,
  left: number,
  top: number,
  width: number,
  height: number,
  accent: number,
  fill: number,
): void {
  const g = scene.add.graphics();
  const notch = Math.min(16, Math.max(9, height * 0.18));
  g.fillStyle(0x070a0f, 0.34).fillPoints([
    new Phaser.Math.Vector2(left + notch + 3, top + 4),
    new Phaser.Math.Vector2(left + width + 3, top + 4),
    new Phaser.Math.Vector2(left + width - notch + 3, top + height + 4),
    new Phaser.Math.Vector2(left + 3, top + height + 4),
  ], true);
  g.fillStyle(fill, 0.91).fillPoints([
    new Phaser.Math.Vector2(left + notch, top),
    new Phaser.Math.Vector2(left + width, top),
    new Phaser.Math.Vector2(left + width - notch, top + height),
    new Phaser.Math.Vector2(left, top + height),
  ], true);
  g.lineStyle(2, accent, 0.7).lineBetween(left + notch + 3, top + 2, left + width - 4, top + 2);
  g.lineStyle(3, accent, 0.42).lineBetween(left + 4, top + height - 2, left + width - notch - 4, top + height - 2);
}

function installRecordTopRail(scene: RecordHudCarrier): void {
  const compact = isCompactMobileViewport();
  const top = compact ? 8 : 12;
  const height = compact ? 88 : 70;
  const mode = getRecordModeDefinition(scene.modeId);
  const modeAccent = scene.modeId === 'record_endless_front' ? 0x5f8ea4 : 0x9a687d;

  drawLedgerPlate(scene, 18, top, 358, height, modeAccent, scene.modeId === 'record_endless_front' ? 0x132029 : 0x281b24);
  drawLedgerPlate(scene, 392, top + (compact ? 0 : 4), 434, compact ? 88 : 66, 0xb39455, 0x191b1e);
  drawLedgerPlate(scene, 842, top, 420, height, 0xb59858, 0x191a19);

  addText(scene, 34, compact ? 18 : 19, mode.displayName, battleUiFontSize(22, 27), '#ffffff');
  addText(scene, 35, compact ? 55 : 50, `${authorityLabel(scene.authority)} · 혼자 도전 · 1× 고정`, battleUiFontSize(12, 16), COLORS.muted);

  addText(scene, 414, compact ? 15 : 18, '경과 시간', battleUiFontSize(11, 14), COLORS.dim);
  scene.timerText = addText(scene, 414, compact ? 40 : 38, '0:00', battleUiFontSize(21, 26), '#e7edf5');
  addText(scene, 548, compact ? 15 : 18, '현재 기록', battleUiFontSize(11, 14), '#c6ab6d');
  scene.recordText = addText(scene, 548, compact ? 41 : 39, '', battleUiFontSize(16, 20), '#f1d58a');
  addButton(
    scene,
    770,
    compact ? 53 : 49,
    compact ? 104 : 96,
    compact ? 84 : 42,
    compact ? '정지' : '일시정지',
    () => scene.togglePause(),
    0x64768d,
    { tone: 'quiet' },
  ).setDepth(89);

  addText(scene, 860, compact ? 17 : 18, '보급선', battleUiFontSize(14, 18), COLORS.gold);
  scene.supplyText = addText(scene, 1240, compact ? 16 : 17, '', battleUiFontSize(16, 21), '#f5d87f', 'right').setOrigin(1, 0);
  scene.supplyLevelText = addText(scene, 860, compact ? 48 : 45, '', battleUiFontSize(13, 17), '#bcc7d5');
  scene.add.rectangle(1088, compact ? 75 : 65, 304, 14, 0x080c12, 0.92).setStrokeStyle(2, 0x6e6752, 0.8);
  scene.supplyBar = scene.add.rectangle(938, compact ? 75 : 65, 1, 8, 0xe9c965, 1).setOrigin(0, 0.5);
}

function installRecordProductionRail(scene: RecordHudCarrier): void {
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
  const bottomTop = useTwoRows ? Math.max(456, 720 - (slotHeight * 2 + rowGap + 12)) : 604;
  const firstY = bottomTop + 8 + slotHeight / 2;
  const g = scene.add.graphics();

  g.fillStyle(0x0b1017, 0.95).fillRect(0, bottomTop, 1280, 720 - bottomTop);
  g.lineStyle(3, 0x536175, 0.62).lineBetween(0, bottomTop + 2, 1280, bottomTop + 2);
  g.lineStyle(1, 0xb89b5e, 0.32).lineBetween(20, bottomTop + 9, useTwoRows ? 762 : 876, bottomTop + 9);

  slots.forEach((slot, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = 20 + slotWidth / 2 + col * (slotWidth + gap);
    const y = firstY + row * (slotHeight + rowGap);
    const badge = slotBadge(slot);
    const border = Phaser.Display.Color.HexStringToColor(badge.color).color;
    const bg = scene.add.rectangle(x, y, slotWidth, slotHeight, 0x1b2531, 0.98).setStrokeStyle(2, border, 0.8).setInteractive({ useHandCursor: true });
    scene.add.rectangle(x, y - slotHeight / 2 + 3, slotWidth - 10, 4, border, 0.82).setDepth(4);
    const shade = scene.add.rectangle(x, y, slotWidth, slotHeight, 0x05070b, 0).setDepth(7);

    const art = familyForUnit(slot.definition.id);
    const portraitHeight = useTwoRows ? 48 : compact ? 38 : 40;
    const portrait = scene.add.sprite(x, y - slotHeight * 0.2, art.family.idle.key, 0).setTint(art.tint).setDepth(4);
    portrait.setScale((portraitHeight / art.family.idle.frameHeight) * art.displayScale);

    if (!compact || useTwoRows) {
      addText(scene, x - slotWidth / 2 + 7, y - slotHeight / 2 + 7, badge.label, battleUiFontSize(10, 14), badge.color).setDepth(8);
    }
    const displayName = compact && !useTwoRows && slot.displayName.length > 5 ? `${slot.displayName.slice(0, 4)}…` : slot.displayName;
    addText(scene, x, y + slotHeight * 0.04, displayName, useTwoRows ? battleUiFontSize(13, 18) : battleUiFontSize(12, 16), '#ffffff', 'center')
      .setOrigin(0.5, 0)
      .setDepth(5);
    const statusY = y + slotHeight * 0.37;
    addText(scene, x - slotWidth / 2 + 8, statusY, `◆${slot.cost}`, battleUiFontSize(11, 15), '#f0cf78').setOrigin(0, 0.5).setDepth(5);
    const cooldown = addText(scene, x + slotWidth / 2 - 8, statusY, '', battleUiFontSize(11, 15), '#d8e1ef', 'right').setOrigin(1, 0.5).setDepth(8);

    if (!compact) {
      const keyBg = scene.add.rectangle(x + slotWidth / 2 - 13, y - slotHeight / 2 + 13, 20, 20, 0x0d131b, 0.92).setStrokeStyle(1, 0x71849b, 0.75).setDepth(8);
      addText(scene, keyBg.x, keyBg.y - 1, getUnitHotkeyLabel(index), 12, '#c9d5e3', 'center').setOrigin(0.5).setDepth(9);
    }

    bg.on('pointerover', () => bg.setFillStyle(0x263442, 1));
    bg.on('pointerout', () => bg.setFillStyle(0x1b2531, 0.98));
    bg.on('pointerdown', () => bg.setFillStyle(0x303d4a, 1));
    bg.on('pointerup', () => {
      bg.setFillStyle(0x263442, 1);
      scene.trySpawn(slot.slotId);
    });
    bg.on('pointerupoutside', () => bg.setFillStyle(0x1b2531, 0.98));
    scene.buttons.set(slot.slotId, { shade, cooldown });
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

  const weaponName = baseWeaponName(scene.runtime.battle);
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

export function installRecordCommandHud(scene: Phaser.Scene): void {
  const carrier = scene as unknown as RecordHudCarrier & { [INSTALLED]?: boolean };
  if (carrier[INSTALLED]) return;
  if (typeof carrier.drawHud !== 'function' || typeof carrier.drawUnitButtons !== 'function' || typeof carrier.syncHud !== 'function') return;
  carrier[INSTALLED] = true;

  const originalSyncHud = carrier.syncHud.bind(carrier);
  carrier.drawHud = (): void => installRecordTopRail(carrier);
  carrier.drawUnitButtons = (): void => installRecordProductionRail(carrier);
  carrier.syncHud = (): void => {
    originalSyncHud();
    if (carrier.supplyUpgradeText.text === 'MAX') carrier.supplyUpgradeText.setText('최대 단계');
    for (const view of carrier.buttons.values()) {
      const label = view.cooldown.text;
      if (/^\d+(?:\.\d+)?s$/.test(label)) view.cooldown.setText(`${label.slice(0, -1)}초`);
    }
  };
}
