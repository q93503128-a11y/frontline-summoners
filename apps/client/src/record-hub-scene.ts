import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { BOSS_RUSH_SEQUENCE, RECORD_MODE_DEFINITIONS, isRecordModeUnlocked, type RecordModeId } from './record-content.ts';
import { loadGuestProgress, type GuestProgress } from './save.ts';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function unlockText(modeId: RecordModeId): string {
  return modeId === 'record_endless_front'
    ? '메인 3장 최종전 NORMAL_CLEAR 후 해금'
    : '메인 4장 최종전 NORMAL_CLEAR 후 해금';
}

export class RecordHubScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private layer?: Phaser.GameObjects.Container;

  constructor() { super('record-hub'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 38, '기 록 전', 46, COLORS.cream);
    addText(this, 56, 94, compact ? '최고 기록을 갱신하는 1× 솔로 전투.' : '반복 파밍보다 개인 최고기록 갱신이 목적이다. 두 기록전 모두 1× 고정 · SOLO_ONLY · 소탕 불가.', compact ? 22 : 19, COLORS.muted);
    addButton(this, 985, compact ? 70 : 65, 160, compact ? 84 : 50, '병기', () => this.scene.start('base-weapon'), 0x6d6b8e);
    addButton(this, 1165, compact ? 70 : 65, 160, compact ? 84 : 50, '출정', () => this.scene.start('stage-hub'), 0x586275);
    this.renderModes();

    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      this.renderModes();
    });
  }

  private renderModes(): void {
    this.layer?.destroy(true);
    this.layer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const record = this.progress.recordModeProgress;
    const positions = [390, 890];

    RECORD_MODE_DEFINITIONS.forEach((mode, index) => {
      const x = positions[index] ?? INTERNAL_WIDTH / 2;
      const unlocked = isRecordModeUnlocked(mode.id, this.progress.clearedStageIds);
      const accent = mode.id === 'record_endless_front' ? 0x587d91 : 0x8a5d72;
      const card = this.add.rectangle(x, 385, 430, 430, unlocked ? 0x242c3a : 0x1d222c, 0.98).setStrokeStyle(4, unlocked ? accent : 0x3c4554, 1);
      this.layer!.add(card);
      this.layer!.add(addText(this, x, 205, unlocked ? 'RECORD SPECIAL' : 'LOCKED', compact ? 20 : 16, unlocked ? '#b9d9ec' : '#69727e', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 255, mode.displayName, compact ? 34 : 31, unlocked ? '#ffffff' : '#747d89', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 320, mode.description, compact ? 21 : 18, unlocked ? '#c5cedb' : '#656e7a', 'center').setOrigin(0.5).setWordWrapWidth(370));

      const best = mode.id === 'record_endless_front'
        ? `최고 생존 ${formatDuration(record?.endlessBestTimeMs ?? 0)} · ${record?.endlessBestReachedMinute ?? 0}분 경계`
        : `최고 ${record?.bossRushBestDefeated ?? 0} / ${BOSS_RUSH_SEQUENCE.length} 보스 격파`;
      const claimed = mode.id === 'record_endless_front'
        ? `보상 수령 경계 ${record?.endlessRewardedMinute ?? 0}분`
        : `보상 수령 구간 ${record?.bossRushRewardedDefeated ?? 0}보스`;
      this.layer!.add(addText(this, x, 392, best, compact ? 22 : 19, unlocked ? '#f1d58a' : '#6f6b61', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 430, claimed, compact ? 19 : 16, unlocked ? '#9fb0c3' : '#666f7a', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 470, '1× 고정 · SOLO_ONLY · 소탕 불가', compact ? 19 : 16, unlocked ? '#9dcdb1' : '#626b74', 'center').setOrigin(0.5));
      if (!unlocked) this.layer!.add(addText(this, x, 510, unlockText(mode.id), compact ? 19 : 16, '#8b8290', 'center').setOrigin(0.5));

      const button = addButton(this, x, compact ? 570 : 565, 240, compact ? 84 : 62, unlocked ? '기록 도전' : '잠김', () => {
        if (unlocked) this.scene.start('record-battle', { modeId: mode.id });
      }, unlocked ? accent : 0x3f4855);
      if (!unlocked) button.setAlpha(0.62);
      this.layer!.add(button);
    });

    if (!compact) {
      this.layer.add(addText(this, INTERNAL_WIDTH / 2, 646, '새 정수 분/새 보스 구간을 처음 넘을 때만 성장 보상이 추가된다. 같은 기록 이하 반복 지급은 없다.', 16, '#8995a7', 'center').setOrigin(0.5));
    }
  }
}
