import Phaser from 'phaser';
import { SocialScene } from './social-scene.ts';
import type { SocialSummary } from './social-network.ts';
import { setButtonState } from './scene-ui.ts';

type SocialTab = 'FRIENDS' | 'REQUESTS' | 'RECENT' | 'BLOCKED';

type SocialPresentationCarrier = Phaser.Scene & {
  tab?: SocialTab;
  page?: number;
  summary?: SocialSummary | null;
  render?: () => void;
};

const TAB_BY_X: ReadonlyArray<readonly [number, SocialTab]> = [
  [185, 'FRIENDS'],
  [405, 'REQUESTS'],
  [625, 'RECENT'],
  [845, 'BLOCKED'],
];

/** Keeps SocialScene's server authority intact while presenting it as an in-game contact roster. */
export class SocialCommandScene extends SocialScene {
  private restoreSocialRender: (() => void) | undefined;

  override create(): void {
    const factory = this.add;
    const originalText = factory.text;
    const wrappedText: typeof originalText = (x, y, text, style) => {
      const value = this.sanitizePlayerFacingText(text);
      const created = originalText.call(factory, x, y, value, style);
      this.decorateText(created);
      this.installDynamicTextSanitizer(created);
      return created;
    };
    factory.text = wrappedText;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      factory.text = originalText;
      this.restoreSocialRender?.();
      this.restoreSocialRender = undefined;
    });

    super.create();
    this.installCommandChromeSync();
    this.polishSocialGeometry();
  }

  private installDynamicTextSanitizer(text: Phaser.GameObjects.Text): void {
    const originalSetText = text.setText.bind(text);
    text.setText = ((value: string | string[]) => {
      const result = originalSetText(this.sanitizePlayerFacingText(value));
      this.decorateText(text);
      return result;
    }) as typeof text.setText;
  }

  private decorateText(text: Phaser.GameObjects.Text): void {
    if (text.text === '전우 연락망') text.setPosition(48, 28).setFontSize(44);
    else if (text.text === '친구를 관리하고 협동·친선전 초대를 주고받습니다.') text.setPosition(50, 77).setColor('#9da8b7');
    else if (text.text === '친구 추가' || text.text === '이름 변경') text.setFontSize(Math.min(Number(text.style.fontSize ?? 16), 16));
    else if (text.text === '요청' || text.text === '최근') text.setFontSize(Math.min(Number(text.style.fontSize ?? 16), 16));
    else if (text.text.includes('프로필 장식 적용')) text.setColor('#9eabb8');
  }

  private installCommandChromeSync(): void {
    const carrier = this as unknown as SocialPresentationCarrier;
    const originalRender = carrier.render;
    if (!originalRender) {
      this.syncCommandChrome();
      this.polishSocialGeometry();
      return;
    }

    carrier.render = () => {
      originalRender.call(this);
      this.syncCommandChrome();
      this.polishSocialGeometry();
    };
    this.restoreSocialRender = () => { carrier.render = originalRender; };
    this.syncCommandChrome();
  }

  private syncCommandChrome(): void {
    const carrier = this as unknown as SocialPresentationCarrier;
    const currentTab = carrier.tab ?? 'FRIENDS';

    for (const [x, tab] of TAB_BY_X) {
      const button = this.findRootCommandButton(x, 172);
      if (button) setButtonState(button, tab === currentTab ? 'selected' : 'default');
    }

    const previous = this.findRootCommandButton(1030, 172);
    const next = this.findRootCommandButton(1135, 172);
    const page = Math.max(0, carrier.page ?? 0);
    const pageCount = this.currentPageCount(carrier.summary ?? null, currentTab);

    if (previous) setButtonState(previous, page <= 0 ? 'disabled' : 'default', page <= 0 ? '첫 번째 목록 페이지입니다.' : undefined);
    if (next) setButtonState(next, page >= pageCount - 1 ? 'disabled' : 'default', page >= pageCount - 1 ? '마지막 목록 페이지입니다.' : undefined);
  }

  private polishSocialGeometry(): void {
    const visit = (object: Phaser.GameObjects.GameObject): void => {
      if (object instanceof Phaser.GameObjects.Rectangle) {
        if (object.width >= 1100 && object.height >= 70 && object.height <= 90) {
          object.setFillStyle(0x1a222d, 0.88).setStrokeStyle(1, 0x526173, 0.5);
        }
      }
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
    };
    this.children.list.forEach(visit);
  }

  private currentPageCount(summary: SocialSummary | null, tab: SocialTab): number {
    if (!summary) return 1;
    let count = 0;
    if (tab === 'FRIENDS') count = summary.friends.length;
    else if (tab === 'RECENT') count = summary.recentPlayers.length;
    else if (tab === 'BLOCKED') count = summary.blocked.length;
    else {
      count = summary.incomingRequests.length
        + summary.outgoingRequests.length
        + summary.coopInvites.length
        + summary.pvpInvites.length
        + summary.pvp2v2Invites.length;
    }
    return Math.max(1, Math.ceil(count / 4));
  }

  private findRootCommandButton(x: number, y: number): Phaser.GameObjects.Container | undefined {
    return this.children.list.find((child): child is Phaser.GameObjects.Container => (
      child instanceof Phaser.GameObjects.Container
      && Math.abs(child.x - x) < 2
      && Math.abs(child.y - y) < 2
      && child.getData('frontlineCommandButton') !== undefined
    ));
  }

  private sanitizePlayerFacingText(value: string | string[]): string | string[] {
    if (Array.isArray(value)) return value.map((entry) => this.sanitizePlayerFacingLine(entry));
    return this.sanitizePlayerFacingLine(value);
  }

  private sanitizePlayerFacingLine(text: string): string {
    const direct: Readonly<Record<string, string>> = {
      '친구 · 협동 · 친선전': '전우 연락망',
      '친구 코드는 계정 식별용 · 자유 채팅 없음 · 차단 우선': '친구를 관리하고 협동·친선전 초대를 주고받습니다.',
      '친구 코드 추가': '친구 추가',
      '닉네임 변경': '이름 변경',
      '요청·초대': '요청',
      '최근 플레이어': '최근',
      '온라인 소셜 동기화 완료': '연락망 동기화 완료',
      '소셜 정보 불러오는 중…': '연락망 불러오는 중…',
    };
    if (direct[text]) return direct[text]!;

    const sanitized = text
      .replace(/^내 상태 (온라인|오프라인) · 프레임 .+$/, '내 상태 $1 · 프로필 장식 적용')
      .replace(/\b(?:main|special)_[a-z0-9_]+\b/gi, '알 수 없는 전장');

    if (/HTTP_\d+|state hash|revision|requestId|matchId|seatId/i.test(sanitized)) {
      return '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
    }
    if (/(?:^|\s)(?:social|friendly|pvp|coop|account)_[a-z0-9_]+/i.test(sanitized)) {
      return '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
    }
    return sanitized;
  }
}
