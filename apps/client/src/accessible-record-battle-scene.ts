import { installAccessibleBattleCameraFeedback } from './battle-camera-feedback';
import { RecordBattleScene } from './record-battle-scene';

/** Record-mode presentation bridge using the same shake/flash policy as standard battles. */
export class AccessibleRecordBattleScene extends RecordBattleScene {
  override create(): void {
    installAccessibleBattleCameraFeedback(this);
    super.create();
  }
}
