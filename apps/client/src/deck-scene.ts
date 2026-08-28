import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART } from './assets';
import { buildCharacterCombatSlot, getEvolutionForm } from './character-growth';
import { formatCombatTraits, formatDamageSpecialty } from './combat-trait-labels';
import {
  ALL_PLAYER_SLOTS,
  getSlotById,
  type PrototypeRosterSlot,
} from './prototype';
import {
  MAX_DECK_SLOTS,
  getEffectiveDeckSlotIds,
  getOwnedCharacterIds,
  loadGuestProgress,
  recordGuestDeck,
  resetGuestDeckToAutomatic,
  type GuestProgress,
} from './save';
import { isCompactMobileViewport } from './viewport';

const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const rarityColor: Record<string, string> = {
  C: '#b9c2cf',
  B: '#8bd6a3',
  A: '#79baff',
  S: '#d79aff',
  SS: '#ffd56f',
};
const STORY_BADGE_COLOR = '#d7c79f';
const SPECIAL_BADGE_COLOR = '#9fd7d0';

function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size = 24,
  color = '#ffffff',
  align: 'left' | 'center' | 'right' = 'left',
): Phaser.GameObjects.Text {
  const renderedSize = isCompactMobileViewport() ? Math.max(size, 16) : size;
  return scene.add.text(x, y, value, {
    fontFamily: FONT,
    fontSize: `${renderedSize}px`,
    color,
    align,
    stroke: '#11151d',
    strokeThickness: renderedSize >= 30 ? 4 : 0,
  });
}

function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  accent = 0x59677f,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, height, 0x252b38, 0.98).setStrokeStyle(3, accent, 1);
  const labelText = text(scene, 0, 0, label, Math.max(17, Math.floor(height * 0.3)), '#ffffff', 'center').setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, labelText]);
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => bg.setFillStyle(0x343c4d, 1));
  bg.on('pointerout', () => { bg.setFillStyle(0x252b38, 0.98); container.setScale(1); });
  bg.on('pointerdown', () => container.setScale(0.98));
  bg.on('pointerupoutside', () => container.setScale(1));
  bg.on('pointerup', () => { container.setScale(1); onClick(); });
  return container;
}

function drawBackdrop(scene: Phaser.Scene): void {
  scene.cameras.main.setBackgroundColor('#171c27');
  const g = scene.add.graphics();
  g.fillStyle(0x171c27).fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
  g.fillStyle(0x26344a, 1).fillCircle(1090, 125, 230);
  g.fillStyle(0x263247, 1).fillTriangle(0, 570, 330, 250, 630, 570);
  g.fillStyle(0x222d40, 1).fillTriangle(430, 570, 760, 200, 1080, 570);
  g.fillStyle(0x111722).fillRect(0, 570, INTERNAL_WIDTH, 150);
}

function familyForUnit(unitId: string) {
  const variant = UNIT_ART[unitId] ?? { familyId: 'warrior', tint: 0xffffff, attackFx: 'SLASH' as const };
  const family = ART_BY_ID[variant.familyId] ?? ART_FAMILIES[0]!;
  return { family, tint: variant.tint, displayScale: variant.displayScale ?? 1 };
}

function hotkeyLabel(index: number): string {
  return index === 9 ? '0' : String(index + 1);
}

function selectedFormName(progress: GuestProgress, characterId: string): string {
  const formId = progress.characterProgressById?.[characterId]?.selectedFormId;
  if (!formId) return '기본형';
  try {
    return getEvolutionForm(formId).name;
  } catch {
    return '기본형';
  }
}

function acquisitionBadge(slot: PrototypeRosterSlot): { readonly label: string; readonly color: string } {
  if (slot.rarity) return { label: slot.rarity, color: rarityColor[slot.rarity] ?? '#ffffff' };
  if (slot.acquisitionClass === 'STORY') return { label: '스토리', color: STORY_BADGE_COLOR };
  if (slot.acquisitionClass === 'SPECIAL') return { label: '특수', color: SPECIAL_BADGE_COLOR };
  return { label: '동료', color: '#ffffff' };
}

export class DeckScene extends Phaser.Scene {
  private progress: GuestProgress = { clearedStageIds: [], specialClearedStageIds: [], permanentRewardIds: [] };
  private selectedIds: string[] = [];
  private page = 0;
  private cardsLayer?: Phaser.GameObjects.Container;
  private deckLayer?: Phaser.GameObjects.Container;
  private header?: Phaser.GameObjects.Text;
  private pageText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private saving = false;

  constructor() { super('deck'); }

  create(): void {
    drawBackdrop(this);
    const compact = isCompactMobileViewport();
    this.header = text(this, 52, 28, '편성 불러오는 중…', compact ? 36 : 38, '#fff4cf');
    text(
      this,
      54,
      compact ? 78 : 80,
      compact
        ? '보유 캐릭터를 눌러 1~10칸 편성 · 선택 순서 = 1~0 소환 순서'
        : '보유한 캐릭터에서 1~10명을 고른다. 미획득 캐릭터는 편성 목록에 나타나지 않는다.',
      compact ? 20 : 17,
      '#b8c0ce',
    );
    button(this, 1180, compact ? 58 : 55, 150, compact ? 84 : 48, '메인', () => this.scene.start('main-menu'), 0x586275);

    this.pageText = text(this, 640, 632, '', compact ? 20 : 17, '#9ca9bb', 'center').setOrigin(0.5);
    this.statusText = text(this, 640, compact ? 594 : 600, '저장 데이터를 불러오는 중…', compact ? 19 : 15, '#9ca9bb', 'center').setOrigin(0.5);

    button(this, 86, 660, 120, compact ? 84 : 48, '◀ 이전', () => this.changePage(-1), 0x586275);
    button(this, 235, 660, 140, compact ? 84 : 48, '다음 ▶', () => this.changePage(1), 0x586275);
    button(this, 910, 660, 170, compact ? 84 : 48, '자동 편성', () => { void this.resetAutomatic(); }, 0x6d6b55);
    button(this, 1120, 660, 190, compact ? 84 : 48, '편성 저장', () => { void this.saveDeck(); }, 0x5f8fb8);

    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      this.selectedIds = [...getEffectiveDeckSlotIds(progress)];
      this.statusText?.setText(progress.deckSlotIds === undefined ? '기존 자동 편성을 불러왔습니다. 저장하면 수동 편성이 권위가 됩니다.' : '저장된 수동 편성을 불러왔습니다.');
      this.statusText?.setColor('#9fcfff');
      this.renderAll();
    });
  }

  private get pageSize(): number {
    return isCompactMobileViewport() ? 8 : 10;
  }

  private getOwnedSlots(): readonly PrototypeRosterSlot[] {
    const owned = new Set(getOwnedCharacterIds(this.progress));
    return ALL_PLAYER_SLOTS.filter((slot) => owned.has(slot.slotId));
  }

  private get pageCount(): number {
    return Math.max(1, Math.ceil(this.getOwnedSlots().length / this.pageSize));
  }

  private changePage(delta: number): void {
    this.page = Math.max(0, Math.min(this.pageCount - 1, this.page + delta));
    this.renderCards();
  }

  private renderAll(): void {
    const ownedCount = this.getOwnedSlots().length;
    this.page = Math.min(this.page, this.pageCount - 1);
    this.header?.setText(`수동 10칸 편성 · 보유 ${ownedCount}명 · 선택 ${this.selectedIds.length}/${MAX_DECK_SLOTS}`);
    this.renderDeckOrder();
    this.renderCards();
  }

  private renderDeckOrder(): void {
    this.deckLayer?.destroy(true);
    this.deckLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const slotWidth = 112;
    const startX = 76;
    const y = compact ? 140 : 142;

    for (let index = 0; index < MAX_DECK_SLOTS; index += 1) {
      const slotId = this.selectedIds[index];
      const rosterSlot = slotId ? getSlotById(slotId) : undefined;
      const x = startX + index * slotWidth + slotWidth / 2;
      const badge = rosterSlot ? acquisitionBadge(rosterSlot) : undefined;
      const border = badge ? Phaser.Display.Color.HexStringToColor(badge.color).color : 0x4b5666;
      const bg = this.add.rectangle(x, y, slotWidth - 8, compact ? 58 : 54, rosterSlot ? 0x293242 : 0x1d232d, 0.98).setStrokeStyle(2, border, 0.9);
      this.deckLayer.add(bg);
      this.deckLayer.add(text(this, x - 44, y - 22, hotkeyLabel(index), compact ? 17 : 14, rosterSlot ? '#f0d67d' : '#667181'));
      this.deckLayer.add(text(this, x, y + 4, rosterSlot?.displayName ?? '빈 칸', compact ? 16 : 13, rosterSlot ? '#ffffff' : '#6f7987', 'center').setOrigin(0.5));
      if (rosterSlot) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => this.toggleCharacter(rosterSlot.slotId));
      }
    }
  }

  private renderCards(): void {
    this.cardsLayer?.destroy(true);
    this.cardsLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const ownedSlots = this.getOwnedSlots();
    const start = this.page * this.pageSize;
    const visible = ownedSlots.slice(start, start + this.pageSize);
    const columns = compact ? 4 : 5;
    const cardWidth = compact ? 282 : 222;
    const cardHeight = compact ? 166 : 174;
    const xGap = compact ? 300 : 236;
    const startX = compact ? 190 : 168;
    const startY = compact ? 282 : 280;
    const yGap = compact ? 184 : 190;
    this.pageText?.setText(`${this.page + 1} / ${this.pageCount} · 보유 ${ownedSlots.length}명`);

    visible.forEach((slot, localIndex) => {
      const col = localIndex % columns;
      const row = Math.floor(localIndex / columns);
      const x = startX + col * xGap;
      const y = startY + row * yGap;
      const selectedIndex = this.selectedIds.indexOf(slot.slotId);
      const selected = selectedIndex >= 0;
      const badge = acquisitionBadge(slot);
      const baseBorder = Phaser.Display.Color.HexStringToColor(badge.color).color;
      const border = selected ? 0xf2d56f : baseBorder;
      const bg = this.add.rectangle(x, y, cardWidth, cardHeight, selected ? 0x343329 : 0x252c3a, 0.98).setStrokeStyle(selected ? 4 : 3, border, 0.95);
      this.cardsLayer!.add(bg);

      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x - cardWidth / 2 + (compact ? 54 : 48), y - 8, art.family.idle.key, 0).setTint(art.tint);
      portrait.setScale(((compact ? 76 : 70) / art.family.idle.frameHeight) * art.displayScale);
      this.cardsLayer!.add(portrait);

      this.cardsLayer!.add(text(this, x - cardWidth / 2 + 12, y - cardHeight / 2 + 8, badge.label, compact ? 17 : 14, badge.color));
      if (selected) this.cardsLayer!.add(text(this, x + cardWidth / 2 - 12, y - cardHeight / 2 + 8, `#${hotkeyLabel(selectedIndex)}`, compact ? 18 : 15, '#ffe18a', 'right').setOrigin(1, 0));

      const infoX = x - cardWidth / 2 + (compact ? 100 : 88);
      this.cardsLayer!.add(text(this, infoX, y - cardHeight / 2 + 30, slot.displayName, compact ? 21 : 18, '#ffffff'));

      const meta = this.progress.characterProgressById?.[slot.slotId];
      const level = meta?.level ?? 1;
      const plusLevel = meta?.plusLevel ?? 0;
      const currentSlot = buildCharacterCombatSlot(slot, level, meta?.selectedFormId, plusLevel);
      const form = selectedFormName(this.progress, slot.slotId);
      const levelText = plusLevel > 0 ? `Lv${level} +${plusLevel}` : `Lv${level}`;
      this.cardsLayer!.add(text(this, infoX, y - 29, `${slot.role} · ${levelText} · ${form}`, compact ? 16 : 13, '#acd2f3'));
      this.cardsLayer!.add(text(this, infoX, y - 1, `${currentSlot.cost} 보급 · ${formatCombatTraits(currentSlot.definition)}`, compact ? 15 : 12, '#f2d37c'));
      const specialty = formatDamageSpecialty(currentSlot.definition);
      this.cardsLayer!.add(text(this, infoX, y + 26, specialty || '범용 공격', compact ? 15 : 12, specialty ? '#ffd493' : '#9da8b8'));
      if (!compact) this.cardsLayer!.add(text(this, infoX, y + 51, selected ? '선택됨 · 다시 누르면 제외' : '눌러서 덱 맨 뒤에 추가', 11, selected ? '#ffe18a' : '#9aa7b8'));
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.toggleCharacter(slot.slotId));
    });
  }

  private toggleCharacter(slotId: string): void {
    if (!getOwnedCharacterIds(this.progress).includes(slotId)) return;
    const index = this.selectedIds.indexOf(slotId);
    if (index >= 0) {
      this.selectedIds.splice(index, 1);
      this.statusText?.setText('편성이 변경되었습니다. 저장하기 전까지 전투에는 반영되지 않습니다.');
      this.statusText?.setColor('#ffd493');
      this.renderAll();
      return;
    }
    if (this.selectedIds.length >= MAX_DECK_SLOTS) {
      this.statusText?.setText('덱은 최대 10칸입니다. 기존 캐릭터를 먼저 제외하세요.');
      this.statusText?.setColor('#ff9a91');
      return;
    }
    this.selectedIds.push(slotId);
    this.statusText?.setText('편성이 변경되었습니다. 선택된 순서가 1~0 소환 순서입니다.');
    this.statusText?.setColor('#ffd493');
    this.renderAll();
  }

  private async saveDeck(): Promise<void> {
    if (this.saving) return;
    if (this.selectedIds.length < 1) {
      this.statusText?.setText('최소 1명의 캐릭터를 편성해야 합니다.');
      this.statusText?.setColor('#ff9a91');
      return;
    }
    this.saving = true;
    this.statusText?.setText('편성 저장 중…');
    this.statusText?.setColor('#9ca9bb');
    try {
      const result = await recordGuestDeck(this.selectedIds);
      this.progress = result.guestProgress;
      this.selectedIds = [...result.deckSlotIds];
      if (!this.scene.isActive()) return;
      this.statusText?.setText(result.persisted ? '수동 편성 저장 완료 · 다음 전투부터 이 순서가 적용됩니다.' : '영구 저장 실패 · 현재 탭에서는 수동 편성을 유지합니다.');
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
      this.renderAll();
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '편성을 저장하지 못했습니다.');
      this.statusText?.setColor('#ff9a91');
    } finally {
      this.saving = false;
    }
  }

  private async resetAutomatic(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.statusText?.setText('자동 편성으로 되돌리는 중…');
    this.statusText?.setColor('#9ca9bb');
    try {
      const result = await resetGuestDeckToAutomatic();
      this.progress = result.guestProgress;
      this.selectedIds = [...result.deckSlotIds];
      if (!this.scene.isActive()) return;
      this.statusText?.setText(result.persisted ? '자동 편성으로 복귀했습니다. 보유 순서 기준 최대 10명이 적용됩니다.' : '영구 저장 실패 · 현재 탭에서는 자동 편성을 유지합니다.');
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
      this.renderAll();
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '자동 편성으로 되돌리지 못했습니다.');
      this.statusText?.setColor('#ff9a91');
    } finally {
      this.saving = false;
    }
  }
}
