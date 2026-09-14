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

function layoutChromeOutsideCharacter(unit: BattleUnit, view: UnitViewLike): void {
  const art = familyForUnit(unit.definition.id);
  const displayedHeight = art.family.displayHeight * art.displayScale;
  const hpY = view.sprite.y - displayedHeight / 2 - 10;
  const traitY = hpY - 18;
  const shadowY = view.sprite.y + displayedHeight / 2 + 8;

  view.hpBg.setPosition(view.sprite.x, hpY);
  view.hp.setPosition(view.sprite.x - 26, hpY);
  view.trait.setPosition(view.sprite.x, traitY);
  view.shadow.setPosition(view.sprite.x, shadowY);
}

/**
 * Presentation-only clean-room guard for the PvE battle renderer.
 *
 * BattleScene remains authoritative for character sprite texture, frame, tint, scale, alpha,
 * angle, flip, animation state, and world position. This wrapper only moves UI chrome that
 * BattleScene creates around a unit so no HP bar, trait label, or shadow crosses the resolved
 * character display bounds.
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
    layoutChromeOutsideCharacter(unit, view);
    return view;
  };

  const syncUnits = carrier.syncUnits.bind(carrier);
  carrier.syncUnits = (): void => {
    syncUnits();
    for (const unit of carrier.state.battle.units) {
      const view = carrier.views.get(unit.simulationId);
      if (view) layoutChromeOutsideCharacter(unit, view);
    }
  };
}
