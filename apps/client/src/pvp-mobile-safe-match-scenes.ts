import Phaser from 'phaser';
import { PvpMatchScene as BasePvpMatchScene } from './pvp-command-match-scene.ts';
import { FriendlyPvpMatchScene as BaseFriendlyPvpMatchScene } from './pvp-friendly-command-scenes.ts';
import type { PvpBattleSnapshot, PvpSession } from './pvp-network.ts';
import { computePvpCompactCommandLayout } from './pvp-compact-command-layout.ts';
import { getSlotById } from './prototype.ts';
import { addButton, setButtonState } from './scene-ui.ts';
import { getCurrentMinimumInternalTouchTarget, isCompactMobileViewport } from './viewport.ts';

interface DuelCommandCarrier extends Phaser.Scene {
  session: PvpSession | null;
  snapshot: PvpBattleSnapshot | null;
  controls?: Phaser.GameObjects.Container;
  finished: boolean;
  renderControls(): void;
}

const PAGE = Symbol('pvp-compact-command-page');

type PagedCarrier = DuelCommandCarrier & { [PAGE]?: number };

function cooldownSeconds(frames: number): number {
  return Math.max(1, Math.ceil(Math.max(0, frames) / 30));
}

function weaponName(id: string | null): string {
  if (id === 'base_weapon_aegis_emitter') return '결계발진기';
  if (id === 'base_weapon_supply_drop') return '보급낙하기';
  if (id === null) return '거점 병기 없음';
  return '전선포격기';
}

function fitCompactButtonLabel(button: Phaser.GameObjects.Container, width: number, height: number): void {
  const label = button.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
  if (!label) return;
  const parsed = Number.parseFloat(String(label.style.fontSize));
  let fontSize = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 16;
  const minFontSize = 13;
  const maxWidth = Math.max(48, width - 20);
  const maxHeight = Math.max(30, height - 16);
  while ((label.width > maxWidth || label.height > maxHeight) && fontSize > minFontSize) {
    fontSize -= 1;
    label.setFontSize(fontSize);
  }
}

function renderCompactPager(scene: PagedCarrier): void {
  scene.controls?.destroy(true);
  scene.controls = scene.add.container(0, 0);
  const layer = scene.controls;
  const snapshot = scene.snapshot;
  const seatId = scene.session?.seatId;
  if (!snapshot || !seatId || scene.finished) return;
  const side = snapshot.sides.find((entry) => entry.sideId === seatId);
  if (!side) return;

  const slotIds = Object.keys(side.costs).slice(0, 10);
  const geometry = computePvpCompactCommandLayout(getCurrentMinimumInternalTouchTarget(), slotIds.length);
  const page = Phaser.Math.Clamp(scene[PAGE] ?? 0, 0, geometry.pageCount - 1);
  scene[PAGE] = page;
  const pageStart = page * geometry.pageSize;
  const visibleSlots = slotIds.slice(pageStart, pageStart + geometry.pageSize);

  const panel = scene.add.graphics();
  panel.fillStyle(0x0b1017, 0.97).fillRect(0, geometry.panelTop - 6, 1280, 726 - geometry.panelTop);
  panel.lineStyle(3, 0x536175, 0.66).lineBetween(0, geometry.panelTop - 4, 1280, geometry.panelTop - 4);
  layer.add(panel);

  const xFor = (index: number): number => geometry.margin + geometry.buttonWidth / 2 + index * (geometry.buttonWidth + geometry.gap);

  visibleSlots.forEach((slotId, index) => {
    const cooldown = side.cooldowns[slotId] ?? 0;
    const cost = side.costs[slotId] ?? 0;
    const name = getSlotById(slotId)?.displayName ?? '소환 동료';
    const available = cooldown <= 0 && side.supply >= cost;
    const label = cooldown > 0 ? `${name}\n${cooldownSeconds(cooldown)}초` : `${name}\n◆${cost}`;
    const button = addButton(scene, xFor(index), geometry.buttonY, geometry.buttonWidth, geometry.buttonHeight, label, () => {
      if (available) scene.session?.queueCommand({ type: 'SPAWN', slotId });
    }, available ? 0x5f86aa : 0x48515e, { tone: available ? 'primary' : 'quiet' });
    fitCompactButtonLabel(button, geometry.buttonWidth, geometry.buttonHeight);
    layer.add(button);
    if (cooldown > 0) setButtonState(button, 'disabled', `재사용까지 ${cooldownSeconds(cooldown)}초 남았습니다.`);
    else if (side.supply < cost) setButtonState(button, 'disabled', `보급이 ${(cost - side.supply).toLocaleString()} 부족합니다.`);
  });

  const pageIndex = geometry.pageSize;
  const cyclePage = (): void => {
    if (geometry.pageCount <= 1) return;
    scene[PAGE] = (page + 1) % geometry.pageCount;
    scene.renderControls();
  };
  const pageButton = geometry.pageCount > 1
    ? addButton(
        scene,
        xFor(pageIndex),
        geometry.buttonY,
        geometry.buttonWidth,
        geometry.buttonHeight,
        `병력 전환\n${page + 1}/${geometry.pageCount}`,
        cyclePage,
        0x6b668a,
        { tone: 'secondary', state: 'selected' },
      )
    : addButton(
        scene,
        xFor(pageIndex),
        geometry.buttonY,
        geometry.buttonWidth,
        geometry.buttonHeight,
        '병력 명령\n전체',
        cyclePage,
        0x6b668a,
        { tone: 'secondary', state: 'disabled', reason: '모든 소환 명령이 한 줄에 표시되어 있습니다.' },
      );
  fitCompactButtonLabel(pageButton, geometry.buttonWidth, geometry.buttonHeight);
  layer.add(pageButton);

  const canUpgrade = side.nextSupplyUpgradeCost !== null && side.supply >= side.nextSupplyUpgradeCost;
  const upgrade = addButton(
    scene,
    xFor(pageIndex + 1),
    geometry.buttonY,
    geometry.buttonWidth,
    geometry.buttonHeight,
    side.nextSupplyUpgradeCost === null ? '보급소\n최대 단계' : `보급소 강화\n◆${side.nextSupplyUpgradeCost}`,
    () => { if (canUpgrade) scene.session?.queueCommand({ type: 'UPGRADE_SUPPLY' }); },
    canUpgrade ? 0x8b773f : 0x4f5050,
    { tone: canUpgrade ? 'primary' : 'quiet' },
  );
  fitCompactButtonLabel(upgrade, geometry.buttonWidth, geometry.buttonHeight);
  layer.add(upgrade);
  if (side.nextSupplyUpgradeCost === null) setButtonState(upgrade, 'disabled', '보급소가 최대 단계입니다.');
  else if (side.supply < side.nextSupplyUpgradeCost) setButtonState(upgrade, 'disabled', `보급이 ${(side.nextSupplyUpgradeCost - side.supply).toLocaleString()} 부족합니다.`);

  const ready = side.baseWeaponId !== null && side.baseWeaponCooldownFrames === 0;
  const weaponLabel = side.baseWeaponId === null
    ? '거점 병기\n장착 없음'
    : side.baseWeaponCooldownFrames > 0
      ? `${weaponName(side.baseWeaponId)}\n${cooldownSeconds(side.baseWeaponCooldownFrames)}초`
      : `${weaponName(side.baseWeaponId)}\n사용 가능`;
  const weapon = addButton(
    scene,
    xFor(pageIndex + 2),
    geometry.buttonY,
    geometry.buttonWidth,
    geometry.buttonHeight,
    weaponLabel,
    () => { if (ready) scene.session?.queueCommand({ type: 'FIRE_BASE_WEAPON' }); },
    ready ? 0x587f98 : 0x4d535d,
    { tone: ready ? 'primary' : 'quiet' },
  );
  fitCompactButtonLabel(weapon, geometry.buttonWidth, geometry.buttonHeight);
  layer.add(weapon);
  if (side.baseWeaponId === null) setButtonState(weapon, 'disabled', '장착된 거점 병기가 없습니다.');
  else if (side.baseWeaponCooldownFrames > 0) setButtonState(weapon, 'disabled', `재사용까지 ${cooldownSeconds(side.baseWeaponCooldownFrames)}초 남았습니다.`);
}

function installCompactPager(scene: Phaser.Scene): void {
  const carrier = scene as unknown as PagedCarrier;
  if (typeof carrier.renderControls !== 'function') return;
  const desktopRenderer = carrier.renderControls.bind(carrier);
  carrier.renderControls = (): void => {
    if (!isCompactMobileViewport()) {
      desktopRenderer();
      return;
    }
    renderCompactPager(carrier);
  };
  if (isCompactMobileViewport()) carrier.renderControls();
}

export class PvpMatchScene extends BasePvpMatchScene {
  override create(): void {
    super.create();
    installCompactPager(this);
  }
}

export class FriendlyPvpMatchScene extends BaseFriendlyPvpMatchScene {
  override create(): void {
    super.create();
    installCompactPager(this);
  }
}

export { FriendlyPvpLobbyScene } from './pvp-friendly-command-scenes.ts';
