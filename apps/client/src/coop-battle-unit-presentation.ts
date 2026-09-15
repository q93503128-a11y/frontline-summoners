import Phaser from 'phaser';
import type { CoopBattleSnapshot } from './coop-network.ts';
import { ENEMIES, getSlotById } from './prototype.ts';
import { addText, familyForUnit } from './scene-ui.ts';

type CoopUnit = CoopBattleSnapshot['units'][number];

function unitName(unit: CoopUnit): string {
  return getSlotById(unit.definitionId)?.displayName
    ?? ENEMIES.find((enemy) => enemy.enemyId === unit.definitionId)?.displayName
    ?? unit.definitionId;
}

/**
 * Renders co-op units with the same canonical art scale/tint contract as the solo battle.
 * Labels are deliberately positioned outside the resolved display bounds; no ownership/status
 * chrome is inserted over the character sprite.
 */
export function addCoopBattleUnitPresentation(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  unit: CoopUnit,
  x: number,
  y: number,
  compact: boolean,
): void {
  const player = unit.team === 'PLAYER';
  const label = player ? `${unit.ownerSeatId ?? '?'}·${unitName(unit)}` : unitName(unit);

  try {
    const art = familyForUnit(unit.definitionId);
    const strip = art.family.idle;
    const scale = (art.family.displayHeight / strip.frameHeight) * art.displayScale;
    const displayedHeight = strip.frameHeight * scale;
    const sprite = scene.add.sprite(x, y, strip.key, 0)
      .setTint(art.tint)
      .setFlipX(!player)
      .setScale(scale);
    layer.add(sprite);

    const labelY = y - displayedHeight / 2 - (compact ? 14 : 12);
    layer.add(addText(
      scene,
      x,
      labelY,
      label,
      compact ? 13 : 11,
      player ? '#cfeaff' : '#ffd1cc',
      'center',
    ).setOrigin(0.5));
    return;
  } catch {
    // Unknown content ids must not take down an online match. The fallback remains outside the
    // character-art contract because no character asset could be resolved for this id.
    layer.add(scene.add.circle(x, y, player ? 15 : 14, player ? 0x5f91bb : 0xb45f63, 1)
      .setStrokeStyle(2, 0xe8edf6, 0.6));
    layer.add(addText(scene, x, y - 30, label, compact ? 13 : 11, player ? '#cfeaff' : '#ffd1cc', 'center').setOrigin(0.5));
  }
}
