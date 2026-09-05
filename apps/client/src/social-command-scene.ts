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

/**
 * Presentation-only social adapter. SocialScene keeps all server/friend/invite/block authority;
 * this layer removes implementation vocabulary and keeps persistent navigation chrome synchronized
 * with the content state produced by the authoritative base scene.
 */
export class SocialCommandScene extends SocialScene {
  private restoreSocialRender: (() => void) | undefined;

  override create(): void {
    const factory = this.add;
    const originalText = factory.text;
    const wrappedText: typeof originalText = (x, y, text, style) => originalText.call(
      factory,
      x,
      y,
      this.sanitizePlayerFacingText(text),
      style,
    );
    factory.text = wrappedText;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      factory.text = originalText;
      this.restoreSocialRender?.();
      this.restoreSocialRender = undefined;
    });

    super.create();
    this.installCommandChromeSync();
  }

  private installCommandChromeSync(): void {
    const carrier = this as unknown as SocialPresentationCarrier;
    const originalRender = carrier.render;
    if (!originalRender) {
      this.syncCommandChrome();
      return;
    }

    carrier.render = () => {
      originalRender.call(this);
      this.syncCommandChrome();
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

    if (previous) {
      setButtonState(
        previous,
        page <= 0 ? 'disabled' : 'default',
        page <= 0 ? '첫 번째 목록 페이지입니다.' : undefined,
      );
    }
    if (next) {
      setButtonState(
        next,
        page >= pageCount - 1 ? 'disabled' : 'default',
        page >= pageCount - 1 ? '마지막 목록 페이지입니다.' : undefined,
      );
    }
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
    return text
      .replace(/^내 상태 (온라인|오프라인) · 프레임 .+$/, '내 상태 $1 · 프로필 장식 적용')
      .replace(/\b(?:main|special)_[a-z0-9_]+\b/gi, '알 수 없는 전장');
  }
}
