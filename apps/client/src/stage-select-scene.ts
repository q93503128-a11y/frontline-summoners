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
import { addButton, addText, COLORS, drawBackdrop } from './scene-ui';
import { isCompactMobileViewport } from './viewport';

const EMPTY_PROGRESS: GuestProgress = {
  clearedStageIds: [],
  specialClearedStageIds: [],
  permanentRewardIds: [],
  discoveredEnemyIds: [],
};
const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  gold: '골드', evo_fragment: '진화조각', evo_core: '진화핵', evo_crown: '진화관',
  soul_essence: '혼정수', summon_crystal: '모집결정', sweep_ticket: '소탕권',
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

export class StageSelectScene extends Phaser.Scene {
  private progress: GuestProgress = EMPTY_PROGRESS;
  private authority: ActiveProgressAuthority = 'GUEST_LOCAL';
  private progressLoaded = false;
  private collection: StageCollection = STAGE_COLLECTIONS[0]!;
  private page = 0;
  private requestedPage: number | undefined;
  private stageLayer: Phaser.GameObjects.Container | undefined;
  private pageText: Phaser.GameObjects.Text | undefined;
  private sweepStatus: Phaser.GameObjects.Text | undefined;
  private enemyOverlay: Phaser.GameObjects.Container | undefined;
  private sweepInFlight = false;

  constructor() { super('stage-select'); }

  init(data: { collectionId?: string; page?: number } = {}): void {
    this.collection = getStageCollection(data.collectionId ?? STAGE_COLLECTIONS[0]!.id);
    this.requestedPage = Number.isInteger(data.page) ? Math.max(0, Math.trunc(data.page!)) : undefined;
    this.page = this.requestedPage ?? 0;
    this.enemyOverlay = undefined;
    this.sweepInFlight = false;
    this.progressLoaded = false;
  }

  create(): void {
    drawBackdrop(this, 'map');
    const compact = isCompactMobileViewport();
    addText(this, 54, 38, this.collection.title, 42, COLORS.cream);
    addText(
      this, 56, 91,
      compact ? `${this.collection.stages.length}개 전장` : `${this.collection.stages.length}개 전장 · 5개씩 보기 · ${this.collection.stageType === 'SPECIAL' ? '단계/메인 진도 조건 적용' : '순차 진도'}`,
      compact ? 22 : 19, COLORS.muted,
    );
    this.sweepStatus = addText(this, INTERNAL_WIDTH / 2, 126, '진행 정보를 불러오는 중…', compact ? 18 : 15, '#9fe4b5', 'center').setOrigin(0.5);
    addButton(this, 995, compact ? 70 : 65, 150, compact ? 84 : 50, '출정', () => this.scene.start('stage-hub'), 0x6a7790);
    addButton(this, 1165, compact ? 70 : 65, 160, compact ? 84 : 50, '메인', () => this.scene.start('main-menu'), 0x586275);
    addButton(this, 72, 655, 115, compact ? 84 : 52, '◀ 이전', () => { this.page = Math.max(0, this.page - 1); this.renderPage(); }, 0x586275);
    addButton(this, 1208, 655, 115, compact ? 84 : 52, '다음 ▶', () => { this.page = Math.min(this.pageCount() - 1, this.page + 1); this.renderPage(); }, 0x586275);
    this.pageText = addText(this, INTERNAL_WIDTH / 2, 640, '', compact ? 22 : 18, '#9ca9bb', 'center').setOrigin(0.5);
    this.renderPage();

    void loadActiveProgress().then((view) => {
      if (!this.scene.isActive()) return;
      this.authority = view.authority;
      this.progress = view.progress;
      this.progressLoaded = true;
      this.sweepStatus?.setText(view.authority === 'ACCOUNT_OFFLINE_CACHE'
        ? '오프라인 계정 캐시 · 전투/소탕은 서버 연결 후 가능'
        : view.authority === 'ACCOUNT_ONLINE' ? '로그인 계정 · 서버 진행 사용' : '게스트 로컬 진행 사용');
      this.sweepStatus?.setColor(view.authority === 'ACCOUNT_OFFLINE_CACHE' ? '#f2d37c' : view.authority === 'ACCOUNT_ONLINE' ? '#8ee3aa' : '#9ca9bb');
      if (this.requestedPage === undefined) {
        const firstUncleared = getFirstUnclearedCollectionStageIndex(this.collection, view.progress.clearedStageIds, view.progress.specialClearedStageIds);
        if (firstUncleared >= 0) this.page = Math.floor(firstUncleared / 5);
      } else this.page = Math.min(this.pageCount() - 1, this.requestedPage);
      this.renderPage();
    }).catch((error: unknown) => {
      if (!this.scene.isActive()) return;
      this.sweepStatus?.setText(error instanceof Error ? error.message : '진행 정보를 읽지 못했습니다.').setColor('#ff9f9f');
    });
  }

  private pageCount(): number { return Math.max(1, Math.ceil(this.collection.stages.length / 5)); }

  private renderPage(): void {
    this.stageLayer?.destroy(true);
    this.stageLayer = this.add.container(0, 0);
    const compact = isCompactMobileViewport();
    const special = this.collection.stageType === 'SPECIAL';
    const start = this.page * 5;
    const visible = this.collection.stages.slice(start, start + 5);
    const discoveredEnemyIds = new Set(this.progress.discoveredEnemyIds ?? []);
    const sweepTickets = getGuestResourceBalance(this.progress, 'sweep_ticket');
    const chargeMap = getGuestPeriodicRewardChargeMap(this.progress);
    const onlineWritable = this.authority !== 'ACCOUNT_OFFLINE_CACHE';
    this.pageText?.setText(`${this.page + 1} / ${this.pageCount()}`);

    visible.forEach((stage, localIndex) => {
      const index = start + localIndex;
      const x = 145 + localIndex * 247;
      const unlocked = this.progressLoaded && isSortieStageUnlocked(stage.id, this.progress.clearedStageIds, this.progress.specialClearedStageIds);
      const lockedReason = special ? getSpecialStageUnlockText(stage.id, this.progress.clearedStageIds, this.progress.specialClearedStageIds) : undefined;
      const formationViolation = unlocked ? getGuestStageFormationViolation(stage.id, this.progress) : undefined;
      const canSortie = unlocked && formationViolation === undefined && onlineWritable;
      const cleared = special ? this.progress.specialClearedStageIds.includes(stage.id) : this.progress.clearedStageIds.includes(stage.id);
      const sweepEligible = cleared && stage.sweepEligibility === 'AFTER_NORMAL_CLEAR';
      const canSweep = unlocked && sweepEligible && sweepTickets > 0 && !this.sweepInFlight && onlineWritable;
      const periodicCollectionId = getPeriodicRewardCollectionIdForStage(stage.id);
      const periodicCharges = periodicCollectionId ? chargeMap[periodicCollectionId].charges : undefined;
      const rewardOwned = !special && stage.permanentRewardId !== undefined && this.progress.permanentRewardIds.includes(stage.permanentRewardId);
      const rewardText = getPermanentRewardEffectText(stage.permanentRewardId);
      const last = index === this.collection.stages.length - 1;
      const border = unlocked ? (special ? (last ? 0xc28bcb : 0x80659b) : (last ? 0xbf9252 : 0x596c86)) : 0x3c4554;

      this.stageLayer!.add(this.add.rectangle(x, 360, 220, 445, unlocked ? (special ? 0x2b2535 : 0x242b3a) : 0x1d222c, 0.98).setStrokeStyle(3, border, 1));
      const stageEnemyIds = getStageEnemyIds(stage);
      const discoveredStageEnemyCount = stageEnemyIds.filter((enemyId) => discoveredEnemyIds.has(enemyId)).length;
      const clearStateLabel = cleared ? '✓ 완료' : unlocked ? (special ? '도전 가능' : '미클리어') : '잠김';

      this.stageLayer!.add(addText(this, x, 160, special ? `SPECIAL ${index + 1}` : `STAGE ${index + 1}`, compact ? 20 : 16, unlocked ? (special ? '#bba4d0' : '#8998ad') : '#5f6978', 'center').setOrigin(0.5));
      this.stageLayer!.add(addText(this, x, compact ? 205 : 202, stage.name, compact ? 28 : 25, unlocked ? '#ffffff' : '#747d89', 'center').setOrigin(0.5).setWordWrapWidth(195));
      this.stageLayer!.add(addText(this, x, compact ? 252 : 246, `난이도 ${stage.difficulty} / 12`, compact ? 21 : 16, unlocked ? (special ? '#efb6ff' : COLORS.gold) : '#5e6470', 'center').setOrigin(0.5));
      this.stageLayer!.add(addButton(this, x, compact ? 302 : 401, 194, compact ? 76 : 56, `${clearStateLabel}\n출현 적 ${discoveredStageEnemyCount}/${stageEnemyIds.length} ▶`, () => this.showStageEnemies(stage), discoveredStageEnemyCount === stageEnemyIds.length ? 0x668e76 : 0x80636c));

      if (compact) {
        if (special) {
          const effectiveCap = unlocked ? createPrototypeBattle(stage.id, getUnlockedSlotIds(this.progress.clearedStageIds), this.progress.permanentRewardIds).playerUnitCap : stage.playerUnitCap;
          const specialStatus = !onlineWritable && unlocked ? '서버 연결 필요' : !unlocked ? (lockedReason ?? 'SPECIAL 해금 조건 필요') : formationViolation ?? `동시 출격 ${effectiveCap}기`;
          this.stageLayer!.add(addText(this, x, 350, specialStatus, 18, canSortie ? '#ffd493' : '#d9a6a6', 'center').setOrigin(0.5).setWordWrapWidth(196));
          const repeatText = periodicCharges === undefined ? (cleared ? '✓ 클리어 기록 완료' : '반복 클리어 보상 가능') : `보상 충전 ${periodicCharges}/4 · ${cleared ? '소탕 가능' : '첫 클리어 우선'}`;
          this.stageLayer!.add(addText(this, x, 402, repeatText, 18, cleared ? '#9fe4b5' : unlocked ? '#e2ca8d' : '#6d6858', 'center').setOrigin(0.5));
        } else {
          this.stageLayer!.add(addText(this, x, 350, '첫 NORMAL_CLEAR 영구 보상', 18, unlocked ? '#8dd9a8' : '#596a60', 'center').setOrigin(0.5));
          this.stageLayer!.add(addText(this, x, 390, rewardOwned ? `✓ ${rewardText}` : rewardText, 18, rewardOwned ? '#9fe4b5' : unlocked ? '#f2d37c' : '#6d6858', 'center').setOrigin(0.5).setWordWrapWidth(196));
        }
      } else {
        this.stageLayer!.add(addText(this, x, 282, BATTLEFIELD_THEME_LABELS[stage.theme], 16, unlocked ? (special ? '#bba8ca' : '#9ec5d7') : '#606874', 'center').setOrigin(0.5));
        this.stageLayer!.add(addText(this, x, 310, `전장 ${stage.mapLength}m`, 14, unlocked ? '#aeb8c8' : '#59616d', 'center').setOrigin(0.5));
        this.stageLayer!.add(addText(this, x, 346, stage.subtitle, 14, unlocked ? (special ? '#d0c6da' : '#c4cbd7') : '#626a76', 'center').setOrigin(0.5).setWordWrapWidth(194));
        if (special) {
          const effectiveCap = unlocked ? createPrototypeBattle(stage.id, getUnlockedSlotIds(this.progress.clearedStageIds), this.progress.permanentRewardIds).playerUnitCap : stage.playerUnitCap;
          const specialStatus = !onlineWritable && unlocked ? '오프라인 캐시 · 서버 연결 필요' : !unlocked ? (lockedReason ?? 'SPECIAL 해금 조건 필요') : formationViolation ?? `동시 출격 ${effectiveCap}기 · 적 최대 ${stage.enemyUnitCap}기`;
          this.stageLayer!.add(addText(this, x, 432, specialStatus, 13, canSortie ? '#ffd493' : '#d9a6a6', 'center').setOrigin(0.5).setWordWrapWidth(196));
          const repeatText = periodicCharges === undefined ? (cleared ? '✓ 클리어 기록 완료 · 반복 가능' : '메인 진도와 별도 클리어 기록') : `보상 충전 ${periodicCharges}/4 · ${cleared ? '반복/소탕 가능' : '첫 클리어 우선'}`;
          this.stageLayer!.add(addText(this, x, 474, repeatText, 13, cleared ? '#9fe4b5' : unlocked ? '#e2ca8d' : '#6d6858', 'center').setOrigin(0.5).setWordWrapWidth(196));
        } else {
          this.stageLayer!.add(addText(this, x, 434, '첫 NORMAL_CLEAR 영구 보상', 13, unlocked ? '#8dd9a8' : '#596a60', 'center').setOrigin(0.5));
          this.stageLayer!.add(addText(this, x, 466, rewardOwned ? `✓ ${rewardText}` : rewardText, 13, rewardOwned ? '#9fe4b5' : unlocked ? '#f2d37c' : '#6d6858', 'center').setOrigin(0.5).setWordWrapWidth(196));
        }
      }

      if (!special && stage.unlockUnitId) {
        const slot = getSlotById(stage.unlockUnitId);
        if (slot) this.stageLayer!.add(addText(this, x, compact ? 445 : 503, compact ? `동료 · ${slot.displayName}` : `첫 클리어 동료 · ${slot.displayName}`, compact ? 19 : 14, cleared ? '#8ee3aa' : unlocked ? '#a8cfff' : '#59616d', 'center').setOrigin(0.5));
      }

      const lockedLabel = !onlineWritable && unlocked ? '서버 연결 필요' : special ? (lockedReason ?? '해금 조건 필요') : '이전 스테이지 필요';
      const splitButtons = sweepEligible;
      const battleX = splitButtons ? x - 48 : x;
      const battleWidth = splitButtons ? 82 : 174;
      const stageButton = addButton(
        this, battleX, compact ? 535 : 548, battleWidth, compact ? 84 : 52,
        !unlocked ? (compact ? '잠김' : lockedLabel) : !onlineWritable ? '온라인' : formationViolation ? '편성' : (special ? '도전' : '전투'),
        () => {
          if (!unlocked) return;
          if (!onlineWritable) { this.scene.start('account'); return; }
          if (formationViolation) this.scene.start('deck'); else this.scene.start('battle', { stageId: stage.id });
        },
        canSortie ? border : formationViolation ? 0x8b5d5d : 0x3f4855,
      );
      if (!canSortie) stageButton.setAlpha(0.72);
      this.stageLayer!.add(stageButton);

      if (splitButtons) {
        const chargeSuffix = periodicCharges === undefined ? '' : `\n충 ${periodicCharges}`;
        const sweepButton = addButton(this, x + 53, compact ? 535 : 548, 96, compact ? 84 : 52, `소탕\n권 ${sweepTickets}${chargeSuffix}`, () => {
          if (canSweep) void this.executeSweep(stage);
          else if (!onlineWritable) this.scene.start('account');
        }, canSweep ? 0x8e7544 : 0x3f4855);
        if (!canSweep) sweepButton.setAlpha(0.62);
        this.stageLayer!.add(sweepButton);
      }
    });
  }

  private async executeSweep(stage: PrototypeStage): Promise<void> {
    if (this.sweepInFlight) return;
    this.sweepInFlight = true;
    this.sweepStatus?.setColor('#e8d89c').setText(`${stage.name} · 소탕 처리 중...`);
    try {
      if (this.authority === 'ACCOUNT_OFFLINE_CACHE') throw new Error('로그인 계정 소탕은 서버 연결이 필요합니다.');
      if (this.authority === 'ACCOUNT_ONLINE') {
        const response = await mutateAuthenticatedAccountSweep({ requestId: crypto.randomUUID(), stageId: stage.id });
        this.progress = accountSnapshotToGuestProgress(response.snapshot);
        const remaining = getGuestResourceBalance(this.progress, 'sweep_ticket');
        this.sweepStatus?.setColor('#9fe4b5').setText(`서버 소탕 완료 · ${formatReward(resourceRewardFromUnknown(response.result))} · 소탕권 ${remaining}`);
      } else {
        const result = await recordGuestStageSweep(stage.id);
        this.progress = result.progress;
        const remaining = getGuestResourceBalance(this.progress, 'sweep_ticket');
        const persistence = result.persisted ? '' : ' · 영구 저장 실패(현재 탭 유지)';
        this.sweepStatus?.setColor(result.persisted ? '#9fe4b5' : '#ffb37c').setText(`소탕 완료 · ${formatReward(result.resourceReward)} · 소탕권 ${remaining}${persistence}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sweepStatus?.setColor('#ff9f9f').setText(message.includes('Insufficient meta resource: sweep_ticket') ? '소탕권이 부족하다.' : `소탕 실패 · ${message}`);
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
    overlay.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.82).setInteractive());
    overlay.add(this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, compact ? 1040 : 980, compact ? 540 : 520, 0x202632, 0.99).setStrokeStyle(4, 0x8a6670, 1));
    overlay.add(addText(this, INTERNAL_WIDTH / 2, 150, `${stage.name} · 출현 적`, compact ? 34 : 31, '#fff4cf', 'center').setOrigin(0.5));
    overlay.add(addText(this, INTERNAL_WIDTH / 2, 198, '발견한 적만 이름과 상세 정보가 공개된다.', compact ? 21 : 18, '#b8c0ce', 'center').setOrigin(0.5));
    if (enemyIds.length === 0) {
      overlay.add(addText(this, INTERNAL_WIDTH / 2, 360, '출현 적 정보가 없다.', compact ? 24 : 20, '#8995a7', 'center').setOrigin(0.5));
    } else {
      const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(enemyIds.length))));
      const rows = Math.ceil(enemyIds.length / columns);
      const spacingX = compact ? 235 : 220;
      const spacingY = compact ? 126 : 112;
      const startX = INTERNAL_WIDTH / 2 - ((columns - 1) * spacingX) / 2;
      const startY = 330 - ((rows - 1) * spacingY) / 2;
      enemyIds.forEach((enemyId, index) => {
        const enemy = ENEMIES.find((candidate) => candidate.enemyId === enemyId); if (!enemy) return;
        const discovered = discoveredIds.has(enemyId); const boss = (enemy.definition.combatTags ?? []).includes('BOSS');
        const col = index % columns; const row = Math.floor(index / columns); const x = startX + col * spacingX; const y = startY + row * spacingY;
        overlay.add(addButton(this, x, y, compact ? 210 : 195, compact ? 78 : 64, discovered ? enemy.displayName : '???', () => this.scene.start('catalog', { mode: 'ENEMIES', focusEnemyId: enemyId, returnTo: { scene: 'stage-select', data: { collectionId: this.collection.id, page: this.page } } }), discovered ? (boss ? 0xc97772 : 0xa45f64) : 0x46505e));
        overlay.add(addText(this, x, y + (compact ? 50 : 43), discovered ? (boss ? 'BOSS · 도감 열기' : '발견됨 · 도감 열기') : '미발견 · 정보 비공개', compact ? 17 : 14, discovered ? (boss ? '#ffaaa2' : '#d8adb1') : '#707985', 'center').setOrigin(0.5));
      });
    }
    overlay.add(addButton(this, INTERNAL_WIDTH / 2, compact ? 575 : 570, 190, compact ? 84 : 58, '닫기', () => { overlay.destroy(true); if (this.enemyOverlay === overlay) this.enemyOverlay = undefined; }, 0x586275));
    this.enemyOverlay = overlay;
  }
}