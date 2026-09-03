import Phaser from 'phaser';
import { UnitState, type BattleUnit } from '@frontline/sim';
import { familyForUnit } from './scene-ui';
import { createStorySilhouetteOverlayGraphics } from './story-silhouette-renderer.ts';
import { getStorySilhouetteOverlaySpec } from './story-silhouette-overlays.ts';

interface CoreUnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
}

interface UnitViewFactoryHost {
  createUnitView(unit: BattleUnit): CoreUnitView;
}

const INSTALL_MARKER = Symbol('story-silhouette-overlay-installed');
type InstallableScene = Phaser.Scene & UnitViewFactoryHost & { [INSTALL_MARKER]?: boolean };

function attachOverlay(scene: Phaser.Scene, unit: BattleUnit, view: CoreUnitView): void {
  const art = familyForUnit(unit.definition.id);
  const spec = getStorySilhouetteOverlaySpec(unit.definition.id, art.resolvedFormId);
  if (!spec) return;

  const overlay = createStorySilhouetteOverlayGraphics(scene, spec);
  let cleaned = false;
  const sync = (): void => {
    if (!view.sprite.active || !overlay.active) return;
    const direction = view.sprite.flipX ? -1 : 1;
    const attackPush = unit.state === UnitState.Foreswing
      ? Math.min(spec.kind === 'LANCER_SPEAR' ? 8 : 4, Math.max(0, unit.stateFrame) * 0.8)
      : 0;
    const deathAlpha = unit.state === UnitState.Dying
      ? Math.max(0, 1 - unit.stateFrame / Math.max(1, unit.definition.deathFrames))
      : 1;
    overlay.setPosition(view.sprite.x + direction * attackPush, view.sprite.y);
    overlay.setScale(direction, 1);
    overlay.setAngle(view.sprite.angle);
    overlay.setAlpha(view.sprite.alpha * deathAlpha);
    overlay.setVisible(view.sprite.visible);
    overlay.setDepth(view.sprite.depth + 0.5);
  };
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    scene.events.off('postupdate', sync);
    scene.events.off('shutdown', cleanup);
    if (overlay.active) overlay.destroy();
  };

  sync();
  scene.events.on('postupdate', sync);
  scene.events.once('shutdown', cleanup);
  view.sprite.once('destroy', cleanup);
}

/**
 * Adds presentation-only shield/polearm silhouettes without changing BattleScene's canonical source
 * or production-art approval state. Installed per scene instance so subclasses and replay wrappers
 * keep the exact same deterministic combat implementation.
 */
export function installStorySilhouetteOverlayRuntime(scene: Phaser.Scene): void {
  const host = scene as InstallableScene;
  if (host[INSTALL_MARKER]) return;
  const originalCreateUnitView = host.createUnitView;
  if (typeof originalCreateUnitView !== 'function') throw new Error('story silhouette runtime requires BattleScene.createUnitView');
  host[INSTALL_MARKER] = true;
  host.createUnitView = (unit: BattleUnit): CoreUnitView => {
    const view = originalCreateUnitView.call(scene, unit);
    attachOverlay(scene, unit, view);
    return view;
  };
}
