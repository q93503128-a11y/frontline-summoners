import Phaser from 'phaser';
import { isFirstSliceProductionReviewMode } from './first-slice-production-review-runtime.ts';

const LAYERS = [
  {
    key: 'production-review-meadow-landmarks',
    url: '/assets/production/battlefields/meadow/background-landmarks.svg',
    depth: 0.4,
  },
  {
    key: 'production-review-meadow-foreground',
    url: '/assets/production/battlefields/meadow/foreground-low-density.svg',
    depth: 2.4,
  },
] as const;

export function preloadFirstSliceProductionReviewMeadowLayers(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  for (const layer of LAYERS) {
    if (!scene.textures.exists(layer.key)) scene.load.image(layer.key, layer.url);
  }
}

export function renderFirstSliceProductionReviewMeadowLayers(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  const stage = (scene as unknown as { stage?: { theme?: string } }).stage;
  if (stage?.theme !== 'meadow') return;
  for (const layer of LAYERS) {
    if (!scene.textures.exists(layer.key)) continue;
    scene.add.image(640, 360, layer.key)
      .setDisplaySize(1280, 720)
      .setDepth(layer.depth)
      .setName(layer.key);
  }
}
