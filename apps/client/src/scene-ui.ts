import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { getActiveVisualFormId } from './active-visual-forms.ts';
import {
  getClientSettings,
  getScreenShakeFactor,
  getUiScaleFactor,
  shouldReduceDecorativeEffects,
  shouldUseReducedMotion,
  shouldUseStrongFlash,
} from './client-settings';
import { resolveUnitArt, type ResolvedUnitArt } from './production-assets.ts';
import { getCurrentMinimumInternalTouchTarget, isCompactMobileViewport } from './viewport';

export const FONT = '"Noto Sans KR", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

export const COLORS = {
  ink: 0x10141c,
  panel: 0x1d2430,
  panel2: 0x252e3a,
  line: 0x59677b,
  mapPaper: 0x202a31,
  mapLine: 0x637568,
  cream: '#f5e7c7',
  gold: '#e4c46f',
  blue: '#86bfe3',
  green: '#8bcf9d',
  red: '#ef8d86',
  warning: '#e8bd6c',
  muted: '#aeb8c5',
  dim: '#778291',
} as const;

export const rarityColor: Readonly<Record<string, string>> = {
  C: '#b9c2cf', B: '#8bd6a3', A: '#79baff', S: '#d79aff', SS: '#ffd56f',
};

export type CommandButtonState = 'default' | 'selected' | 'disabled' | 'locked' | 'loading' | 'success' | 'warning' | 'error';
export type CommandButtonTone = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface CommandButtonOptions {
  readonly state?: CommandButtonState;
  readonly tone?: CommandButtonTone;
  readonly reason?: string;
}

interface CommandButtonController {
  state: CommandButtonState;
  reason: string | undefined;
  render(): void;
}

export const BATTLE_UNIT_HOTKEY_CODES: readonly string[] = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
];

function hex(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

function mix(a: number, b: number, amount: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  return Phaser.Display.Color.GetColor(
    Math.round(Phaser.Math.Linear(ca.red, cb.red, amount)),
    Math.round(Phaser.Math.Linear(ca.green, cb.green, amount)),
    Math.round(Phaser.Math.Linear(ca.blue, cb.blue, amount)),
  );
}

function isCommandButtonInactive(state: CommandButtonState): boolean {
  return state === 'disabled' || state === 'locked' || state === 'loading';
}

export function fitTextToWidth(
  target: Phaser.GameObjects.Text,
  maxWidth: number,
  minFontSize = 11,
): Phaser.GameObjects.Text {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0 || target.width <= maxWidth) return target;
  let fontSize = Math.max(minFontSize, Math.round(target.height));
  while (target.width > maxWidth && fontSize > minFontSize) {
    fontSize -= 1;
    target.setFontSize(fontSize);
  }
  return target;
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 28,
  color = '#ffffff',
  align: 'left' | 'center' | 'right' = 'left',
): Phaser.GameObjects.Text {
  const settings = getClientSettings();
  const scaledSize = Math.round(size * getUiScaleFactor(settings));
  const renderedSize = isCompactMobileViewport() ? Math.max(scaledSize, 16) : Math.max(scaledSize, 12);
  const highContrast = settings.highContrast;
  return scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${renderedSize}px`,
    fontStyle: renderedSize >= 30 ? 'bold' : 'normal',
    color,
    align,
    stroke: highContrast ? '#000000' : undefined,
    strokeThickness: highContrast ? Math.max(2, renderedSize >= 30 ? 4 : 3) : 0,
  }).setLineSpacing(renderedSize >= 18 ? 1 : 0);
}

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  accent = 0x59677f,
  options: CommandButtonOptions = {},
): Phaser.GameObjects.Container {
  const settings = getClientSettings();
  const highContrast = settings.highContrast;
  const compact = isCompactMobileViewport();
  const tone = options.tone ?? 'secondary';
  const visual = scene.add.graphics();
  const labelSize = Math.max(16, Math.floor(height * 0.27));
  const labelText = addText(scene, 0, 0, label, labelSize, '#ffffff', 'center').setOrigin(0.5);
  fitTextToWidth(labelText, Math.max(72, width - 28), compact ? 14 : 12);
  const minimumTouch = compact ? getCurrentMinimumInternalTouchTarget() : 0;
  const hit = scene.add.rectangle(0, 0, Math.max(width, minimumTouch), Math.max(height, minimumTouch), 0xffffff, 0.001);
  const marker = scene.add.rectangle(-width / 2 + 4, 0, 3, Math.max(18, height - 14), accent, 0.72);
  const container = scene.add.container(x, y, [visual, marker, labelText, hit]);
  const controller: CommandButtonController = {
    state: options.state ?? 'default',
    reason: options.reason,
    render: () => undefined,
  };

  let hovered = false;
  let pressed = false;
  let reasonBubble: Phaser.GameObjects.Container | undefined;
  let reasonTimer: Phaser.Time.TimerEvent | undefined;

  const hideReasonBubble = (): void => {
    reasonTimer?.destroy();
    reasonTimer = undefined;
    reasonBubble?.destroy(true);
    reasonBubble = undefined;
  };

  const showReasonBubble = (pointer: Phaser.Input.Pointer): void => {
    if (!isCommandButtonInactive(controller.state)) return;
    const reason = controller.reason?.trim();
    if (!reason) return;
    hideReasonBubble();

    const reasonText = addText(scene, 0, 0, reason, compact ? 16 : 14, '#f2e7ce', 'center')
      .setOrigin(0.5)
      .setWordWrapWidth(compact ? 350 : 300);
    const bubbleWidth = Math.min(compact ? 390 : 340, Math.max(160, reasonText.width + 34));
    const bubbleHeight = Math.max(44, reasonText.height + 22);
    const reasonAccent = controller.state === 'locked'
      ? hex(COLORS.warning)
      : controller.state === 'loading'
        ? hex(COLORS.blue)
        : 0x748196;
    const bg = scene.add.rectangle(0, 0, bubbleWidth, bubbleHeight, 0x111720, 0.98).setStrokeStyle(1, reasonAccent, 0.7);
    const rail = scene.add.rectangle(-bubbleWidth / 2 + 3, 0, 4, bubbleHeight - 12, reasonAccent, 0.9);
    reasonBubble = scene.add.container(0, 0, [bg, rail, reasonText]).setDepth(5000);

    const pointerX = Phaser.Math.Clamp(pointer.x, 12, INTERNAL_WIDTH - 12);
    const preferAbove = pointer.y > bubbleHeight + 78;
    const proposedY = preferAbove
      ? pointer.y - bubbleHeight / 2 - 28
      : pointer.y + bubbleHeight / 2 + 28;
    reasonBubble.setPosition(
      Phaser.Math.Clamp(pointerX, bubbleWidth / 2 + 10, INTERNAL_WIDTH - bubbleWidth / 2 - 10),
      Phaser.Math.Clamp(proposedY, bubbleHeight / 2 + 10, INTERNAL_HEIGHT - bubbleHeight / 2 - 10),
    );
    reasonTimer = scene.time.delayedCall(compact ? 2200 : 1600, hideReasonBubble);
  };

  const render = (): void => {
    visual.clear();
    const state = controller.state;
    const inactive = isCommandButtonInactive(state);
    const danger = tone === 'danger' || state === 'error';
    const positive = state === 'success';
    const warning = state === 'warning' || state === 'locked';
    const selected = state === 'selected';

    let stateAccent = accent;
    if (danger) stateAccent = hex(COLORS.red);
    else if (positive) stateAccent = hex(COLORS.green);
    else if (warning) stateAccent = hex(COLORS.warning);

    const base = highContrast
      ? 0x141922
      : tone === 'primary'
        ? mix(0x232a34, stateAccent, 0.16)
        : tone === 'quiet'
          ? 0x181f29
          : 0x202833;
    const hoverBase = mix(base, stateAccent, selected ? 0.2 : hovered ? 0.11 : 0.035);
    const fill = inactive ? mix(base, 0x10141b, 0.5) : pressed ? mix(hoverBase, 0xffffff, 0.035) : hoverBase;
    const left = -width / 2;
    const top = -height / 2;
    const radius = Math.min(5, Math.max(2, Math.round(height * 0.07)));

    visual.fillStyle(0x080b10, inactive ? 0.18 : 0.28);
    visual.fillRoundedRect(left + 2, top + 3, width, height, radius);
    visual.fillStyle(fill, inactive ? 0.8 : 0.98);
    visual.fillRoundedRect(left, top, width, height, radius);

    const borderAlpha = inactive ? 0.22 : selected ? 0.92 : hovered ? 0.68 : tone === 'primary' ? 0.58 : 0.32;
    visual.lineStyle(highContrast ? 3 : selected ? 2 : 1, stateAccent, borderAlpha);
    visual.strokeRoundedRect(left + 0.5, top + 0.5, width - 1, height - 1, radius);

    if (selected || tone === 'primary') {
      visual.lineStyle(highContrast ? 4 : 2, stateAccent, inactive ? 0.22 : 0.82);
      visual.lineBetween(left + 10, height / 2 - 2, width / 2 - 10, height / 2 - 2);
    }

    marker.setFillStyle(stateAccent, inactive ? 0.25 : selected || tone === 'primary' ? 0.9 : 0.58);
    labelText.setColor(inactive ? '#8792a1' : '#f5f7fa');
    container.setAlpha(1);
  };
  controller.render = render;
  container.setData('frontlineCommandButton', controller);

  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerover', (pointer: Phaser.Input.Pointer) => {
    hovered = true;
    render();
    if (isCommandButtonInactive(controller.state)) showReasonBubble(pointer);
  });
  hit.on('pointerout', () => {
    hovered = false;
    pressed = false;
    container.setScale(1);
    if (!compact) hideReasonBubble();
    render();
  });
  hit.on('pointerdown', () => {
    const pointer = scene.input.activePointer;
    if (isCommandButtonInactive(controller.state)) {
      showReasonBubble(pointer);
      return;
    }
    pressed = true;
    if (!shouldUseReducedMotion()) container.setScale(0.99);
    render();
  });
  hit.on('pointerupoutside', () => {
    pressed = false;
    container.setScale(1);
    render();
  });
  hit.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    pressed = false;
    container.setScale(1);
    render();
    if (isCommandButtonInactive(controller.state)) {
      showReasonBubble(pointer);
      return;
    }
    hideReasonBubble();
    onClick();
  });
  container.once(Phaser.GameObjects.Events.DESTROY, hideReasonBubble);

  render();
  return container;
}

export function setButtonState(
  button: Phaser.GameObjects.Container,
  state: CommandButtonState,
  reason?: string,
): Phaser.GameObjects.Container {
  const controller = button.getData('frontlineCommandButton') as CommandButtonController | undefined;
  if (!controller) return button;
  controller.state = state;
  controller.reason = reason;
  controller.render();
  return button;
}

export function addCommandPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  accent = 0x657086,
  fill = 0x202735,
  alpha = 0.96,
): Phaser.GameObjects.Container {
  const shadow = scene.add.rectangle(3, 4, width, height, 0x080b10, 0.22);
  const body = scene.add.rectangle(0, 0, width, height, fill, alpha).setStrokeStyle(1, accent, 0.22);
  const rail = scene.add.rectangle(-width / 2 + 14, -height / 2 + 3, 22, 3, accent, 0.86).setOrigin(0, 0.5);
  const top = scene.add.rectangle(0, -height / 2 + 1, width - 18, 1, accent, 0.25);
  return scene.add.container(x, y, [shadow, body, top, rail]);
}

export function addSectionHeading(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  width: number,
  accent = 0x657086,
): Phaser.GameObjects.Container {
  const title = addText(scene, 12, 0, label, 17, '#dfe6ef').setOrigin(0, 0.5);
  const bar = scene.add.rectangle(0, 0, 4, 18, accent, 0.88).setOrigin(0, 0.5);
  const lineStart = Math.min(width - 24, 12 + title.width + 18);
  const line = scene.add.rectangle(lineStart, 0, Math.max(18, width - lineStart), 1, accent, 0.34).setOrigin(0, 0.5);
  return scene.add.container(x, y, [line, bar, title]);
}

export function addStatusPill(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  kind: 'neutral' | 'online' | 'offline' | 'warning' | 'danger' = 'neutral',
): Phaser.GameObjects.Container {
  const palette = kind === 'online'
    ? { accent: hex(COLORS.green), text: '#c9f3d5' }
    : kind === 'offline' || kind === 'warning'
      ? { accent: hex(COLORS.warning), text: '#f5dfad' }
      : kind === 'danger'
        ? { accent: hex(COLORS.red), text: '#ffd3cf' }
        : { accent: 0x758399, text: '#d7dee8' };
  const text = addText(scene, 13, 0, label, 14, palette.text).setOrigin(0, 0.5);
  const width = Math.max(78, text.width + 32);
  const bg = scene.add.rectangle(width / 2, 0, width, 28, 0x171d27, 0.86).setStrokeStyle(1, palette.accent, 0.24);
  const dot = scene.add.circle(10, 0, 4, palette.accent, 0.96);
  return scene.add.container(x, y, [bg, dot, text]);
}

export function drawBackdrop(scene: Phaser.Scene, variant: 'menu' | 'map' = 'menu'): void {
  const settings = getClientSettings();
  const highContrast = settings.highContrast;
  const reducedEffects = shouldReduceDecorativeEffects(settings);
  const background = highContrast ? 0x080b10 : variant === 'map' ? 0x141b20 : 0x121821;
  scene.cameras.main.setBackgroundColor(background);
  const g = scene.add.graphics();
  g.fillStyle(background).fillRect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);

  if (variant === 'map') {
    g.fillStyle(highContrast ? 0x111b20 : 0x1b2529, 1).fillRect(0, 105, INTERNAL_WIDTH, 520);
    g.lineStyle(highContrast ? 3 : 2, highContrast ? 0x617264 : 0x394a42, highContrast ? 0.42 : 0.28);
    for (let x = -120; x < INTERNAL_WIDTH + 140; x += 120) g.lineBetween(x, 115, x + 270, 625);
    for (let y = 145; y < 625; y += 90) g.lineBetween(0, y, INTERNAL_WIDTH, y - 42);

    if (!reducedEffects) {
      const route = [
        [70, 530], [210, 470], [350, 495], [500, 405], [650, 435], [810, 340], [960, 375], [1110, 255], [1240, 290],
      ] as const;
      g.lineStyle(highContrast ? 7 : 5, highContrast ? 0xb3c1a5 : 0x657b67, highContrast ? 0.65 : 0.5);
      for (let i = 0; i < route.length - 1; i += 1) {
        const a = route[i]!;
        const b = route[i + 1]!;
        g.lineBetween(a[0], a[1], b[0], b[1]);
      }
      route.forEach(([x, y], index) => {
        g.fillStyle(index % 3 === 0 ? 0xd0a95f : 0x8ea58d, 0.7).fillCircle(x, y, index % 3 === 0 ? 7 : 5);
      });
    }
    g.fillStyle(0x0f151d, 0.96).fillRect(0, 625, INTERNAL_WIDTH, 95);
    return;
  }

  g.fillStyle(highContrast ? 0x0d131a : 0x151d27, 0.92).fillRect(0, 112, INTERNAL_WIDTH, 488);
  if (!reducedEffects) {
    g.lineStyle(1, highContrast ? 0x607389 : 0x2f4053, highContrast ? 0.34 : 0.2);
    g.lineBetween(110, 600, 470, 112);
    g.lineBetween(520, 600, 850, 112);
    g.lineBetween(890, 600, 1180, 112);
    g.lineStyle(2, 0xb99a52, highContrast ? 0.22 : 0.08);
    g.lineBetween(1020, 112, 1230, 300);
  }
  g.fillStyle(highContrast ? 0x06090d : 0x0d131b, 0.98).fillRect(0, 600, INTERNAL_WIDTH, 120);
  g.lineStyle(highContrast ? 2 : 1, highContrast ? 0x788ba3 : 0x344256, 0.38);
  g.lineBetween(44, 112, 590, 112);
  g.lineBetween(690, 112, 1236, 112);
}

export function shakeCamera(
  scene: Phaser.Scene,
  durationMs: number,
  intensity = 0.01,
): void {
  const factor = getScreenShakeFactor();
  if (factor <= 0) return;
  scene.cameras.main.shake(durationMs, intensity * factor);
}

export function flashCamera(
  scene: Phaser.Scene,
  durationMs: number,
  red = 255,
  green = 255,
  blue = 255,
): void {
  if (!shouldUseStrongFlash()) return;
  scene.cameras.main.flash(durationMs, red, green, blue);
}

export function familyForUnit(unitId: string, selectedFormId = getActiveVisualFormId(unitId)): ResolvedUnitArt {
  return resolveUnitArt(unitId, selectedFormId);
}

export function battleUiFontSize(regular: number, compact: number): number {
  return isCompactMobileViewport() ? compact : regular;
}

export function getUnitHotkeyLabel(index: number): string {
  return index === 9 ? '0' : String(index + 1);
}
