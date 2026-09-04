import Phaser from 'phaser';
import { isSecondSliceProductionReviewMode } from './second-slice-production-review-runtime.ts';

type SupportedTheme = 'canyon' | 'ruins';

const BATTLEFIELDS: Readonly<Record<SupportedTheme, {
  readonly baseKey: string;
  readonly baseUrl: string;
  readonly backgroundKey: string;
  readonly backgroundUrl: string;
  readonly foregroundKey: string;
  readonly foregroundUrl: string;
}>> = {
  canyon: {
    baseKey: 'second-slice-canyon-base',
    baseUrl: '/assets/production/battlefields/canyon/battlefield-base.svg',
    backgroundKey: 'second-slice-canyon-background',
    backgroundUrl: '/assets/production/battlefields/canyon/background-landmarks.svg',
    foregroundKey: 'second-slice-canyon-foreground',
    foregroundUrl: '/assets/production/battlefields/canyon/foreground-low-density.svg',
  },
  ruins: {
    baseKey: 'second-slice-ruins-base',
    baseUrl: '/assets/production/battlefields/ruins/battlefield-base.svg',
    backgroundKey: 'second-slice-ruins-background',
    backgroundUrl: '/assets/production/battlefields/ruins/background-landmarks.svg',
    foregroundKey: 'second-slice-ruins-foreground',
    foregroundUrl: '/assets/production/battlefields/ruins/foreground-low-density.svg',
  },
};

function supportedTheme(scene: Phaser.Scene): SupportedTheme | undefined {
  const theme=(scene as unknown as {stage?:{theme?:string}}).stage?.theme;
  return theme==='canyon'||theme==='ruins'?theme:undefined;
}

export function preloadSecondSliceProductionReviewBattlefields(scene: Phaser.Scene): void {
  if(!isSecondSliceProductionReviewMode())return;
  for(const entry of Object.values(BATTLEFIELDS)){
    for(const [key,url] of [[entry.baseKey,entry.baseUrl],[entry.backgroundKey,entry.backgroundUrl],[entry.foregroundKey,entry.foregroundUrl]] as const){
      if(!scene.textures.exists(key))scene.load.image(key,url);
    }
  }
}

export function renderSecondSliceProductionReviewBattlefields(scene: Phaser.Scene): void {
  if(!isSecondSliceProductionReviewMode())return;
  const theme=supportedTheme(scene);if(!theme)return;
  const entry=BATTLEFIELDS[theme];
  if(scene.textures.exists(entry.baseKey))scene.add.image(640,360,entry.baseKey).setDisplaySize(1280,720).setDepth(0).setName(entry.baseKey);
  if(scene.textures.exists(entry.backgroundKey))scene.add.image(640,360,entry.backgroundKey).setDisplaySize(1280,720).setDepth(.4).setName(entry.backgroundKey);
  if(scene.textures.exists(entry.foregroundKey))scene.add.image(640,360,entry.foregroundKey).setDisplaySize(1280,720).setDepth(2.4).setName(entry.foregroundKey);
}
