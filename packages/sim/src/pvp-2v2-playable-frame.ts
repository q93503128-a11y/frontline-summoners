import type { BattleWinner } from './index.ts';
import type { BaseWeaponId } from './playable.ts';
import type { PvpTimedResult } from './pvp-content.ts';
import {
  PVP_2V2_SEAT_IDS,
  getPvp2v2CooldownRemaining,
  getPvp2v2SeatTeamId,
  getPvp2v2WeaponCooldownRemaining,
  stepPvp2v2Battle,
  tryFirePvp2v2BaseWeapon,
  trySpawnPvp2v2Unit,
  tryUpgradePvp2v2Supply,
  type Pvp2v2BattleState,
  type Pvp2v2SeatId,
  type Pvp2v2TeamId,
} from './pvp-2v2-playable.ts';

export type Pvp2v2Command =
  | { readonly type: 'SPAWN'; readonly slotId: string }
  | { readonly type: 'UPGRADE_SUPPLY' }
  | { readonly type: 'FIRE_BASE_WEAPON' };

export interface Pvp2v2CommittedFrame {
  readonly tick: number;
  readonly commands: Readonly<Record<Pvp2v2SeatId, readonly Pvp2v2Command[]>>;
}

export interface Pvp2v2CommandOutcome {
  readonly seatId: Pvp2v2SeatId;
  readonly commandIndex: number;
  readonly command: Pvp2v2Command;
  readonly ok: boolean;
  readonly reason?: string;
  readonly simulationId?: number;
  readonly supplyLevel?: number;
  readonly baseWeaponReadyTick?: number;
}

export interface Pvp2v2Snapshot {
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
  readonly teams: readonly {
    readonly teamId: Pvp2v2TeamId;
    readonly unitCap: number;
    readonly aliveUnits: number;
    readonly baseWeaponId: BaseWeaponId | null;
    readonly baseWeaponCooldownFrames: number;
    readonly baseWeaponLastActivatedSeatId: Pvp2v2SeatId | null;
  }[];
  readonly seats: readonly {
    readonly seatId: Pvp2v2SeatId;
    readonly teamId: Pvp2v2TeamId;
    readonly supply: number;
    readonly maxSupply: number;
    readonly supplyLevel: number;
    readonly nextSupplyUpgradeCost: number | null;
    readonly costs: Readonly<Record<string, number>>;
    readonly cooldowns: Readonly<Record<string, number>>;
  }[];
  readonly units: readonly {
    readonly simulationId: number;
    readonly definitionId: string;
    readonly teamId: Pvp2v2TeamId;
    readonly ownerSeatId?: Pvp2v2SeatId;
    readonly hp: number;
    readonly maxHp: number;
    readonly anchorX: number;
    readonly state: string;
  }[];
}

function applyCommand(state: Pvp2v2BattleState, seatId: Pvp2v2SeatId, command: Pvp2v2Command, commandIndex: number): Pvp2v2CommandOutcome {
  if (command.type === 'SPAWN') {
    const result = trySpawnPvp2v2Unit(state, seatId, command.slotId);
    return result.ok ? { seatId, commandIndex, command, ok: true, simulationId: result.simulationId } : { seatId, commandIndex, command, ok: false, reason: result.reason };
  }
  if (command.type === 'UPGRADE_SUPPLY') {
    const result = tryUpgradePvp2v2Supply(state, seatId);
    return result.ok ? { seatId, commandIndex, command, ok: true, supplyLevel: result.level } : { seatId, commandIndex, command, ok: false, reason: result.reason };
  }
  const result = tryFirePvp2v2BaseWeapon(state, seatId);
  return result.ok ? { seatId, commandIndex, command, ok: true, baseWeaponReadyTick: result.readyTick } : { seatId, commandIndex, command, ok: false, reason: result.reason };
}

export function applyPvp2v2Frame(state: Pvp2v2BattleState, frame: Pvp2v2CommittedFrame): { readonly state: Pvp2v2BattleState; readonly outcomes: readonly Pvp2v2CommandOutcome[] } {
  if (frame.tick !== state.battle.tick) throw new Error(`pvp 2v2 frame tick mismatch:${frame.tick}:${state.battle.tick}`);
  const outcomes: Pvp2v2CommandOutcome[] = [];
  for (const seatId of PVP_2V2_SEAT_IDS) {
    const commands = frame.commands[seatId];
    for (let index = 0; index < commands.length; index += 1) outcomes.push(applyCommand(state, seatId, commands[index]!, index));
  }
  stepPvp2v2Battle(state);
  return { state, outcomes };
}

export function getPvp2v2Snapshot(state: Pvp2v2BattleState): Pvp2v2Snapshot {
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
    teams: (['A', 'B'] as const).map((teamId) => {
      const teamState = state.teams[teamId];
      return {
        teamId,
        unitCap: teamState.unitCap,
        aliveUnits: state.battle.units.filter((unit) => unit.team === teamState.team && unit.state !== 'DYING' && unit.state !== 'REVIVING').length,
        baseWeaponId: teamState.baseWeapon.id ?? null,
        baseWeaponCooldownFrames: getPvp2v2WeaponCooldownRemaining(state, teamId),
        baseWeaponLastActivatedSeatId: teamState.baseWeaponLastActivatedSeatId,
      };
    }),
    seats: PVP_2V2_SEAT_IDS.map((seatId) => {
      const seat = state.seats[seatId];
      const current = seat.supplyLevels[seat.supplyLevel]!;
      const next = seat.supplyLevels[seat.supplyLevel + 1] ?? null;
      return {
        seatId,
        teamId: getPvp2v2SeatTeamId(seatId),
        supply: seat.supply,
        maxSupply: current.maxSupply,
        supplyLevel: seat.supplyLevel + 1,
        nextSupplyUpgradeCost: next?.upgradeCost ?? null,
        costs: Object.fromEntries(seat.slots.map((slot) => [slot.slotId, slot.cost])),
        cooldowns: Object.fromEntries(seat.slots.map((slot) => [slot.slotId, getPvp2v2CooldownRemaining(state, seatId, slot.slotId)])),
      };
    }),
    units: state.battle.units.map((unit) => ({
      simulationId: unit.simulationId,
      definitionId: unit.definition.id,
      teamId: unit.team === 'PLAYER' ? 'A' : 'B',
      ...(state.ownerBySimulationId[String(unit.simulationId)] === undefined ? {} : { ownerSeatId: state.ownerBySimulationId[String(unit.simulationId)] }),
      hp: unit.hp,
      maxHp: unit.definition.maxHp,
      anchorX: unit.anchorX,
      state: unit.state,
    })),
  };
}
