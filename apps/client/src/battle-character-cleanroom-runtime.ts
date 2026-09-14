import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import { familyForUnit } from './scene-ui.ts';

interface UnitViewLike {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly hpBg: Phaser.GameObjects.Rectangle;
  readonly hp: Phaser.GameObjects.Rectangle;
  readonly trait: Phaser.GameObjects.Text;
}

interface BattleCharacterCleanroomCarrier extends Phaser.Scene {
  state: { readonly battle: { readonly units: readonly BattleUnit[] } };
  views: Map<number, UnitViewLike>;
  createUnitView(unit: BattleUnit): UnitViewLike;
  syncUnits(): void;
}

const INSTALLED = Symbol('frontline-battle-character-cleanroom-runtime-installed');
const PLACEHOLDER_BATTLE_SCALE = 1.34;
const MIN_PLACEHOLDER_FRAME_HEIGHT = 220;
const MAX_PLACEHOLDER_FRAME_HEIGHT = 300;

function improvePlaceholderLegibility(unit: BattleUnit, view: UnitViewLike): void {
  const art = familyForUnit(unit.definition.id);
  if (art.source !== 'PLACEHOLDER') return;
  const currentHeight = view.sprite.displayHeight;
  if (!Number.isFinite(currentHeight) || currentHeight <= 0) return;
  const targetHeight = Phaser.Math.Clamp(
    currentHeight * PLACEHOLDER_BATTLE_SCALE,
    MIN_PLACEHOLDER_FRAME_HEIGHT,
    MAX_PLACEHOLDER_FRAME_HEIGHT,
  );
  const factor = targetHeight / currentHeight;
  view.sprite.setScale(view.sprite.scaleX * factor, view.sprite.scaleY * factor);
}

function layoutChromeOutsideCharacter(view: UnitViewLike): void {
  const displayedHeight = Math.max(1, view.sprite.displayHeight);
  const hpY = view.sprite.y - displayedHeight / 2 - 10;
  const traitY = hpY - 18;
  const shadowY = view.sprite.y + displayedHeight / 2 + 8;

  view.hpBg.setPosition(view.sprite.x, hpY);
  view.hp.setPosition(view.sprite.x - 26, hpY);
  view.trait.setPosition(view.sprite.x, traitY);
  view.shadow.setPosition(view.sprite.x, shadowY);
}

function polishUnitPresentation(unit: BattleUnit, view: UnitViewLike): void {
  improvePlaceholderLegibility(unit, view);
  layoutChromeOutsideCharacter(view);
}

/**
 * Presentation-only guard for the PvE battle renderer.
 *
 * BattleScene remains authoritative for character texture, frame, tint, motion state, alpha,
 * angle, flip, and world position. Production art keeps its authored scale. While final art is
 * still unavailable, PLACEHOLDER sprite sheets receive a bounded uniform battle-only scale-up
 * because their transparent frame canvas is much larger than their visible character pixels.
 * HP bars, trait labels, and shadows are then laid out from the actual post-scale sprite bounds.
 */
export function installBattleCharacterCleanroomRuntime(scene: Phaser.Scene): void {
  const carrier = scene as unknown as BattleCharacterCleanroomCarrier & { [INSTALLED]?: boolean };
  if (carrier[INSTALLED]) return;
  if (typeof carrier.createUnitView !== 'function' || typeof carrier.syncUnits !== 'function') {
    throw new Error('battle character clean-room runtime requires BattleScene unit presentation methods');
  }
  carrier[INSTALLED] = true;

  const createUnitView = carrier.createUnitView.bind(carrier);
  carrier.createUnitView = (unit: BattleUnit): UnitViewLike => {
    const view = createUnitView(unit);
    polishUnitPresentation(unit, view);
    return view;
  };

  const syncUnits = carrier.syncUnits.bind(carrier);
  carrier.syncUnits = (): void => {
    syncUnits();
    for (const unit of carrier.state.battle.units) {
      const view = carrier.views.get(unit.simulationId);
      if (view) polishUnitPresentation(unit, view);
    }
  };
}
