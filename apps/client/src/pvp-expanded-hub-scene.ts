import { PvpHubScene as BasePvpHubScene } from './pvp-scenes.ts';
import { addButton, addText } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

/**
 * Keeps the original ranked/casual hub intact while the wider PvP surface grows.
 * The lower action strip replaces the old placeholder copy with live v1 modes.
 */
export class PvpHubScene extends BasePvpHubScene {
  override create(): void {
    super.create();
    const compact = isCompactMobileViewport();
    const cover = this.add.rectangle(305, 552, 470, 72, 0x242c39, 1).setDepth(50);
    const label = addText(this, 305, 532, '추가 대전 모드', compact ? 18 : 15, '#aebccd', 'center').setOrigin(0.5).setDepth(51);
    const friendly = addButton(this, 205, 574, 190, compact ? 70 : 50, '1v1 친선전', () => this.scene.start('pvp-friendly-lobby'), 0x735d87).setDepth(51);
    const team = addButton(this, 405, 574, 190, compact ? 70 : 50, '2v2 일반전', () => this.scene.start('pvp-2v2-matchmaking'), 0x5d748f).setDepth(51);
    cover.setInteractive(false);
    label.setInteractive(false);
    friendly.setDepth(51);
    team.setDepth(51);
  }
}
