import Phaser from 'phaser';
import {
  PublicCoopLobbyScene as BasePublicCoopLobbyScene,
  PublicCoopMatchmakingScene as BasePublicCoopMatchmakingScene,
} from './public-coop-scenes.ts';

function rewritePublicCoopLine(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    '공개 협동 매칭': '공개 협동',
    '같은 전장의 온라인 지휘관과 자동 매칭 · 계정 귀속 전투': '같은 전장을 선택한 지휘관과 자동으로 연결됩니다.',
    '공개 협동 전선': '출전 전장',
    '전장 선택 가능': '출전 준비',
    '대기열 참가 중': '상대 찾는 중',
    '상대 좌석 확정 중': '상대 연결 중',
    '상대 배정 완료': '전우 합류',
    '이 전장으로 매칭 시작': '협동 찾기',
    '공개 협동 대기열 참가를 요청하는 중…': '협동 상대를 찾기 시작하는 중…',
    '공개 협동 대기열을 취소하는 중…': '협동 찾기를 취소하는 중…',
    '전장을 고르고 공개 매칭을 시작하세요.': '전장을 고르고 협동 상대를 찾아보세요.',
    '공개 협동 로비': '협동 출전 준비',
    '자동 매칭 · 계정 편성 · 개인 보급 · 공유 기지/병기': '각자 편성 · 개인 보급 · 거점과 병기는 함께 사용',
    'PUBLIC MATCH · 계정 귀속 좌석': '공개 협동 · 출전 인원',
    '공개 매칭용 계정 귀속 방이 아닙니다.': '협동 방 정보를 확인하지 못했습니다. 다시 매칭해 주세요.',
    '매칭 화면': '협동 찾기',
  };
  if (direct[value]) return direct[value]!;
  if (/^협동 가능 전장 \d+ \/ \d+$/.test(value)) return value.replace('협동 가능 전장', '전장');
  if (/^상대 좌석을 확정하는 중/.test(value)) return '상대와 연결하는 중…';
  if (/^공개 협동 대기열/.test(value)) return value.replace('공개 협동 대기열', '협동 찾기');
  if (/^[AB]\s*지휘관/.test(value)) return value.replace(/^[AB]\s*/, '');
  if (/HTTP_|state hash|seatId|matchId|accountBound|matchKind/i.test(value)) return '협동 연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
  return value;
}

function rewritePublicCoopText(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(rewritePublicCoopLine) : rewritePublicCoopLine(value);
}

function installTextPresentation(scene: Phaser.Scene): () => void {
  const factory = scene.add;
  const originalText = factory.text;
  factory.text = ((x, y, value, style) => {
    const text = originalText.call(factory, x, y, rewritePublicCoopText(value), style);
    const originalSetText = text.setText.bind(text);
    text.setText = ((next: string | string[]) => originalSetText(rewritePublicCoopText(next))) as typeof text.setText;
    return text;
  }) as typeof factory.text;
  return () => { factory.text = originalText; };
}

export class PublicCoopMatchmakingScene extends BasePublicCoopMatchmakingScene {
  override create(): void {
    const restore = installTextPresentation(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, restore);
    super.create();
  }
}

export class PublicCoopLobbyScene extends BasePublicCoopLobbyScene {
  override create(): void {
    const restore = installTextPresentation(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, restore);
    super.create();
  }
}
