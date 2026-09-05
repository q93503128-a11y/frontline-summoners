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
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
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
    addText(this, 48, 28, '지휘 장비 설정', compact ? 42 : 46, COLORS.cream);
    addText(this, 50, 80, '접근성 · 전장 표현 · 오디오 값을 지휘 장비판에서 즉시 조정한다.', compact ? 18 : 16, COLORS.muted);
    addStatusPill(this, 930, 106, '이 브라우저에 즉시 저장', 'neutral');
    addButton(this, 1170, compact ? 61 : 56, 170, compact ? 82 : 50, '지휘소', () => this.scene.start('main-menu'), 0x586275, { tone: 'quiet' });
    this.render();
  }

  private render(): void {
    this.content?.destroy(true);
    this.content = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const rowHeight = compact ? 60 : 48;

    this.content.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 390, 1170, 492, 0x647184, 0x1b222c, 0.94));
    this.drawSwitchboardRails();

    this.content.add(addSectionHeading(this, 70, 166, '접근성 우선', 330, 0x627f9a));
    this.content.add(addSectionHeading(this, 460, 166, '전장 표현', 330, 0x6f8062));
    this.content.add(addSectionHeading(this, 850, 166, '오디오 통신', 330, 0x8b745c));

    this.settingRow(72, 214, 300, rowHeight, 'UI 크기', `${this.settings.uiScalePercent}%`, () => {
      this.change({ uiScalePercent: cycleSettingValue(this.settings.uiScalePercent, UI_SCALE_VALUES) });
    }, false, 0x627f9a);
    this.settingRow(72, 274, 300, rowHeight, '고대비', ON_OFF(this.settings.highContrast), () => {
      this.change({ highContrast: !this.settings.highContrast });
    }, this.settings.highContrast, 0x627f9a);
    this.settingRow(72, 334, 300, rowHeight, '화면 흔들림', `${this.settings.screenShakePercent}%`, () => {
      this.change({ screenShakePercent: cycleSettingValue(this.settings.screenShakePercent, SCREEN_SHAKE_VALUES) });
    }, this.settings.screenShakePercent < 100, 0x627f9a);
    this.settingRow(72, 394, 300, rowHeight, '강한 번쩍임 줄이기', ON_OFF(this.settings.reduceFlashes), () => {
      this.change({ reduceFlashes: !this.settings.reduceFlashes });
    }, this.settings.reduceFlashes, 0x627f9a);
    this.settingRow(72, 454, 300, rowHeight, '움직임 줄이기', ON_OFF(this.settings.reduceMotion), () => {
      this.change({ reduceMotion: !this.settings.reduceMotion });
    }, this.settings.reduceMotion, 0x627f9a);
    this.content.add(addText(this, 236, 531, '핵심 위험 표시는 색·소리 하나에만 의존하지 않습니다.', compact ? 15 : 12, '#9fb1c6', 'center').setOrigin(0.5).setWordWrapWidth(318));

    this.settingRow(462, 214, 300, rowHeight, '품질', GRAPHICS_LABEL[this.settings.graphicsPreset], () => {
      this.change({ graphicsPreset: cycleSettingValue(this.settings.graphicsPreset, GRAPHICS_PRESETS) });
    }, this.settings.graphicsPreset === 'LOW', 0x6f8062);
    this.settingRow(462, 274, 300, rowHeight, 'VFX 밀도', VFX_LABEL[this.settings.vfxDensity], () => {
      this.change({ vfxDensity: cycleSettingValue(this.settings.vfxDensity, VFX_DENSITIES) });
    }, this.settings.vfxDensity === 'LOW', 0x6f8062);
    this.settingRow(462, 334, 300, rowHeight, '배터리 절약', ON_OFF(this.settings.batterySaver), () => {
      this.change({ batterySaver: !this.settings.batterySaver });
    }, this.settings.batterySaver, 0x6f8062);
    this.settingRow(462, 394, 300, rowHeight, '스토리 연출 자동 건너뛰기', ON_OFF(this.settings.autoSkipStory), () => {
      this.change({ autoSkipStory: !this.settings.autoSkipStory });
    }, this.settings.autoSkipStory, 0x6f8062);
    this.content.add(addText(this, 626, 486, '낮은 품질·VFX·배터리 절약은 장식 효과만 줄입니다.', compact ? 15 : 12, '#a8b8a1', 'center').setOrigin(0.5).setWordWrapWidth(320));
    this.content.add(addText(this, 626, 530, '스토리 자동 건너뛰기는 장면을 렌더하지 않지만 전투 판정은 유지합니다.', compact ? 14 : 11, '#91a28d', 'center').setOrigin(0.5).setWordWrapWidth(320));

    this.settingRow(852, 214, 300, rowHeight, '전체 음량', `${this.settings.masterVolume}%`, () => {
      this.change({ masterVolume: cycleSettingValue(this.settings.masterVolume, AUDIO_VOLUME_VALUES) });
    }, this.settings.masterVolume === 0, 0x8b745c);
    this.settingRow(852, 274, 300, rowHeight, '음악', `${this.settings.musicVolume}%`, () => {
      this.change({ musicVolume: cycleSettingValue(this.settings.musicVolume, AUDIO_VOLUME_VALUES) });
    }, this.settings.musicVolume === 0, 0x8b745c);
    this.settingRow(852, 334, 300, rowHeight, '효과음', `${this.settings.sfxVolume}%`, () => {
      this.change({ sfxVolume: cycleSettingValue(this.settings.sfxVolume, AUDIO_VOLUME_VALUES) });
    }, this.settings.sfxVolume === 0, 0x8b745c);
    this.settingRow(852, 394, 300, rowHeight, '메뉴·알림', `${this.settings.uiVolume}%`, () => {
      this.change({ uiVolume: cycleSettingValue(this.settings.uiVolume, AUDIO_VOLUME_VALUES) });
    }, this.settings.uiVolume === 0, 0x8b745c);
    this.content.add(addText(this, 1016, 486, '전체 음량 0%는 게임의 모든 소리를 음소거합니다.', compact ? 15 : 12, '#c5b39e', 'center').setOrigin(0.5).setWordWrapWidth(320));
    this.content.add(addText(this, 1016, 530, '음악·효과음·메뉴 알림 음량은 전체 음량과 함께 적용됩니다.', compact ? 14 : 11, '#a99c8e', 'center').setOrigin(0.5).setWordWrapWidth(320));

    const reset = addButton(this, INTERNAL_WIDTH / 2, compact ? 665 : 657, 310, compact ? 78 : 54, '기본값으로 초기화', () => this.reset(), 0x7a5e61, { tone: 'danger' });
    this.content.add(reset);
  }

  private drawSwitchboardRails(): void {
    const g = this.add.graphics();
    g.lineStyle(2, 0x576273, 0.35).lineBetween(430, 176, 430, 608);
    g.lineStyle(2, 0x576273, 0.35).lineBetween(820, 176, 820, 608);
    for (const x of [88, 478, 868]) {
      g.lineStyle(2, 0x8a7655, 0.34).lineBetween(x, 187, x, 482);
      for (let y = 214; y <= 454; y += 60) {
        g.fillStyle(0xa78a59, 0.72).fillCircle(x, y, 4);
        g.lineStyle(1, 0x171b22, 0.8).strokeCircle(x, y, 4);
      }
    }
    for (const x of [72, 1208]) {
      for (const y of [166, 608]) {
        g.fillStyle(0xb59b67, 0.62).fillCircle(x, y, 5);
      }
    }
    this.content!.add(g);
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
    this.content!.add(addText(this, x + 28, y - 10, label, compact ? 17 : 15, active ? '#f0e8ce' : '#c5cfdb'));
    this.content!.add(this.add.rectangle(x + 165, y + 27, width, 1, accent, active ? 0.38 : 0.18));
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
