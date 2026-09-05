import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress';
import { recordActiveDeck, resetActiveDeckToAutomatic } from './active-meta-progression';
import { buildCharacterCombatSlot, getEvolutionForm } from './character-growth';
import { formatCombatTraits, formatDamageSpecialty } from './combat-trait-labels';
import { DECK_SLOT_WIDTH, DECK_START_X, getDeckDropIndex, placeCharacterAtDeckIndex } from './deck-drag.ts';
import { resolveUnitArt } from './production-assets.ts';
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
import {
  addButton as button,
  addSectionHeading,
  addText as text,
  COLORS,
  drawBackdrop,
  rarityColor,
  setButtonState,
} from './scene-ui';
import { isCompactMobileViewport } from './viewport';

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
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
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
  private cardsLayer: Phaser.GameObjects.Container | undefined;
  private deckLayer: Phaser.GameObjects.Container | undefined;
  private filterLayer: Phaser.GameObjects.Container | undefined;
  private header: Phaser.GameObjects.Text | undefined;
  private pageText: Phaser.GameObjects.Text | undefined;
  private statusText: Phaser.GameObjects.Text | undefined;
  private saveButton: Phaser.GameObjects.Container | undefined;
  private autoButton: Phaser.GameObjects.Container | undefined;
  private saving = false;
  private progressReady = false;

  constructor() { super('deck'); }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();
    this.input.dragDistanceThreshold = compact ? 18 : 8;
    this.favoriteIds = [...loadRosterFavoriteIds(ROSTER_ID_SET)];

    text(this, 52, 24, '출격 편성', compact ? 39 : 42, COLORS.cream);
    this.header = text(this, 54, compact ? 76 : 74, '전선 명부를 불러오는 중…', compact ? 19 : 16, '#c8d2df');
    text(
      this,
      54,
      compact ? 96 : 94,
      compact
        ? '탭 추가·제외 · 길게 끌어 슬롯 배치 · ★ 즐겨찾기 · 필터 조합 가능'
        : '보유 캐릭터만 표시 · 드래그로 1~0 슬롯 배치 · 빠른/상세 필터와 검색·즐겨찾기를 조합할 수 있다.',
      compact ? 17 : 14,
      COLORS.muted,
    );
    button(this, 1180, compact ? 58 : 55, 150, compact ? 84 : 48, '지휘소', () => this.scene.start('main-menu'), 0x586275, { tone: 'quiet' });

    addSectionHeading(this, 52, 112, '출격 열 · 왼쪽부터 1 → 0 소환 순서', 1176, 0xb69a56);
    this.add.rectangle(640, 164, 1190, compact ? 92 : 86, 0x171d25, 0.94).setStrokeStyle(2, 0x74694d, 0.72);
    const sortieRail = this.add.graphics();
    sortieRail.lineStyle(4, 0x9d8750, 0.28).lineBetween(72, 160, 1208, 160);
    for (let index = 0; index < 9; index += 1) {
      const x = DECK_START_X + DECK_SLOT_WIDTH * (index + 1) - 3;
      sortieRail.fillStyle(0xc7aa63, 0.38).fillTriangle(x - 5, 155, x + 5, 160, x - 5, 165);
    }

    const filterBandY = compact ? 272 : 250;
    const filterBandHeight = compact ? 116 : 68;
    this.add.rectangle(640, filterBandY, 1190, filterBandHeight, 0x121923, 0.9).setStrokeStyle(2, 0x536b82, 0.58);
    addSectionHeading(this, 52, compact ? 340 : 296, '보유 명부 · 전선에 올릴 동료 선택', 1176, 0x6284a2);

    this.statusText = text(this, 640, compact ? 624 : 620, '저장 데이터를 불러오는 중…', compact ? 17 : 14, '#9ca9bb', 'center').setOrigin(0.5).setWordWrapWidth(900);
    this.pageText = text(this, 640, compact ? 648 : 644, '', compact ? 18 : 16, '#8290a2', 'center').setOrigin(0.5);

    button(this, 86, 680, 120, compact ? 84 : 48, '◀ 이전', () => this.changePage(-1), 0x586275, { tone: 'quiet' });
    button(this, 235, 680, 140, compact ? 84 : 48, '다음 ▶', () => this.changePage(1), 0x586275, { tone: 'quiet' });
    this.autoButton = button(this, 910, 680, 170, compact ? 84 : 48, '자동 편성', () => { void this.resetAutomatic(); }, 0x756d4f, { tone: 'secondary', state: 'disabled' });
    this.saveButton = button(this, 1120, 680, 190, compact ? 84 : 48, '편성 저장', () => { void this.saveDeck(); }, 0x5f8fb8, { tone: 'primary', state: 'disabled' });
    this.refreshCommandStates();

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      const progress = view.progress;
      this.progress = progress;
      this.authority = view.authority;
      this.selectedIds = [...getEffectiveDeckSlotIds(progress)];
      this.progressReady = true;
      this.statusText?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '계정 편성을 읽기 전용으로 불러왔습니다. 저장하려면 온라인 연결이 필요합니다.'
        : view.authority === 'ACCOUNT_ONLINE'
          ? '계정 서버 편성을 불러왔습니다.'
          : progress.deckSlotIds === undefined
            ? '기존 자동 편성을 불러왔습니다. 저장하면 수동 편성이 권위가 됩니다.'
            : '저장된 수동 편성을 불러왔습니다.');
      this.statusText?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : COLORS.blue);
      this.renderAll();
      this.refreshCommandStates();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.progressReady = false;
      this.statusText?.setText(error instanceof Error ? error.message : '편성 데이터를 불러오지 못했습니다.').setColor(COLORS.red);
      this.refreshCommandStates();
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
    this.header?.setText(`출격 열 ${this.selectedIds.length}/${MAX_DECK_SLOTS} · 보유 ${ownedCount}명 · 현재 명부 ${filteredCount}명`);
    this.renderDeckOrder();
    this.renderFilters();
    this.renderCards();
    this.refreshCommandStates();
  }

  private renderDeckOrder(): void {
    this.deckLayer?.destroy(true);
    this.deckLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const y = 160;

    for (let index = 0; index < MAX_DECK_SLOTS; index += 1) {
      const slotId = this.selectedIds[index];
      const rosterSlot = slotId ? getSlotById(slotId) : undefined;
      const x = DECK_START_X + index * DECK_SLOT_WIDTH + DECK_SLOT_WIDTH / 2;
      const badge = rosterSlot ? acquisitionBadge(rosterSlot) : undefined;
      const border = badge ? Phaser.Display.Color.HexStringToColor(badge.color).color : 0x46515f;
      const height = compact ? 76 : 68;
      const bg = this.add.rectangle(x, y, DECK_SLOT_WIDTH - 8, height, rosterSlot ? 0x283342 : 0x181e27, 0.99).setStrokeStyle(rosterSlot ? 3 : 2, border, rosterSlot ? 0.9 : 0.56);
      this.deckLayer.add(bg);
      this.deckLayer.add(this.add.rectangle(x, y - height / 2 + 3, DECK_SLOT_WIDTH - 18, 4, border, rosterSlot ? 0.92 : 0.3));
      const keyCircle = this.add.circle(x - 41, y - height / 2 + 14, compact ? 13 : 11, rosterSlot ? 0x3b321d : 0x202731, 0.98).setStrokeStyle(1, rosterSlot ? 0xc8a85a : 0x566272, 0.85);
      this.deckLayer.add(keyCircle);
      this.deckLayer.add(text(this, keyCircle.x, keyCircle.y - 1, hotkeyLabel(index), compact ? 14 : 12, rosterSlot ? COLORS.gold : '#8792a0', 'center').setOrigin(0.5));

      if (rosterSlot) {
        const displayName = rosterSlot.displayName.length > 6 ? `${rosterSlot.displayName.slice(0, 5)}…` : rosterSlot.displayName;
        this.deckLayer.add(text(this, x, y - 10, displayName, compact ? 16 : 14, '#ffffff', 'center').setOrigin(0.5));
        this.deckLayer.add(text(this, x, y + 18, `${rosterSlot.role} · ◆${rosterSlot.cost}`, compact ? 12 : 11, '#cdbd91', 'center').setOrigin(0.5));
        this.wireDragSurface(bg, rosterSlot.slotId, x, y);
      } else {
        this.deckLayer.add(text(this, x, y + 4, '빈 칸', compact ? 15 : 13, '#687482', 'center').setOrigin(0.5));
      }
    }
  }

  private renderFilters(): void {
    this.filterLayer?.destroy(true);
    this.filterLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const summary = summarizeRosterBrowserQuery({
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
    this.filterLayer.add(text(this, 66, compact ? 218 : 220, `명부 조건 · ${summary}`, compact ? 16 : 13, '#9db2c8').setWordWrapWidth(1120));

    const labels = [
      `빠른 분류 · ${QUICK_LABELS[this.quickFilter]}`,
      `역할 · ${this.roleFilter === 'ALL' ? '전체' : this.roleFilter}`,
      `공격 · ${ATTACK_LABELS[this.attackFilter]}`,
      `대항 · ${COUNTER_LABELS[this.counterFilter]}`,
      `비용 · ${COST_LABELS[this.costFilter]}`,
      `사거리 · ${RANGE_LABELS[this.rangeFilter]}`,
      `성장 · ${GROWTH_LABELS[this.growthFilter]}`,
      this.searchText.trim() ? `검색 · ${this.searchText.trim().slice(0, 6)}` : '검색 · 없음',
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
    const active = [
      this.quickFilter !== 'ALL',
      this.roleFilter !== 'ALL',
      this.attackFilter !== 'ALL',
      this.counterFilter !== 'ALL',
      this.costFilter !== 'ALL',
      this.rangeFilter !== 'ALL',
      this.growthFilter !== 'ALL',
      this.searchText.trim().length > 0,
    ];

    if (compact) {
      const width = 276;
      const height = 50;
      labels.forEach((label, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        const x = 64 + width / 2 + col * 292;
        const y = 252 + row * 52;
        this.filterLayer!.add(button(this, x, y, width, height, label, actions[index]!, index === 0 ? 0x9a8150 : index === 7 ? 0x76668f : 0x50667e, {
          tone: index === 0 ? 'secondary' : 'quiet',
          state: active[index] ? 'selected' : 'default',
        }));
      });
      return;
    }

    const widths = [176, 132, 132, 142, 116, 126, 126, 154] as const;
    let cursor = 52;
    labels.forEach((label, index) => {
      const width = widths[index]!;
      const x = cursor + width / 2;
      this.filterLayer!.add(button(this, x, 254, width, 42, label, actions[index]!, index === 0 ? 0x9a8150 : index === 7 ? 0x76668f : 0x50667e, {
        tone: index === 0 ? 'secondary' : 'quiet',
        state: active[index] ? 'selected' : 'default',
      }));
      cursor += width + 8;
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
    this.statusText?.setColor(COLORS.blue);
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
    const cardWidth = compact ? 280 : 222;
    const cardHeight = compact ? 132 : 144;
    const xGap = compact ? 300 : 236;
    const startX = compact ? 190 : 168;
    const startY = compact ? 412 : 392;
    const yGap = compact ? 136 : 148;
    this.pageText?.setText(`${this.page + 1} / ${this.pageCount} · 표시 ${filteredSlots.length}/${ownedSlots.length}명`);

    if (visible.length === 0) {
      this.cardsLayer.add(text(this, INTERNAL_WIDTH / 2, compact ? 480 : 455, '현재 조건에 맞는 보유 캐릭터가 없습니다.', compact ? 24 : 20, COLORS.muted, 'center').setOrigin(0.5));
      this.cardsLayer.add(text(this, INTERNAL_WIDTH / 2, compact ? 518 : 490, '위 조건 명령을 눌러 다른 분류로 전환하세요.', compact ? 17 : 14, '#7f8da0', 'center').setOrigin(0.5));
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
      const bg = this.add.rectangle(x, y, cardWidth, cardHeight, selected ? 0x343329 : 0x222a35, 0.98).setStrokeStyle(selected ? 4 : 2, border, 0.95);
      this.cardsLayer!.add(bg);
      this.cardsLayer!.add(this.add.rectangle(x, y - cardHeight / 2 + 3, cardWidth - 12, selected ? 5 : 3, border, selected ? 0.95 : 0.72));

      const meta = this.progress.characterProgressById?.[slot.slotId];
      const art = resolveUnitArt(slot.definition.id, meta?.selectedFormId);
      const portrait = this.add.sprite(x - cardWidth / 2 + (compact ? 54 : 48), y - 4, art.family.idle.key, 0).setTint(art.tint);
      portrait.setScale(((compact ? 70 : 66) / art.family.idle.frameHeight) * art.displayScale);
      this.cardsLayer!.add(portrait);

      this.cardsLayer!.add(text(this, x - cardWidth / 2 + 12, y - cardHeight / 2 + 8, badge.label, compact ? 16 : 13, badge.color));
      if (selected) this.cardsLayer!.add(text(this, x + cardWidth / 2 - 12, y - cardHeight / 2 + 8, `출격 ${hotkeyLabel(selectedIndex)}`, compact ? 16 : 13, COLORS.gold, 'right').setOrigin(1, 0));

      const favoriteStar = text(this, x + cardWidth / 2 - 16, y - cardHeight / 2 + (selected ? 34 : 10), favorite ? '★' : '☆', compact ? 24 : 20, favorite ? COLORS.gold : '#7f8998', 'right').setOrigin(1, 0);
      favoriteStar.setInteractive({ useHandCursor: true });
      favoriteStar.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
      favoriteStar.on('pointerup', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.toggleFavorite(slot.slotId);
      });
      this.cardsLayer!.add(favoriteStar);

      const infoX = x - cardWidth / 2 + (compact ? 96 : 88);
      this.cardsLayer!.add(text(this, infoX, y - cardHeight / 2 + 24, slot.displayName, compact ? 20 : 17, '#ffffff'));

      const level = meta?.level ?? 1;
      const plusLevel = meta?.plusLevel ?? 0;
      const currentSlot = buildCharacterCombatSlot(slot, level, meta?.selectedFormId, plusLevel);
      const form = selectedFormName(this.progress, slot.slotId);
      const levelText = plusLevel > 0 ? `Lv${level} +${plusLevel}` : `Lv${level}`;
      this.cardsLayer!.add(text(this, infoX, y - 20, `${slot.role} · ${levelText} · ${form}`, compact ? 15 : 12, COLORS.blue));
      this.cardsLayer!.add(text(this, infoX, y + 4, `◆${currentSlot.cost} · ${formatCombatTraits(currentSlot.definition)}`, compact ? 14 : 12, COLORS.gold));
      const specialty = formatDamageSpecialty(currentSlot.definition);
      this.cardsLayer!.add(text(this, infoX, y + 28, specialty || '범용 공격', compact ? 14 : 12, specialty ? '#ffd493' : '#9da8b8'));
      if (!compact) this.cardsLayer!.add(text(this, infoX, y + 48, selected ? '탭 제외 · 드래그로 순서 교환' : '탭 추가 · 드래그로 슬롯 배치', 11, selected ? COLORS.gold : '#9aa7b8'));
      this.wireDragSurface(bg, slot.slotId, x, y);
    });
  }

  private toggleFavorite(slotId: string): void {
    this.favoriteIds = [...toggleRosterFavoriteId(this.favoriteIds, slotId, ROSTER_ID_SET)];
    const favorite = this.favoriteIds.includes(slotId);
    this.statusText?.setText(`${getSlotById(slotId)?.displayName ?? slotId} · 즐겨찾기 ${favorite ? '등록' : '해제'} · 기기 UI 선호에 저장`);
    this.statusText?.setColor(COLORS.gold);
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
      this.statusText?.setColor(COLORS.blue);
      this.renderAll();
      return;
    }
    this.selectedIds = next;
    this.statusText?.setText(`드래그 편성 변경 · ${getSlotById(slotId)?.displayName ?? '동료'}를 슬롯 ${hotkeyLabel(targetIndex)} 위치에 배치했습니다. 저장 전까지 전투에는 반영되지 않습니다.`);
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
      this.statusText?.setColor(COLORS.red);
      return;
    }
    this.selectedIds.push(slotId);
    this.statusText?.setText('편성이 변경되었습니다. 선택된 순서가 1~0 소환 순서입니다.');
    this.statusText?.setColor('#ffd493');
    this.renderAll();
  }

  private refreshCommandStates(): void {
    if (!this.saveButton || !this.autoButton) return;
    if (this.saving) {
      setButtonState(this.saveButton, 'loading', '편성 저장 처리 중');
      setButtonState(this.autoButton, 'loading', '편성 저장 처리 중');
      return;
    }
    if (!this.progressReady) {
      setButtonState(this.saveButton, 'disabled', '편성 데이터가 준비되지 않았습니다.');
      setButtonState(this.autoButton, 'disabled', '편성 데이터가 준비되지 않았습니다.');
      return;
    }
    if (this.authority === 'ACCOUNT_OFFLINE_CACHE') {
      setButtonState(this.saveButton, 'disabled', '온라인 계정 연결이 필요합니다.');
      setButtonState(this.autoButton, 'disabled', '온라인 계정 연결이 필요합니다.');
      return;
    }
    setButtonState(this.saveButton, 'default');
    setButtonState(this.autoButton, 'default');
  }

  private async saveDeck(): Promise<void> {
    if (this.saving) return;
    if (this.authority === 'ACCOUNT_OFFLINE_CACHE') {
      this.statusText?.setText('오프라인 계정 기록은 읽기 전용입니다. 온라인 연결 후 편성을 저장할 수 있습니다.').setColor(COLORS.warning);
      return;
    }
    if (this.selectedIds.length < 1) {
      this.statusText?.setText('최소 1명의 캐릭터를 편성해야 합니다.');
      this.statusText?.setColor(COLORS.red);
      return;
    }
    this.saving = true;
    this.refreshCommandStates();
    this.statusText?.setText('편성 저장 중…');
    this.statusText?.setColor(COLORS.muted);
    try {
      const result = await recordActiveDeck(this.selectedIds);
      this.progress = result.guestProgress;
      this.selectedIds = [...result.deckSlotIds];
      if (!this.scene.isActive()) return;
      this.statusText?.setText(result.persisted ? '수동 편성 저장 완료 · 다음 전투부터 이 순서가 적용됩니다.' : '영구 저장 실패 · 현재 탭에서는 수동 편성을 유지합니다.');
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
      this.renderAll();
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '편성을 저장하지 못했습니다.');
      this.statusText?.setColor(COLORS.red);
    } finally {
      this.saving = false;
      if (this.scene.isActive()) this.refreshCommandStates();
    }
  }

  private async resetAutomatic(): Promise<void> {
    if (this.saving) return;
    if (this.authority === 'ACCOUNT_OFFLINE_CACHE') {
      this.statusText?.setText('오프라인 계정 기록은 읽기 전용입니다. 온라인 연결 후 자동 편성을 적용할 수 있습니다.').setColor(COLORS.warning);
      return;
    }
    this.saving = true;
    this.refreshCommandStates();
    this.statusText?.setText('자동 편성을 계산하는 중…');
    this.statusText?.setColor(COLORS.muted);
    try {
      const result = await resetActiveDeckToAutomatic();
      this.progress = result.guestProgress;
      this.selectedIds = [...result.deckSlotIds];
      if (!this.scene.isActive()) return;
      this.statusText?.setText(result.persisted ? '현재 보유 순서 기준 자동 편성을 적용했습니다.' : '영구 저장 실패 · 현재 탭에서는 자동 편성을 유지합니다.');
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
      this.renderAll();
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '자동 편성을 적용하지 못했습니다.');
      this.statusText?.setColor(COLORS.red);
    } finally {
      this.saving = false;
      if (this.scene.isActive()) this.refreshCommandStates();
    }
  }
}
