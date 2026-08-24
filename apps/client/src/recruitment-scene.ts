import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import {
  CRYPTO_RECRUITMENT_RANDOM_SOURCE,
  FIRST_RECRUITMENT_BANNER,
  RECRUITMENT_UNITS,
  type RecruitmentPullResult,
} from './recruitment';
import { getSlotById } from './prototype';
import {
  loadGuestProgress,
  performGuestRecruitment,
  redeemGuestBannerSelection,
  type GuestProgress,
} from './save';
import { addButton, addText, COLORS, drawBackdrop, familyForUnit, rarityColor } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  treasureIds: [],
};

const RARITY_ORDER = ['C', 'B', 'A', 'S', 'SS'] as const;
const GUARANTEE_LABELS: Readonly<Record<RecruitmentPullResult['guaranteedBy'], string>> = {
  NONE: '',
  TEN_PULL_A_PLUS: '10회 A+',
  THIRTY_PULL_S_PLUS: '30회 S+',
  SIXTY_PULL_PICKUP_SS: '60회 픽업 SS',
};

export class RecruitmentScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private statusText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;
  private resultsLayer?: Phaser.GameObjects.Container;
  private selectionLayer?: Phaser.GameObjects.Container;
  private busy = false;

  constructor() { super('recruitment'); }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();

    addText(this, 54, 32, '모 집', compact ? 44 : 48, COLORS.cream);
    addText(this, 54, 91, FIRST_RECRUITMENT_BANNER.name, compact ? 27 : 26, '#ffffff');
    addText(this, 54, 128, FIRST_RECRUITMENT_BANNER.description, compact ? 18 : 16, COLORS.muted).setWordWrapWidth(770);
    addButton(this, 1170, compact ? 62 : 58, 150, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);

    this.add.rectangle(238, 317, 390, 300, 0x222936, 0.97).setStrokeStyle(3, 0x59677f);
    addText(this, 74, 183, '희귀도 확률', compact ? 23 : 21, '#ffe29a');
    let probabilityY = 228;
    for (const rarity of RARITY_ORDER) {
      const color = rarityColor[rarity] ?? '#ffffff';
      addText(this, 88, probabilityY, rarity, compact ? 21 : 18, color);
      addText(this, 188, probabilityY, `${FIRST_RECRUITMENT_BANNER.ratesPermille[rarity] / 10}%`, compact ? 21 : 18, '#ffffff');
      const poolCount = FIRST_RECRUITMENT_BANNER.poolByRarity[rarity].length;
      addText(this, 295, probabilityY, `${poolCount}종`, compact ? 18 : 15, '#9eabbc');
      probabilityY += compact ? 43 : 40;
    }
    addText(this, 74, 457, `모집 전용 ${RECRUITMENT_UNITS.length}종 · 기본 캠페인 10종 제외`, compact ? 18 : 15, '#9eabbc');

    this.add.rectangle(685, 317, 430, 300, 0x222936, 0.97).setStrokeStyle(3, 0x7b6990);
    addText(this, 500, 183, '보장', compact ? 23 : 21, '#e5c7ff');
    addText(this, 515, 231, `10회마다 ${FIRST_RECRUITMENT_BANNER.tenPullMinimumRarity}+`, compact ? 20 : 17, '#ffffff');
    addText(this, 515, 273, `30회마다 ${FIRST_RECRUITMENT_BANNER.thirtyPullMinimumRarity}+`, compact ? 20 : 17, '#ffffff');
    addText(this, 515, 315, `${FIRST_RECRUITMENT_BANNER.pickupSsGuaranteeEvery}회마다 픽업 SS`, compact ? 20 : 17, '#ffffff');
    addText(this, 515, 357, `${FIRST_RECRUITMENT_BANNER.selectionCreditEvery}회마다 배너 선택권 +1`, compact ? 20 : 17, '#ffffff');
    const pickupNames = FIRST_RECRUITMENT_BANNER.pickupSsIds.map((id) => getSlotById(id)?.displayName ?? id).join(', ');
    addText(this, 515, 407, `픽업 · ${pickupNames}`, compact ? 19 : 16, '#ffd873');
    addText(this, 515, 450, '중복은 현재 판정만 저장 · 조각/교환 경제는 아직 미적용', compact ? 17 : 14, '#9eabbc');

    this.add.rectangle(1060, 317, 280, 300, 0x222936, 0.97).setStrokeStyle(3, 0x8b7045);
    this.progressText = addText(this, 940, 192, '진행 불러오는 중…', compact ? 19 : 16, '#ffffff');
    addText(this, 940, 310, '현재 PRE-ALPHA는 모집 재화/가격 미적용', compact ? 17 : 14, '#b7a98c').setWordWrapWidth(240);
    addText(this, 940, 375, '확률·보장·소유권·중복 판정·저장은 실제 규칙으로 작동', compact ? 17 : 14, '#9eabbc').setWordWrapWidth(240);

    addButton(this, 972, compact ? 510 : 515, 210, compact ? 84 : 64, '1회 모집', () => { void this.performRecruitment(1); }, 0xc5a04c);
    addButton(this, 1182, compact ? 510 : 515, 210, compact ? 84 : 64, '10회 모집', () => { void this.performRecruitment(10); }, 0x8b6fb5);
    addButton(this, 1076, compact ? 605 : 595, 420, compact ? 84 : 62, '100회 선택권 사용', () => this.openSelection(), 0x7a668f);

    this.statusText = addText(this, 640, compact ? 680 : 670, '저장 데이터를 불러오는 중…', compact ? 18 : 15, '#9eabbc', 'center').setOrigin(0.5);

    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      this.statusText?.setText('모집 준비 완료');
      this.statusText?.setColor('#8ee3aa');
      this.refreshProgress();
    });
  }

  private refreshProgress(): void {
    const bannerProgress = this.progress.recruitmentProgressByBanner?.[FIRST_RECRUITMENT_BANNER.id] ?? { totalPulls: 0, selectionCredits: 0 };
    const ownedRecruitment = this.progress.ownedRecruitmentCharacterIds?.length ?? 0;
    const nextTen = FIRST_RECRUITMENT_BANNER.tenPullMinimumRarity;
    const nextPull = bannerProgress.totalPulls + 1;
    const untilPickup = FIRST_RECRUITMENT_BANNER.pickupSsGuaranteeEvery - (bannerProgress.totalPulls % FIRST_RECRUITMENT_BANNER.pickupSsGuaranteeEvery);
    const untilSelection = FIRST_RECRUITMENT_BANNER.selectionCreditEvery - (bannerProgress.totalPulls % FIRST_RECRUITMENT_BANNER.selectionCreditEvery);
    this.progressText?.setText([
      `누적 모집 ${bannerProgress.totalPulls}회`,
      `모집 캐릭터 ${ownedRecruitment}/${RECRUITMENT_UNITS.length}`,
      `선택권 ${bannerProgress.selectionCredits}장`,
      `다음 모집 #${nextPull}`,
      `픽업 SS까지 ${untilPickup}회`,
      `선택권까지 ${untilSelection}회`,
      `10회 보장 ${nextTen}+`,
    ].join('\n'));
  }

  private async performRecruitment(count: number): Promise<void> {
    if (this.busy || this.selectionLayer) return;
    this.busy = true;
    this.statusText?.setText(`${count}회 모집 중…`);
    this.statusText?.setColor('#c7d0dd');
    try {
      const result = await performGuestRecruitment(count, CRYPTO_RECRUITMENT_RANDOM_SOURCE, FIRST_RECRUITMENT_BANNER);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      this.refreshProgress();
      this.showResults(result.results);
      const newCount = result.results.filter((pull) => !pull.duplicate).length;
      const duplicateCount = result.results.length - newCount;
      const creditCount = result.results.filter((pull) => pull.selectionCreditGranted).length;
      const saveLabel = result.persisted ? '저장 완료' : '영구 저장 실패 · 현재 탭 유지';
      this.statusText?.setText(`${saveLabel} · 신규 ${newCount} · 중복 ${duplicateCount}${creditCount > 0 ? ` · 선택권 +${creditCount}` : ''}`);
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '모집에 실패했습니다.');
      this.statusText?.setColor('#ff9a91');
    } finally {
      this.busy = false;
    }
  }

  private showResults(results: readonly RecruitmentPullResult[]): void {
    this.resultsLayer?.destroy(true);
    this.resultsLayer = this.add.container(0, 0).setDepth(40);
    const compact = isCompactMobileViewport();
    const overlay = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x090d14, 0.9).setInteractive();
    const panelHeight = results.length === 1 ? 390 : 570;
    const panel = this.add.rectangle(INTERNAL_WIDTH / 2, 350, 1160, panelHeight, 0x202735, 0.99).setStrokeStyle(4, 0x6f7d94);
    this.resultsLayer.add([overlay, panel]);
    this.resultsLayer.add(addText(this, 640, results.length === 1 ? 205 : 105, results.length === 1 ? '모집 결과' : '10회 모집 결과', compact ? 34 : 32, COLORS.cream, 'center').setOrigin(0.5));

    const columns = results.length === 1 ? 1 : 5;
    const cardWidth = results.length === 1 ? 360 : 205;
    const cardHeight = results.length === 1 ? 190 : 185;
    const xGap = results.length === 1 ? 0 : 220;
    const yGap = 205;
    const startX = results.length === 1 ? 640 : 200;
    const startY = results.length === 1 ? 350 : 245;

    results.forEach((pull, index) => {
      const slot = getSlotById(pull.characterId);
      if (!slot) return;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * xGap;
      const y = startY + row * yGap;
      const color = Phaser.Display.Color.HexStringToColor(rarityColor[pull.rarity] ?? '#ffffff').color;
      const card = this.add.rectangle(x, y, cardWidth, cardHeight, 0x2a3241, 0.99).setStrokeStyle(pull.rarity === 'SS' ? 5 : 3, color, 1);
      this.resultsLayer!.add(card);

      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x, y - 32, art.family.idle.key, 0).setTint(art.tint);
      portrait.setScale(((results.length === 1 ? 92 : 66) / art.family.idle.frameHeight) * art.displayScale);
      this.resultsLayer!.add(portrait);
      this.resultsLayer!.add(addText(this, x, y - cardHeight / 2 + 10, pull.rarity, compact ? 20 : 17, rarityColor[pull.rarity] ?? '#ffffff', 'center').setOrigin(0.5, 0));
      this.resultsLayer!.add(addText(this, x, y + 37, slot.displayName, results.length === 1 ? 25 : 18, '#ffffff', 'center').setOrigin(0.5));
      this.resultsLayer!.add(addText(this, x, y + 67, pull.duplicate ? '중복' : 'NEW', results.length === 1 ? 20 : 15, pull.duplicate ? '#b7bdc9' : '#8ee3aa', 'center').setOrigin(0.5));
      const guarantee = GUARANTEE_LABELS[pull.guaranteedBy];
      if (guarantee) this.resultsLayer!.add(addText(this, x, y + 88, guarantee, results.length === 1 ? 16 : 12, '#ffd873', 'center').setOrigin(0.5));
      if (pull.selectionCreditGranted) this.resultsLayer!.add(addText(this, x, y + 108, '선택권 +1', results.length === 1 ? 16 : 12, '#d8b4ef', 'center').setOrigin(0.5));
    });

    const closeY = results.length === 1 ? 520 : 620;
    this.resultsLayer.add(addButton(this, 640, closeY, 260, compact ? 84 : 58, '확인', () => {
      this.resultsLayer?.destroy(true);
      this.resultsLayer = undefined;
    }, 0x667b95));
  }

  private openSelection(): void {
    if (this.busy || this.resultsLayer || this.selectionLayer) return;
    const bannerProgress = this.progress.recruitmentProgressByBanner?.[FIRST_RECRUITMENT_BANNER.id] ?? { totalPulls: 0, selectionCredits: 0 };
    if (bannerProgress.selectionCredits <= 0) {
      this.statusText?.setText('사용 가능한 100회 선택권이 없습니다.');
      this.statusText?.setColor('#ffb37c');
      return;
    }

    this.selectionLayer = this.add.container(0, 0).setDepth(50);
    const compact = isCompactMobileViewport();
    const overlay = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x090d14, 0.94).setInteractive();
    const panel = this.add.rectangle(INTERNAL_WIDTH / 2, 355, 1180, 620, 0x202735, 0.995).setStrokeStyle(4, 0x8c6ca4);
    this.selectionLayer.add([overlay, panel]);
    this.selectionLayer.add(addText(this, 640, 72, '배너 캐릭터 직접 선택', compact ? 32 : 30, COLORS.cream, 'center').setOrigin(0.5));
    this.selectionLayer.add(addText(this, 640, 108, `선택권 ${bannerProgress.selectionCredits}장 · 중복 선택도 가능`, compact ? 18 : 15, '#cbb8d8', 'center').setOrigin(0.5));

    RECRUITMENT_UNITS.forEach((unit, index) => {
      const col = index % 5;
      const row = Math.floor(index / 5);
      const x = 176 + col * 232;
      const y = 205 + row * 132;
      const owned = this.progress.ownedRecruitmentCharacterIds?.includes(unit.id) ?? false;
      const border = Phaser.Display.Color.HexStringToColor(rarityColor[unit.rarity] ?? '#ffffff').color;
      const item = addButton(this, x, y, 208, compact ? 104 : 96, `${unit.rarity} · ${unit.displayName}\n${owned ? '보유 중' : '미보유'}`, () => { void this.redeemSelection(unit.id); }, border);
      this.selectionLayer!.add(item);
    });

    this.selectionLayer.add(addButton(this, 640, 625, 220, compact ? 84 : 56, '취소', () => {
      this.selectionLayer?.destroy(true);
      this.selectionLayer = undefined;
    }, 0x5f6877));
  }

  private async redeemSelection(characterId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const result = await redeemGuestBannerSelection(characterId, FIRST_RECRUITMENT_BANNER);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      const slot = getSlotById(characterId);
      this.selectionLayer?.destroy(true);
      this.selectionLayer = undefined;
      this.refreshProgress();
      this.statusText?.setText(`${slot?.displayName ?? characterId} 선택 완료 · ${result.duplicate ? '중복' : '신규 획득'} · ${result.persisted ? '저장 완료' : '영구 저장 실패 · 현재 탭 유지'}`);
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '선택권 사용에 실패했습니다.');
      this.statusText?.setColor('#ff9a91');
    } finally {
      this.busy = false;
    }
  }
}
