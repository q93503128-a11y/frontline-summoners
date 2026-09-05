import { PvpHubScene as BasePvpHubScene } from './pvp-scenes.ts';
import { addButton, addCommandPanel, addSectionHeading, addText } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

/**
 * Keeps ranked/casual 1v1 records while exposing every currently implemented PvP mode and season surface.
 * 2v2 ranked remains intentionally absent.
 */
export class PvpHubScene extends BasePvpHubScene {
  override create(): void {
    super.create();
    const compact = isCompactMobileViewport();

    // Cover the base hub's old 2v2 placeholder copy: these modes are live now and must not look unavailable.
    this.add.rectangle(305, 548, 505, 104, 0x171f29, 1).setDepth(49);
    addCommandPanel(this, 305, 555, 510, 112, 0x667d94, 0x202a35, 0.99).setDepth(50);
    addSectionHeading(this, 72, 515, '친선 · 팀전', 465, 0x7187a0).setDepth(51);
    addText(this, 72, 542, '레이팅 변동 없는 친선전과 2v2 일반전을 선택한다.', compact ? 16 : 13, '#9fabb9').setDepth(51);
    addButton(this, 145, 584, 145, compact ? 72 : 50, '1v1 친선', () => this.scene.start('pvp-friendly-lobby'), 0x75628e, { tone: 'quiet' }).setDepth(51);
    addButton(this, 305, 584, 145, compact ? 72 : 50, '2v2 일반', () => this.scene.start('pvp-2v2-matchmaking'), 0x607f9e, { tone: 'primary' }).setDepth(51);
    addButton(this, 465, 584, 145, compact ? 72 : 50, '2v2 친선', () => this.scene.start('pvp-friendly-2v2-lobby'), 0x70668f, { tone: 'quiet' }).setDepth(51);

    this.add.rectangle(950, 548, 525, 104, 0x171d28, 1).setDepth(49);
    addCommandPanel(this, 950, 555, 530, 112, 0x7d6b8f, 0x242633, 0.99).setDepth(50);
    addSectionHeading(this, 705, 515, '랭킹 · 시즌', 490, 0x806f95).setDepth(51);
    addText(this, 705, 542, '랭킹전 기록, 시즌 진행과 순위표를 확인한다.', compact ? 16 : 13, '#aaa0bb').setDepth(51);
    addButton(this, 825, 584, 220, compact ? 72 : 50, '시즌 · 전적', () => this.scene.start('pvp-season'), 0x6a5f83, { tone: 'quiet' }).setDepth(51);
    addButton(this, 1075, 584, 220, compact ? 72 : 50, '랭킹 순위표', () => this.scene.start('pvp-leaderboard'), 0x657f9e, { tone: 'quiet' }).setDepth(51);
  }
}
