import Phaser from 'phaser';
import { getProfileCosmetic } from '@frontline/sim/achievement-profile';
import { RECORD_PROFILE_HONORS } from '@frontline/sim/record-rewards';
import { RECORD_MODE_DEFINITIONS, BOSS_RUSH_SEQUENCE, isRecordModeUnlocked, type RecordModeId } from './record-content.ts';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress.ts';
import { type GuestProgress, type RecordModeProgress } from './save.ts';
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
    ? '메인 3장 최종전 첫 클리어 후 해금'
    : '메인 4장 최종전 첫 클리어 후 해금';
}

function authorityView(authority: ActiveProgressAuthority): { label: string; kind: 'neutral' | 'online' | 'warning'; detail: string } {
  if (authority === 'ACCOUNT_ONLINE') return { label: '계정 기록', kind: 'online', detail: '최고 기록과 보상이 계정에 저장됩니다.' };
  if (authority === 'ACCOUNT_OFFLINE_CACHE') return { label: '읽기 전용', kind: 'warning', detail: '온라인 연결 후 기록전에 도전할 수 있습니다.' };
  return { label: '로컬 기록', kind: 'neutral', detail: '이 기기에 최고 기록과 보상이 저장됩니다.' };
}

function recordHonorProgressText(modeId: RecordModeId, progress?: RecordModeProgress): string {
  const expectedMode = modeId === 'record_endless_front' ? 'ENDLESS_FRONT' : 'BOSS_RUSH';
  const modeHonors = RECORD_PROFILE_HONORS.filter((honor) => honor.mode === expectedMode);
  const current = modeId === 'record_endless_front'
    ? progress?.endlessBestReachedMinute ?? 0
    : progress?.bossRushBestDefeated ?? 0;
  const reached = modeHonors.filter((honor) => current >= honor.threshold);
  if (reached.length > 0 && reached.length === modeHonors.length) {
    const names = [...new Set(reached.map((honor) => getProfileCosmetic(honor.cosmeticId).name))];
    return `명예 달성 · ${names.join(' · ')}`;
  }
  const pending = modeHonors.filter((honor) => current < honor.threshold);
  if (pending.length === 0) return '모든 기록전 명예 달성';
  const nextThreshold = Math.min(...pending.map((honor) => honor.threshold));
  const nextNames = [...new Set(modeHonors.filter((honor) => honor.threshold === nextThreshold).map((honor) => getProfileCosmetic(honor.cosmeticId).name))];
  const target = modeId === 'record_endless_front' ? `${nextThreshold}분` : `${nextThreshold}/${BOSS_RUSH_SEQUENCE.length}보스`;
  return `다음 명예 · ${target} · ${nextNames.join(' · ')}`;
}

export class RecordHubScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private layer?: Phaser.GameObjects.Container;

  constructor() { super('record-hub'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 28, '기록전', compact ? 42 : 44, COLORS.cream);
    addText(this, 56, 77, '반복 파밍이 아니라 개인 최고 기록을 갱신하는 도전입니다.', compact ? 17 : 14, COLORS.muted);
    addButton(this, 985, compact ? 60 : 56, 160, compact ? 80 : 50, '거점 병기', () => this.scene.start('base-weapon'), 0x6d6b8e, { tone: 'secondary' });
    addButton(this, 1165, compact ? 60 : 56, 160, compact ? 80 : 50, '전선 지도', () => this.scene.start('stage-hub'), 0x586275, { tone: 'quiet' });
    this.renderModes();

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      this.authority = view.authority;
      this.renderModes();
    }).catch(() => {
      if (!this.scene.isActive()) return;
      this.authority = 'ACCOUNT_OFFLINE_CACHE';
      this.renderModes();
    });
  }

  private renderModes(): void {
    this.layer?.destroy(true);
    this.layer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const record = this.progress.recordModeProgress;
    const authority = authorityView(this.authority);

    this.layer.add(addStatusPill(this, 160, 128, authority.label, authority.kind));
    this.layer.add(addText(this, 286, 122, authority.detail, compact ? 16 : 13, this.authority === 'ACCOUNT_OFFLINE_CACHE' ? '#e5bc88' : '#9eabbc'));
    this.layer.add(addSectionHeading(this, 54, 160, '도전 선택', 1168, 0x75869b));

    RECORD_MODE_DEFINITIONS.forEach((mode, index) => {
      const x = index === 0 ? 335 : 945;
      const unlocked = isRecordModeUnlocked(mode.id, this.progress.clearedStageIds);
      const canChallenge = unlocked && this.authority !== 'ACCOUNT_OFFLINE_CACHE';
      const endless = mode.id === 'record_endless_front';
      const accent = endless ? 0x5f8ea4 : 0x9a687d;
      const fill = unlocked ? (endless ? 0x192a32 : 0x2a2028) : 0x191f27;

      this.layer!.add(addCommandPanel(this, x, 412, 560, 470, unlocked ? accent : 0x46505d, fill, 0.96));
      this.layer!.add(addStatusPill(this, x - 240, 204, unlocked ? '도전 가능' : '잠김', unlocked ? 'neutral' : 'warning'));

      const medallion = this.add.graphics();
      medallion.fillStyle(unlocked ? accent : 0x4b535e, 0.26).fillCircle(x, 267, 52);
      medallion.lineStyle(4, unlocked ? accent : 0x58616d, unlocked ? 0.82 : 0.45).strokeCircle(x, 267, 43);
      if (endless) {
        medallion.lineStyle(4, unlocked ? 0xb9e4ef : 0x6a737f, 0.8).strokeCircle(x, 267, 23);
        medallion.lineBetween(x, 236, x, 298);
      } else {
        medallion.fillStyle(unlocked ? 0xe1b5c4 : 0x69727d, 0.74).fillTriangle(x, 238, x - 29, 293, x + 29, 293);
        medallion.fillStyle(fill, 1).fillCircle(x, 270, 9);
      }
      this.layer!.add(medallion);

      this.layer!.add(addText(this, x, 332, mode.displayName, compact ? 29 : 26, unlocked ? '#ffffff' : '#7d8692', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 370, mode.description, compact ? 17 : 14, unlocked ? '#c4ceda' : '#717a86', 'center').setOrigin(0.5).setWordWrapWidth(440));
      this.layer!.add(addText(this, x, 418, '1× 고정 · 혼자 도전 · 소탕 없음', compact ? 16 : 13, unlocked ? '#a8cfba' : '#6b737c', 'center').setOrigin(0.5));

      const best = endless
        ? `최고 생존 ${formatDuration(record?.endlessBestTimeMs ?? 0)} · ${record?.endlessBestReachedMinute ?? 0}분`
        : `최고 ${record?.bossRushBestDefeated ?? 0}/${BOSS_RUSH_SEQUENCE.length} 보스`;
      const claimed = endless
        ? `보상 경계 ${record?.endlessRewardedMinute ?? 0}분`
        : `보상 구간 ${record?.bossRushRewardedDefeated ?? 0}보스`;

      this.layer!.add(addSectionHeading(this, x - 225, 458, '내 기록', 450, accent));
      this.layer!.add(addText(this, x, 500, best, compact ? 19 : 16, unlocked ? '#f2d78e' : '#777167', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 534, claimed, compact ? 16 : 13, unlocked ? '#abb9ca' : '#707883', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 570, recordHonorProgressText(mode.id, record), compact ? 15 : 12, unlocked ? '#ddc88f' : '#70706c', 'center').setOrigin(0.5).setWordWrapWidth(440));

      const action = addButton(this, x, 626, 230, compact ? 82 : 58, canChallenge ? '기록 도전' : unlocked ? '온라인 필요' : '잠김', () => {
        if (canChallenge) this.scene.start('record-battle', { modeId: mode.id });
      }, canChallenge ? accent : 0x4b535f, { tone: canChallenge ? 'primary' : 'quiet' });
      this.layer!.add(action);
      if (!unlocked) setButtonState(action, 'locked', unlockText(mode.id));
      else if (!canChallenge) setButtonState(action, 'disabled', '온라인 연결 후 기록전에 도전할 수 있습니다.');

      if (!unlocked) {
        this.layer!.add(addText(this, x, 672, unlockText(mode.id), compact ? 14 : 11, '#a08f9d', 'center').setOrigin(0.5).setWordWrapWidth(420));
      }
    });
  }
}

export const __recordHubSceneTestOnly = { recordHonorProgressText };
