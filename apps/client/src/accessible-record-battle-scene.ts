import { installAccessibleBattleCameraFeedback } from './battle-camera-feedback';
import { installBattleVfxDensityPolicy } from './battle-vfx-density';
import { RecordBattleScene } from './record-battle-scene';

/** Record-mode presentation bridge using the same shake/flash/VFX policy as standard battles. */
export class AccessibleRecordBattleScene extends RecordBattleScene {
  override create(): void {
    installAccessibleBattleCameraFeedback(this);
    installBattleVfxDensityPolicy(this);
    super.create();
  }
}
