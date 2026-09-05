import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { accountSnapshotToGuestProgress, loadActiveProgress, type ActiveProgressAuthority } from './active-progress';
import { mutateAuthenticatedAccountSweep } from './account-network';
import { BATTLEFIELD_THEME_LABELS } from './battlefield';
import { getPermanentRewardEffectText } from './permanent-reward-ui';
import { getGuestStageFormationViolation } from './player-loadout';
import { ENEMIES, createPrototypeBattle, getSlotById, getUnlockedSlotIds, type PrototypeStage } from './prototype';
import {
  getGuestPeriodicRewardChargeMap,
  getGuestResourceBalance,
  recordGuestStageSweep,
  type GuestProgress,
} from './save';
import { getPeriodicRewardCollectionIdForStage } from './special-rewards';
import {
  STAGE_COLLECTIONS,
  getFirstUnclearedCollectionStageIndex,
  getSpecialStageUnlockText,
  getStageCollection,
  isSortieStageUnlocked,
  type StageCollection,
} from './stage-navigation';
import {
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  COLORS,
  drawBackdrop,
  setButtonState,
} from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  discoveredEnemyIds: [],
};
const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  gold: '골드', evo_fragment: '진화 조각', evo_core: '진화 핵', evo_crown: '진화 왕관',
  soul_essence: '혼의 파편', summon_crystal: '모집 결정', sweep_ticket: '소탕권',
};

function getStageEnemyIds(stage: PrototypeStage): readonly string[] {
  const seen = new Set<string>();
  const enemyIds: string[] = [];
  for (const wave of stage.waves) {
    if (seen.has(wave.spawn.enemyId)) continue;
    seen.add(wave.spawn.enemyId);
    enemyIds.push(wave.spawn.enemyId);
  }
  return enemyIds;
}

function formatReward(amounts: Readonly<Record<string, number | undefined>>): string {
  const entries = Object.entries(amounts).filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && (entry[1] ?? 0) > 0);
  return entries.length === 0 ? '보상 없음' : entries.map(([id, amount]) => `${RESOURCE_LABELS[id] ?? id} +${amount}`).join(' · ');
}

function resourceRewardFromUnknown(value: unknown): Readonly<Record<string, number | undefined>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const reward = (value as Record<string, unknown>).resourceReward;
  if (typeof reward !== 'object' || reward === null || Array.isArray(reward)) return {};
  const result: Record<string, number> = {};
  for (const [id, amount] of Object.entries(reward as Record<string, unknown>)) {
    if (Number.isInteger(amount) && (amount as number) > 0) result[id] = amount as number;
  }
  return result;
}

function difficultyMarks(value: number): string {
  const filled = Math.max(1, Math.min(6, Math.ceil(value / 2)));
  return `${'◆'.repeat(filled)}${'◇'.repeat(6 - filled)}`;
}

function multiplayerLabel(stage: PrototypeStage): string {
  return stage.multiplayerPolicy === 'SOLO_OR_COOP' ? '솔로 · 2인 협동' : '솔로 전용';
}

export class StageSelectScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private progressLoaded = false;
  private collection: StageCollection = STAGE_COLLECTIONS[0]!;
  private page = 0;
  private requestedPage: number | undefined;
  private selectedIndex = 0;
  private stageLayer: Phaser.GameObjects.Container | undefined;
  private pageText: Phaser.GameObjects.Text | undefined;
  private sweepStatus: Phaser.GameObjects.Text | undefined;
  private authorityLayer: Phaser.GameObjects.Container | undefined;
  private enemyOverlay: Phaser.GameObjects.Container | undefined;
  private sweepInFlight = false;

  constructor() { super('stage-select'); }

  init(data: { collectionId?: string; page?: number } = {}): void {
    this.collection = getStageCollection(data.collectionId ?? STAGE_COLLECTIONS[0]!.id);
    this.requestedPage = Number.isInteger(data.page) ? Math.max(0, Math.trunc(data.page!)) : undefined;
    this.page = this.requestedPage ?? 0;
    this.selectedIndex = this.page * 5;
    this.enemyOverlay = undefined;
    this.sweepInFlight = false;
    this.progressLoaded = false;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 52, 28, this.collection.title, compact ? 43 : 45, COLORS.cream);
    addText(this, 54, 80, this.collection.stageType === 'SPECIAL'
      ? '특수 전선 · 해금 조건과 반복 보상을 확인하고 전장을 선택한다.'
      : '진행선을 따라 다음 전장을 선택한다. 완료한 전장은 다시 도전하거나 소탕할 수 있다.', compact ? 19 : 16, COLORS.muted);
    addButton(this, 1010, 57, 150, compact ? 82 : 50, '전선 지도', () => this.scene.start('stage-hub'), 0x66798e, { tone: 'quiet' });
    addButton(this, 1170, 57, 150, compact ? 82 : 50, '지휘소', () => this.scene.start('main-menu'), 0x596779, { tone: 'quiet' });

    this.authorityLayer = this.add.container(0, 0);
    this.sweepStatus = addText(this, 640, 120, '진행 정보를 불러오는 중…', compact ? 18 : 15, COLORS.muted, 'center').setOrigin(0.5);
    addSectionHeading(this, 55, 146, '전선 진행', 1170, this.collection.stageType === 'SPECIAL' ? 0x8d6ca0 : 0x6d846f);

    addButton(this, 110, 668, 170, compact ? 86 : 54, '◀ 이전 구간', () => this.changePage(-1), 0x596779, { tone: 'quiet' });
    addButton(this, 1170, 668, 170, compact ? 86 : 54, '다음 구간 ▶', () => this.changePage(1), 0x596779, { tone: 'quiet' });
    this.pageText = addText(this, 640, 667, '', compact ? 20 : 16, '#9eabb9', 'center').setOrigin(0.5);

    this.renderPage();
    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.authority = view.authority;
      this.progress = view.progress;
      this.progressLoaded = true;
      this.renderAuthority();
      if (this.requestedPage === undefined) {
        const firstUncleared = getFirstUnclearedCollectionStageIndex(this.collection, view.progress.clearedStageIds, view.progress.specialClearedStageIds);
        if (firstUncleared >= 0) {
          this.selectedIndex = firstUncleared;
          this.page = Math.floor(firstUncleared / 5);
        } else {
          this.selectedIndex = Math.max(0, this.collection.stages.length - 1);
          this.page = Math.floor(this.selectedIndex / 5);
        }
      } else {
        this.page = Math.min(this.pageCount() - 1, this.requestedPage);
        this.selectedIndex = this.page * 5;
      }
      this.sweepStatus?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '오프라인 계정 · 전투와 소탕은 온라인 복구 후 가능'
        : '전장을 선택하면 상세 작전 정보가 표시됩니다.');
      this.sweepStatus?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? COLORS.warning : COLORS.muted);
      this.renderPage();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.sweepStatus?.setText(error instanceof Error ? error.message : '진행 정보를 읽지 못했습니다.').setColor(COLORS.red);
    });
  }

  private pageCount(): number { return Math.max(1, Math.ceil(this.collection.stages.length / 5)); }

  private changePage(delta: number): void {
    this.page = Math.max(0, Math.min(this.pageCount() - 1, this.page + delta));
    const start = this.page * 5;
    const end = Math.min(this.collection.stages.length - 1, start + 4);
    if (this.selectedIndex < start || this.selectedIndex > end) this.selectedIndex = start;
    this.renderPage();
  }

  private renderAuthority(): void {
    this.authorityLayer?.destroy(true);
    this.authorityLayer = this.add.container(0, 0);
    const label = this.authority === 'ACCOUNT_ONLINE' ? '계정 · 온라인' : this.authority === 'ACCOUNT_OFFLINE_CACHE' ? '계정 · 오프라인' : '게스트 · 로컬';
    const kind = this.authority === 'ACCOUNT_ONLINE' ? 'online' : this.authority === 'ACCOUNT_OFFLINE_CACHE' ? 'offline' : 'neutral';
    this.authorityLayer.add(addStatusPill(this, 52, 117, label, kind));
  }

  private renderPage(): void {
    this.stageLayer?.destroy(true);
    this.stageLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const special = this.collection.stageType === 'SPECIAL';
    const start = this.page * 5;
    const visible = this.collection.stages.slice(start, start + 5);
    if (visible.length === 0) return;
    const endIndex = start + visible.length - 1;
    this.selectedIndex = Math.max(start, Math.min(endIndex, this.selectedIndex));
    this.pageText?.setText(`구간 ${this.page + 1} / ${this.pageCount()}`);

    const nodeY = 220;
    const nodeXs = visible.length === 1
      ? [640]
      : visible.map((_, index) => 135 + index * (1010 / Math.max(1, visible.length - 1)));
    const route = this.add.graphics();
    if (nodeXs.length > 1) {
      route.lineStyle(8, 0x202a2c, 0.95);
      route.lineBetween(nodeXs[0]!, nodeY, nodeXs[nodeXs.length - 1]!, nodeY);
      route.lineStyle(3, special ? 0x80658e : 0x607863, 0.72);
      route.lineBetween(nodeXs[0]!, nodeY, nodeXs[nodeXs.length - 1]!, nodeY);
    }
    this.stageLayer.add(route);

    visible.forEach((stage, localIndex) => {
      const absoluteIndex = start + localIndex;
      const x = nodeXs[localIndex] ?? 640;
      const unlocked = this.progressLoaded && isSortieStageUnlocked(stage.id, this.progress.clearedStageIds, this.progress.specialClearedStageIds);
      const cleared = special ? this.progress.specialClearedStageIds.includes(stage.id) : this.progress.clearedStageIds.includes(stage.id);
      const selected = absoluteIndex === this.selectedIndex;
      const last = absoluteIndex === this.collection.stages.length - 1;
      const accent = special ? (last ? 0xc08ac7 : 0x8f6ca2) : last ? 0xc09a58 : 0x7194ad;
      const nodeColor = cleared ? 0x84bd91 : unlocked ? accent : 0x525b66;
      const outer = this.add.circle(x, nodeY, selected ? 34 : 27, 0x131a21, 1).setStrokeStyle(selected ? 6 : 4, nodeColor, unlocked ? 1 : 0.55);
      const inner = this.add.circle(x, nodeY, cleared ? 15 : 11, cleared ? 0x8fdca8 : unlocked ? nodeColor : 0x4c545e, unlocked ? 0.95 : 0.5);
      const hit = this.add.circle(x, nodeY, compact ? 48 : 40, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        this.selectedIndex = absoluteIndex;
        this.renderPage();
      });
      this.stageLayer!.add([outer, inner, hit]);
      this.stageLayer!.add(addText(this, x, 169, special ? `특수 ${absoluteIndex + 1}` : `${absoluteIndex + 1}`, compact ? 18 : 15, selected ? COLORS.cream : unlocked ? '#b8c4d1' : '#747d88', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, 258, cleared ? '완료' : unlocked ? '도전 가능' : '잠김', compact ? 16 : 13, cleared ? COLORS.green : unlocked ? '#d5deea' : '#7a828c', 'center').setOrigin(0.5));
    });

    const selected = this.collection.stages[this.selectedIndex];
    if (selected) this.renderStageDetail(selected, this.selectedIndex);
  }

  private renderStageDetail(stage: PrototypeStage, index: number): void {
    const compact = isCompactMobileViewport();
    const special = this.collection.stageType === 'SPECIAL';
    const unlocked = this.progressLoaded && isSortieStageUnlocked(stage.id, this.progress.clearedStageIds, this.progress.specialClearedStageIds);
    const cleared = special ? this.progress.specialClearedStageIds.includes(stage.id) : this.progress.clearedStageIds.includes(stage.id);
    const onlineWritable = this.authority !== 'ACCOUNT_OFFLINE_CACHE';
    const lockedReason = special ? getSpecialStageUnlockText(stage.id, this.progress.clearedStageIds, this.progress.specialClearedStageIds) : undefined;
    const formationViolation = unlocked ? getGuestStageFormationViolation(stage.id, this.progress) : undefined;
    const canSortie = unlocked && formationViolation === undefined && onlineWritable;
    const enemyIds = getStageEnemyIds(stage);
    const discovered = new Set(this.progress.discoveredEnemyIds ?? []);
    const discoveredCount = enemyIds.filter((enemyId) => discovered.has(enemyId)).length;
    const accent = special ? 0x8f6ca2 : 0x6d8ca8;

    this.stageLayer!.add(addCommandPanel(this, 640, 454, 1140, 330, accent, special ? 0x211d28 : 0x1c252d, 0.95));
    this.stageLayer!.add(addText(this, 100, 315, special ? `특수 작전 ${index + 1}` : `전장 ${index + 1}`, compact ? 18 : 15, special ? '#d5b7e2' : '#a9c8df'));
    this.stageLayer!.add(addText(this, 100, 347, stage.name, compact ? 34 : 31, '#ffffff'));
    this.stageLayer!.add(addText(this, 100, 390, stage.subtitle, compact ? 19 : 16, '#c4cdd8').setWordWrapWidth(500));
    this.stageLayer!.add(addText(this, 100, 442, `${BATTLEFIELD_THEME_LABELS[stage.theme]} · 전장 ${stage.mapLength}m · ${multiplayerLabel(stage)}`, compact ? 18 : 15, '#9eb5c3'));
    this.stageLayer!.add(addText(this, 100, 476, `난이도 ${stage.difficulty}/12  ${difficultyMarks(stage.difficulty)}`, compact ? 20 : 17, special ? '#dfb9ed' : COLORS.gold));

    const statusText = !this.progressLoaded
      ? '진행 정보 확인 중…'
      : !unlocked
        ? (lockedReason ?? '이전 전장을 먼저 완료해야 합니다.')
        : !onlineWritable
          ? '오프라인 계정 · 온라인 복구 후 출전 가능'
          : formationViolation ?? (cleared ? '직접 클리어 완료 · 재도전 가능' : '출전 준비 완료');
    const statusKind = !unlocked || formationViolation || !onlineWritable ? COLORS.warning : cleared ? COLORS.green : '#dbe5ef';
    this.stageLayer!.add(addText(this, 100, 514, statusText, compact ? 18 : 15, statusKind).setWordWrapWidth(500));

    const rewardOwned = !special && stage.permanentRewardId !== undefined && this.progress.permanentRewardIds.includes(stage.permanentRewardId);
    const rewardText = getPermanentRewardEffectText(stage.permanentRewardId);
    const unlockSlot = !special && stage.unlockUnitId ? getSlotById(stage.unlockUnitId) : undefined;
    const periodicCollectionId = getPeriodicRewardCollectionIdForStage(stage.id);
    const chargeMap = getGuestPeriodicRewardChargeMap(this.progress);
    const periodicCharges = periodicCollectionId ? chargeMap[periodicCollectionId].charges : undefined;
    const sweepTickets = getGuestResourceBalance(this.progress, 'sweep_ticket');
    const sweepEligible = cleared && stage.sweepEligibility === 'AFTER_NORMAL_CLEAR';
    const canSweep = unlocked && sweepEligible && sweepTickets > 0 && !this.sweepInFlight && onlineWritable;

    this.stageLayer!.add(addSectionHeading(this, 660, 316, '작전 정보', 500, accent));
    this.stageLayer!.add(addText(this, 690, 356, `출현 적 · 발견 ${discoveredCount}/${enemyIds.length}`, compact ? 20 : 17, discoveredCount === enemyIds.length ? COLORS.green : '#d7b3b6'));
    this.stageLayer!.add(addText(this, 690, 394, special
      ? periodicCharges === undefined
        ? (cleared ? '클리어 기록 완료 · 반복 보상 가능' : '첫 직접 클리어 보상 확인')
        : `보상 충전 ${periodicCharges}/4 · ${cleared ? '반복/소탕 가능' : '첫 클리어 우선'}`
      : `${rewardOwned ? '✓ 획득' : '첫 직접 클리어'} · ${rewardText}`, compact ? 18 : 15, rewardOwned ? COLORS.green : COLORS.gold).setWordWrapWidth(480));
    if (unlockSlot) {
      this.stageLayer!.add(addText(this, 690, 432, `${cleared ? '✓ 보유' : '첫 승리 동료'} · ${unlockSlot.displayName}`, compact ? 18 : 15, cleared ? COLORS.green : '#a9d0f0'));
    } else if (special && unlocked) {
      const effectiveCap = createPrototypeBattle(stage.id, getUnlockedSlotIds(this.progress.clearedStageIds), this.progress.permanentRewardIds).playerUnitCap;
      this.stageLayer!.add(addText(this, 690, 432, `동시 출격 ${effectiveCap}기 · 적 최대 ${stage.enemyUnitCap}기`, compact ? 18 : 15, '#c1cbd7'));
    }

    const enemyButton = addButton(this, 800, 495, 220, compact ? 82 : 58, '출현 적 확인', () => this.showStageEnemies(stage), 0x8c656c, { tone: 'quiet' });
    this.stageLayer!.add(enemyButton);

    let battleLabel = '전투 시작';
    let battleTone: 'primary' | 'secondary' | 'quiet' = 'primary';
    if (!this.progressLoaded) battleLabel = '진행 확인 중';
    else if (!unlocked) battleLabel = '잠긴 전장';
    else if (!onlineWritable) battleLabel = '온라인 복구';
    else if (formationViolation) battleLabel = '편성 수정';
    else if (stage.multiplayerPolicy === 'SOLO_OR_COOP') battleLabel = '출정 방식 선택';
    const battleButton = addButton(this, 1035, 495, 250, compact ? 82 : 58, battleLabel, () => {
      if (!this.progressLoaded || !unlocked) return;
      if (!onlineWritable) { this.scene.start('account'); return; }
      if (formationViolation) { this.scene.start('deck'); return; }
      this.scene.start('battle', { stageId: stage.id });
    }, canSortie ? accent : formationViolation ? 0x8c6464 : 0x57616d, { tone: battleTone });
    if (!this.progressLoaded) setButtonState(battleButton, 'loading', '진행 정보를 확인하고 있습니다.');
    else if (!unlocked) setButtonState(battleButton, 'locked', lockedReason ?? '이전 전장을 먼저 완료해야 합니다.');
    this.stageLayer!.add(battleButton);

    if (sweepEligible) {
      const sweepLabel = !onlineWritable ? '온라인 복구' : sweepTickets <= 0 ? '소탕권 없음' : this.sweepInFlight ? '소탕 처리 중' : `소탕 · 권 ${sweepTickets}`;
      const sweepButton = addButton(this, 915, 565, 290, compact ? 78 : 54, sweepLabel, () => {
        if (!onlineWritable) { this.scene.start('account'); return; }
        if (canSweep) void this.executeSweep(stage);
      }, canSweep ? 0x9a7c45 : 0x59616b, { tone: canSweep ? 'secondary' : 'quiet' });
      if (this.sweepInFlight) setButtonState(sweepButton, 'loading', '보상을 계산하고 있습니다.');
      else if (onlineWritable && sweepTickets <= 0) setButtonState(sweepButton, 'locked', '소탕권이 필요합니다.');
      this.stageLayer!.add(sweepButton);
    } else {
      this.stageLayer!.add(addText(this, 915, 565, cleared ? '이 전장은 소탕을 지원하지 않습니다.' : '직접 클리어 후 소탕 가능 여부가 표시됩니다.', compact ? 16 : 13, '#8994a1', 'center').setOrigin(0.5));
    }
  }

  private async executeSweep(stage: PrototypeStage): Promise<void> {
    if (this.sweepInFlight) return;
    this.sweepInFlight = true;
    this.sweepStatus?.setColor(COLORS.warning).setText(`${stage.name} · 소탕 처리 중…`);
    this.renderPage();
    try {
      if (this.authority === 'ACCOUNT_OFFLINE_CACHE') throw new Error('로그인 계정 소탕은 서버 연결이 필요합니다.');
      if (this.authority === 'ACCOUNT_ONLINE') {
        const response = await mutateAuthenticatedAccountSweep({ requestId: crypto.randomUUID(), stageId: stage.id });
        this.progress = accountSnapshotToGuestProgress(response.snapshot);
        const remaining = getGuestResourceBalance(this.progress, 'sweep_ticket');
        this.sweepStatus?.setColor(COLORS.green).setText(`소탕 완료 · ${formatReward(resourceRewardFromUnknown(response.result))} · 소탕권 ${remaining}`);
      } else {
        const result = await recordGuestStageSweep(stage.id);
        this.progress = result.progress;
        const remaining = getGuestResourceBalance(this.progress, 'sweep_ticket');
        const persistence = result.persisted ? '' : ' · 저장 실패(현재 실행에서는 유지)';
        this.sweepStatus?.setColor(result.persisted ? COLORS.green : COLORS.warning).setText(`소탕 완료 · ${formatReward(result.resourceReward)} · 소탕권 ${remaining}${persistence}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sweepStatus?.setColor(COLORS.red).setText(message.includes('Insufficient meta resource: sweep_ticket') ? '소탕권이 부족합니다.' : `소탕 실패 · ${message}`);
    } finally {
      this.sweepInFlight = false;
      this.renderPage();
    }
  }

  private showStageEnemies(stage: PrototypeStage): void {
    this.enemyOverlay?.destroy(true);
    const compact = isCompactMobileViewport();
    const enemyIds = getStageEnemyIds(stage);
    const discoveredIds = new Set(this.progress.discoveredEnemyIds ?? []);
    const overlay = this.add.container(0, 0).setDepth(200);
    overlay.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.84).setInteractive());
    overlay.add(addCommandPanel(this, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, compact ? 1080 : 1020, compact ? 550 : 520, 0x8a6670, 0x1c232d, 0.99));
    overlay.add(addText(this, INTERNAL_WIDTH / 2, 142, `${stage.name} · 출현 적`, compact ? 34 : 31, COLORS.cream, 'center').setOrigin(0.5));
    overlay.add(addText(this, INTERNAL_WIDTH / 2, 185, '전투에서 발견한 적만 이름과 도감 정보가 공개됩니다.', compact ? 20 : 17, COLORS.muted, 'center').setOrigin(0.5));

    if (enemyIds.length === 0) {
      overlay.add(addText(this, INTERNAL_WIDTH / 2, 360, '출현 적 정보가 없습니다.', compact ? 24 : 20, '#8995a7', 'center').setOrigin(0.5));
    } else {
      const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(enemyIds.length))));
      const rows = Math.ceil(enemyIds.length / columns);
      const spacingX = compact ? 240 : 225;
      const spacingY = compact ? 126 : 112;
      const startX = INTERNAL_WIDTH / 2 - ((columns - 1) * spacingX) / 2;
      const startY = 330 - ((rows - 1) * spacingY) / 2;
      enemyIds.forEach((enemyId, enemyIndex) => {
        const enemy = ENEMIES.find((candidate) => candidate.enemyId === enemyId);
        if (!enemy) return;
        const discovered = discoveredIds.has(enemyId);
        const boss = (enemy.definition.combatTags ?? []).includes('BOSS');
        const col = enemyIndex % columns;
        const row = Math.floor(enemyIndex / columns);
        const x = startX + col * spacingX;
        const y = startY + row * spacingY;
        const enemyButton = addButton(this, x, y, compact ? 218 : 202, compact ? 80 : 64, discovered ? enemy.displayName : '미발견', () => {
          if (!discovered) return;
          this.scene.start('catalog', {
            mode: 'ENEMIES',
            focusEnemyId: enemyId,
            returnTo: { scene: 'stage-select', data: { collectionId: this.collection.id, page: this.page } },
          });
        }, discovered ? (boss ? 0xc97772 : 0x9b6970) : 0x4d5661, { tone: discovered ? 'secondary' : 'quiet' });
        if (!discovered) setButtonState(enemyButton, 'locked', '전투에서 먼저 발견해야 합니다.');
        overlay.add(enemyButton);
        overlay.add(addText(this, x, y + (compact ? 52 : 44), discovered ? (boss ? '우두머리 · 도감 열기' : '발견됨 · 도감 열기') : '정보 비공개', compact ? 16 : 13, discovered ? (boss ? '#ffaaa2' : '#d8adb1') : '#7b8490', 'center').setOrigin(0.5));
      });
    }

    overlay.add(addButton(this, INTERNAL_WIDTH / 2, compact ? 590 : 580, 200, compact ? 86 : 58, '닫기', () => {
      overlay.destroy(true);
      if (this.enemyOverlay === overlay) this.enemyOverlay = undefined;
    }, 0x596779, { tone: 'quiet' }));
    this.enemyOverlay = overlay;
  }
}
