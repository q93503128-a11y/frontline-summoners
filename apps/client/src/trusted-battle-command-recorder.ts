import type { AccountTrustedBattleCommand } from './account-network.ts';

export const TRUSTED_BATTLE_CLIENT_MAX_COMMANDS = 4096;

export class TrustedBattleCommandRecorder {
  private readonly commands: AccountTrustedBattleCommand[] = [];
  private sealed = false;
  private lastTick = -1;

  private append(command: AccountTrustedBattleCommand, accepted: boolean): void {
    if (!accepted) return;
    if (this.sealed) throw new Error('trusted battle command recorder is sealed');
    if (!Number.isInteger(command.tick) || command.tick < 0) throw new Error('trusted battle command tick must be a non-negative integer');
    if (command.tick < this.lastTick) throw new Error('trusted battle command ticks must be non-decreasing');
    if (this.commands.length >= TRUSTED_BATTLE_CLIENT_MAX_COMMANDS) throw new Error('trusted battle command limit exceeded');
    this.commands.push(command);
    this.lastTick = command.tick;
  }

  recordSpawn(tick: number, slotId: string, accepted: boolean): void {
    const normalized = slotId.trim();
    if (accepted && normalized.length === 0) throw new Error('trusted battle spawn slot id must not be empty');
    this.append({ tick, type: 'SPAWN', slotId: normalized }, accepted);
  }

  recordSupplyUpgrade(tick: number, accepted: boolean): void {
    this.append({ tick, type: 'UPGRADE_SUPPLY' }, accepted);
  }

  recordBaseWeapon(tick: number, accepted: boolean): void {
    this.append({ tick, type: 'FIRE_BASE_WEAPON' }, accepted);
  }

  seal(): readonly AccountTrustedBattleCommand[] {
    this.sealed = true;
    return this.commands.map((command) => ({ ...command }));
  }

  get size(): number { return this.commands.length; }
  get isSealed(): boolean { return this.sealed; }
}
