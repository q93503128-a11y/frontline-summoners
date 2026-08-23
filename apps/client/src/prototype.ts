import type { BattleUnitDefinition } from '@frontline/sim';
import { createPlayableBattle, type PlayableBattleState, type PlayerRosterSlot, type EnemyArchetype, type EnemyWaveDefinition } from '@frontline/sim/playable';

export type PrototypeRarity = 'C' | 'B' | 'A' | 'S' | 'SS';
export type PrototypeRole = '물량' | '전열' | '원거리' | '광역' | '결정타' | '변칙';

export interface PrototypeRosterSlot extends PlayerRosterSlot {
  readonly rarity: PrototypeRarity;
  readonly role: PrototypeRole;
  readonly description: string;
}

export interface PrototypeStage {
  readonly id: string;
  readonly chapter: string;
  readonly name: string;
  readonly subtitle: string;
  readonly difficulty: number;
  readonly playerBaseHp: number;
  readonly enemyBaseHp: number;
  readonly startingSupply: number;
  readonly waves: readonly EnemyWaveDefinition[];
  readonly treasure: { readonly id: string; readonly name: string; readonly effect: string };
}

const fighter = (
  id: string,
  maxHp: number,
  attackDamage: number,
  moveSpeed: number,
  standingRange: number,
  attackMinRange: number,
  attackMaxRange: number,
  cycleFrames: number,
  hitFrames: readonly number[],
  backswingFrames: number,
  naturalKnockbackCount: number,
  targetMode: 'SINGLE' | 'AREA' = 'SINGLE',
): BattleUnitDefinition => ({
  id, maxHp, attackDamage, moveSpeed, standingRange, attackMinRange, attackMaxRange, targetMode,
  naturalKnockbackCount, naturalKnockbackFrames: 12, naturalKnockbackDistance: 34, deathFrames: 12,
  attackTiming: { cycleFrames, hitFrames, backswingFrames },
});

export const PLAYER_SLOTS: readonly PrototypeRosterSlot[] = [
  { slotId: 'militia', displayName: '징집병', rarity: 'C', role: '물량', description: '싸고 빠르게 전선을 채우는 기본 병력.', definition: fighter('militia', 145, 15, 6, 42, 0, 50, 25, [5], 5, 2), cost: 50, rechargeFrames: 40 },
  { slotId: 'guard', displayName: '방벽기사', rarity: 'C', role: '전열', description: '공격보다 오래 버티는 데 특화된 기사.', definition: fighter('guard', 560, 30, 3, 48, 0, 58, 48, [10], 8, 1), cost: 150, rechargeFrames: 88 },
  { slotId: 'hunter', displayName: '수렵창병', rarity: 'C', role: '원거리', description: '긴 창으로 전열 뒤에서 안정적으로 찌른다.', definition: fighter('hunter', 230, 38, 4, 105, 45, 128, 45, [11], 7, 3), cost: 220, rechargeFrames: 92 },
  { slotId: 'duelist', displayName: '결투검사', rarity: 'B', role: '전열', description: '짧은 선딜로 틈을 놓치지 않는 근접 딜러.', definition: fighter('duelist', 390, 70, 5, 54, 0, 64, 38, [8], 6, 3), cost: 280, rechargeFrames: 105 },
  { slotId: 'lancer', displayName: '청창대', rarity: 'B', role: '원거리', description: '중거리에서 여러 전열을 교체하며 버틴다.', definition: fighter('lancer', 360, 72, 4, 128, 62, 148, 52, [14], 9, 4), cost: 390, rechargeFrames: 126 },
  { slotId: 'battlemage', displayName: '전투마도사', rarity: 'B', role: '광역', description: '안정적인 중거리 범위 마법을 사용한다.', definition: fighter('battlemage', 280, 90, 3, 178, 55, 205, 68, [19], 11, 3, 'AREA'), cost: 500, rechargeFrames: 152 },
  { slotId: 'pyromancer', displayName: '화염술사', rarity: 'A', role: '광역', description: '긴 선딜 대신 넓은 화염 폭발을 일으킨다.', definition: fighter('pyromancer', 300, 145, 2, 210, 70, 245, 82, [27], 13, 2, 'AREA'), cost: 760, rechargeFrames: 188 },
  { slotId: 'royal', displayName: '왕실기사', rarity: 'A', role: '전열', description: '높은 체력과 안정적인 광역 검격을 가진다.', definition: fighter('royal', 1200, 180, 3, 72, 0, 90, 72, [20], 12, 2, 'AREA'), cost: 1080, rechargeFrames: 240 },
  { slotId: 'heretic', displayName: '이단주술사', rarity: 'S', role: '변칙', description: '넓은 사각지대를 가진 장거리 광역 공격수.', definition: fighter('heretic', 470, 240, 2, 250, 115, 290, 102, [34], 16, 3, 'AREA'), cost: 1450, rechargeFrames: 330 },
  { slotId: 'voidsage', displayName: '공허현자', rarity: 'SS', role: '결정타', description: '매우 비싸지만 전선을 뒤집는 대형 광역 마법을 쓴다.', definition: fighter('voidsage', 980, 520, 2, 275, 80, 330, 138, [48], 22, 2, 'AREA'), cost: 2300, rechargeFrames: 480 },
] as const;

export const ENEMIES: readonly EnemyArchetype[] = [
  { enemyId: 'enemy-raider', displayName: '붉은 약탈병', definition: fighter('enemy-raider', 140, 18, 5, 42, 0, 52, 34, [8], 6, 2), rewardSupply: 35 },
  { enemyId: 'enemy-spearman', displayName: '황야 창잡이', definition: fighter('enemy-spearman', 360, 50, 4, 112, 48, 136, 52, [13], 8, 3), rewardSupply: 90 },
  { enemyId: 'enemy-cultist', displayName: '불씨 광신도', definition: fighter('enemy-cultist', 520, 90, 2, 185, 55, 215, 70, [21], 12, 3, 'AREA'), rewardSupply: 165 },
  { enemyId: 'enemy-knight', displayName: '몰락 기사', definition: fighter('enemy-knight', 1050, 135, 3, 62, 0, 76, 72, [21], 12, 2, 'AREA'), rewardSupply: 290 },
  { enemyId: 'enemy-boss', displayName: '황금가면 대주술사', definition: fighter('enemy-boss', 3600, 260, 2, 230, 70, 285, 104, [36], 18, 4, 'AREA'), rewardSupply: 900 },
] as const;

export const STAGES: readonly PrototypeStage[] = [
  {
    id: 'border-01', chapter: '제1장 · 뒤집힌 국경', name: '풀바람 초소', subtitle: '전선의 기본을 익히는 첫 전투', difficulty: 1,
    playerBaseHp: 4200, enemyBaseHp: 4300, startingSupply: 420,
    waves: [
      { enemyId: 'enemy-raider', atTick: 120, count: 6, intervalTicks: 115 },
      { enemyId: 'enemy-spearman', atTick: 510, count: 4, intervalTicks: 165 },
      { enemyId: 'enemy-cultist', atTick: 870, count: 2, intervalTicks: 250 },
      { enemyId: 'enemy-knight', atTick: 1120, count: 2, intervalTicks: 280 },
    ],
    treasure: { id: 'wind-badge', name: '풀바람 보급 휘장', effect: '기본 보급량 +3% (정식 성장 적용은 추후 연결)' },
  },
  {
    id: 'border-02', chapter: '제1장 · 뒤집힌 국경', name: '냄비 협곡', subtitle: '근접 압박과 중거리 적이 섞인다', difficulty: 2,
    playerBaseHp: 4400, enemyBaseHp: 5000, startingSupply: 360,
    waves: [
      { enemyId: 'enemy-raider', atTick: 90, count: 8, intervalTicks: 82 },
      { enemyId: 'enemy-spearman', atTick: 390, count: 6, intervalTicks: 130 },
      { enemyId: 'enemy-knight', atTick: 780, count: 3, intervalTicks: 230 },
      { enemyId: 'enemy-cultist', atTick: 940, count: 4, intervalTicks: 175 },
    ],
    treasure: { id: 'pot-token', name: '찌그러진 냄비 문장', effect: '전열 유닛 HP +2% (정식 성장 적용은 추후 연결)' },
  },
  {
    id: 'border-03', chapter: '제1장 · 뒤집힌 국경', name: '황금가면의 문', subtitle: '첫 보스가 지키는 국경 관문', difficulty: 3,
    playerBaseHp: 4800, enemyBaseHp: 6200, startingSupply: 450,
    waves: [
      { enemyId: 'enemy-raider', atTick: 90, count: 10, intervalTicks: 78 },
      { enemyId: 'enemy-spearman', atTick: 330, count: 6, intervalTicks: 125 },
      { enemyId: 'enemy-cultist', atTick: 660, count: 5, intervalTicks: 150 },
      { enemyId: 'enemy-knight', atTick: 920, count: 4, intervalTicks: 200 },
      { enemyId: 'enemy-boss', atTick: 1260, count: 1, intervalTicks: 9999 },
    ],
    treasure: { id: 'gold-mask-shard', name: '황금가면 파편', effect: '거점 병기 충전 +3% (병기 시스템 연결 후 적용)' },
  },
] as const;

export const PROTOTYPE_MAP_LENGTH = 1000;

export function getStage(stageId: string): PrototypeStage {
  return STAGES.find((stage) => stage.id === stageId) ?? STAGES[0]!;
}

export function createPrototypeBattle(stageId = STAGES[0]!.id): PlayableBattleState {
  const stage = getStage(stageId);
  return createPlayableBattle({
    mapLength: PROTOTYPE_MAP_LENGTH,
    playerBaseHp: stage.playerBaseHp,
    enemyBaseHp: stage.enemyBaseHp,
    startingSupply: stage.startingSupply,
    playerSlots: PLAYER_SLOTS,
    enemies: ENEMIES,
    enemyWaves: stage.waves,
    playerUnitCap: 50,
    enemyUnitCap: 50,
  });
}
