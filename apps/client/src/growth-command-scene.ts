import Phaser from 'phaser';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress';
import {
  recordActiveCharacterLevel,
  recordActiveCharacterPlusLevel,
  recordActiveEvolutionUnlock,
  selectActiveEvolutionForm,
} from './active-meta-progression';
import { buildCharacterCombatSlot, getEvolutionForms, getEvolutionRecipe } from './character-growth';
import { getLevelUpgradeGoldCost, getPlusLevelSoulEssenceCost } from './meta-economy';
import { getSlotById } from './prototype';
import {
  getGuestBaseLevelCap,
  getGuestResourceBalance,
  getOwnedCharacterIds,
  type GuestProgress,
} from './save';
import {
  addButton,
  addSectionHeading,
  addText,
  COLORS,
  drawBackdrop,
  familyForUnit,
  rarityColor,
  setButtonState,
} from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], specialClearedStageIds: [], permanentRewardIds: [] };
const PAGE_SIZE = 6;

function compactAmount(value: number): string {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(value >= 1_000_000_000 ? 0 : 1).replace(/\.0$/, '')}억`;
  if (Math.abs(value) >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1).replace(/\.0$/, '')}만`;
  return value.toLocaleString('ko-KR');
}

function compactCost(gold: number, fragment: number, core: number, crown: number): string {
  const parts = [`G${compactAmount(gold)}`, `조각${fragment}`];
  if (core > 0) parts.push(`핵심${core}`);
  if (crown > 0) parts.push(`왕관${crown}`);
  return parts.join(' · ');
}

function getNextCapMessage(levelCap: number): string {
  if (levelCap >= 50) return '기본 레벨 상한 Lv50 · 1차 메인 엔딩 달성';
  if (levelCap >= 40) return '제4장 완료 시 Lv50 개방';
  if (levelCap >= 30) return '제3장 완료 시 Lv40 개방';
  if (levelCap >= 20) return '제2장 완료 시 Lv30 개방';
  return '제1장 완료 시 Lv20 개방';
}

function badgeFor(characterId: string): { label: string; color: string } {
  const slot = getSlotById(characterId);
  if (!slot) return { label: '동료', color: '#ffffff' };
  if (slot.rarity) return { label: slot.rarity, color: rarityColor[slot.rarity] ?? '#ffffff' };
  if (slot.acquisitionClass === 'STORY') return { label: '스토리', color: '#d7c79f' };
  return { label: '특수', color: '#9fd7d0' };
}

/** Growth is a decision surface: choose a unit, compare the current combat state, then spend or evolve. */
export class GrowthScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private selectedCharacterId: string | undefined;
  private page = 0;
  private listLayer?: Phaser.GameObjects.Container;
  private detailLayer?: Phaser.GameObjects.Container;
  private pageText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private previousButton?: Phaser.GameObjects.Container;
  private nextButton?: Phaser.GameObjects.Container;
  private saving = false;

  constructor() { super('growth'); }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();

    addText(this, 52, 22, '성장', compact ? 40 : 42, COLORS.cream);
    addText(this, 54, compact ? 76 : 74, '동료를 고르고, 지금 필요한 강화와 진화만 결정합니다.', compact ? 17 : 14, '#8f9aa8');
    addButton(this, 1010, compact ? 58 : 54, 150, compact ? 84 : 48, '모집', () => this.scene.start('recruitment'), 0x78618f, { tone: 'secondary' });
    addButton(this, 1170, compact ? 58 : 54, 150, compact ? 84 : 48, '지휘소', () => this.scene.start('main-menu'), 0x586275, { tone: 'quiet' });

    addSectionHeading(this, 52, 118, '동료', 356, 0x607894);
    addSectionHeading(this, 446, 118, '선택 동료', 782, 0x8a7450);
    const rail = this.add.graphics().setDepth(1);
    rail.lineStyle(1, 0x52677e, 0.28).lineBetween(420, 126, 420, 650);
    rail.lineStyle(1, 0x536172, 0.28).lineBetween(52, 660, 1228, 660);

    this.pageText = addText(this, 230, 548, '', compact ? 17 : 14, COLORS.dim, 'center').setOrigin(0.5);
    this.previousButton = addButton(this, 138, 608, 150, compact ? 84 : 50, '◀ 이전', () => this.changePage(-1), 0x586275, { tone: 'quiet' });
    this.nextButton = addButton(this, 322, 608, 150, compact ? 84 : 50, '다음 ▶', () => this.changePage(1), 0x586275, { tone: 'quiet' });
    this.statusText = addText(this, 835, compact ? 692 : 686, '성장 정보를 불러오는 중…', compact ? 17 : 14, COLORS.dim, 'center').setOrigin(0.5).setWordWrapWidth(760);

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.authority = view.authority;
      this.progress = view.progress;
      this.selectedCharacterId = getOwnedCharacterIds(view.progress)[0];
      this.statusText?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '오프라인 계정 기록 · 성장 변경은 온라인 연결 후 사용할 수 있습니다.'
        : '강화할 동료를 선택하세요.');
      this.statusText?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : COLORS.blue);
      this.renderList();
      this.renderDetail();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '성장 정보를 불러오지 못했습니다.').setColor(COLORS.red);
      this.renderList();
    });
  }

  private get ownedCharacterIds(): readonly string[] { return getOwnedCharacterIds(this.progress); }
  private get pageCount(): number { return Math.max(1, Math.ceil(this.ownedCharacterIds.length / PAGE_SIZE)); }
  private get writable(): boolean { return this.authority !== 'ACCOUNT_OFFLINE_CACHE'; }

  private changePage(delta: number): void {
    this.page = Math.max(0, Math.min(this.pageCount - 1, this.page + delta));
    this.renderList();
  }

  private renderList(): void {
    this.listLayer?.destroy(true);
    this.listLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const owned = this.ownedCharacterIds;
    this.page = Math.min(this.page, this.pageCount - 1);
    this.pageText?.setText(`${this.page + 1} / ${this.pageCount} · ${owned.length}명`);

    if (this.previousButton && this.nextButton) {
      setButtonState(this.previousButton, this.page <= 0 ? 'disabled' : 'default', this.page <= 0 ? '첫 페이지입니다.' : undefined);
      setButtonState(this.nextButton, this.page >= this.pageCount - 1 ? 'disabled' : 'default', this.page >= this.pageCount - 1 ? '마지막 페이지입니다.' : undefined);
    }

    const visible = owned.slice(this.page * PAGE_SIZE, this.page * PAGE_SIZE + PAGE_SIZE);
    if (visible.length === 0) {
      this.listLayer.add(addText(this, 230, 330, '보유 동료가 없습니다.', compact ? 21 : 18, COLORS.dim, 'center').setOrigin(0.5));
      return;
    }

    visible.forEach((characterId, index) => {
      const slot = getSlotById(characterId);
      if (!slot) return;
      const meta = this.progress.characterProgressById?.[characterId];
      const selected = characterId === this.selectedCharacterId;
      const badge = badgeFor(characterId);
      const y = 166 + index * 62;
      const item = addButton(this, 230, y, 340, compact ? 68 : 52,
        `${slot.displayName}   Lv${meta?.level ?? 1}${(meta?.plusLevel ?? 0) > 0 ? `  +${meta?.plusLevel ?? 0}` : ''}`,
        () => {
          this.selectedCharacterId = characterId;
          this.renderList();
          this.renderDetail();
        }, selected ? 0x967c48 : 0x53667b, { tone: 'quiet' });
      if (selected) setButtonState(item, 'selected');
      this.listLayer!.add(item);
      this.listLayer!.add(addText(this, 70, y - 19, badge.label, compact ? 15 : 11, badge.color));
    });
  }

  private renderDetail(): void {
    this.detailLayer?.destroy(true);
    this.detailLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const characterId = this.selectedCharacterId;
    if (!characterId) {
      this.detailLayer.add(addText(this, 835, 340, '동료를 확보하면 이곳에서 성장시킬 수 있습니다.', compact ? 22 : 18, COLORS.dim, 'center').setOrigin(0.5));
      return;
    }

    const slot = getSlotById(characterId);
    const meta = this.progress.characterProgressById?.[characterId];
    if (!slot || !meta) return;

    const combat = buildCharacterCombatSlot(slot, meta.level, meta.selectedFormId, meta.plusLevel);
    const art = familyForUnit(slot.definition.id);
    const badge = badgeFor(characterId);
    const levelCap = getGuestBaseLevelCap(this.progress);
    const headerBg = this.add.rectangle(835, 226, 760, 180, 0x161e28, 0.78).setStrokeStyle(1, 0x8a7450, 0.34);
    this.detailLayer.add(headerBg);
    const portrait = this.add.sprite(510, 224, art.family.idle.key, 0).setTint(art.tint);
    portrait.setScale((118 / art.family.idle.frameHeight) * art.displayScale);
    this.detailLayer.add(portrait);
    this.detailLayer.add(addText(this, 592, 160, slot.displayName, compact ? 30 : 28, '#ffffff'));
    this.detailLayer.add(addText(this, 594, 197, `${badge.label} · Lv${meta.level}/${levelCap}${meta.plusLevel > 0 ? ` · +${meta.plusLevel}` : ''}`, compact ? 18 : 15, badge.color));
    this.detailLayer.add(addText(this, 594, 228, slot.description, compact ? 15 : 12, '#909baa').setWordWrapWidth(585));

    const rechargeSeconds = (combat.rechargeFrames / 30).toFixed(1);
    this.detailLayer.add(addText(this, 594, 272, `HP ${combat.definition.maxHp}  ·  공격 ${combat.definition.attackDamage}  ·  비용 ${combat.cost}  ·  재출격 ${rechargeSeconds}초`, compact ? 16 : 13, '#e3e8ef'));
    this.detailLayer.add(addText(this, 594, 300, `이동 ${combat.definition.moveSpeed}  ·  대기 ${combat.definition.standingRange}  ·  공격 범위 ${combat.definition.attackMinRange}~${combat.definition.attackMaxRange}`, compact ? 15 : 12, '#9fb0c3'));

    const gold = getGuestResourceBalance(this.progress, 'gold');
    const soul = getGuestResourceBalance(this.progress, 'soul_essence');
    const fragment = getGuestResourceBalance(this.progress, 'evo_fragment');
    const core = getGuestResourceBalance(this.progress, 'evo_core');
    const crown = getGuestResourceBalance(this.progress, 'evo_crown');
    this.detailLayer.add(addText(this, 456, 332,
      `보유 재화 · G ${compactAmount(gold)}   혼 ${compactAmount(soul)}   조각 ${compactAmount(fragment)}   핵심 ${compactAmount(core)}   왕관 ${compactAmount(crown)}`,
      compact ? 15 : 12, '#aab5c3'));

    this.detailLayer.add(addSectionHeading(this, 446, 362, '강화', 782, 0x6d8c6f));
    const nextOne = Math.min(levelCap, meta.level + 1);
    const nextFive = Math.min(levelCap, meta.level + 5);
    const oneCost = getLevelUpgradeGoldCost(meta.level, nextOne);
    const fiveCost = getLevelUpgradeGoldCost(meta.level, nextFive);
    const plusCost = getPlusLevelSoulEssenceCost(slot.acquisitionClass, slot.rarity);
    const atLevelCap = meta.level >= levelCap;
    const atPlusCap = meta.plusLevel >= 50;
    const actionY = compact ? 414 : 408;
    const actionHeight = compact ? 76 : 58;

    const levelOne = addButton(this, 586, actionY, 220, actionHeight, atLevelCap ? 'Lv 상한' : `Lv +1 · G${compactAmount(oneCost)}`, () => {
      if (!this.saving && !atLevelCap && this.writable) void this.upgradeLevel(characterId, nextOne);
    }, 0x6b7f68, { tone: 'primary' });
    const levelFive = addButton(this, 835, actionY, 220, actionHeight, atLevelCap ? '다음 장에서 개방' : `Lv +${nextFive - meta.level} · G${compactAmount(fiveCost)}`, () => {
      if (!this.saving && !atLevelCap && this.writable) void this.upgradeLevel(characterId, nextFive);
    }, 0x63775f, { tone: 'secondary' });
    const plus = addButton(this, 1084, actionY, 220, actionHeight, atPlusCap ? '+50 상한' : `+1 초월 · 혼 ${plusCost}`, () => {
      if (!this.saving && !atPlusCap && this.writable) void this.upgradePlus(characterId);
    }, 0x76628c, { tone: 'secondary' });
    this.detailLayer.add([levelOne, levelFive, plus]);

    const offlineReason = '온라인 계정 연결이 필요합니다.';
    if (this.saving) {
      [levelOne, levelFive, plus].forEach((control) => setButtonState(control, 'loading', '성장 저장 중'));
    } else if (!this.writable) {
      [levelOne, levelFive, plus].forEach((control) => setButtonState(control, 'disabled', offlineReason));
    } else {
      if (atLevelCap) {
        setButtonState(levelOne, 'disabled', getNextCapMessage(levelCap));
        setButtonState(levelFive, 'locked', getNextCapMessage(levelCap));
      }
      if (atPlusCap) setButtonState(plus, 'disabled', '+레벨 최대치입니다.');
    }
    this.detailLayer.add(addText(this, 835, 450, getNextCapMessage(levelCap), compact ? 14 : 11, levelCap >= 50 ? COLORS.green : COLORS.dim, 'center').setOrigin(0.5));

    this.detailLayer.add(addSectionHeading(this, 446, 480, '진화 형태', 782, 0x8d6ba3));
    const forms = getEvolutionForms(characterId);
    const lineage = this.add.graphics();
    const xStart = forms.length <= 1 ? 835 : 560;
    const xGap = forms.length <= 1 ? 0 : 550 / (forms.length - 1);
    if (forms.length > 1) lineage.lineStyle(3, 0x705a82, 0.42).lineBetween(xStart, 524, xStart + xGap * (forms.length - 1), 524);
    this.detailLayer.add(lineage);

    forms.forEach((form, index) => {
      const unlocked = meta.unlockedFormIds.includes(form.formId);
      const selected = meta.selectedFormId === form.formId;
      const recipe = unlocked ? undefined : getEvolutionRecipe(form.formId);
      const x = xStart + index * xGap;
      const canAfford = recipe === undefined || (
        meta.level >= recipe.requiredBaseLevel
        && gold >= recipe.cost.gold
        && fragment >= recipe.cost.evo_fragment
        && core >= recipe.cost.evo_core
        && crown >= recipe.cost.evo_crown
      );
      const node = this.add.circle(x, 524, selected ? 11 : 8, selected ? 0xf1cf73 : unlocked ? 0xaa86bd : 0x55445f, 1)
        .setStrokeStyle(2, selected ? 0xffe7a0 : unlocked ? 0xd4b5e0 : 0x806d89, 0.9);
      this.detailLayer!.add(node);
      const label = unlocked
        ? `${form.formOrder}형태 · ${form.name}\n${selected ? '사용 중' : '형태 선택'}`
        : recipe
          ? `${form.formOrder}형태 · ${form.name}\nLv${recipe.requiredBaseLevel} · ${compactCost(recipe.cost.gold, recipe.cost.evo_fragment, recipe.cost.evo_core, recipe.cost.evo_crown)}`
          : `${form.formOrder}형태 · ${form.name}\n조건 확인 필요`;
      const formButton = addButton(this, x, 590, Math.min(210, forms.length <= 2 ? 210 : 185), compact ? 84 : 70, label, () => {
        if (this.saving || !this.writable) return;
        if (selected) this.statusText?.setText('이미 사용 중인 형태입니다.').setColor(COLORS.blue);
        else if (unlocked) void this.selectForm(characterId, form.formId);
        else void this.unlockForm(characterId, form.formId);
      }, selected ? 0xc5a04c : unlocked ? 0x705f83 : 0x806092, { tone: selected ? 'primary' : 'secondary' });
      if (this.saving) setButtonState(formButton, 'loading', '성장 저장 중');
      else if (!this.writable) setButtonState(formButton, 'disabled', offlineReason);
      else if (selected) setButtonState(formButton, 'selected');
      else if (!unlocked && !canAfford) setButtonState(formButton, 'locked', `필요 조건 · ${label.replace('\n', ' · ')}`);
      else if (!unlocked) setButtonState(formButton, 'warning');
      this.detailLayer!.add(formButton);
    });
  }

  private beginSave(message: string): void {
    this.saving = true;
    this.statusText?.setText(message).setColor('#c7d0dd');
    this.renderDetail();
  }

  private finishSave(): void {
    this.saving = false;
    if (!this.scene.isActive()) return;
    this.renderList();
    this.renderDetail();
  }

  private async upgradeLevel(characterId: string, targetLevel: number): Promise<void> {
    this.beginSave(`Lv${targetLevel} 강화 비용 확인 중…`);
    try {
      const result = await recordActiveCharacterLevel(characterId, targetLevel);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      const spent = result.spentResources?.gold ?? 0;
      this.statusText?.setText(result.persisted ? `Lv${result.characterProgress.level} 강화 완료 · G${compactAmount(spent)} 사용` : '강화는 적용됐지만 영구 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '레벨 강화에 실패했습니다.').setColor(COLORS.red);
    } finally { this.finishSave(); }
  }

  private async upgradePlus(characterId: string): Promise<void> {
    const current = this.progress.characterProgressById?.[characterId];
    if (!current) return;
    this.beginSave('+레벨 재화 확인 중…');
    try {
      const result = await recordActiveCharacterPlusLevel(characterId, current.plusLevel + 1);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      const spent = result.spentResources?.soul_essence ?? 0;
      this.statusText?.setText(result.persisted ? `+${result.characterProgress.plusLevel} 초월 완료 · 혼 ${spent} 사용` : '+레벨은 적용됐지만 영구 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '+레벨 강화에 실패했습니다.').setColor(COLORS.red);
    } finally { this.finishSave(); }
  }

  private async unlockForm(characterId: string, formId: string): Promise<void> {
    this.beginSave('진화 조건과 재료 확인 중…');
    try {
      const result = await recordActiveEvolutionUnlock(characterId, formId);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      const form = getEvolutionForms(characterId).find((candidate) => candidate.formId === formId);
      this.statusText?.setText(result.persisted ? `${form?.name ?? '형태'} 진화 완료` : '진화는 적용됐지만 영구 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '진화에 실패했습니다.').setColor(COLORS.red);
    } finally { this.finishSave(); }
  }

  private async selectForm(characterId: string, formId: string): Promise<void> {
    this.beginSave('형태 변경 저장 중…');
    try {
      const result = await selectActiveEvolutionForm(characterId, formId);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      this.statusText?.setText(result.persisted ? '형태 변경 저장 완료' : '형태는 변경됐지만 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '형태 변경에 실패했습니다.').setColor(COLORS.red);
    } finally { this.finishSave(); }
  }
}
