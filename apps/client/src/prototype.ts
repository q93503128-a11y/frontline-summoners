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

const wave = (enemyId: string, atTick: number, count: number, intervalTicks: number): EnemyWaveDefinition => ({ enemyId, atTick, count, intervalTicks });

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
  { enemyId: 'enemy-sprinter', displayName: '맨발 돌격병', definition: fighter('enemy-sprinter', 105, 24, 9, 36, 0, 44, 29, [5], 4, 3), rewardSupply: 32 },
  { enemyId: 'enemy-spearman', displayName: '황야 창잡이', definition: fighter('enemy-spearman', 360, 50, 4, 112, 48, 136, 52, [13], 8, 3), rewardSupply: 90 },
  { enemyId: 'enemy-shield', displayName: '녹슨 방패병', definition: fighter('enemy-shield', 980, 34, 2, 45, 0, 56, 64, [15], 11, 1), rewardSupply: 185 },
  { enemyId: 'enemy-cultist', displayName: '불씨 광신도', definition: fighter('enemy-cultist', 520, 90, 2, 185, 55, 215, 70, [21], 12, 3, 'AREA'), rewardSupply: 165 },
  { enemyId: 'enemy-sniper', displayName: '유리봉 저격술사', definition: fighter('enemy-sniper', 280, 150, 2, 260, 145, 305, 92, [33], 13, 4), rewardSupply: 210 },
  { enemyId: 'enemy-knight', displayName: '몰락 기사', definition: fighter('enemy-knight', 1050, 135, 3, 62, 0, 76, 72, [21], 12, 2, 'AREA'), rewardSupply: 290 },
  { enemyId: 'enemy-berserker', displayName: '철퇴 광전사', definition: fighter('enemy-berserker', 720, 230, 5, 50, 0, 65, 78, [30], 12, 2, 'AREA'), rewardSupply: 260 },
  { enemyId: 'enemy-boss', displayName: '황금가면 대주술사', definition: fighter('enemy-boss', 3900, 275, 2, 230, 70, 285, 104, [36], 18, 4, 'AREA'), rewardSupply: 900 },
  { enemyId: 'enemy-boss-iron', displayName: '철문장군', definition: fighter('enemy-boss-iron', 6500, 330, 2, 78, 0, 105, 96, [35], 16, 3, 'AREA'), rewardSupply: 1200 },
] as const;

const chapter = '제1장 · 뒤집힌 국경';
const t = (id: string, name: string, effect: string) => ({ id, name, effect });

export const STAGES: readonly PrototypeStage[] = [
  { id: 'border-01', chapter, name: '풀바람 초소', subtitle: '전선과 보급의 기본', difficulty: 1, playerBaseHp: 4200, enemyBaseHp: 3900, startingSupply: 480, waves: [wave('enemy-raider', 150, 7, 125), wave('enemy-spearman', 650, 3, 190)], treasure: t('wind-badge', '풀바람 보급 휘장', '기본 보급량 +3%') },
  { id: 'border-02', chapter, name: '맨발 언덕', subtitle: '빠른 돌격병이 전선을 흔든다', difficulty: 1, playerBaseHp: 4200, enemyBaseHp: 4100, startingSupply: 440, waves: [wave('enemy-sprinter', 120, 9, 92), wave('enemy-raider', 540, 6, 120)], treasure: t('barefoot-ribbon', '맨발부대 붉은 끈', '저비용 유닛 이동속도 +2%') },
  { id: 'border-03', chapter, name: '냄비 협곡', subtitle: '창잡이가 전열 뒤를 찌른다', difficulty: 1, playerBaseHp: 4300, enemyBaseHp: 4400, startingSupply: 420, waves: [wave('enemy-raider', 90, 8, 95), wave('enemy-spearman', 390, 6, 135), wave('enemy-sprinter', 780, 5, 88)], treasure: t('pot-token', '찌그러진 냄비 문장', '전열 유닛 HP +2%') },
  { id: 'border-04', chapter, name: '녹슨 관문', subtitle: '느린 방패병을 효율적으로 녹여라', difficulty: 2, playerBaseHp: 4400, enemyBaseHp: 4700, startingSupply: 400, waves: [wave('enemy-shield', 210, 3, 250), wave('enemy-raider', 330, 9, 82), wave('enemy-spearman', 720, 4, 160)], treasure: t('rust-nail', '녹슨 성문 못', '거점 최대 HP +2%') },
  { id: 'border-05', chapter, name: '첫 불씨', subtitle: '처음 만나는 범위 공격', difficulty: 2, playerBaseHp: 4500, enemyBaseHp: 4900, startingSupply: 420, waves: [wave('enemy-raider', 120, 10, 90), wave('enemy-cultist', 620, 3, 230), wave('enemy-shield', 950, 2, 280)], treasure: t('ember-vial', '꺼지지 않는 불씨병', '광역 유닛 공격력 +2%') },

  { id: 'border-06', chapter, name: '부서진 마차길', subtitle: '빠른 적과 벽이 교대로 온다', difficulty: 2, playerBaseHp: 4600, enemyBaseHp: 5100, startingSupply: 380, waves: [wave('enemy-sprinter', 90, 12, 72), wave('enemy-shield', 470, 3, 230), wave('enemy-raider', 650, 10, 78)], treasure: t('wagon-wheel', '반쪽 마차바퀴', '재생산 시간 -1%') },
  { id: 'border-07', chapter, name: '유리봉 언덕', subtitle: '긴 사거리의 사각을 파고들어라', difficulty: 2, playerBaseHp: 4700, enemyBaseHp: 5200, startingSupply: 440, waves: [wave('enemy-raider', 120, 8, 92), wave('enemy-sniper', 600, 3, 260), wave('enemy-sprinter', 820, 8, 75)], treasure: t('glass-splinter', '유리봉 파편', '원거리 유닛 공격력 +2%') },
  { id: 'border-08', chapter, name: '두 겹 방책', subtitle: '방패 뒤의 창병을 끊어내라', difficulty: 2, playerBaseHp: 4700, enemyBaseHp: 5400, startingSupply: 390, waves: [wave('enemy-shield', 140, 4, 210), wave('enemy-spearman', 280, 7, 145), wave('enemy-cultist', 920, 3, 210)], treasure: t('double-plank', '이중 방책 판자', '방벽 계열 HP +3%') },
  { id: 'border-09', chapter, name: '불붙은 곡창', subtitle: '물량이 범위 공격에 녹지 않게 관리', difficulty: 3, playerBaseHp: 4800, enemyBaseHp: 5700, startingSupply: 430, waves: [wave('enemy-cultist', 240, 4, 190), wave('enemy-raider', 330, 14, 66), wave('enemy-shield', 790, 3, 240), wave('enemy-cultist', 1100, 3, 180)], treasure: t('charred-grain', '그을린 곡식주머니', '처치 보급 +2%') },
  { id: 'border-10', chapter, name: '몰락 기사의 길', subtitle: '중간보스급 전열이 처음 등장', difficulty: 3, playerBaseHp: 5000, enemyBaseHp: 6000, startingSupply: 450, waves: [wave('enemy-raider', 120, 10, 82), wave('enemy-knight', 610, 3, 260), wave('enemy-spearman', 760, 6, 130), wave('enemy-knight', 1240, 2, 290)], treasure: t('fallen-spur', '몰락한 기사의 박차', 'A 이하 유닛 HP +2%') },

  { id: 'border-11', chapter, name: '붉은 징검다리', subtitle: '짧은 간격의 돌격이 계속된다', difficulty: 3, playerBaseHp: 5100, enemyBaseHp: 6200, startingSupply: 370, waves: [wave('enemy-sprinter', 60, 18, 58), wave('enemy-spearman', 430, 7, 120), wave('enemy-berserker', 980, 2, 290)], treasure: t('red-stone', '붉은 징검돌', '시작 보급 +2%') },
  { id: 'border-12', chapter, name: '빈틈 없는 진', subtitle: '방패와 저격이 서로의 약점을 덮는다', difficulty: 3, playerBaseHp: 5200, enemyBaseHp: 6500, startingSupply: 430, waves: [wave('enemy-shield', 150, 5, 190), wave('enemy-sniper', 390, 4, 220), wave('enemy-spearman', 700, 8, 115)], treasure: t('formation-pin', '진형 고정핀', '보급소 강화 비용 -2%') },
  { id: 'border-13', chapter, name: '철퇴 술집', subtitle: '한 방이 강한 광전사의 선딜을 끊어라', difficulty: 3, playerBaseHp: 5300, enemyBaseHp: 6700, startingSupply: 450, waves: [wave('enemy-raider', 120, 8, 90), wave('enemy-berserker', 520, 5, 190), wave('enemy-sprinter', 860, 10, 66)], treasure: t('bent-mug', '찌그러진 철잔', '근접 유닛 공격력 +2%') },
  { id: 'border-14', chapter, name: '보랏빛 포대', subtitle: '저격과 광역 공격이 동시에 압박한다', difficulty: 4, playerBaseHp: 5400, enemyBaseHp: 7000, startingSupply: 470, waves: [wave('enemy-sniper', 180, 5, 205), wave('enemy-cultist', 430, 6, 155), wave('enemy-shield', 730, 4, 200), wave('enemy-sprinter', 980, 10, 64)], treasure: t('purple-lens', '보랏빛 조준경', '장거리 유닛 선딜 -1%') },
  { id: 'border-15', chapter, name: '검은 행렬', subtitle: '중장갑 적이 끊임없이 전진한다', difficulty: 4, playerBaseHp: 5600, enemyBaseHp: 7400, startingSupply: 460, waves: [wave('enemy-knight', 180, 4, 220), wave('enemy-shield', 270, 6, 170), wave('enemy-berserker', 790, 4, 210), wave('enemy-knight', 1180, 3, 240)], treasure: t('black-banner', '찢어진 검은 깃발', '거점 병기 충전 +2%') },

  { id: 'border-16', chapter, name: '황금가면 전초', subtitle: '보스의 수하들이 전술을 섞기 시작한다', difficulty: 4, playerBaseHp: 5800, enemyBaseHp: 7800, startingSupply: 480, waves: [wave('enemy-sprinter', 90, 10, 64), wave('enemy-shield', 310, 5, 180), wave('enemy-sniper', 520, 4, 205), wave('enemy-cultist', 780, 5, 160), wave('enemy-knight', 1120, 3, 230)], treasure: t('mask-thread', '황금가면 끈', '모든 유닛 HP +1%') },
  { id: 'border-17', chapter, name: '주술사의 계단', subtitle: '뒤쪽 화력을 빠르게 무너뜨려라', difficulty: 4, playerBaseHp: 5900, enemyBaseHp: 8100, startingSupply: 500, waves: [wave('enemy-cultist', 160, 7, 145), wave('enemy-sniper', 360, 5, 190), wave('enemy-shield', 540, 5, 175), wave('enemy-berserker', 1000, 4, 205)], treasure: t('spell-step', '금 간 주술석', '광역 유닛 재생산 -2%') },
  { id: 'border-18', chapter, name: '가면의 행진', subtitle: '황금가면 대주술사 등장', difficulty: 5, playerBaseHp: 6200, enemyBaseHp: 9000, startingSupply: 520, waves: [wave('enemy-raider', 90, 12, 70), wave('enemy-spearman', 320, 8, 110), wave('enemy-cultist', 650, 6, 150), wave('enemy-boss', 1180, 1, 9999)], treasure: t('gold-mask-shard', '황금가면 파편', '거점 병기 충전 +3%') },
  { id: 'border-19', chapter, name: '철문 앞 벌판', subtitle: '보스 둘째 관문의 중장갑 전선', difficulty: 5, playerBaseHp: 6400, enemyBaseHp: 9400, startingSupply: 510, waves: [wave('enemy-shield', 100, 7, 155), wave('enemy-knight', 360, 5, 185), wave('enemy-sniper', 620, 5, 190), wave('enemy-berserker', 900, 5, 190), wave('enemy-sprinter', 1220, 12, 60)], treasure: t('iron-key', '철문의 찌그러진 열쇠', '전열 유닛 KB 저항 +2%') },
  { id: 'border-20', chapter, name: '뒤집힌 국경성', subtitle: '제1장의 모든 전술이 한 전선에 모인다', difficulty: 5, playerBaseHp: 6800, enemyBaseHp: 11000, startingSupply: 560, waves: [wave('enemy-sprinter', 75, 12, 62), wave('enemy-spearman', 300, 8, 108), wave('enemy-shield', 500, 6, 170), wave('enemy-cultist', 720, 6, 150), wave('enemy-sniper', 910, 5, 190), wave('enemy-knight', 1120, 4, 205), wave('enemy-boss-iron', 1450, 1, 9999), wave('enemy-boss', 1760, 1, 9999)], treasure: t('border-crown', '뒤집힌 국경의 왕관 조각', '제1장 보물 세트 효과 해금 예정') },
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
