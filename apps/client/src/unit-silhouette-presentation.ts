import Phaser from 'phaser';
import { getSignatureSilhouetteOverlaySpec } from './common-silhouette-overlays.ts';
import { createSignatureSilhouetteOverlayGraphics } from './common-silhouette-renderer.ts';
import {
  createStorySilhouetteOverlayGraphics,
  getStorySilhouettePreviewScale,
} from './story-silhouette-renderer.ts';
import { getStorySilhouetteOverlaySpec } from './story-silhouette-overlays.ts';

export interface UnitSilhouettePresentation {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly attackPushMax: number;
}

/**
 * Resolves presentation-only silhouette scaffolding across story forms, common recruitment units,
 * and chapter 1-2 enemy identities. Production-art authority remains in production-assets.ts.
 */
export function createUnitSilhouettePresentation(
  scene: Phaser.Scene,
  unitId: string,
  resolvedFormId?: string,
): UnitSilhouettePresentation | undefined {
  const story = getStorySilhouetteOverlaySpec(unitId, resolvedFormId);
  if (story) {
    return {
      graphics: createStorySilhouetteOverlayGraphics(scene, story),
      attackPushMax: story.kind === 'LANCER_SPEAR' || story.kind === 'HUNTER_POLEARM' ? 8 : 4,
    };
  }

  const signature = getSignatureSilhouetteOverlaySpec(unitId, resolvedFormId);
  if (!signature) return undefined;
  return {
    graphics: createSignatureSilhouetteOverlayGraphics(scene, signature),
    attackPushMax: signature.attackPushMax,
  };
}

export const getUnitSilhouettePreviewScale = getStorySilhouettePreviewScale;
