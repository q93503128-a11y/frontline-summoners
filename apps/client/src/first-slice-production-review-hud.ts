import Phaser from 'phaser';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import { isFirstSliceProductionReviewMode } from './first-slice-production-review-runtime.ts';
import { BATTLE_UNIT_HOTKEY_CODES } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

type MilitiaReviewForm = 'militia_f1' | 'militia_f2' | 'militia_f3';

const MILITIA_IDLE = {
  militia_f1: { key: 'review-militia-f1-idle', frameHeight: 135 },
  militia_f2: { key: 'review-militia-f2-idle', frameHeight: 140 },
  militia_f3: { key: 'review-militia-f3-idle', frameHeight: 137 },
} as const;

interface ReviewHudSlot {
  readonly definition: { readonly id: string };
}

interface ReviewHudHost {
  activeSlots: readonly ReviewHudSlot[];
  drawUnitButtons(): void;
}

interface TrackedPortrait {
  readonly unitId: string;
  readonly sprite: Phaser.GameObjects.Sprite;
}

const INSTALL_MARKER = Symbol('first-slice-production-review-hud');
type InstallableScene = Phaser.Scene & ReviewHudHost & { [INSTALL_MARKER]?: boolean };

function parseForm(value: string | null | undefined): MilitiaReviewForm | undefined {
  if (value === 'f1' || value === 'militia_f1') return 'militia_f1';
  if (value === 'f2' || value === 'militia_f2') return 'militia_f2';
  if (value === 'f3' || value === 'militia_f3') return 'militia_f3';
  return undefined;
}

function currentMilitiaForm(): MilitiaReviewForm {
  if (typeof window !== 'undefined') {
    const forced = parseForm(new URLSearchParams(window.location.search).get('militiaForm'));
    if (forced) return forced;
  }
  return parseForm(getActiveVisualFormId('militia')) ?? 'militia_f1';
}

function refreshPortraits(portraits: readonly TrackedPortrait[]): void {
  const compact = isCompactMobileViewport();
  const portraitHeight = compact ? 60 : 50;
  const militia = MILITIA_IDLE[currentMilitiaForm()];
  for (const portrait of portraits) {
    if (!portrait.sprite.active || portrait.unitId !== 'militia') continue;
    if (portrait.sprite.texture.key !== militia.key) portrait.sprite.setTexture(militia.key, 0);
    portrait.sprite.setScale(portraitHeight / militia.frameHeight);
    portrait.sprite.clearTint();
  }
}

/** Presentation-only bridge: production battlefield art and the summon-button portrait must show the same militia form. */
export function installFirstSliceProductionReviewHud(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  const host = scene as InstallableScene;
  if (host[INSTALL_MARKER]) return;
  const originalDrawUnitButtons = host.drawUnitButtons;
  if (typeof originalDrawUnitButtons !== 'function') throw new Error('first-slice review HUD requires BattleScene.drawUnitButtons');
  host[INSTALL_MARKER] = true;

  const portraits: TrackedPortrait[] = [];
  let lastForm = currentMilitiaForm();

  host.drawUnitButtons = (): void => {
    const before = new Set(scene.children.list);
    originalDrawUnitButtons.call(scene);
    const created = scene.children.list.filter(
      (object): object is Phaser.GameObjects.Sprite => object instanceof Phaser.GameObjects.Sprite && !before.has(object) && object.depth === 4,
    );
    portraits.length = 0;
    host.activeSlots.slice(0, BATTLE_UNIT_HOTKEY_CODES.length).forEach((slot, index) => {
      const sprite = created[index];
      if (sprite) portraits.push({ unitId: slot.definition.id, sprite });
    });
    refreshPortraits(portraits);
  };

  const sync = (): void => {
    const form = currentMilitiaForm();
    if (form === lastForm) return;
    lastForm = form;
    refreshPortraits(portraits);
  };
  scene.events.on('postupdate', sync);
  scene.events.once('shutdown', () => scene.events.off('postupdate', sync));
}
