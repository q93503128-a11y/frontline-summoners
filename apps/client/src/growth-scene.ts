import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { buildCharacterCombatSlot, getEvolutionForms } from './character-growth';
import { getSlotById } from './prototype';
import {
  getOwnedCharacterIds,
  loadGuestProgress,
  selectGuestEvolutionForm,
  type GuestProgress,
} from './save';
import { addButton, addText, COLORS, drawBackdrop, familyForUnit, rarityColor } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
};
const PAGE_SIZE = 6;
const CHAPTER_ONE_FINAL_STAGE_ID = 'main_01_020';
const CHAPTER_TWO_FINAL_STAGE_ID = 'main_02_020';
const CHAPTER_THREE_FINAL_STAGE_ID = 'main_03_020';

export function getImplementedBaseLevelCap(progress: GuestProgress): number {
  const cleared = new Set(progress.clearedStageIds);
  if (cleared.has(CHAPTER_THREE_FINAL_STAGE_ID)) return 40;
  if (cleared.has(CHAPTER_TWO_FINAL_STAGE_ID)) return 30;
  if (cleared.has(CHAPTER_ONE_FINAL_STAGE_ID)) return 20;
  return 10;
}

function getNextCapMessage(levelCap: number): string {
  if (levelCap >= 40) return '제3장 완료 · 기본 레벨 상한 Lv40';
  if (levelCap >= 30) return '제3장 완료 시 기본 레벨 상한 Lv40';
  if (levelCap >= 20) return '제2장 완료 시 기본 레벨 상한 Lv30';
  return '제1장 완료 시 기본 레벨 상한 Lv20';
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
    addText(this, 54, 90, '보유 동료의 현재 성장과 전투 수치, 해금된 형태를 확인한다.', compact ? 20 : 17, COLORS.muted);
    addButton(this, 1010, compact ? 62 : 58, 150, compact ? 84 : 50, '모집', () => this.scene.start('recruitment'), 0x8b6fb5);
    addButton(this, 1170, compact ? 62 : 58, 150, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);

    this.add.rectangle(250, 370, 420, 500, 0x222936, 0.97).setStrokeStyle(3, 0x59677f);
    this.add.rectangle(830, 370, 700, 500, 0x222936, 0.97).setStrokeStyle(3, 0x7b6990);
    this.pageText = addText(this, 250, 626, '', compact ? 19 : 16, '#9ca9bb', 'center').setOrigin(0.5);
    this.statusText = addText(this, 830, 642, '성장 정보를 불러오는 중…', compact ? 18 : 15, '#9ca9bb', 'center').setOrigin(0.5);
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
    this.pageText?.setText(`${this.page + 1} / ${this.pageCount} · 보유 ${owned.length}명`);
    const visible = owned.slice(this.page * PAGE_SIZE, this.page * PAGE_SIZE + PAGE_SIZE);
    visible.forEach((characterId, index) => {
      const slot = getSlotById(characterId);
      if (!slot) return;
      const meta = this.progress.characterProgressById?.[characterId];
      const selected = characterId === this.selectedCharacterId;
      const y = 165 + index * 72;
      const badge = slot.rarity ?? (slot.acquisitionClass === 'STORY' ? '스토리' : '특수');
      const color = slot.rarity ? rarityColor[slot.rarity] ?? '#ffffff' : '#d7c79f';
      const button = addButton(this, 250, y, 350, compact ? 64 : 58, `${slot.displayName} · Lv${meta?.level ?? 1} +${meta?.plusLevel ?? 0}`, () => {
        this.selectedCharacterId = characterId;
        this.renderList();
        this.renderDetail();
      }, selected ? 0xc5a04c : 0x59677f);
      this.listLayer!.add(button);
      this.listLayer!.add(addText(this, 88, y - 24, badge, compact ? 16 : 13, color));
    });
  }

  private renderDetail(): void {
    this.detailLayer?.destroy(true);
    this.detailLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const characterId = this.selectedCharacterId;
    if (!characterId) {
      this.detailLayer.add(addText(this, 830, 360, '보유 동료가 없습니다.', compact ? 24 : 20, '#8995a7', 'center').setOrigin(0.5));
      return;
    }
    const slot = getSlotById(characterId);
    const meta = this.progress.characterProgressById?.[characterId];
    if (!slot || !meta) return;
    const combat = buildCharacterCombatSlot(slot, meta.level, meta.selectedFormId, meta.plusLevel);
    const art = familyForUnit(slot.definition.id);
    const portrait = this.add.sprite(610, 245, art.family.idle.key, 0).setTint(art.tint);
    portrait.setScale((116 / art.family.idle.frameHeight) * art.displayScale);
    this.detailLayer.add(portrait);
    const badge = slot.rarity ?? (slot.acquisitionClass === 'STORY' ? '스토리' : '특수');
    const badgeColor = slot.rarity ? rarityColor[slot.rarity] ?? '#ffffff' : '#d7c79f';
    const levelCap = getImplementedBaseLevelCap(this.progress);
    addText(this, 710, 155, slot.displayName, compact ? 31 : 29, '#ffffff');
    addText(this, 712, 196, badge, compact ? 18 : 16, badgeColor);
    addText(this, 712, 230, `Lv${meta.level} / 현재 상한 Lv${levelCap} · +${meta.plusLevel}`, compact ? 20 : 17, '#f2d37c');
    addText(this, 712, 266, slot.description, compact ? 17 : 15, '#b8c0ce').setWordWrapWidth(470);
    const rechargeSeconds = (combat.rechargeFrames / 30).toFixed(1);
    const stats = [
      `HP ${combat.definition.maxHp}`,
      `공격 ${combat.definition.attackDamage}`,
      `생산비 ${combat.cost}`,
      `재생산 ${rechargeSeconds}초`,
      `이동 ${combat.definition.moveSpeed}`,
      `대기 사거리 ${combat.definition.standingRange}`,
      `공격 범위 ${combat.definition.attackMinRange}~${combat.definition.attackMaxRange}`,
    ];
    addText(this, 555, 350, stats.join('\n'), compact ? 19 : 17, '#dce4ef').setLineSpacing(8);
    const forms = getEvolutionForms(characterId);
    addText(this, 930, 338, '형태', compact ? 23 : 21, '#e5c7ff');
    if (forms.length === 0) {
      addText(this, 930, 392, '현재 선택 가능한 진화 형태가 없습니다.', compact ? 18 : 15, '#8995a7').setWordWrapWidth(300);
    } else {
      forms.forEach((form, index) => {
        const unlocked = meta.unlockedFormIds.includes(form.formId);
        const selected = meta.selectedFormId === form.formId;
        const label = unlocked ? `${form.formOrder}형태 · ${form.name}${selected ? ' · 선택 중' : ''}` : `${form.formOrder}형태 · 미해금`;
        const formButton = addButton(this, 1070, 398 + index * 76, 285, compact ? 66 : 58, label, () => {
          if (unlocked && !selected && !this.saving) void this.selectForm(characterId, form.formId);
        }, selected ? 0xc5a04c : unlocked ? 0x7b6990 : 0x46505e);
        if (!unlocked) formButton.setAlpha(0.55);
        this.detailLayer!.add(formButton);
      });
    }
    this.detailLayer.add(addText(this, 830, 603, getNextCapMessage(levelCap), compact ? 17 : 14, levelCap >= 40 ? '#8ee3aa' : '#9ca9bb', 'center').setOrigin(0.5));
  }

  private async selectForm(characterId: string, formId: string): Promise<void> {
    this.saving = true;
    this.statusText?.setText('형태 변경 저장 중…');
    this.statusText?.setColor('#c7d0dd');
    try {
      const result = await selectGuestEvolutionForm(characterId, formId);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      this.statusText?.setText(result.persisted ? '형태 변경 저장 완료' : '형태는 변경됐지만 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
      this.renderList();
      this.renderDetail();
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '형태 변경에 실패했습니다.');
      this.statusText?.setColor('#ff9a91');
    } finally {
      this.saving = false;
    }
  }
}
