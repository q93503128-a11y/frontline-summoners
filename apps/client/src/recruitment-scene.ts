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
  private seriesTabs: Phaser.GameObjects.Container[] = [];
  private plusPolicyButton: Phaser.GameObjects.Container | undefined;
  private dismantlePolicyButton: Phaser.GameObjects.Container | undefined;
  private pullOneButton: Phaser.GameObjects.Container | undefined;
  private pullTenButton: Phaser.GameObjects.Container | undefined;
  private busy = false;

  constructor() { super('recruitment'); }

  init(data: { bannerId?: string; duplicatePolicy?: DuplicatePolicy }): void {
    this.banner = data.bannerId ? getRecruitmentBanner(data.bannerId) : FIRST_RECRUITMENT_BANNER;
    this.duplicatePolicy = data.duplicatePolicy === 'DISMANTLE' ? 'DISMANTLE' : 'APPLY_PLUS';
    this.resultsLayer = undefined;
    this.seriesTabs = [];
    this.plusPolicyButton = undefined;
    this.dismantlePolicyButton = undefined;
    this.pullOneButton = undefined;
    this.pullTenButton = undefined;
    this.busy = false;
  }

  create(): void {
    drawBackdrop(this, 'menu');
    const compact = isCompactMobileViewport();

    addText(this, 54, 28, '모 집', compact ? 44 : 48, COLORS.cream);
    addText(this, 54, 82, this.banner.name, compact ? 27 : 25, '#ffffff');
    addText(this, 54, 116, this.banner.description, compact ? 16 : 14, COLORS.muted).setWordWrapWidth(690);
    addButton(this, 1010, compact ? 62 : 56, 150, compact ? 84 : 50, '성장', () => this.scene.start('growth'), 0x6b7f68, { tone: 'secondary' });
    addButton(this, 1170, compact ? 62 : 56, 150, compact ? 84 : 50, '지휘소', () => this.scene.start('main-menu'), 0x586275, { tone: 'quiet' });
    this.renderSeriesTabs(compact);

    addSectionHeading(this, 54, 158, '모집 공고 · 공개 확률', 330, 0x6c7b92);
    addCommandPanel(this, 218, 344, 330, 342, 0x6c7b92, 0x202731, 0.9);
    let probabilityY = 212;
    for (const rarity of RARITY_ORDER) {
      const color = rarityColor[rarity] ?? '#ffffff';
      addText(this, 82, probabilityY, rarity, compact ? 21 : 18, color);
      addText(this, 164, probabilityY, `${this.banner.ratesPermille[rarity] / 10}%`, compact ? 21 : 18, '#ffffff');
      addText(this, 276, probabilityY, `${this.banner.poolByRarity[rarity].length}종`, compact ? 18 : 14, COLORS.dim);
      probabilityY += compact ? 43 : 40;
    }
    addText(this, 82, 432, '각 모집은 독립 추첨', compact ? 17 : 14, COLORS.blue);
    addText(this, 82, 461, '10회 추가 할인 없음 · 최소 희귀도 보장 없음', compact ? 15 : 12, COLORS.muted).setWordWrapWidth(270);

    addSectionHeading(this, 410, 158, '시리즈 인장 · 이번 모집의 중심', 530, 0x8f6ea4);
    this.drawSummoningSeal(675, 330, compact);
    const ssName = getSlotById(this.banner.poolByRarity.SS[0]!)?.displayName ?? '미확인';
    addText(this, 675, 286, this.banner.name, compact ? 24 : 21, '#ead7f2', 'center').setOrigin(0.5);
    addText(this, 675, 325, `대표 SS · ${ssName}`, compact ? 21 : 18, COLORS.gold, 'center').setOrigin(0.5);
    addText(this, 675, 367, `공통 C ${this.banner.poolByRarity.C.length} · B ${this.banner.poolByRarity.B.length} · A ${this.banner.poolByRarity.A.length}`, compact ? 16 : 13, COLORS.muted, 'center').setOrigin(0.5);
    addText(this, 675, 395, `전용 S ${this.banner.poolByRarity.S.length} · SS ${this.banner.poolByRarity.SS.length}`, compact ? 17 : 14, '#d8bcea', 'center').setOrigin(0.5);

    addSectionHeading(this, 964, 158, '모집 기록', 260, 0x9b7b4a);
    addCommandPanel(this, 1094, 344, 260, 342, 0x9b7b4a, 0x242820, 0.9);
    this.progressText = addText(this, 988, 210, '기록 불러오는 중…', compact ? 18 : 14, '#ffffff').setLineSpacing(compact ? 7 : 6);
    addText(this, 988, 386, '중복 처리 규칙', compact ? 18 : 15, COLORS.gold);
    addText(this, 988, 418, this.duplicatePolicy === 'APPLY_PLUS'
      ? '+1 우선 · +50 초과분 자동 분해'
      : '분해 우선 · 혼의 파편으로 전환', compact ? 15 : 12, '#d3c29e').setWordWrapWidth(215);
    addText(this, 988, 468, '분해 재화는 성장 화면에서 원하는 동료의 +레벨에 사용할 수 있습니다.', compact ? 14 : 11, COLORS.muted).setWordWrapWidth(215);

    addSectionHeading(this, 410, 492, '중복 방침 · 모집 명령', 814, 0x8a7450);
    this.plusPolicyButton = addButton(this, 510, compact ? 548 : 542, 180, compact ? 84 : 60, '+1 우선', () => this.switchDuplicatePolicy('APPLY_PLUS'), 0x8d7752, { tone: 'quiet' });
    this.dismantlePolicyButton = addButton(this, 710, compact ? 548 : 542, 180, compact ? 84 : 60, '분해 우선', () => this.switchDuplicatePolicy('DISMANTLE'), 0x8d7752, { tone: 'quiet' });
    this.pullOneButton = addButton(this, 930, compact ? 548 : 542, 190, compact ? 84 : 60, `1회 · 결정 ${getRecruitmentCost(1)}`, () => { void this.performRecruitment(1); }, 0xc5a04c, { tone: 'secondary' });
    this.pullTenButton = addButton(this, 1150, compact ? 548 : 542, 210, compact ? 84 : 60, `10회 · 결정 ${getRecruitmentCost(10)}`, () => { void this.performRecruitment(10); }, 0x8b6fb5, { tone: 'primary' });
    this.statusText = addText(this, 640, compact ? 674 : 650, '모집 기록을 불러오는 중…', compact ? 18 : 14, COLORS.dim, 'center').setOrigin(0.5).setWordWrapWidth(960);
    this.refreshControlStates();

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.authority = view.authority;
      this.progress = view.progress;
      this.statusText?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '계정 오프라인 기록 · 모집은 온라인 연결 후 사용할 수 있습니다.'
        : '모집 준비 완료 · 확률과 비용을 확인한 뒤 모집 명령을 선택하세요.');
      this.statusText?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : COLORS.green);
      this.refreshProgress();
      this.refreshControlStates();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '모집 기록을 읽지 못했습니다.').setColor(COLORS.red);
      this.refreshControlStates();
    });
  }

  private drawSummoningSeal(x: number, y: number, compact: boolean): void {
    const g = this.add.graphics();
    g.fillStyle(0x181b24, 0.72).fillCircle(x, y, compact ? 128 : 122);
    g.lineStyle(4, 0x8f6ea4, 0.7).strokeCircle(x, y, compact ? 112 : 106);
    g.lineStyle(2, 0xc9a768, 0.55).strokeCircle(x, y, compact ? 88 : 82);
    g.lineStyle(2, 0x8f6ea4, 0.42).strokeCircle(x, y, compact ? 58 : 54);
    const radius = compact ? 102 : 96;
    for (let index = 0; index < 8; index += 1) {
      const angle = Phaser.Math.DegToRad(index * 45 - 90);
      const inner = Phaser.Math.DegToRad(index * 45 + 22.5 - 90);
      const x1 = x + Math.cos(angle) * radius;
      const y1 = y + Math.sin(angle) * radius;
      const x2 = x + Math.cos(inner) * (radius - 34);
      const y2 = y + Math.sin(inner) * (radius - 34);
      g.lineStyle(2, index % 2 === 0 ? 0xd0ad68 : 0x8f6ea4, 0.46).lineBetween(x, y, x1, y1);
      g.fillStyle(index % 2 === 0 ? 0xd0ad68 : 0x8f6ea4, 0.72).fillCircle(x2, y2, 4);
    }
    g.fillStyle(0xd0ad68, 0.18).fillCircle(x, y, compact ? 42 : 38);
  }

  private renderSeriesTabs(compact: boolean): void {
    this.seriesTabs = [];
    RECRUITMENT_BANNERS.forEach((banner, index) => {
      const active = banner.id === this.banner.id;
      const tab = addButton(
        this,
        785 + index * 118,
        compact ? 122 : 116,
        108,
        compact ? 62 : 44,
        SERIES_TAB_LABELS[index] ?? `시리즈 ${index + 1}`,
        () => {
          if (!active && !this.busy && !this.resultsLayer) this.scene.restart({ bannerId: banner.id, duplicatePolicy: this.duplicatePolicy });
          else if (active) this.statusText?.setText('현재 선택된 모집 시리즈입니다.').setColor(COLORS.blue);
        },
        active ? 0x9a79c5 : 0x4f5968,
        { tone: 'quiet' },
      );
      if (active) setButtonState(tab, 'selected');
      this.seriesTabs.push(tab);
    });
  }

  private switchDuplicatePolicy(duplicatePolicy: DuplicatePolicy): void {
    if (this.busy || this.resultsLayer) return;
    if (duplicatePolicy === this.duplicatePolicy) {
      this.statusText?.setText('이미 선택된 중복 처리 방침입니다.').setColor(COLORS.blue);
      return;
    }
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

  private refreshControlStates(): void {
    if (this.plusPolicyButton) setButtonState(this.plusPolicyButton, this.duplicatePolicy === 'APPLY_PLUS' ? 'selected' : 'default');
    if (this.dismantlePolicyButton) setButtonState(this.dismantlePolicyButton, this.duplicatePolicy === 'DISMANTLE' ? 'selected' : 'default');
    if (!this.pullOneButton || !this.pullTenButton) return;

    const crystal = getGuestResourceBalance(this.progress, 'summon_crystal');
    const offline = this.authority === 'ACCOUNT_OFFLINE_CACHE';
    if (this.busy) {
      setButtonState(this.pullOneButton, 'loading', '모집 결과 처리 중');
      setButtonState(this.pullTenButton, 'loading', '모집 결과 처리 중');
      return;
    }
    if (this.resultsLayer) {
      setButtonState(this.pullOneButton, 'disabled', '결과 확인 창을 먼저 닫아 주세요.');
      setButtonState(this.pullTenButton, 'disabled', '결과 확인 창을 먼저 닫아 주세요.');
      return;
    }
    if (offline) {
      setButtonState(this.pullOneButton, 'disabled', '온라인 계정 연결이 필요합니다.');
      setButtonState(this.pullTenButton, 'disabled', '온라인 계정 연결이 필요합니다.');
      return;
    }
    setButtonState(this.pullOneButton, crystal >= getRecruitmentCost(1) ? 'default' : 'locked', `모집 결정 ${getRecruitmentCost(1)} 필요`);
    setButtonState(this.pullTenButton, crystal >= getRecruitmentCost(10) ? 'default' : 'locked', `모집 결정 ${getRecruitmentCost(10)} 필요`);
  }

  private async performRecruitment(count: number): Promise<void> {
    if (this.busy || this.resultsLayer) return;
    if (this.authority === 'ACCOUNT_OFFLINE_CACHE') {
      this.statusText?.setText('온라인 계정 연결 후 모집할 수 있습니다.').setColor(COLORS.warning);
      return;
    }
    const cost = getRecruitmentCost(count);
    if (getGuestResourceBalance(this.progress, 'summon_crystal') < cost) {
      this.statusText?.setText(`모집 결정이 부족합니다. · 필요 ${cost}`).setColor(COLORS.warning);
      return;
    }
    this.busy = true;
    this.refreshControlStates();
    this.statusText?.setText(`${count}회 모집 · 결정 ${cost} 확인 중…`).setColor('#c7d0dd');
    try {
      const result = await performActiveRecruitment(count, CRYPTO_RECRUITMENT_RANDOM_SOURCE, this.banner, this.duplicatePolicy);
      this.progress = result.guestProgress;
      if (!this.scene.isActive()) return;
      this.refreshProgress();
      this.showResults(result.results);
      const newCount = result.results.filter((pull) => !pull.duplicate).length;
      const plusCount = result.results.filter((pull) => pull.duplicateResolution === 'PLUS').length;
      const dismantleCount = result.results.filter((pull) => pull.duplicateResolution === 'DISMANTLE').length;
      const summary = [result.persisted ? '저장 완료' : '영구 저장 실패 · 현재 실행에서는 결과 유지', `신규 ${newCount}`, `+1 ${plusCount}`];
      if (dismantleCount > 0) summary.push(`분해 ${dismantleCount} · 혼 +${result.dismantledSoulEssence}`);
      this.statusText?.setText(summary.join(' · '));
      this.statusText?.setColor(result.persisted ? COLORS.green : COLORS.warning);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.statusText?.setText(error instanceof Error ? error.message : '모집에 실패했습니다.').setColor(COLORS.red);
    } finally {
      this.busy = false;
      if (this.scene.isActive()) this.refreshControlStates();
    }
  }

  private showResults(results: readonly ActiveRecruitmentPullResult[]): void {
    this.resultsLayer?.destroy(true);
    this.resultsLayer = this.add.container(0, 0).setDepth(40);
    const compact = isCompactMobileViewport();
    const overlay = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x090d14, 0.92).setInteractive();
    this.resultsLayer.add(overlay);

    const panelHeight = results.length === 1 ? 420 : 586;
    const panel = addCommandPanel(this, INTERNAL_WIDTH / 2, 356, 1170, panelHeight, 0x9a79c5, 0x1c222d, 0.98).setDepth(41);
    this.resultsLayer.add(panel);
    const seal = this.add.circle(640, results.length === 1 ? 168 : 92, 32, 0x8f6ea4, 0.85).setStrokeStyle(3, 0xd0ad68, 0.9);
    this.resultsLayer.add(seal);
    this.resultsLayer.add(addText(this, 640, results.length === 1 ? 168 : 92, '召', compact ? 26 : 23, COLORS.gold, 'center').setOrigin(0.5));
    this.resultsLayer.add(addText(this, 640, results.length === 1 ? 215 : 132, results.length === 1 ? '모집 결과' : '10회 모집 결과', compact ? 34 : 31, COLORS.cream, 'center').setOrigin(0.5));

    const columns = results.length === 1 ? 1 : 5;
    const ticketWidth = results.length === 1 ? 370 : 200;
    const ticketHeight = results.length === 1 ? 194 : 188;
    const xGap = results.length === 1 ? 0 : 216;
    const yGap = 204;
    const startX = results.length === 1 ? 640 : 208;
    const startY = results.length === 1 ? 365 : 260;

    results.forEach((pull, index) => {
      const slot = getSlotById(pull.characterId);
      if (!slot) return;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + col * xGap;
      const y = startY + row * yGap;
      const color = Phaser.Display.Color.HexStringToColor(rarityColor[pull.rarity] ?? '#ffffff').color;
      const shadow = this.add.rectangle(x + 3, y + 4, ticketWidth, ticketHeight, 0x07090d, 0.38);
      const ticket = this.add.rectangle(x, y, ticketWidth, ticketHeight, 0x262d39, 0.99);
      const ribbon = this.add.rectangle(x - ticketWidth / 2 + 5, y, 7, ticketHeight - 12, color, 0.9);
      const rarityRule = this.add.rectangle(x, y - ticketHeight / 2 + 3, ticketWidth - 16, pull.rarity === 'SS' ? 5 : 3, color, 0.8);
      this.resultsLayer!.add([shadow, ticket, ribbon, rarityRule]);

      const art = familyForUnit(slot.definition.id);
      const portrait = this.add.sprite(x, y - 32, art.family.idle.key, 0).setTint(art.tint);
      portrait.setScale(((results.length === 1 ? 92 : 66) / art.family.idle.frameHeight) * art.displayScale);
      this.resultsLayer!.add(portrait);
      this.resultsLayer!.add(addText(this, x - ticketWidth / 2 + 18, y - ticketHeight / 2 + 10, pull.rarity, compact ? 20 : 16, rarityColor[pull.rarity] ?? '#ffffff'));
      this.resultsLayer!.add(addText(this, x, y + 38, slot.displayName, results.length === 1 ? 25 : 18, '#ffffff', 'center').setOrigin(0.5));
      const duplicateLabel = !pull.duplicate
        ? '신규 합류'
        : pull.duplicateResolution === 'DISMANTLE'
          ? `분해 · 혼 +${pull.dismantledSoulEssence ?? 0}`
          : '중복 · +1 적용';
      this.resultsLayer!.add(addText(this, x, y + 68, duplicateLabel, results.length === 1 ? 20 : 14, pull.duplicate ? COLORS.gold : COLORS.green, 'center').setOrigin(0.5));
      if (pull.duplicateResolution === 'PLUS' && pull.plusLevelAfter !== undefined) {
        this.resultsLayer!.add(addText(this, x, y + 89, `현재 +${pull.plusLevelAfter}`, results.length === 1 ? 17 : 12, COLORS.gold, 'center').setOrigin(0.5));
      }
    });

    const closeY = results.length === 1 ? 535 : 630;
    this.resultsLayer.add(addButton(this, 640, closeY, 260, compact ? 84 : 58, '결과 확인', () => {
      this.resultsLayer?.destroy(true);
      this.resultsLayer = undefined;
      this.refreshControlStates();
    }, 0x667b95, { tone: 'primary' }));
    this.refreshControlStates();
  }
}
