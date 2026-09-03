import Phaser from 'phaser';
import { DeckScene as BaseDeckScene } from './deck-scene.ts';
import { GrowthScene as BaseGrowthScene } from './growth-scene.ts';
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

const DECK_INSTALL_MARKER = Symbol('story-silhouette-deck-preview-installed');
const GROWTH_INSTALL_MARKER = Symbol('story-silhouette-growth-preview-installed');

type DeckInstallable = DeckSceneRuntime & { [DECK_INSTALL_MARKER]?: boolean };
type GrowthInstallable = GrowthSceneRuntime & { [GROWTH_INSTALL_MARKER]?: boolean };

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

function installDeckPreview(scene: BaseDeckScene): void {
  const host = scene as unknown as DeckInstallable;
  if (host[DECK_INSTALL_MARKER]) return;
  const original = host.renderCards.bind(scene);
  host[DECK_INSTALL_MARKER] = true;
  host.renderCards = (): void => {
    original();
    decorateDeckCards(scene, host);
  };
}

function installGrowthPreview(scene: BaseGrowthScene): void {
  const host = scene as unknown as GrowthInstallable;
  if (host[GROWTH_INSTALL_MARKER]) return;
  const original = host.renderDetail.bind(scene);
  host[GROWTH_INSTALL_MARKER] = true;
  host.renderDetail = (): void => {
    original();
    decorateGrowthDetail(scene, host);
  };
}

/** Presentation-only wrapper; deck persistence, filtering, drag/drop, and save authority stay in DeckScene. */
export class StorySilhouetteDeckScene extends BaseDeckScene {
  override create(): void {
    installDeckPreview(this);
    super.create();
  }
}

/** Presentation-only wrapper; growth costs, unlocks, form selection, and save authority stay in GrowthScene. */
export class StorySilhouetteGrowthScene extends BaseGrowthScene {
  override create(): void {
    installGrowthPreview(this);
    super.create();
  }
}
