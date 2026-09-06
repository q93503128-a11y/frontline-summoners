import Phaser from 'phaser';
import {
  Pvp2v2BattleScene as BasePvp2v2BattleScene,
  Pvp2v2MatchmakingScene,
} from './pvp-2v2-command-scenes.ts';
import { computePvp2v2CompactRailLayout } from './pvp-2v2-compact-layout.ts';
import type { Pvp2v2BattleSnapshot, Pvp2v2Session } from './pvp-2v2-network.ts';
import { getSlotById } from './prototype.ts';
import { addButton, setButtonState } from './scene-ui.ts';
import { getCurrentMinimumInternalTouchTarget, isCompactMobileViewport } from './viewport.ts';

interface TeamBattleCarrier extends Phaser.Scene {
  session: Pvp2v2Session | null;
  snapshot: Pvp2v2BattleSnapshot | null;
  controls?: Phaser.GameObjects.Container;
  finished: boolean;
  renderControls(): void;
}

function cooldownSeconds(frames: number): number {
  return Math.max(1, Math.ceil(Math.max(0, frames) / 30));
}

function teamWeaponName(id: string): string {
  if (id === 'base_weapon_aegis_emitter') return '결계발진기';
  if (id === 'base_weapon_supply_drop') return '보급낙하기';
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

function renderCompactTeamControls(scene: TeamBattleCarrier): void {
  scene.controls?.destroy(true);
  scene.controls = scene.add.container(0, 0);
  const layer = scene.controls;
  const snapshot = scene.snapshot;
  const seatId = scene.session?.seatId;
  if (!snapshot || !seatId || scene.finished) return;

  const seat = snapshot.seats.find((entry) => entry.seatId === seatId);
  if (!seat) return;
  const team = snapshot.teams.find((entry) => entry.teamId === seat.teamId);
  const slotIds = Object.keys(seat.costs).slice(0, 5);
  const geometry = computePvp2v2CompactRailLayout(getCurrentMinimumInternalTouchTarget(), slotIds.length);
  const xFor = (index: number): number => geometry.margin + geometry.buttonWidth / 2 + index * (geometry.buttonWidth + geometry.gap);

  const panel = scene.add.graphics();
  panel.fillStyle(0x0b1017, 0.97).fillRect(0, geometry.panelTop - 6, 1280, 726 - geometry.panelTop);
  panel.lineStyle(3, 0x536175, 0.66).lineBetween(0, geometry.panelTop - 4, 1280, geometry.panelTop - 4);
  layer.add(panel);

  slotIds.forEach((slotId, index) => {
    const cooldown = seat.cooldowns[slotId] ?? 0;
    const cost = seat.costs[slotId] ?? 0;
    const name = getSlotById(slotId)?.displayName ?? '소환 동료';
    const availableCommand = cooldown <= 0 && seat.supply >= cost;
    const label = cooldown > 0 ? `${name}\n${cooldownSeconds(cooldown)}초` : `${name}\n◆${cost}`;
    const button = addButton(scene, xFor(index), geometry.buttonY, geometry.buttonWidth, geometry.buttonHeight, label, () => {
      if (availableCommand) scene.session?.queueCommand({ type: 'SPAWN', slotId });
    }, availableCommand ? 0x5f86aa : 0x48515e, { tone: availableCommand ? 'primary' : 'quiet' });
    fitCompactButtonLabel(button, geometry.buttonWidth, geometry.buttonHeight);
    layer.add(button);
    if (cooldown > 0) setButtonState(button, 'disabled', `재사용까지 ${cooldownSeconds(cooldown)}초 남았습니다.`);
    else if (seat.supply < cost) setButtonState(button, 'disabled', `보급이 ${(cost - seat.supply).toLocaleString()} 부족합니다.`);
  });

  const supplyIndex = slotIds.length;
  const canUpgrade = seat.nextSupplyUpgradeCost !== null && seat.supply >= seat.nextSupplyUpgradeCost;
  const upgrade = addButton(
    scene,
    xFor(supplyIndex),
    geometry.buttonY,
    geometry.buttonWidth,
    geometry.buttonHeight,
    seat.nextSupplyUpgradeCost === null ? '보급소\n최대 단계' : `보급소 강화\n◆${seat.nextSupplyUpgradeCost}`,
    () => { if (canUpgrade) scene.session?.queueCommand({ type: 'UPGRADE_SUPPLY' }); },
    canUpgrade ? 0x8b773f : 0x4f5050,
    { tone: canUpgrade ? 'primary' : 'quiet' },
  );
  fitCompactButtonLabel(upgrade, geometry.buttonWidth, geometry.buttonHeight);
  layer.add(upgrade);
  if (seat.nextSupplyUpgradeCost === null) setButtonState(upgrade, 'disabled', '보급소가 최대 단계입니다.');
  else if (seat.supply < seat.nextSupplyUpgradeCost) setButtonState(upgrade, 'disabled', `보급이 ${(seat.nextSupplyUpgradeCost - seat.supply).toLocaleString()} 부족합니다.`);

  const weaponIndex = supplyIndex + 1;
  const weaponReady = Boolean(team?.baseWeaponId) && (team?.baseWeaponCooldownFrames ?? 1) === 0;
  const weaponLabel = !team?.baseWeaponId
    ? '팀 거점 병기\n장착 없음'
    : team.baseWeaponCooldownFrames > 0
      ? `${teamWeaponName(team.baseWeaponId)}\n${cooldownSeconds(team.baseWeaponCooldownFrames)}초`
      : `${teamWeaponName(team.baseWeaponId)}\n팀 사용 가능`;
  const weapon = addButton(
    scene,
    xFor(weaponIndex),
    geometry.buttonY,
    geometry.buttonWidth,
    geometry.buttonHeight,
    weaponLabel,
    () => { if (weaponReady) scene.session?.queueCommand({ type: 'FIRE_BASE_WEAPON' }); },
    weaponReady ? 0x587f98 : 0x4d535d,
    { tone: weaponReady ? 'primary' : 'quiet' },
  );
  fitCompactButtonLabel(weapon, geometry.buttonWidth, geometry.buttonHeight);
  layer.add(weapon);
  if (!team?.baseWeaponId) setButtonState(weapon, 'disabled', '팀에 장착된 거점 병기가 없습니다.');
  else if (team.baseWeaponCooldownFrames > 0) setButtonState(weapon, 'disabled', `재사용까지 ${cooldownSeconds(team.baseWeaponCooldownFrames)}초 남았습니다.`);
}

function installCompactTeamRail(scene: Phaser.Scene): void {
  const carrier = scene as unknown as TeamBattleCarrier;
  if (typeof carrier.renderControls !== 'function') return;
  const desktopRenderer = carrier.renderControls.bind(carrier);
  carrier.renderControls = (): void => {
    if (!isCompactMobileViewport()) {
      desktopRenderer();
      return;
    }
    renderCompactTeamControls(carrier);
  };
  if (isCompactMobileViewport()) carrier.renderControls();
}

export class Pvp2v2BattleScene extends BasePvp2v2BattleScene {
  override create(): void {
    super.create();
    installCompactTeamRail(this);
  }
}

export { Pvp2v2MatchmakingScene };
