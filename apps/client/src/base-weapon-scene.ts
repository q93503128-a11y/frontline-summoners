import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { getBaseWeaponDefinition, type BaseWeaponId } from '@frontline/sim/playable';
import { loadActiveProgress } from './active-progress.ts';
import { selectActiveBaseWeapon } from './active-meta-progression.ts';
import { BASE_WEAPON_UNLOCKS, isBaseWeaponUnlocked } from './base-weapon-progression.ts';
import {
  getGuestSelectedBaseWeaponId,
  type GuestProgress,
} from './save.ts';
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
};

function seconds(frames: number | undefined): string {
  return `${((frames ?? 0) / 30).toFixed(1)}초`;
}

function weaponStats(id: BaseWeaponId): readonly string[] {
  const weapon = getBaseWeaponDefinition(id);
  if (weapon.kind === 'FRONT_CANNON') {
    return [
      `재사용 ${seconds(weapon.cooldownFrames)} · 발동지연 ${seconds(weapon.hitDelayFrames)}`,
      `피해 ${weapon.damage} · 일반 적 밀치기 ${weapon.pushDistance}`,
      `보스 밀치기 ${weapon.bossPushDistance ?? 0}`,
    ];
  }
  if (weapon.kind === 'AEGIS_EMITTER') {
    return [
      `재사용 ${seconds(weapon.cooldownFrames)} · 최초대기 ${seconds(weapon.initialCooldownFrames)}`,
      `받는 피해 ${Math.round((weapon.damageTakenPermille ?? 1000) / 10)}%`,
      `지속 ${seconds(weapon.durationFrames)} · 사용 순간 생존 아군 snapshot`,
    ];
  }
  return [
    `재사용 ${seconds(weapon.cooldownFrames)} · 최초대기 ${seconds(weapon.initialCooldownFrames)}`,
    `투하 지연 ${seconds(weapon.hitDelayFrames)}`,
    `보급 상한의 ${Math.round((weapon.supplyGainPermille ?? 0) / 10)}% · ${weapon.supplyGainMin ?? 0}~${weapon.supplyGainMax ?? 0}`,
  ];
}

export class BaseWeaponScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private layer?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;

  constructor() { super('base-weapon'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 38, '거점 병기', 46, COLORS.cream);
    addText(this, 56, 94, compact ? '출정 전에 사용할 병기 1종을 고른다.' : '해금된 거점 병기 중 하나를 장착한다. 선택은 일반전과 기록전에 함께 적용된다.', compact ? 22 : 19, COLORS.muted);
    addButton(this, 1165, compact ? 70 : 65, 160, compact ? 84 : 50, '출정', () => this.scene.start('stage-hub'), 0x586275);
    this.status = addText(this, INTERNAL_WIDTH / 2, 690, '', compact ? 20 : 17, '#9ca9bb', 'center').setOrigin(0.5);
    this.renderWeapons();
    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      if (view.authority === 'ACCOUNT_OFFLINE_CACHE') {
        this.status?.setText('계정 장착 정보를 읽기 전용으로 불러왔습니다. 변경하려면 온라인 연결이 필요합니다.').setColor('#ffcf8a');
      }
      this.renderWeapons();
    });
  }

  private renderWeapons(): void {
    this.layer?.destroy(true);
    this.layer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const selected = getGuestSelectedBaseWeaponId(this.progress);
    const positions = [275, INTERNAL_WIDTH / 2, INTERNAL_WIDTH - 275];

    BASE_WEAPON_UNLOCKS.forEach((unlock, index) => {
      const x = positions[index]!;
      const unlocked = isBaseWeaponUnlocked(unlock.id, this.progress.clearedStageIds);
      const equipped = selected === unlock.id;
      const accent = equipped ? 0xb8964f : unlocked ? 0x6d8fb5 : 0x3f4855;
      const card = this.add.rectangle(x, 375, 360, 430, unlocked ? 0x242c3a : 0x1d222c, 0.98).setStrokeStyle(equipped ? 5 : 3, accent, 1);
      this.layer!.add(card);
      this.layer!.add(addText(this, x, 205, equipped ? 'EQUIPPED' : unlocked ? 'AVAILABLE' : 'LOCKED', compact ? 19 : 16, equipped ? '#f1d58a' : unlocked ? '#a9caee' : '#69727e', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 252, unlock.displayName, compact ? 30 : 28, unlocked ? '#ffffff' : '#747d89', 'center').setOrigin(0.5));
      this.layer!.add(addText(this, x, 315, unlock.description, compact ? 20 : 17, unlocked ? '#c5cedb' : '#656e7a', 'center').setOrigin(0.5).setWordWrapWidth(315));

      weaponStats(unlock.id).forEach((line, lineIndex) => {
        this.layer!.add(addText(this, x, 390 + lineIndex * 38, line, compact ? 19 : 16, unlocked ? '#aeb9c8' : '#666f7a', 'center').setOrigin(0.5).setWordWrapWidth(320));
      });

      if (!unlocked && unlock.unlockAfterStageId) {
        this.layer!.add(addText(this, x, 500, `${unlock.unlockAfterStageId} 정상 클리어 후 해금`, compact ? 18 : 15, '#8b8290', 'center').setOrigin(0.5));
      }
      const label = equipped ? '장착 중' : unlocked ? '장착' : '잠김';
      const button = addButton(this, x, compact ? 565 : 570, 210, compact ? 82 : 58, label, () => {
        if (unlocked && !equipped) void this.equip(unlock.id);
      }, equipped ? 0x8d7338 : unlocked ? 0x567da2 : 0x3f4855);
      if (!unlocked) button.setAlpha(0.6);
      this.layer!.add(button);
    });
  }

  private async equip(baseWeaponId: BaseWeaponId): Promise<void> {
    this.status?.setText('장착 저장 중...').setColor('#d7c38b');
    try {
      const result = await selectActiveBaseWeapon(baseWeaponId);
      if (!this.scene.isActive()) return;
      this.progress = result.guestProgress;
      this.status?.setText(result.persisted ? '거점 병기 장착 저장 완료' : '영구 저장 실패 · 현재 탭에서는 선택 유지').setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
      this.renderWeapons();
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.status?.setText(error instanceof Error ? error.message : String(error)).setColor('#ff9a9a');
    }
  }
}
