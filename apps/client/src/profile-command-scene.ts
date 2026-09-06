import Phaser from 'phaser';
import { ACHIEVEMENTS } from './achievement-profile.ts';
import { ProfileScene as BaseProfileScene } from './profile-scene.ts';

type ProfilePresentationCarrier = Phaser.Scene & Record<string, unknown> & {
  render?: () => void;
};

function normalize(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

function safeProfileText(value: string): string {
  if (/불러오는 중/.test(value)) return value;

  let text = value
    .replace(/제(\d+)장 마지막 전장을 NORMAL_CLEAR/g, '제$1장 마지막 전장 클리어')
    .replace(/메인 NORMAL_CLEAR (\d+)개/g, '메인 전장 클리어 $1개')
    .replace(/NORMAL_CLEAR/g, '클리어')
    .replace(/\bSPECIAL\b/g, '특수');

  const direct: Readonly<Record<string, string>> = {
    '지휘관 전과 기록': '지휘관 기록',
    '대표 장식과 누적 전과를 한 장의 복무 기록으로 정리한다.': '대표 장식과 전과를 정리하고 업적 진행을 확인합니다.',
    '전선 복무 기록': '복무 기록',
    '대표 배지 · 표창대': '대표 표창',
    '장식 변경': '장식 교체',
    '장식 변경은 즉시 현재 프로필에 반영됩니다.': '변경 내용은 즉시 프로필에 반영됩니다.',
    '계정 지휘관 · 서버': '계정 지휘관 · 온라인',
    '오프라인/불완전 계정 프로필은 읽기 전용': '현재 프로필은 읽기 전용입니다.',
  };
  text = direct[text] ?? text;

  if (/^전과 기록 · 완료 \d+\/\d+$/.test(text)) {
    text = text.replace(/^전과 기록 · 완료 /, '업적 · ');
  }
  if (/^분류 · /.test(text)) text = text.replace(/^분류 · /, '분류 ');

  if (/HTTP_|fetch|network|state hash|revision|requestId|account_|profile_/i.test(text)) {
    return '지휘관 기록을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  return text;
}

function completedAchievements(carrier: ProfilePresentationCarrier): number | undefined {
  const state = carrier.state;
  if (!state || typeof state !== 'object') return undefined;
  const completedCount = (state as { completedCount?: unknown }).completedCount;
  return typeof completedCount === 'number' && Number.isFinite(completedCount) ? Math.max(0, completedCount) : undefined;
}

/** Presentation-only guard over the existing profile/account authority. */
export class ProfileScene extends BaseProfileScene {
  private restoreProfileRender: (() => void) | undefined;
  private achievementProgress: Phaser.GameObjects.Graphics | undefined;

  override create(): void {
    const factory = this.add;
    const original = factory.text;
    factory.text = ((x, y, value, style) => {
      const target = original.call(factory, x, y, safeProfileText(normalize(value)), style);
      const originalSetText = target.setText.bind(target);
      target.setText = ((nextValue: string | string[]) => originalSetText(safeProfileText(normalize(nextValue)))) as typeof target.setText;
      return target;
    }) as typeof factory.text;

    super.create();
    this.installProfileRenderPolish();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      factory.text = original;
      this.restoreProfileRender?.();
      this.restoreProfileRender = undefined;
      this.achievementProgress?.destroy();
      this.achievementProgress = undefined;
    });
  }

  private installProfileRenderPolish(): void {
    const carrier = this as unknown as ProfilePresentationCarrier;
    const originalRender = carrier.render;
    if (!originalRender) {
      this.polishProfileGeometry();
      return;
    }
    carrier.render = () => {
      originalRender.call(this);
      this.polishProfileGeometry();
    };
    this.restoreProfileRender = () => { carrier.render = originalRender; };
    this.polishProfileGeometry();
  }

  private drawAchievementProgress(): void {
    this.achievementProgress?.destroy();
    this.achievementProgress = undefined;
    const carrier = this as unknown as ProfilePresentationCarrier;
    const completed = completedAchievements(carrier);
    if (completed === undefined) return;
    const total = Math.max(1, ACHIEVEMENTS.length);
    const ratio = Phaser.Math.Clamp(completed / total, 0, 1);
    const g = this.add.graphics().setDepth(8);
    const x1 = 562;
    const x2 = 1196;
    const y = 214;
    g.lineStyle(5, 0x394551, 0.78).lineBetween(x1, y, x2, y);
    g.lineStyle(5, 0x6fa57b, 0.92).lineBetween(x1, y, x1 + (x2 - x1) * ratio, y);
    g.lineStyle(1, 0x6a7582, 0.24).lineBetween(492, 191, 1230, 191);
    this.achievementProgress = g;
  }

  private polishProfileGeometry(): void {
    const visit = (object: Phaser.GameObjects.GameObject): void => {
      if (object instanceof Phaser.GameObjects.Rectangle) {
        if (object.width >= 700 && object.height >= 430) {
          object.setFillStyle(0x171f28, 0.26).setStrokeStyle(1, 0x657080, 0.1);
        } else if (object.width >= 410 && object.width <= 425 && object.height >= 540 && object.height <= 555) {
          object.setFillStyle(0x1b232d, 0.97).setStrokeStyle(2, object.strokeColor || 0x657080, 0.58);
        } else if (object.width >= 395 && object.width <= 415 && object.height >= 88 && object.height <= 104) {
          object.setAlpha(Math.min(object.alpha, 0.68));
        } else if (object.width >= 620 && object.height <= 3) {
          object.setAlpha(0.32);
        }
      }
      if (object instanceof Phaser.GameObjects.Text) {
        if (object.text.startsWith('업적 · ')) object.setAlpha(0.92).setColor('#d9e3ed');
        if (object.text === '복무 기록') object.setAlpha(0.66);
        if (object.text === '대표 표창' || object.text === '장식 교체') object.setAlpha(0.84);
        if (object.text.startsWith('표창 · ')) object.setAlpha(0.74);
        if (object.text.startsWith('분류 ')) object.setAlpha(0.86);
      }
      if (object instanceof Phaser.GameObjects.Sprite) {
        const profilePortrait = object.x >= 130 && object.x <= 150 && object.y >= 305 && object.y <= 330;
        if (profilePortrait) object.setScale(object.scaleX * 1.08, object.scaleY * 1.08).setDepth(7);
      }
      if (object instanceof Phaser.GameObjects.Container) {
        const label = object.list.find((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text)?.text ?? '';
        if (['대표 인물', '칭호', '프레임', '배너', '문장', '배지'].includes(label)) object.setDepth(5);
        object.list.forEach((child) => visit(child as Phaser.GameObjects.GameObject));
      }
    };
    this.children.list.forEach(visit);
    this.drawAchievementProgress();
  }
}
