import Phaser from 'phaser';
import type { PvpBattleSnapshot, PvpSession } from './pvp-network.ts';
import { PvpMatchScene as BasePvpMatchScene } from './pvp-scenes.ts';
import { getSlotById } from './prototype.ts';
import {
  COLORS,
  addButton,
  addText,
  battleUiFontSize,
  familyForUnit,
  setButtonState,
} from './scene-ui.ts';
import { getCurrentMinimumInternalTouchTarget, isCompactMobileViewport } from './viewport.ts';

interface PvpMatchPresentationCarrier extends Phaser.Scene {
  snapshot: PvpBattleSnapshot | null;
  session: PvpSession | null;
  battlefield?: Phaser.GameObjects.Container;
  controls?: Phaser.GameObjects.Container;
  finished: boolean;
  renderBattle(): void;
  renderControls(): void;
}

const INSTALLED = Symbol('pvp-command-match-presentation-installed');
const MAP_LENGTH = 3000;
const FIELD_LEFT = 112;
const FIELD_RIGHT = 1168;

function screenX(anchorX: number): number {
  return FIELD_LEFT + Phaser.Math.Clamp(anchorX / MAP_LENGTH, 0, 1) * (FIELD_RIGHT - FIELD_LEFT);
}

function weaponName(id: string | null): string {
  if (id === 'base_weapon_aegis_emitter') return '결계발진기';
  if (id === 'base_weapon_supply_drop') return '보급낙하기';
  if (id === null) return '거점 병기 없음';
  return '전선포격기';
}

function cooldownSeconds(frames: number): number {
  return Math.max(1, Math.ceil(Math.max(0, frames) / 30));
}

function drawBasePost(scene: Phaser.Scene, x: number, own: boolean, leftSide: boolean): Phaser.GameObjects.Container {
  const accent = own ? 0x72b7db : 0xd97973;
  const dark = own ? 0x263b4c : 0x4a2d31;
  const container = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x0b1017, 0.45).fillEllipse(x, 486, 92, 18);
  g.fillStyle(dark, 0.98).fillRect(x - 30, 350, 60, 136);
  g.lineStyle(3, accent, 0.72).strokeRect(x - 30, 350, 60, 136);
  g.fillStyle(accent, 0.85).fillTriangle(
    leftSide ? x - 30 : x + 30,
    350,
    leftSide ? x + 18 : x - 18,
    324,
    leftSide ? x + 18 : x - 18,
    376,
  );
  g.fillStyle(0x111820, 0.96).fillRect(x - 12, 426, 24, 60);
  container.add(g);
  return container;
}

function drawBattlePresentation(scene: PvpMatchPresentationCarrier): void {
  scene.battlefield?.destroy(true);
  scene.battlefield = scene.add.container(0, 0);
  const layer = scene.battlefield;
  const snapshot = scene.snapshot;
  const compact = isCompactMobileViewport();

  if (!snapshot) {
    layer.add(addText(scene, 640, 334, '상대 전선을 불러오는 중…', compact ? 27 : 23, '#b6c0ce', 'center').setOrigin(0.5));
    return;
  }

  const mine = scene.session?.seatId;
  const ownIsA = mine !== 'B';
  const aOwn = mine === 'A';
  const bOwn = mine === 'B';
  const aRatio = Phaser.Math.Clamp(snapshot.bases.aHp / Math.max(1, snapshot.bases.aMaxHp), 0, 1);
  const bRatio = Phaser.Math.Clamp(snapshot.bases.bHp / Math.max(1, snapshot.bases.bMaxHp), 0, 1);

  const board = scene.add.graphics();
  board.fillStyle(0x111820, 0.78).fillRect(36, 112, 1208, 414);
  board.lineStyle(2, 0x58687b, 0.55).strokeRect(36, 112, 1208, 414);
  board.fillStyle(0x182430, 0.78).fillRect(52, 190, 1176, 320);
  board.fillStyle(0x202a25, 0.72).fillRect(52, 392, 1176, 118);
  board.lineStyle(2, 0x8b7654, 0.22).lineBetween(FIELD_LEFT, 484, FIELD_RIGHT, 484);
  for (const fraction of [0.25, 0.5, 0.75]) {
    const x = FIELD_LEFT + (FIELD_RIGHT - FIELD_LEFT) * fraction;
    board.lineStyle(fraction === 0.5 ? 2 : 1, 0xd4c5a5, fraction === 0.5 ? 0.28 : 0.14).lineBetween(x, 406, x, 500);
  }
  layer.add(board);

  const aLabel = aOwn ? '내 거점' : '상대 거점';
  const bLabel = bOwn ? '내 거점' : '상대 거점';
  layer.add(addText(scene, 70, 128, `${aLabel} · ${snapshot.bases.aHp.toLocaleString()} / ${snapshot.bases.aMaxHp.toLocaleString()}`, battleUiFontSize(14, 18), aOwn ? '#bfe6ff' : '#ffc4bd'));
  layer.add(addText(scene, 1210, 128, `${bLabel} · ${snapshot.bases.bHp.toLocaleString()} / ${snapshot.bases.bMaxHp.toLocaleString()}`, battleUiFontSize(14, 18), bOwn ? '#bfe6ff' : '#ffc4bd', 'right').setOrigin(1, 0));
  layer.add(scene.add.rectangle(70, 164, 430, 14, 0x0b1016, 0.92).setOrigin(0, 0.5).setStrokeStyle(1, 0x64788e, 0.75));
  layer.add(scene.add.rectangle(70, 164, Math.max(1, 430 * aRatio), 8, aOwn ? 0x72b7db : 0xd97973, 0.95).setOrigin(0, 0.5));
  layer.add(scene.add.rectangle(780, 164, 430, 14, 0x0b1016, 0.92).setOrigin(0, 0.5).setStrokeStyle(1, 0x64788e, 0.75));
  layer.add(scene.add.rectangle(1210, 164, Math.max(1, 430 * bRatio), 8, bOwn ? 0x72b7db : 0xd97973, 0.95).setOrigin(1, 0.5));

  layer.add(drawBasePost(scene, 90, aOwn, true));
  layer.add(drawBasePost(scene, 1190, bOwn, false));

  const living = snapshot.units.filter((unit) => unit.state !== 'DYING');
  const aFront = Math.max(0, ...living.filter((unit) => unit.sideId === 'A').map((unit) => unit.anchorX));
  const bAnchors = living.filter((unit) => unit.sideId === 'B').map((unit) => unit.anchorX);
  const bFront = bAnchors.length > 0 ? Math.min(...bAnchors) : MAP_LENGTH;
  const contact = Phaser.Math.Clamp((aFront + bFront) / 2, 0, MAP_LENGTH);
  const contactX = screenX(contact);
  board.lineStyle(5, 0x0b1016, 0.55).lineBetween(FIELD_LEFT, 503, FIELD_RIGHT, 503);
  board.lineStyle(3, aOwn ? 0x72b7db : 0xd97973, 0.54).lineBetween(FIELD_LEFT, 503, contactX, 503);
  board.lineStyle(3, bOwn ? 0x72b7db : 0xd97973, 0.54).lineBetween(contactX, 503, FIELD_RIGHT, 503);
  board.fillStyle(0xe5c56b, 0.92).fillTriangle(contactX, 495, contactX - 8, 508, contactX + 8, 508);

  living.forEach((unit) => {
    const x = screenX(unit.anchorX);
    const laneOffset = ((unit.simulationId % 3) - 1) * 11;
    const y = 424 + laneOffset;
    const own = unit.sideId === mine;
    const art = familyForUnit(unit.definitionId);
    const shadow = scene.add.ellipse(x, y + 31, 52 * Math.min(1.4, art.displayScale), 10, 0x070a0e, 0.34).setDepth(2);
    const sprite = scene.add.sprite(x, y, art.family.idle.key, 0).setTint(art.tint).setDepth(3);
    sprite.setFlipX(unit.sideId === 'B');
    const targetHeight = compact ? 62 : 56;
    sprite.setScale((targetHeight / art.family.idle.frameHeight) * art.displayScale);
    const hpRatio = Phaser.Math.Clamp(unit.hp / Math.max(1, unit.maxHp), 0, 1);
    const hpBg = scene.add.rectangle(x, y - 40, 50, 6, 0x11161d, 0.95).setDepth(4);
    const hp = scene.add.rectangle(x - 24, y - 40, Math.max(1, 48 * hpRatio), 4, own ? 0x78dca0 : 0xf1837c, 0.98).setOrigin(0, 0.5).setDepth(5);
    layer.add([shadow, sprite, hpBg, hp]);
  });

  const secondsLeft = Math.max(0, Math.ceil((snapshot.timeLimitFrames - snapshot.tick) / 30));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  layer.add(addText(scene, 640, 181, `${minutes}:${seconds}`, battleUiFontSize(18, 23), secondsLeft <= 60 ? '#ffb58f' : '#e0e7ef', 'center').setOrigin(0.5));
  layer.add(addText(scene, 640, 208, '남은 시간', battleUiFontSize(11, 14), COLORS.dim, 'center').setOrigin(0.5));

  const mySide = snapshot.sides.find((side) => side.sideId === mine);
  const otherSide = snapshot.sides.find((side) => side.sideId !== mine);
  if (mySide) {
    layer.add(addText(scene, 70, 518, `내 보급 ${mySide.supply.toLocaleString()} / ${mySide.maxSupply.toLocaleString()} · 보급소 Lv.${mySide.supplyLevel}`, battleUiFontSize(13, 17), '#f0d67d'));
  }
  if (otherSide) {
    layer.add(addText(scene, 1210, 518, `상대 보급 ${otherSide.supply.toLocaleString()} / ${otherSide.maxSupply.toLocaleString()} · 보급소 Lv.${otherSide.supplyLevel}`, battleUiFontSize(12, 15), '#aeb9c7', 'right').setOrigin(1, 0));
  }
  const pressure = ownIsA ? contact / MAP_LENGTH : 1 - contact / MAP_LENGTH;
  layer.add(addText(scene, 640, 518, pressure >= 0.58 ? '내 전선 우세' : pressure <= 0.42 ? '상대 전선 압박' : '전선 교착', battleUiFontSize(12, 15), pressure >= 0.58 ? '#bfe6ff' : pressure <= 0.42 ? '#ffc1b8' : '#f0d99b', 'center').setOrigin(0.5));
}

function drawControlsPresentation(scene: PvpMatchPresentationCarrier): void {
  scene.controls?.destroy(true);
  scene.controls = scene.add.container(0, 0);
  const layer = scene.controls;
  const snapshot = scene.snapshot;
  const seatId = scene.session?.seatId;
  if (!snapshot || !seatId || scene.finished) return;
  const side = snapshot.sides.find((entry) => entry.sideId === seatId);
  if (!side) return;

  const compact = isCompactMobileViewport();
  const minimumTouch = compact ? getCurrentMinimumInternalTouchTarget() : 0;
  const singleWidth = Math.max(82, minimumTouch);
  const useTwoRows = compact && singleWidth * 10 + 36 > 870;
  const slotIds = Object.keys(side.costs).slice(0, 10);
  const slotWidth = useTwoRows ? 142 : singleWidth;
  const slotHeight = useTwoRows ? Math.max(86, minimumTouch) : compact ? Math.max(94, minimumTouch) : 88;
  const columns = useTwoRows ? 5 : 10;
  const gap = useTwoRows ? 8 : 4;
  const rowGap = useTwoRows ? 7 : 0;
  const bottomTop = useTwoRows ? Math.max(538, 720 - (slotHeight * 2 + rowGap + 8)) : 596;
  const firstY = bottomTop + 7 + slotHeight / 2;

  const panel = scene.add.graphics();
  panel.fillStyle(0x0b1017, 0.96).fillRect(0, bottomTop, 1280, 720 - bottomTop);
  panel.lineStyle(3, 0x536175, 0.62).lineBetween(0, bottomTop + 2, 1280, bottomTop + 2);
  panel.lineStyle(1, 0xb89b5e, 0.3).lineBetween(20, bottomTop + 9, useTwoRows ? 762 : 876, bottomTop + 9);
  layer.add(panel);

  slotIds.forEach((slotId, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = 20 + slotWidth / 2 + col * (slotWidth + gap);
    const y = firstY + row * (slotHeight + rowGap);
    const cooldown = side.cooldowns[slotId] ?? 0;
    const cost = side.costs[slotId] ?? 0;
    const info = getSlotById(slotId);
    const name = info?.displayName ?? '소환 동료';
    const available = cooldown <= 0 && side.supply >= cost;
    const label = cooldown > 0 ? `${name}\n${cooldownSeconds(cooldown)}초` : `${name}\n◆${cost}`;
    const button = addButton(scene, x, y, slotWidth - 2, slotHeight, label, () => {
      if (available) scene.session?.queueCommand({ type: 'SPAWN', slotId });
    }, available ? 0x5f86aa : 0x48515e, { tone: available ? 'primary' : 'quiet' });
    layer.add(button);
    if (!compact) {
      const key = index === 9 ? '0' : String(index + 1);
      layer.add(addText(scene, x + slotWidth / 2 - 14, y - slotHeight / 2 + 7, key, 11, '#c9d5e3', 'right').setOrigin(1, 0).setDepth(20));
    }
    if (cooldown > 0) setButtonState(button, 'disabled', `재사용까지 ${cooldownSeconds(cooldown)}초 남았습니다.`);
    else if (side.supply < cost) setButtonState(button, 'disabled', `보급이 ${(cost - side.supply).toLocaleString()} 부족합니다.`);
  });

  const commandY = useTwoRows ? (bottomTop + 720) / 2 : 652;
  const commandHeight = useTwoRows ? Math.max(116, minimumTouch) : compact ? Math.max(94, minimumTouch) : 88;
  const supplyX = useTwoRows ? 890 : 963;
  const supplyWidth = useTwoRows ? 214 : 160;
  const weaponX = useTwoRows ? 1142 : 1155;
  const weaponWidth = useTwoRows ? 260 : 204;

  const canUpgrade = side.nextSupplyUpgradeCost !== null && side.supply >= side.nextSupplyUpgradeCost;
  const upgradeLabel = side.nextSupplyUpgradeCost === null ? '보급소\n최대 단계' : `보급소 강화\n◆${side.nextSupplyUpgradeCost}`;
  const upgrade = addButton(scene, supplyX, commandY, supplyWidth, commandHeight, upgradeLabel, () => {
    if (canUpgrade) scene.session?.queueCommand({ type: 'UPGRADE_SUPPLY' });
  }, canUpgrade ? 0x8b773f : 0x4f5050, { tone: canUpgrade ? 'primary' : 'quiet' });
  layer.add(upgrade);
  if (side.nextSupplyUpgradeCost === null) setButtonState(upgrade, 'disabled', '보급소가 최대 단계입니다.');
  else if (side.supply < side.nextSupplyUpgradeCost) setButtonState(upgrade, 'disabled', `보급이 ${(side.nextSupplyUpgradeCost - side.supply).toLocaleString()} 부족합니다.`);

  const weapon = weaponName(side.baseWeaponId);
  const weaponReady = side.baseWeaponId !== null && side.baseWeaponCooldownFrames === 0;
  const weaponLabel = side.baseWeaponId === null
    ? '거점 병기\n장착 없음'
    : side.baseWeaponCooldownFrames > 0
      ? `${weapon}\n${cooldownSeconds(side.baseWeaponCooldownFrames)}초`
      : `${weapon}\n사용 가능`;
  const weaponButton = addButton(scene, weaponX, commandY, weaponWidth, commandHeight, weaponLabel, () => {
    if (weaponReady) scene.session?.queueCommand({ type: 'FIRE_BASE_WEAPON' });
  }, weaponReady ? 0x587f98 : 0x4d535d, { tone: weaponReady ? 'primary' : 'quiet' });
  layer.add(weaponButton);
  if (side.baseWeaponId === null) setButtonState(weaponButton, 'disabled', '장착된 거점 병기가 없습니다.');
  else if (side.baseWeaponCooldownFrames > 0) setButtonState(weaponButton, 'disabled', `재사용까지 ${cooldownSeconds(side.baseWeaponCooldownFrames)}초 남았습니다.`);
}

function installPvpCommandMatchPresentation(scene: Phaser.Scene): void {
  const carrier = scene as unknown as PvpMatchPresentationCarrier & { [INSTALLED]?: boolean };
  if (carrier[INSTALLED]) return;
  if (typeof carrier.renderBattle !== 'function' || typeof carrier.renderControls !== 'function') return;
  carrier[INSTALLED] = true;
  carrier.renderBattle = (): void => drawBattlePresentation(carrier);
  carrier.renderControls = (): void => drawControlsPresentation(carrier);
}

/** Network/session authority remains owned by the original PvP scene; only rendering is replaced. */
export class PvpMatchScene extends BasePvpMatchScene {
  override create(): void {
    installPvpCommandMatchPresentation(this);
    super.create();
  }
}
