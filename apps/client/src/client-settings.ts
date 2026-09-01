export const CLIENT_SETTINGS_STORAGE_KEY = 'frontline-summoners:client-settings:v1';

export const UI_SCALE_VALUES = [90, 100, 110, 125] as const;
export type UiScalePercent = (typeof UI_SCALE_VALUES)[number];

export const SCREEN_SHAKE_VALUES = [0, 50, 100] as const;
export type ScreenShakePercent = (typeof SCREEN_SHAKE_VALUES)[number];

export const GRAPHICS_PRESETS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type GraphicsPreset = (typeof GRAPHICS_PRESETS)[number];

export const VFX_DENSITIES = ['LOW', 'NORMAL', 'HIGH'] as const;
export type VfxDensity = (typeof VFX_DENSITIES)[number];

export const AUDIO_VOLUME_VALUES = [0, 25, 50, 75, 100] as const;
export type AudioVolumePercent = (typeof AUDIO_VOLUME_VALUES)[number];

export interface ClientSettingsV1 {
  readonly schemaVersion: 1;
  readonly uiScalePercent: UiScalePercent;
  readonly highContrast: boolean;
  readonly screenShakePercent: ScreenShakePercent;
  readonly reduceFlashes: boolean;
  readonly reduceMotion: boolean;
  readonly autoSkipStory: boolean;
  readonly graphicsPreset: GraphicsPreset;
  readonly vfxDensity: VfxDensity;
  readonly batterySaver: boolean;
  readonly masterVolume: AudioVolumePercent;
  readonly musicVolume: AudioVolumePercent;
  readonly sfxVolume: AudioVolumePercent;
  readonly uiVolume: AudioVolumePercent;
}

export const DEFAULT_CLIENT_SETTINGS: ClientSettingsV1 = Object.freeze({
  schemaVersion: 1,
  uiScalePercent: 100,
  highContrast: false,
  screenShakePercent: 100,
  reduceFlashes: false,
  reduceMotion: false,
  autoSkipStory: false,
  graphicsPreset: 'MEDIUM',
  vfxDensity: 'NORMAL',
  batterySaver: false,
  masterVolume: 100,
  musicVolume: 75,
  sfxVolume: 100,
  uiVolume: 100,
});

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

type MutableSettings = { -readonly [K in keyof ClientSettingsV1]: ClientSettingsV1[K] };

type AudioBus = 'MUSIC' | 'BATTLE_SFX' | 'UI_SFX' | 'AMBIENCE';

type SettingsListener = (settings: ClientSettingsV1) => void;

const listeners = new Set<SettingsListener>();
let cachedSettings: ClientSettingsV1 | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function browserStorage(): SettingsStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function normalizeClientSettings(value: unknown): ClientSettingsV1 {
  const raw = isRecord(value) ? value : {};
  return {
    schemaVersion: 1,
    uiScalePercent: oneOf(raw.uiScalePercent, UI_SCALE_VALUES, DEFAULT_CLIENT_SETTINGS.uiScalePercent),
    highContrast: boolean(raw.highContrast, DEFAULT_CLIENT_SETTINGS.highContrast),
    screenShakePercent: oneOf(raw.screenShakePercent, SCREEN_SHAKE_VALUES, DEFAULT_CLIENT_SETTINGS.screenShakePercent),
    reduceFlashes: boolean(raw.reduceFlashes, DEFAULT_CLIENT_SETTINGS.reduceFlashes),
    reduceMotion: boolean(raw.reduceMotion, DEFAULT_CLIENT_SETTINGS.reduceMotion),
    autoSkipStory: boolean(raw.autoSkipStory, DEFAULT_CLIENT_SETTINGS.autoSkipStory),
    graphicsPreset: oneOf(raw.graphicsPreset, GRAPHICS_PRESETS, DEFAULT_CLIENT_SETTINGS.graphicsPreset),
    vfxDensity: oneOf(raw.vfxDensity, VFX_DENSITIES, DEFAULT_CLIENT_SETTINGS.vfxDensity),
    batterySaver: boolean(raw.batterySaver, DEFAULT_CLIENT_SETTINGS.batterySaver),
    masterVolume: oneOf(raw.masterVolume, AUDIO_VOLUME_VALUES, DEFAULT_CLIENT_SETTINGS.masterVolume),
    musicVolume: oneOf(raw.musicVolume, AUDIO_VOLUME_VALUES, DEFAULT_CLIENT_SETTINGS.musicVolume),
    sfxVolume: oneOf(raw.sfxVolume, AUDIO_VOLUME_VALUES, DEFAULT_CLIENT_SETTINGS.sfxVolume),
    uiVolume: oneOf(raw.uiVolume, AUDIO_VOLUME_VALUES, DEFAULT_CLIENT_SETTINGS.uiVolume),
  };
}

export function loadClientSettings(storage: SettingsStorage | null = browserStorage()): ClientSettingsV1 {
  if (!storage) return DEFAULT_CLIENT_SETTINGS;
  try {
    const encoded = storage.getItem(CLIENT_SETTINGS_STORAGE_KEY);
    if (!encoded) return DEFAULT_CLIENT_SETTINGS;
    return normalizeClientSettings(JSON.parse(encoded));
  } catch {
    return DEFAULT_CLIENT_SETTINGS;
  }
}

export function getClientSettings(): ClientSettingsV1 {
  if (!cachedSettings) cachedSettings = loadClientSettings();
  return cachedSettings;
}

function publish(settings: ClientSettingsV1): ClientSettingsV1 {
  cachedSettings = settings;
  for (const listener of listeners) listener(settings);
  return settings;
}

export function saveClientSettings(
  value: unknown,
  storage: SettingsStorage | null = browserStorage(),
): ClientSettingsV1 {
  const settings = normalizeClientSettings(value);
  if (storage) {
    try {
      storage.setItem(CLIENT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // A storage quota/privacy failure must never make the game unusable.
    }
  }
  return publish(settings);
}

export function updateClientSettings(
  patch: Partial<Omit<ClientSettingsV1, 'schemaVersion'>>,
  storage: SettingsStorage | null = browserStorage(),
): ClientSettingsV1 {
  return saveClientSettings({ ...getClientSettings(), ...patch, schemaVersion: 1 }, storage);
}

export function resetClientSettings(storage: SettingsStorage | null = browserStorage()): ClientSettingsV1 {
  if (storage?.removeItem) {
    try {
      storage.removeItem(CLIENT_SETTINGS_STORAGE_KEY);
    } catch {
      // Ignore browser storage restrictions and still reset the in-memory state.
    }
  }
  return publish({ ...DEFAULT_CLIENT_SETTINGS });
}

export function subscribeClientSettings(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function cycleSettingValue<T extends string | number>(current: T, values: readonly T[]): T {
  const index = values.indexOf(current);
  return values[(index < 0 ? 0 : index + 1) % values.length] ?? values[0] ?? current;
}

export function getUiScaleFactor(settings = getClientSettings()): number {
  return settings.uiScalePercent / 100;
}

export function getScreenShakeFactor(settings = getClientSettings()): number {
  return settings.screenShakePercent / 100;
}

export function shouldReduceDecorativeEffects(settings = getClientSettings()): boolean {
  return settings.graphicsPreset === 'LOW' || settings.vfxDensity === 'LOW' || settings.batterySaver;
}

export function shouldUseReducedMotion(settings = getClientSettings()): boolean {
  return settings.reduceMotion || settings.batterySaver;
}

export function shouldUseStrongFlash(settings = getClientSettings()): boolean {
  return !settings.reduceFlashes;
}

export function getEffectiveAudioBusGain(bus: AudioBus, settings = getClientSettings()): number {
  const master = settings.masterVolume / 100;
  const child = bus === 'MUSIC'
    ? settings.musicVolume
    : bus === 'UI_SFX'
      ? settings.uiVolume
      : settings.sfxVolume;
  return master * child / 100;
}

export function copyClientSettings(settings = getClientSettings()): MutableSettings {
  return { ...settings };
}
