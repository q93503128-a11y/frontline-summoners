import type { BattleUnitDefinition } from '@frontline/sim';
import { createPlayableBattle, type PlayableBattleState, type PlayerRosterSlot, type EnemyArchetype, type EnemyWaveDefinition } from '@frontline/sim/playable';

export type PrototypeRarity = 'C' | 'B' | 'A' | 'S' | 'SS';
export type PrototypeRole = '물량' | '전열' | '원거리' | '광역' | '결정타' | '변칙';
export type BattlefieldThemeId = 'meadow' | 'canyon' | 'burning' | 'ruins' | 'moon' | 'fortress' | 'golden';

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
  readonly mapLength: number;
  readonly theme: BattlefieldThemeId;
  readonly decorSeed: number;
  readonly waves: readonly EnemyWaveDefinition[];
  readonly treasure: { readonly id: string; readonly name: string; readonly effect: string };
  readonly unlockUnitId?: string;
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
  { slotId: 'militia', displayName: '징집병', rarity: 'C', role: '물량', description: '처음부터 함께하는 기본 병력. 싸고 빠르게 전선을 채운다.', definition: fighter('militia', 145, 15, 6, 42, 0, 50, 25, [5], 5, 2), cost: 50, rechargeFrames: 40 },
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

export const STARTER_SLOT_ID = 'militia';

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
  { id: 'border-01', chapter, name: '풀바람 초소', subtitle: '징집병 하나로 시작하는 첫 전선', difficulty: 1, playerBaseHp: 4200, enemyBaseHp: 3300, startingSupply: 520, mapLength: 820, theme: 'meadow', decorSeed: 11, waves: [wave('enemy-raider', 180, 6, 145), wave('enemy-raider', 780, 5, 115)], treasure: t('wind-badge', '풀바람 보급 휘장', '기본 보급량 +3%'), unlockUnitId: 'guard' },
  { id: 'border-02', chapter, name: '맨발 언덕', subtitle: '빠른 적을 방벽으로 받아내라', difficulty: 1, playerBaseHp: 4200, enemyBaseHp: 3900, startingSupply: 460, mapLength: 900, theme: 'meadow', decorSeed: 23, waves: [wave('enemy-sprinter', 150, 9, 105), wave('enemy-raider', 620, 5, 125)], treasure: t('barefoot-ribbon', '맨발부대 붉은 끈', '저비용 유닛 이동속도 +2%'), unlockUnitId: 'hunter' },
  { id: 'border-03', chapter, name: '냄비 협곡', subtitle: '길어진 전장에서 창병을 익힌다', difficulty: 1, playerBaseHp: 4300, enemyBaseHp: 4300, startingSupply: 430, mapLength: 1080, theme: 'canyon', decorSeed: 37, waves: [wave('enemy-raider', 120, 8, 105), wave('enemy-spearman', 470, 5, 155), wave('enemy-sprinter', 930, 5, 95)], treasure: t('pot-token', '찌그러진 냄비 문장', '전열 유닛 HP +2%') },
  { id: 'border-04', chapter, name: '녹슨 관문', subtitle: '두꺼운 방패를 끊어내는 첫 관문', difficulty: 2, playerBaseHp: 4400, enemyBaseHp: 4700, startingSupply: 420, mapLength: 930, theme: 'canyon', decorSeed: 41, waves: [wave('enemy-shield', 240, 3, 270), wave('enemy-raider', 390, 9, 88), wave('enemy-spearman', 820, 4, 170)], treasure: t('rust-nail', '녹슨 성문 못', '거점 최대 HP +2%'), unlockUnitId: 'duelist' },
  { id: 'border-05', chapter, name: '첫 불씨', subtitle: '불탄 밭에서 처음 만나는 범위 공격', difficulty: 2, playerBaseHp: 4500, enemyBaseHp: 5000, startingSupply: 430, mapLength: 960, theme: 'burning', decorSeed: 53, waves: [wave('enemy-raider', 130, 10, 92), wave('enemy-cultist', 650, 3, 240), wave('enemy-shield', 980, 2, 300)], treasure: t('ember-vial', '꺼지지 않는 불씨병', '광역 유닛 공격력 +2%') },
  { id: 'border-06', chapter, name: '부서진 마차길', subtitle: '짧은 길에서 속도전이 벌어진다', difficulty: 2, playerBaseHp: 4600, enemyBaseHp: 5200, startingSupply: 400, mapLength: 780, theme: 'burning', decorSeed: 67, waves: [wave('enemy-sprinter', 100, 12, 76), wave('enemy-shield', 490, 3, 235), wave('enemy-raider', 680, 10, 82)], treasure: t('wagon-wheel', '반쪽 마차바퀴', '재생산 시간 -1%'), unlockUnitId: 'lancer' },
  { id: 'border-07', chapter, name: '유리봉 언덕', subtitle: '긴 사거리의 사각을 파고들어라', difficulty: 2, playerBaseHp: 4700, enemyBaseHp: 5300, startingSupply: 450, mapLength: 1180, theme: 'meadow', decorSeed: 71, waves: [wave('enemy-raider', 130, 8, 96), wave('enemy-sniper', 620, 3, 270), wave('enemy-sprinter', 850, 8, 80)], treasure: t('glass-splinter', '유리봉 파편', '원거리 유닛 공격력 +2%') },
  { id: 'border-08', chapter, name: '두 겹 방책', subtitle: '방패 뒤의 창병을 끊어내라', difficulty: 2, playerBaseHp: 4700, enemyBaseHp: 5500, startingSupply: 400, mapLength: 1020, theme: 'ruins', decorSeed: 83, waves: [wave('enemy-shield', 150, 4, 220), wave('enemy-spearman', 300, 7, 150), wave('enemy-cultist', 950, 3, 220)], treasure: t('double-plank', '이중 방책 판자', '방벽 계열 HP +3%'), unlockUnitId: 'battlemage' },
  { id: 'border-09', chapter, name: '불붙은 곡창', subtitle: '좁은 전선에서 광역전이 벌어진다', difficulty: 3, playerBaseHp: 4800, enemyBaseHp: 5800, startingSupply: 440, mapLength: 860, theme: 'burning', decorSeed: 97, waves: [wave('enemy-cultist', 250, 4, 195), wave('enemy-raider', 350, 14, 70), wave('enemy-shield', 810, 3, 245), wave('enemy-cultist', 1120, 3, 185)], treasure: t('charred-grain', '그을린 곡식주머니', '처치 보급 +2%') },
  { id: 'border-10', chapter, name: '몰락 기사의 길', subtitle: '안개 폐허를 지키는 중간보스 전열', difficulty: 3, playerBaseHp: 5000, enemyBaseHp: 6100, startingSupply: 460, mapLength: 1120, theme: 'ruins', decorSeed: 101, waves: [wave('enemy-raider', 130, 10, 86), wave('enemy-knight', 620, 3, 270), wave('enemy-spearman', 790, 7, 140), wave('enemy-sniper', 1160, 2, 290)], treasure: t('fallen-crest', '몰락 기사의 문장', '근접 유닛 공격력 +2%'), unlockUnitId: 'pyromancer' },
  { id: 'border-11', chapter, name: '안개 없는 폐허', subtitle: '시야는 맑지만 저격수가 멀리 선다', difficulty: 3, playerBaseHp: 5100, enemyBaseHp: 6200, startingSupply: 430, mapLength: 1260, theme: 'ruins', decorSeed: 113, waves: [wave('enemy-shield', 160, 4, 225), wave('enemy-sniper', 530, 4, 230), wave('enemy-sprinter', 820, 12, 72)], treasure: t('clear-lens', '금 간 망원경', '원거리 사거리 +1%') },
  { id: 'border-12', chapter, name: '돌개바람 비탈', subtitle: '전선이 빠르게 밀리고 되밀리는 긴 비탈', difficulty: 3, playerBaseHp: 5200, enemyBaseHp: 6500, startingSupply: 420, mapLength: 1200, theme: 'canyon', decorSeed: 127, waves: [wave('enemy-sprinter', 90, 15, 68), wave('enemy-berserker', 610, 3, 245), wave('enemy-spearman', 880, 8, 128)], treasure: t('dust-charm', '먼지바람 부적', 'KB 회복 +2%') },
  { id: 'border-13', chapter, name: '달빛 검문소', subtitle: '밤 전장에서 고체력 전열이 압박한다', difficulty: 4, playerBaseHp: 5300, enemyBaseHp: 6800, startingSupply: 460, mapLength: 980, theme: 'moon', decorSeed: 131, waves: [wave('enemy-knight', 280, 4, 245), wave('enemy-cultist', 480, 5, 180), wave('enemy-sprinter', 920, 10, 76)], treasure: t('moon-pass', '달빛 통행패', '전투 시작 보급 +2%'), unlockUnitId: 'royal' },
  { id: 'border-14', chapter, name: '검은 깃발 평원', subtitle: '넓은 평원에서 전열과 저격수가 분리된다', difficulty: 4, playerBaseHp: 5400, enemyBaseHp: 7100, startingSupply: 450, mapLength: 1300, theme: 'moon', decorSeed: 149, waves: [wave('enemy-shield', 180, 5, 220), wave('enemy-sniper', 520, 5, 220), wave('enemy-berserker', 1040, 4, 220)], treasure: t('black-banner', '검은 깃발 조각', '아군 최대 배치 +1') },
  { id: 'border-15', chapter, name: '철문 전초기지', subtitle: '요새 앞의 짧은 살육전', difficulty: 4, playerBaseHp: 5500, enemyBaseHp: 7500, startingSupply: 470, mapLength: 840, theme: 'fortress', decorSeed: 157, waves: [wave('enemy-berserker', 170, 5, 205), wave('enemy-shield', 320, 5, 215), wave('enemy-cultist', 870, 5, 170)], treasure: t('iron-bolt', '철문 대형 볼트', '거점 방어 +2%') },
  { id: 'border-16', chapter, name: '성벽 그림자', subtitle: '요새 장거리 화력을 버티며 전진한다', difficulty: 4, playerBaseHp: 5600, enemyBaseHp: 7900, startingSupply: 480, mapLength: 1220, theme: 'fortress', decorSeed: 163, waves: [wave('enemy-shield', 130, 5, 210), wave('enemy-sniper', 480, 5, 215), wave('enemy-knight', 900, 4, 235), wave('enemy-cultist', 1240, 4, 170)], treasure: t('wall-shadow', '성벽 그림자 표식', '장거리 피해 +2%'), unlockUnitId: 'heretic' },
  { id: 'border-17', chapter, name: '철퇴병 훈련장', subtitle: '무거운 일격이 연속으로 떨어진다', difficulty: 4, playerBaseHp: 5700, enemyBaseHp: 8200, startingSupply: 500, mapLength: 940, theme: 'fortress', decorSeed: 179, waves: [wave('enemy-berserker', 160, 7, 185), wave('enemy-sprinter', 520, 14, 68), wave('enemy-knight', 980, 4, 220)], treasure: t('mace-ring', '찌그러진 철퇴 고리', '전열 공격력 +2%') },
  { id: 'border-18', chapter, name: '황금길 초입', subtitle: '길고 화려한 관문로에서 모든 적이 섞인다', difficulty: 5, playerBaseHp: 5900, enemyBaseHp: 8800, startingSupply: 520, mapLength: 1340, theme: 'golden', decorSeed: 181, waves: [wave('enemy-raider', 100, 12, 76), wave('enemy-shield', 400, 5, 210), wave('enemy-sniper', 760, 4, 225), wave('enemy-berserker', 1080, 5, 205)], treasure: t('gold-road-stone', '황금길 포석', '보급소 강화비 -2%') },
  { id: 'border-19', chapter, name: '대주술사의 계단', subtitle: '장거리 주문과 전열 압박을 동시에 견뎌라', difficulty: 5, playerBaseHp: 6100, enemyBaseHp: 9400, startingSupply: 540, mapLength: 1180, theme: 'golden', decorSeed: 193, waves: [wave('enemy-cultist', 160, 7, 165), wave('enemy-knight', 500, 5, 220), wave('enemy-sniper', 820, 5, 215), wave('enemy-boss', 1370, 1, 9999)], treasure: t('mask-thread', '황금가면 끈', '마법 계열 HP +2%') },
  { id: 'border-20', chapter, name: '철문과 황금가면', subtitle: '제1장 최종전 · 두 지휘관이 합류한다', difficulty: 5, playerBaseHp: 6500, enemyBaseHp: 11000, startingSupply: 580, mapLength: 1280, theme: 'golden', decorSeed: 211, waves: [wave('enemy-shield', 150, 6, 205), wave('enemy-berserker', 440, 6, 190), wave('enemy-sniper', 760, 5, 220), wave('enemy-boss', 1220, 1, 9999), wave('enemy-boss-iron', 1580, 1, 9999)], treasure: t('border-crown', '뒤집힌 국경의 왕관', '제1장 영구 보너스 묶음 해금'), unlockUnitId: 'voidsage' },
] as const;

export function getStage(stageId: string): PrototypeStage {
  return STAGES.find((stage) => stage.id === stageId) ?? STAGES[0]!;
}

export function getStageNumber(stageId: string): number {
  const index = STAGES.findIndex((stage) => stage.id === stageId);
  return index >= 0 ? index + 1 : 1;
}

export function getSlotById(slotId: string): PrototypeRosterSlot | undefined {
  return PLAYER_SLOTS.find((slot) => slot.slotId === slotId);
}

export function getUnlockStageForSlot(slotId: string): PrototypeStage | undefined {
  if (slotId === STARTER_SLOT_ID) return undefined;
  return STAGES.find((stage) => stage.unlockUnitId === slotId);
}

export function getUnlockedSlotIds(clearedStageIds: readonly string[]): readonly string[] {
  const cleared = new Set(clearedStageIds);
  const unlocked = new Set<string>([STARTER_SLOT_ID]);
  for (const stage of STAGES) {
    if (cleared.has(stage.id) && stage.unlockUnitId) unlocked.add(stage.unlockUnitId);
  }
  return PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId)).map((slot) => slot.slotId);
}

export function getUnlockedPlayerSlots(clearedStageIds: readonly string[]): readonly PrototypeRosterSlot[] {
  const unlocked = new Set(getUnlockedSlotIds(clearedStageIds));
  return PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId));
}

export function isStageUnlocked(stageId: string, clearedStageIds: readonly string[]): boolean {
  const index = STAGES.findIndex((stage) => stage.id === stageId);
  if (index <= 0) return true;
  return clearedStageIds.includes(STAGES[index - 1]!.id);
}

export function createPrototypeBattle(stageId = STAGES[0]!.id, unlockedSlotIds: readonly string[] = [STARTER_SLOT_ID]): PlayableBattleState {
  const stage = getStage(stageId);
  const unlocked = new Set(unlockedSlotIds);
  const playerSlots = PLAYER_SLOTS.filter((slot) => unlocked.has(slot.slotId));
  const safeSlots = playerSlots.length > 0 ? playerSlots : [PLAYER_SLOTS[0]!];
  return createPlayableBattle({
    mapLength: stage.mapLength,
    playerBaseHp: stage.playerBaseHp,
    enemyBaseHp: stage.enemyBaseHp,
    startingSupply: stage.startingSupply,
    playerSlots: safeSlots,
    enemies: ENEMIES,
    enemyWaves: stage.waves,
    playerUnitCap: 50,
    enemyUnitCap: 50,
  });
}
