import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { FIRST_RECRUITMENT_BANNER, RECRUITMENT_UNITS } from './recruitment';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

export class RecruitmentScene extends Phaser.Scene {
  constructor() { super('recruitment'); }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    addText(this, 56, 40, '모집', 48, COLORS.cream);
    addText(this, 56, 105, FIRST_RECRUITMENT_BANNER.name, compact ? 30 : 28, '#ffffff');
    addText(this, 56, 150, FIRST_RECRUITMENT_BANNER.description, 18, COLORS.muted);

    addText(this, 70, 235, '확률', 24, '#ffe29a');
    let y = 280;
    for (const rarity of ['C', 'B', 'A', 'S', 'SS'] as const) {
      addText(this, 90, y, `${rarity} · ${FIRST_RECRUITMENT_BANNER.ratesPermille[rarity] / 10}%`, 22, '#ffffff');
      y += 38;
    }

    addText(this, 560, 235, `모집 풀 ${RECRUITMENT_UNITS.length}종`, 24, '#ffe29a');
    addText(this, 560, 280, '10회: A 이상 보장', 20, '#ffffff');
    addText(this, 560, 320, '30회: S 이상 보장', 20, '#ffffff');
    addText(this, 560, 360, '60회: 픽업 SS 보장', 20, '#ffffff');
    addText(this, 560, 400, '100회: 선택권', 20, '#ffffff');

    addButton(this, 930, 560, 260, compact ? 84 : 70, '1회 모집', () => {}, 0xc5a04c);
    addButton(this, 930, 650, 260, compact ? 84 : 70, '10회 모집', () => {}, 0x8b6fb5);
    addButton(this, 1160, 70, 150, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);
  }
}
