import Phaser from 'phaser';
import { isFourthSliceProductionReviewMode } from './fourth-slice-production-review-runtime.ts';

type SupportedTheme='meadow'|'fortress'|'golden'|'canyon'|'moon';
type Entry={readonly baseKey:string;readonly baseUrl:string;readonly backgroundKey:string;readonly backgroundUrl:string;readonly foregroundKey:string;readonly foregroundUrl:string;};
const make=(theme:SupportedTheme):Entry=>({
  baseKey:`fourth-slice-${theme}-base`,baseUrl:`/assets/production/battlefields/${theme}/battlefield-base.svg`,
  backgroundKey:`fourth-slice-${theme}-background`,backgroundUrl:`/assets/production/battlefields/${theme}/background-landmarks.svg`,
  foregroundKey:`fourth-slice-${theme}-foreground`,foregroundUrl:`/assets/production/battlefields/${theme}/foreground-low-density.svg`,
});
const BATTLEFIELDS:Readonly<Record<SupportedTheme,Entry>>={meadow:make('meadow'),fortress:make('fortress'),golden:make('golden'),canyon:make('canyon'),moon:make('moon')};
function supportedTheme(scene:Phaser.Scene):SupportedTheme|undefined{const theme=(scene as unknown as{stage?:{theme?:string}}).stage?.theme;return theme==='meadow'||theme==='fortress'||theme==='golden'||theme==='canyon'||theme==='moon'?theme:undefined;}
export function preloadFourthSliceProductionReviewBattlefields(scene:Phaser.Scene):void{if(!isFourthSliceProductionReviewMode())return;for(const entry of Object.values(BATTLEFIELDS)){for(const [key,url] of [[entry.baseKey,entry.baseUrl],[entry.backgroundKey,entry.backgroundUrl],[entry.foregroundKey,entry.foregroundUrl]] as const){if(!scene.textures.exists(key))scene.load.image(key,url);}}}
export function renderFourthSliceProductionReviewBattlefields(scene:Phaser.Scene):void{if(!isFourthSliceProductionReviewMode())return;const theme=supportedTheme(scene);if(!theme)return;const entry=BATTLEFIELDS[theme];if(scene.textures.exists(entry.baseKey))scene.add.image(640,360,entry.baseKey).setDisplaySize(1280,720).setDepth(0).setName(entry.baseKey);if(scene.textures.exists(entry.backgroundKey))scene.add.image(640,360,entry.backgroundKey).setDisplaySize(1280,720).setDepth(.4).setName(entry.backgroundKey);if(scene.textures.exists(entry.foregroundKey))scene.add.image(640,360,entry.foregroundKey).setDisplaySize(1280,720).setDepth(2.4).setName(entry.foregroundKey);}
