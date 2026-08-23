import Phaser from 'phaser';
import { APP_NAME, INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { SIM_TICK_MS, UnitState, type BattleUnit } from '@frontline/sim';
import { getCooldownRemaining, getCurrentSupplyLevel, getNextSupplyLevel, stepPlayableBattle, trySpawnPlayerUnit, tryUpgradeSupply, type PlayableBattleState } from '@frontline/sim/playable';
import { PLAYER_SLOTS, PROTOTYPE_MAP_LENGTH, createPrototypeBattle } from './prototype';

const FIELD_LEFT = 34;
const FIELD_RIGHT = 606;
const GROUND_Y = 238;

const SYMBOLS: Readonly<Record<string, string>> = {
  militia: '민', swordsman: '검', archer: '궁', mage: '불', hammer: '망',
  'crumb-slime': '빵', boar: '멧', 'pot-guard': '냄', 'boar-chief': '왕',
};

const UNIT_COLORS: Readonly<Record<string, number>> = {
  militia: 0x7fc8a9, swordsman: 0x92a8d1, archer: 0xb6d17a, mage: 0xd98d72, hammer: 0xc49a6c,
  'crumb-slime': 0xe6b86a, boar: 0xc97b63, 'pot-guard': 0xa1a8b3, 'boar-chief': 0xd6a84b,
};

interface UnitView {
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Rectangle;
  readonly hpBar: Phaser.GameObjects.Rectangle;
  readonly hpBarBg: Phaser.GameObjects.Rectangle;
}

interface UnitButton {
  readonly background: Phaser.GameObjects.Rectangle;
  readonly cooldownText: Phaser.GameObjects.Text;
}

class PrototypeBattleScene extends Phaser.Scene {
  private state!: PlayableBattleState;
  private accumulatorMs = 0;
  private readonly unitViews = new Map<number, UnitView>();
  private readonly buttons = new Map<string, UnitButton>();
  private supplyText!: Phaser.GameObjects.Text;
  private baseText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hashText!: Phaser.GameObjects.Text;
  private upgradeBackground!: Phaser.GameObjects.Rectangle;
  private upgradeText!: Phaser.GameObjects.Text;
  private winnerOverlay?: Phaser.GameObjects.Container;

  constructor() {
    super('prototype-battle');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#17191f');
    this.state = createPrototypeBattle();

    this.add.rectangle(INTERNAL_WIDTH / 2, GROUND_Y + 14, INTERNAL_WIDTH, 58, 0x30353d);
    this.add.rectangle(INTERNAL_WIDTH / 2, GROUND_Y - 14, INTERNAL_WIDTH, 2, 0x69717d);
    this.add.text(10, 8, `${APP_NAME} · 전투 프로토타입`, { fontFamily: 'sans-serif', fontSize: '14px', color: '#f2f2f2', fontStyle: 'bold' });
    this.add.text(10, 27, '임시 도형 아트 · 보급/소환/사거리/공격프레임/KB 검증용', { fontFamily: 'sans-serif', fontSize: '9px', color: '#aeb5c0' });

    this.drawBase('PLAYER', FIELD_LEFT, 0x637e9b);
    this.drawBase('ENEMY', FIELD_RIGHT, 0x9b665f);

    this.supplyText = this.add.text(10, 48, '', { fontFamily: 'monospace', fontSize: '11px', color: '#f6dc8f' });
    this.baseText = this.add.text(INTERNAL_WIDTH - 10, 48, '', { fontFamily: 'monospace', fontSize: '10px', color: '#d8dce3', align: 'right' }).setOrigin(1, 0);
    this.statusText = this.add.text(INTERNAL_WIDTH / 2, 67, '적은 자동으로 출현합니다. 아래 버튼으로 병력을 소환하세요.', { fontFamily: 'sans-serif', fontSize: '10px', color: '#c8ced8' }).setOrigin(0.5, 0);
    this.hashText = this.add.text(INTERNAL_WIDTH - 8, 8, '', { fontFamily: 'monospace', fontSize: '8px', color: '#747d8b' }).setOrigin(1, 0);

    this.createControls();
    this.refreshUi();
  }

  update(_time: number, delta: number): void {
    if (this.state.battle.winner === null) {
      this.accumulatorMs = Math.min(this.accumulatorMs + delta, 250);
      let steps = 0;
      while (this.accumulatorMs >= SIM_TICK_MS && steps < 10) {
        stepPlayableBattle(this.state);
        this.accumulatorMs -= SIM_TICK_MS;
        steps += 1;
      }
    }
    this.syncUnits();
    this.refreshUi();
    if (this.state.battle.winner !== null && !this.winnerOverlay) this.showWinner();
  }

  private drawBase(team: 'PLAYER' | 'ENEMY', x: number, color: number): void {
    const tower = this.add.rectangle(x, GROUND_Y - 29, 34, 58, color).setStrokeStyle(2, 0xd8dce3, 0.55);
    const roof = this.add.triangle(x, GROUND_Y - 65, 0, 20, 17, 0, 34, 20, color);
    if (team === 'ENEMY') {
      tower.setAlpha(0.95);
      roof.setAlpha(0.95);
    }
  }

  private createControls(): void {
    this.add.rectangle(INTERNAL_WIDTH / 2, 316, INTERNAL_WIDTH, 88, 0x111318, 0.96);

    PLAYER_SLOTS.forEach((slot, index) => {
      const x = 48 + index * 94;
      const y = 315;
      const background = this.add.rectangle(x, y, 88, 62, 0x2b3444).setStrokeStyle(1, 0x596579).setInteractive({ useHandCursor: true });
      this.add.text(x, y - 18, slot.displayName, { fontFamily: 'sans-serif', fontSize: '10px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(x, y + 2, `${slot.cost} 보급`, { fontFamily: 'monospace', fontSize: '9px', color: '#f6dc8f' }).setOrigin(0.5);
      const cooldownText = this.add.text(x, y + 20, '', { fontFamily: 'monospace', fontSize: '8px', color: '#b8c2d0' }).setOrigin(0.5);
      background.on('pointerdown', () => {
        const result = trySpawnPlayerUnit(this.state, slot.slotId);
        if (!result.ok) this.showFeedback(this.spawnFailureMessage(result.reason));
      });
      this.buttons.set(slot.slotId, { background, cooldownText });
    });

    this.upgradeBackground = this.add.rectangle(586, 315, 102, 62, 0x4a3d27).setStrokeStyle(1, 0x88734c).setInteractive({ useHandCursor: true });
    this.upgradeText = this.add.text(586, 315, '', { fontFamily: 'sans-serif', fontSize: '9px', color: '#fff0c7', align: 'center' }).setOrigin(0.5);
    this.upgradeBackground.on('pointerdown', () => {
      const result = tryUpgradeSupply(this.state);
      if (!result.ok) this.showFeedback(result.reason === 'max_level' ? '보급소가 이미 최대 레벨입니다.' : result.reason === 'insufficient_supply' ? '보급이 부족합니다.' : '전투가 종료되었습니다.');
      else this.showFeedback(`보급소 Lv.${result.level} 업그레이드!`);
    });
  }

  private spawnFailureMessage(reason: string): string {
    switch (reason) {
      case 'insufficient_supply': return '보급이 부족합니다.';
      case 'cooldown': return '아직 재소환 대기 중입니다.';
      case 'unit_cap': return '아군 배치 한도에 도달했습니다.';
      case 'battle_over': return '전투가 이미 종료되었습니다.';
      default: return '소환할 수 없습니다.';
    }
  }

  private showFeedback(message: string): void {
    this.statusText.setText(message).setColor('#ffe7a6');
    this.time.delayedCall(900, () => {
      if (!this.scene.isActive()) return;
      this.statusText.setText('적은 자동으로 출현합니다. 아래 버튼으로 병력을 소환하세요.').setColor('#c8ced8');
    });
  }

  private createUnitView(unit: BattleUnit): UnitView {
    const maxHp = unit.definition.maxHp;
    const width = Phaser.Math.Clamp(15 + Math.floor(maxHp / 220), 15, 28);
    const height = Phaser.Math.Clamp(22 + Math.floor(maxHp / 280), 22, 38);
    const body = this.add.rectangle(0, -height / 2, width, height, UNIT_COLORS[unit.definition.id] ?? (unit.team === 'PLAYER' ? 0x7fa8d8 : 0xd8877f)).setStrokeStyle(1, 0x111111, 0.8);
    const symbol = this.add.text(0, -height / 2, SYMBOLS[unit.definition.id] ?? '?', { fontFamily: 'sans-serif', fontSize: '9px', color: '#101216', fontStyle: 'bold' }).setOrigin(0.5);
    const barWidth = Math.max(18, width + 6);
    const hpBarBg = this.add.rectangle(0, -height - 7, barWidth, 3, 0x202126);
    const hpBar = this.add.rectangle(-barWidth / 2, -height - 7, barWidth, 3, unit.team === 'PLAYER' ? 0x8dd6a4 : 0xe79085).setOrigin(0, 0.5);
    const container = this.add.container(0, GROUND_Y - 13, [body, symbol, hpBarBg, hpBar]);
    return { container, body, hpBar, hpBarBg };
  }

  private syncUnits(): void {
    const aliveIds = new Set<number>();
    for (const unit of this.state.battle.units) {
      aliveIds.add(unit.simulationId);
      let view = this.unitViews.get(unit.simulationId);
      if (!view) {
        view = this.createUnitView(unit);
        this.unitViews.set(unit.simulationId, view);
      }
      const screenX = FIELD_LEFT + (unit.anchorX / PROTOTYPE_MAP_LENGTH) * (FIELD_RIGHT - FIELD_LEFT);
      const bob = unit.state === UnitState.Moving ? Math.sin((this.state.battle.tick + unit.simulationId * 7) * 0.35) * 1.5 : 0;
      view.container.setPosition(screenX, GROUND_Y - 5 + bob);
      view.container.setAlpha(unit.state === UnitState.Dying ? Math.max(0.15, 1 - unit.stateFrame / unit.definition.deathFrames) : 1);
      view.container.setDepth(Math.floor(screenX));
      if (unit.state === UnitState.Foreswing) view.body.setScale(1.15, 0.92);
      else if (unit.state === UnitState.Backswing) view.body.setScale(0.94, 1.05);
      else if (unit.state === UnitState.NaturalKnockback) view.body.setScale(0.88, 1.08);
      else view.body.setScale(1, 1);
      const fullWidth = view.hpBarBg.width;
      view.hpBar.displayWidth = Math.max(0, fullWidth * unit.hp / unit.definition.maxHp);
    }

    for (const [id, view] of this.unitViews) {
      if (aliveIds.has(id)) continue;
      view.container.destroy(true);
      this.unitViews.delete(id);
    }
  }

  private refreshUi(): void {
    const level = getCurrentSupplyLevel(this.state);
    const elapsed = this.state.battle.tick / 30;
    this.supplyText.setText(`보급 ${this.state.supply.toString().padStart(4, ' ')} / ${level.maxSupply}   보급소 Lv.${this.state.supplyLevel}   +${level.incomePerSecond}/초   ${elapsed.toFixed(1)}초`);
    this.baseText.setText(`우리 기지 ${this.state.battle.bases.PLAYER.hp}/${this.state.battle.bases.PLAYER.maxHp}\n적 기지 ${this.state.battle.bases.ENEMY.hp}/${this.state.battle.bases.ENEMY.maxHp}`);
    this.hashText.setText(`tick ${this.state.battle.tick} · ${this.state.stateHash}`);

    for (const slot of PLAYER_SLOTS) {
      const view = this.buttons.get(slot.slotId)!;
      const remaining = getCooldownRemaining(this.state, slot.slotId);
      const available = remaining === 0 && this.state.supply >= slot.cost && this.state.battle.winner === null;
      view.background.setFillStyle(available ? 0x2b4750 : 0x252933);
      view.background.setAlpha(available ? 1 : 0.72);
      view.cooldownText.setText(remaining > 0 ? `대기 ${(remaining / 30).toFixed(1)}s` : this.state.supply < slot.cost ? '보급 부족' : '소환 가능');
    }

    const next = getNextSupplyLevel(this.state);
    if (!next) {
      this.upgradeText.setText('보급소\nLv.MAX');
      this.upgradeBackground.setAlpha(0.55);
    } else {
      this.upgradeText.setText(`보급소 Lv.${this.state.supplyLevel + 1}\n${next.upgradeCost} 보급`);
      this.upgradeBackground.setAlpha(this.state.supply >= next.upgradeCost ? 1 : 0.62);
    }
  }

  private showWinner(): void {
    const victory = this.state.battle.winner === 'PLAYER';
    const shade = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x090a0d, 0.72).setInteractive();
    const title = this.add.text(INTERNAL_WIDTH / 2, 130, victory ? '승리!' : this.state.battle.winner === 'DRAW' ? '무승부' : '패배', {
      fontFamily: 'sans-serif', fontSize: '28px', color: victory ? '#ffe19a' : '#f0a0a0', fontStyle: 'bold',
    }).setOrigin(0.5);
    const restartBg = this.add.rectangle(INTERNAL_WIDTH / 2, 185, 130, 40, 0x39485b).setStrokeStyle(1, 0x8292a8).setInteractive({ useHandCursor: true });
    const restartText = this.add.text(INTERNAL_WIDTH / 2, 185, '다시 시작', { fontFamily: 'sans-serif', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);
    restartBg.on('pointerdown', () => this.restartBattle());
    this.winnerOverlay = this.add.container(0, 0, [shade, title, restartBg, restartText]).setDepth(10000);
  }

  private restartBattle(): void {
    this.state = createPrototypeBattle();
    this.accumulatorMs = 0;
    for (const view of this.unitViews.values()) view.container.destroy(true);
    this.unitViews.clear();
    this.winnerOverlay?.destroy(true);
    this.winnerOverlay = undefined;
    this.statusText.setText('적은 자동으로 출현합니다. 아래 버튼으로 병력을 소환하세요.').setColor('#c8ced8');
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: INTERNAL_WIDTH,
  height: INTERNAL_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#17191f',
  scene: [PrototypeBattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
