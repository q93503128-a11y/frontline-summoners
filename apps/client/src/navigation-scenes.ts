import Phaser from 'phaser';
import { APP_NAME, INTERNAL_WIDTH } from '@frontline/shared';
import { loadActiveProgress } from './active-progress';
import {
  ALL_PLAYER_SLOTS,
  SPECIAL_STAGES,
  STAGES,
} from './prototype';
import { getRuntimeSpriteStrips } from './production-assets.ts';
import { getOwnedCharacterIds } from './save';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload(): void {
    drawBackdrop(this, 'menu');
    addText(this, INTERNAL_WIDTH / 2, 260, '전선소환전', 58, COLORS.cream, 'center').setOrigin(0.5);
    const status = addText(this, INTERNAL_WIDTH / 2, 350, '캐릭터 불러오는 중…', 24, COLORS.muted, 'center').setOrigin(0.5);
    this.add.rectangle(INTERNAL_WIDTH / 2, 410, 520, 20, 0x10141d).setStrokeStyle(2, 0x67738a);
    const bar = this.add.rectangle(INTERNAL_WIDTH / 2 - 256, 410, 1, 12, 0xf0c967).setOrigin(0, 0.5);
    this.load.setCORS('anonymous');
    for (const strip of getRuntimeSpriteStrips()) {
      if (!this.textures.exists(strip.key)) this.load.spritesheet(strip.key, strip.url, { frameWidth: strip.frameWidth, frameHeight: strip.frameHeight });
    }
    this.load.on('progress', (value: number) => bar.displayWidth = Math.max(1, 512 * value));
    this.load.on('loaderror', (file: { key?: string }) => status.setText(`일부 캐릭터 로드 실패 · 대체 표시 사용 예정 ${file.key ?? ''}`));
  }

  create(): void { this.scene.start('main-menu'); }
}

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('main-menu'); }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    addText(this, compact ? 70 : 84, compact ? 60 : 84, '전선소환전', compact ? 60 : 70, COLORS.cream);
    addText(this, compact ? 74 : 88, compact ? 132 : 165, APP_NAME, compact ? 22 : 24, '#9fb0c6');
    addText(this, compact ? 74 : 88, compact ? 188 : 230, compact ? '별난 영웅을 모아 전선을 밀어붙여라.' : '별난 영웅들을 모아 전선을 밀어붙여라.', compact ? 30 : 29, '#e8edf6');
    addText(this, compact ? 74 : 88, compact ? 238 : 272, compact ? '승리할수록 전선과 동료가 열린다.' : '첫 출정은 징집병 하나. 승리할수록 전선과 동료가 열린다.', compact ? 24 : 22, COLORS.muted);

    this.add.rectangle(compact ? 1020 : 1040, compact ? 120 : 105, compact ? 390 : 320, compact ? 145 : 110, 0x222936, 0.96).setStrokeStyle(2, 0x556077);
    const authorityText = addText(this, compact ? 850 : 900, compact ? 78 : 72, '진행 불러오는 중…', compact ? 28 : 26, '#ffffff');
    const progressText = addText(this, compact ? 850 : 900, compact ? 122 : 110, '진행도 불러오는 중…', compact ? 22 : 18, COLORS.muted);

    const menuButtonHeight = compact ? 108 : 92;
    addButton(this, 170, compact ? 425 : 435, 250, menuButtonHeight, '출 정', () => this.scene.start('stage-hub'), 0xc5a04c);
    addButton(this, 480, compact ? 425 : 435, 250, menuButtonHeight, '편 성', () => this.scene.start('deck'), 0x5f8fb8);
    addButton(this, 790, compact ? 425 : 435, 250, menuButtonHeight, '모 집', () => this.scene.start('recruitment'), 0x8b6fb5);
    addButton(this, 1100, compact ? 425 : 435, 250, menuButtonHeight, '도 감', () => this.scene.start('catalog'), 0x8c7650);
    addText(this, compact ? 74 : 88, compact ? 610 : 628, compact ? '첫 NORMAL_CLEAR 영구 보상 · 에너지 제한 없음' : '출정에서 전선 묶음을 고른 뒤 스테이지로 진입 · 에너지 제한 없음', compact ? 24 : 20, '#9cd6ad');
    if (!compact) addText(this, 1185, 675, 'PRE-ALPHA', 17, '#657086').setOrigin(1, 0.5);

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      const progress = view.progress;
      const owned = getOwnedCharacterIds(progress).length;
      authorityText.setText(view.authority === 'GUEST_LOCAL'
        ? '게스트 지휘관'
        : view.authority === 'ACCOUNT_ONLINE'
          ? '계정 지휘관 · 서버'
          : '계정 지휘관 · 오프라인');
      authorityText.setColor(view.authority === 'ACCOUNT_ONLINE' ? '#8ee3aa' : view.authority === 'ACCOUNT_OFFLINE_CACHE' ? '#f2d37c' : '#ffffff');
      progressText.setText(compact
        ? `진도 ${progress.clearedStageIds.length}/${STAGES.length} · 특수 ${progress.specialClearedStageIds.length}/${SPECIAL_STAGES.length} · 동료 ${owned}`
        : `진도 ${progress.clearedStageIds.length}/${STAGES.length} · 특수 ${progress.specialClearedStageIds.length}/${SPECIAL_STAGES.length} · 영구 보상 ${progress.permanentRewardIds.length}/${STAGES.length} · 동료 ${owned}/${ALL_PLAYER_SLOTS.length}`);
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      authorityText.setText('진행 정보 오류').setColor('#ff9a91');
      progressText.setText(error instanceof Error ? error.message : '진행 정보를 읽지 못했습니다.');
    });
  }
}
