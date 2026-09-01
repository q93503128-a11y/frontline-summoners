import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress';
import { performActiveRecruitment, type ActiveRecruitmentPullResult } from './active-meta-progression';
import {
  CRYPTO_RECRUITMENT_RANDOM_SOURCE,
  FIRST_RECRUITMENT_BANNER,
  RECRUITMENT_BANNERS,
  getBannerCharacterIds,
  getRecruitmentBanner,
  type RecruitmentBanner,
} from './recruitment';
import { getRecruitmentCost } from './meta-economy';
import { getSlotById } from './prototype';
import {
  getGuestResourceBalance,
  type DuplicatePolicy,
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
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private banner: RecruitmentBanner = FIRST_RECRUITMENT_BANNER;
  private duplicatePolicy: DuplicatePolicy = 'APPLY_PLUS';
  private statusText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;
  private resultsLayer: Phaser.GameObjects.Container | undefined;
  private busy = false;

  constructor() { super('recruitment'); }

  init(data: { bannerId?: string; duplicatePolicy?: DuplicatePolicy }): void {
    this.banner = data.bannerId ? getRecruitmentBanner(data.bannerId) : FIRST_RECRUITMENT_BANNER;
    this.duplicatePolicy = data.duplicatePolicy === 'DISMANTLE' ? 'DISMANTLE' : 'APPLY_PLUS';
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
    addText(this, 74, 457, '10회 할인·최소 희귀 보장 없이 각 모집은 독립 추첨입니다.', compact ? 16 : 14, '#9eabbc').setWordWrapWidth(360);

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
    this.progressText = addText(this, 970, 195, '기록 불러오는 중…', compact ? 18 : 15, '#ffffff');
    addText(this, 970, 350, '중복 처리', compact ? 18 : 15, '#f2d37c');
    addText(this, 970, 382, this.duplicatePolicy === 'APPLY_PLUS'
      ? '+1 우선 · +50 초과분은 자동 분해'
      : '분해 우선 · 혼의 파편으로 전환', compact ? 15 : 13, '#b7a98c').setWordWrapWidth(220);
    addText(this, 970, 440, '분해 재화는 성장 화면에서 원하는 동료의 +레벨에 사용할 수 있습니다.', compact ? 14 : 12, '#9eabbc').setWordWrapWidth(220);

    addButton(this, 530, compact ? 526 : 520, 190, compact ? 76 : 60, '+1 우선', () => this.switchDuplicatePolicy('APPLY_PLUS'), this.duplicatePolicy === 'APPLY_PLUS' ? 0xc5a04c : 0x59677f);
    addButton(this, 740, compact ? 526 : 520, 190, compact ? 76 : 60, '분해 우선', () => this.switchDuplicatePolicy('DISMANTLE'), this.duplicatePolicy === 'DISMANTLE' ? 0xc5a04c : 0x59677f);
    addButton(this, 980, compact ? 526 : 520, 190, compact ? 76 : 60, `1회 · ${getRecruitmentCost(1)}`, () => { void this.performRecruitment(1); }, 0xc5a04c);
    addButton(this, 1180, compact ? 526 : 520, 190, compact ? 76 : 60, `10회 · ${getRecruitmentCost(10)}`, () => { void this.performRecruitment(10); }, 0x8b6fb5);
    this.statusText = addText(this, 640, compact ? 660 : 650, '모집 기록을 불러오는 중…', compact ? 18 : 15, '#9eabbc', 'center').setOrigin(0.5);

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.authority = view.authority;
      this.progress = view.progress;
      this.statusText?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? '계정 기록을 읽기 전용으로 불러왔습니다. 모집하려면 온라인 연결이 필요합니다.' : '모집 준비 완료');
      this.statusText?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? '#ffcf8a' : '#8ee3aa');
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
          if (!active && !this.busy && !this.resultsLayer) this.scene.restart({ bannerId: banner.id, duplicatePolicy: this.duplicatePolicy });
        },
        active ? 0x9a79c5 : 0x4f5968,
      );
    });
  }

  private switchDuplicatePolicy(duplicatePolicy: DuplicatePolicy): void {
    if (this.busy || this.resultsLayer || duplicatePolicy === this.duplicatePolicy) return;
    this.scene.restart({ bannerId: this.banner.id, duplicatePolicy });
  }

  private refreshProgress(): void {
    const bannerProgress = this.progress.recruitmentProgressByBanner?.[this.banner.id] ?? { totalPulls: 0 };
    const owned = new Set(this.progress.ownedRecruitmentCharacterIds ?? []);
    const bannerCharacterIds = getBannerCharacterIds(this.banner);
    const ownedInBanner = bannerCharacterIds.filter((characterId) => owned.has(characterId)).length;
    const crystal = getGuestResourceBalance(this.progress, 'summon_crystal');
    const soul = getGuestResourceBalance(this.progress, 'soul_essence');
    const historyLine = this.authority === 'GUEST_LOCAL'
      ? `이 시리즈 ${bannerProgress.totalPulls}회`
      : this.authority === 'ACCOUNT_ONLINE'
        ? '계정 서버 저장'
        : '계정 오프라인 · 읽기 전용';
    this.progressText?.setText([
      `모집 결정 ${crystal.toLocaleString('ko-KR')}`,
      `혼의 파편 ${soul.toLocaleString('ko-KR')}`,
      '',
      historyLine,
      `획득 ${ownedInBanner}/${bannerCharacterIds.length}종`,
      '보장 횟수 없음',
    ].join('\n'));
  }

  private async performRecruitment(count: number): Promise<void> {
    if (this.busy || this.resultsLayer) return;
    this.busy = true;
    this.statusText?.setText(`${count}회 모집 · 결정 ${getRecruitmentCost(count)} 확인 중…`);
    this.statusText?.setColor('#c7d0dd');
    try {
      const result = await performActiveRecruitment(count, CRYPTO_RECRUITMENT_RANDOM_SOURCE, this.banner, this.duplicatePolicy);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      this.refreshProgress();
      this.showResults(result.results);
      const newCount = result.results.filter((pull) => !pull.duplicate).length;
      const plusCount = result.results.filter((pull) => pull.duplicateResolution === 'PLUS').length;
      const dismantleCount = result.results.filter((pull) => pull.duplicateResolution === 'DISMANTLE').length;
      const summary = [`${result.persisted ? '저장 완료' : '저장 실패'}`, `신규 ${newCount}`, `+1 ${plusCount}`];
      if (dismantleCount > 0) summary.push(`분해 ${dismantleCount} · 혼 +${result.dismantledSoulEssence}`);
      this.statusText?.setText(summary.join(' · '));
      this.statusText?.setColor(result.persisted ? '#8ee3aa' : '#ffb37c');
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '모집에 실패했습니다.');
      this.statusText?.setColor('#ff9a91');
    } finally {
      this.busy = false;
    }
  }

  private showResults(results: readonly ActiveRecruitmentPullResult[]): void {
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
      const duplicateLabel = !pull.duplicate
        ? 'NEW'
        : pull.duplicateResolution === 'DISMANTLE'
          ? `분해 · 혼 +${pull.dismantledSoulEssence ?? 0}`
          : '중복 · +1 적용';
      this.resultsLayer!.add(addText(this, x, y + 67, duplicateLabel, results.length === 1 ? 20 : 15, pull.duplicate ? '#f2d37c' : '#8ee3aa', 'center').setOrigin(0.5));
      if (pull.duplicateResolution === 'PLUS' && pull.plusLevelAfter !== undefined) {
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
