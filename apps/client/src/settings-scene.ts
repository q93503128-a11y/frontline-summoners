import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import {
  AUDIO_VOLUME_VALUES,
  GRAPHICS_PRESETS,
  SCREEN_SHAKE_VALUES,
  UI_SCALE_VALUES,
  VFX_DENSITIES,
  cycleSettingValue,
  getClientSettings,
  resetClientSettings,
  updateClientSettings,
  type ClientSettingsV1,
} from './client-settings.ts';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

const ON_OFF = (value: boolean): string => value ? '켜짐' : '꺼짐';
const GRAPHICS_LABEL: Readonly<Record<ClientSettingsV1['graphicsPreset'], string>> = {
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
};
const VFX_LABEL: Readonly<Record<ClientSettingsV1['vfxDensity'], string>> = {
  LOW: '낮음',
  NORMAL: '보통',
  HIGH: '높음',
};

export class SettingsScene extends Phaser.Scene {
  private settings: ClientSettingsV1 = getClientSettings();
  private content?: Phaser.GameObjects.Container;

  constructor() { super('settings'); }

  create(): void {
    this.settings = getClientSettings();
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    addText(this, 48, 32, '설 정', compact ? 44 : 48, COLORS.cream);
    addText(this, 50, 88, '접근성 · 그래픽 · 연출 · 오디오 설정은 이 브라우저에 즉시 저장됩니다.', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1170, compact ? 62 : 58, 160, compact ? 80 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    this.render();
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const rowHeight = compact ? 58 : 52;

    this.panel(225, 375, 380, 500, '접근성', 0x627f9a);
    this.settingRow(70, 195, 310, rowHeight, 'UI 크기', `${this.settings.uiScalePercent}%`, () => {
      this.change({ uiScalePercent: cycleSettingValue(this.settings.uiScalePercent, UI_SCALE_VALUES) });
    });
    this.settingRow(70, 257, 310, rowHeight, '고대비', ON_OFF(this.settings.highContrast), () => {
      this.change({ highContrast: !this.settings.highContrast });
    });
    this.settingRow(70, 319, 310, rowHeight, '화면 흔들림', `${this.settings.screenShakePercent}%`, () => {
      this.change({ screenShakePercent: cycleSettingValue(this.settings.screenShakePercent, SCREEN_SHAKE_VALUES) });
    });
    this.settingRow(70, 381, 310, rowHeight, '강한 번쩍임 줄이기', ON_OFF(this.settings.reduceFlashes), () => {
      this.change({ reduceFlashes: !this.settings.reduceFlashes });
    });
    this.settingRow(70, 443, 310, rowHeight, '움직임 줄이기', ON_OFF(this.settings.reduceMotion), () => {
      this.change({ reduceMotion: !this.settings.reduceMotion });
    });
    this.content.add(addText(this, 225, 510, '핵심 위험 표시는 색·소리 하나에만\n의존하지 않는 UI를 유지합니다.', compact ? 15 : 13, '#9fb1c6', 'center').setOrigin(0.5));

    this.panel(640, 375, 380, 500, '그래픽 · 연출', 0x6f8062);
    this.settingRow(485, 195, 310, rowHeight, '품질', GRAPHICS_LABEL[this.settings.graphicsPreset], () => {
      this.change({ graphicsPreset: cycleSettingValue(this.settings.graphicsPreset, GRAPHICS_PRESETS) });
    });
    this.settingRow(485, 257, 310, rowHeight, 'VFX 밀도', VFX_LABEL[this.settings.vfxDensity], () => {
      this.change({ vfxDensity: cycleSettingValue(this.settings.vfxDensity, VFX_DENSITIES) });
    });
    this.settingRow(485, 319, 310, rowHeight, '배터리 절약', ON_OFF(this.settings.batterySaver), () => {
      this.change({ batterySaver: !this.settings.batterySaver });
    });
    this.settingRow(485, 381, 310, rowHeight, '스토리 자동 건너뛰기', ON_OFF(this.settings.autoSkipStory), () => {
      this.change({ autoSkipStory: !this.settings.autoSkipStory });
    });
    this.content.add(addText(this, 640, 474, 'LOW / 낮은 VFX / 배터리 절약은 장식 효과를 줄입니다.\n스토리 자동 건너뛰기는 장면을 렌더하지 않습니다.\n전투 판정·위험 정보는 그대로 유지됩니다.', compact ? 15 : 13, '#a8b8a1', 'center').setOrigin(0.5));

    this.panel(1055, 375, 380, 500, '오디오', 0x8b745c);
    this.settingRow(900, 195, 310, rowHeight, 'Master', `${this.settings.masterVolume}%`, () => {
      this.change({ masterVolume: cycleSettingValue(this.settings.masterVolume, AUDIO_VOLUME_VALUES) });
    });
    this.settingRow(900, 257, 310, rowHeight, 'Music', `${this.settings.musicVolume}%`, () => {
      this.change({ musicVolume: cycleSettingValue(this.settings.musicVolume, AUDIO_VOLUME_VALUES) });
    });
    this.settingRow(900, 319, 310, rowHeight, 'SFX', `${this.settings.sfxVolume}%`, () => {
      this.change({ sfxVolume: cycleSettingValue(this.settings.sfxVolume, AUDIO_VOLUME_VALUES) });
    });
    this.settingRow(900, 381, 310, rowHeight, 'UI', `${this.settings.uiVolume}%`, () => {
      this.change({ uiVolume: cycleSettingValue(this.settings.uiVolume, AUDIO_VOLUME_VALUES) });
    });
    this.content.add(addText(this, 1055, 462, 'Master 0%는 모든 오디오 bus를\n완전히 음소거합니다.', compact ? 16 : 14, '#c5b39e', 'center').setOrigin(0.5));

    this.content.add(addButton(this, INTERNAL_WIDTH / 2, 655, 300, compact ? 76 : 54, '기본값으로 초기화', () => this.reset(), 0x7a5e61));
  }

  private panel(x: number, y: number, width: number, height: number, title: string, accent: number): void {
    const compact = isCompactMobileViewport();
    this.content!.add(this.add.rectangle(x, y, width, height, 0x222936, 0.98).setStrokeStyle(3, accent, 1));
    this.content!.add(addText(this, x, 142, title, compact ? 25 : 23, '#fff4cf', 'center').setOrigin(0.5));
  }

  private settingRow(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    action: () => void,
  ): void {
    const compact = isCompactMobileViewport();
    this.content!.add(addText(this, x, y - 10, label, compact ? 17 : 15, '#c5cfdb'));
    this.content!.add(addButton(this, x + width - 78, y, 145, height, value, action, 0x65758c));
  }

  private change(patch: Partial<Omit<ClientSettingsV1, 'schemaVersion'>>): void {
    this.settings = updateClientSettings(patch);
    this.scene.restart();
  }

  private reset(): void {
    this.settings = resetClientSettings();
    this.scene.restart();
  }
}
