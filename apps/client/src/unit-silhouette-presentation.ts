import Phaser from 'phaser';
import { createFirstSliceReworkOverlayGraphics } from './first-slice-rework-renderer.ts';
import { getFirstSliceReworkOverlaySpec } from './first-slice-rework-overlays.ts';
import { getSignatureSilhouetteOverlaySpec } from './common-silhouette-overlays.ts';
import { createSignatureSilhouetteOverlayGraphics } from './common-silhouette-renderer.ts';
import { getLateEnemySilhouetteSpec } from './late-enemy-silhouette-overlays.ts';
import { createLateEnemySilhouetteGraphics } from './late-enemy-silhouette-renderer.ts';
import { getPremiumRecruitSilhouetteSpec } from './premium-recruit-silhouette-overlays.ts';
import { createPremiumRecruitSilhouetteGraphics } from './premium-recruit-silhouette-renderer.ts';
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
 * Resolves presentation-only silhouette scaffolding across the first production slice, story forms,
 * recruitment units, and campaign/special enemies. Production-art authority remains in production-assets.ts.
 */
export function createUnitSilhouettePresentation(
  scene: Phaser.Scene,
  unitId: string,
  resolvedFormId?: string,
): UnitSilhouettePresentation | undefined {
  const firstSlice = getFirstSliceReworkOverlaySpec(unitId, resolvedFormId);
  if (firstSlice) {
    return {
      graphics: createFirstSliceReworkOverlayGraphics(scene, firstSlice),
      attackPushMax: firstSlice.attackPushMax,
    };
  }

  const story = getStorySilhouetteOverlaySpec(unitId, resolvedFormId);
  if (story) {
    return {
      graphics: createStorySilhouetteOverlayGraphics(scene, story),
      attackPushMax: story.kind === 'LANCER_SPEAR' || story.kind === 'HUNTER_POLEARM' ? 8 : 4,
    };
  }

  const premium = getPremiumRecruitSilhouetteSpec(unitId, resolvedFormId);
  if (premium) {
    return {
      graphics: createPremiumRecruitSilhouetteGraphics(scene, premium),
      attackPushMax: premium.attackPushMax,
    };
  }

  const signature = getSignatureSilhouetteOverlaySpec(unitId, resolvedFormId);
  if (signature) {
    return {
      graphics: createSignatureSilhouetteOverlayGraphics(scene, signature),
      attackPushMax: signature.attackPushMax,
    };
  }

  const lateEnemy = getLateEnemySilhouetteSpec(unitId);
  if (!lateEnemy) return undefined;
  return {
    graphics: createLateEnemySilhouetteGraphics(scene, lateEnemy),
    attackPushMax: lateEnemy.attackPushMax,
  };
}

export const getUnitSilhouettePreviewScale = getStorySilhouettePreviewScale;
