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
import {
  addButton,
  addSectionHeading,
  addText,
  COLORS,
  drawBackdrop,
  setButtonState,
} from './scene-ui.ts';
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
    addText(this, 48, 28, '설정', compact ? 42 : 44, COLORS.cream);
    addText(this, 50, 77, '접근성, 전장 표현, 소리를 즉시 조정합니다.', compact ? 17 : 14, COLORS.muted);
    addText(this, 914, 94, '변경 내용은 이 기기에 저장됩니다.', compact ? 15 : 12, '#7f8b9a', 'right').setOrigin(1, 0);
    addButton(this, 1170, compact ? 60 : 56, 170, compact ? 80 : 50, '지휘소', () => this.scene.start('main-menu'), 0x586275, { tone: 'quiet' });
    this.render();
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const rowHeight = compact ? 62 : 48;

    const sheet = this.add.graphics();
    sheet.fillStyle(0x151c25, 0.28).fillRect(50, 145, 1180, 470);
    sheet.lineStyle(1, 0x607086, 0.22).lineBetween(50, 145, 1230, 145);
    sheet.lineStyle(1, 0x4f5d6d, 0.18).lineBetween(50, 615, 1230, 615);
    sheet.lineStyle(1, 0x536173, 0.22).lineBetween(430, 176, 430, 586);
    sheet.lineStyle(1, 0x536173, 0.22).lineBetween(820, 176, 820, 586);
    this.content.add(sheet);

    this.content.add(addSectionHeading(this, 72, 170, '접근성', 300, 0x627f9a));
    this.content.add(addSectionHeading(this, 462, 170, '전장 표현', 300, 0x6f8062));
    this.content.add(addSectionHeading(this, 852, 170, '오디오', 300, 0x8b745c));

    this.settingRow(72, 224, 300, rowHeight, 'UI 크기', `${this.settings.uiScalePercent}%`, () => {
      this.change({ uiScalePercent: cycleSettingValue(this.settings.uiScalePercent, UI_SCALE_VALUES) });
    }, false, 0x627f9a);
    this.settingRow(72, 288, 300, rowHeight, '고대비', ON_OFF(this.settings.highContrast), () => {
      this.change({ highContrast: !this.settings.highContrast });
    }, this.settings.highContrast, 0x627f9a);
    this.settingRow(72, 352, 300, rowHeight, '화면 흔들림', `${this.settings.screenShakePercent}%`, () => {
      this.change({ screenShakePercent: cycleSettingValue(this.settings.screenShakePercent, SCREEN_SHAKE_VALUES) });
    }, this.settings.screenShakePercent < 100, 0x627f9a);
    this.settingRow(72, 416, 300, rowHeight, '강한 번쩍임 줄이기', ON_OFF(this.settings.reduceFlashes), () => {
      this.change({ reduceFlashes: !this.settings.reduceFlashes });
    }, this.settings.reduceFlashes, 0x627f9a);
    this.settingRow(72, 480, 300, rowHeight, '움직임 줄이기', ON_OFF(this.settings.reduceMotion), () => {
      this.change({ reduceMotion: !this.settings.reduceMotion });
    }, this.settings.reduceMotion, 0x627f9a);
    this.content.add(addText(this, 72, 551, '위험 표시는 색이나 소리 하나에만 의존하지 않습니다.', compact ? 14 : 12, '#8fa1b6').setWordWrapWidth(300));

    this.settingRow(462, 224, 300, rowHeight, '그래픽 품질', GRAPHICS_LABEL[this.settings.graphicsPreset], () => {
      this.change({ graphicsPreset: cycleSettingValue(this.settings.graphicsPreset, GRAPHICS_PRESETS) });
    }, this.settings.graphicsPreset === 'LOW', 0x6f8062);
    this.settingRow(462, 288, 300, rowHeight, 'VFX 밀도', VFX_LABEL[this.settings.vfxDensity], () => {
      this.change({ vfxDensity: cycleSettingValue(this.settings.vfxDensity, VFX_DENSITIES) });
    }, this.settings.vfxDensity === 'LOW', 0x6f8062);
    this.settingRow(462, 352, 300, rowHeight, '배터리 절약', ON_OFF(this.settings.batterySaver), () => {
      this.change({ batterySaver: !this.settings.batterySaver });
    }, this.settings.batterySaver, 0x6f8062);
    this.settingRow(462, 416, 300, rowHeight, '스토리 자동 건너뛰기', ON_OFF(this.settings.autoSkipStory), () => {
      this.change({ autoSkipStory: !this.settings.autoSkipStory });
    }, this.settings.autoSkipStory, 0x6f8062);
    this.content.add(addText(this, 462, 503, '낮은 품질·VFX·배터리 절약은 장식 효과만 줄입니다.', compact ? 14 : 12, '#97a88f').setWordWrapWidth(300));
    this.content.add(addText(this, 462, 551, '스토리를 건너뛰어도 전투 판정은 그대로 유지됩니다.', compact ? 14 : 12, '#899a84').setWordWrapWidth(300));

    this.settingRow(852, 224, 300, rowHeight, '전체 음량', `${this.settings.masterVolume}%`, () => {
      this.change({ masterVolume: cycleSettingValue(this.settings.masterVolume, AUDIO_VOLUME_VALUES) });
    }, this.settings.masterVolume === 0, 0x8b745c);
    this.settingRow(852, 288, 300, rowHeight, '음악', `${this.settings.musicVolume}%`, () => {
      this.change({ musicVolume: cycleSettingValue(this.settings.musicVolume, AUDIO_VOLUME_VALUES) });
    }, this.settings.musicVolume === 0, 0x8b745c);
    this.settingRow(852, 352, 300, rowHeight, '효과음', `${this.settings.sfxVolume}%`, () => {
      this.change({ sfxVolume: cycleSettingValue(this.settings.sfxVolume, AUDIO_VOLUME_VALUES) });
    }, this.settings.sfxVolume === 0, 0x8b745c);
    this.settingRow(852, 416, 300, rowHeight, '메뉴·알림', `${this.settings.uiVolume}%`, () => {
      this.change({ uiVolume: cycleSettingValue(this.settings.uiVolume, AUDIO_VOLUME_VALUES) });
    }, this.settings.uiVolume === 0, 0x8b745c);
    this.content.add(addText(this, 852, 503, '전체 음량 0%는 모든 게임 소리를 음소거합니다.', compact ? 14 : 12, '#b7a592').setWordWrapWidth(300));
    this.content.add(addText(this, 852, 551, '세부 음량은 전체 음량과 함께 적용됩니다.', compact ? 14 : 12, '#9f9285').setWordWrapWidth(300));

    const reset = addButton(this, INTERNAL_WIDTH / 2, compact ? 666 : 655, 280, compact ? 78 : 52, '기본값으로 되돌리기', () => this.reset(), 0x66727f, { tone: 'quiet' });
    this.content.add(reset);
  }

  private settingRow(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    action: () => void,
    active: boolean,
    accent: number,
  ): void {
    const compact = isCompactMobileViewport();
    this.content!.add(addText(this, x, y - 9, label, compact ? 17 : 14, active ? '#f0e8ce' : '#c5cfdb'));
    const control = addButton(this, x + width - 62, y, 128, height, value, action, accent, { tone: 'quiet' });
    if (active) setButtonState(control, 'selected');
    this.content!.add(control);
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
