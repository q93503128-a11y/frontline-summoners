import Phaser from 'phaser';
import { INTERNAL_WIDTH } from '@frontline/shared';
import { FriendlyPvp2v2LobbyScene as BaseFriendlyPvp2v2LobbyScene } from './pvp-friendly-2v2-scene.ts';
import type { FriendlyPvp2v2LobbyState } from './pvp-friendly-2v2-network.ts';
import {
  COLORS,
  addButton,
  addCommandPanel,
  addSectionHeading,
  addStatusPill,
  addText,
  setButtonState,
} from './scene-ui.ts';
import { isCompactMobileViewport } from './viewport.ts';

interface Friendly2v2Carrier extends Phaser.Scene {
  lobby: FriendlyPvp2v2LobbyState | null;
  content?: Phaser.GameObjects.Container;
  status?: Phaser.GameObjects.Text;
  pending: boolean;
  render(): void;
  createLobby(): Promise<void>;
  joinByPrompt(): Promise<void>;
  inviteFriendByPrompt(): Promise<void>;
  copyCode(code: string): Promise<void>;
  leaveLobby(): Promise<void>;
}

const INSTALLED = Symbol('friendly-2v2-command-lobby-installed');

function sanitizeStatus(value: string): string {
  if (/좌석\s+[AB][12]|[AB][12]\s+좌석/.test(value)) return '팀 배정 완료 · 나머지 지휘관을 기다립니다.';
  if (/4명 확정.*좌석/.test(value)) return '4명의 지휘관이 모두 모였습니다. 친선 팀전으로 이동합니다.';
  if (/^[a-z0-9_]+$/i.test(value) || /HTTP_|seatId|matchId|state hash/i.test(value)) return '2v2 친선전 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
  return value;
}

function installStatusSanitizer(status: Phaser.GameObjects.Text | undefined): void {
  if (!status) return;
  const originalSetText = status.setText.bind(status);
  status.setText(sanitizeStatus(status.text));
  status.setText = ((value: string | string[]) => {
    const next = Array.isArray(value) ? value.map((entry) => sanitizeStatus(entry)) : sanitizeStatus(value);
    return originalSetText(next);
  }) as typeof status.setText;
}

function addPartyRoute(scene: Friendly2v2Carrier, layer: Phaser.GameObjects.Container, participantCount: number): void {
  const compact = isCompactMobileViewport();
  const route = scene.add.graphics();
  route.lineStyle(3, 0x536175, 0.38).lineBetween(305, 412, 975, 412);
  const labels = ['나', '팀원', '상대 1', '상대 2'];
  labels.forEach((label, index) => {
    const occupied = index < participantCount;
    const x = 305 + index * 223;
    const fill = index === 0 ? 0xd6b861 : occupied ? 0x7ec99b : 0x46515f;
    route.fillStyle(fill, occupied || index === 0 ? 0.95 : 0.66).fillCircle(x, 412, occupied || index === 0 ? 11 : 8);
    route.lineStyle(2, occupied || index === 0 ? 0xe4d5a4 : 0x65707e, 0.7).strokeCircle(x, 412, occupied || index === 0 ? 11 : 8);
    layer.add(addText(scene, x, 438, label, compact ? 17 : 14, occupied || index === 0 ? '#dce7e2' : '#7f8996', 'center').setOrigin(0.5));
  });
  layer.add(route);
}

function renderLobby(scene: Friendly2v2Carrier): void {
  scene.content?.destroy(true);
  scene.content = scene.add.container(0, 0);
  const layer = scene.content;
  const compact = isCompactMobileViewport();
  const lobby = scene.lobby;

  layer.add(addCommandPanel(scene, INTERNAL_WIDTH / 2, 365, 1000, 450, 0x6c7899, 0x19212b, 0.96));
  layer.add(addSectionHeading(scene, 165, 150, '2v2 친선전', 950, 0x6c7899));

  if (!lobby || lobby.state !== 'WAITING') {
    layer.add(addStatusPill(scene, 185, 192, '파티 구성 전', 'neutral'));
    layer.add(addText(scene, 190, 235, '4명의 지휘관이 두 팀으로 나뉘어 겨룹니다.', compact ? 24 : 20, '#eef4fb'));
    layer.add(addText(scene, 190, 277, '각자 5칸 편성 · 개인 보급/보급소 · 팀 거점/병기 공유', compact ? 18 : 15, '#c4cfdd'));
    layer.add(addText(scene, 190, 312, '표준 성장 Lv50 · +0 · 시즌 평점과 티어 변동 없음', compact ? 17 : 14, COLORS.muted));

    addPartyRoute(scene, layer, 1);

    const create = addButton(scene, 420, 548, 320, compact ? 88 : 62, '친선방 만들기', () => { if (!scene.pending) void scene.createLobby(); }, 0x5d748f, { tone: 'primary' });
    const join = addButton(scene, 860, 548, 320, compact ? 88 : 62, '참가 코드 입력', () => { if (!scene.pending) void scene.joinByPrompt(); }, 0x735d87, { tone: 'secondary' });
    layer.add([create, join]);
    if (scene.pending) {
      setButtonState(create, 'loading', '친선방 요청을 처리하는 중입니다.');
      setButtonState(join, 'disabled', '친선방 요청이 끝난 뒤 사용할 수 있습니다.');
    }
    return;
  }

  const secondsLeft = Math.max(0, Math.ceil((lobby.expiresAtMs - Date.now()) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  layer.add(addStatusPill(scene, 185, 192, `참가 ${lobby.participantCount}/4`, lobby.participantCount >= 4 ? 'online' : 'warning'));
  layer.add(addText(scene, 190, 234, lobby.host ? '내 친선방' : '참가한 친선방', compact ? 24 : 20, '#eef4fb'));
  layer.add(addText(scene, 190, 276, '참가 코드', compact ? 15 : 13, COLORS.dim));
  layer.add(addText(scene, 190, 304, lobby.inviteCode, compact ? 38 : 34, COLORS.gold));
  layer.add(addText(scene, 190, 349, `${minutes}:${seconds} 뒤 만료`, compact ? 17 : 14, '#aeb9c7'));

  addPartyRoute(scene, layer, lobby.participantCount);

  const buttons: Phaser.GameObjects.Container[] = [];
  if (lobby.host) {
    buttons.push(addButton(scene, 330, 548, 240, compact ? 84 : 60, '친구 초대', () => { if (!scene.pending) void scene.inviteFriendByPrompt(); }, 0x6f6a9a, { tone: 'primary' }));
    buttons.push(addButton(scene, 640, 548, 240, compact ? 84 : 60, '코드 복사', () => { void scene.copyCode(lobby.inviteCode); }, 0x5f7897, { tone: 'secondary' }));
    buttons.push(addButton(scene, 950, 548, 240, compact ? 84 : 60, '친선방 닫기', () => { void scene.leaveLobby(); }, 0x815b60, { tone: 'danger' }));
  } else {
    buttons.push(addButton(scene, 455, 548, 300, compact ? 84 : 60, '코드 복사', () => { void scene.copyCode(lobby.inviteCode); }, 0x5f7897, { tone: 'secondary' }));
    buttons.push(addButton(scene, 825, 548, 300, compact ? 84 : 60, '친선방 나가기', () => { void scene.leaveLobby(); }, 0x815b60, { tone: 'danger' }));
  }
  layer.add(buttons);
  if (scene.pending) for (const button of buttons) setButtonState(button, 'disabled', '친선방 상태를 갱신하는 중입니다.');
}

function installPresentation(scene: Phaser.Scene): void {
  const carrier = scene as unknown as Friendly2v2Carrier & { [INSTALLED]?: boolean };
  if (carrier[INSTALLED] || typeof carrier.render !== 'function') return;
  carrier[INSTALLED] = true;
  carrier.render = (): void => renderLobby(carrier);
}

export class FriendlyPvp2v2LobbyScene extends BaseFriendlyPvp2v2LobbyScene {
  override create(): void {
    installPresentation(this);
    super.create();
    const carrier = this as unknown as Friendly2v2Carrier;
    installStatusSanitizer(carrier.status);
  }
}
