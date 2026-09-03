import Phaser from 'phaser';
import { UnitState, type BattleUnit } from '@frontline/sim';
import { BattleScene as BattleSceneCore } from './battle-scene-core.ts';
import { familyForUnit } from './scene-ui';
import {
  getStorySilhouetteOverlaySpec,
  type GuardShieldOverlaySpec,
  type LancerSpearOverlaySpec,
  type StorySilhouetteOverlaySpec,
} from './story-silhouette-overlays.ts';

interface CoreUnitView {
  readonly sprite: Phaser.GameObjects.Sprite;
}

type CoreCreateUnitView = (unit: BattleUnit) => CoreUnitView;

function drawGuardShield(graphics: Phaser.GameObjects.Graphics, spec: GuardShieldOverlaySpec): void {
  const left = spec.frontOffsetX - spec.shieldWidth / 2;
  const top = spec.verticalOffset - spec.shieldHeight / 2;
  const right = left + spec.shieldWidth;
  const bottom = top + spec.shieldHeight;

  graphics.fillStyle(spec.fillColor, 0.96).fillRoundedRect(left, top, spec.shieldWidth, spec.shieldHeight, 5);
  graphics.lineStyle(4, spec.rimColor, 0.96).strokeRoundedRect(left, top, spec.shieldWidth, spec.shieldHeight, 5);
  graphics.lineStyle(3, spec.rimColor, 0.55).lineBetween(spec.frontOffsetX, top + 8, spec.frontOffsetX, bottom - 8);
  graphics.lineStyle(2, spec.rimColor, 0.42).lineBetween(left + 7, spec.verticalOffset, right - 7, spec.verticalOffset);

  const rivetX = [left + 7, right - 7];
  const rivetY = [top + 10, bottom - 10];
  graphics.fillStyle(spec.rimColor, 0.92);
  for (const x of rivetX) for (const y of rivetY) graphics.fillCircle(x, y, 2.4);

  if (spec.battlementCount > 0) {
    const toothWidth = Math.max(7, Math.floor(spec.shieldWidth / (spec.battlementCount * 1.8)));
    const spacing = spec.shieldWidth / spec.battlementCount;
    for (let index = 0; index < spec.battlementCount; index += 1) {
      const x = left + spacing * index + (spacing - toothWidth) / 2;
      graphics.fillStyle(spec.fillColor, 0.98).fillRect(x, top - 8, toothWidth, 10);
      graphics.lineStyle(2, spec.rimColor, 0.9).strokeRect(x, top - 8, toothWidth, 10);
    }
  }

  if (spec.skidWidth > 0) {
    graphics.lineStyle(5, spec.rimColor, 0.88).lineBetween(
      spec.frontOffsetX - spec.skidWidth / 2,
      bottom + 4,
      spec.frontOffsetX + spec.skidWidth / 2,
      bottom + 4,
    );
  }
  if (spec.wheelRadius > 0) {
    graphics.fillStyle(0x222a33, 1);
    graphics.fillCircle(spec.frontOffsetX - spec.shieldWidth * 0.3, bottom + 6, spec.wheelRadius);
    graphics.fillCircle(spec.frontOffsetX + spec.shieldWidth * 0.3, bottom + 6, spec.wheelRadius);
    graphics.lineStyle(2, spec.rimColor, 0.8)
      .strokeCircle(spec.frontOffsetX - spec.shieldWidth * 0.3, bottom + 6, spec.wheelRadius)
      .strokeCircle(spec.frontOffsetX + spec.shieldWidth * 0.3, bottom + 6, spec.wheelRadius);
  }
}

function drawLancerSpear(graphics: Phaser.GameObjects.Graphics, spec: LancerSpearOverlaySpec): void {
  const y = spec.verticalOffset;
  const rear = -spec.rearExtent;
  const front = spec.shaftForward;
  const tip = front + spec.bladeLength;

  graphics.lineStyle(spec.shaftThickness, spec.shaftColor, 1).lineBetween(rear, y, front + 2, y);
  graphics.lineStyle(2, 0xd9e8f2, 0.42).lineBetween(rear + 3, y - 1.5, front - 2, y - 1.5);
  graphics.fillStyle(spec.bladeColor, 0.98).fillTriangle(
    tip, y,
    front, y - spec.bladeHalfHeight,
    front, y + spec.bladeHalfHeight,
  );
  graphics.lineStyle(2, 0xf0f7fb, 0.78).lineBetween(front, y - spec.bladeHalfHeight, tip, y);
  graphics.lineStyle(2, 0x75899d, 0.9).lineBetween(front, y + spec.bladeHalfHeight, tip, y);
  graphics.fillStyle(0x9eafbd, 0.95).fillRect(front - 5, y - spec.bladeHalfHeight - 2, 6, spec.bladeHalfHeight * 2 + 4);

  const bannerRoot = rear + 20;
  graphics.fillStyle(spec.bannerColor, 0.94).fillTriangle(
    bannerRoot, y + 3,
    bannerRoot + 28, y + 6,
    bannerRoot + 8, y + spec.bannerDrop,
  );
  graphics.lineStyle(2, 0xb9d5ed, 0.55).lineBetween(bannerRoot, y + 3, bannerRoot + 8, y + spec.bannerDrop);
}

function createOverlayGraphics(
  scene: Phaser.Scene,
  spec: StorySilhouetteOverlaySpec,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(4);
  if (spec.kind === 'GUARD_SHIELD') drawGuardShield(graphics, spec);
  else drawLancerSpear(graphics, spec);
  return graphics;
}

/**
 * Presentation decorator around the canonical battle runtime. The core scene remains isolated so
 * placeholder-only silhouette scaffolding can be removed cleanly when reviewed production art lands.
 */
export class BattleScene extends BattleSceneCore {
  constructor() {
    super();
    const coreCreateUnitView = (BattleSceneCore.prototype as unknown as { createUnitView: CoreCreateUnitView }).createUnitView;
    (this as unknown as { createUnitView: CoreCreateUnitView }).createUnitView = (unit: BattleUnit): CoreUnitView => {
      const view = coreCreateUnitView.call(this, unit);
      this.attachStorySilhouetteOverlay(unit, view);
      return view;
    };
  }

  private attachStorySilhouetteOverlay(unit: BattleUnit, view: CoreUnitView): void {
    const art = familyForUnit(unit.definition.id);
    const spec = getStorySilhouetteOverlaySpec(unit.definition.id, art.resolvedFormId);
    if (!spec) return;

    const overlay = createOverlayGraphics(this, spec);
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
      this.events.off('postupdate', sync);
      this.events.off('shutdown', cleanup);
      if (overlay.active) overlay.destroy();
    };

    sync();
    this.events.on('postupdate', sync);
    this.events.once('shutdown', cleanup);
    view.sprite.once('destroy', cleanup);
  }
}
