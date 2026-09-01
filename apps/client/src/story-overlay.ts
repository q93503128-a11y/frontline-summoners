import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { getClientSettings } from './client-settings';
import { addButton, addText, COLORS } from './scene-ui';
import type { StoryPresentation } from './story-content';
import { markStoryViewed, shouldPresentStory } from './story-progress';
import { isCompactMobileViewport } from './viewport';

export interface StoryOverlayHandle {
  readonly storyId: string;
  readonly active: boolean;
  dismiss(): void;
}

/**
 * Presents optional narrative without leaving the current scene. This is used by multiplayer lobbies/results
 * so WebSocket/session state can keep running while each client independently reads or skips the story.
 */
export function presentStoryOverlay(
  scene: Phaser.Scene,
  story: StoryPresentation | undefined,
  onFinished?: () => void,
): StoryOverlayHandle | null {
  if (!shouldPresentStory(story, getClientSettings().autoSkipStory)) return null;

  const compact = isCompactMobileViewport();
  const layer = scene.add.container(0, 0).setDepth(1000);
  const blocker = scene.add.rectangle(
    INTERNAL_WIDTH / 2,
    INTERNAL_HEIGHT / 2,
    INTERNAL_WIDTH,
    INTERNAL_HEIGHT,
    0x080b11,
    0.9,
  ).setInteractive();
  const panelWidth = compact ? 1080 : 960;
  const panelHeight = compact ? 430 : 360;
  const panelY = compact ? 380 : 375;
  const panel = scene.add.rectangle(INTERNAL_WIDTH / 2, panelY, panelWidth, panelHeight, 0x202735, 0.995)
    .setStrokeStyle(4, story.accent, 1);
  const accent = scene.add.rectangle(INTERNAL_WIDTH / 2, panelY - panelHeight / 2 + 7, panelWidth - 14, 10, story.accent, 0.86);
  layer.add([blocker, panel, accent]);

  const title = addText(scene, 78, 58, story.title, compact ? 39 : 35, COLORS.cream);
  const subtitle = addText(scene, 80, 108, story.subtitle, compact ? 21 : 18, '#aeb8c8');
  const localLabel = addText(
    scene,
    82,
    140,
    '로컬 스토리 · 다른 지휘관의 화면과 전투 판정에는 영향을 주지 않습니다.',
    compact ? 16 : 13,
    '#8391a4',
  );
  layer.add([title, subtitle, localLabel]);

  let beatIndex = 0;
  let active = true;
  let nextButton: Phaser.GameObjects.Container;
  const speaker = addText(scene, 190, compact ? 285 : 300, '', compact ? 25 : 21, '#f2d37c');
  const body = addText(scene, 190, compact ? 342 : 352, '', compact ? 30 : 26, '#ffffff').setWordWrapWidth(compact ? 900 : 820);
  const progress = addText(scene, 1095, compact ? 526 : 500, '', compact ? 19 : 16, '#8997aa', 'right').setOrigin(1, 0);
  layer.add([speaker, body, progress]);

  const keyboard = scene.input.keyboard;
  const finish = (): void => {
    if (!active) return;
    active = false;
    markStoryViewed(story.id);
    keyboard?.off('keydown-SPACE', advance);
    keyboard?.off('keydown-ENTER', advance);
    keyboard?.off('keydown-ESC', finish);
    layer.destroy(true);
    onFinished?.();
  };
  const renderBeat = (): void => {
    const beat = story.beats[beatIndex];
    if (!beat) {
      finish();
      return;
    }
    speaker.setText(beat.speaker);
    body.setText(beat.text);
    progress.setText(`${beatIndex + 1} / ${story.beats.length}`);
    const label = nextButton?.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
    label?.setText(beatIndex === story.beats.length - 1 ? '닫 기' : '다 음');
  };
  const advance = (): void => {
    if (!active) return;
    beatIndex += 1;
    if (beatIndex >= story.beats.length) {
      finish();
      return;
    }
    renderBeat();
  };

  const skipButton = addButton(scene, 1160, compact ? 78 : 68, compact ? 190 : 165, compact ? 82 : 54, '건너뛰기', finish, 0x765d67);
  nextButton = addButton(scene, 980, compact ? 590 : 560, compact ? 280 : 240, compact ? 88 : 62, '다 음', advance, story.accent);
  layer.add([skipButton, nextButton]);

  keyboard?.on('keydown-SPACE', advance);
  keyboard?.on('keydown-ENTER', advance);
  keyboard?.on('keydown-ESC', finish);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (!active) return;
    active = false;
    keyboard?.off('keydown-SPACE', advance);
    keyboard?.off('keydown-ENTER', advance);
    keyboard?.off('keydown-ESC', finish);
  });

  renderBeat();

  return {
    storyId: story.id,
    get active(): boolean { return active; },
    dismiss: finish,
  };
}
