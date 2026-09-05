import Phaser from 'phaser';
import { UnitState } from '@frontline/sim';
import {
  getBaseWeaponCooldownRemaining,
  getCooldownRemaining,
  getCurrentSupplyLevel,
  getNextSupplyLevel,
  type PlayableBattleState,
} from '@frontline/sim/playable';
import { addText, COLORS } from './scene-ui.ts';

interface BattleSlotLike {
  readonly slotId: string;
  readonly displayName: string;
  readonly cost: number;
}

interface BattleCommandCarrier extends Phaser.Scene {
  state?: PlayableBattleState;
  activeSlots?: readonly BattleSlotLike[];
  trySpawnSlot(slotId: string): void;
  tryUpgradeSupplyInput(): void;
  tryFireBaseWeaponInput(): void;
}

type FeedbackKind = 'warning' | 'error' | 'success';

interface FeedbackHandle {
  readonly container: Phaser.GameObjects.Container;
  readonly timer: Phaser.Time.TimerEvent;
}

const INSTALLED = Symbol('frontline-command-feedback-installed');

function seconds(frames: number): string {
  return `${Math.max(0, frames) / 30 < 10 ? (Math.max(0, frames) / 30).toFixed(1) : Math.ceil(Math.max(0, frames) / 30)}초`;
}

function activePlayerUnits(state: PlayableBattleState): number {
  return state.battle.units.filter((unit) => unit.team === 'PLAYER' && unit.state !== UnitState.Dying).length;
}

function showFeedback(scene: Phaser.Scene, message: string, kind: FeedbackKind): void {
  const carrier = scene as Phaser.Scene & { __frontlineFeedback?: FeedbackHandle };
  carrier.__frontlineFeedback?.timer.remove(false);
  carrier.__frontlineFeedback?.container.destroy(true);

  const accent = kind === 'success' ? 0x78bd8c : kind === 'error' ? 0xc9706c : 0xc49b50;
  const textColor = kind === 'success' ? COLORS.green : kind === 'error' ? COLORS.red : COLORS.warning;
  const text = addText(scene, 0, 0, message, 17, textColor, 'center').setOrigin(0.5);
  const width = Math.min(720, Math.max(260, text.width + 64));
  const bg = scene.add.rectangle(0, 0, width, 42, 0x111821, 0.96);
  const rail = scene.add.rectangle(-width / 2 + 4, 0, 5, 28, accent, 0.95);
  const marker = scene.add.triangle(width / 2 - 12, 0, 0, -6, 0, 6, 8, 0, accent, 0.9);
  const container = scene.add.container(640, 524, [bg, rail, marker, text]).setDepth(96).setAlpha(0);
  scene.tweens.add({ targets: container, alpha: 1, y: 516, duration: 100, ease: 'Quad.easeOut' });
  const timer = scene.time.delayedCall(kind === 'error' ? 1600 : 1250, () => {
    if (!scene.scene.isActive()) return;
    scene.tweens.add({
      targets: container,
      alpha: 0,
      y: 510,
      duration: 130,
      onComplete: () => container.destroy(true),
    });
  });
  carrier.__frontlineFeedback = { container, timer };
}

function installSpawnFeedback(scene: BattleCommandCarrier): void {
  const original = scene.trySpawnSlot.bind(scene);
  scene.trySpawnSlot = (slotId: string): void => {
    const state = scene.state;
    const slot = scene.activeSlots?.find((candidate) => candidate.slotId === slotId);
    if (!state || !slot) {
      original(slotId);
      return;
    }

    const supplyBefore = state.supply;
    const unitsBefore = activePlayerUnits(state);
    const cooldownBefore = getCooldownRemaining(state, slotId);
    const battleOver = state.battle.winner !== null;
    original(slotId);

    if (state.supply !== supplyBefore || activePlayerUnits(state) > unitsBefore) return;
    if (battleOver) {
      showFeedback(scene, '전투가 종료되어 더 이상 출격할 수 없습니다.', 'error');
      return;
    }
    if (cooldownBefore > 0) {
      showFeedback(scene, `${slot.displayName} · 재생산 ${seconds(cooldownBefore)} 남음`, 'warning');
      return;
    }
    if (supplyBefore < slot.cost) {
      showFeedback(scene, `${slot.displayName} · 보급 ${slot.cost - supplyBefore} 부족`, 'warning');
      return;
    }
    if (unitsBefore >= state.playerUnitCap) {
      showFeedback(scene, `동시 출격 상한 ${state.playerUnitCap}기 · 전선의 빈 자리를 기다리세요.`, 'warning');
      return;
    }
    showFeedback(scene, `${slot.displayName}을 출격시키지 못했습니다.`, 'error');
  };
}

function installSupplyFeedback(scene: BattleCommandCarrier): void {
  const original = scene.tryUpgradeSupplyInput.bind(scene);
  scene.tryUpgradeSupplyInput = (): void => {
    const state = scene.state;
    if (!state) {
      original();
      return;
    }
    const beforeLevel = state.supplyLevel;
    const beforeSupply = state.supply;
    const next = getNextSupplyLevel(state);
    original();
    if (state.supplyLevel > beforeLevel) {
      const current = getCurrentSupplyLevel(state);
      showFeedback(scene, `보급소 Lv${state.supplyLevel + 1} · 최대 보급 ${current.maxSupply}`, 'success');
      return;
    }
    if (!next) {
      showFeedback(scene, '보급소가 최대 레벨입니다.', 'warning');
      return;
    }
    if (beforeSupply < next.upgradeCost) {
      showFeedback(scene, `보급소 강화 · 보급 ${next.upgradeCost - beforeSupply} 부족`, 'warning');
      return;
    }
    if (state.battle.winner !== null) showFeedback(scene, '전투가 종료되어 보급소를 강화할 수 없습니다.', 'error');
  };
}

function installWeaponFeedback(scene: BattleCommandCarrier): void {
  const original = scene.tryFireBaseWeaponInput.bind(scene);
  scene.tryFireBaseWeaponInput = (): void => {
    const state = scene.state;
    if (!state) {
      original();
      return;
    }
    const pendingBefore = state.baseWeaponPending;
    const lastFiredBefore = state.baseWeaponLastFiredTick;
    const cooldownBefore = getBaseWeaponCooldownRemaining(state);
    original();
    if ((!pendingBefore && state.baseWeaponPending) || state.baseWeaponLastFiredTick !== lastFiredBefore) return;
    if (state.battle.winner !== null) {
      showFeedback(scene, '전투가 종료되어 거점 병기를 사용할 수 없습니다.', 'error');
      return;
    }
    if (pendingBefore || state.baseWeaponPending) {
      showFeedback(scene, '거점 병기 명령을 실행 중입니다.', 'warning');
      return;
    }
    if (cooldownBefore > 0) {
      showFeedback(scene, `거점 병기 · 재사용 ${seconds(cooldownBefore)} 남음`, 'warning');
      return;
    }
    showFeedback(scene, '거점 병기를 사용할 수 없습니다.', 'error');
  };
}

/**
 * Presentation-only command feedback. It wraps the existing BattleScene input methods but never calls simulation
 * functions directly, so authoritative state mutation and trusted command recording remain owned by BattleScene.
 */
export function installBattleCommandFeedback(scene: Phaser.Scene): void {
  const carrier = scene as BattleCommandCarrier & { [INSTALLED]?: boolean };
  if (carrier[INSTALLED]) return;
  carrier[INSTALLED] = true;
  installSpawnFeedback(carrier);
  installSupplyFeedback(carrier);
  installWeaponFeedback(carrier);
}
