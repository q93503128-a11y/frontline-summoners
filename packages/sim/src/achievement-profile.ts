export const PROFILE_COSMETIC_KINDS = ['TITLE', 'FRAME', 'BANNER', 'EMBLEM', 'BADGE'] as const;
export type ProfileCosmeticKind = (typeof PROFILE_COSMETIC_KINDS)[number];

export interface ProfileCosmeticDefinition {
  readonly id: string;
  readonly kind: ProfileCosmeticKind;
  readonly name: string;
  readonly description: string;
  readonly assetKey: string;
}

export const ACHIEVEMENT_CATEGORIES = [
  'MAIN',
  'SPECIAL',
  'GROWTH',
  'CODEX',
  'COOP',
  'PVP',
  'RECORD',
  'QUIRK',
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];
export type AchievementVisibility = 'PUBLIC' | 'HIDDEN';
export type AchievementProgressType = 'BOOLEAN' | 'COUNT' | 'MAX_VALUE' | 'UNIQUE_SET_COUNT' | 'TIER_REACHED' | 'STAGE_CLEAR_SET';

export const PVP_ACHIEVEMENT_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER'] as const;
export type PvpAchievementTier = (typeof PVP_ACHIEVEMENT_TIERS)[number];

export const ACHIEVEMENT_FACT_IDS = [
  'codex_main_core_complete',
  'coop_friend_first',
  'coop_reconnected_win',
  'pvp_first_ranked',
  'pvp_first_friendly',
  'quirk_turnip_five',
  'quirk_duck_mech_finish',
  'quirk_bellcrab_multi',
  'quirk_story_ten_late',
] as const;
export type AchievementFactId = (typeof ACHIEVEMENT_FACT_IDS)[number];

export type AchievementRequirement =
  | { readonly kind: 'MAIN_STAGE_CLEAR'; readonly stageId: string }
  | { readonly kind: 'MAIN_CLEAR_COUNT'; readonly target: number }
  | { readonly kind: 'SPECIAL_STAGE_CLEAR'; readonly stageId: string }
  | { readonly kind: 'SPECIAL_CLEAR_COUNT'; readonly target: number }
  | { readonly kind: 'SPECIAL_FINAL_COUNT'; readonly stageIds: readonly string[]; readonly target: number }
  | { readonly kind: 'CHARACTER_MAX_LEVEL'; readonly target: number }
  | { readonly kind: 'CHARACTER_MAX_PLUS'; readonly target: number }
  | { readonly kind: 'EVOLUTION_UNLOCK_COUNT'; readonly formOrder: 2 | 3; readonly target: number }
  | { readonly kind: 'OWNED_CHARACTER_COUNT'; readonly target: number }
  | { readonly kind: 'DISCOVERED_ENEMY_COUNT'; readonly target: number }
  | { readonly kind: 'COOP_CLEAR_COUNT'; readonly target: number }
  | { readonly kind: 'ENDLESS_MINUTE'; readonly target: number }
  | { readonly kind: 'BOSS_RUSH_DEFEATED'; readonly target: number }
  | { readonly kind: 'PVP_TIER_REACHED'; readonly tier: PvpAchievementTier }
  | { readonly kind: 'FACT_BOOLEAN'; readonly factId: AchievementFactId };

export interface AchievementDefinition {
  readonly id: string;
  readonly category: AchievementCategory;
  readonly name: string;
  readonly shortDescription: string;
  readonly visibility: AchievementVisibility;
  readonly progressType: AchievementProgressType;
  readonly requirement: AchievementRequirement;
  readonly cosmeticRewardIds: readonly string[];
  readonly repeatable: false;
  /** Economy quantities in the design wiki are still DESIGN_TARGET; this note is informational and grants nothing. */
  readonly designRewardNote?: string;
}

export interface AchievementEvaluationInput {
  readonly mainClearedStageIds: readonly string[];
  readonly specialClearedStageIds: readonly string[];
  readonly maxCharacterLevel: number;
  readonly maxCharacterPlusLevel: number;
  readonly unlockedF2Count: number;
  readonly unlockedF3Count: number;
  readonly ownedCharacterCount: number;
  readonly discoveredEnemyCount: number;
  readonly coopClearedStageIds: readonly string[];
  readonly endlessBestReachedMinute: number;
  readonly bossRushBestDefeated: number;
  readonly factIds: readonly AchievementFactId[];
  readonly pvpBestTier?: PvpAchievementTier;
}

export interface AchievementEvaluation {
  readonly achievementId: string;
  readonly current: number;
  readonly target: number;
  readonly complete: boolean;
}

export interface ProfileLoadout {
  readonly portraitCharacterId?: string;
  readonly titleId?: string;
  readonly frameId: string;
  readonly bannerId: string;
  readonly emblemId: string;
  readonly badgeIds: readonly string[];
}

const cosmetic = (
  id: string,
  kind: ProfileCosmeticKind,
  name: string,
  description: string,
): ProfileCosmeticDefinition => ({ id, kind, name, description, assetKey: `profile/${kind.toLowerCase()}/${id}` });

export const PROFILE_COSMETICS: readonly ProfileCosmeticDefinition[] = [
  cosmetic('frame_default_wood', 'FRAME', '기본 목재', '첫 전선의 투박한 목재 테두리.'),
  cosmetic('banner_default_frontline', 'BANNER', '기본 전선', '모든 지휘관이 사용할 수 있는 기본 전선 배너.'),
  cosmetic('emblem_default', 'EMBLEM', '전선 표식', '기본 지휘관 문장.'),
  cosmetic('title_border_breaker', 'TITLE', '국경 돌파자', '제1장 완주를 기념하는 칭호.'),
  cosmetic('frame_border_iron', 'FRAME', '국경 철제', '뒤집힌 국경의 철제 프레임.'),
  cosmetic('banner_twisted_forest', 'BANNER', '뒤틀린 숲', '제2장의 뒤틀린 숲을 담은 배너.'),
  cosmetic('frame_seraphe_glass', 'FRAME', '세라페 유리', '마도도시 세라페의 유리 프레임.'),
  cosmetic('title_first_front_complete', 'TITLE', '첫 전선 완주', '메인 4장 완주 칭호.'),
  cosmetic('banner_gear_empire', 'BANNER', '기어 제국', '기어 제국의 균열을 담은 배너.'),
  cosmetic('emblem_main_60', 'EMBLEM', '세 번째 전선', '메인 60 NORMAL_CLEAR 기념 문장.'),
  cosmetic('badge_main_v1', 'BADGE', '1차 완주', '메인80 NORMAL_CLEAR 기념 배지.'),
  cosmetic('emblem_special', 'EMBLEM', 'SPECIAL 개방', 'SPECIAL 전선을 연 지휘관의 문장.'),
  cosmetic('frame_gold_convoy', 'FRAME', '황금 수송대', '황금 수송대 최종 전장 기념 프레임.'),
  cosmetic('emblem_soul', 'EMBLEM', '혼의 제련', '혼의 제련소 최종 전장 기념 문장.'),
  cosmetic('banner_evolution_gate', 'BANNER', '진화의 문', '진화의 문 V 기념 배너.'),
  cosmetic('banner_star_rift', 'BANNER', '별빛 균열', '별빛 균열 IV 기념 배너.'),
  cosmetic('badge_special_20', 'BADGE', 'SPECIAL 20', '서로 다른 SPECIAL 전장 20종 클리어 배지.'),
  cosmetic('title_complete_frontsoldier', 'TITLE', '완성된 전선병', '첫 Base Lv50 달성 칭호.'),
  cosmetic('emblem_plus', 'EMBLEM', '+50', '첫 +50 달성 문장.'),
  cosmetic('frame_evolution', 'FRAME', '세 번째 형태', '첫 F3 해금 기념 프레임.'),
  cosmetic('badge_f3_10', 'BADGE', 'F3 열 종', 'F3 10종 해금 배지.'),
  cosmetic('banner_collection', 'BANNER', '동료 수집가', '아군 25종 보유 기념 배너.'),
  cosmetic('emblem_owned40', 'EMBLEM', '마흔 동료', '아군 40종 보유 기념 문장.'),
  cosmetic('badge_codex_50', 'BADGE', '적 도감 50', '서로 다른 적 50종 발견 배지.'),
  cosmetic('title_frontline_partner', 'TITLE', '전선의 짝꿍', '첫 협동 NORMAL_CLEAR 칭호.'),
  cosmetic('emblem_duo', 'EMBLEM', '두 지휘관', '서로 다른 협동 전장 10종 완료 문장.'),
  cosmetic('badge_coop_friend', 'BADGE', '친구와 출정', '친구와 첫 협동 기념 배지.'),
  cosmetic('badge_coop_reconnect', 'BADGE', '다시 전선으로', '재접속 후 승리 기념 배지.'),
  cosmetic('badge_pvp_ranked', 'BADGE', '첫 랭킹전', '첫 PvP 랭킹전 기념 배지.'),
  cosmetic('badge_pvp_friendly', 'BADGE', '첫 친선전', '첫 PvP 친선전 기념 배지.'),
  cosmetic('frame_pvp_silver', 'FRAME', 'PvP Silver', '최초 Silver 도달 프레임.'),
  cosmetic('frame_pvp_gold', 'FRAME', 'PvP Gold', '최초 Gold 도달 프레임.'),
  cosmetic('frame_pvp_diamond', 'FRAME', 'PvP Diamond', '최초 Diamond 도달 프레임.'),
  cosmetic('frame_pvp_master', 'FRAME', 'PvP Master', '최초 Master 도달 프레임.'),
  cosmetic('badge_endless_5', 'BADGE', '끝없는 5분', '끝없는 전선 5분 생존 배지.'),
  cosmetic('badge_endless_8', 'BADGE', '끝없는 8분', '끝없는 전선 8분 생존 배지.'),
  cosmetic('title_endless_10', 'TITLE', '끝없는 10분', '끝없는 전선 10분 생존 칭호.'),
  cosmetic('badge_boss_3', 'BADGE', '보스 셋', '보스 러시 3보스 격파 배지.'),
  cosmetic('badge_boss_5', 'BADGE', '보스 다섯', '보스 러시 5보스 격파 배지.'),
  cosmetic('badge_boss_8', 'BADGE', '보스 여덟', '보스 러시 8보스 격파 배지.'),
  cosmetic('badge_turnip_five', 'BADGE', '순무 행진', '순무기수 다섯을 동시에 유지한 기묘한 기록.'),
  cosmetic('badge_duck_machine', 'BADGE', '태엽 대 기계', '태엽오리기사로 기계 보스를 마무리한 기록.'),
  cosmetic('badge_bellcrab', 'BADGE', '울려라 종껍질', '종껍질 게의 종소리로 다수 적을 맞힌 기록.'),
  cosmetic('badge_story_ten', 'BADGE', '열 명의 이야기', 'STORY 10종만으로 후반 전선을 돌파한 기록.'),
] as const;

export const DEFAULT_PROFILE_COSMETIC_IDS = ['frame_default_wood', 'banner_default_frontline', 'emblem_default'] as const;

const achievement = (
  id: string,
  category: AchievementCategory,
  name: string,
  shortDescription: string,
  progressType: AchievementProgressType,
  requirement: AchievementRequirement,
  cosmeticRewardIds: readonly string[] = [],
  options: { visibility?: AchievementVisibility; designRewardNote?: string } = {},
): AchievementDefinition => ({
  id,
  category,
  name,
  shortDescription,
  visibility: options.visibility ?? 'PUBLIC',
  progressType,
  requirement,
  cosmeticRewardIds,
  repeatable: false,
  ...(options.designRewardNote === undefined ? {} : { designRewardNote: options.designRewardNote }),
});

const PERMANENT_COLLECTION_FINALS = [
  'special_glutton_04',
  'special_undead_04',
  'special_glass_04',
  'special_mechcastle_04',
  'special_anomaly_04',
  'special_echoes_03',
] as const;

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  achievement('ach_main_c1', 'MAIN', '뒤집힌 국경 완주', '제1장 마지막 전장을 NORMAL_CLEAR', 'BOOLEAN', { kind: 'MAIN_STAGE_CLEAR', stageId: 'main_01_020' }, ['title_border_breaker', 'frame_border_iron']),
  achievement('ach_main_c2', 'MAIN', '뒤틀린 숲 완주', '제2장 마지막 전장을 NORMAL_CLEAR', 'BOOLEAN', { kind: 'MAIN_STAGE_CLEAR', stageId: 'main_02_020' }, ['banner_twisted_forest']),
  achievement('ach_main_c3', 'MAIN', '세라페 도달', '제3장 마지막 전장을 NORMAL_CLEAR', 'BOOLEAN', { kind: 'MAIN_STAGE_CLEAR', stageId: 'main_03_020' }, ['frame_seraphe_glass']),
  achievement('ach_main_c4', 'MAIN', '첫 전선 완주', '제4장 마지막 전장을 NORMAL_CLEAR', 'BOOLEAN', { kind: 'MAIN_STAGE_CLEAR', stageId: 'main_04_020' }, ['title_first_front_complete', 'banner_gear_empire']),
  achievement('ach_main_20', 'MAIN', '스무 전장', '메인 NORMAL_CLEAR 20개', 'COUNT', { kind: 'MAIN_CLEAR_COUNT', target: 20 }, [], { designRewardNote: 'Gold + 소탕권 수치는 경제 사람 QA 후 확정' }),
  achievement('ach_main_40', 'MAIN', '마흔 전장', '메인 NORMAL_CLEAR 40개', 'COUNT', { kind: 'MAIN_CLEAR_COUNT', target: 40 }, [], { designRewardNote: '모집재화 소량 수치는 경제 사람 QA 후 확정' }),
  achievement('ach_main_60', 'MAIN', '예순 전장', '메인 NORMAL_CLEAR 60개', 'COUNT', { kind: 'MAIN_CLEAR_COUNT', target: 60 }, ['emblem_main_60']),
  achievement('ach_main_80', 'MAIN', '메인80', '메인80을 모두 NORMAL_CLEAR', 'COUNT', { kind: 'MAIN_CLEAR_COUNT', target: 80 }, ['badge_main_v1']),

  achievement('ach_special_unlock', 'SPECIAL', 'SPECIAL 개방', '제1장을 완료해 SPECIAL 허브 개방', 'BOOLEAN', { kind: 'MAIN_STAGE_CLEAR', stageId: 'main_01_020' }, ['emblem_special']),
  achievement('ach_gold_1', 'SPECIAL', '첫 황금 수송', '황금 수송대 I 완료', 'BOOLEAN', { kind: 'SPECIAL_STAGE_CLEAR', stageId: 'special_gold_convoy_01' }, [], { designRewardNote: 'Gold 소량 수치는 경제 사람 QA 후 확정' }),
  achievement('ach_gold_5', 'SPECIAL', '황금 운송감독', '황금 수송대 V 완료', 'BOOLEAN', { kind: 'SPECIAL_STAGE_CLEAR', stageId: 'special_gold_convoy_05' }, ['frame_gold_convoy']),
  achievement('ach_soul_4', 'SPECIAL', '혼의 제련 완료', '혼의 제련소 IV 완료', 'BOOLEAN', { kind: 'SPECIAL_STAGE_CLEAR', stageId: 'special_soul_forge_04' }, ['emblem_soul']),
  achievement('ach_evo_5', 'SPECIAL', '진화의 문 통과', '진화의 문 V 완료', 'BOOLEAN', { kind: 'SPECIAL_STAGE_CLEAR', stageId: 'special_evolution_gate_05' }, ['banner_evolution_gate']),
  achievement('ach_star_4', 'SPECIAL', '별빛 균열 통과', '별빛 균열 IV 완료', 'BOOLEAN', { kind: 'SPECIAL_STAGE_CLEAR', stageId: 'special_starlight_rift_04' }, ['banner_star_rift']),
  achievement('ach_permanent_3', 'SPECIAL', '상시 도전 세 갈래', '상시 도전 collection 최종 전장 3종 완료', 'STAGE_CLEAR_SET', { kind: 'SPECIAL_FINAL_COUNT', stageIds: PERMANENT_COLLECTION_FINALS, target: 3 }, [], { designRewardNote: '모집재화 소량 수치는 경제 사람 QA 후 확정' }),
  achievement('ach_special_20', 'SPECIAL', 'SPECIAL 20', '서로 다른 SPECIAL 전장 20종 완료', 'UNIQUE_SET_COUNT', { kind: 'SPECIAL_CLEAR_COUNT', target: 20 }, ['badge_special_20'], { designRewardNote: '소탕권 수치는 경제 사람 QA 후 확정' }),

  achievement('ach_lv10', 'GROWTH', '첫 Lv10', '첫 캐릭터 Base Lv10 달성', 'MAX_VALUE', { kind: 'CHARACTER_MAX_LEVEL', target: 10 }, [], { designRewardNote: 'Gold 보조 보상 수치는 경제 사람 QA 후 확정' }),
  achievement('ach_lv50', 'GROWTH', '완성된 전선병', '첫 캐릭터 Base Lv50 달성', 'MAX_VALUE', { kind: 'CHARACTER_MAX_LEVEL', target: 50 }, ['title_complete_frontsoldier']),
  achievement('ach_plus10', 'GROWTH', '첫 +10', '첫 캐릭터 +10 달성', 'MAX_VALUE', { kind: 'CHARACTER_MAX_PLUS', target: 10 }, [], { designRewardNote: 'soul 계열 보조 보상 수치는 경제 사람 QA 후 확정' }),
  achievement('ach_plus50', 'GROWTH', '첫 +50', '첫 캐릭터 +50 달성', 'MAX_VALUE', { kind: 'CHARACTER_MAX_PLUS', target: 50 }, ['emblem_plus']),
  achievement('ach_f2', 'GROWTH', '두 번째 형태', '첫 F2 해금', 'COUNT', { kind: 'EVOLUTION_UNLOCK_COUNT', formOrder: 2, target: 1 }),
  achievement('ach_f3', 'GROWTH', '세 번째 형태', '첫 F3 해금', 'COUNT', { kind: 'EVOLUTION_UNLOCK_COUNT', formOrder: 3, target: 1 }, ['frame_evolution']),
  achievement('ach_f3_10', 'GROWTH', '열 개의 세 번째 형태', 'F3 10종 해금', 'COUNT', { kind: 'EVOLUTION_UNLOCK_COUNT', formOrder: 3, target: 10 }, ['badge_f3_10'], { designRewardNote: '모집재화 소량 수치는 경제 사람 QA 후 확정' }),
  achievement('ach_owned10', 'GROWTH', '동료 열 명', '아군 10종 보유', 'COUNT', { kind: 'OWNED_CHARACTER_COUNT', target: 10 }, [], { designRewardNote: 'Gold 보조 보상 수치는 경제 사람 QA 후 확정' }),
  achievement('ach_owned25', 'GROWTH', '동료 스물다섯', '아군 25종 보유', 'COUNT', { kind: 'OWNED_CHARACTER_COUNT', target: 25 }, ['banner_collection']),
  achievement('ach_owned40', 'GROWTH', '동료 마흔', '아군 40종 보유', 'COUNT', { kind: 'OWNED_CHARACTER_COUNT', target: 40 }, ['emblem_owned40']),

  achievement('ach_codex_allies20', 'CODEX', '아군 도감 20', '아군 20종 획득', 'COUNT', { kind: 'OWNED_CHARACTER_COUNT', target: 20 }),
  achievement('ach_codex_enemy20', 'CODEX', '적 도감 20', '적 20종 발견', 'COUNT', { kind: 'DISCOVERED_ENEMY_COUNT', target: 20 }),
  achievement('ach_codex_enemy50', 'CODEX', '적 도감 50', '적 50종 발견', 'COUNT', { kind: 'DISCOVERED_ENEMY_COUNT', target: 50 }, ['badge_codex_50']),
  achievement('ach_codex_main_core', 'CODEX', '메인 적 주요군', '메인 적 도감 주요군 완성', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'codex_main_core_complete' }),

  achievement('ach_coop_first', 'COOP', '첫 협동 승리', '첫 협동 NORMAL_CLEAR', 'UNIQUE_SET_COUNT', { kind: 'COOP_CLEAR_COUNT', target: 1 }, ['title_frontline_partner']),
  achievement('ach_coop_10', 'COOP', '협동 전선 10', '서로 다른 협동 stage 10종 완료', 'UNIQUE_SET_COUNT', { kind: 'COOP_CLEAR_COUNT', target: 10 }, ['emblem_duo']),
  achievement('ach_coop_friend', 'COOP', '친구와 첫 출정', '친구와 첫 협동 완료', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'coop_friend_first' }, ['badge_coop_friend'], { designRewardNote: '소탕권 보조 보상 수치는 social/economy QA 후 확정' }),
  achievement('ach_coop_revive', 'COOP', '다시 전선으로', '재접속 후 정상 승리', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'coop_reconnected_win' }, ['badge_coop_reconnect']),

  achievement('ach_pvp_ranked_first', 'PVP', '첫 랭킹전', 'PvP 랭킹전 첫 참가', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'pvp_first_ranked' }, ['badge_pvp_ranked']),
  achievement('ach_pvp_friendly_first', 'PVP', '첫 친선전', 'PvP 친선전 첫 참가', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'pvp_first_friendly' }, ['badge_pvp_friendly']),
  achievement('ach_pvp_silver', 'PVP', 'Silver 도달', 'PvP에서 최초 Silver 도달', 'TIER_REACHED', { kind: 'PVP_TIER_REACHED', tier: 'SILVER' }, ['frame_pvp_silver']),
  achievement('ach_pvp_gold', 'PVP', 'Gold 도달', 'PvP에서 최초 Gold 도달', 'TIER_REACHED', { kind: 'PVP_TIER_REACHED', tier: 'GOLD' }, ['frame_pvp_gold']),
  achievement('ach_pvp_diamond', 'PVP', 'Diamond 도달', 'PvP에서 최초 Diamond 도달', 'TIER_REACHED', { kind: 'PVP_TIER_REACHED', tier: 'DIAMOND' }, ['frame_pvp_diamond']),
  achievement('ach_pvp_master', 'PVP', 'Master 도달', 'PvP에서 최초 Master 도달', 'TIER_REACHED', { kind: 'PVP_TIER_REACHED', tier: 'MASTER' }, ['frame_pvp_master']),

  achievement('ach_endless_5', 'RECORD', '끝없는 5분', '끝없는 전선 5분 생존', 'MAX_VALUE', { kind: 'ENDLESS_MINUTE', target: 5 }, ['badge_endless_5']),
  achievement('ach_endless_8', 'RECORD', '끝없는 8분', '끝없는 전선 8분 생존', 'MAX_VALUE', { kind: 'ENDLESS_MINUTE', target: 8 }, ['badge_endless_8']),
  achievement('ach_endless_10', 'RECORD', '끝없는 10분', '끝없는 전선 10분 생존', 'MAX_VALUE', { kind: 'ENDLESS_MINUTE', target: 10 }, ['title_endless_10']),
  achievement('ach_bossrush_3', 'RECORD', '보스 셋', '보스 러시 3보스 격파', 'MAX_VALUE', { kind: 'BOSS_RUSH_DEFEATED', target: 3 }, ['badge_boss_3']),
  achievement('ach_bossrush_5', 'RECORD', '보스 다섯', '보스 러시 5보스 격파', 'MAX_VALUE', { kind: 'BOSS_RUSH_DEFEATED', target: 5 }, ['badge_boss_5']),
  achievement('ach_bossrush_8', 'RECORD', '보스 여덟', '보스 러시 8보스 격파', 'MAX_VALUE', { kind: 'BOSS_RUSH_DEFEATED', target: 8 }, ['badge_boss_8']),

  achievement('ach_quirk_turnip_five', 'QUIRK', '순무 행진', '순무기수 5기 이상을 동시에 유지', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'quirk_turnip_five' }, ['badge_turnip_five'], { visibility: 'HIDDEN' }),
  achievement('ach_quirk_duck_mech', 'QUIRK', '태엽 대 기계', '태엽오리기사로 기계 보스를 마무리', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'quirk_duck_mech_finish' }, ['badge_duck_machine'], { visibility: 'HIDDEN' }),
  achievement('ach_quirk_bellcrab_multi', 'QUIRK', '울려라 종껍질', '종껍질 게의 종소리로 한 번에 다수 적 타격', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'quirk_bellcrab_multi' }, ['badge_bellcrab'], { visibility: 'HIDDEN' }),
  achievement('ach_quirk_story_ten', 'QUIRK', '열 명의 이야기', 'STORY 10종만으로 지정 후반 전장을 완료', 'BOOLEAN', { kind: 'FACT_BOOLEAN', factId: 'quirk_story_ten_late' }, ['badge_story_ten'], { visibility: 'HIDDEN' }),
] as const;

const COSMETIC_BY_ID = new Map(PROFILE_COSMETICS.map((entry) => [entry.id, entry] as const));
const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((entry) => [entry.id, entry] as const));
const FACT_ID_SET = new Set<string>(ACHIEVEMENT_FACT_IDS);
const PVP_TIER_INDEX = new Map(PVP_ACHIEVEMENT_TIERS.map((tier, index) => [tier, index] as const));

function validateCatalog(): void {
  if (COSMETIC_BY_ID.size !== PROFILE_COSMETICS.length) throw new Error('profile cosmetic ids must be unique');
  if (ACHIEVEMENT_BY_ID.size !== ACHIEVEMENTS.length) throw new Error('achievement ids must be unique');
  if (ACHIEVEMENTS.length < 45 || ACHIEVEMENTS.length > 55) throw new Error('initial achievement catalog must stay inside authored 45..55 target');
  for (const achievement of ACHIEVEMENTS) {
    if (achievement.repeatable !== false) throw new Error(`achievement must not repeat:${achievement.id}`);
    for (const rewardId of achievement.cosmeticRewardIds) {
      if (!COSMETIC_BY_ID.has(rewardId)) throw new Error(`achievement references unknown cosmetic:${achievement.id}:${rewardId}`);
    }
    if (achievement.requirement.kind === 'FACT_BOOLEAN' && !FACT_ID_SET.has(achievement.requirement.factId)) {
      throw new Error(`achievement references unknown fact:${achievement.id}`);
    }
  }
  for (const id of DEFAULT_PROFILE_COSMETIC_IDS) if (!COSMETIC_BY_ID.has(id)) throw new Error(`unknown default profile cosmetic:${id}`);
}
validateCatalog();

export function getAchievement(id: string): AchievementDefinition {
  const achievement = ACHIEVEMENT_BY_ID.get(id);
  if (!achievement) throw new Error(`Unknown achievement:${id}`);
  return achievement;
}

export function getProfileCosmetic(id: string): ProfileCosmeticDefinition {
  const cosmeticDefinition = COSMETIC_BY_ID.get(id);
  if (!cosmeticDefinition) throw new Error(`Unknown profile cosmetic:${id}`);
  return cosmeticDefinition;
}

function clampedProgress(current: number, target: number, achievementId: string): AchievementEvaluation {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.trunc(current)) : 0;
  const safeTarget = Math.max(1, Math.trunc(target));
  return { achievementId, current: Math.min(safeCurrent, safeTarget), target: safeTarget, complete: safeCurrent >= safeTarget };
}

export function evaluateAchievement(definition: AchievementDefinition, input: AchievementEvaluationInput): AchievementEvaluation {
  const requirement = definition.requirement;
  if (requirement.kind === 'MAIN_STAGE_CLEAR') return clampedProgress(input.mainClearedStageIds.includes(requirement.stageId) ? 1 : 0, 1, definition.id);
  if (requirement.kind === 'MAIN_CLEAR_COUNT') return clampedProgress(new Set(input.mainClearedStageIds).size, requirement.target, definition.id);
  if (requirement.kind === 'SPECIAL_STAGE_CLEAR') return clampedProgress(input.specialClearedStageIds.includes(requirement.stageId) ? 1 : 0, 1, definition.id);
  if (requirement.kind === 'SPECIAL_CLEAR_COUNT') return clampedProgress(new Set(input.specialClearedStageIds).size, requirement.target, definition.id);
  if (requirement.kind === 'SPECIAL_FINAL_COUNT') {
    const cleared = new Set(input.specialClearedStageIds);
    return clampedProgress(requirement.stageIds.filter((id) => cleared.has(id)).length, requirement.target, definition.id);
  }
  if (requirement.kind === 'CHARACTER_MAX_LEVEL') return clampedProgress(input.maxCharacterLevel, requirement.target, definition.id);
  if (requirement.kind === 'CHARACTER_MAX_PLUS') return clampedProgress(input.maxCharacterPlusLevel, requirement.target, definition.id);
  if (requirement.kind === 'EVOLUTION_UNLOCK_COUNT') return clampedProgress(requirement.formOrder === 2 ? input.unlockedF2Count : input.unlockedF3Count, requirement.target, definition.id);
  if (requirement.kind === 'OWNED_CHARACTER_COUNT') return clampedProgress(input.ownedCharacterCount, requirement.target, definition.id);
  if (requirement.kind === 'DISCOVERED_ENEMY_COUNT') return clampedProgress(input.discoveredEnemyCount, requirement.target, definition.id);
  if (requirement.kind === 'COOP_CLEAR_COUNT') return clampedProgress(new Set(input.coopClearedStageIds).size, requirement.target, definition.id);
  if (requirement.kind === 'ENDLESS_MINUTE') return clampedProgress(input.endlessBestReachedMinute, requirement.target, definition.id);
  if (requirement.kind === 'BOSS_RUSH_DEFEATED') return clampedProgress(input.bossRushBestDefeated, requirement.target, definition.id);
  if (requirement.kind === 'FACT_BOOLEAN') return clampedProgress(input.factIds.includes(requirement.factId) ? 1 : 0, 1, definition.id);
  const currentTierIndex = input.pvpBestTier === undefined ? -1 : (PVP_TIER_INDEX.get(input.pvpBestTier) ?? -1);
  const targetTierIndex = PVP_TIER_INDEX.get(requirement.tier) ?? Number.MAX_SAFE_INTEGER;
  return clampedProgress(currentTierIndex >= targetTierIndex ? targetTierIndex + 1 : Math.max(0, currentTierIndex + 1), targetTierIndex + 1, definition.id);
}

export function evaluateAchievements(input: AchievementEvaluationInput): readonly AchievementEvaluation[] {
  return ACHIEVEMENTS.map((definition) => evaluateAchievement(definition, input));
}

export function normalizeAchievementFactIds(value: unknown): readonly AchievementFactId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is AchievementFactId => typeof entry === 'string' && FACT_ID_SET.has(entry)))];
}

export function normalizePvpAchievementTier(value: unknown): PvpAchievementTier | undefined {
  return typeof value === 'string' && PVP_TIER_INDEX.has(value as PvpAchievementTier) ? value as PvpAchievementTier : undefined;
}

export function getClaimedAchievementCosmeticIds(claimedAchievementIds: readonly string[]): readonly string[] {
  const result = new Set<string>(DEFAULT_PROFILE_COSMETIC_IDS);
  for (const achievementId of new Set(claimedAchievementIds)) {
    const achievementDefinition = ACHIEVEMENT_BY_ID.get(achievementId);
    if (!achievementDefinition) continue;
    for (const rewardId of achievementDefinition.cosmeticRewardIds) result.add(rewardId);
  }
  return [...result];
}

export function normalizeOwnedProfileCosmeticIds(value: unknown, claimedAchievementIds: readonly string[] = []): readonly string[] {
  const required = new Set(getClaimedAchievementCosmeticIds(claimedAchievementIds));
  if (Array.isArray(value)) {
    for (const entry of value) if (typeof entry === 'string' && COSMETIC_BY_ID.has(entry)) required.add(entry);
  }
  return [...required];
}

function firstOwnedByKind(ids: readonly string[], kind: ProfileCosmeticKind): string | undefined {
  return ids.find((id) => COSMETIC_BY_ID.get(id)?.kind === kind);
}

export function normalizeProfileLoadout(
  value: unknown,
  ownedCosmeticIds: readonly string[],
  ownedCharacterIds: readonly string[],
): ProfileLoadout {
  const raw = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const ownedCosmetics = new Set(ownedCosmeticIds.filter((id) => COSMETIC_BY_ID.has(id)));
  for (const id of DEFAULT_PROFILE_COSMETIC_IDS) ownedCosmetics.add(id);
  const ownedCharacters = new Set(ownedCharacterIds);
  const byKind = (candidate: unknown, kind: ProfileCosmeticKind, fallbackId: string): string => {
    if (typeof candidate === 'string' && ownedCosmetics.has(candidate) && COSMETIC_BY_ID.get(candidate)?.kind === kind) return candidate;
    return firstOwnedByKind([...ownedCosmetics], kind) ?? fallbackId;
  };
  const portraitCharacterId = typeof raw.portraitCharacterId === 'string' && ownedCharacters.has(raw.portraitCharacterId)
    ? raw.portraitCharacterId
    : ownedCharacterIds[0];
  const titleId = typeof raw.titleId === 'string' && ownedCosmetics.has(raw.titleId) && COSMETIC_BY_ID.get(raw.titleId)?.kind === 'TITLE'
    ? raw.titleId
    : undefined;
  const badgeIds = Array.isArray(raw.badgeIds)
    ? [...new Set(raw.badgeIds.filter((id): id is string => typeof id === 'string' && ownedCosmetics.has(id) && COSMETIC_BY_ID.get(id)?.kind === 'BADGE'))].slice(0, 3)
    : [];
  return {
    ...(portraitCharacterId === undefined ? {} : { portraitCharacterId }),
    ...(titleId === undefined ? {} : { titleId }),
    frameId: byKind(raw.frameId, 'FRAME', 'frame_default_wood'),
    bannerId: byKind(raw.bannerId, 'BANNER', 'banner_default_frontline'),
    emblemId: byKind(raw.emblemId, 'EMBLEM', 'emblem_default'),
    badgeIds,
  };
}
