import Phaser from 'phaser';
import type { BattleUnit } from '@frontline/sim';
import { getEffectiveAudioBusGain } from './client-settings.ts';
import { getReviewAttackFxStyle, isFirstSliceProductionReviewMode } from './first-slice-production-review-runtime.ts';
import type { AttackFxStyle } from './assets.ts';

export type FirstSliceReviewAudioBus = 'MUSIC' | 'BATTLE_SFX';

export interface FirstSliceReviewAudioAsset {
  readonly key: string;
  readonly url: string;
  readonly bus: FirstSliceReviewAudioBus;
  readonly baseVolume: number;
}

const AUDIO_ROOT = '/assets/production/audio';
export const FIRST_SLICE_REVIEW_AUDIO: readonly FirstSliceReviewAudioAsset[] = [
  { key: 'review-audio-ch01-battle', url: `${AUDIO_ROOT}/music/chapter-01/battle-loop.wav`, bus: 'MUSIC', baseVolume: 0.42 },
  { key: 'review-audio-slash', url: `${AUDIO_ROOT}/sfx/battle-core/slash-contact.wav`, bus: 'BATTLE_SFX', baseVolume: 0.46 },
  { key: 'review-audio-pierce', url: `${AUDIO_ROOT}/sfx/battle-core/pierce-contact.wav`, bus: 'BATTLE_SFX', baseVolume: 0.44 },
  { key: 'review-audio-impact-light', url: `${AUDIO_ROOT}/sfx/battle-core/impact-light.wav`, bus: 'BATTLE_SFX', baseVolume: 0.38 },
  { key: 'review-audio-impact-heavy', url: `${AUDIO_ROOT}/sfx/battle-core/impact-heavy.wav`, bus: 'BATTLE_SFX', baseVolume: 0.5 },
  { key: 'review-audio-boss-warning', url: `${AUDIO_ROOT}/sfx/battle-core/boss-warning.wav`, bus: 'BATTLE_SFX', baseVolume: 0.58 },
  { key: 'review-audio-boss-void', url: `${AUDIO_ROOT}/sfx/battle-core/boss-void-cast.wav`, bus: 'BATTLE_SFX', baseVolume: 0.54 },
] as const;

const AUDIO_BY_KEY = new Map(FIRST_SLICE_REVIEW_AUDIO.map((asset) => [asset.key, asset] as const));
const INSTALL_MARKER = Symbol('first-slice-production-review-audio');

type ReviewAudioHost = Phaser.Scene & {
  [INSTALL_MARKER]?: boolean;
  playAttackFx?(unit: BattleUnit, view: unknown, style: AttackFxStyle): void;
  playUnitImpactFx?(unit: BattleUnit, view: unknown, damageTaken: number): void;
};

export function getFirstSliceReviewAudioAssets(): readonly FirstSliceReviewAudioAsset[] {
  return FIRST_SLICE_REVIEW_AUDIO;
}

function play(scene: Phaser.Scene, key: string, volumeScale = 1): void {
  if (!isFirstSliceProductionReviewMode() || !scene.cache.audio.exists(key)) return;
  const asset = AUDIO_BY_KEY.get(key);
  if (!asset) return;
  const gain = getEffectiveAudioBusGain(asset.bus) * asset.baseVolume * volumeScale;
  if (gain <= 0.001) return;
  scene.sound.play(key, { volume: Math.min(1, gain) });
}

function attackAudioKey(style: AttackFxStyle, unitId: string): string {
  if (unitId === 'enemy-boss') return 'review-audio-boss-void';
  if (style === 'PIERCE') return 'review-audio-pierce';
  return 'review-audio-slash';
}

export function playFirstSliceBossWarningAudio(scene: Phaser.Scene): void {
  play(scene, 'review-audio-boss-warning', 1);
}

export function installFirstSliceProductionReviewAudio(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode()) return;
  const host = scene as ReviewAudioHost;
  if (host[INSTALL_MARKER]) return;
  host[INSTALL_MARKER] = true;

  const originalAttack = host.playAttackFx;
  if (typeof originalAttack === 'function') {
    host.playAttackFx = (unit: BattleUnit, view: unknown, style: AttackFxStyle): void => {
      const reviewStyle = getReviewAttackFxStyle(unit.definition.id) ?? style;
      originalAttack.call(scene, unit, view, reviewStyle);
      play(scene, attackAudioKey(reviewStyle, unit.definition.id), unit.definition.id === 'enemy-boss' ? 1 : 0.78);
    };
  }

  const originalImpact = host.playUnitImpactFx;
  if (typeof originalImpact === 'function') {
    host.playUnitImpactFx = (unit: BattleUnit, view: unknown, damageTaken: number): void => {
      originalImpact.call(scene, unit, view, damageTaken);
      const heavy = unit.definition.id === 'enemy-boss' || damageTaken >= Math.max(1, unit.definition.maxHp * 0.12);
      play(scene, heavy ? 'review-audio-impact-heavy' : 'review-audio-impact-light', heavy ? 0.72 : 0.5);
    };
  }
}

export function startFirstSliceProductionReviewMusic(scene: Phaser.Scene): void {
  if (!isFirstSliceProductionReviewMode() || !scene.cache.audio.exists('review-audio-ch01-battle')) return;
  const gain = getEffectiveAudioBusGain('MUSIC') * (AUDIO_BY_KEY.get('review-audio-ch01-battle')?.baseVolume ?? 0.42);
  if (gain <= 0.001) return;
  const music = scene.sound.add('review-audio-ch01-battle', { loop: true, volume: Math.min(1, gain) });
  const start = (): void => {
    if (!music.isPlaying) music.play();
  };
  start();
  scene.input.once('pointerdown', start);
  scene.events.once('shutdown', () => music.destroy());
}
