import { SIM_TICK_MS } from '@frontline/sim';
import {
  captureCombatQuirkFrame,
  resolveCombatQuirkFacts,
  type CombatQuirkFactId,
} from '@frontline/sim/combat-quirk-attribution';
import {
  stepBossRushRecordBattle,
  stepEndlessRecordBattle,
  type BossRushRecordState,
  type EndlessRecordState,
} from '@frontline/sim/record-playable';
import { recordGuestAchievementFact } from './achievement-profile.ts';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress.ts';
import { AccessibleRecordBattleScene as RecordBattleScene } from './accessible-record-battle-scene.ts';
import { addText } from './scene-ui.ts';
import { isPortraitMobileViewport } from './viewport.ts';

type RecordRuntime = EndlessRecordState | BossRushRecordState;

interface RecordBattleInternals {
  runtime: RecordRuntime;
  authority: ActiveProgressAuthority;
  accumulator: number;
  ready: boolean;
  resolved: boolean;
  manuallyPaused: boolean;
  syncEnemyDiscoveries(): void;
  syncBossWarnings(): void;
  syncUnits(): void;
  syncHud(): void;
  finishRecord(): void;
}

const QUIRK_NAMES: Readonly<Record<CombatQuirkFactId, string>> = {
  quirk_turnip_five: '순무 행진',
  quirk_duck_mech_finish: '태엽 대 기계',
  quirk_bellcrab_multi: '울려라 종껍질',
};

/** Record-mode companion to QuirkBattleScene. Simulation order remains unchanged. */
export class QuirkRecordBattleScene extends RecordBattleScene {
  private seenCombatQuirkFacts = new Set<CombatQuirkFactId>();
  private quirkToast: Phaser.GameObjects.Text | undefined;

  override init(data: { modeId?: 'record_endless_front' | 'record_boss_rush' }): void {
    super.init(data);
    this.seenCombatQuirkFacts.clear();
    this.quirkToast = undefined;
  }

  override update(_: number, delta: number): void {
    const state = this as unknown as RecordBattleInternals;
    if (!state.ready || state.resolved || state.manuallyPaused || isPortraitMobileViewport()) return;
    state.accumulator += Math.min(delta, 120);
    while (state.accumulator >= SIM_TICK_MS && !state.runtime.ended) {
      const capture = captureCombatQuirkFrame(state.runtime.battle.battle);
      if (state.runtime.mode === 'ENDLESS_FRONT') stepEndlessRecordBattle(state.runtime);
      else stepBossRushRecordBattle(state.runtime);
      this.registerCombatQuirkFacts(resolveCombatQuirkFacts(capture, state.runtime.battle.battle), state.authority);
      state.accumulator -= SIM_TICK_MS;
    }
    state.syncEnemyDiscoveries();
    state.syncBossWarnings();
    state.syncUnits();
    state.syncHud();
    if (state.runtime.ended) state.finishRecord();
  }

  private registerCombatQuirkFacts(facts: readonly CombatQuirkFactId[], authority: ActiveProgressAuthority): void {
    for (const factId of facts) {
      if (this.seenCombatQuirkFacts.has(factId)) continue;
      this.seenCombatQuirkFacts.add(factId);
      this.showQuirkToast(factId, authority === 'ACCOUNT_ONLINE');
      if (authority !== 'GUEST_LOCAL') continue;
      void loadActiveProgress().then((view) => {
        if (view.authority !== 'GUEST_LOCAL') return;
        recordGuestAchievementFact(view.progress, factId);
      }).catch(() => undefined);
    }
  }

  private showQuirkToast(factId: CombatQuirkFactId, pendingServerVerification: boolean): void {
    this.quirkToast?.destroy();
    const suffix = pendingServerVerification ? ' · 서버 검증 대기' : '';
    this.quirkToast = addText(
      this,
      640,
      116,
      `숨겨진 도전 · ${QUIRK_NAMES[factId]}${suffix}`,
      18,
      '#f1d58a',
      'center',
    ).setOrigin(0.5).setDepth(120);
    this.time.delayedCall(2400, () => {
      if (!this.scene.isActive() || !this.quirkToast) return;
      this.quirkToast.destroy();
      this.quirkToast = undefined;
    });
  }
}
