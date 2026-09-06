import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { getBaseWeaponDefinition, type BaseWeaponId } from '@frontline/sim/playable';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress.ts';
import { selectActiveBaseWeapon } from './active-meta-progression.ts';
import { BASE_WEAPON_UNLOCKS, isBaseWeaponUnlocked } from './base-weapon-progression.ts';
import { getStage } from './prototype.ts';
import {
  getGuestSelectedBaseWeaponId,
  type GuestProgress,
} from './save.ts';
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

function seconds(frames: number | undefined): string {
  return `${((frames ?? 0) / 30).toFixed(1)}초`;
}

function weaponStats(id: BaseWeaponId): readonly string[] {
  const weapon = getBaseWeaponDefinition(id);
  if (weapon.kind === 'FRONT_CANNON') {
    return [
      `재사용 ${seconds(weapon.cooldownFrames)} · 발사 준비 ${seconds(weapon.hitDelayFrames)}`,
      `직격 피해 ${weapon.damage}`,
      `밀치기 ${weapon.pushDistance} · 우두머리 ${weapon.bossPushDistance ?? 0}`,
    ];
  }
  if (weapon.kind === 'AEGIS_EMITTER') {
    return [
      `재사용 ${seconds(weapon.cooldownFrames)} · 첫 사용 ${seconds(weapon.initialCooldownFrames)}`,
      `받는 피해 ${Math.round((weapon.damageTakenPermille ?? 1000) / 10)}% · 지속 ${seconds(weapon.durationFrames)}`,
      '발동 순간 살아 있는 아군에게 적용',
    ];
  }
  return [
    `재사용 ${seconds(weapon.cooldownFrames)} · 첫 사용 ${seconds(weapon.initialCooldownFrames)}`,
    `투하 지연 ${seconds(weapon.hitDelayFrames)}`,
    `보급 상한 ${Math.round((weapon.supplyGainPermille ?? 0) / 10)}% · ${weapon.supplyGainMin ?? 0}~${weapon.supplyGainMax ?? 0}`,
  ];
}

function unlockLabel(id: BaseWeaponId): string {
  const unlock = BASE_WEAPON_UNLOCKS.find((entry) => entry.id === id);
  if (!unlock?.unlockAfterStageId) return '기본 지급 병기';
  return `${getStage(unlock.unlockAfterStageId).name} 첫 클리어 후 해금`;
}

function drawWeaponSchematic(scene: Phaser.Scene, x: number, y: number, id: BaseWeaponId, accent: number): Phaser.GameObjects.Graphics {
  const weapon = getBaseWeaponDefinition(id);
  const g = scene.add.graphics();
  g.fillStyle(0x0d1219, 0.72).fillCircle(x, y, 92);
  g.lineStyle(3, accent, 0.48).strokeCircle(x, y, 82);
  g.lineStyle(1, accent, 0.22).strokeCircle(x, y, 62);

  if (weapon.kind === 'FRONT_CANNON') {
    g.fillStyle(accent, 0.72).fillRect(x - 62, y - 20, 98, 40);
    g.fillStyle(0xd9e4ef, 0.72).fillRect(x + 25, y - 8, 72, 16);
    g.fillStyle(0x1b2631, 1).fillCircle(x - 35, y + 31, 22).fillCircle(x + 23, y + 31, 22);
    g.lineStyle(4, accent, 0.7).lineBetween(x - 70, y + 55, x + 82, y + 55);
  } else if (weapon.kind === 'AEGIS_EMITTER') {
    g.lineStyle(7, accent, 0.52).strokeEllipse(x, y - 3, 116, 76);
    g.lineStyle(3, 0xcfefff, 0.72).strokeEllipse(x, y - 3, 84, 54);
    g.fillStyle(accent, 0.9).fillCircle(x, y + 24, 17);
    g.fillStyle(0xe9f8ff, 0.82).fillCircle(x, y + 24, 6);
    g.lineStyle(4, accent, 0.6).lineBetween(x, y + 40, x, y + 78);
  } else {
    g.lineStyle(4, 0xdce8f2, 0.75).strokeEllipse(x, y - 24, 120, 54);
    g.lineStyle(2, 0xdce8f2, 0.55).lineBetween(x - 52, y - 18, x - 24, y + 25);
    g.lineStyle(2, 0xdce8f2, 0.55).lineBetween(x + 52, y - 18, x + 24, y + 25);
    g.fillStyle(accent, 0.82).fillRect(x - 34, y + 20, 68, 56);
    g.lineStyle(3, 0xf4d792, 0.72).strokeRect(x - 34, y + 20, 68, 56);
    g.lineStyle(2, 0xf4d792, 0.42).lineBetween(x, y + 20, x, y + 76);
  }
  return g;
}

export class BaseWeaponScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private focusedId: BaseWeaponId = 'base_weapon_front_cannon';
  private layer?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private busy = false;

  constructor() { super('base-weapon'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 28, '거점 병기고', compact ? 42 : 44, COLORS.cream);
    addText(this, 56, 77, '출정 전에 공유 거점 병기 하나를 선택합니다.', compact ? 17 : 14, COLORS.muted);
    addButton(this, 1165, compact ? 60 : 56, 160, compact ? 80 : 50, '전선 지도', () => this.scene.start('stage-hub'), 0x586275, { tone: 'quiet' });
    this.status = addText(this, INTERNAL_WIDTH / 2, compact ? 690 : 682, '병기 장착 정보를 불러오는 중…', compact ? 18 : 14, COLORS.dim, 'center').setOrigin(0.5).setWordWrapWidth(1040);
    this.renderWeapons();

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      this.authority = view.authority;
      this.focusedId = getGuestSelectedBaseWeaponId(view.progress);
      this.status?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '계정 기록 읽기 전용 · 장착 변경은 온라인 연결 후 가능합니다.'
        : '병기를 선택해 성능을 확인하고 장착하세요.');
      this.status?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : COLORS.blue);
      this.renderWeapons();
    }).catch(() => {
      if (!this.scene.isActive()) return;
      this.status?.setText('거점 병기 정보를 불러오지 못했습니다.').setColor(COLORS.red);
    });
  }

  private renderWeapons(): void {
    this.layer?.destroy(true);
    this.layer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const equipped = getGuestSelectedBaseWeaponId(this.progress);
    const writable = this.authority !== 'ACCOUNT_OFFLINE_CACHE';

    this.layer.add(addSectionHeading(this, 54, 140, '병기 선택', 1168, 0x6d8fb5));

    BASE_WEAPON_UNLOCKS.forEach((unlock, index) => {
      const x = 240 + index * 400;
      const unlocked = isBaseWeaponUnlocked(unlock.id, this.progress.clearedStageIds);
      const selected = this.focusedId === unlock.id;
      const isEquipped = equipped === unlock.id;
      const label = `${unlock.displayName}\n${isEquipped ? '장착 중' : unlocked ? '성능 보기' : '잠김'}`;
      const rackButton = addButton(this, x, 205, 330, compact ? 92 : 78, label, () => {
        if (this.busy) return;
        this.focusedId = unlock.id;
        this.renderWeapons();
      }, selected ? 0xb09257 : unlocked ? 0x607f9d : 0x48515c, { tone: 'quiet' });
      this.layer!.add(rackButton);
      if (this.busy) setButtonState(rackButton, 'loading', '병기 장착을 저장하는 중입니다.');
      else if (selected) setButtonState(rackButton, 'selected');
      else if (!unlocked) setButtonState(rackButton, 'locked', unlockLabel(unlock.id));
    });

    const focus = BASE_WEAPON_UNLOCKS.find((entry) => entry.id === this.focusedId) ?? BASE_WEAPON_UNLOCKS[0]!;
    const unlocked = isBaseWeaponUnlocked(focus.id, this.progress.clearedStageIds);
    const isEquipped = equipped === focus.id;
    const accent = isEquipped ? 0xc6a75a : unlocked ? 0x79a4c5 : 0x626b76;

    this.layer.add(addCommandPanel(this, INTERNAL_WIDTH / 2, 462, 1160, 390, accent, 0x1b232c, 0.95));
    this.layer.add(addStatusPill(this, 84, 294, isEquipped ? '현재 장착' : unlocked ? '장착 가능' : '잠김', isEquipped ? 'online' : unlocked ? 'neutral' : 'warning'));

    this.layer.add(drawWeaponSchematic(this, 270, 444, focus.id, accent));
    this.layer.add(addText(this, 410, 326, focus.displayName, compact ? 31 : 28, unlocked ? '#ffffff' : '#858d97'));
    this.layer.add(addText(this, 412, 370, focus.description, compact ? 18 : 15, unlocked ? '#c5cedb' : '#777f89').setWordWrapWidth(330));
    this.layer.add(addText(this, 412, 470, unlocked ? '사용 가능' : unlockLabel(focus.id), compact ? 18 : 15, unlocked ? COLORS.green : '#d6ad82').setWordWrapWidth(330));
    this.layer.add(addText(this, 412, 505, '일반전과 기록전에 같은 장착 병기가 적용됩니다.', compact ? 15 : 12, COLORS.muted).setWordWrapWidth(330));

    this.layer.add(addSectionHeading(this, 790, 316, '전투 성능', 390, accent));
    weaponStats(focus.id).forEach((line, index) => {
      this.layer!.add(addText(this, 812, 360 + index * 48, line, compact ? 18 : 15, unlocked ? '#c9d3df' : '#737b85').setWordWrapWidth(360));
    });

    const action = addButton(this, 1000, 562, 260, compact ? 88 : 62, isEquipped ? '현재 장착 중' : unlocked ? '이 병기 장착' : '잠김', () => {
      if (unlocked && !isEquipped && writable && !this.busy) void this.equip(focus.id);
    }, isEquipped ? 0x817044 : unlocked ? 0xb09257 : 0x4b535f, { tone: unlocked && !isEquipped ? 'primary' : 'quiet' });
    this.layer.add(action);

    if (this.busy) setButtonState(action, 'loading', '병기 장착을 저장하는 중입니다.');
    else if (!unlocked) setButtonState(action, 'locked', unlockLabel(focus.id));
    else if (isEquipped) setButtonState(action, 'selected');
    else if (!writable) setButtonState(action, 'disabled', '온라인 연결 후 병기 장착을 변경할 수 있습니다.');
  }

  private async equip(baseWeaponId: BaseWeaponId): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.status?.setText('병기 장착을 저장하는 중…').setColor('#d7c38b');
    this.renderWeapons();
    try {
      const result = await selectActiveBaseWeapon(baseWeaponId);
      if (!this.scene.isActive()) return;
      this.progress = result.guestProgress;
      this.status?.setText(result.persisted ? '거점 병기 장착 저장 완료' : '병기는 변경됐지만 영구 저장에 실패했습니다.').setColor(result.persisted ? COLORS.green : COLORS.warning);
    } catch {
      if (!this.scene.isActive()) return;
      this.status?.setText('거점 병기 장착을 저장하지 못했습니다. 연결 상태를 확인해 주세요.').setColor(COLORS.red);
    } finally {
      this.busy = false;
      if (this.scene.isActive()) this.renderWeapons();
    }
  }
}
