export interface PvpArenaDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly teamSize: 1 | 2;
  readonly mapLength: number;
  readonly baseHp: number;
  readonly startingSupplyPerPlayer: number;
  readonly unitCapPerSide: number;
  readonly notes: readonly string[];
}

/**
 * First production-target symmetric PvP field. Numbers are DESIGN_TARGET until
 * human PvP sessions calibrate average match time to the canonical 2.5–5 minute goal.
 * It intentionally sits near late-MAIN field dimensions instead of introducing a
 * separate PvP-only scale model.
 */
export const PVP_ARENA_DUEL_V1: PvpArenaDefinition = {
  id: 'pvp_arena_duel_v1',
  displayName: '중앙 전선',
  teamSize: 1,
  mapLength: 3000,
  baseHp: 9000,
  startingSupplyPerPlayer: 450,
  unitCapPerSide: 40,
  notes: [
    '완전 좌우대칭 전장',
    'Lv50/+0 표준 전투를 기준으로 시작 보급 450',
    '8분 판정 상한은 pvp-content 정본을 따른다',
    '사거리/이속/재생산에 숨은 PvP 보정 없음',
  ],
} as const;

/**
 * 2v2 public/friendly foundation target. The runtime is intentionally authored now
 * so later 2v2 wiring does not improvise a different economy or arena scale.
 */
export const PVP_ARENA_TEAM_V1: PvpArenaDefinition = {
  id: 'pvp_arena_team_v1',
  displayName: '합동 전선',
  teamSize: 2,
  mapLength: 3200,
  baseHp: 12000,
  startingSupplyPerPlayer: 400,
  unitCapPerSide: 55,
  notes: [
    '2인 팀 공유 기지',
    '플레이어당 5칸/개인 보급·강화·생산 쿨다운',
    '팀 유닛 상한은 양 플레이어 합산',
    '2v2 랭킹은 v1 기본 범위가 아니며 일반/친선만 사용',
  ],
} as const;

export const PVP_ARENAS_V1: readonly PvpArenaDefinition[] = [PVP_ARENA_DUEL_V1, PVP_ARENA_TEAM_V1] as const;
