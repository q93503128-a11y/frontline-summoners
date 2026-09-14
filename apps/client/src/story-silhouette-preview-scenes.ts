/**
 * Legacy installation hook retained because main.ts and older tests import it.
 *
 * Character art is now an explicit clean room: UI/presentation code must not draw
 * silhouette guides, marks, stamps, outlines, or other graphics on top of unit
 * portraits. The previous implementation inserted Phaser.Graphics immediately
 * after deck/growth portrait sprites, which made the production art look drawn on.
 *
 * Keep this hook as a no-op so existing scene wiring stays stable while preventing
 * the overlay from returning through an accidental call site.
 */
export function installStorySilhouetteScenePreviews(): void {
  // Intentionally disabled. Character sprites must remain visually untouched.
}
