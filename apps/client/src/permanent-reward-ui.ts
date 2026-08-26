import { PERMANENT_REWARDS, type PermanentRewardModifier } from './permanent-rewards.ts';

const REWARD_BY_ID = new Map(PERMANENT_REWARDS.map((reward) => [reward.id, reward] as const));

function scopeLabel(scope: 'ALL' | 'FRONTLINE' | 'RANGED' | 'AREA'): string {
  if (scope === 'ALL') return '전체 아군';
  if (scope === 'FRONTLINE') return '전열 아군';
  if (scope === 'RANGED') return '원거리 아군';
  return '광역 아군';
}

function modifierLabel(modifier: PermanentRewardModifier): string {
  if (modifier.kind === 'UNIT_HP_PERCENT') return `${scopeLabel(modifier.scope)} HP +${modifier.percent}%`;
  if (modifier.kind === 'UNIT_ATTACK_PERCENT') return `${scopeLabel(modifier.scope)} 공격력 +${modifier.percent}%`;
  if (modifier.kind === 'STARTING_SUPPLY_PERCENT') return `시작 보급 +${modifier.percent}%`;
  if (modifier.kind === 'PLAYER_BASE_HP_PERCENT') return `아군 거점 HP +${modifier.percent}%`;
  if (modifier.kind === 'KILL_SUPPLY_PERCENT') return `적 처치 보급 +${modifier.percent}%`;
  if (modifier.kind === 'WORKER_COST_REDUCTION_PERCENT') return `보급 업그레이드 비용 -${modifier.percent}%`;
  if (modifier.kind === 'RECHARGE_REDUCTION_PERCENT') return `재생산 시간 -${modifier.percent}%`;
  if (modifier.flag === 'chapter-01-complete') return '제1장 완료 · 레벨 상한 Lv20 · SPECIAL 개방';
  return `진행 플래그 · ${modifier.flag}`;
}

export function getPermanentRewardEffectText(rewardId: string | undefined): string {
  if (!rewardId) return '영구 보상 없음';
  const reward = REWARD_BY_ID.get(rewardId);
  if (!reward) return '영구 보상 정보 확인 필요';
  return reward.modifiers.map(modifierLabel).join(' · ');
}
