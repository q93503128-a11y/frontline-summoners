import Phaser from 'phaser';
import { getClientSettings } from './client-settings';
import { getStage } from './prototype';
import { StageSelectScene } from './stage-select-scene';
import { getPreStageStory } from './story-content';
import { shouldPresentStory } from './story-progress';

type SceneStart = Phaser.Scenes.ScenePlugin['start'];
type SortieSceneData = { readonly stageId?: unknown };
type StageSelectPresentationCarrier = Phaser.Scene & {
  renderPage?: () => void;
};

function stageIdFromData(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;
  const stageId = (data as SortieSceneData).stageId;
  return typeof stageId === 'string' ? stageId : undefined;
}

function rewriteStageText(value: string | string[]): string | string[] {
  if (Array.isArray(value)) return value.map((entry) => rewriteStageLine(entry));
  return rewriteStageLine(value);
}

function rewriteStageLine(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '특수 전선 · 해금 조건과 반복 보상을 확인하고 전장을 선택한다.': '특수 전선 · 해금과 반복 보상을 확인합니다.',
    '진행선을 따라 다음 전장을 선택한다. 완료한 전장은 다시 도전하거나 소탕할 수 있다.': '전장을 선택하고 출정합니다. 완료 전장은 재도전·소탕할 수 있습니다.',
    '진행 정보를 불러오는 중…': '전선 기록 확인 중…',
    '전장을 선택하면 상세 작전 정보가 표시됩니다.': '전장을 선택하세요.',
    '전선 진행': '작전선',
    '출현 적 확인': '출현 적',
    '출정 방식 선택': '출정 선택',
    '오프라인 계정 · 전투와 소탕은 온라인 복구 후 가능': '오프라인 계정 · 전투·소탕은 온라인 연결 후 가능합니다.',
  };
  return direct[value] ?? value;
}

/**
 * Adds stage-context sortie routing and a presentation pass without changing StageSelectScene's
 * unlock, formation, reward, sweep, or enemy-discovery authority.
 */
export class StoryStageSelectScene extends StageSelectScene {
  override create(): void {
    const originalStart = this.scene.start.bind(this.scene) as SceneStart;
    const scenePlugin = this.scene;
    const factory = this.add;
    const originalText = factory.text;

    factory.text = ((x, y, value, style) => {
      const text = originalText.call(factory, x, y, rewriteStageText(value), style);
      const originalSetText = text.setText.bind(text);
      text.setText = ((next: string | string[]) => originalSetText(rewriteStageText(next))) as typeof text.setText;
      return text;
    }) as typeof factory.text;

    scenePlugin.start = ((key: string, data?: object) => {
      if (key === 'battle') {
        const stageId = stageIdFromData(data);
        if (stageId) {
          const stage = getStage(stageId);
          if (stage.multiplayerPolicy === 'SOLO_OR_COOP') return originalStart('sortie-mode', { stageId });
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

    super.create();
    const restoreRender = this.installStagePolish();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scenePlugin.start = originalStart;
      factory.text = originalText;
      restoreRender?.();
    });
  }

  private installStagePolish(): (() => void) | undefined {
    const carrier = this as unknown as StageSelectPresentationCarrier;
    const originalRender = carrier.renderPage;
    const apply = (): void => this.polishStageGeometry();
    if (!originalRender) {
      apply();
      return undefined;
    }
    carrier.renderPage = () => {
      originalRender.call(this);
      apply();
    };
    apply();
    return () => { carrier.renderPage = originalRender; };
  }

  private polishStageGeometry(): void {
    const visit = (object: Phaser.GameObjects.GameObject): void => {
      if (object instanceof Phaser.GameObjects.Rectangle && object.width >= 1100 && object.height >= 300) {
        object.setFillStyle(0x18212a, 0.92).setStrokeStyle(1, 0x5d6e80, 0.45);
      }
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
    };
    this.children.list.forEach(visit);
  }
}
