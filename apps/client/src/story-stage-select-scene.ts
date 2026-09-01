import Phaser from 'phaser';
import { getClientSettings } from './client-settings';
import { getStage } from './prototype';
import { StageSelectScene } from './stage-select-scene';
import { getPreStageStory } from './story-content';
import { shouldPresentStory } from './story-progress';

type SceneStart = Phaser.Scenes.ScenePlugin['start'];

type SortieSceneData = { readonly stageId?: unknown };

function stageIdFromData(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;
  const stageId = (data as SortieSceneData).stageId;
  return typeof stageId === 'string' ? stageId : undefined;
}

/**
 * Adds stage-context sortie routing in front of solo MAIN/SPECIAL entry without changing StageSelectScene's
 * unlock/formation/sweep authority. SOLO_OR_COOP stages open the sortie-mode picker; solo-only stages keep
 * the direct optional narrative route.
 */
export class StoryStageSelectScene extends StageSelectScene {
  override create(): void {
    const originalStart = this.scene.start.bind(this.scene) as SceneStart;
    const scenePlugin = this.scene;

    scenePlugin.start = ((key: string, data?: object) => {
      if (key === 'battle') {
        const stageId = stageIdFromData(data);
        if (stageId) {
          const stage = getStage(stageId);
          if (stage.multiplayerPolicy === 'SOLO_OR_COOP') {
            return originalStart('sortie-mode', { stageId });
          }
        }
        const story = stageId ? getPreStageStory(stageId) : undefined;
        if (story && shouldPresentStory(story, getClientSettings().autoSkipStory)) {
          const storyData = data === undefined
            ? { storyId: story.id, nextScene: 'battle' }
            : { storyId: story.id, nextScene: 'battle', nextData: data };
          return originalStart('story', storyData);
        }
      }
      return originalStart(key, data);
    }) as SceneStart;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scenePlugin.start = originalStart;
    });

    super.create();
  }
}
