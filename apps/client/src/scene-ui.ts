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

export const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

export const COLORS = {
  ink: 0x10141c,
  panel: 0x202735,
  panel2: 0x2a3342,
  line: 0x657086,
  mapPaper: 0x202a31,
  mapLine: 0x637568,
  cream: '#fff0c9',
  gold: '#f1cf73',
  blue: '#8bc9f2',
  green: '#8fdca8',
  red: '#ff938d',
  warning: '#f0c77a',
  muted: '#b6c0cc',
  dim: '#7f8997',
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
    color,
    align,
    stroke: highContrast ? '#000000' : '#11151d',
    strokeThickness: highContrast ? Math.max(2, renderedSize >= 30 ? 5 : 3) : renderedSize >= 34 ? 3 : 0,
  });
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
  const labelText = addText(scene, 0, 0, label, Math.max(17, Math.floor(height * 0.29)), '#ffffff', 'center').setOrigin(0.5);
  const minimumTouch = compact ? getCurrentMinimumInternalTouchTarget() : 0;
  const hit = scene.add.rectangle(0, 0, Math.max(width, minimumTouch), Math.max(height, minimumTouch), 0xffffff, 0.001);
  const marker = scene.add.triangle(-width / 2 + 10, 0, 0, -7, 0, 7, 8, 0, accent, 0.95);
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
    const bg = scene.add.rectangle(0, 0, bubbleWidth, bubbleHeight, 0x111720, 0.98).setStrokeStyle(2, reasonAccent, 0.78);
    const rail = scene.add.rectangle(-bubbleWidth / 2 + 4, 0, 6, bubbleHeight - 10, reasonAccent, 0.9);
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
      ? 0x151b24
      : tone === 'primary'
        ? mix(0x242c36, stateAccent, 0.18)
        : tone === 'quiet'
          ? 0x1b222d
          : 0x222a36;
    const hoverBase = mix(base, stateAccent, selected ? 0.27 : hovered ? 0.16 : 0.07);
    const fill = inactive ? mix(base, 0x11151c, 0.45) : pressed ? mix(hoverBase, 0xffffff, 0.06) : hoverBase;
    const notch = Math.min(18, Math.max(10, height * 0.2));
    const left = -width / 2;
    const right = width / 2;
    const top = -height / 2;
    const bottom = height / 2;

    visual.fillStyle(0x080b10, inactive ? 0.24 : 0.36);
    visual.fillPoints([
      new Phaser.Math.Vector2(left + notch + 2, top + 5),
      new Phaser.Math.Vector2(right + 2, top + 5),
      new Phaser.Math.Vector2(right - notch + 2, bottom + 5),
      new Phaser.Math.Vector2(left + 2, bottom + 5),
      new Phaser.Math.Vector2(left + notch + 2, top + 5),
    ], true);

    visual.fillStyle(fill, inactive ? 0.82 : 0.99);
    visual.fillPoints([
      new Phaser.Math.Vector2(left + notch, top),
      new Phaser.Math.Vector2(right, top),
      new Phaser.Math.Vector2(right - notch, bottom),
      new Phaser.Math.Vector2(left, bottom),
      new Phaser.Math.Vector2(left + notch, top),
    ], true);

    const railAlpha = inactive ? 0.32 : selected ? 1 : 0.72;
    visual.lineStyle(highContrast ? 4 : selected ? 4 : 2, stateAccent, railAlpha);
    visual.lineBetween(left + notch + 3, top + 2, right - 3, top + 2);
    if (selected || tone === 'primary') {
      visual.lineStyle(highContrast ? 5 : 3, stateAccent, inactive ? 0.26 : 0.9);
      visual.lineBetween(left + 4, bottom - 2, right - notch - 3, bottom - 2);
    }

    marker.setFillStyle(stateAccent, inactive ? 0.35 : 0.95);
    labelText.setColor(inactive ? '#8f98a6' : '#ffffff');
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
  hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (isCommandButtonInactive(controller.state)) {
      showReasonBubble(pointer);
      return;
    }
    pressed = true;
    if (!shouldUseReducedMotion()) container.setScale(0.985);
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
  const shadow = scene.add.rectangle(4, 5, width, height, 0x080b10, 0.3);
  const body = scene.add.rectangle(0, 0, width, height, fill, alpha);
  const rail = scene.add.rectangle(-width / 2 + 3, 0, 5, height - 18, accent, 0.82);
  const top = scene.add.rectangle(0, -height / 2 + 2, width - 10, 3, accent, 0.36);
  return scene.add.container(x, y, [shadow, body, rail, top]);
}

export function addSectionHeading(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  width: number,
  accent = 0x657086,
): Phaser.GameObjects.Container {
  const line = scene.add.rectangle(0, 14, width, 2, accent, 0.45).setOrigin(0, 0.5);
  const flag = scene.add.triangle(0, 0, 0, 0, 14, 7, 0, 14, accent, 0.9).setOrigin(0, 0.5);
  const text = addText(scene, 24, 0, label, 18, '#dfe6ef').setOrigin(0, 0.5);
  return scene.add.container(x, y, [line, flag, text]);
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
  const text = addText(scene, 12, 0, label, 15, palette.text).setOrigin(0, 0.5);
  const width = Math.max(82, text.width + 34);
  const bg = scene.add.rectangle(width / 2, 0, width, 30, 0x171d27, 0.9);
  const dot = scene.add.circle(13, 0, 5, palette.accent, 1);
  return scene.add.container(x, y, [bg, dot, text]);
}

export function drawBackdrop(scene: Phaser.Scene, variant: 'menu' | 'map' = 'menu'): void {
  const settings = getClientSettings();
  const highContrast = settings.highContrast;
  const reducedEffects = shouldReduceDecorativeEffects(settings);
  const background = highContrast ? 0x080b10 : variant === 'map' ? 0x141b20 : 0x141923;
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

  if (!reducedEffects) {
    g.fillStyle(highContrast ? 0x15202a : 0x1b2631, 1).fillTriangle(0, 600, 260, 300, 520, 600);
    g.fillStyle(highContrast ? 0x111b25 : 0x17232d, 1).fillTriangle(310, 600, 700, 220, 1040, 600);
    g.fillStyle(highContrast ? 0x0f1821 : 0x151f28, 1).fillTriangle(820, 600, 1110, 330, 1280, 600);
    g.fillStyle(0xd6b560, highContrast ? 0.18 : 0.09).fillCircle(1085, 140, 190);
  }
  g.fillStyle(highContrast ? 0x06090d : 0x0e141d, 0.98).fillRect(0, 600, INTERNAL_WIDTH, 120);
  g.lineStyle(highContrast ? 3 : 2, highContrast ? 0x788ba3 : 0x354356, 0.42);
  g.lineBetween(42, 116, 590, 116);
  g.lineBetween(690, 116, 1238, 116);
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
