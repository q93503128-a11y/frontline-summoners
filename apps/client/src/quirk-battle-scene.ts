import { SIM_TICK_MS } from '@frontline/sim';
import {
  captureCombatQuirkFrame,
  resolveCombatQuirkFacts,
  type CombatQuirkFactId,
} from '@frontline/sim/combat-quirk-attribution';
import { stepPlayableBattle, type PlayableBattleState } from '@frontline/sim/playable';
import type { AccountTrustedBattleStart } from './account-network.ts';
import { recordGuestAchievementFact } from './achievement-profile.ts';
import { loadActiveProgress } from './active-progress.ts';
import { BattleScene } from './battle-scene.ts';
import { addText } from './scene-ui.ts';
import type { TrustedBattleTerminalProof } from './trusted-battle-result.ts';
import { isPortraitMobileViewport } from './viewport.ts';

interface BattleSceneInternals {
  state: PlayableBattleState;
  accumulator: number;
  ready: boolean;
  resolved: boolean;
  manuallyPaused: boolean;
  battleAuthority: 'GUEST_LOCAL' | 'ACCOUNT_TRUSTED';
  trustedStart?: AccountTrustedBattleStart;
  trustedRecorder?: { seal(): readonly { readonly tick: number; readonly type: 'SPAWN' | 'UPGRADE_SUPPLY' | 'FIRE_BASE_WEAPON'; readonly slotId?: string }[] };
  syncProjectileLaunches(): void;
  syncEnemyDiscoveries(): void;
  syncBossWarnings(): void;
  syncProjectileViews(): void;
  syncUnits(): void;
  syncHud(): void;
}

const QUIRK_NAMES: Readonly<Record<CombatQuirkFactId, string>> = {
  quirk_turnip_five: '순무 행진',
  quirk_duck_mech_finish: '태엽 대 기계',
  quirk_bellcrab_multi: '울려라 종껍질',
};

/**
 * Adds deterministic hidden-achievement observation around the exact same playable step used by BattleScene.
 * It does not change simulation state or command logging.
 */
export class QuirkBattleScene extends BattleScene {
  private seenCombatQuirkFacts = new Set<CombatQuirkFactId>();
  private quirkToast: Phaser.GameObjects.Text | undefined;

  override init(data: { stageId?: string }): void {
    super.init(data);
    this.seenCombatQuirkFacts.clear();
    this.quirkToast = undefined;
  }

  override update(_: number, delta: number): void {
    const state = this as unknown as BattleSceneInternals;
    if (!state.ready || state.resolved || state.manuallyPaused || isPortraitMobileViewport()) return;
    state.accumulator += Math.min(delta, 120);
    while (state.accumulator >= SIM_TICK_MS && state.state.battle.winner === null) {
      state.syncProjectileLaunches();
      const capture = captureCombatQuirkFrame(state.state.battle);
      stepPlayableBattle(state.state);
      this.registerCombatQuirkFacts(resolveCombatQuirkFacts(capture, state.state.battle), state.battleAuthority);
      state.accumulator -= SIM_TICK_MS;
    }
    state.syncEnemyDiscoveries();
    state.syncBossWarnings();
    state.syncProjectileViews();
    state.syncUnits();
    state.syncHud();
    if (state.state.battle.winner !== null) {
      state.resolved = true;
      const winner = state.state.battle.winner;
      if (state.battleAuthority === 'ACCOUNT_TRUSTED') {
        const start = state.trustedStart;
        const recorder = state.trustedRecorder;
        if (!start || !recorder) throw new Error('trusted battle terminal state is missing ticket or recorder');
        const proof: TrustedBattleTerminalProof = {
          battleId: start.battleId,
          kind: start.kind,
          targetId: start.targetId,
          commands: recorder.seal() as TrustedBattleTerminalProof['commands'],
          localWinner: winner,
          localClearFrames: state.state.battle.tick,
          localFinalStateHash: state.state.stateHash,
          localPlayerBaseHp: state.state.battle.bases.PLAYER.hp,
          localEnemyBaseHp: state.state.battle.bases.ENEMY.hp,
        };
        this.time.delayedCall(700, () => this.scene.start('trusted-result', { proof }));
      } else {
        this.time.delayedCall(700, () => this.scene.start('result', { stageId: (this as unknown as { stage: { id: string } }).stage.id, winner }));
      }
    }
  }

  private registerCombatQuirkFacts(facts: readonly CombatQuirkFactId[], authority: BattleSceneInternals['battleAuthority']): void {
    for (const factId of facts) {
      if (this.seenCombatQuirkFacts.has(factId)) continue;
      this.seenCombatQuirkFacts.add(factId);
      this.showQuirkToast(factId, authority === 'ACCOUNT_TRUSTED');
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
