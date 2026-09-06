import Phaser from 'phaser';
import { DeckScene as BaseDeckScene } from './deck-scene.ts';
import { buildCharacterCombatSlot, getEvolutionForm } from './character-growth.ts';
import { formatCombatTraits, formatDamageSpecialty } from './combat-trait-labels.ts';
import { DECK_SLOT_WIDTH, DECK_START_X } from './deck-drag.ts';
import { resolveUnitArt } from './production-assets.ts';
import { getSlotById, type PrototypeRosterSlot } from './prototype.ts';
import { MAX_DECK_SLOTS, type GuestProgress } from './save.ts';
import { COLORS, addText as text, fitTextToWidth, rarityColor } from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

const STORY_BADGE_COLOR = '#d7c79f';
const SPECIAL_BADGE_COLOR = '#9fd7d0';

type DeckPresentationCarrier = Phaser.Scene & {
  progress: GuestProgress;
  selectedIds: string[];
  favoriteIds: string[];
  page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  cardsLayer?: Phaser.GameObjects.Container;
  deckLayer?: Phaser.GameObjects.Container;
  pageText?: Phaser.GameObjects.Text;
  statusText?: Phaser.GameObjects.Text;
  getOwnedSlots(): readonly PrototypeRosterSlot[];
  getFilteredSlots(): readonly PrototypeRosterSlot[];
  renderDeckOrder(): void;
  renderCards(): void;
  wireDragSurface(surface: Phaser.GameObjects.Rectangle, slotId: string, originX: number, originY: number): void;
  toggleFavorite(slotId: string): void;
};

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
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

function rewriteDeckCopy(value: string): string {
  if (/HTTP_|state hash|revision|request_|account_/i.test(value)) {
    return '편성 정보를 불러오지 못했습니다. 연결 상태를 확인해 주세요.';
  }
  if (value === '출격 열 · 왼쪽부터 1 → 0 소환 순서') return '출격 부대 · 1 → 0 순서';
  if (value.includes('보유 캐릭터만 표시 · 드래그로 1~0 슬롯 배치')) {
    return '위 10칸이 실제 소환 순서입니다. 아래 명부에서 동료를 눌러 추가·제외하거나 끌어 교체하세요.';
  }
  if (value.includes('탭 추가·제외 · 길게 끌어 슬롯 배치')) {
    return '위 10칸이 실제 소환 순서입니다. 아래 명부에서 동료를 눌러 추가·제외하거나 끌어 교체하세요.';
  }
  if (/^출격 열 \d+\/10 · 보유 \d+명 · 현재 명부 \d+명$/.test(value)) {
    return value.replace(/^출격 열 /, '출격 ').replace('현재 명부', '표시');
  }
  if (value.startsWith('명부 조건 · ')) return value.replace('명부 조건 · ', '필터 · ');
  if (value.includes('탭 추가 · 드래그로 슬롯 배치') || value.includes('탭 제외 · 드래그로 순서 교환')) return '';
  if (value === '기존 자동 편성을 불러왔습니다. 저장하면 수동 편성이 권위가 됩니다.') {
    return '자동 편성을 불러왔습니다. 저장하면 현재 순서를 사용합니다.';
  }
  if (value.endsWith(' · 기기 UI 선호에 저장')) return value.replace(' · 기기 UI 선호에 저장', '');
  if (value.includes('선택된 순서가 1~0 소환 순서입니다.')) return '편성이 변경되었습니다. 위 출격 순서대로 전투에 투입됩니다.';
  return value;
}

function isStatusCopy(value: string): boolean {
  return /편성|저장|계정|오프라인|온라인|즐겨찾기|슬롯|자동|전투에는 반영|불러왔습니다|불러오지 못했습니다/.test(value);
}

function decorateText(target: Phaser.GameObjects.Text, value: string): void {
  const compact = isCompactMobileViewport();

  if (value === '출격 편성') {
    target.setPosition(52, compact ? 18 : 16).setFontSize(compact ? 36 : 38).setColor('#f5e7c7');
    return;
  }
  if (value.startsWith('출격 ') && value.includes('· 보유 ')) {
    target.setY(compact ? 67 : 65).setFontSize(compact ? 16 : 14).setColor('#cbd5e2');
  }
  if (value.startsWith('위 10칸이 실제 소환 순서입니다.')) {
    target.setY(compact ? 88 : 86).setFontSize(compact ? 15 : 12).setColor('#8793a3');
    target.setWordWrapWidth(920);
  }
  if (value.startsWith('필터 · ')) {
    target.setFontSize(compact ? 14 : 11).setColor('#8499ae');
    fitTextToWidth(target, 1080, compact ? 12 : 10);
  }
  if (/^(빠른 분류|역할|공격|대항|비용|사거리|성장|검색) · /.test(value)) {
    target.setFontSize(compact ? 15 : 12);
  }
  if (/^출격 [1-90]$/.test(value)) target.setColor('#f0d47a');
  if (/^\d+ \/ \d+ · 표시 /.test(value)) {
    target.setFontSize(compact ? 16 : 13).setColor('#8f9daf');
  }
  if (isStatusCopy(value)) {
    target.setFontSize(compact ? 16 : 13).setWordWrapWidth(900);
  }
  if (value === '') target.setVisible(false);
}

function installTextFactory(scene: Phaser.Scene): () => void {
  const original = scene.add.text.bind(scene.add) as typeof scene.add.text;
  scene.add.text = ((x: number, y: number, value: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const rewritten = rewriteDeckCopy(normalize(value));
    const target = original(x, y, rewritten, style);
    decorateText(target, rewritten);
    const originalSetText = target.setText.bind(target);
    target.setText = ((nextValue: string | string[]) => {
      const next = rewriteDeckCopy(normalize(nextValue));
      const result = originalSetText(next);
      decorateText(target, next);
      return result;
    }) as typeof target.setText;
    return target;
  }) as typeof scene.add.text;
  return () => { scene.add.text = original; };
}

function renderFormationOrder(scene: DeckPresentationCarrier): void {
  scene.deckLayer?.destroy(true);
  scene.deckLayer = scene.add.container(0, 0).setDepth(2);
  const compact = isCompactMobileViewport();
  const y = 166;
  const height = compact ? 88 : 84;

  for (let index = 0; index < MAX_DECK_SLOTS; index += 1) {
    const slotId = scene.selectedIds[index];
    const rosterSlot = slotId ? getSlotById(slotId) : undefined;
    const x = DECK_START_X + index * DECK_SLOT_WIDTH + DECK_SLOT_WIDTH / 2;
    const badge = rosterSlot ? acquisitionBadge(rosterSlot) : undefined;
    const border = badge ? Phaser.Display.Color.HexStringToColor(badge.color).color : 0x46515f;
    const bg = scene.add.rectangle(x, y, DECK_SLOT_WIDTH - 8, height, rosterSlot ? 0x1d2934 : 0x111820, 0.99)
      .setStrokeStyle(rosterSlot ? 2 : 1, border, rosterSlot ? 0.9 : 0.45);
    scene.deckLayer.add(bg);
    scene.deckLayer.add(scene.add.rectangle(x, y - height / 2 + 2, DECK_SLOT_WIDTH - 14, 3, border, rosterSlot ? 0.88 : 0.22));

    const keyCircle = scene.add.circle(x - 39, y - height / 2 + 14, compact ? 13 : 11, rosterSlot ? 0x342d1d : 0x1b222b, 0.98)
      .setStrokeStyle(1, rosterSlot ? 0xc8a85a : 0x566272, 0.82);
    scene.deckLayer.add(keyCircle);
    scene.deckLayer.add(text(scene, keyCircle.x, keyCircle.y - 1, hotkeyLabel(index), compact ? 14 : 12, rosterSlot ? COLORS.gold : '#8792a0', 'center').setOrigin(0.5));

    if (!rosterSlot) {
      scene.deckLayer.add(text(scene, x, y - 2, '+', compact ? 28 : 24, '#566272', 'center').setOrigin(0.5));
      scene.deckLayer.add(text(scene, x, y + 25, '빈 슬롯', compact ? 12 : 10, '#697584', 'center').setOrigin(0.5));
      continue;
    }

    const meta = scene.progress.characterProgressById?.[rosterSlot.slotId];
    const art = resolveUnitArt(rosterSlot.definition.id, meta?.selectedFormId);
    const portrait = scene.add.sprite(x, y - 5, art.family.idle.key, 0).setTint(art.tint);
    portrait.setScale(((compact ? 44 : 42) / art.family.idle.frameHeight) * art.displayScale);
    scene.deckLayer.add(portrait);

    const cost = text(scene, x + 43, y - height / 2 + 7, `◆${rosterSlot.cost}`, compact ? 12 : 10, COLORS.gold, 'right').setOrigin(1, 0);
    scene.deckLayer.add(cost);
    const displayName = rosterSlot.displayName.length > 6 ? `${rosterSlot.displayName.slice(0, 5)}…` : rosterSlot.displayName;
    const name = text(scene, x, y + 25, displayName, compact ? 14 : 12, '#f4f7fb', 'center').setOrigin(0.5);
    fitTextToWidth(name, DECK_SLOT_WIDTH - 18, compact ? 11 : 10);
    scene.deckLayer.add(name);
    scene.wireDragSurface(bg, rosterSlot.slotId, x, y);
  }
}

function renderRosterCards(scene: DeckPresentationCarrier): void {
  scene.cardsLayer?.destroy(true);
  scene.cardsLayer = scene.add.container(0, 0).setDepth(2);
  const compact = isCompactMobileViewport();
  const ownedSlots = scene.getOwnedSlots();
  const filteredSlots = scene.getFilteredSlots();
  const start = scene.page * scene.pageSize;
  const visible = filteredSlots.slice(start, start + scene.pageSize);
  const columns = compact ? 4 : 5;
  const cardWidth = compact ? 276 : 222;
  const cardHeight = 124;
  const xGap = compact ? 292 : 236;
  const startX = compact ? 190 : 168;
  const startY = compact ? 404 : 374;
  const yGap = compact ? 128 : 132;
  scene.pageText?.setText(`${scene.page + 1} / ${scene.pageCount} · 표시 ${filteredSlots.length}/${ownedSlots.length}명`);

  if (visible.length === 0) {
    scene.cardsLayer.add(text(scene, 640, compact ? 470 : 446, '현재 조건에 맞는 보유 캐릭터가 없습니다.', compact ? 24 : 20, COLORS.muted, 'center').setOrigin(0.5));
    scene.cardsLayer.add(text(scene, 640, compact ? 508 : 481, '필터를 바꾸거나 검색어를 지워 보세요.', compact ? 17 : 14, '#7f8da0', 'center').setOrigin(0.5));
    return;
  }

  visible.forEach((slot, localIndex) => {
    const col = localIndex % columns;
    const row = Math.floor(localIndex / columns);
    const x = startX + col * xGap;
    const y = startY + row * yGap;
    const selectedIndex = scene.selectedIds.indexOf(slot.slotId);
    const selected = selectedIndex >= 0;
    const favorite = scene.favoriteIds.includes(slot.slotId);
    const badge = acquisitionBadge(slot);
    const baseBorder = Phaser.Display.Color.HexStringToColor(badge.color).color;
    const border = selected ? 0xf2d56f : baseBorder;
    const bg = scene.add.rectangle(x, y, cardWidth, cardHeight, selected ? 0x2c2d28 : 0x1b2430, 0.99)
      .setStrokeStyle(selected ? 3 : 1, border, selected ? 0.96 : 0.72);
    scene.cardsLayer!.add(bg);
    scene.cardsLayer!.add(scene.add.rectangle(x, y - cardHeight / 2 + 2, cardWidth - 12, selected ? 4 : 2, border, selected ? 0.95 : 0.66));

    const meta = scene.progress.characterProgressById?.[slot.slotId];
    const art = resolveUnitArt(slot.definition.id, meta?.selectedFormId);
    const portrait = scene.add.sprite(x - cardWidth / 2 + (compact ? 54 : 47), y + 5, art.family.idle.key, 0).setTint(art.tint);
    portrait.setScale(((compact ? 66 : 60) / art.family.idle.frameHeight) * art.displayScale);
    scene.cardsLayer!.add(portrait);

    scene.cardsLayer!.add(text(scene, x - cardWidth / 2 + 11, y - cardHeight / 2 + 7, badge.label, compact ? 14 : 12, badge.color));
    if (selected) {
      scene.cardsLayer!.add(text(scene, x + cardWidth / 2 - 11, y - cardHeight / 2 + 7, `출격 ${hotkeyLabel(selectedIndex)}`, compact ? 14 : 12, COLORS.gold, 'right').setOrigin(1, 0));
    }

    const favoriteStar = text(scene, x + cardWidth / 2 - 13, y + 30, favorite ? '★' : '☆', compact ? 22 : 19, favorite ? COLORS.gold : '#738092', 'right').setOrigin(1, 0.5);
    favoriteStar.setInteractive({ useHandCursor: true });
    favoriteStar.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    favoriteStar.on('pointerup', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      scene.toggleFavorite(slot.slotId);
    });
    scene.cardsLayer!.add(favoriteStar);

    const infoX = x - cardWidth / 2 + (compact ? 96 : 84);
    const infoWidth = compact ? 150 : 124;
    const name = text(scene, infoX, y - 43, slot.displayName, compact ? 19 : 16, '#ffffff');
    fitTextToWidth(name, infoWidth, compact ? 14 : 12);
    scene.cardsLayer!.add(name);

    const level = meta?.level ?? 1;
    const plusLevel = meta?.plusLevel ?? 0;
    const currentSlot = buildCharacterCombatSlot(slot, level, meta?.selectedFormId, plusLevel);
    const form = selectedFormName(scene.progress, slot.slotId);
    const levelText = plusLevel > 0 ? `Lv${level} +${plusLevel}` : `Lv${level}`;
    const growthLine = text(scene, infoX, y - 13, `${slot.role} · ${levelText} · ${form}`, compact ? 14 : 12, COLORS.blue);
    fitTextToWidth(growthLine, infoWidth, compact ? 11 : 10);
    scene.cardsLayer!.add(growthLine);

    const traits = formatCombatTraits(currentSlot.definition);
    const specialty = formatDamageSpecialty(currentSlot.definition);
    const identity = specialty ? `${traits} · ${specialty}` : traits;
    const combatLine = text(scene, infoX, y + 17, `◆${currentSlot.cost} · ${identity}`, compact ? 14 : 12, COLORS.gold);
    fitTextToWidth(combatLine, infoWidth + (compact ? 6 : 4), compact ? 10 : 9);
    scene.cardsLayer!.add(combatLine);

    scene.wireDragSurface(bg, slot.slotId, x, y);
  });
}

function installRenderOverrides(scene: Phaser.Scene): () => void {
  const carrier = scene as unknown as DeckPresentationCarrier;
  const originalDeckOrder = carrier.renderDeckOrder;
  const originalCards = carrier.renderCards;
  carrier.renderDeckOrder = () => renderFormationOrder(carrier);
  carrier.renderCards = () => renderRosterCards(carrier);
  return () => {
    carrier.renderDeckOrder = originalDeckOrder;
    carrier.renderCards = originalCards;
  };
}

function directText(container: Phaser.GameObjects.Container): Phaser.GameObjects.Text | undefined {
  return container.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text);
}

function polishContainer(container: Phaser.GameObjects.Container): void {
  const compact = isCompactMobileViewport();
  const label = directText(container)?.text ?? '';

  if (label === '출격 부대 · 1 → 0 순서') {
    container.setY(112).setDepth(4);
    return;
  }
  if (label === '보유 명부 · 전선에 올릴 동료 선택') {
    container.setY(compact ? 336 : 300).setDepth(4);
    return;
  }
  if (label === '지휘소' || label === '편성 저장' || label === '자동 편성' || label === '◀ 이전' || label === '다음 ▶') {
    container.setDepth(8);
  }
}

function polishRectangle(rectangle: Phaser.GameObjects.Rectangle): void {
  const near = (a: number, b: number, tolerance = 1): boolean => Math.abs(a - b) <= tolerance;
  if (near(rectangle.x, 640) && near(rectangle.width, 1190, 1) && (near(rectangle.y, 250) || near(rectangle.y, 272))) {
    rectangle.setFillStyle(0x101720, 0.82).setStrokeStyle(1, 0x49627b, 0.34);
  }
}

function visitGameObjects(
  objects: readonly Phaser.GameObjects.GameObject[],
  visitor: (object: Phaser.GameObjects.GameObject) => void,
): void {
  objects.forEach((object) => {
    visitor(object);
    if (object instanceof Phaser.GameObjects.Container) visitGameObjects(object.list, visitor);
  });
}

function installDynamicPolish(scene: Phaser.Scene): () => void {
  const polished = new WeakSet<Phaser.GameObjects.GameObject>();
  const apply = (): void => {
    visitGameObjects(scene.children.list, (object) => {
      if (polished.has(object)) return;
      polished.add(object);
      if (object instanceof Phaser.GameObjects.Container) polishContainer(object);
      else if (object instanceof Phaser.GameObjects.Rectangle) polishRectangle(object);
    });
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, apply);
  apply();
  return () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, apply);
}

/** Keeps deck rules intact while making summon order the dominant gameplay-meta surface. */
export class DeckScene extends BaseDeckScene {
  override create(): void {
    const restoreTextFactory = installTextFactory(this);
    super.create();
    const restoreRenderOverrides = installRenderOverrides(this);
    const formationBoard = this.add.rectangle(640, 166, 1190, 96, 0x0f161f, 0.98)
      .setStrokeStyle(1, 0x8b7445, 0.46)
      .setDepth(1);
    const restoreDynamicPolish = installDynamicPolish(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      restoreDynamicPolish();
      restoreRenderOverrides();
      restoreTextFactory();
      formationBoard.destroy();
    });
  }
}
