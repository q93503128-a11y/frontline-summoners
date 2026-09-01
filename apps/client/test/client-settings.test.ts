import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  AUDIO_VOLUME_VALUES,
  CLIENT_SETTINGS_STORAGE_KEY,
  DEFAULT_CLIENT_SETTINGS,
  UI_SCALE_VALUES,
  cycleSettingValue,
  getEffectiveAudioBusGain,
  getScreenShakeFactor,
  getUiScaleFactor,
  loadClientSettings,
  normalizeClientSettings,
  saveClientSettings,
  shouldReduceDecorativeEffects,
  shouldUseReducedMotion,
  type SettingsStorage,
} from '../src/client-settings.ts';

class MemoryStorage implements SettingsStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

test('client settings reject unknown enum values while preserving valid accessibility preferences', () => {
  const normalized = normalizeClientSettings({
    schemaVersion: 999,
    uiScalePercent: 125,
    highContrast: true,
    screenShakePercent: 37,
    reduceFlashes: true,
    reduceMotion: true,
    graphicsPreset: 'ULTRA',
    vfxDensity: 'LOW',
    batterySaver: true,
    masterVolume: 50,
    musicVolume: 999,
    sfxVolume: 25,
    uiVolume: 0,
  });
  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.uiScalePercent, 125);
  assert.equal(normalized.highContrast, true);
  assert.equal(normalized.screenShakePercent, DEFAULT_CLIENT_SETTINGS.screenShakePercent);
  assert.equal(normalized.reduceFlashes, true);
  assert.equal(normalized.reduceMotion, true);
  assert.equal(normalized.graphicsPreset, DEFAULT_CLIENT_SETTINGS.graphicsPreset);
  assert.equal(normalized.vfxDensity, 'LOW');
  assert.equal(normalized.batterySaver, true);
  assert.equal(normalized.masterVolume, 50);
  assert.equal(normalized.musicVolume, DEFAULT_CLIENT_SETTINGS.musicVolume);
  assert.equal(normalized.sfxVolume, 25);
  assert.equal(normalized.uiVolume, 0);
});

test('settings survive storage round-trip and corrupt storage falls back safely', () => {
  const storage = new MemoryStorage();
  const saved = saveClientSettings({ ...DEFAULT_CLIENT_SETTINGS, uiScalePercent: 110, highContrast: true }, storage);
  assert.equal(saved.uiScalePercent, 110);
  assert.equal(JSON.parse(storage.getItem(CLIENT_SETTINGS_STORAGE_KEY) ?? '{}').highContrast, true);
  assert.deepEqual(loadClientSettings(storage), saved);
  storage.setItem(CLIENT_SETTINGS_STORAGE_KEY, '{broken');
  assert.deepEqual(loadClientSettings(storage), DEFAULT_CLIENT_SETTINGS);
});

test('derived accessibility and audio controls have deterministic effective values', () => {
  const settings = normalizeClientSettings({
    ...DEFAULT_CLIENT_SETTINGS,
    uiScalePercent: 125,
    screenShakePercent: 50,
    graphicsPreset: 'LOW',
    batterySaver: true,
    masterVolume: 50,
    musicVolume: 50,
    sfxVolume: 25,
    uiVolume: 100,
  });
  assert.equal(getUiScaleFactor(settings), 1.25);
  assert.equal(getScreenShakeFactor(settings), 0.5);
  assert.equal(shouldReduceDecorativeEffects(settings), true);
  assert.equal(shouldUseReducedMotion(settings), true, 'battery saver also suppresses decorative motion');
  assert.equal(getEffectiveAudioBusGain('MUSIC', settings), 0.25);
  assert.equal(getEffectiveAudioBusGain('BATTLE_SFX', settings), 0.125);
  assert.equal(getEffectiveAudioBusGain('UI_SFX', settings), 0.5);
  assert.equal(getEffectiveAudioBusGain('AMBIENCE', settings), 0.125);
});

test('settings cycle authored values without creating arbitrary intermediate states', () => {
  assert.equal(cycleSettingValue(100, UI_SCALE_VALUES), 110);
  assert.equal(cycleSettingValue(125, UI_SCALE_VALUES), 90);
  assert.equal(cycleSettingValue(75, AUDIO_VOLUME_VALUES), 100);
  assert.equal(cycleSettingValue(100, AUDIO_VOLUME_VALUES), 0);
});

test('main menu registers settings and shared UI consumes accessibility preferences', async () => {
  const [main, ui, scene] = await Promise.all([
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/scene-ui.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/settings-scene.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(main, /import \{ SettingsScene \} from '\.\/settings-scene'/);
  assert.match(main, /this\.scene\.start\('settings'\)/);
  assert.match(main, /game\.scene\.add\('settings', SettingsScene, false\)/);
  assert.match(ui, /getUiScaleFactor\(settings\)/);
  assert.match(ui, /settings\.highContrast/);
  assert.match(ui, /shouldReduceDecorativeEffects\(settings\)/);
  assert.match(ui, /shouldUseReducedMotion\(\)/);
  assert.match(scene, /강한 번쩍임 줄이기/);
  assert.match(scene, /화면 흔들림/);
  assert.match(scene, /배터리 절약/);
  assert.match(scene, /Master/);
});
