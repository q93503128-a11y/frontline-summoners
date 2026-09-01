import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { getClientSettings } from './client-settings';
import { getStoryPresentation, type StoryPresentation } from './story-content';
import { markStoryViewed } from './story-progress';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

export interface StorySceneData {
  readonly storyId: string;
  readonly nextScene: string;
  readonly nextData?: object;
}

export class StoryScene extends Phaser.Scene {
  private story!: StoryPresentation;
  private nextScene = 'stage-select';
  private nextData: object | undefined;
  private beatIndex = 0;
  private speakerText: Phaser.GameObjects.Text | undefined;
  private bodyText: Phaser.GameObjects.Text | undefined;
  private progressText: Phaser.GameObjects.Text | undefined;
  private continueButton: Phaser.GameObjects.Container | undefined;
  private finished = false;

  constructor() { super('story'); }

  init(data: StorySceneData): void {
    this.story = getStoryPresentation(data.storyId);
    this.nextScene = data.nextScene;
    this.nextData = data.nextData;
    this.beatIndex = 0;
    this.finished = false;
    this.speakerText = undefined;
    this.bodyText = undefined;
    this.progressText = undefined;
    this.continueButton = undefined;
  }

  create(): void {
    if (getClientSettings().autoSkipStory) {
      this.finish();
      return;
    }

    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    const panelWidth = compact ? 1080 : 980;
    const panelHeight = compact ? 410 : 350;
    const panelY = compact ? 390 : 385;

    this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x090d14, 0.36).setDepth(2);
    this.add.rectangle(INTERNAL_WIDTH / 2, panelY, panelWidth, panelHeight, 0x202735, 0.98)
      .setStrokeStyle(4, this.story.accent, 1).setDepth(3);
    this.add.rectangle(INTERNAL_WIDTH / 2, panelY - panelHeight / 2 + 6, panelWidth - 12, 9, this.story.accent, 0.82).setDepth(4);

    addText(this, 70, 46, this.story.title, compact ? 42 : 38, COLORS.cream).setDepth(5);
    addText(this, 72, 102, this.story.subtitle, compact ? 23 : 19, '#aeb8c8').setDepth(5);
    addText(this, 74, 137, '선택형 스토리 · 전투 규칙과 해금 정보는 시스템 UI에 별도 표시됩니다.', compact ? 17 : 14, '#7f8ca0').setDepth(5);

    addButton(this, 1168, compact ? 72 : 62, compact ? 188 : 160, compact ? 84 : 54, '건너뛰기', () => this.finish(), 0x765d67).setDepth(8);

    this.speakerText = addText(this, 185, compact ? 285 : 300, '', compact ? 25 : 21, '#f2d37c').setDepth(5);
    this.bodyText = addText(this, 185, compact ? 340 : 350, '', compact ? 31 : 27, '#ffffff').setDepth(5).setWordWrapWidth(compact ? 900 : 850);
    this.progressText = addText(this, 1090, compact ? 520 : 500, '', compact ? 19 : 16, '#8997aa', 'right').setOrigin(1, 0).setDepth(5);
    this.continueButton = addButton(this, 985, compact ? 590 : 560, compact ? 280 : 240, compact ? 88 : 62, '다 음', () => this.advance(), this.story.accent).setDepth(6);

    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.renderBeat();
  }

  private renderBeat(): void {
    const beat = this.story.beats[this.beatIndex];
    if (!beat) {
      this.finish();
      return;
    }
    this.speakerText?.setText(beat.speaker);
    this.bodyText?.setText(beat.text);
    this.progressText?.setText(`${this.beatIndex + 1} / ${this.story.beats.length}`);
    if (this.beatIndex === this.story.beats.length - 1) {
      const label = this.story.kind === 'CHAPTER_OUTRO' ? '돌아가기' : '전투로';
      const buttonText = this.continueButton?.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
      buttonText?.setText(label);
    }
  }

  private advance(): void {
    if (this.finished) return;
    this.beatIndex += 1;
    if (this.beatIndex >= this.story.beats.length) {
      this.finish();
      return;
    }
    this.renderBeat();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    markStoryViewed(this.story.id);
    this.scene.start(this.nextScene, this.nextData);
  }
}
