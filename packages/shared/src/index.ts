export const APP_NAME = 'Frontline Summoners';
export const SIM_TICK_RATE = 30;
export const INTERNAL_WIDTH = 1280;
export const INTERNAL_HEIGHT = 720;

export const COOP_QUICK_MESSAGE_IDS = [
  'READY',
  'SUPPLY_UP',
  'FRONTLINE',
  'BACKLINE',
  'BASE_WEAPON',
  'DANGER',
  'WAIT',
  'NICE',
] as const;
export type CoopQuickMessageId = (typeof COOP_QUICK_MESSAGE_IDS)[number];

export const COOP_QUICK_MESSAGE_LABELS: Readonly<Record<CoopQuickMessageId, string>> = {
  READY: '준비됐어',
  SUPPLY_UP: '보급 올릴게',
  FRONTLINE: '전열 부탁',
  BACKLINE: '후열 부탁',
  BASE_WEAPON: '병기 쓸게',
  DANGER: '위험!',
  WAIT: '기다려',
  NICE: '좋아!',
};
