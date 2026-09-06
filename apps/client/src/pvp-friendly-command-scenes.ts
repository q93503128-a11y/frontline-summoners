import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { PVP_ARENA_DUEL_V1 } from '@frontline/sim/pvp-arena-content';
import {
  FriendlyPvpLobbyScene as BaseFriendlyPvpLobbyScene,
  FriendlyPvpMatchScene as BaseFriendlyPvpMatchScene,
} from './pvp-friendly-scenes.ts';
import type { FriendlyPvpGrowthPolicy, FriendlyPvpLobbyState } from './pvp-friendly-network.ts';
import type { PvpBattleSnapshot, PvpSession } from './pvp-network.ts';
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

interface FriendlyLobbyCarrier extends Phaser.Scene {
  growthPolicy: FriendlyPvpGrowthPolicy;
  lobby: FriendlyPvpLobbyState | null;
  socialInviteId: string | null;
  content?: Phaser.GameObjects.Container;
  status?: Phaser.GameObjects.Text;
  pending: boolean;
  render(): void;
  createLobby(): Promise<void>;
  joinByPrompt(): Promise<void>;
  copyCode(code: string): Promise<void>;
  cancelLobby(): Promise<void>;
}

interface FriendlyMatchCarrier extends Phaser.Scene {
  growthPolicy: FriendlyPvpGrowthPolicy;
  session: PvpSession | null;
  snapshot: PvpBattleSnapshot | null;
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

const LOBBY_INSTALLED = Symbol('friendly-duel-command-lobby-installed');
const MATCH_INSTALLED = Symbol('friendly-duel-command-match-installed');
const FIELD_LEFT = 112;
const FIELD_RIGHT = 1168;

function growthName(policy: FriendlyPvpGrowthPolicy): string {
  return policy === 'ACTUAL' ? '실제 성장' : '표준 성장';
}

function sanitizeFriendlyStatus(value: string): string {
  if (/30Hz|서버 권위/i.test(value)) return '친선전 진행 중';
  if (/MMR 변화 없음/i.test(value)) return '친선전 기록 저장 완료 · 시즌 평점 변화 없음';
  if (/친선전 서버에 연결/i.test(value)) return '친선전을 연결하는 중…';
  if (/친선전 좌석 정보/.test(value)) return '친선전 참가 정보를 찾지 못했습니다. 로비에서 다시 시작해 주세요.';
  if (/^[a-z0-9_]+$/i.test(value) || /HTTP_|state hash|seatId|matchId/i.test(value)) return '친선전 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
  return value;
}

function installStatusSanitizer(status: Phaser.GameObjects.Text | undefined): void {
  if (!status) return;
  const originalSetText = status.setText.bind(status);
  status.setText(sanitizeFriendlyStatus(status.text));
  status.setText = ((value: string | string[]) => {
    const next = Array.isArray(value) ? value.map((entry) => sanitizeFriendlyStatus(entry)) : sanitizeFriendlyStatus(value);
    return originalSetText(next);
  }) as typeof status.setText;
}

function renderLobby(scene: FriendlyLobbyCarrier): void {
  scene.content?.destroy(true);
  scene.content = scene.add.container(0, 0);
  const layer = scene.content;
  const compact = isCompactMobileViewport();
  const lobby = scene.lobby;

  layer.add(addCommandPanel(scene, INTERNAL_WIDTH / 2, 366, 1030, 470, 0x756b91, 0x202630, 0.95));
  layer.add(addSectionHeading(scene, 150, 150, '결투 서약서', 980, 0x756b91));

  if (!lobby || lobby.state !== 'WAITING') {
    layer.add(addStatusPill(scene, 170, 192, '규칙 선택', 'neutral'));
    layer.add(addText(scene, 180, 230, '성장 규칙', compact ? 27 : 23, '#fff4cf'));
    layer.add(addText(scene, 180, 270, '친선전은 시즌 평점·티어·보상에 영향을 주지 않습니다.', compact ? 18 : 15, COLORS.muted));

    const standardized = addButton(scene, 390, 360, 390, compact ? 114 : 96, '표준 성장\nLv50 · +0 · 영구 전투보너스 미적용', () => {
      if (scene.pending) return;
      scene.growthPolicy = 'STANDARDIZED';
      scene.render();
    }, 0x5f86aa, { tone: 'secondary' });
    const actual = addButton(scene, 890, 360, 390, compact ? 114 : 96, '실제 성장\n현재 Lv · +Lv · 메인 영구보너스 적용', () => {
      if (scene.pending) return;
      scene.growthPolicy = 'ACTUAL';
      scene.render();
    }, 0x896455, { tone: 'secondary' });
    layer.add([standardized, actual]);
    setButtonState(standardized, scene.growthPolicy === 'STANDARDIZED' ? 'selected' : scene.pending ? 'disabled' : 'default');
    setButtonState(actual, scene.growthPolicy === 'ACTUAL' ? 'selected' : scene.pending ? 'disabled' : 'default');

    const explanation = scene.growthPolicy === 'STANDARDIZED'
      ? '수집한 동료와 해금 형태는 유지하고 성장 격차만 제거합니다.'
      : '서로 합의한 실제 성장 상태 그대로 겨룹니다.';
    layer.add(addText(scene, INTERNAL_WIDTH / 2, 443, explanation, compact ? 20 : 17, '#c4cfdd', 'center').setOrigin(0.5));
    layer.add(addSectionHeading(scene, 190, 495, '초대 방식', 900, 0x6e7e92));
    const create = addButton(scene, 420, 560, 330, compact ? 88 : 64, '친선방 만들기', () => { if (!scene.pending) void scene.createLobby(); }, 0x6b7799, { tone: 'primary' });
    const join = addButton(scene, 860, 560, 330, compact ? 88 : 64, '참가 코드 입력', () => { if (!scene.pending) void scene.joinByPrompt(); }, 0x78618e, { tone: 'secondary' });
    layer.add([create, join]);
    if (scene.pending) {
      setButtonState(create, 'loading', '친선전 요청을 처리하는 중입니다.');
      setButtonState(join, 'disabled', '친선전 요청이 끝난 뒤 사용할 수 있습니다.');
    }
    return;
  }

  const secondsLeft = Math.max(0, Math.ceil((lobby.expiresAtMs - Date.now()) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  layer.add(addStatusPill(scene, 170, 192, scene.socialInviteId ? '친구 수락 대기' : '참가 대기', 'warning'));
  layer.add(addText(scene, INTERNAL_WIDTH / 2, 250, scene.socialInviteId ? '친구에게 보낸 결투 요청' : '친선전 참가 표식', compact ? 28 : 24, '#e8edf4', 'center').setOrigin(0.5));
  layer.add(addText(scene, INTERNAL_WIDTH / 2, 325, lobby.inviteCode, compact ? 52 : 48, '#f0d67d', 'center').setOrigin(0.5));
  layer.add(addText(scene, INTERNAL_WIDTH / 2, 385, `${growthName(lobby.growthPolicy)} · ${minutes}:${seconds} 뒤 만료`, compact ? 21 : 18, '#cbd5e1', 'center').setOrigin(0.5));
  layer.add(addText(
    scene,
    INTERNAL_WIDTH / 2,
    440,
    scene.socialInviteId ? '친구가 요청을 수락하면 자동으로 결투가 시작됩니다.' : '상대가 참가 표식을 입력하면 자동으로 결투가 시작됩니다.',
    compact ? 19 : 16,
    '#aeb9c7',
    'center',
  ).setOrigin(0.5));
  const copy = addButton(scene, 430, 545, 300, compact ? 88 : 64, '참가 표식 복사', () => { void scene.copyCode(lobby.inviteCode); }, 0x5f7897, { tone: 'secondary' });
  const cancel = addButton(scene, 850, 545, 300, compact ? 88 : 64, '친선방 닫기', () => { void scene.cancelLobby(); }, 0x815b60, { tone: 'danger' });
  layer.add([copy, cancel]);
  if (scene.pending) {
    setButtonState(copy, 'disabled', '친선전 요청을 처리하는 중입니다.');
    setButtonState(cancel, 'loading', '친선방 상태를 갱신하는 중입니다.');
  }
}

function screenX(anchorX: number): number {
  return FIELD_LEFT + Phaser.Math.Clamp(anchorX / PVP_ARENA_DUEL_V1.mapLength, 0, 1) * (FIELD_RIGHT - FIELD_LEFT);
}

function cooldownSeconds(frames: number): number {
  return Math.max(1, Math.ceil(Math.max(0, frames) / 30));
}

function weaponName(id: string | null): string {
  if (id === 'base_weapon_aegis_emitter') return '결계발진기';
  if (id === 'base_weapon_supply_drop') return '보급낙하기';
  if (id === null) return '거점 병기 없음';
  return '전선포격기';
}

function drawBase(scene: Phaser.Scene, x: number, own: boolean, left: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const accent = own ? 0x72b7db : 0xd97973;
  const body = own ? 0x284152 : 0x4d2e33;
  g.fillStyle(0x070b10, 0.36).fillEllipse(x, 480, 100, 20);
  g.fillStyle(body, 0.98).fillRect(x - 32, 344, 64, 136);
  g.lineStyle(3, accent, 0.76).strokeRect(x - 32, 344, 64, 136);
  g.fillStyle(accent, 0.85).fillTriangle(left ? x - 32 : x + 32, 344, left ? x + 22 : x - 22, 314, left ? x + 22 : x - 22, 374);
  g.fillStyle(0x111820, 0.96).fillRect(x - 12, 420, 24, 60);
  return g;
}

function renderBattle(scene: FriendlyMatchCarrier): void {
  scene.battlefield?.destroy(true);
  scene.battlefield = scene.add.container(0, 0);
  const layer = scene.battlefield;
  const snapshot = scene.snapshot;
  const compact = isCompactMobileViewport();
  if (!snapshot) {
    layer.add(addText(scene, 640, 334, '친선 전선을 불러오는 중…', compact ? 27 : 23, '#b6c0ce', 'center').setOrigin(0.5));
    return;
  }

  const mine = scene.session?.seatId;
  const aOwn = mine === 'A';
  const bOwn = mine === 'B';
  const aRatio = Phaser.Math.Clamp(snapshot.bases.aHp / Math.max(1, snapshot.bases.aMaxHp), 0, 1);
  const bRatio = Phaser.Math.Clamp(snapshot.bases.bHp / Math.max(1, snapshot.bases.bMaxHp), 0, 1);
  const board = scene.add.graphics();
  board.fillStyle(0x111820, 0.78).fillRect(36, 112, 1208, 414);
  board.lineStyle(2, 0x6f6485, 0.58).strokeRect(36, 112, 1208, 414);
  board.fillStyle(0x1d2130, 0.78).fillRect(52, 190, 1176, 320);
  board.fillStyle(0x242524, 0.72).fillRect(52, 392, 1176, 118);
  for (const fraction of [0.25, 0.5, 0.75]) {
    const x = FIELD_LEFT + (FIELD_RIGHT - FIELD_LEFT) * fraction;
    board.lineStyle(fraction === 0.5 ? 2 : 1, 0xd4c5a5, fraction === 0.5 ? 0.28 : 0.14).lineBetween(x, 406, x, 500);
  }
  layer.add(board);

  layer.add(addText(scene, 70, 128, `${aOwn ? '내 거점' : '상대 거점'} · ${snapshot.bases.aHp.toLocaleString()} / ${snapshot.bases.aMaxHp.toLocaleString()}`, battleUiFontSize(14, 18), aOwn ? '#bfe6ff' : '#ffc4bd'));
  layer.add(addText(scene, 1210, 128, `${bOwn ? '내 거점' : '상대 거점'} · ${snapshot.bases.bHp.toLocaleString()} / ${snapshot.bases.bMaxHp.toLocaleString()}`, battleUiFontSize(14, 18), bOwn ? '#bfe6ff' : '#ffc4bd', 'right').setOrigin(1, 0));
  layer.add(scene.add.rectangle(70, 164, 430, 14, 0x0b1016, 0.92).setOrigin(0, 0.5).setStrokeStyle(1, 0x64788e, 0.75));
  layer.add(scene.add.rectangle(70, 164, Math.max(1, 430 * aRatio), 8, aOwn ? 0x72b7db : 0xd97973, 0.95).setOrigin(0, 0.5));
  layer.add(scene.add.rectangle(780, 164, 430, 14, 0x0b1016, 0.92).setOrigin(0, 0.5).setStrokeStyle(1, 0x64788e, 0.75));
  layer.add(scene.add.rectangle(1210, 164, Math.max(1, 430 * bRatio), 8, bOwn ? 0x72b7db : 0xd97973, 0.95).setOrigin(1, 0.5));
  layer.add(drawBase(scene, 90, aOwn, true));
  layer.add(drawBase(scene, 1190, bOwn, false));

  const living = snapshot.units.filter((unit) => unit.state !== 'DYING');
  const aFront = Math.max(0, ...living.filter((unit) => unit.sideId === 'A').map((unit) => unit.anchorX));
  const bAnchors = living.filter((unit) => unit.sideId === 'B').map((unit) => unit.anchorX);
  const bFront = bAnchors.length > 0 ? Math.min(...bAnchors) : PVP_ARENA_DUEL_V1.mapLength;
  const contact = Phaser.Math.Clamp((aFront + bFront) / 2, 0, PVP_ARENA_DUEL_V1.mapLength);
  const contactX = screenX(contact);
  board.lineStyle(5, 0x0b1016, 0.55).lineBetween(FIELD_LEFT, 503, FIELD_RIGHT, 503);
  board.lineStyle(3, aOwn ? 0x72b7db : 0xd97973, 0.54).lineBetween(FIELD_LEFT, 503, contactX, 503);
  board.lineStyle(3, bOwn ? 0x72b7db : 0xd97973, 0.54).lineBetween(contactX, 503, FIELD_RIGHT, 503);
  board.fillStyle(0xe5c56b, 0.92).fillTriangle(contactX, 495, contactX - 8, 508, contactX + 8, 508);

  living.forEach((unit) => {
    const x = screenX(unit.anchorX);
    const y = 424 + ((unit.simulationId % 3) - 1) * 11;
    const own = unit.sideId === mine;
    const art = familyForUnit(unit.definitionId);
    const shadow = scene.add.ellipse(x, y + 31, 52 * Math.min(1.4, art.displayScale), 10, 0x070a0e, 0.34).setDepth(2);
    const sprite = scene.add.sprite(x, y, art.family.idle.key, 0).setTint(art.tint).setDepth(3);
    sprite.setFlipX(unit.sideId === 'B');
    const targetHeight = compact ? 62 : 56;
    sprite.setScale((targetHeight / art.family.idle.frameHeight) * art.displayScale);
    const hpRatio = Phaser.Math.Clamp(unit.hp / Math.max(1, unit.maxHp), 0, 1);
    const hpBg = scene.add.rectangle(x, y - 40, 50, 6, 0x11161d, 0.95).setDepth(4);
    const hp = scene.add.rectangle(x - 24, y - 40, Math.max(1, 48 * hpRatio), 4, own ? 0x78dca0 : 0xf1837c, 0.98).setOrigin(0, 0.5).setDepth(5);
    layer.add([shadow, sprite, hpBg, hp]);
  });

  const secondsLeft = Math.max(0, Math.ceil((snapshot.timeLimitFrames - snapshot.tick) / 30));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  layer.add(addText(scene, 640, 181, `${minutes}:${seconds}`, battleUiFontSize(18, 23), secondsLeft <= 60 ? '#ffb58f' : '#e0e7ef', 'center').setOrigin(0.5));
  layer.add(addText(scene, 640, 208, `${growthName(scene.growthPolicy)} · 남은 시간`, battleUiFontSize(11, 14), COLORS.dim, 'center').setOrigin(0.5));

  const mySide = snapshot.sides.find((side) => side.sideId === mine);
  const other = snapshot.sides.find((side) => side.sideId !== mine);
  if (mySide) layer.add(addText(scene, 70, 518, `내 보급 ${mySide.supply.toLocaleString()} / ${mySide.maxSupply.toLocaleString()} · 보급소 Lv.${mySide.supplyLevel}`, battleUiFontSize(13, 17), '#f0d67d'));
  if (other) layer.add(addText(scene, 1210, 518, `상대 보급 ${other.supply.toLocaleString()} / ${other.maxSupply.toLocaleString()} · 보급소 Lv.${other.supplyLevel}`, battleUiFontSize(12, 15), '#aeb9c7', 'right').setOrigin(1, 0));
  const pressure = mine === 'B' ? 1 - contact / PVP_ARENA_DUEL_V1.mapLength : contact / PVP_ARENA_DUEL_V1.mapLength;
  layer.add(addText(scene, 640, 518, pressure >= 0.58 ? '내 전선 우세' : pressure <= 0.42 ? '상대 전선 압박' : '전선 교착', battleUiFontSize(12, 15), pressure >= 0.58 ? '#bfe6ff' : pressure <= 0.42 ? '#ffc1b8' : '#f0d99b', 'center').setOrigin(0.5));
}

function renderControls(scene: FriendlyMatchCarrier): void {
  scene.controls?.destroy(true);
  scene.controls = scene.add.container(0, 0);
  const layer = scene.controls;
  const snapshot = scene.snapshot;
  const seatId = scene.session?.seatId;
  if (!snapshot || !seatId || scene.finished) return;
  const side = snapshot.sides.find((entry) => entry.sideId === seatId);
  if (!side) return;
  const compact = isCompactMobileViewport();
  const minimumTouch = compact ? getCurrentMinimumInternalTouchTarget() : 0;
  const singleWidth = Math.max(82, minimumTouch);
  const useTwoRows = compact && singleWidth * 10 + 36 > 870;
  const slotIds = Object.keys(side.costs).slice(0, 10);
  const slotWidth = useTwoRows ? 142 : singleWidth;
  const slotHeight = useTwoRows ? Math.max(86, minimumTouch) : compact ? Math.max(94, minimumTouch) : 88;
  const columns = useTwoRows ? 5 : 10;
  const gap = useTwoRows ? 8 : 4;
  const rowGap = useTwoRows ? 7 : 0;
  const bottomTop = useTwoRows ? Math.max(538, 720 - (slotHeight * 2 + rowGap + 8)) : 596;
  const firstY = bottomTop + 7 + slotHeight / 2;
  const panel = scene.add.graphics();
  panel.fillStyle(0x0b1017, 0.96).fillRect(0, bottomTop, 1280, 720 - bottomTop);
  panel.lineStyle(3, 0x6f6485, 0.62).lineBetween(0, bottomTop + 2, 1280, bottomTop + 2);
  layer.add(panel);

  slotIds.forEach((slotId, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = 20 + slotWidth / 2 + col * (slotWidth + gap);
    const y = firstY + row * (slotHeight + rowGap);
    const cooldown = side.cooldowns[slotId] ?? 0;
    const cost = side.costs[slotId] ?? 0;
    const name = getSlotById(slotId)?.displayName ?? '소환 동료';
    const available = cooldown <= 0 && side.supply >= cost;
    const button = addButton(scene, x, y, slotWidth - 2, slotHeight, cooldown > 0 ? `${name}\n${cooldownSeconds(cooldown)}초` : `${name}\n◆${cost}`, () => {
      if (available) scene.session?.queueCommand({ type: 'SPAWN', slotId });
    }, available ? 0x5f86aa : 0x48515e, { tone: available ? 'primary' : 'quiet' });
    layer.add(button);
    if (!compact) {
      const key = index === 9 ? '0' : String(index + 1);
      layer.add(addText(scene, x + slotWidth / 2 - 14, y - slotHeight / 2 + 7, key, 11, '#c9d5e3', 'right').setOrigin(1, 0).setDepth(20));
    }
    if (cooldown > 0) setButtonState(button, 'disabled', `재사용까지 ${cooldownSeconds(cooldown)}초 남았습니다.`);
    else if (side.supply < cost) setButtonState(button, 'disabled', `보급이 ${(cost - side.supply).toLocaleString()} 부족합니다.`);
  });

  const commandY = useTwoRows ? (bottomTop + 720) / 2 : 652;
  const commandHeight = useTwoRows ? Math.max(116, minimumTouch) : compact ? Math.max(94, minimumTouch) : 88;
  const supplyX = useTwoRows ? 890 : 963;
  const supplyWidth = useTwoRows ? 214 : 160;
  const weaponX = useTwoRows ? 1142 : 1155;
  const weaponWidth = useTwoRows ? 260 : 204;
  const canUpgrade = side.nextSupplyUpgradeCost !== null && side.supply >= side.nextSupplyUpgradeCost;
  const upgrade = addButton(scene, supplyX, commandY, supplyWidth, commandHeight, side.nextSupplyUpgradeCost === null ? '보급소\n최대 단계' : `보급소 강화\n◆${side.nextSupplyUpgradeCost}`, () => {
    if (canUpgrade) scene.session?.queueCommand({ type: 'UPGRADE_SUPPLY' });
  }, canUpgrade ? 0x8b773f : 0x4f5050, { tone: canUpgrade ? 'primary' : 'quiet' });
  layer.add(upgrade);
  if (side.nextSupplyUpgradeCost === null) setButtonState(upgrade, 'disabled', '보급소가 최대 단계입니다.');
  else if (side.supply < side.nextSupplyUpgradeCost) setButtonState(upgrade, 'disabled', `보급이 ${(side.nextSupplyUpgradeCost - side.supply).toLocaleString()} 부족합니다.`);

  const ready = side.baseWeaponId !== null && side.baseWeaponCooldownFrames === 0;
  const weapon = addButton(scene, weaponX, commandY, weaponWidth, commandHeight, side.baseWeaponId === null ? '거점 병기\n장착 없음' : side.baseWeaponCooldownFrames > 0 ? `${weaponName(side.baseWeaponId)}\n${cooldownSeconds(side.baseWeaponCooldownFrames)}초` : `${weaponName(side.baseWeaponId)}\n사용 가능`, () => {
    if (ready) scene.session?.queueCommand({ type: 'FIRE_BASE_WEAPON' });
  }, ready ? 0x587f98 : 0x4d535d, { tone: ready ? 'primary' : 'quiet' });
  layer.add(weapon);
  if (side.baseWeaponId === null) setButtonState(weapon, 'disabled', '장착된 거점 병기가 없습니다.');
  else if (side.baseWeaponCooldownFrames > 0) setButtonState(weapon, 'disabled', `재사용까지 ${cooldownSeconds(side.baseWeaponCooldownFrames)}초 남았습니다.`);
}

function showResult(scene: FriendlyMatchCarrier, result: 'A' | 'B' | 'DRAW', reason: string): void {
  if (scene.finished) return;
  scene.finished = true;
  scene.session?.stopInputPump();
  const mine = scene.session?.seatId;
  const draw = result === 'DRAW';
  const won = !draw && result === mine;
  scene.resultLayer?.destroy(true);
  scene.resultLayer = scene.add.container(0, 0).setDepth(400);
  const compact = isCompactMobileViewport();
  scene.resultLayer.add(scene.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.86).setInteractive());
  scene.resultLayer.add(addCommandPanel(scene, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 760, 410, draw ? 0x777d88 : won ? 0x69a87b : 0xa86464, 0x202632, 0.99));
  scene.resultLayer.add(addText(scene, 640, 250, draw ? '친선전 무승부' : won ? '친선전 승리' : '친선전 패배', compact ? 48 : 42, draw ? '#d8dde5' : won ? '#bdf1c7' : '#ffb0a9', 'center').setOrigin(0.5));
  const reasonText = reason === 'FORFEIT' ? '재접속 유예 종료로 승부 확정' : reason === 'TIME_LIMIT' ? '제한 시간 종료 판정' : '친선전 결과 확정';
  scene.resultLayer.add(addText(scene, 640, 318, `${growthName(scene.growthPolicy)} · ${reasonText}\n시즌 평점·티어·보상 변동 없음`, compact ? 20 : 17, '#c2ccd8', 'center').setOrigin(0.5));
  scene.resultLayer.add(addButton(scene, 505, 435, 220, compact ? 82 : 60, '친선 로비', () => { scene.session?.close(); scene.scene.start('pvp-friendly-lobby'); }, 0x6b7799, { tone: 'primary' }));
  scene.resultLayer.add(addButton(scene, 775, 435, 220, compact ? 82 : 60, '대전 전선', () => { scene.session?.close(); scene.scene.start('pvp-hub'); }, 0x5f7897, { tone: 'quiet' }));
}

function showVoid(scene: FriendlyMatchCarrier, _reason: string): void {
  if (scene.finished) return;
  scene.finished = true;
  scene.session?.stopInputPump();
  scene.resultLayer?.destroy(true);
  scene.resultLayer = scene.add.container(0, 0).setDepth(400);
  const compact = isCompactMobileViewport();
  scene.resultLayer.add(scene.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x080b11, 0.86).setInteractive());
  scene.resultLayer.add(addCommandPanel(scene, INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, 720, 350, 0x777d88, 0x202632, 0.99));
  scene.resultLayer.add(addText(scene, 640, 285, '친선전 무효', compact ? 44 : 39, '#d8dde5', 'center').setOrigin(0.5));
  scene.resultLayer.add(addText(scene, 640, 350, '연결 상태를 확정할 수 없어 이번 친선전은 기록되지 않습니다.', compact ? 19 : 16, '#b9c3d0', 'center').setOrigin(0.5));
  scene.resultLayer.add(addButton(scene, 640, 440, 250, compact ? 82 : 60, '친선 로비', () => { scene.session?.close(); scene.scene.start('pvp-friendly-lobby'); }, 0x6b7799, { tone: 'primary' }));
}

function installLobbyPresentation(scene: Phaser.Scene): void {
  const carrier = scene as unknown as FriendlyLobbyCarrier & { [LOBBY_INSTALLED]?: boolean };
  if (carrier[LOBBY_INSTALLED] || typeof carrier.render !== 'function') return;
  carrier[LOBBY_INSTALLED] = true;
  carrier.render = (): void => renderLobby(carrier);
}

function installMatchPresentation(scene: Phaser.Scene): void {
  const carrier = scene as unknown as FriendlyMatchCarrier & { [MATCH_INSTALLED]?: boolean };
  if (carrier[MATCH_INSTALLED] || typeof carrier.renderBattle !== 'function' || typeof carrier.renderControls !== 'function') return;
  carrier[MATCH_INSTALLED] = true;
  carrier.renderBattle = (): void => renderBattle(carrier);
  carrier.renderControls = (): void => renderControls(carrier);
  carrier.showResult = (result, reason): void => showResult(carrier, result, reason);
  carrier.showVoid = (reason): void => showVoid(carrier, reason);
}

export class FriendlyPvpLobbyScene extends BaseFriendlyPvpLobbyScene {
  override create(): void {
    installLobbyPresentation(this);
    super.create();
    const carrier = this as unknown as FriendlyLobbyCarrier;
    installStatusSanitizer(carrier.status);
  }
}

export class FriendlyPvpMatchScene extends BaseFriendlyPvpMatchScene {
  override create(): void {
    installMatchPresentation(this);
    super.create();
    const carrier = this as unknown as FriendlyMatchCarrier;
    installStatusSanitizer(carrier.status);
  }
}
