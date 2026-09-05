import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { getProfileCosmetic, type ProfileCosmeticKind, type ProfileLoadout } from '@frontline/sim/achievement-profile';
import {
  loadAuthenticatedAccountProfile,
  mutateAuthenticatedAccountProfile,
} from './account-profile-network.ts';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  deriveAccountAchievementProfile,
  deriveReadOnlyAccountAchievementProfile,
  getAchievementRewardNames,
  getOwnedCosmeticsByKind,
  loadGuestAchievementProfile,
  saveGuestProfileLoadout,
  type AchievementCategory,
  type AchievementProfileState,
} from './achievement-profile.ts';
import { loadActiveProgress, type ActiveProgressAuthority } from './active-progress.ts';
import {
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
  familyForUnit,
  setButtonState,
} from './scene-ui.ts';
import { getOwnedCharacterIds, type GuestProgress } from './save.ts';
import { getSlotById } from './prototype.ts';
import { isCompactMobileViewport } from './viewport.ts';

const CATEGORIES: readonly ('ALL' | AchievementCategory)[] = ['ALL', ...ACHIEVEMENT_CATEGORIES];
const CATEGORY_LABELS: Readonly<Record<'ALL' | AchievementCategory, string>> = {
  ALL: '전체',
  MAIN: '메인',
  SPECIAL: 'SPECIAL',
  GROWTH: '성장',
  CODEX: '도감',
  COOP: '협동',
  PVP: 'PvP',
  RECORD: '기록',
  QUIRK: '기묘',
};
const PALETTE = [0x6c7da1, 0x7c6a9f, 0x628f87, 0x9a774f, 0x8d6475, 0x617a98, 0x76875d, 0x8c6f62] as const;

function cosmeticColor(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

function nextIndex(current: number, length: number): number {
  return length <= 0 ? 0 : (current + 1) % length;
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class ProfileScene extends Phaser.Scene {
  private progress: GuestProgress | null = null;
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private state: AchievementProfileState | null = null;
  private layer?: Phaser.GameObjects.Container;
  private loadingText?: Phaser.GameObjects.Text;
  private categoryIndex = 0;
  private page = 0;
  private accountMutationPending = false;
  private statusMessage = '';

  constructor() { super('profile'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 28, '지휘관 전과 기록', compact ? 42 : 46, COLORS.cream);
    addText(this, 50, 80, '대표 장식과 누적 전과를 한 장의 복무 기록으로 정리한다.', compact ? 18 : 16, COLORS.muted);
    addButton(this, 1170, compact ? 61 : 56, 170, compact ? 82 : 50, '지휘소', () => this.scene.start('main-menu'), 0x59677f, { tone: 'quiet' });
    this.loadingText = addText(this, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, '지휘관 기록을 불러오는 중…', 24, COLORS.muted, 'center').setOrigin(0.5);

    void loadActiveProgress().then(async (view) => {
      if (!this.scene.isActive()) return;
      this.progress = view.progress;
      this.authority = view.authority;
      if (view.authority === 'GUEST_LOCAL') {
        this.state = loadGuestAchievementProfile(view.progress);
      } else {
        const remote = await loadAuthenticatedAccountProfile();
        if (!this.scene.isActive()) return;
        this.state = remote
          ? deriveAccountAchievementProfile(view.progress, remote.profile, view.authority === 'ACCOUNT_ONLINE')
          : deriveReadOnlyAccountAchievementProfile(view.progress);
        if (!remote) this.statusMessage = '계정 프로필 서버 상태를 읽지 못해 임시 읽기 전용';
      }
      this.loadingText?.destroy();
      this.loadingText = undefined;
      this.render();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.loadingText?.setText(error instanceof Error ? error.message : '지휘관 기록을 불러오지 못했습니다.').setColor(COLORS.red);
    });
  }

  private saveLoadout(next: ProfileLoadout): void {
    if (!this.progress || !this.state?.editable || this.accountMutationPending) return;
    if (this.authority === 'GUEST_LOCAL') {
      this.state = saveGuestProfileLoadout(this.progress, next);
      this.statusMessage = '로컬 프로필 저장 완료';
      this.render();
      return;
    }
    if (this.authority !== 'ACCOUNT_ONLINE') return;
    this.accountMutationPending = true;
    this.statusMessage = '계정 프로필 저장 중…';
    this.render();
    void mutateAuthenticatedAccountProfile({ requestId: newRequestId(), profileLoadout: next })
      .then((response) => {
        if (!this.scene.isActive() || !this.progress) return;
        this.state = deriveAccountAchievementProfile(this.progress, response.profile, true);
        this.statusMessage = response.replayed ? '계정 프로필 저장 확인 완료' : '계정 프로필 서버 저장 완료';
      })
      .catch(() => {
        if (!this.scene.isActive()) return;
        this.statusMessage = '계정 프로필 저장 실패 · 최신 상태를 다시 불러와 재시도';
      })
      .finally(() => {
        if (!this.scene.isActive()) return;
        this.accountMutationPending = false;
        this.render();
      });
  }

  private cycleCosmetic(kind: Exclude<ProfileCosmeticKind, 'BADGE'>): void {
    if (!this.state) return;
    const options = getOwnedCosmeticsByKind(this.state, kind);
    if (kind === 'TITLE') {
      const ids = [undefined, ...options.map((entry) => entry.id)] as const;
      const currentIndex = ids.findIndex((id) => id === this.state!.profileLoadout.titleId);
      const titleId = ids[nextIndex(Math.max(0, currentIndex), ids.length)];
      const next = { ...this.state.profileLoadout, ...(titleId === undefined ? {} : { titleId }) };
      if (titleId === undefined) delete (next as { titleId?: string }).titleId;
      this.saveLoadout(next);
      return;
    }
    if (options.length === 0) return;
    const key = kind === 'FRAME' ? 'frameId' : kind === 'BANNER' ? 'bannerId' : 'emblemId';
    const currentId = this.state.profileLoadout[key];
    const currentIndex = options.findIndex((entry) => entry.id === currentId);
    this.saveLoadout({ ...this.state.profileLoadout, [key]: options[nextIndex(Math.max(0, currentIndex), options.length)]!.id });
  }

  private cyclePortrait(): void {
    if (!this.progress || !this.state) return;
    const owned = getOwnedCharacterIds(this.progress);
    if (owned.length === 0) return;
    const currentIndex = owned.indexOf(this.state.profileLoadout.portraitCharacterId ?? owned[0]!);
    this.saveLoadout({ ...this.state.profileLoadout, portraitCharacterId: owned[nextIndex(Math.max(0, currentIndex), owned.length)]! });
  }

  private cycleBadges(): void {
    if (!this.state) return;
    const badges = getOwnedCosmeticsByKind(this.state, 'BADGE').map((entry) => entry.id);
    if (badges.length === 0) {
      this.saveLoadout({ ...this.state.profileLoadout, badgeIds: [] });
      return;
    }
    const currentFirst = this.state.profileLoadout.badgeIds[0];
    if (currentFirst === undefined) {
      this.saveLoadout({ ...this.state.profileLoadout, badgeIds: badges.slice(0, 3) });
      return;
    }
    const start = nextIndex(Math.max(0, badges.indexOf(currentFirst)), badges.length);
    const selected = Array.from({ length: Math.min(3, badges.length) }, (_, offset) => badges[(start + offset) % badges.length]!);
    this.saveLoadout({ ...this.state.profileLoadout, badgeIds: selected });
  }

  private render(): void {
    if (!this.progress || !this.state) return;
    this.layer?.destroy(true);
    this.layer = this.add.container(0, 0);
    this.renderProfileCard();
    this.renderAchievementList();
  }

  private renderProfileCard(): void {
    const progress = this.progress!;
    const state = this.state!;
    const compact = isCompactMobileViewport();
    const x = 246;
    const y = 394;
    const width = 418;
    const height = 548;
    const frameColor = cosmeticColor(state.profileLoadout.frameId);
    const bannerColor = cosmeticColor(state.profileLoadout.bannerId);

    const shadow = this.add.rectangle(x + 6, y + 7, width, height, 0x070a0f, 0.35);
    const paper = this.add.rectangle(x, y, width, height, 0x202731, 0.98).setStrokeStyle(5, frameColor, 0.92);
    const banner = this.add.rectangle(x, y - height / 2 + 54, width - 12, 96, bannerColor, 0.84);
    const topRule = this.add.rectangle(x, y - height / 2 + 4, width - 20, 3, frameColor, 0.6);
    this.layer!.add([shadow, paper, banner, topRule]);

    const authorityLabel = this.authority === 'GUEST_LOCAL'
      ? '게스트 지휘관'
      : this.authority === 'ACCOUNT_ONLINE' ? '계정 지휘관 · 서버' : '계정 지휘관 · 오프라인 캐시';
    const authorityKind = this.authority === 'ACCOUNT_ONLINE' ? 'online' : this.authority === 'ACCOUNT_OFFLINE_CACHE' ? 'warning' : 'neutral';
    this.layer!.add(addStatusPill(this, x - 188, y - 246, authorityLabel, authorityKind));

    const titleName = state.profileLoadout.titleId ? getProfileCosmetic(state.profileLoadout.titleId).name : '칭호 없음';
    this.layer!.add(addText(this, x, y - 197, titleName, compact ? 25 : 23, COLORS.gold, 'center').setOrigin(0.5));
    this.layer!.add(addText(this, x, y - 165, 'FIELD SERVICE RECORD', compact ? 15 : 12, '#c8d0db', 'center').setOrigin(0.5));

    const portraitId = state.profileLoadout.portraitCharacterId;
    if (portraitId) {
      const art = familyForUnit(portraitId);
      const portraitPlate = this.add.rectangle(x - 108, y - 65, 146, 146, 0x151b24, 0.86).setStrokeStyle(2, frameColor, 0.5);
      const portrait = this.add.sprite(x - 108, y - 76, art.family.idle.key, 0).setTint(art.tint);
      portrait.setScale(1.05 * art.displayScale);
      portrait.setDisplaySize(Math.min(132, portrait.displayWidth), Math.min(132, portrait.displayHeight));
      this.layer!.add([portraitPlate, portrait]);
      this.layer!.add(addText(this, x - 108, y + 18, getSlotById(portraitId)?.displayName ?? '등록된 동료', compact ? 17 : 15, '#ffffff', 'center').setOrigin(0.5));
    }

    const emblemName = getProfileCosmetic(state.profileLoadout.emblemId).name;
    this.drawServiceInsignia(x + 95, y - 92, frameColor, bannerColor);
    this.layer!.add(addText(this, x + 18, y - 18, `문장 · ${emblemName}`, compact ? 18 : 16, '#d6ddea'));
    this.layer!.add(addText(this, x + 18, y + 13, `메인 전선 ${progress.clearedStageIds.length}/80`, compact ? 17 : 15, '#bfc9d8'));
    this.layer!.add(addText(this, x + 18, y + 43, `SPECIAL ${progress.specialClearedStageIds.length} · 업적 ${state.completedCount}/${ACHIEVEMENTS.length}`, compact ? 17 : 15, COLORS.green));

    const badgeNames = state.profileLoadout.badgeIds.map((id) => getProfileCosmetic(id).name);
    this.layer!.add(addSectionHeading(this, x - 188, y + 84, '대표 배지 · 표창대', 376, 0x8b745c));
    this.layer!.add(addText(this, x - 170, y + 111, badgeNames.length ? badgeNames.join(' · ') : '등록된 대표 배지 없음', compact ? 16 : 14, '#d4dbe7').setWordWrapWidth(350));

    this.layer!.add(addSectionHeading(this, x - 188, y + 154, '장식 변경', 376, 0x627f9a));
    const controlsEnabled = state.editable && !this.accountMutationPending;
    const controlY = y + 194;
    const buttons = [
      addButton(this, x - 126, controlY, 112, compact ? 68 : 46, '대표 인물', () => this.cyclePortrait(), 0x6d86a7, { tone: 'quiet' }),
      addButton(this, x, controlY, 112, compact ? 68 : 46, '칭호', () => this.cycleCosmetic('TITLE'), 0x6d86a7, { tone: 'quiet' }),
      addButton(this, x + 126, controlY, 112, compact ? 68 : 46, '프레임', () => this.cycleCosmetic('FRAME'), 0x6d86a7, { tone: 'quiet' }),
      addButton(this, x - 126, controlY + 56, 112, compact ? 68 : 46, '배너', () => this.cycleCosmetic('BANNER'), 0x6d86a7, { tone: 'quiet' }),
      addButton(this, x, controlY + 56, 112, compact ? 68 : 46, '문장', () => this.cycleCosmetic('EMBLEM'), 0x6d86a7, { tone: 'quiet' }),
      addButton(this, x + 126, controlY + 56, 112, compact ? 68 : 46, '배지', () => this.cycleBadges(), 0x6d86a7, { tone: 'quiet' }),
    ];
    this.layer!.add(buttons);

    if (this.accountMutationPending) {
      buttons.forEach((button) => setButtonState(button, 'loading', '계정 프로필 저장 중'));
    } else if (!controlsEnabled) {
      buttons.forEach((button) => setButtonState(button, 'disabled', '현재 프로필은 읽기 전용입니다.'));
    }

    const footer = this.statusMessage || (!state.editable ? '오프라인/불완전 계정 프로필은 읽기 전용' : '장식 변경은 즉시 현재 프로필에 반영됩니다.');
    this.layer!.add(addText(this, x, y + 265, footer, compact ? 15 : 13, state.editable ? '#9fb4c9' : COLORS.warning, 'center').setOrigin(0.5).setWordWrapWidth(372));
  }

  private drawServiceInsignia(x: number, y: number, frameColor: number, bannerColor: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x121821, 0.9).fillCircle(x, y, 54);
    g.lineStyle(4, frameColor, 0.82).strokeCircle(x, y, 48);
    g.lineStyle(2, bannerColor, 0.7).strokeCircle(x, y, 34);
    g.fillStyle(frameColor, 0.62).fillTriangle(x, y - 27, x - 23, y + 18, x + 23, y + 18);
    g.fillStyle(bannerColor, 0.76).fillCircle(x, y + 7, 9);
    this.layer!.add(g);
  }

  private renderAchievementList(): void {
    const state = this.state!;
    const compact = isCompactMobileViewport();
    const category = CATEGORIES[this.categoryIndex]!;
    const definitions = category === 'ALL' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((achievement) => achievement.category === category);
    const perPage = compact ? 4 : 5;
    const pageCount = Math.max(1, Math.ceil(definitions.length / perPage));
    this.page = Math.max(0, Math.min(this.page, pageCount - 1));
    const visible = definitions.slice(this.page * perPage, this.page * perPage + perPage);
    const evaluationById = new Map(state.evaluations.map((evaluation) => [evaluation.achievementId, evaluation] as const));

    this.layer!.add(addSectionHeading(this, 492, 126, `전과 기록 · 완료 ${state.completedCount}/${ACHIEVEMENTS.length}`, 736, 0x8b745c));
    const categoryButton = addButton(this, 690, 166, 250, compact ? 70 : 48, `분류 · ${CATEGORY_LABELS[category]}`, () => {
      this.categoryIndex = nextIndex(this.categoryIndex, CATEGORIES.length);
      this.page = 0;
      this.render();
    }, 0x6d7891, { tone: 'secondary' });
    this.layer!.add(categoryButton);
    this.layer!.add(addButton(this, 1046, 166, 112, compact ? 70 : 48, '◀ 이전', () => { this.page = Math.max(0, this.page - 1); this.render(); }, 0x56657d, { tone: 'quiet' }));
    this.layer!.add(addButton(this, 1173, 166, 112, compact ? 70 : 48, '다음 ▶', () => { this.page = Math.min(pageCount - 1, this.page + 1); this.render(); }, 0x56657d, { tone: 'quiet' }));
    this.layer!.add(addText(this, 910, 166, `${this.page + 1} / ${pageCount}`, compact ? 17 : 14, '#93a0b2', 'center').setOrigin(0.5));

    const ledger = addCommandPanel(this, 866, 440, 748, 486, 0x665d52, 0x1d242d, 0.9);
    this.layer!.add(ledger);
    const rail = this.add.graphics();
    rail.lineStyle(4, 0x756a58, 0.55).lineBetween(535, 232, 535, 649);
    this.layer!.add(rail);

    if (visible.length === 0) {
      this.layer!.add(addText(this, 865, 420, '이 분류에는 표시할 전과가 없습니다.', compact ? 22 : 18, COLORS.muted, 'center').setOrigin(0.5));
      return;
    }

    visible.forEach((definition, index) => {
      const evaluation = evaluationById.get(definition.id)!;
      const hidden = definition.visibility === 'HIDDEN' && !evaluation.complete;
      const rowY = 250 + index * (compact ? 102 : 88);
      const accent = evaluation.complete ? 0x65a678 : 0x687382;
      const node = this.add.circle(535, rowY, evaluation.complete ? 10 : 8, accent, 0.95).setStrokeStyle(2, 0xd1c6ae, evaluation.complete ? 0.8 : 0.35);
      const divider = this.add.rectangle(868, rowY + (compact ? 46 : 40), 666, 1, 0x657080, 0.22);
      this.layer!.add([node, divider]);

      const name = hidden ? '???' : definition.name;
      const description = hidden ? '조건 비공개' : definition.shortDescription;
      const progressText = evaluation.complete ? '완료 ✓' : `${evaluation.current} / ${evaluation.target}`;
      const rewardNames = hidden ? [] : getAchievementRewardNames(definition.id);
      this.layer!.add(addText(this, 562, rowY - 26, name, compact ? 21 : 19, evaluation.complete ? '#a9efb9' : '#ffffff'));
      this.layer!.add(addText(this, 562, rowY + 2, description, compact ? 16 : 14, '#aeb8c6').setWordWrapWidth(440));
      this.layer!.add(addText(this, 1198, rowY - 24, progressText, compact ? 18 : 16, evaluation.complete ? COLORS.green : COLORS.gold, 'right').setOrigin(1, 0));
      if (rewardNames.length > 0) {
        this.layer!.add(addText(this, 1198, rowY + 4, `표창 · ${rewardNames.join(' · ')}`, compact ? 14 : 12, '#d2b9ed', 'right').setOrigin(1, 0).setWordWrapWidth(230));
      }
    });
  }
}
