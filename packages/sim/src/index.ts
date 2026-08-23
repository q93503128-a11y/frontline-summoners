import { SIM_TICK_RATE } from '@frontline/shared';

export { SIM_TICK_RATE };

export const SIM_TICK_MS = 1000 / SIM_TICK_RATE;

export enum UnitState {
  Moving = 'MOVING',
  Foreswing = 'FORESWING',
  Backswing = 'BACKSWING',
  AttackWait = 'ATTACK_WAIT',
  NaturalKnockback = 'NATURAL_KNOCKBACK',
  ForcedDisplacement = 'FORCED_DISPLACEMENT',
  Dying = 'DYING',
}

export const TICK_PHASES = [
  'INPUT',
  'TIMERS_AND_ECONOMY',
  'SPAWN',
  'MOVEMENT',
  'DETECTION_AND_TRANSITIONS',
  'COLLECT_HITS',
  'APPLY_DAMAGE_AND_EFFECTS',
  'RESOLVE_KNOCKBACK_DISPLACEMENT_DEATH',
  'REMOVE_AND_RESOLVE_VICTORY',
  'STATE_HASH',
] as const;

export type TickPhase = (typeof TICK_PHASES)[number];

export interface SimulationIdentity {
  readonly simulationId: number;
}

export interface BattleUnitState extends SimulationIdentity {
  readonly unitId: string;
  hp: number;
  anchorX: number;
  state: UnitState;
  stateFrame: number;
  naturalKnockbacksRemaining: number;
}
