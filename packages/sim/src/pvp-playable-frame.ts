import type { BattleWinner } from './index.ts';
import {
  getPvp1v1CooldownRemaining,
  getPvp1v1WeaponCooldownRemaining,
  stepPvp1v1Battle,
  tryFirePvp1v1BaseWeapon,
  trySpawnPvp1v1Unit,
  tryUpgradePvp1v1Supply,
  type Pvp1v1BattleState,
  type Pvp1v1SideId,
} from './pvp-playable.ts';
import type { BaseWeaponId } from './playable.ts';
import type { PvpTimedResult } from './pvp-content.ts';

export type Pvp1v1Command =
  | { readonly type: 'SPAWN'; readonly slotId: string }
  | { readonly type: 'UPGRADE_SUPPLY' }
  | { readonly type: 'FIRE_BASE_WEAPON' };

export interface Pvp1v1CommandOutcome {
  readonly sideId: Pvp1v1SideId;
  readonly commandIndex: number;
  readonly command: Pvp1v1Command;
  readonly ok: boolean;
  readonly reason?: string;
  readonly simulationId?: number;
  readonly supplyLevel?: number;
  readonly baseWeaponReadyTick?: number;
}

export interface Pvp1v1CommittedFrame {
  readonly tick: number;
  readonly commands: Readonly<Record<Pvp1v1SideId, readonly Pvp1v1Command[]>>;
}

export interface Pvp1v1FrameResult {
  readonly state: Pvp1v1BattleState;
  readonly outcomes: readonly Pvp1v1CommandOutcome[];
}

export interface Pvp1v1Snapshot {
  readonly tick: number;
  readonly stateHash: string;
  readonly winner: BattleWinner;
  readonly timedResult: PvpTimedResult | null;
  readonly timeLimitFrames: number;
  readonly bases: {
    readonly aHp: number;
    readonly aMaxHp: number;
    readonly bHp: number;
    readonly bMaxHp: number;
    readonly aBaseDamageDealt: number;
    readonly bBaseDamageDealt: number;
  };
  readonly sides: readonly {
    readonly sideId: Pvp1v1SideId;
    readonly supply: number;
    readonly maxSupply: number;
    readonly supplyLevel: number;
    readonly nextSupplyUpgradeCost: number | null;
    readonly baseWeaponId: BaseWeaponId | null;
    readonly baseWeaponCooldownFrames: number;
    readonly costs: Readonly<Record<string, number>>;
    readonly cooldowns: Readonly<Record<string, number>>;
  }[];
  readonly units: readonly {
    readonly simulationId: number;
    readonly definitionId: string;
    readonly sideId: Pvp1v1SideId;
    readonly hp: number;
    readonly maxHp: number;
    readonly anchorX: number;
    readonly state: string;
  }[];
}

function applyCommand(
  state: Pvp1v1BattleState,
  sideId: Pvp1v1SideId,
  command: Pvp1v1Command,
  commandIndex: number,
): Pvp1v1CommandOutcome {
  if (command.type === 'SPAWN') {
    const result = trySpawnPvp1v1Unit(state, sideId, command.slotId);
    return result.ok
      ? { sideId, commandIndex, command, ok: true, simulationId: result.simulationId }
      : { sideId, commandIndex, command, ok: false, reason: result.reason };
  }
  if (command.type === 'UPGRADE_SUPPLY') {
    const result = tryUpgradePvp1v1Supply(state, sideId);
    return result.ok
      ? { sideId, commandIndex, command, ok: true, supplyLevel: result.level }
      : { sideId, commandIndex, command, ok: false, reason: result.reason };
  }
  const result = tryFirePvp1v1BaseWeapon(state, sideId);
  return result.ok
    ? { sideId, commandIndex, command, ok: true, baseWeaponReadyTick: result.readyTick }
    : { sideId, commandIndex, command, ok: false, reason: result.reason };
}

/**
 * Both players' accepted commands are applied before the combat tick advances.
 * Side order is stable only as a deterministic serialization rule; cross-side combat
 * still resolves in the common simultaneous-hit battle core on stepPvp1v1Battle().
 */
export function applyPvp1v1Frame(
  state: Pvp1v1BattleState,
  frame: Pvp1v1CommittedFrame,
): Pvp1v1FrameResult {
  if (frame.tick !== state.battle.tick) throw new Error(`pvp frame tick mismatch:${frame.tick}:${state.battle.tick}`);
  const outcomes: Pvp1v1CommandOutcome[] = [];
  for (const sideId of ['A', 'B'] as const) {
    const commands = frame.commands[sideId];
    for (let index = 0; index < commands.length; index += 1) {
      outcomes.push(applyCommand(state, sideId, commands[index]!, index));
    }
  }
  stepPvp1v1Battle(state);
  return { state, outcomes };
}

export function getPvp1v1Snapshot(state: Pvp1v1BattleState): Pvp1v1Snapshot {
  return {
    tick: state.battle.tick,
    stateHash: state.stateHash,
    winner: state.battle.winner,
    timedResult: state.timedResult,
    timeLimitFrames: state.timeLimitFrames,
    bases: {
      aHp: state.battle.bases.PLAYER.hp,
      aMaxHp: state.battle.bases.PLAYER.maxHp,
      bHp: state.battle.bases.ENEMY.hp,
      bMaxHp: state.battle.bases.ENEMY.maxHp,
      aBaseDamageDealt: state.aBaseDamageDealt,
      bBaseDamageDealt: state.bBaseDamageDealt,
    },
    sides: (['A', 'B'] as const).map((sideId) => {
      const side = state.sides[sideId];
      const current = side.supplyLevels[side.supplyLevel]!;
      const next = side.supplyLevels[side.supplyLevel + 1] ?? null;
      return {
        sideId,
        supply: side.supply,
        maxSupply: current.maxSupply,
        supplyLevel: side.supplyLevel + 1,
        nextSupplyUpgradeCost: next?.upgradeCost ?? null,
        baseWeaponId: side.baseWeapon.id ?? null,
        baseWeaponCooldownFrames: getPvp1v1WeaponCooldownRemaining(state, sideId),
        costs: Object.fromEntries(side.slots.map((slot) => [slot.slotId, slot.cost])),
        cooldowns: Object.fromEntries(side.slots.map((slot) => [slot.slotId, getPvp1v1CooldownRemaining(state, sideId, slot.slotId)])),
      };
    }),
    units: state.battle.units.map((unit) => ({
      simulationId: unit.simulationId,
      definitionId: unit.definition.id,
      sideId: unit.team === 'PLAYER' ? 'A' : 'B',
      hp: unit.hp,
      maxHp: unit.definition.maxHp,
      anchorX: unit.anchorX,
      state: unit.state,
    })),
  };
}
