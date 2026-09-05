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
      `일반 적 밀치기 ${weapon.pushDistance} · 우두머리 ${weapon.bossPushDistance ?? 0}`,
    ];
  }
  if (weapon.kind === 'AEGIS_EMITTER') {
    return [
      `재사용 ${seconds(weapon.cooldownFrames)} · 첫 사용 준비 ${seconds(weapon.initialCooldownFrames)}`,
      `받는 피해 ${Math.round((weapon.damageTakenPermille ?? 1000) / 10)}% · 지속 ${seconds(weapon.durationFrames)}`,
      '발동 순간 살아 있는 아군에게 적용',
    ];
  }
  return [
    `재사용 ${seconds(weapon.cooldownFrames)} · 첫 사용 준비 ${seconds(weapon.initialCooldownFrames)}`,
    `투하 지연 ${seconds(weapon.hitDelayFrames)}`,
    `보급 상한의 ${Math.round((weapon.supplyGainPermille ?? 0) / 10)}% · 최소 ${weapon.supplyGainMin ?? 0} / 최대 ${weapon.supplyGainMax ?? 0}`,
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
    g.lineStyle(7, accent, 0.52).strokeArc(x, y, 58, Phaser.Math.DegToRad(195), Phaser.Math.DegToRad(345));
    g.lineStyle(3, 0xcfefff, 0.72).strokeArc(x, y, 42, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
    g.fillStyle(accent, 0.9).fillCircle(x, y + 24, 17);
    g.fillStyle(0xe9f8ff, 0.82).fillCircle(x, y + 24, 6);
    g.lineStyle(4, accent, 0.6).lineBetween(x, y + 40, x, y + 78);
  } else {
    g.lineStyle(4, 0xdce8f2, 0.75).strokeArc(x, y - 24, 60, Phaser.Math.DegToRad(185), Phaser.Math.DegToRad(355));
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
    addText(this, 54, 34, '거점 병기고', compact ? 44 : 48, COLORS.cream);
    addText(this, 56, 87, '출정 전에 공유 거점 병기 하나를 정비하고 장착한다.', compact ? 19 : 17, COLORS.muted);
    addButton(this, 1165, compact ? 66 : 60, 160, compact ? 84 : 50, '전선 지도', () => this.scene.start('stage-hub'), 0x586275, { tone: 'quiet' });
    this.status = addText(this, INTERNAL_WIDTH / 2, compact ? 690 : 674, '병기 장착 정보를 불러오는 중…', compact ? 18 : 14, COLORS.dim, 'center').setOrigin(0.5).setWordWrapWidth(1000);
    this.renderWeapons();

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      this.authority = view.authority;
      this.focusedId = getGuestSelectedBaseWeaponId(view.progress);
      this.status?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '계정 병기 기록 · 읽기 전용 · 장착 변경은 온라인 연결 후 가능합니다.'
        : '병기를 선택해 성능을 확인하고 출정 장비를 정하세요.');
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

    this.layer.add(addSectionHeading(this, 54, 142, '병기 랙', 390, 0x6d8fb5));
    this.layer.add(addCommandPanel(this, 250, 395, 405, 480, 0x637d98, 0x1c2530, 0.92));
    this.layer.add(addSectionHeading(this, 490, 142, '병기 설계판', 735, 0xb09257));
    this.layer.add(addCommandPanel(this, 858, 395, 735, 480, 0xb09257, 0x24261f, 0.9));

    BASE_WEAPON_UNLOCKS.forEach((unlock, index) => {
      const y = 245 + index * 116;
      const unlocked = isBaseWeaponUnlocked(unlock.id, this.progress.clearedStageIds);
      const selected = this.focusedId === unlock.id;
      const isEquipped = equipped === unlock.id;
      const label = `${unlock.displayName}\n${isEquipped ? '현재 장착 중' : unlocked ? '성능 확인' : '아직 해금되지 않음'}`;
      const rackButton = addButton(this, 250, y, 340, compact ? 92 : 82, label, () => {
        if (this.busy) return;
        this.focusedId = unlock.id;
        this.renderWeapons();
      }, selected ? 0xb09257 : unlocked ? 0x607f9d : 0x48515c, { tone: 'quiet' });
      this.layer!.add(rackButton);
      if (this.busy) setButtonState(rackButton, 'loading', '병기 장착을 저장하는 중입니다.');
      else if (selected) setButtonState(rackButton, 'selected');
    });

    const focus = BASE_WEAPON_UNLOCKS.find((entry) => entry.id === this.focusedId) ?? BASE_WEAPON_UNLOCKS[0]!;
    const unlocked = isBaseWeaponUnlocked(focus.id, this.progress.clearedStageIds);
    const isEquipped = equipped === focus.id;
    const accent = isEquipped ? 0xc6a75a : unlocked ? 0x79a4c5 : 0x626b76;

    this.layer.add(addStatusPill(this, 535, 187, isEquipped ? '현재 장착' : unlocked ? '장착 가능' : '잠김', isEquipped ? 'online' : unlocked ? 'neutral' : 'warning'));
    this.layer.add(addText(this, 555, 222, focus.displayName, compact ? 31 : 29, unlocked ? '#ffffff' : '#858d97'));
    this.layer.add(addText(this, 557, 263, focus.description, compact ? 18 : 15, unlocked ? '#c5cedb' : '#777f89').setWordWrapWidth(380));
    this.layer.add(drawWeaponSchematic(this, 1040, 320, focus.id, accent));

    this.layer.add(addSectionHeading(this, 555, 338, '전투 성능', 430, accent));
    weaponStats(focus.id).forEach((line, index) => {
      this.layer!.add(addText(this, 577, 376 + index * 42, line, compact ? 18 : 15, unlocked ? '#c9d3df' : '#737b85').setWordWrapWidth(430));
    });

    this.layer.add(addSectionHeading(this, 555, 510, '해금 · 장착', 430, accent));
    this.layer.add(addText(this, 577, 548, unlocked ? '사용 가능' : unlockLabel(focus.id), compact ? 18 : 15, unlocked ? COLORS.green : '#d6ad82').setWordWrapWidth(390));
    this.layer.add(addText(this, 577, 583, '일반전과 기록전에 같은 장착 병기가 적용됩니다.', compact ? 16 : 13, COLORS.muted));

    const action = addButton(this, 1030, 570, 235, compact ? 88 : 64, isEquipped ? '현재 장착 중' : unlocked ? '이 병기 장착' : '잠김', () => {
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
