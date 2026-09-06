import Phaser from 'phaser';
import { UnitState } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import { addText, battleUiFontSize } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

interface BattleFrontlineCarrier extends Phaser.Scene {
  state: PlayableBattleState;
  drawBases(): void;
  syncHud(): void;
}

const INSTALLED = Symbol('frontline-pressure-overlay-installed');
const LANE_LEFT = 112;
const LANE_RIGHT = 1168;

function toScreenX(state: PlayableBattleState, anchorX: number): number {
  const length = Math.max(1, state.battle.mapLength);
  return LANE_LEFT + Phaser.Math.Clamp(anchorX / length, 0, 1) * (LANE_RIGHT - LANE_LEFT);
}

function frontState(state: PlayableBattleState): { playerFront: number; enemyFront: number; contact: number; ratio: number } {
  const living = state.battle.units.filter((unit) => unit.state !== UnitState.Dying);
  const playerAnchors = living.filter((unit) => unit.team === 'PLAYER').map((unit) => unit.anchorX);
  const enemyAnchors = living.filter((unit) => unit.team === 'ENEMY').map((unit) => unit.anchorX);
  const playerFront = playerAnchors.length > 0 ? Math.max(...playerAnchors) : 0;
  const enemyFront = enemyAnchors.length > 0 ? Math.min(...enemyAnchors) : state.battle.mapLength;
  const contact = Phaser.Math.Clamp((playerFront + enemyFront) / 2, 0, state.battle.mapLength);
  return {
    playerFront,
    enemyFront,
    contact,
    ratio: Phaser.Math.Clamp(contact / Math.max(1, state.battle.mapLength), 0, 1),
  };
}

function pressureLabel(state: PlayableBattleState, ratio: number): { label: string; color: string } {
  if (state.battle.winner === 'PLAYER') return { label: '전선 확보', color: '#b8edc8' };
  if (state.battle.winner === 'ENEMY') return { label: '전선 붕괴', color: '#ffb4ac' };
  if (ratio >= 0.58) return { label: '아군 전진', color: '#bfe6ff' };
  if (ratio <= 0.42) return { label: '적 압박', color: '#ffc1b8' };
  return { label: '교착', color: '#f0d99b' };
}

export function installBattleFrontlineOverlay(scene: Phaser.Scene): void {
  const carrier = scene as unknown as BattleFrontlineCarrier & { [INSTALLED]?: boolean };
  if (carrier[INSTALLED]) return;
  if (typeof carrier.drawBases !== 'function' || typeof carrier.syncHud !== 'function') return;
  carrier[INSTALLED] = true;

  const compact = isCompactMobileViewport();
  const railY = compact ? 414 : 558;
  const supplyY = railY + 11;
  const labelY = railY - (compact ? 30 : 28);
  const originalDrawBases = carrier.drawBases.bind(carrier);
  const originalSyncHud = carrier.syncHud.bind(carrier);
  let layer: Phaser.GameObjects.Container | undefined;
  let rail: Phaser.GameObjects.Graphics | undefined;
  let marker: Phaser.GameObjects.Container | undefined;
  let label: Phaser.GameObjects.Text | undefined;

  const createLayer = (): void => {
    layer?.destroy(true);
    layer = carrier.add.container(0, 0).setDepth(1);
    rail = carrier.add.graphics();
    layer.add(rail);

    const diamond = carrier.add.rectangle(0, 0, 10, 10, 0xe8c66d, 0.92).setAngle(45).setStrokeStyle(1, 0xffe7a4, 0.66);
    const stem = carrier.add.rectangle(0, 11, 2, 14, 0xe8c66d, 0.48);
    marker = carrier.add.container(0, railY, [diamond, stem]);
    layer.add(marker);

    label = addText(carrier, 640, labelY, '', battleUiFontSize(11, 14), '#f0d99b', 'center')
      .setOrigin(0.5, 0)
      .setAlpha(0.92)
      .setDepth(1);
    layer.add(label);
  };

  const redraw = (): void => {
    if (!layer || !rail || !marker || !label || !carrier.state?.battle) return;
    const state = carrier.state;
    const front = frontState(state);
    const contactX = toScreenX(state, front.contact);
    const playerX = toScreenX(state, front.playerFront);
    const enemyX = toScreenX(state, front.enemyFront);
    const pressure = pressureLabel(state, front.ratio);

    rail.clear();
    rail.lineStyle(4, 0x10151c, 0.48).lineBetween(LANE_LEFT, railY, LANE_RIGHT, railY);
    rail.lineStyle(2, 0x70b9e8, 0.5).lineBetween(LANE_LEFT, railY, contactX, railY);
    rail.lineStyle(2, 0xd97973, 0.5).lineBetween(contactX, railY, LANE_RIGHT, railY);

    for (const fraction of [0.25, 0.5, 0.75]) {
      const x = LANE_LEFT + (LANE_RIGHT - LANE_LEFT) * fraction;
      rail.lineStyle(fraction === 0.5 ? 2 : 1, 0xe4d9bf, fraction === 0.5 ? 0.24 : 0.12).lineBetween(x, railY - 5, x, railY + 5);
    }

    rail.lineStyle(1, 0xe0bb61, 0.28).lineBetween(LANE_LEFT, supplyY, playerX, supplyY);
    const supplySpan = Math.max(0, playerX - LANE_LEFT);
    if (supplySpan > 110) {
      for (const fraction of [0.42, 0.72]) {
        const x = LANE_LEFT + supplySpan * fraction;
        rail.fillStyle(0xe0bb61, 0.34).fillTriangle(x - 4, supplyY - 3, x + 3, supplyY, x - 4, supplyY + 3);
      }
    }

    if (enemyX - playerX < 150) {
      rail.fillStyle(0xe6c96e, 0.055).fillRect(Math.min(playerX, enemyX), railY - 15, Math.max(12, Math.abs(enemyX - playerX)), 25);
    }

    marker.setPosition(contactX, railY);
    marker.setAlpha(state.battle.winner === null ? 0.86 : 1);
    label.setText(`전선 ${Math.round(front.ratio * 100)}% · ${pressure.label}`);
    label.setColor(pressure.color);
    label.setX(Phaser.Math.Clamp(contactX, 210, 1070));
  };

  carrier.drawBases = (): void => {
    originalDrawBases();
    createLayer();
    redraw();
  };
  carrier.syncHud = (): void => {
    originalSyncHud();
    redraw();
  };

  carrier.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    layer?.destroy(true);
    layer = undefined;
    rail = undefined;
    marker = undefined;
    label = undefined;
    carrier.drawBases = originalDrawBases;
    carrier.syncHud = originalSyncHud;
  });
}
