import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { loadActiveProgress } from './active-progress';
import { recordActiveDeck, resetActiveDeckToAutomatic } from './active-meta-progression';
import { ART_BY_ID, ART_FAMILIES, UNIT_ART } from './assets';
import { buildCharacterCombatSlot, getEvolutionForm } from './character-growth';
import { formatCombatTraits, formatDamageSpecialty } from './combat-trait-labels';
import { DECK_SLOT_WIDTH, DECK_START_X, getDeckDropIndex, placeCharacterAtDeckIndex } from './deck-drag.ts';
import {
  ALL_PLAYER_SLOTS,
  getSlotById,
  type PrototypeRosterSlot,
} from './prototype';
import {
  DEFAULT_ROSTER_BROWSER_QUERY,
  ROSTER_ATTACK_FILTERS,
  ROSTER_COST_FILTERS,
  ROSTER_COUNTER_FILTERS,
  ROSTER_GROWTH_FILTERS,
  ROSTER_QUICK_FILTERS,
  ROSTER_RANGE_FILTERS,
  ROSTER_ROLE_FILTERS,
  cycleRosterFilter,
  filterRosterSlots,
  summarizeRosterBrowserQuery,
  type RosterAttackFilter,
  type RosterCostFilter,
  type RosterCounterFilter,
  type RosterGrowthFilter,
  type RosterQuickFilter,
  type RosterRangeFilter,
  type RosterRoleFilter,
} from './roster-browser.ts';
import { loadRosterFavoriteIds, toggleRosterFavoriteId } from './roster-favorites.ts';
import {
  MAX_DECK_SLOTS,
  getEffectiveDeckSlotIds,
  getOwnedCharacterIds,
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
const ROSTER_ID_SET = new Set(ALL_PLAYER_SLOTS.map((slot) => slot.slotId));
const QUICK_LABELS: Readonly<Record<RosterQuickFilter, string>> = {
  ALL: '전체', STORY: '스토리', C: 'C', B: 'B', A: 'A', S: 'S', SS: 'SS', FAVORITE: '★',
};
const ATTACK_LABELS: Readonly<Record<RosterAttackFilter, string>> = { ALL: '전체', SINGLE: '단일', AREA: '범위' };
const COUNTER_LABELS: Readonly<Record<RosterCounterFilter, string>> = {
  ALL: '전체', NEUTRAL: '중립', BEAST: '야수', UNDEAD: '언데드', NATURE: '자연', ARCANE: '비전', DEMON: '악마', MACHINE: '기계', ANOMALY: '이상',
};
const COST_LABELS: Readonly<Record<RosterCostFilter, string>> = { ALL: '전체', LOW: '저', MID: '중', HIGH: '고' };
const RANGE_LABELS: Readonly<Record<RosterRangeFilter, string>> = { ALL: '전체', SHORT: '근', MID: '중', LONG: '장' };
const GROWTH_LABELS: Readonly<Record<RosterGrowthFilter, string>> = { ALL: '전체', PLUS: '+레벨', EVOLVED: '진화' };

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

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export class DeckScene extends Phaser.Scene {
  private progress: GuestProgress = { clearedStageIds: [], specialClearedStageIds: [], permanentRewardIds: [] };
  private selectedIds: string[] = [];
  private favoriteIds: string[] = [];
  private quickFilter: RosterQuickFilter = DEFAULT_ROSTER_BROWSER_QUERY.quick;
  private roleFilter: RosterRoleFilter = DEFAULT_ROSTER_BROWSER_QUERY.role;
  private attackFilter: RosterAttackFilter = DEFAULT_ROSTER_BROWSER_QUERY.attack;
  private counterFilter: RosterCounterFilter = DEFAULT_ROSTER_BROWSER_QUERY.counter;
  private costFilter: RosterCostFilter = DEFAULT_ROSTER_BROWSER_QUERY.cost;
  private rangeFilter: RosterRangeFilter = DEFAULT_ROSTER_BROWSER_QUERY.range;
  private growthFilter: RosterGrowthFilter = DEFAULT_ROSTER_BROWSER_QUERY.growth;
  private searchText = DEFAULT_ROSTER_BROWSER_QUERY.search;
  private page = 0;
  private cardsLayer?: Phaser.GameObjects.Container;
  private deckLayer?: Phaser.GameObjects.Container;
  private filterLayer?: Phaser.GameObjects.Container;
  private header?: Phaser.GameObjects.Text;
  private pageText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private saving = false;

  constructor() { super('deck'); }

  create(): void {
    drawBackdrop(this);
    const compact = isCompactMobileViewport();
    this.input.dragDistanceThreshold = compact ? 18 : 8;
    this.favoriteIds = [...loadRosterFavoriteIds(ROSTER_ID_SET)];
    this.header = text(this, 52, 28, '편성 불러오는 중…', compact ? 36 : 38, '#fff4cf');
    text(
      this,
      54,
      compact ? 78 : 80,
      compact
        ? '탭 추가·제외 · 길게 끌어 슬롯 배치 · ★ 즐겨찾기 · 필터 조합 가능'
        : '보유 캐릭터만 표시 · 드래그로 1~0 슬롯 배치 · 빠른/상세 필터와 검색·즐겨찾기를 조합할 수 있다.',
      compact ? 20 : 17,
      '#b8c0ce',
    );
    button(this, 1180, compact ? 58 : 55, 150, compact ? 84 : 48, '메인', () => this.scene.start('main-menu'), 0x586275);

    this.pageText = text(this, 640, 632, '', compact ? 20 : 17, '#9ca9bb', 'center').setOrigin(0.5);
    this.statusText = text(this, 640, compact ? 604 : 604, '저장 데이터를 불러오는 중…', compact ? 18 : 14, '#9ca9bb', 'center').setOrigin(0.5);

    button(this, 86, 660, 120, compact ? 84 : 48, '◀ 이전', () => this.changePage(-1), 0x586275);
    button(this, 235, 660, 140, compact ? 84 : 48, '다음 ▶', () => this.changePage(1), 0x586275);
    button(this, 910, 660, 170, compact ? 84 : 48, '자동 편성', () => { void this.resetAutomatic(); }, 0x6d6b55);
    button(this, 1120, 660, 190, compact ? 84 : 48, '편성 저장', () => { void this.saveDeck(); }, 0x5f8fb8);

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      const progress = view.progress;
      this.progress = progress;
      this.selectedIds = [...getEffectiveDeckSlotIds(progress)];
      this.statusText?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '계정 편성을 읽기 전용으로 불러왔습니다. 저장하려면 온라인 연결이 필요합니다.'
        : view.authority === 'ACCOUNT_ONLINE'
          ? '계정 서버 편성을 불러왔습니다.'
          : progress.deckSlotIds === undefined
            ? '기존 자동 편성을 불러왔습니다. 저장하면 수동 편성이 권위가 됩니다.'
            : '저장된 수동 편성을 불러왔습니다.');
      this.statusText?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? '#ffcf8a' : '#9fcfff');
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

  private getFilteredSlots(): readonly PrototypeRosterSlot[] {
    return filterRosterSlots(this.getOwnedSlots(), this.progress, {
      quick: this.quickFilter,
      role: this.roleFilter,
      attack: this.attackFilter,
      counter: this.counterFilter,
      cost: this.costFilter,
      range: this.rangeFilter,
      growth: this.growthFilter,
      search: this.searchText,
      favoriteIds: new Set(this.favoriteIds),
    });
  }

  private get pageCount(): number {
    return Math.max(1, Math.ceil(this.getFilteredSlots().length / this.pageSize));
  }

  private changePage(delta: number): void {
    this.page = Math.max(0, Math.min(this.pageCount - 1, this.page + delta));
    this.renderCards();
  }

  private renderAll(): void {
    const ownedCount = this.getOwnedSlots().length;
    const filteredCount = this.getFilteredSlots().length;
    this.page = Math.min(this.page, this.pageCount - 1);
    this.header?.setText(`수동 10칸 편성 · 보유 ${ownedCount}명 · 표시 ${filteredCount}명 · 선택 ${this.selectedIds.length}/${MAX_DECK_SLOTS}`);
    this.renderDeckOrder();
    this.renderFilters();
    this.renderCards();
  }

  private renderDeckOrder(): void {
    this.deckLayer?.destroy(true);
    this.deckLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const startX = DECK_START_X;
    const y = compact ? 140 : 142;

    for (let index = 0; index < MAX_DECK_SLOTS; index += 1) {
      const slotId = this.selectedIds[index];
      const rosterSlot = slotId ? getSlotById(slotId) : undefined;
      const x = startX + index * DECK_SLOT_WIDTH + DECK_SLOT_WIDTH / 2;
      const badge = rosterSlot ? acquisitionBadge(rosterSlot) : undefined;
      const border = badge ? Phaser.Display.Color.HexStringToColor(badge.color).color : 0x4b5666;
      const bg = this.add.rectangle(x, y, DECK_SLOT_WIDTH - 8, compact ? 68 : 54, rosterSlot ? 0x293242 : 0x1d232d, 0.98).setStrokeStyle(2, border, 0.9);
      this.deckLayer.add(bg);
      this.deckLayer.add(text(this, x - 44, y - (compact ? 27 : 22), hotkeyLabel(index), compact ? 17 : 14, rosterSlot ? '#f0d67d' : '#667181'));
      this.deckLayer.add(text(this, x, y + 4, rosterSlot?.displayName ?? '빈 칸', compact ? 16 : 13, rosterSlot ? '#ffffff' : '#6f7987', 'center').setOrigin(0.5));
      if (rosterSlot) this.wireDragSurface(bg, rosterSlot.slotId, x, y);
    }
  }

  private renderFilters(): void {
    this.filterLayer?.destroy(true);
    this.filterLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const y = compact ? 222 : 215;
    const width = 142;
    const height = compact ? 56 : 42;
    const startX = 82;
    const gap = 156;
    const labels = [
      `분류·${QUICK_LABELS[this.quickFilter]}`,
      `역할·${this.roleFilter === 'ALL' ? '전체' : this.roleFilter}`,
      `공격·${ATTACK_LABELS[this.attackFilter]}`,
      `대항·${COUNTER_LABELS[this.counterFilter]}`,
      `비용·${COST_LABELS[this.costFilter]}`,
      `사거리·${RANGE_LABELS[this.rangeFilter]}`,
      `성장·${GROWTH_LABELS[this.growthFilter]}`,
      this.searchText.trim() ? `검색·${this.searchText.trim().slice(0, 5)}` : '검색·없음',
    ];
    const actions = [
      () => { this.quickFilter = cycleRosterFilter(ROSTER_QUICK_FILTERS, this.quickFilter); this.resetFilterPage(); },
      () => { this.roleFilter = cycleRosterFilter(ROSTER_ROLE_FILTERS, this.roleFilter); this.resetFilterPage(); },
      () => { this.attackFilter = cycleRosterFilter(ROSTER_ATTACK_FILTERS, this.attackFilter); this.resetFilterPage(); },
      () => { this.counterFilter = cycleRosterFilter(ROSTER_COUNTER_FILTERS, this.counterFilter); this.resetFilterPage(); },
      () => { this.costFilter = cycleRosterFilter(ROSTER_COST_FILTERS, this.costFilter); this.resetFilterPage(); },
      () => { this.rangeFilter = cycleRosterFilter(ROSTER_RANGE_FILTERS, this.rangeFilter); this.resetFilterPage(); },
      () => { this.growthFilter = cycleRosterFilter(ROSTER_GROWTH_FILTERS, this.growthFilter); this.resetFilterPage(); },
      () => this.promptSearch(),
    ];
    labels.forEach((label, index) => {
      this.filterLayer!.add(button(this, startX + index * gap, y, width, height, label, actions[index]!, index === 7 ? 0x6e668c : 0x52677f));
    });
  }

  private resetFilterPage(): void {
    this.page = 0;
    this.statusText?.setText(summarizeRosterBrowserQuery({
      quick: this.quickFilter,
      role: this.roleFilter,
      attack: this.attackFilter,
      counter: this.counterFilter,
      cost: this.costFilter,
      range: this.rangeFilter,
      growth: this.growthFilter,
      search: this.searchText,
      favoriteIds: new Set(this.favoriteIds),
    }));
    this.statusText?.setColor('#9fcfff');
    this.renderAll();
  }

  private promptSearch(): void {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') return;
    const next = window.prompt('캐릭터 이름·역할·설명·속성 검색 · 비우면 검색 해제', this.searchText);
    if (next === null) return;
    this.searchText = next.trim();
    this.resetFilterPage();
  }

  private renderCards(): void {
    this.cardsLayer?.destroy(true);
    this.cardsLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const ownedSlots = this.getOwnedSlots();
    const filteredSlots = this.getFilteredSlots();
    const start = this.page * this.pageSize;
    const visible = filteredSlots.slice(start, start + this.pageSize);
    const columns = compact ? 4 : 5;
    const cardWidth = compact ? 282 : 222;
    const cardHeight = compact ? 166 : 174;
    const xGap = compact ? 300 : 236;
    const startX = compact ? 190 : 168;
    const startY = compact ? 342 : 332;
    const yGap = compact ? 168 : 174;
    this.pageText?.setText(`${this.page + 1} / ${this.pageCount} · 표시 ${filteredSlots.length}/${ownedSlots.length}명`);

    if (visible.length === 0) {
      this.cardsLayer.add(text(this, INTERNAL_WIDTH / 2, 430, '현재 필터에 맞는 보유 캐릭터가 없습니다.', compact ? 24 : 20, '#9ca9bb', 'center').setOrigin(0.5));
      return;
    }

    visible.forEach((slot, localIndex) => {
      const col = localIndex % columns;
      const row = Math.floor(localIndex / columns);
      const x = startX + col * xGap;
      const y = startY + row * yGap;
      const selectedIndex = this.selectedIds.indexOf(slot.slotId);
      const selected = selectedIndex >= 0;
      const favorite = this.favoriteIds.includes(slot.slotId);
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

      const favoriteStar = text(this, x + cardWidth / 2 - 16, y - cardHeight / 2 + (selected ? 37 : 12), favorite ? '★' : '☆', compact ? 25 : 21, favorite ? '#ffe18a' : '#7f8998', 'right').setOrigin(1, 0);
      favoriteStar.setInteractive({ useHandCursor: true });
      favoriteStar.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
      favoriteStar.on('pointerup', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.toggleFavorite(slot.slotId);
      });
      this.cardsLayer!.add(favoriteStar);

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
      if (!compact) this.cardsLayer!.add(text(this, infoX, y + 51, selected ? '클릭 제외 · 드래그 슬롯 교환' : '클릭 추가 · 드래그 슬롯 배치', 11, selected ? '#ffe18a' : '#9aa7b8'));
      this.wireDragSurface(bg, slot.slotId, x, y);
    });
  }

  private toggleFavorite(slotId: string): void {
    this.favoriteIds = [...toggleRosterFavoriteId(this.favoriteIds, slotId, ROSTER_ID_SET)];
    const favorite = this.favoriteIds.includes(slotId);
    this.statusText?.setText(`${getSlotById(slotId)?.displayName ?? slotId} · 즐겨찾기 ${favorite ? '등록' : '해제'} · 기기 UI 선호에 저장`);
    this.statusText?.setColor('#f2d37c');
    this.page = Math.min(this.page, this.pageCount - 1);
    this.renderAll();
  }

  private wireDragSurface(
    surface: Phaser.GameObjects.Rectangle,
    slotId: string,
    originX: number,
    originY: number,
  ): void {
    let dragged = false;
    surface.setInteractive({ useHandCursor: true });
    this.input.setDraggable(surface);
    surface.on('pointerdown', () => { dragged = false; });
    surface.on('pointerup', () => {
      if (!dragged) this.toggleCharacter(slotId);
    });
    surface.on('dragstart', () => {
      dragged = true;
      surface.setAlpha(0.68);
      surface.setStrokeStyle(5, 0xf2d56f, 1);
    });
    surface.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      surface.setPosition(dragX, dragY);
    });
    surface.on('dragend', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      surface.setPosition(originX, originY).setAlpha(1);
      const targetIndex = getDeckDropIndex(dragX, dragY, isCompactMobileViewport());
      if (targetIndex === undefined) {
        this.renderAll();
        return;
      }
      this.dropCharacterIntoSlot(slotId, targetIndex);
    });
  }

  private dropCharacterIntoSlot(slotId: string, targetIndex: number): void {
    if (!getOwnedCharacterIds(this.progress).includes(slotId)) return;
    const next = placeCharacterAtDeckIndex(this.selectedIds, slotId, targetIndex, MAX_DECK_SLOTS);
    if (sameOrder(next, this.selectedIds)) {
      this.statusText?.setText(`슬롯 ${hotkeyLabel(targetIndex)} 위치를 유지합니다.`);
      this.statusText?.setColor('#9fcfff');
      this.renderAll();
      return;
    }
    this.selectedIds = next;
    this.statusText?.setText(`드래그 편성 변경 · ${slotId}을(를) 슬롯 ${hotkeyLabel(targetIndex)} 위치에 배치했습니다. 저장 전까지 전투에는 반영되지 않습니다.`);
    this.statusText?.setColor('#ffd493');
    this.renderAll();
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
      this.statusText?.setText('덱은 최대 10칸입니다. 기존 캐릭터를 먼저 제외하거나 원하는 슬롯에 드래그해 교체하세요.');
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
      const result = await recordActiveDeck(this.selectedIds);
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
    this.statusText?.setText('자동 편성을 계산하는 중…');
    this.statusText?.setColor('#9ca9bb');
    try {
      const result = await resetActiveDeckToAutomatic();
      this.progress = result.guestProgress;
      this.selectedIds = [...result.deckSlotIds];
      if (!this.scene.isActive()) return;
      this.statusText?.setText(result.persisted ? '현재 보유 순서 기준 자동 편성을 적용했습니다.' : '영구 저장 실패 · 현재 탭에서는 자동 편성을 유지합니다.');
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
      this.renderAll();
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '자동 편성을 적용하지 못했습니다.');
      this.statusText?.setColor('#ff9a91');
    } finally {
      this.saving = false;
    }
  }
}
