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
import { familyForUnit, addButton, addText, COLORS, drawBackdrop } from './scene-ui.ts';
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
  private categoryIndex = 0;
  private page = 0;
  private accountMutationPending = false;
  private statusMessage = '';

  constructor() { super('profile'); }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 48, 30, '프로필 · 업적', compact ? 42 : 46, COLORS.cream);
    addText(this, 50, 82, '장기 목표를 확인하고 획득한 장식을 프로필에 꾸민다.', compact ? 19 : 17, COLORS.muted);
    addButton(this, 1180, 62, 150, compact ? 78 : 50, '메인', () => this.scene.start('main-menu'), 0x59677f);
    addText(this, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, '프로필 불러오는 중…', 24, COLORS.muted, 'center').setOrigin(0.5);

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
      this.render();
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
    const x = 245;
    const y = 365;
    const width = 430;
    const height = 500;
    const frameColor = cosmeticColor(state.profileLoadout.frameId);
    const bannerColor = cosmeticColor(state.profileLoadout.bannerId);
    const card = this.add.rectangle(x, y, width, height, 0x202633, 0.98).setStrokeStyle(6, frameColor, 1);
    const banner = this.add.rectangle(x, y - height / 2 + 62, width - 14, 112, bannerColor, 0.92);
    this.layer!.add([card, banner]);

    const authorityLabel = this.authority === 'GUEST_LOCAL'
      ? '게스트 지휘관'
      : this.authority === 'ACCOUNT_ONLINE' ? '계정 지휘관 · 서버' : '계정 지휘관 · 오프라인 캐시';
    this.layer!.add(addText(this, x - 190, y - 225, authorityLabel, compact ? 19 : 17, '#dfe7f3'));
    const titleName = state.profileLoadout.titleId ? getProfileCosmetic(state.profileLoadout.titleId).name : '칭호 없음';
    this.layer!.add(addText(this, x, y - 183, titleName, compact ? 25 : 23, COLORS.gold, 'center').setOrigin(0.5));

    const portraitId = state.profileLoadout.portraitCharacterId;
    if (portraitId) {
      const art = familyForUnit(portraitId);
      const portrait = this.add.sprite(x - 120, y - 60, art.family.idle.key, 0).setTint(art.tint).setScale(1.05 * art.displayScale);
      portrait.setDisplaySize(Math.min(160, portrait.displayWidth), Math.min(160, portrait.displayHeight));
      this.layer!.add(portrait);
      this.layer!.add(addText(this, x - 120, y + 35, getSlotById(portraitId)?.displayName ?? portraitId, 18, '#ffffff', 'center').setOrigin(0.5));
    }

    const emblemName = getProfileCosmetic(state.profileLoadout.emblemId).name;
    this.layer!.add(addText(this, x + 30, y - 92, `문장 · ${emblemName}`, 19, '#d6ddea'));
    this.layer!.add(addText(this, x + 30, y - 52, `메인 · ${progress.clearedStageIds.length}/80`, 18, '#bfc9d8'));
    this.layer!.add(addText(this, x + 30, y - 18, `SPECIAL · ${progress.specialClearedStageIds.length}`, 18, '#bfc9d8'));
    this.layer!.add(addText(this, x + 30, y + 16, `업적 · ${state.completedCount}/${ACHIEVEMENTS.length}`, 18, COLORS.green));

    const badgeNames = state.profileLoadout.badgeIds.map((id) => getProfileCosmetic(id).name);
    this.layer!.add(addText(this, x - 190, y + 78, `대표 배지 · ${badgeNames.length ? badgeNames.join(' · ') : '없음'}`, 16, '#d4dbe7').setWordWrapWidth(380));

    const controlY = y + 155;
    const controlsEnabled = state.editable && !this.accountMutationPending;
    const buttonAccent = controlsEnabled ? 0x6d86a7 : 0x424b59;
    const buttons = [
      addButton(this, x - 135, controlY, 120, compact ? 70 : 48, controlsEnabled ? '대표' : '읽기', () => this.cyclePortrait(), buttonAccent),
      addButton(this, x, controlY, 120, compact ? 70 : 48, '칭호', () => this.cycleCosmetic('TITLE'), buttonAccent),
      addButton(this, x + 135, controlY, 120, compact ? 70 : 48, '프레임', () => this.cycleCosmetic('FRAME'), buttonAccent),
      addButton(this, x - 135, controlY + 66, 120, compact ? 70 : 48, '배너', () => this.cycleCosmetic('BANNER'), buttonAccent),
      addButton(this, x, controlY + 66, 120, compact ? 70 : 48, '문장', () => this.cycleCosmetic('EMBLEM'), buttonAccent),
      addButton(this, x + 135, controlY + 66, 120, compact ? 70 : 48, '배지', () => this.cycleBadges(), buttonAccent),
    ];
    this.layer!.add(buttons);
    const footer = this.statusMessage || (!state.editable ? '오프라인/불완전 계정 프로필은 읽기 전용' : '');
    if (footer) this.layer!.add(addText(this, x, y + 236, footer, 15, '#8f9bac', 'center').setOrigin(0.5));
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

    this.layer!.add(addText(this, 500, 125, `업적 ${state.completedCount}/${ACHIEVEMENTS.length}`, compact ? 26 : 24, COLORS.cream));
    this.layer!.add(addButton(this, 760, 145, 230, compact ? 70 : 48, `분류 · ${CATEGORY_LABELS[category]}`, () => {
      this.categoryIndex = nextIndex(this.categoryIndex, CATEGORIES.length);
      this.page = 0;
      this.render();
    }, 0x6d7891));
    this.layer!.add(addButton(this, 1045, 145, 110, compact ? 70 : 48, '◀', () => { this.page = Math.max(0, this.page - 1); this.render(); }, 0x56657d));
    this.layer!.add(addButton(this, 1175, 145, 110, compact ? 70 : 48, '▶', () => { this.page = Math.min(pageCount - 1, this.page + 1); this.render(); }, 0x56657d));
    this.layer!.add(addText(this, 1110, 183, `${this.page + 1}/${pageCount}`, 15, '#93a0b2', 'center').setOrigin(0.5));

    visible.forEach((definition, index) => {
      const evaluation = evaluationById.get(definition.id)!;
      const hidden = definition.visibility === 'HIDDEN' && !evaluation.complete;
      const rowY = 245 + index * (compact ? 106 : 96);
      const accent = evaluation.complete ? 0x568e68 : 0x566173;
      const row = this.add.rectangle(880, rowY, 740, compact ? 94 : 84, evaluation.complete ? 0x223328 : 0x222936, 0.97).setStrokeStyle(2, accent);
      this.layer!.add(row);
      const name = hidden ? '???' : definition.name;
      const description = hidden ? '조건 비공개' : definition.shortDescription;
      const progressText = evaluation.complete ? '완료 ✓' : `${evaluation.current} / ${evaluation.target}`;
      const rewardNames = hidden ? [] : getAchievementRewardNames(definition.id);
      this.layer!.add(addText(this, 530, rowY - 30, name, compact ? 21 : 20, evaluation.complete ? '#a9efb9' : '#ffffff'));
      this.layer!.add(addText(this, 530, rowY + 1, description, compact ? 16 : 15, '#aeb8c6').setWordWrapWidth(465));
      this.layer!.add(addText(this, 1205, rowY - 28, progressText, compact ? 18 : 16, evaluation.complete ? COLORS.green : COLORS.gold, 'right').setOrigin(1, 0));
      if (rewardNames.length > 0) this.layer!.add(addText(this, 1205, rowY + 6, rewardNames.join(' · '), 14, '#d2b9ed', 'right').setOrigin(1, 0).setWordWrapWidth(220));
    });
  }
}
