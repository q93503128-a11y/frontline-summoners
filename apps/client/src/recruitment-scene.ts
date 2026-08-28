import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import {
  CRYPTO_RECRUITMENT_RANDOM_SOURCE,
  FIRST_RECRUITMENT_BANNER,
  RECRUITMENT_BANNERS,
  getBannerCharacterIds,
  getRecruitmentBanner,
  type RecruitmentBanner,
} from './recruitment';
import {
  performGuestRecruitmentWithDuplicateGrowth as performGuestRecruitment,
  type RecruitmentPullGrowthResult,
} from './recruitment-growth';
import { getSlotById } from './prototype';
import {
  loadGuestProgress,
  type GuestProgress,
} from './save';
import { addButton, addText, COLORS, drawBackdrop, familyForUnit, rarityColor } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
};
const RARITY_ORDER = ['C', 'B', 'A', 'S', 'SS'] as const;
const SERIES_TAB_LABELS = ['성휘', '거수', '제로'] as const;

export class RecruitmentScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private banner: RecruitmentBanner = FIRST_RECRUITMENT_BANNER;
  private statusText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;
  private resultsLayer: Phaser.GameObjects.Container | undefined;
  private busy = false;

  constructor() { super('recruitment'); }

  init(data: { bannerId?: string }): void {
    this.banner = data.bannerId ? getRecruitmentBanner(data.bannerId) : FIRST_RECRUITMENT_BANNER;
    this.resultsLayer = undefined;
    this.busy = false;
  }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();

    addText(this, 54, 32, '모 집', compact ? 44 : 48, COLORS.cream);
    addText(this, 54, 91, this.banner.name, compact ? 27 : 26, '#ffffff');
    addText(this, 54, 128, this.banner.description, compact ? 17 : 15, COLORS.muted).setWordWrapWidth(720);
    addButton(this, 1005, compact ? 62 : 58, 150, compact ? 84 : 50, '성장', () => this.scene.start('growth'), 0x6b7f68);
    addButton(this, 1170, compact ? 62 : 58, 150, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    this.renderSeriesTabs(compact);

    this.add.rectangle(255, 320, 420, 304, 0x222936, 0.97).setStrokeStyle(3, 0x59677f);
    addText(this, 74, 183, '희귀도 확률', compact ? 23 : 21, '#ffe29a');
    let probabilityY = 228;
    for (const rarity of RARITY_ORDER) {
      const color = rarityColor[rarity] ?? '#ffffff';
      addText(this, 88, probabilityY, rarity, compact ? 21 : 18, color);
      addText(this, 188, probabilityY, `${this.banner.ratesPermille[rarity] / 10}%`, compact ? 21 : 18, '#ffffff');
      addText(this, 305, probabilityY, `${this.banner.poolByRarity[rarity].length}종`, compact ? 18 : 15, '#9eabbc');
      probabilityY += compact ? 43 : 40;
    }
    addText(this, 74, 457, '세 시리즈 모두 같은 희귀도 확률을 사용합니다.', compact ? 17 : 15, '#9eabbc');

    this.add.rectangle(720, 320, 430, 304, 0x222936, 0.97).setStrokeStyle(3, 0x7b6990);
    addText(this, 535, 183, '시리즈 구성', compact ? 23 : 21, '#e5c7ff');
    addText(this, 550, 235, `공통 C · ${this.banner.poolByRarity.C.length}종`, compact ? 20 : 17, rarityColor.C);
    addText(this, 550, 276, `공통 B · ${this.banner.poolByRarity.B.length}종`, compact ? 20 : 17, rarityColor.B);
    addText(this, 550, 317, `공통 A · ${this.banner.poolByRarity.A.length}종`, compact ? 20 : 17, rarityColor.A);
    addText(this, 550, 358, `전용 S · ${this.banner.poolByRarity.S.length}종`, compact ? 20 : 17, rarityColor.S);
    addText(this, 550, 399, `전용 SS · ${this.banner.poolByRarity.SS.length}종`, compact ? 20 : 17, rarityColor.SS);
    const ssName = getSlotById(this.banner.poolByRarity.SS[0]!)?.displayName ?? '???';
    addText(this, 550, 448, `시리즈 SS · ${ssName}`, compact ? 18 : 16, '#ffd873');

    this.add.rectangle(1080, 320, 260, 304, 0x222936, 0.97).setStrokeStyle(3, 0x8b7045);
    this.progressText = addText(this, 970, 202, '기록 불러오는 중…', compact ? 19 : 16, '#ffffff');
    addText(this, 970, 330, '중복 1장은 해당 캐릭터 +레벨 1로 바로 적용됩니다.', compact ? 17 : 14, '#b7a98c').setWordWrapWidth(220);
    addText(this, 970, 395, '획득한 캐릭터는 편성·성장·도감에서 확인할 수 있습니다.', compact ? 17 : 14, '#9eabbc').setWordWrapWidth(220);

    addButton(this, 972, compact ? 525 : 520, 210, compact ? 84 : 64, '1회 모집', () => { void this.performRecruitment(1); }, 0xc5a04c);
    addButton(this, 1182, compact ? 525 : 520, 210, compact ? 84 : 64, '10회 모집', () => { void this.performRecruitment(10); }, 0x8b6fb5);
    this.statusText = addText(this, 640, compact ? 660 : 650, '모집 기록을 불러오는 중…', compact ? 18 : 15, '#9eabbc', 'center').setOrigin(0.5);

    void loadGuestProgress().then((progress) => {
      if (!this.scene.isActive()) return;
      this.progress = progress;
      this.statusText?.setText('모집 준비 완료');
      this.statusText?.setColor('#8ee3aa');
      this.refreshProgress();
    });
  }

  private renderSeriesTabs(compact: boolean): void {
    RECRUITMENT_BANNERS.forEach((banner, index) => {
      const active = banner.id === this.banner.id;
      addButton(
        this,
        828 + index * 125,
        compact ? 122 : 118,
        116,
        compact ? 58 : 44,
        SERIES_TAB_LABELS[index] ?? `S${index + 1}`,
        () => {
          if (!active && !this.busy && !this.resultsLayer) this.scene.restart({ bannerId: banner.id });
        },
        active ? 0x9a79c5 : 0x4f5968,
      );
    });
  }

  private refreshProgress(): void {
    const bannerProgress = this.progress.recruitmentProgressByBanner?.[this.banner.id] ?? { totalPulls: 0 };
    const owned = new Set(this.progress.ownedRecruitmentCharacterIds ?? []);
    const bannerCharacterIds = getBannerCharacterIds(this.banner);
    const ownedInBanner = bannerCharacterIds.filter((characterId) => owned.has(characterId)).length;
    this.progressText?.setText([
      `이 시리즈 모집 ${bannerProgress.totalPulls}회`,
      `획득 ${ownedInBanner}/${bannerCharacterIds.length}종`,
      '',
      '보장 횟수 없음',
      '각 모집은 독립 추첨',
    ].join('\n'));
  }

  private async performRecruitment(count: number): Promise<void> {
    if (this.busy || this.resultsLayer) return;
    this.busy = true;
    this.statusText?.setText(`${count}회 모집 중…`);
    this.statusText?.setColor('#c7d0dd');
    try {
      const result = await performGuestRecruitment(count, CRYPTO_RECRUITMENT_RANDOM_SOURCE, this.banner);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      this.refreshProgress();
      this.showResults(result.results);
      const newCount = result.results.filter((pull) => !pull.duplicate).length;
      const duplicateCount = result.results.length - newCount;
      this.statusText?.setText(`${result.persisted ? '저장 완료' : '저장에 실패했습니다'} · 신규 ${newCount} · 중복 ${duplicateCount} +레벨 적용`);
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '모집에 실패했습니다.');
      this.statusText?.setColor('#ff9a91');
    } finally {
      this.busy = false;
    }
  }

  private showResults(results: readonly RecruitmentPullGrowthResult[]): void {
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
      const duplicateLabel = pull.duplicate ? '중복' : 'NEW';
      this.resultsLayer!.add(addText(this, x, y + 67, duplicateLabel, results.length === 1 ? 20 : 15, pull.duplicate ? '#b7bdc9' : '#8ee3aa', 'center').setOrigin(0.5));
      if (pull.duplicate && pull.plusLevelAfter !== undefined) {
        this.resultsLayer!.add(addText(this, x, y + 88, `현재 +${pull.plusLevelAfter}`, results.length === 1 ? 17 : 13, '#f2d37c', 'center').setOrigin(0.5));
      }
    });

    const closeY = results.length === 1 ? 520 : 620;
    this.resultsLayer.add(addButton(this, 640, closeY, 260, compact ? 84 : 58, '확인', () => {
      this.resultsLayer?.destroy(true);
      this.resultsLayer = undefined;
    }, 0x667b95));
  }
}
