import { installAccessibleBattleCameraFeedback } from './battle-camera-feedback';
import { installBattleVfxDensityPolicy } from './battle-vfx-density';
import { installRecordCommandHud } from './record-command-hud.ts';
import { RecordBattleScene } from './record-battle-scene';

/** Record-mode presentation bridge using the same accessibility policy and command language as standard battles. */
export class AccessibleRecordBattleScene extends RecordBattleScene {
  override create(): void {
    installAccessibleBattleCameraFeedback(this);
    installBattleVfxDensityPolicy(this);
    installRecordCommandHud(this);
    super.create();
  }
}
