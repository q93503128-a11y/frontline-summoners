import type {
  AccountTrustedBattleCommand,
  AccountTrustedBattleCompletion,
  AccountTrustedBattleKind,
} from './account-network.ts';

export interface TrustedBattleTerminalProof {
  readonly battleId: string;
  readonly kind: AccountTrustedBattleKind;
  readonly targetId: string;
  readonly commands: readonly AccountTrustedBattleCommand[];
  readonly localWinner: 'PLAYER' | 'ENEMY' | 'DRAW';
  readonly localClearFrames: number;
  readonly localFinalStateHash: string;
  readonly localPlayerBaseHp: number;
  readonly localEnemyBaseHp: number;
}

export function assertTrustedCompletionMatchesLocal(
  proof: TrustedBattleTerminalProof,
  completion: AccountTrustedBattleCompletion,
): void {
  if (completion.battleId !== proof.battleId) throw new Error('trusted battle completion battleId mismatch');
  if (completion.kind !== proof.kind) throw new Error('trusted battle completion kind mismatch');
  if (completion.targetId !== proof.targetId) throw new Error('trusted battle completion target mismatch');
  if (completion.winner !== proof.localWinner) throw new Error('trusted battle completion winner mismatch');
  if (completion.clearFrames !== proof.localClearFrames) throw new Error('trusted battle completion frame mismatch');
  if (completion.finalStateHash !== proof.localFinalStateHash) throw new Error('trusted battle completion final state hash mismatch');
  if (completion.playerBaseHp !== proof.localPlayerBaseHp) throw new Error('trusted battle completion player base HP mismatch');
  if (completion.enemyBaseHp !== proof.localEnemyBaseHp) throw new Error('trusted battle completion enemy base HP mismatch');
}
