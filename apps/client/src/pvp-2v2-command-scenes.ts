import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { PVP_ARENA_TEAM_V1 } from '@frontline/sim/pvp-arena-content';
import {
  Pvp2v2BattleScene as BasePvp2v2BattleScene,
  Pvp2v2MatchmakingScene as BasePvp2v2MatchmakingScene,
} from './pvp-2v2-scenes.ts';
import type {
  Pvp2v2BattleSnapshot,
  Pvp2v2MatchmakingState,
  Pvp2v2Session,
} from './pvp-2v2-network.ts';
import { getSlotById } from './prototype.ts';
import {
  COLORS,
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  battleUiFontSize,
  familyForUnit,
  setButtonState,
} from './scene-ui.ts';
import { getCurrentMinimumInternalTouchTarget, isCompactMobileViewport } from './viewport.ts';

type TeamId = 'A' | 'B';

interface MatchmakingCarrier extends Phaser.Scene {
  state: Pvp2v2MatchmakingState;
  content?: Phaser.GameObjects.Container;
  status?: Phaser.GameObjects.Text;
  render(): void;
}

interface BattleCarrier extends Phaser.Scene {
  modeId: 'pvp_casual_2v2' | 'pvp_friendly_2v2';
  nextScene: string;
  session: Pvp2v2Session | null;
  snapshot: Pvp2v2BattleSnapshot | null;
  battlefield?: Phaser.GameObjects.Container;
  controls?: Phaser.GameObjects.Container;
  resultLayer?: Phaser.GameObjects.Container;
  status?: Phaser.GameObjects.Text;
  finished: boolean;
  renderBattle(): void;
  renderControls(): void;
  showResult(result: 'A' | 'B' | 'DRAW', reason: string): void;
  showVoid(reason: string): void;
}

const MATCH_INSTALLED = Symbol('pvp-2v2-command-matchmaking-installed');
const BATTLE_INSTALLED = Symbol('pvp-2v2-command-battle-installed');
const FIELD_LEFT = 112;
const FIELD_RIGHT = 1168;

function sanitize2v2Status(value: string): string {
  if (/lockstep/i.test(value)) return '2v2 전투 진행 중';
  if (/서버 전투방/.test(value)) return '4명의 지휘관이 확정되어 전투를 준비하는 중…';
  if (/^좌석\s+[AB][12]\s+확정/.test(value)) return '팀 배정 완료 · 2v2 전투로 이동합니다.';
  if (/전투 서버에 연결/.test(value)) return '2v2 전투를 연결하는 중…';
  if (/^[a-z0-9_]+$/i.test(value) || /HTTP_|state hash|seatId|matchId/i.test(value)) return '2v2 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
  return value;
}

function installStatusSanitizer(status: Phaser.GameObjects.Text | undefined): void {
  if (!status) return;
  const originalSetText = status.setText.bind(status);
  status.setText(sanitize2v2Status(status.text));
  status.setText = ((value: string | string[]) => {
    const next = Array.isArray(value) ? value.map((entry) => sanitize2v2Status(entry)) : sanitize2v2Status(value);
    return originalSetText(next);
  }) as typeof status.setText;
}

function matchStateLabel(state: Pvp2v2MatchmakingState['state']): { label: string; kind: 'neutral' | 'online' | 'warning' } {
  if (state === 'MATCHED') return { label: '양 팀 편성 완료', kind: 'online' };
  if (state === 'PAIRING') return { label: '팀 배정 중', kind: 'warning' };
  if (state === 'QUEUED') return { label: '지휘관 탐색 중', kind: 'warning' };
  return { label: '출전 준비', kind: 'neutral' };
}

function renderMatchmaking(scene: MatchmakingCarrier): void {
  scene.content?.destroy(true);
  scene.content = scene.add.container(0, 0);
  const layer = scene.content;
  const compact = isCompactMobileViewport();
  const state = matchStateLabel(scene.state.state);

  layer.add(addCommandPanel(scene, INTERNAL_WIDTH / 2, 355, 900, 420, 0x6683a5, 0x1b2530, 0.95));
  layer.add(addSectionHeading(scene, 215, 160, '팀전 출정 대기', 850, 0x6683a5));
  layer.add(addStatusPill(scene, 240, 202, state.label, state.kind));

  const nodes = [
    { x: 340, label: '나', active: true },
    { x: 540, label: '팀원', active: scene.state.state !== 'IDLE' },
    { x: 740, label: '상대 1', active: scene.state.state === 'PAIRING' || scene.state.state === 'MATCHED' },
    { x: 940, label: '상대 2', active: scene.state.state === 'MATCHED' },
  ];
  const route = scene.add.graphics();
  route.lineStyle(4, 0x556579, 0.42).lineBetween(340, 280, 940, 280);
  nodes.forEach((node) => {
    route.fillStyle(node.active ? 0xd6b861 : 0x46515f, node.active ? 0.95 : 0.68).fillCircle(node.x, 280, node.active ? 12 : 9);
    route.lineStyle(2, node.active ? 0xffe4a0 : 0x667181, 0.7).strokeCircle(node.x, 280, node.active ? 12 : 9);
    layer.add(addText(scene, node.x, 306, node.label, compact ? 18 : 15, node.active ? '#e8edf4' : '#7f8996', 'center').setOrigin(0.5));
  });
  layer.add(route);

  layer.add(addSectionHeading(scene, 245, 355, '팀전 규칙', 790, 0x7b745f));
  layer.add(addText(scene, 270, 397, '각 지휘관 5칸 편성 · 개인 보급/보급소', compact ? 20 : 17, '#c7d2df'));
  layer.add(addText(scene, 270, 435, '팀 거점과 거점 병기 공유 · 팀 유닛 상한 55', compact ? 20 : 17, '#c7d2df'));
  layer.add(addText(scene, 270, 473, '일반 팀전은 시즌 평점과 티어에 영향을 주지 않습니다.', compact ? 18 : 15, COLORS.muted));
  layer.add(addText(scene, 640, 545, scene.state.state === 'MATCHED' ? '전투 연결 준비 완료' : scene.state.state === 'PAIRING' ? '양 팀 구성을 확정하는 중…' : scene.state.state === 'QUEUED' ? '함께 싸울 지휘관과 상대 팀을 찾고 있습니다…' : '대기열에 참가할 준비가 되었습니다.', compact ? 21 : 18, state.kind === 'online' ? COLORS.green : '#e0c98f', 'center').setOrigin(0.5));
}

function screenX(anchorX: number): number {
  return FIELD_LEFT + Phaser.Math.Clamp(anchorX / PVP_ARENA_TEAM_V1.mapLength, 0, 1) * (FIELD_RIGHT - FIELD_LEFT);
}

function cooldownSeconds(frames: number): number {
  return Math.max(1, Math.ceil(Math.max(0, frames) / 30));
}

function teamForSeat(seatId: string | null | undefined): TeamId | null {
  if (seatId?.startsWith('A')) return 'A';
  if (seatId?.startsWith('B')) return 'B';
  return null;
}

function teamWeaponName(id: string | null): string {
  if (id === 'base_weapon_aegis_emitter') return '결계발진기';
  if (id === 'base_weapon_supply_drop') return '보급낙하기';
  if (id === null) return '팀 거점 병기 없음';
  return '전선포격기';
}

function drawTeamBase(scene: Phaser.Scene, x: number, own: boolean, left: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const accent = own ? 0x72b7db : 0xd97973;
  const body = own ? 0x284152 : 0x4d2e33;
  g.fillStyle(0x070b10, 0.36).fillEllipse(x, 480, 106, 20);
  g.fillStyle(body, 0.98).fillRect(x - 34, 340, 68, 140);
  g.lineStyle(3, accent, 0.76).strokeRect(x - 34, 340, 68, 140);
  g.fillStyle(accent, 0.85).fillTriangle(left ? x - 34 : x + 34, 340, left ? x + 24 : x - 24, 308, left ? x + 24 : x - 24, 372);
  g.fillStyle(0x111820, 0.96).fillRect(x - 13, 416, 26, 64);
  return g;
}

function renderBattle(scene: BattleCarrier): void {
  scene.battlefield?.destroy(true);
  scene.battlefield = scene.add.container(0, 0);
  const layer = scene.battlefield;
  const snapshot = scene.snapshot;
  const compact = isCompactMobileViewport();
  if (!snapshot) {
    layer.add(addText(scene, 640, 330, '팀 전선을 불러오는 중…', compact ? 27 : 23, '#b6c0ce', 'center').setOrigin(0.5));
    return;
  }

  const mineSeat = scene.session?.seatId;
  const mineTeam = teamForSeat(mineSeat);
  const aOwn = mineTeam === 'A';
  const bOwn = mineTeam === 'B';
  const aRatio = Phaser.Math.Clamp(snapshot.bases.aHp / Math.max(1, snapshot.bases.aMaxHp), 0, 1);
  const bRatio = Phaser.Math.Clamp(snapshot.bases.bHp / Math.max(1, snapshot.bases.bMaxHp), 0, 1);

  const board = scene.add.graphics();
  board.fillStyle(0x111820, 0.78).fillRect(36, 112, 1208, 414);
  board.lineStyle(2, 0x58687b, 0.55).strokeRect(36, 112, 1208, 414);
  board.fillStyle(0x182430, 0.78).fillRect(52, 190, 1176, 320);
  board.fillStyle(0x202a25, 0.72).fillRect(52, 392, 1176, 118);
  for (const fraction of [0.25, 0.5, 0.75]) {
    const x = FIELD_LEFT + (FIELD_RIGHT - FIELD_LEFT) * fraction;
    board.lineStyle(fraction === 0.5 ? 2 : 1, 0xd4c5a5, fraction === 0.5 ? 0.28 : 0.14).lineBetween(x, 406, x, 500);
  }
  layer.add(board);

  layer.add(addText(scene, 70, 128, `${aOwn ? '우리 팀' : '상대 팀'} 거점 · ${snapshot.bases.aHp.toLocaleString()} / ${snapshot.bases.aMaxHp.toLocaleString()}`, battleUiFontSize(14, 18), aOwn ? '#bfe6ff' : '#ffc4bd'));
  layer.add(addText(scene, 1210, 128, `${bOwn ? '우리 팀' : '상대 팀'} 거점 · ${snapshot.bases.bHp.toLocaleString()} / ${snapshot.bases.bMaxHp.toLocaleString()}`, battleUiFontSize(14, 18), bOwn ? '#bfe6ff' : '#ffc4bd', 'right').setOrigin(1, 0));
  layer.add(scene.add.rectangle(70, 164, 430, 14, 0x0b1016, 0.92).setOrigin(0, 0.5).setStrokeStyle(1, 0x64788e, 0.75));
  layer.add(scene.add.rectangle(70, 164, Math.max(1, 430 * aRatio), 8, aOwn ? 0x72b7db : 0xd97973, 0.95).setOrigin(0, 0.5));
  layer.add(scene.add.rectangle(780, 164, 430, 14, 0x0b1016, 0.92).setOrigin(0, 0.5).setStrokeStyle(1, 0x64788e, 0.75));
  layer.add(scene.add.rectangle(1210, 164, Math.max(1, 430 * bRatio), 8, bOwn ? 0x72b7db : 0xd97973, 0.95).setOrigin(1, 0.5));
  layer.add(drawTeamBase(scene, 90, aOwn, true));
  layer.add(drawTeamBase(scene, 1190, bOwn, false));

  const living = snapshot.units.filter((unit) => unit.state !== 'DYING');
  const aFront = Math.max(0, ...living.filter((unit) => unit.teamId === 'A').map((unit) => unit.anchorX));
  const bAnchors = living.filter((unit) => unit.teamId === 'B').map((unit) => unit.anchorX);
  const bFront = bAnchors.length > 0 ? Math.min(...bAnchors) : PVP_ARENA_TEAM_V1.mapLength;
  const contact = Phaser.Math.Clamp((aFront + bFront) / 2, 0, PVP_ARENA_TEAM_V1.mapLength);
  const contactX = screenX(contact);
  board.lineStyle(5, 0x0b1016, 0.55).lineBetween(FIELD_LEFT, 503, FIELD_RIGHT, 503);
  board.lineStyle(3, aOwn ? 0x72b7db : 0xd97973, 0.54).lineBetween(FIELD_LEFT, 503, contactX, 503);
  board.lineStyle(3, bOwn ? 0x72b7db : 0xd97973, 0.54).lineBetween(contactX, 503, FIELD_RIGHT, 503);
  board.fillStyle(0xe5c56b, 0.92).fillTriangle(contactX, 495, contactX - 8, 508, contactX + 8, 508);

  living.forEach((unit) => {
    const x = screenX(unit.anchorX);
    const ownerOffset = unit.ownerSeatId === mineSeat ? -8 : 8;
    const laneOffset = ((unit.simulationId % 3) - 1) * 9 + ownerOffset;
    const y = 423 + laneOffset;
    const ownUnit = unit.ownerSeatId === mineSeat;
    const ownTeam = unit.teamId === mineTeam;
    const art = familyForUnit(unit.definitionId);
    const shadow = scene.add.ellipse(x, y + 31, 52 * Math.min(1.4, art.displayScale), 10, 0x070a0e, 0.34).setDepth(2);
    const sprite = scene.add.sprite(x, y, art.family.idle.key, 0).setTint(art.tint).setDepth(3);
    sprite.setFlipX(unit.teamId === 'B');
    const targetHeight = compact ? 60 : 54;
    sprite.setScale((targetHeight / art.family.idle.frameHeight) * art.displayScale);
    const hpRatio = Phaser.Math.Clamp(unit.hp / Math.max(1, unit.maxHp), 0, 1);
    const hpBg = scene.add.rectangle(x, y - 39, 48, 6, 0x11161d, 0.95).setDepth(4);
    const hpColor = ownUnit ? 0x8ce1b0 : ownTeam ? 0x78b7dc : 0xf1837c;
    const hp = scene.add.rectangle(x - 23, y - 39, Math.max(1, 46 * hpRatio), 4, hpColor, 0.98).setOrigin(0, 0.5).setDepth(5);
    layer.add([shadow, sprite, hpBg, hp]);
    if (ownUnit) {
      layer.add(scene.add.rectangle(x, y + 39, 24, 3, 0xf0d67d, 0.92).setDepth(5));
    }
  });

  const secondsLeft = Math.max(0, Math.ceil((snapshot.timeLimitFrames - snapshot.tick) / 30));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  layer.add(addText(scene, 640, 181, `${minutes}:${seconds}`, battleUiFontSize(18, 23), secondsLeft <= 60 ? '#ffb58f' : '#e0e7ef', 'center').setOrigin(0.5));
  layer.add(addText(scene, 640, 208, '남은 시간', battleUiFontSize(11, 14), COLORS.dim, 'center').setOrigin(0.5));

  const mine = snapshot.seats.find((seat) => seat.seatId === mineSeat);
  const partner = snapshot.seats.find((seat) => seat.teamId === mineTeam && seat.seatId !== mineSeat);
  if (mine) layer.add(addText(scene, 70, 518, `내 보급 ${mine.supply.toLocaleString()} / ${mine.maxSupply.toLocaleString()} · 보급소 Lv.${mine.supplyLevel}`, battleUiFontSize(13, 17), '#f0d67d'));
  if (partner) layer.add(addText(scene, 1210, 518, `팀원 보급 ${partner.supply.toLocaleString()} / ${partner.maxSupply.toLocaleString()} · 보급소 Lv.${partner.supplyLevel}`, battleUiFontSize(12, 15), '#b8c8d9', 'right').setOrigin(1, 0));
  const pressure = mineTeam === 'B' ? 1 - contact / PVP_ARENA_TEAM_V1.mapLength : contact / PVP_ARENA_TEAM_V1.mapLength;
  layer.add(addText(scene, 640, 518, pressure >= 0.58 ? '우리 팀 전선 우세' : pressure <= 0.42 ? '상대 팀 압박' : '전선 교착', battleUiFontSize(12, 15), pressure >= 0.58 ? '#bfe6ff' : pressure <= 0.42 ? '#ffc1b8' : '#f0d99b', 'center').setOrigin(0.5));
}

function renderControls(scene: BattleCarrier): void {
  scene.controls?.destroy(true);
  scene.controls = scene.add.container(0, 0);
  const layer = scene.controls;
  const snapshot = scene.snapshot;
  const seatId = scene.session?.seatId;
  if (!snapshot || !seatId || scene.finished) return;
  const seat = snapshot.seats.find((entry) => entry.seatId === seatId);
  if (!seat) return;
  const team = snapshot.teams.find((entry) => entry.teamId === seat.teamId);
  const compact = isCompactMobileViewport();
  const minimumTouch = compact ? getCurrentMinimumInternalTouchTarget() : 0;
  const slotIds = Object.keys(seat.costs).slice(0, 5);
  const slotWidth = compact ? Math.max(142, minimumTouch) : 164;
  const slotHeight = compact ? Math.max(82, minimumTouch) : 72;
  const gap = compact ? 8 : 10;
  const firstX = 20 + slotWidth / 2;
  const y = compact ? 640 : 642;

  const panel = scene.add.graphics();
  panel.fillStyle(0x0b1017, 0.96).fillRect(0, 588, 1280, 132);
  panel.lineStyle(3, 0x536175, 0.62).lineBetween(0, 590, 1280, 590);
  layer.add(panel);

  slotIds.forEach((slotId, index) => {
    const x = firstX + index * (slotWidth + gap);
    const info = getSlotById(slotId);
    const cooldown = seat.cooldowns[slotId] ?? 0;
    const cost = seat.costs[slotId] ?? 0;
    const available = cooldown <= 0 && seat.supply >= cost;
    const name = info?.displayName ?? '소환 동료';
    const label = cooldown > 0 ? `${name}\n${cooldownSeconds(cooldown)}초` : `${name}\n◆${cost}`;
    const button = addButton(scene, x, y, slotWidth, slotHeight, label, () => {
      if (available) scene.session?.queueCommand({ type: 'SPAWN', slotId });
    }, available ? 0x5f86aa : 0x48515e, { tone: available ? 'primary' : 'quiet' });
    layer.add(button);
    if (!compact) layer.add(addText(scene, x + slotWidth / 2 - 12, y - slotHeight / 2 + 7, String(index + 1), 11, '#c9d5e3', 'right').setOrigin(1, 0).setDepth(20));
    if (cooldown > 0) setButtonState(button, 'disabled', `재사용까지 ${cooldownSeconds(cooldown)}초 남았습니다.`);
    else if (seat.supply < cost) setButtonState(button, 'disabled', `보급이 ${(cost - seat.supply).toLocaleString()} 부족합니다.`);
  });

  const commandsLeft = firstX + slotIds.length * (slotWidth + gap) + 6;
  const commandWidth = compact ? Math.max(190, minimumTouch * 1.35) : 190;
  const canUpgrade = seat.nextSupplyUpgradeCost !== null && seat.supply >= seat.nextSupplyUpgradeCost;
  const upgrade = addButton(scene, commandsLeft + commandWidth / 2, y, commandWidth, slotHeight, seat.nextSupplyUpgradeCost === null ? '보급소\n최대 단계' : `보급소 강화\n◆${seat.nextSupplyUpgradeCost}`, () => {
    if (canUpgrade) scene.session?.queueCommand({ type: 'UPGRADE_SUPPLY' });
  }, canUpgrade ? 0x8b773f : 0x4f5050, { tone: canUpgrade ? 'primary' : 'quiet' });
  layer.add(upgrade);
  if (seat.nextSupplyUpgradeCost === null) setButtonState(upgrade, 'disabled', '보급소가 최대 단계입니다.');
  else if (seat.supply < seat.nextSupplyUpgradeCost) setButtonState(upgrade, 'disabled', `보급이 ${(seat.nextSupplyUpgradeCost - seat.supply).toLocaleString()} 부족합니다.`);

  const weaponX = commandsLeft + commandWidth + 10 + commandWidth / 2;
  const weaponReady = Boolean(team?.baseWeaponId) && (team?.baseWeaponCooldownFrames ?? 1) === 0;
  const weaponLabel = !team?.baseWeaponId
    ? '팀 거점 병기\n장착 없음'
    : (team.baseWeaponCooldownFrames ?? 0) > 0
      ? `${teamWeaponName(team.baseWeaponId)}\n${cooldownSeconds(team.baseWeaponCooldownFrames)}초`
      : `${teamWeaponName(team.baseWeaponId)}\n팀 사용 가능`;
  const weapon = addButton(scene, weaponX, y, commandWidth, slotHeight, weaponLabel, () => {
    if (weaponReady) scene.session?.queueCommand({ type: 'FIRE_BASE_WEAPON' });
  }, weaponReady ? 0x587f98 : 0x4d535d, { tone: weaponReady ? 'primary' : 'quiet' });
  layer.add(weapon);
  if (!team?.baseWeaponId) setButtonState(weapon, 'disabled', '팀에 장착된 거점 병기가 없습니다.');
  else if (team.baseWeaponCooldownFrames > 0) setButtonState(weapon, 'disabled', `재사용까지 ${cooldownSeconds(team.baseWeaponCooldownFrames)}초 남았습니다.`);
}

function showResult(scene: BattleCarrier, result: 'A' | 'B' | 'DRAW', reason: string): void {
  if (scene.finished) return;
  scene.finished = true;
  scene.session?.stopInputPump();
  const mineTeam = teamForSeat(scene.session?.seatId) ?? 'A';
  const draw = result === 'DRAW';
  const won = !draw && result === mineTeam;
  const friendly = scene.modeId === 'pvp_friendly_2v2';
  scene.resultLayer?.destroy(true);
  scene.resultLayer = scene.add.container(0, 0).setDepth(400);
  const compact = isCompactMobileViewport();
  scene.resultLayer.add(scene.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.86).setInteractive());
  scene.resultLayer.add(addCommandPanel(scene, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 760, 410, draw ? 0x777d88 : won ? 0x69a87b : 0xa86464, 0x202632, 0.99));
  scene.resultLayer.add(addText(scene, INTERNAL_WIDTH / 2, 250, draw ? '2v2 무승부' : won ? '우리 팀 승리' : '우리 팀 패배', compact ? 48 : 42, draw ? '#d8dde5' : won ? '#bdf1c7' : '#ffb0a9', 'center').setOrigin(0.5));
  const reasonText = reason === 'FORFEIT' ? '재접속 유예 종료로 승부 확정' : reason === 'TIME_LIMIT' ? '제한 시간 종료 판정' : '팀전 결과 확정';
  scene.resultLayer.add(addText(scene, INTERNAL_WIDTH / 2, 318, `${friendly ? '친선 팀전 · 전적과 보상 변동 없음' : '일반 팀전'} · ${reasonText}`, compact ? 20 : 17, '#c2ccd8', 'center').setOrigin(0.5));
  scene.resultLayer.add(addButton(scene, 505, 435, 220, compact ? 82 : 60, '대전 전선', () => { scene.session?.close(); scene.scene.start('pvp-hub'); }, 0x5f7897, { tone: 'quiet' }));
  scene.resultLayer.add(addButton(scene, 775, 435, 240, compact ? 82 : 60, friendly ? '새 친선방' : '2v2 다시 매칭', () => { scene.session?.close(); scene.scene.start(scene.nextScene); }, 0x6b7799, { tone: 'primary' }));
}

function showVoid(scene: BattleCarrier, _reason: string): void {
  if (scene.finished) return;
  scene.finished = true;
  scene.session?.stopInputPump();
  scene.resultLayer?.destroy(true);
  scene.resultLayer = scene.add.container(0, 0).setDepth(400);
  const compact = isCompactMobileViewport();
  scene.resultLayer.add(scene.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.86).setInteractive());
  scene.resultLayer.add(addCommandPanel(scene, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 720, 350, 0x777d88, 0x202632, 0.99));
  scene.resultLayer.add(addText(scene, INTERNAL_WIDTH / 2, 285, '2v2 경기 무효', compact ? 44 : 39, '#d8dde5', 'center').setOrigin(0.5));
  scene.resultLayer.add(addText(scene, INTERNAL_WIDTH / 2, 350, '연결 상태를 확정할 수 없어 이번 경기는 전적에 반영되지 않습니다.', compact ? 19 : 16, '#b9c3d0', 'center').setOrigin(0.5));
  scene.resultLayer.add(addButton(scene, INTERNAL_WIDTH / 2, 440, 260, compact ? 82 : 60, scene.modeId === 'pvp_friendly_2v2' ? '새 친선방' : '2v2 다시 매칭', () => { scene.session?.close(); scene.scene.start(scene.nextScene); }, 0x6b7799, { tone: 'primary' }));
}

function installMatchmakingPresentation(scene: Phaser.Scene): void {
  const carrier = scene as unknown as MatchmakingCarrier & { [MATCH_INSTALLED]?: boolean };
  if (carrier[MATCH_INSTALLED] || typeof carrier.render !== 'function') return;
  carrier[MATCH_INSTALLED] = true;
  carrier.render = (): void => renderMatchmaking(carrier);
}

function installBattlePresentation(scene: Phaser.Scene): void {
  const carrier = scene as unknown as BattleCarrier & { [BATTLE_INSTALLED]?: boolean };
  if (carrier[BATTLE_INSTALLED] || typeof carrier.renderBattle !== 'function' || typeof carrier.renderControls !== 'function') return;
  carrier[BATTLE_INSTALLED] = true;
  carrier.renderBattle = (): void => renderBattle(carrier);
  carrier.renderControls = (): void => renderControls(carrier);
  carrier.showResult = (result, reason): void => showResult(carrier, result, reason);
  carrier.showVoid = (reason): void => showVoid(carrier, reason);
}

export class Pvp2v2MatchmakingScene extends BasePvp2v2MatchmakingScene {
  override create(): void {
    installMatchmakingPresentation(this);
    super.create();
    const carrier = this as unknown as MatchmakingCarrier;
    installStatusSanitizer(carrier.status);
  }
}

export class Pvp2v2BattleScene extends BasePvp2v2BattleScene {
  override create(): void {
    installBattlePresentation(this);
    super.create();
    const carrier = this as unknown as BattleCarrier;
    installStatusSanitizer(carrier.status);
  }
}
