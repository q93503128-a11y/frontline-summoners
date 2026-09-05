import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
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
  if (authority === 'ACCOUNT_ONLINE') return { label: '계정 기록 · 동기화됨', kind: 'online', detail: '도전 결과와 최고 기록이 계정에 저장됩니다.' };
  if (authority === 'ACCOUNT_OFFLINE_CACHE') return { label: '계정 기록 · 읽기 전용', kind: 'warning', detail: '도전과 기록 저장은 온라인 연결 후 사용할 수 있습니다.' };
  return { label: '게스트 기록 · 로컬 저장', kind: 'neutral', detail: '이 기기의 로컬 기록에 최고 기록과 보상이 저장됩니다.' };
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
    addText(this, 54, 34, '기 록 전', compact ? 44 : 48, COLORS.cream);
    addText(this, 56, 88, '반복 파밍이 아니라, 한 번 더 멀리 가는 개인 최고기록 도전.', compact ? 19 : 17, COLORS.muted);
    addButton(this, 985, compact ? 66 : 60, 160, compact ? 84 : 50, '거점 병기', () => this.scene.start('base-weapon'), 0x6d6b8e, { tone: 'secondary' });
    addButton(this, 1165, compact ? 66 : 60, 160, compact ? 84 : 50, '전선 지도', () => this.scene.start('stage-hub'), 0x586275, { tone: 'quiet' });
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

    this.layer.add(addStatusPill(this, 168, 132, authority.label, authority.kind));
    this.layer.add(addText(this, 318, 126, authority.detail, compact ? 17 : 14, this.authority === 'ACCOUNT_OFFLINE_CACHE' ? '#e5bc88' : '#9eabbc'));
    this.layer.add(addSectionHeading(this, 54, 168, '개인 최고기록 보관대', 1168, 0x75869b));

    RECORD_MODE_DEFINITIONS.forEach((mode, index) => {
      const y = 310 + index * 238;
      const unlocked = isRecordModeUnlocked(mode.id, this.progress.clearedStageIds);
      const canChallenge = unlocked && this.authority !== 'ACCOUNT_OFFLINE_CACHE';
      const endless = mode.id === 'record_endless_front';
      const accent = endless ? 0x5f8ea4 : 0x9a687d;
      const fill = unlocked ? (endless ? 0x1b2931 : 0x2b2029) : 0x1a1f27;

      this.layer!.add(addCommandPanel(this, INTERNAL_WIDTH / 2, y, 1160, 208, unlocked ? accent : 0x46505d, fill, 0.94));

      const medallion = this.add.graphics();
      medallion.fillStyle(unlocked ? accent : 0x4b535e, 0.28).fillCircle(122, y, 55);
      medallion.lineStyle(4, unlocked ? accent : 0x58616d, unlocked ? 0.82 : 0.45).strokeCircle(122, y, 46);
      if (endless) {
        medallion.lineStyle(4, unlocked ? 0xb9e4ef : 0x6a737f, 0.8).strokeCircle(122, y, 25);
        medallion.lineBetween(122, y - 34, 122, y + 34);
      } else {
        medallion.fillStyle(unlocked ? 0xe1b5c4 : 0x69727d, 0.74).fillTriangle(122, y - 31, 91, y + 27, 153, y + 27);
        medallion.fillStyle(fill, 1).fillCircle(122, y + 4, 10);
      }
      this.layer!.add(medallion);

      this.layer!.add(addText(this, 204, y - 76, mode.displayName, compact ? 30 : 27, unlocked ? '#ffffff' : '#7d8692'));
      this.layer!.add(addText(this, 206, y - 34, mode.description, compact ? 18 : 15, unlocked ? '#c4ceda' : '#717a86').setWordWrapWidth(420));
      this.layer!.add(addText(this, 206, y + 34, '1× 고정 · 혼자 도전 · 소탕 불가', compact ? 17 : 14, unlocked ? '#a8cfba' : '#6b737c'));

      const best = endless
        ? `최고 생존 ${formatDuration(record?.endlessBestTimeMs ?? 0)} · ${record?.endlessBestReachedMinute ?? 0}분 경계`
        : `최고 ${record?.bossRushBestDefeated ?? 0} / ${BOSS_RUSH_SEQUENCE.length} 보스 격파`;
      const claimed = endless
        ? `보상 수령 경계 · ${record?.endlessRewardedMinute ?? 0}분`
        : `보상 수령 구간 · ${record?.bossRushRewardedDefeated ?? 0}보스`;

      this.layer!.add(addSectionHeading(this, 660, y - 68, '기록 장부', 330, accent));
      this.layer!.add(addText(this, 682, y - 35, best, compact ? 19 : 17, unlocked ? '#f2d78e' : '#777167'));
      this.layer!.add(addText(this, 682, y + 1, claimed, compact ? 17 : 14, unlocked ? '#abb9ca' : '#707883'));
      this.layer!.add(addText(this, 682, y + 36, recordHonorProgressText(mode.id, record), compact ? 16 : 13, unlocked ? '#ddc88f' : '#70706c').setWordWrapWidth(330));

      const action = addButton(this, 1100, y + 7, 190, compact ? 84 : 62, canChallenge ? '기록 도전' : unlocked ? '온라인 필요' : '잠김', () => {
        if (canChallenge) this.scene.start('record-battle', { modeId: mode.id });
      }, canChallenge ? accent : 0x4b535f, { tone: canChallenge ? 'primary' : 'quiet' });
      this.layer!.add(action);
      if (!unlocked) setButtonState(action, 'locked', unlockText(mode.id));
      else if (!canChallenge) setButtonState(action, 'disabled', '온라인 연결 후 기록전에 도전할 수 있습니다.');

      if (!unlocked) {
        this.layer!.add(addText(this, 1005, y + 62, unlockText(mode.id), compact ? 15 : 12, '#a08f9d', 'center').setOrigin(0.5).setWordWrapWidth(270));
      }
    });

    if (!compact) {
      this.layer.add(addText(this, INTERNAL_WIDTH / 2, 666, '새 분 단위 경계와 새 보스 구간은 최초 한 번 보상. 장기 생존과 완주에는 별도 지휘관 명예가 기록된다.', 14, '#8995a7', 'center').setOrigin(0.5));
    }
  }
}

export const __recordHubSceneTestOnly = { recordHonorProgressText };
