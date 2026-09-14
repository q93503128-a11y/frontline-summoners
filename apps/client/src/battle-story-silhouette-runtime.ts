import Phaser from 'phaser';

/**
 * Character art is a strict clean room during UI/UX work.
 *
 * This legacy battle installer intentionally does nothing. Battlefield UI must never attach
 * graphics, guides, marks, tint, scale adjustments, or any other presentation object to a
 * character/enemy sprite. Character presentation changes belong to the separate art pipeline.
 */
export function installStorySilhouetteOverlayRuntime(_scene: Phaser.Scene): void {
  // Intentionally empty.
}
