import Phaser from 'phaser';
import { setButtonState } from './scene-ui.ts';
import { TrustedBattleResultScene as BaseTrustedBattleResultScene } from './trusted-battle-result-scene.ts';

type TrustedResultPresentationCarrier = Phaser.Scene & {
  finalized?: boolean;
  finalizing?: boolean;
  finalizeTrustedResult?: () => Promise<void>;
};

function rewriteTrustedResultLine(value: string): string {
  const direct: Readonly<Record<string, string>> = {
    'SERVER TRUSTED COMPLETION': '전투 결과 확인',
    '서버가 command log를 재실행하는 중…': '서버에서 전투 결과를 확인하는 중…',
    'winner · frames · final hash · 거점 HP 대조 중…': '승패와 최종 전장 상태를 확인하는 중…',
    '서버 전투 재실행·terminal fingerprint 검증 중…': '서버에서 전투 결과를 다시 확인하는 중…',
    '전투 검증 완료 · 계정 보상 claim 중…': '전투 확인 완료 · 보상을 정산하는 중…',
    '보상은 서버 검증이 완료될 때까지 지급되지 않는다.': '결과 확인이 끝날 때까지 보상은 지급되지 않습니다.',
    '결과 검증 재시도': '결과 다시 확인',
    '메인': '지휘소',
  };
  if (direct[value]) return direct[value]!;
  if (/^전투\s+[a-z0-9]+…\s+·\s+[\d,]+F$/i.test(value)) return '계정 전투 기록 확인 중';
  if (/^승 리 · 검 증 중$/.test(value)) return '승리 · 확인 중';
  if (/^패 배 · 검 증 중$/.test(value)) return '패배 · 확인 중';
  if (/^무 승 부 · 검 증 중$/.test(value)) return '무승부 · 확인 중';
  if (/^SPECIAL\s+\d+\s+·/.test(value)) return value.replace(/^SPECIAL\s+(\d+)\s+·/, '특수 작전 $1 ·');
  if (/^STAGE\s+\d+\s+·/.test(value)) return value.replace(/^STAGE\s+(\d+)\s+·/, '전장 $1 ·');
  if (/^서버 정본 저장 완료 · revision /i.test(value)) {
    return value.includes('장 완료 연출') ? '계정 진행과 보상 저장 완료 · 이어서 이야기가 재생됩니다.' : '계정 진행과 보상 저장 완료';
  }
  if (/trusted battle|terminal fingerprint|command log|revision|idempotent replay|claim|final hash|frames/i.test(value)) {
    return '전투 결과를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  }
  if (/^검증\/저장 실패 ·/.test(value)) return '결과 확인에 실패했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
  return value;
}

function rewriteTrustedResultText(value: string | string[]): string | string[] {
  return Array.isArray(value) ? value.map(rewriteTrustedResultLine) : rewriteTrustedResultLine(value);
}

/** Player-facing presentation adapter. Server authority and settlement logic stay in the base scene. */
export class TrustedBattleResultScene extends BaseTrustedBattleResultScene {
  private restoreFinalize: (() => void) | undefined;

  override create(): void {
    const factory = this.add;
    const originalText = factory.text;
    factory.text = ((x, y, value, style) => {
      const text = originalText.call(factory, x, y, rewriteTrustedResultText(value), style);
      const originalSetText = text.setText.bind(text);
      text.setText = ((next: string | string[]) => originalSetText(rewriteTrustedResultText(next))) as typeof text.setText;
      return text;
    }) as typeof factory.text;

    this.installFinalizeStateBridge();
    super.create();
    this.polishTrustedGeometry();
    this.syncActionStates();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      factory.text = originalText;
      this.restoreFinalize?.();
      this.restoreFinalize = undefined;
    });
  }

  private installFinalizeStateBridge(): void {
    const carrier = this as unknown as TrustedResultPresentationCarrier;
    const originalFinalize = carrier.finalizeTrustedResult;
    if (!originalFinalize) return;
    carrier.finalizeTrustedResult = async () => {
      this.syncActionStates('loading');
      await originalFinalize.call(this);
      this.syncActionStates();
    };
    this.restoreFinalize = () => { carrier.finalizeTrustedResult = originalFinalize; };
  }

  private syncActionStates(force?: 'loading'): void {
    const carrier = this as unknown as TrustedResultPresentationCarrier;
    const actionButtons = this.children.list.filter((child): child is Phaser.GameObjects.Container => (
      child instanceof Phaser.GameObjects.Container
      && child.y >= 560
      && child.getData('frontlineCommandButton') !== undefined
    ));
    for (const button of actionButtons) {
      if (force === 'loading' || carrier.finalizing) {
        setButtonState(button, 'loading', '결과 확인이 끝난 뒤 이동할 수 있습니다.');
      } else if (carrier.finalized) {
        setButtonState(button, 'default');
      } else {
        setButtonState(button, 'disabled', '결과 확인을 완료하거나 다시 확인한 뒤 이동할 수 있습니다.');
      }
    }
  }

  private polishTrustedGeometry(): void {
    for (const child of this.children.list) {
      if (child instanceof Phaser.GameObjects.Rectangle && child.width >= 700 && child.height >= 280) {
        child.setFillStyle(0x171f29, 0.86).setStrokeStyle(1, 0x708197, 0.42);
      }
      if (child instanceof Phaser.GameObjects.Text && child.text === '전투 결과 확인') child.setAlpha(0.78);
    }
  }
}
