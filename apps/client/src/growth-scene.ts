import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { buildCharacterCombatSlot, getEvolutionForms, getEvolutionRecipe } from './character-growth';
import { getLevelUpgradeGoldCost, getPlusLevelSoulEssenceCost } from './meta-economy';
import { getSlotById } from './prototype';
import {
  getGuestBaseLevelCap,
  getGuestResourceBalance,
  getOwnedCharacterIds,
  loadGuestProgress,
  recordGuestCharacterLevel,
  recordGuestCharacterPlusLevel,
  recordGuestEvolutionUnlock,
  selectGuestEvolutionForm,
  type GuestProgress,
} from './save';
import { addButton, addText, COLORS, drawBackdrop, familyForUnit, rarityColor } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = { clearedStageIds: [], specialClearedStageIds: [], permanentRewardIds: [] };
const PAGE_SIZE = 6;

export function getImplementedBaseLevelCap(progress: GuestProgress): number { return getGuestBaseLevelCap(progress); }
function getNextCapMessage(levelCap: number): string {
  if (levelCap >= 50) return '제4장 완료 · 기본 레벨 상한 Lv50 · 1차 메인 엔딩 달성';
  if (levelCap >= 40) return '제4장 완료 시 기본 레벨 상한 Lv50';
  if (levelCap >= 30) return '제3장 완료 시 기본 레벨 상한 Lv40';
  if (levelCap >= 20) return '제2장 완료 시 기본 레벨 상한 Lv30';
  return '제1장 완료 시 기본 레벨 상한 Lv20';
}
function compactCost(gold: number, fragment: number, core: number, crown: number): string {
  const parts = [`G${gold.toLocaleString('ko-KR')}`, `조각${fragment}`];
  if (core > 0) parts.push(`핵심${core}`);
  if (crown > 0) parts.push(`왕관${crown}`);
  return parts.join(' · ');
}

export class GrowthScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private selectedCharacterId: string | undefined;
  private page = 0;
  private listLayer: Phaser.GameObjects.Container | undefined;
  private detailLayer: Phaser.GameObjects.Container | undefined;
  private pageText: Phaser.GameObjects.Text | undefined;
  private statusText: Phaser.GameObjects.Text | undefined;
  private saving = false;
  constructor() { super('growth'); }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    addText(this, 52, 30, '성 장', compact ? 44 : 48, COLORS.cream);
    addText(this, 54, 90, '보유 동료의 기본 레벨·+레벨·진화 형태를 관리한다.', compact ? 20 : 17, COLORS.muted);
    addButton(this, 1010, compact ? 62 : 58, 150, compact ? 84 : 50, '모집', () => this.scene.start('recruitment'), 0x8b6fb5);
    addButton(this, 1170, compact ? 62 : 58, 150, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    this.add.rectangle(250, 370, 420, 500, 0x222936, 0.97).setStrokeStyle(3, 0x59677f);
    this.add.rectangle(830, 370, 700, 500, 0x222936, 0.97).setStrokeStyle(3, 0x7b6990);
    this.pageText = addText(this, 250, 626, '', compact ? 19 : 16, '#9ca9bb', 'center').setOrigin(0.5);
    this.statusText = addText(this, 830, 684, '성장 정보를 불러오는 중…', compact ? 18 : 15, '#9ca9bb', 'center').setOrigin(0.5);
    addButton(this, 150, 650, 150, compact ? 76 : 50, '◀ 이전', () => this.changePage(-1), 0x586275);
    addButton(this, 350, 650, 150, compact ? 76 : 50, '다음 ▶', () => this.changePage(1), 0x586275);
    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      const owned = getOwnedCharacterIds(progress);
      this.selectedCharacterId = owned[0];
      this.statusText?.setText('동료를 선택하면 성장 정보를 확인할 수 있습니다.');
      this.statusText?.setColor('#9fcfff');
      this.renderList();
      this.renderDetail();
    });
  }

  private get ownedCharacterIds(): readonly string[] { return getOwnedCharacterIds(this.progress); }
  private get pageCount(): number { return Math.max(1, Math.ceil(this.ownedCharacterIds.length / PAGE_SIZE)); }
  private changePage(delta: number): void { this.page = Math.max(0, Math.min(this.pageCount - 1, this.page + delta)); this.renderList(); }

  private renderList(): void {
    this.listLayer?.destroy(true); this.listLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport(); const owned = this.ownedCharacterIds;
    this.page = Math.min(this.page, this.pageCount - 1); this.pageText?.setText(`${this.page + 1} / ${this.pageCount} · 보유 ${owned.length}명`);
    const visible = owned.slice(this.page * PAGE_SIZE, this.page * PAGE_SIZE + PAGE_SIZE);
    visible.forEach((characterId, index) => {
      const slot = getSlotById(characterId); if (!slot) return;
      const meta = this.progress.characterProgressById?.[characterId]; const selected = characterId === this.selectedCharacterId; const y = 165 + index * 72;
      const badge = slot.rarity ?? (slot.acquisitionClass === 'STORY' ? '스토리' : '특수'); const color = slot.rarity ? rarityColor[slot.rarity] ?? '#ffffff' : '#d7c79f';
      const button = addButton(this, 250, y, 350, compact ? 64 : 58, `${slot.displayName} · Lv${meta?.level ?? 1} +${meta?.plusLevel ?? 0}`, () => {
        this.selectedCharacterId = characterId; this.renderList(); this.renderDetail();
      }, selected ? 0xc5a04c : 0x59677f);
      this.listLayer!.add(button); this.listLayer!.add(addText(this, 88, y - 24, badge, compact ? 16 : 13, color));
    });
  }

  private renderDetail(): void {
    this.detailLayer?.destroy(true); this.detailLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport(); const characterId = this.selectedCharacterId;
    if (!characterId) { this.detailLayer.add(addText(this, 830, 360, '보유 동료가 없습니다.', compact ? 24 : 20, '#8995a7', 'center').setOrigin(0.5)); return; }
    const slot = getSlotById(characterId); const meta = this.progress.characterProgressById?.[characterId]; if (!slot || !meta) return;
    const combat = buildCharacterCombatSlot(slot, meta.level, meta.selectedFormId, meta.plusLevel); const art = familyForUnit(slot.definition.id);
    const portrait = this.add.sprite(610, 235, art.family.idle.key, 0).setTint(art.tint); portrait.setScale((110 / art.family.idle.frameHeight) * art.displayScale); this.detailLayer.add(portrait);
    const badge = slot.rarity ?? (slot.acquisitionClass === 'STORY' ? '스토리' : '특수'); const badgeColor = slot.rarity ? rarityColor[slot.rarity] ?? '#ffffff' : '#d7c79f'; const levelCap = getImplementedBaseLevelCap(this.progress);
    addText(this, 710, 150, slot.displayName, compact ? 29 : 27, '#ffffff'); addText(this, 712, 188, badge, compact ? 18 : 15, badgeColor);
    addText(this, 712, 220, `Lv${meta.level} / 상한 Lv${levelCap} · +${meta.plusLevel}`, compact ? 19 : 16, '#f2d37c');
    addText(this, 712, 250, slot.description, compact ? 16 : 14, '#b8c0ce').setWordWrapWidth(470);

    const rechargeSeconds = (combat.rechargeFrames / 30).toFixed(1);
    const stats = [`HP ${combat.definition.maxHp}`,`공격 ${combat.definition.attackDamage}`,`생산비 ${combat.cost}`,`재생산 ${rechargeSeconds}초`,`이동 ${combat.definition.moveSpeed}`,`대기 사거리 ${combat.definition.standingRange}`,`공격 범위 ${combat.definition.attackMinRange}~${combat.definition.attackMaxRange}`];
    addText(this, 555, 330, stats.join('\n'), compact ? 18 : 15, '#dce4ef').setLineSpacing(compact ? 6 : 5);

    const gold = getGuestResourceBalance(this.progress, 'gold');
    const soul = getGuestResourceBalance(this.progress, 'soul_essence');
    const fragment = getGuestResourceBalance(this.progress, 'evo_fragment');
    const core = getGuestResourceBalance(this.progress, 'evo_core');
    const crown = getGuestResourceBalance(this.progress, 'evo_crown');
    addText(this, 930, 305, `보유 G${gold.toLocaleString('ko-KR')} · 혼${soul} · 조각${fragment} · 핵심${core} · 왕관${crown}`, compact ? 15 : 12, '#f2d37c').setWordWrapWidth(330);

    const forms = getEvolutionForms(characterId); addText(this, 930, 334, '형태 · 잠긴 형태를 눌러 진화', compact ? 20 : 18, '#e5c7ff');
    forms.forEach((form, index) => {
      const unlocked = meta.unlockedFormIds.includes(form.formId); const selected = meta.selectedFormId === form.formId;
      let label: string;
      if (unlocked) label = `${form.formOrder}형태 · ${form.name}${selected ? ' · 선택 중' : ''}`;
      else {
        const recipe = getEvolutionRecipe(form.formId);
        label = `${form.formOrder}형태 · ${form.name}\nLv${recipe.requiredBaseLevel} · ${compactCost(recipe.cost.gold, recipe.cost.evo_fragment, recipe.cost.evo_core, recipe.cost.evo_crown)}`;
      }
      const formButton = addButton(this, 1070, 390 + index * 80, 300, compact ? 70 : 64, label, () => {
        if (this.saving) return;
        if (unlocked && !selected) void this.selectForm(characterId, form.formId);
        else if (!unlocked) void this.unlockForm(characterId, form.formId);
      }, selected ? 0xc5a04c : unlocked ? 0x7b6990 : 0x5a4a67);
      if (!unlocked) formButton.setAlpha(0.88);
      this.detailLayer!.add(formButton);
    });

    const nextOne = Math.min(levelCap, meta.level + 1);
    const nextFive = Math.min(levelCap, meta.level + 5);
    const oneCost = getLevelUpgradeGoldCost(meta.level, nextOne);
    const fiveCost = getLevelUpgradeGoldCost(meta.level, nextFive);
    const plusCost = getPlusLevelSoulEssenceCost(slot.acquisitionClass, slot.rarity);
    const atLevelCap = meta.level >= levelCap;
    const atPlusCap = meta.plusLevel >= 50;
    this.detailLayer.add(addButton(this, 640, 558, 165, compact ? 66 : 56, atLevelCap ? 'Lv 상한' : `Lv +1\nG${oneCost.toLocaleString('ko-KR')}`, () => {
      if (!this.saving && !atLevelCap) void this.upgradeLevel(characterId, nextOne);
    }, atLevelCap ? 0x4d5562 : 0x6b7f68));
    this.detailLayer.add(addButton(this, 820, 558, 165, compact ? 66 : 56, atLevelCap ? '상한 해금 필요' : `Lv +${nextFive - meta.level}\nG${fiveCost.toLocaleString('ko-KR')}`, () => {
      if (!this.saving && !atLevelCap) void this.upgradeLevel(characterId, nextFive);
    }, atLevelCap ? 0x4d5562 : 0x6b7f68));
    this.detailLayer.add(addButton(this, 730, 618, 250, compact ? 66 : 54, atPlusCap ? '+50 상한' : `+레벨 +1 · 혼 ${plusCost}`, () => {
      if (!this.saving && !atPlusCap) void this.upgradePlus(characterId);
    }, atPlusCap ? 0x4d5562 : 0x76628c));
    this.detailLayer.add(addText(this, INTERNAL_WIDTH / 2 + 190, 646, getNextCapMessage(levelCap), compact ? 15 : 12, levelCap >= 50 ? '#8ee3aa' : '#9ca9bb', 'center').setOrigin(0.5));
  }

  private async upgradeLevel(characterId: string, targetLevel: number): Promise<void> {
    this.saving = true; this.statusText?.setText(`Lv${targetLevel} 강화 비용 확인 중…`); this.statusText?.setColor('#c7d0dd');
    try {
      const result = await recordGuestCharacterLevel(characterId, targetLevel); this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      const spent = result.spentResources?.gold ?? 0;
      this.statusText?.setText(result.persisted ? `Lv${result.characterProgress.level} 강화 완료 · G${spent.toLocaleString('ko-KR')} 사용` : '강화는 적용됐지만 영구 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c'); this.renderList(); this.renderDetail();
    } catch (error) {
      if (!this.scene.isActive()) return; this.statusText?.setText(error instanceof Error ? error.message : '레벨 강화에 실패했습니다.'); this.statusText?.setColor('#ff9a91');
    } finally { this.saving = false; }
  }

  private async upgradePlus(characterId: string): Promise<void> {
    const current = this.progress.characterProgressById?.[characterId]; if (!current) return;
    this.saving = true; this.statusText?.setText('+레벨 재화 확인 중…'); this.statusText?.setColor('#c7d0dd');
    try {
      const result = await recordGuestCharacterPlusLevel(characterId, current.plusLevel + 1); this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      const spent = result.spentResources?.soul_essence ?? 0;
      this.statusText?.setText(result.persisted ? `+${result.characterProgress.plusLevel} 강화 완료 · 혼 ${spent} 사용` : '+레벨은 적용됐지만 영구 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c'); this.renderList(); this.renderDetail();
    } catch (error) {
      if (!this.scene.isActive()) return; this.statusText?.setText(error instanceof Error ? error.message : '+레벨 강화에 실패했습니다.'); this.statusText?.setColor('#ff9a91');
    } finally { this.saving = false; }
  }

  private async unlockForm(characterId: string, formId: string): Promise<void> {
    this.saving = true; this.statusText?.setText('진화 조건과 재료 확인 중…'); this.statusText?.setColor('#c7d0dd');
    try {
      const result = await recordGuestEvolutionUnlock(characterId, formId); this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      const form = getEvolutionForms(characterId).find((candidate) => candidate.formId === formId);
      this.statusText?.setText(result.persisted ? `${form?.name ?? '형태'} 진화 완료` : '진화는 적용됐지만 영구 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
      this.renderList(); this.renderDetail();
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '진화에 실패했습니다.'); this.statusText?.setColor('#ff9a91');
    } finally { this.saving = false; }
  }

  private async selectForm(characterId: string, formId: string): Promise<void> {
    this.saving = true; this.statusText?.setText('형태 변경 저장 중…'); this.statusText?.setColor('#c7d0dd');
    try {
      const result = await selectGuestEvolutionForm(characterId, formId); this.progress = result.guestProgress; if (!this.scene.isActive()) return;
      this.statusText?.setText(result.persisted ? '형태 변경 저장 완료' : '형태는 변경됐지만 저장에 실패했습니다.'); this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c'); this.renderList(); this.renderDetail();
    } catch (error) {
      if (!this.scene.isActive()) return; this.statusText?.setText(error instanceof Error ? error.message : '형태 변경에 실패했습니다.'); this.statusText?.setColor('#ff9a91');
    } finally { this.saving = false; }
  }
}
