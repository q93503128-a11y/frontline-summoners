import Phaser from 'phaser';
import { DeckScene } from './deck-scene.ts';
import { GrowthScene } from './growth-scene.ts';
import { resolveUnitArt } from './production-assets.ts';
import { getSlotById, type PrototypeRosterSlot } from './prototype.ts';
import type { GuestProgress } from './save.ts';
import {
  createStorySilhouetteOverlayGraphics,
  getStorySilhouettePreviewScale,
} from './story-silhouette-renderer.ts';
import { getStorySilhouetteOverlaySpec } from './story-silhouette-overlays.ts';
import { isCompactMobileViewport } from './viewport.ts';

interface DeckSceneRuntime {
  progress: GuestProgress;
  page: number;
  readonly pageSize: number;
  cardsLayer?: Phaser.GameObjects.Container;
  getFilteredSlots(): readonly PrototypeRosterSlot[];
  renderCards(): void;
}

interface GrowthSceneRuntime {
  progress: GuestProgress;
  selectedCharacterId?: string;
  detailLayer?: Phaser.GameObjects.Container;
  renderDetail(): void;
}

const DECK_INSTANCE_MARKER = Symbol('story-silhouette-deck-preview-installed');
const GROWTH_INSTANCE_MARKER = Symbol('story-silhouette-growth-preview-installed');
const DECK_CLASS_MARKER = Symbol('story-silhouette-deck-class-installed');
const GROWTH_CLASS_MARKER = Symbol('story-silhouette-growth-class-installed');

type DeckInstallable = DeckSceneRuntime & { [DECK_INSTANCE_MARKER]?: boolean };
type GrowthInstallable = GrowthSceneRuntime & { [GROWTH_INSTANCE_MARKER]?: boolean };
type DeckPrototype = DeckScene & { [DECK_CLASS_MARKER]?: boolean };
type GrowthPrototype = GrowthScene & { [GROWTH_CLASS_MARKER]?: boolean };

function insertOverlayAfterPortrait(
  container: Phaser.GameObjects.Container,
  overlay: Phaser.GameObjects.Graphics,
  portraitX: number,
  portraitY: number,
  textureKey?: string,
): void {
  const portraitIndex = container.list.findIndex((child) =>
    child instanceof Phaser.GameObjects.Sprite
    && Math.abs(child.x - portraitX) < 0.5
    && Math.abs(child.y - portraitY) < 0.5
    && (textureKey === undefined || child.texture.key === textureKey),
  );
  if (portraitIndex < 0) {
    overlay.destroy();
    return;
  }
  container.addAt(overlay, portraitIndex + 1);
}

function decorateDeckCards(scene: Phaser.Scene, host: DeckSceneRuntime): void {
  const layer = host.cardsLayer;
  if (!layer) return;
  const compact = isCompactMobileViewport();
  const filteredSlots = host.getFilteredSlots();
  const start = host.page * host.pageSize;
  const visible = filteredSlots.slice(start, start + host.pageSize);
  const columns = compact ? 4 : 5;
  const cardWidth = compact ? 282 : 222;
  const xGap = compact ? 300 : 236;
  const startX = compact ? 190 : 168;
  const startY = compact ? 342 : 332;
  const yGap = compact ? 168 : 174;
  const targetHeight = compact ? 76 : 70;

  visible.forEach((slot, localIndex) => {
    const meta = host.progress.characterProgressById?.[slot.slotId];
    const art = resolveUnitArt(slot.definition.id, meta?.selectedFormId);
    const spec = getStorySilhouetteOverlaySpec(slot.definition.id, art.resolvedFormId);
    if (!spec) return;

    const col = localIndex % columns;
    const row = Math.floor(localIndex / columns);
    const x = startX + col * xGap;
    const y = startY + row * yGap;
    const portraitX = x - cardWidth / 2 + (compact ? 54 : 48);
    const portraitY = y - 8;
    const overlay = createStorySilhouetteOverlayGraphics(scene, spec)
      .setPosition(portraitX, portraitY)
      .setScale(getStorySilhouettePreviewScale(art.family.displayHeight, targetHeight));
    insertOverlayAfterPortrait(layer, overlay, portraitX, portraitY, art.family.idle.key);
  });
}

function decorateGrowthDetail(scene: Phaser.Scene, host: GrowthSceneRuntime): void {
  const layer = host.detailLayer;
  const characterId = host.selectedCharacterId;
  if (!layer || !characterId) return;
  const slot = getSlotById(characterId);
  if (!slot) return;
  const meta = host.progress.characterProgressById?.[characterId];
  const art = resolveUnitArt(slot.definition.id, meta?.selectedFormId);
  const spec = getStorySilhouetteOverlaySpec(slot.definition.id, art.resolvedFormId);
  if (!spec) return;

  const portraitX = 610;
  const portraitY = 235;
  const overlay = createStorySilhouetteOverlayGraphics(scene, spec)
    .setPosition(portraitX, portraitY)
    .setScale(getStorySilhouettePreviewScale(art.family.displayHeight, 110));
  insertOverlayAfterPortrait(layer, overlay, portraitX, portraitY);
}

function installDeckPreview(scene: DeckScene): void {
  const host = scene as unknown as DeckInstallable;
  if (host[DECK_INSTANCE_MARKER]) return;
  const original = host.renderCards.bind(scene);
  host[DECK_INSTANCE_MARKER] = true;
  host.renderCards = (): void => {
    original();
    decorateDeckCards(scene, host);
  };
}

function installGrowthPreview(scene: GrowthScene): void {
  const host = scene as unknown as GrowthInstallable;
  if (host[GROWTH_INSTANCE_MARKER]) return;
  const original = host.renderDetail.bind(scene);
  host[GROWTH_INSTANCE_MARKER] = true;
  host.renderDetail = (): void => {
    original();
    decorateGrowthDetail(scene, host);
  };
}

function installDeckClassPreview(): void {
  const prototype = DeckScene.prototype as DeckPrototype;
  if (prototype[DECK_CLASS_MARKER]) return;
  const originalCreate = prototype.create;
  prototype[DECK_CLASS_MARKER] = true;
  prototype.create = function createWithStorySilhouettePreview(this: DeckScene): void {
    installDeckPreview(this);
    originalCreate.call(this);
  };
}

function installGrowthClassPreview(): void {
  const prototype = GrowthScene.prototype as GrowthPrototype;
  if (prototype[GROWTH_CLASS_MARKER]) return;
  const originalCreate = prototype.create;
  prototype[GROWTH_CLASS_MARKER] = true;
  prototype.create = function createWithStorySilhouettePreview(this: GrowthScene): void {
    installGrowthPreview(this);
    originalCreate.call(this);
  };
}

/**
 * Presentation-only installation. Canonical DeckScene/GrowthScene imports and all persistence,
 * growth-cost, filtering, drag/drop, and save-authority behavior remain untouched.
 */
export function installStorySilhouetteScenePreviews(): void {
  installDeckClassPreview();
  installGrowthClassPreview();
}
