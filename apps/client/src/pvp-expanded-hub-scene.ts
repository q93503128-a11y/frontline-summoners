import { PvpHubScene as BasePvpHubScene } from './pvp-scenes.ts';
import { addButton, addText } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

/**
 * Keeps ranked/casual 1v1 records while exposing every v1 PvP mode and
 * the server-ranked season surfaces from one hub. 2v2 ranked remains absent.
 */
export class PvpHubScene extends BasePvpHubScene {
  override create(): void {
    super.create();
    const compact = isCompactMobileViewport();
    this.add.rectangle(305, 552, 500, 90, 0x242c39, 1).setDepth(50);
    addText(this, 305, 520, '추가 대전 모드', compact ? 18 : 15, '#aebccd', 'center').setOrigin(0.5).setDepth(51);
    addButton(this, 145, 570, 150, compact ? 70 : 50, '1v1 친선', () => this.scene.start('pvp-friendly-lobby'), 0x735d87).setDepth(51);
    addButton(this, 305, 570, 150, compact ? 70 : 50, '2v2 일반', () => this.scene.start('pvp-2v2-matchmaking'), 0x5d748f).setDepth(51);
    addButton(this, 465, 570, 150, compact ? 70 : 50, '2v2 친선', () => this.scene.start('pvp-friendly-2v2-lobby'), 0x6d628d).setDepth(51);

    this.add.rectangle(950, 552, 510, 90, 0x252837, 1).setDepth(50);
    addText(this, 950, 520, '랭킹 · 시즌', compact ? 18 : 15, '#c9bddc', 'center').setOrigin(0.5).setDepth(51);
    addButton(this, 825, 570, 220, compact ? 70 : 50, '시즌 상세 · 전적', () => this.scene.start('pvp-season'), 0x665b7f).setDepth(51);
    addButton(this, 1075, 570, 220, compact ? 70 : 50, '랭킹 순위표', () => this.scene.start('pvp-leaderboard'), 0x607596).setDepth(51);
  }
}
