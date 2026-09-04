import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import type { PlayableBattleState } from '@frontline/sim/playable';
import { playFirstSliceBossWarningAudio } from './first-slice-production-review-audio.ts';
import { isFirstSliceProductionReviewMode } from './first-slice-production-review-runtime.ts';

interface BossWarningView {
  readonly sprite: Phaser.GameObjects.Sprite;
}

interface BossWarningHost {
  state: PlayableBattleState;
  views: Map<number, BossWarningView>;
  syncUnits(): void;
}

const INSTALL_MARKER = Symbol('first-slice-production-review-boss-warning');
type InstallableScene = Phaser.Scene & BossWarningHost & { [INSTALL_MARKER]?: boolean };

function renderWarning(scene: Phaser.Scene, unit: BattleUnit, view: BossWarningView): void {
  const x = view.sprite.x;
  const y = view.sprite.y - 82;
  const depth = view.sprite.depth + 8;
  const veil = scene.add.rectangle(640, 360, 1280, 720, 0x24161d, 0.17).setDepth(175);
  const outer = scene.add.ellipse(x, y, 210, 150, 0x24151e, 0.12).setStrokeStyle(7, 0xd9a94e, 0.95).setDepth(depth);
  const inner = scene.add.ellipse(x, y, 112, 82, 0xd7a94c, 0.13).setStrokeStyle(4, 0xffdf8a, 0.96).setDepth(depth + 0.1);
  const eyeL = scene.add.rectangle(x - 22, y - 7, 25, 8, 0x2b1721, 0.98).setDepth(depth + 0.2);
  const eyeR = scene.add.rectangle(x + 22, y - 7, 25, 8, 0x2b1721, 0.98).setDepth(depth + 0.2);
  const label = scene.add.text(640, 116, '황금가면 사령술사', {
    fontFamily: '"Malgun Gothic", sans-serif',
    fontSize: '34px',
    fontStyle: 'bold',
    color: '#ffe29a',
    stroke: '#2a171f',
    strokeThickness: 7,
  }).setOrigin(0.5).setDepth(183);
  const sub = scene.add.text(640, 157, 'MASK WARNING · UNAPPROVED REVIEW CANDIDATE', {
    fontFamily: '"Malgun Gothic", sans-serif',
    fontSize: '15px',
    color: '#e2c986',
    letterSpacing: 1,
  }).setOrigin(0.5).setDepth(183);

  scene.tweens.add({ targets: [outer, inner], scaleX: 1.38, scaleY: 1.28, alpha: 0, duration: 760, ease: 'Cubic.easeOut' });
  scene.tweens.add({
    targets: [eyeL, eyeR],
    x: (target: Phaser.GameObjects.Rectangle) => target.x + (target.x < x ? -46 : 46),
    alpha: 0,
    duration: 540,
    ease: 'Quad.easeOut',
  });
  scene.tweens.add({ targets: [veil, label, sub], alpha: 0, delay: 520, duration: 320, ease: 'Quad.easeIn', onComplete: () => {
    veil.destroy(); label.destroy(); sub.destroy(); outer.destroy(); inner.destroy(); eyeL.destroy(); eyeR.destroy();
  } });
  playFirstSliceBossWarningAudio(scene);
  scene.events.emit('first-slice-review-boss-warning', unit.simulationId);
}

export function installFirstSliceProductionReviewBossWarning(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  const host = scene as InstallableScene;
  if (host[INSTALL_MARKER]) return;
  const originalSyncUnits = host.syncUnits;
  if (typeof originalSyncUnits !== 'function') throw new Error('boss review warning requires BattleScene.syncUnits');
  host[INSTALL_MARKER] = true;
  const warned = new Set<number>();

  host.syncUnits = (): void => {
    originalSyncUnits.call(scene);
    for (const unit of host.state?.battle?.units ?? []) {
      if (unit.definition.id !== 'enemy-boss' || warned.has(unit.simulationId)) continue;
      const view = host.views.get(unit.simulationId);
      if (!view?.sprite?.active) continue;
      warned.add(unit.simulationId);
      renderWarning(scene, unit, view);
    }
  };
}
