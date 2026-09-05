import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
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
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
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
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
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
    addText(this, 52, 28, '성 장', compact ? 44 : 48, COLORS.cream);
    addText(this, 54, 84, '전투 경험을 훈련 기록으로 정리하고, 진화 계보를 따라 다음 형태를 개방한다.', compact ? 19 : 16, COLORS.muted);
    addButton(this, 1010, compact ? 62 : 56, 150, compact ? 84 : 50, '모집', () => this.scene.start('recruitment'), 0x8b6fb5, { tone: 'secondary' });
    addButton(this, 1170, compact ? 62 : 56, 150, compact ? 84 : 50, '지휘소', () => this.scene.start('main-menu'), 0x586275, { tone: 'quiet' });

    addSectionHeading(this, 52, 126, '훈련 명부', 382, 0x607894);
    addCommandPanel(this, 246, 384, 390, 472, 0x607894, 0x1e2631, 0.92);
    addSectionHeading(this, 470, 126, '훈련 기록 · 현재 전투 성능', 758, 0x8a7450);

    this.pageText = addText(this, 246, 586, '', compact ? 19 : 15, COLORS.dim, 'center').setOrigin(0.5);
    this.statusText = addText(this, 842, 690, '성장 정보를 불러오는 중…', compact ? 18 : 14, COLORS.dim, 'center').setOrigin(0.5).setWordWrapWidth(730);
    addButton(this, 145, 636, 150, compact ? 84 : 50, '◀ 이전', () => this.changePage(-1), 0x586275, { tone: 'quiet' });
    addButton(this, 345, 636, 150, compact ? 84 : 50, '다음 ▶', () => this.changePage(1), 0x586275, { tone: 'quiet' });

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.authority = view.authority;
      this.progress = view.progress;
      const owned = getOwnedCharacterIds(view.progress);
      this.selectedCharacterId = owned[0];
      this.statusText?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '계정 오프라인 기록 · 성장 변경은 온라인 연결 후 사용할 수 있습니다.'
        : '동료를 선택해 훈련 기록과 진화 계보를 확인하세요.');
      this.statusText?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : COLORS.blue);
      this.renderList();
      this.renderDetail();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '성장 정보를 불러오지 못했습니다.').setColor(COLORS.red);
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
    this.pageText?.setText(`${this.page + 1} / ${this.pageCount} · 보유 ${owned.length}명`);
    const visible = owned.slice(this.page * PAGE_SIZE, this.page * PAGE_SIZE + PAGE_SIZE);

    if (visible.length === 0) {
      this.listLayer.add(addText(this, 246, 350, '보유 동료가 없습니다.', compact ? 22 : 18, COLORS.dim, 'center').setOrigin(0.5));
      return;
    }

    visible.forEach((characterId, index) => {
      const slot = getSlotById(characterId);
      if (!slot) return;
      const meta = this.progress.characterProgressById?.[characterId];
      const selected = characterId === this.selectedCharacterId;
      const y = 184 + index * 64;
      const badge = slot.rarity ?? (slot.acquisitionClass === 'STORY' ? '스토리' : '특수');
      const color = slot.rarity ? rarityColor[slot.rarity] ?? '#ffffff' : '#d7c79f';
      const item = addButton(
        this,
        246,
        y,
        336,
        compact ? 64 : 54,
        `${slot.displayName}  ·  Lv${meta?.level ?? 1}  +${meta?.plusLevel ?? 0}`,
        () => {
          this.selectedCharacterId = characterId;
          this.renderList();
          this.renderDetail();
        },
        selected ? 0xc5a04c : 0x59677f,
        { tone: 'quiet' },
      );
      if (selected) setButtonState(item, 'selected');
      this.listLayer!.add(item);
      this.listLayer!.add(addText(this, 84, y - 22, badge, compact ? 16 : 12, color));
    });
  }

  private renderDetail(): void {
    this.detailLayer?.destroy(true);
    this.detailLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const characterId = this.selectedCharacterId;
    if (!characterId) {
      this.detailLayer.add(addText(this, 850, 360, '보유 동료가 없습니다.', compact ? 24 : 20, COLORS.dim, 'center').setOrigin(0.5));
      return;
    }

    const slot = getSlotById(characterId);
    const meta = this.progress.characterProgressById?.[characterId];
    if (!slot || !meta) return;

    const combat = buildCharacterCombatSlot(slot, meta.level, meta.selectedFormId, meta.plusLevel);
    const art = familyForUnit(slot.definition.id);
    const badge = slot.rarity ?? (slot.acquisitionClass === 'STORY' ? '스토리' : '특수');
    const badgeColor = slot.rarity ? rarityColor[slot.rarity] ?? '#ffffff' : '#d7c79f';
    const levelCap = getImplementedBaseLevelCap(this.progress);

    const identityPanel = addCommandPanel(this, 850, 242, 735, 196, 0x8a7450, 0x202731, 0.88);
    this.detailLayer.add(identityPanel);
    const portrait = this.add.sprite(548, 232, art.family.idle.key, 0).setTint(art.tint);
    portrait.setScale((112 / art.family.idle.frameHeight) * art.displayScale);
    this.detailLayer.add(portrait);
    this.detailLayer.add(addText(this, 625, 164, slot.displayName, compact ? 29 : 27, '#ffffff'));
    this.detailLayer.add(addText(this, 628, 200, `${badge} · Lv${meta.level}/${levelCap} · +${meta.plusLevel}`, compact ? 18 : 15, badgeColor));
    this.detailLayer.add(addText(this, 628, 231, slot.description, compact ? 16 : 13, COLORS.muted).setWordWrapWidth(545));

    const rechargeSeconds = (combat.rechargeFrames / 30).toFixed(1);
    this.detailLayer.add(addText(this, 628, 278, `HP ${combat.definition.maxHp}   공격 ${combat.definition.attackDamage}   생산비 ${combat.cost}   재생산 ${rechargeSeconds}초`, compact ? 16 : 13, '#dce4ef'));
    this.detailLayer.add(addText(this, 628, 307, `이동 ${combat.definition.moveSpeed}   대기 사거리 ${combat.definition.standingRange}   공격 범위 ${combat.definition.attackMinRange}~${combat.definition.attackMaxRange}`, compact ? 15 : 12, '#9fb0c3'));

    const gold = getGuestResourceBalance(this.progress, 'gold');
    const soul = getGuestResourceBalance(this.progress, 'soul_essence');
    const fragment = getGuestResourceBalance(this.progress, 'evo_fragment');
    const core = getGuestResourceBalance(this.progress, 'evo_core');
    const crown = getGuestResourceBalance(this.progress, 'evo_crown');
    this.detailLayer.add(addStatusPill(this, 590, 346, `G ${gold.toLocaleString('ko-KR')}`, 'neutral'));
    this.detailLayer.add(addStatusPill(this, 735, 346, `혼 ${soul}`, 'neutral'));
    this.detailLayer.add(addStatusPill(this, 875, 346, `조각 ${fragment}`, 'neutral'));
    this.detailLayer.add(addStatusPill(this, 1015, 346, `핵심 ${core}`, 'neutral'));
    this.detailLayer.add(addStatusPill(this, 1150, 346, `왕관 ${crown}`, 'neutral'));

    this.detailLayer.add(addSectionHeading(this, 488, 382, '기본 훈련 · 초월 강화', 725, 0x6d8c6f));
    const nextOne = Math.min(levelCap, meta.level + 1);
    const nextFive = Math.min(levelCap, meta.level + 5);
    const oneCost = getLevelUpgradeGoldCost(meta.level, nextOne);
    const fiveCost = getLevelUpgradeGoldCost(meta.level, nextFive);
    const plusCost = getPlusLevelSoulEssenceCost(slot.acquisitionClass, slot.rarity);
    const atLevelCap = meta.level >= levelCap;
    const atPlusCap = meta.plusLevel >= 50;

    const levelOne = addButton(this, 620, 427, 210, compact ? 72 : 58, atLevelCap ? '기본 Lv 상한' : `Lv +1 · G${oneCost.toLocaleString('ko-KR')}`, () => {
      if (!this.saving && !atLevelCap && this.writable) void this.upgradeLevel(characterId, nextOne);
    }, 0x6b7f68, { tone: 'primary' });
    const levelFive = addButton(this, 850, 427, 210, compact ? 72 : 58, atLevelCap ? '다음 장에서 상한 해금' : `Lv +${nextFive - meta.level} · G${fiveCost.toLocaleString('ko-KR')}`, () => {
      if (!this.saving && !atLevelCap && this.writable) void this.upgradeLevel(characterId, nextFive);
    }, 0x6b7f68, { tone: 'secondary' });
    const plus = addButton(this, 1080, 427, 210, compact ? 72 : 58, atPlusCap ? '+50 상한' : `+레벨 +1 · 혼 ${plusCost}`, () => {
      if (!this.saving && !atPlusCap && this.writable) void this.upgradePlus(characterId);
    }, 0x76628c, { tone: 'secondary' });
    this.detailLayer.add([levelOne, levelFive, plus]);

    const offlineReason = '온라인 계정 연결이 필요합니다.';
    if (this.saving) {
      setButtonState(levelOne, 'loading', '성장 저장 중');
      setButtonState(levelFive, 'loading', '성장 저장 중');
      setButtonState(plus, 'loading', '성장 저장 중');
    } else if (!this.writable) {
      setButtonState(levelOne, 'disabled', offlineReason);
      setButtonState(levelFive, 'disabled', offlineReason);
      setButtonState(plus, 'disabled', offlineReason);
    } else {
      if (atLevelCap) {
        setButtonState(levelOne, 'disabled', getNextCapMessage(levelCap));
        setButtonState(levelFive, 'locked', getNextCapMessage(levelCap));
      }
      if (atPlusCap) setButtonState(plus, 'disabled', '+레벨 최대치입니다.');
    }
    this.detailLayer.add(addText(this, 850, 465, getNextCapMessage(levelCap), compact ? 15 : 12, levelCap >= 50 ? COLORS.green : COLORS.dim, 'center').setOrigin(0.5));

    this.detailLayer.add(addSectionHeading(this, 488, 500, '진화 계보 · 형태를 선택하거나 다음 단계를 개방', 725, 0x8d6ba3));
    const forms = getEvolutionForms(characterId);
    const lineage = this.add.graphics();
    lineage.lineStyle(4, 0x705a82, 0.5);
    if (forms.length > 1) lineage.lineBetween(590, 546, 1110, 546);
    this.detailLayer.add(lineage);
    const xStart = forms.length <= 1 ? 850 : 590;
    const xGap = forms.length <= 1 ? 0 : 520 / (forms.length - 1);

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
      const node = this.add.circle(x, 546, selected ? 12 : 9, selected ? 0xf1cf73 : unlocked ? 0xaa86bd : 0x55445f, 1)
        .setStrokeStyle(3, selected ? 0xffe7a0 : unlocked ? 0xd4b5e0 : 0x806d89, 0.9);
      this.detailLayer!.add(node);
      let label: string;
      if (unlocked) label = `${form.formOrder}형태 · ${form.name}${selected ? '\n현재 사용 중' : '\n형태 선택'}`;
      else {
        label = `${form.formOrder}형태 · ${form.name}\nLv${recipe!.requiredBaseLevel} · ${compactCost(recipe!.cost.gold, recipe!.cost.evo_fragment, recipe!.cost.evo_core, recipe!.cost.evo_crown)}`;
      }
      const formButton = addButton(this, x, 606, 190, compact ? 84 : 72, label, () => {
        if (this.saving || !this.writable) return;
        if (selected) {
          this.statusText?.setText('이미 사용 중인 형태입니다.').setColor(COLORS.blue);
        } else if (unlocked) {
          void this.selectForm(characterId, form.formId);
        } else {
          void this.unlockForm(characterId, form.formId);
        }
      }, selected ? 0xc5a04c : unlocked ? 0x7b6990 : 0x8d6ba3, { tone: selected ? 'primary' : 'secondary' });
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
      this.statusText?.setText(result.persisted ? `Lv${result.characterProgress.level} 강화 완료 · G${spent.toLocaleString('ko-KR')} 사용` : '강화는 적용됐지만 영구 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '레벨 강화에 실패했습니다.').setColor(COLORS.red);
    } finally {
      this.finishSave();
    }
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
      this.statusText?.setText(result.persisted ? `+${result.characterProgress.plusLevel} 강화 완료 · 혼 ${spent} 사용` : '+레벨은 적용됐지만 영구 저장에 실패했습니다.');
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '+레벨 강화에 실패했습니다.').setColor(COLORS.red);
    } finally {
      this.finishSave();
    }
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
    } finally {
      this.finishSave();
    }
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
    } finally {
      this.finishSave();
    }
  }
}
