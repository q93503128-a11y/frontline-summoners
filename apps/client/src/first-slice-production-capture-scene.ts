import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@frontline/shared';
import { FIRST_SLICE_REVIEW_MEADOW_KEY, isFirstSliceProductionReviewMode } from './first-slice-production-review-runtime.ts';

const FONT = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
const LANDMARK_KEY = 'production-review-meadow-landmarks';
const FOREGROUND_KEY = 'production-review-meadow-foreground';

type Scenario = 'CROWD_8' | 'CROWD_10' | 'CROWD_12' | 'FORMS' | 'CONTACT' | 'BOSS_SMALL';
type FamilyKey = 'militia_f1' | 'militia_f2' | 'militia_f3' | 'enemy-raider' | 'enemy-boss';
type MotionKey = 'idle' | 'run' | 'attack' | 'knockback' | 'death';

interface StripSpec { readonly key: string; readonly frameWidth: number; readonly frameHeight: number; readonly frames: number; }
interface FamilySpec {
  readonly label: string;
  readonly enemy: boolean;
  readonly displayHeight: number;
  readonly attackContactFrame: number;
  readonly motions: Readonly<Record<MotionKey, StripSpec>>;
}

const FAMILIES: Readonly<Record<FamilyKey, FamilySpec>> = {
  militia_f1: {
    label: 'F1 징집병', enemy: false, displayHeight: 174, attackContactFrame: 2,
    motions: {
      idle: { key: 'review-militia-f1-idle', frameWidth: 135, frameHeight: 135, frames: 10 },
      run: { key: 'review-militia-f1-run', frameWidth: 135, frameHeight: 135, frames: 6 },
      attack: { key: 'review-militia-f1-attack', frameWidth: 135, frameHeight: 135, frames: 4 },
      knockback: { key: 'review-militia-f1-knockback', frameWidth: 135, frameHeight: 135, frames: 3 },
      death: { key: 'review-militia-f1-death', frameWidth: 135, frameHeight: 135, frames: 9 },
    },
  },
  militia_f2: {
    label: 'F2 정규보병', enemy: false, displayHeight: 184, attackContactFrame: 3,
    motions: {
      idle: { key: 'review-militia-f2-idle', frameWidth: 140, frameHeight: 140, frames: 11 },
      run: { key: 'review-militia-f2-run', frameWidth: 140, frameHeight: 140, frames: 8 },
      attack: { key: 'review-militia-f2-attack', frameWidth: 140, frameHeight: 140, frames: 6 },
      knockback: { key: 'review-militia-f2-knockback', frameWidth: 140, frameHeight: 140, frames: 4 },
      death: { key: 'review-militia-f2-death', frameWidth: 140, frameHeight: 140, frames: 9 },
    },
  },
  militia_f3: {
    label: 'F3 노련한 전선병', enemy: false, displayHeight: 176, attackContactFrame: 2,
    motions: {
      idle: { key: 'review-militia-f3-idle', frameWidth: 184, frameHeight: 137, frames: 6 },
      run: { key: 'review-militia-f3-run', frameWidth: 184, frameHeight: 137, frames: 8 },
      attack: { key: 'review-militia-f3-attack', frameWidth: 184, frameHeight: 137, frames: 4 },
      knockback: { key: 'review-militia-f3-knockback', frameWidth: 184, frameHeight: 137, frames: 3 },
      death: { key: 'review-militia-f3-death', frameWidth: 184, frameHeight: 137, frames: 9 },
    },
  },
  'enemy-raider': {
    label: '약탈병', enemy: true, displayHeight: 178, attackContactFrame: 2,
    motions: {
      idle: { key: 'review-enemy-raider-idle', frameWidth: 150, frameHeight: 150, frames: 8 },
      run: { key: 'review-enemy-raider-run', frameWidth: 150, frameHeight: 150, frames: 8 },
      attack: { key: 'review-enemy-raider-attack', frameWidth: 150, frameHeight: 150, frames: 4 },
      knockback: { key: 'review-enemy-raider-knockback', frameWidth: 150, frameHeight: 150, frames: 4 },
      death: { key: 'review-enemy-raider-death', frameWidth: 150, frameHeight: 150, frames: 6 },
    },
  },
  'enemy-boss': {
    label: '황금가면 사령술사', enemy: true, displayHeight: 228, attackContactFrame: 5,
    motions: {
      idle: { key: 'review-enemy-boss-idle', frameWidth: 150, frameHeight: 150, frames: 8 },
      run: { key: 'review-enemy-boss-run', frameWidth: 150, frameHeight: 150, frames: 8 },
      attack: { key: 'review-enemy-boss-attack', frameWidth: 150, frameHeight: 150, frames: 8 },
      knockback: { key: 'review-enemy-boss-knockback', frameWidth: 150, frameHeight: 150, frames: 4 },
      death: { key: 'review-enemy-boss-death', frameWidth: 150, frameHeight: 150, frames: 5 },
    },
  },
};

interface ActorView {
  readonly familyKey: FamilyKey;
  readonly family: FamilySpec;
  readonly motion: MotionKey;
  readonly strip: StripSpec;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly label: Phaser.GameObjects.Text;
  readonly phase: number;
}

function parseScenario(): Scenario {
  if (typeof window === 'undefined') return 'CROWD_12';
  const value = new URLSearchParams(window.location.search).get('captureScenario')?.toLowerCase();
  if (value === '8' || value === 'crowd8') return 'CROWD_8';
  if (value === '10' || value === 'crowd10') return 'CROWD_10';
  if (value === 'forms') return 'FORMS';
  if (value === 'contact') return 'CONTACT';
  if (value === 'boss' || value === 'boss-small') return 'BOSS_SMALL';
  return 'CROWD_12';
}

export function isFirstSliceCaptureMode(): boolean {
  if (typeof window === 'undefined') return false;
  const query = new URLSearchParams(window.location.search);
  return isFirstSliceProductionReviewMode() && query.get('capture') === 'first-slice';
}

export class FirstSliceProductionCaptureScene extends Phaser.Scene {
  private scenario: Scenario = 'CROWD_12';
  private actors: ActorView[] = [];
  private captureObjects: Phaser.GameObjects.GameObject[] = [];
  private diagnosticObjects: Phaser.GameObjects.GameObject[] = [];
  private controlObjects: Phaser.GameObjects.GameObject[] = [];
  private darkOverlay?: Phaser.GameObjects.Rectangle;
  private dark = false;
  private diagnostics = true;
  private paused = false;
  private controlsVisible = true;
  private lastFrameStep = -1;

  constructor() { super('first-slice-capture'); }

  create(): void {
    if (!isFirstSliceCaptureMode()) {
      this.scene.start('main-menu');
      return;
    }
    this.scenario = parseScenario();
    this.drawBackground();
    this.drawControls();
    this.bindKeys();
    this.rebuildScenario();
  }

  update(time: number): void {
    if (this.paused || this.scenario === 'CONTACT') return;
    const step = Math.floor(time / 105);
    if (step === this.lastFrameStep) return;
    this.lastFrameStep = step;
    for (const actor of this.actors) {
      actor.sprite.setFrame((step + actor.phase) % actor.strip.frames);
    }
  }

  private drawBackground(): void {
    this.add.image(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, FIRST_SLICE_REVIEW_MEADOW_KEY)
      .setDisplaySize(INTERNAL_WIDTH, INTERNAL_HEIGHT).setDepth(0);
    if (this.textures.exists(LANDMARK_KEY)) this.add.image(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, LANDMARK_KEY)
      .setDisplaySize(INTERNAL_WIDTH, INTERNAL_HEIGHT).setDepth(0.4);
    if (this.textures.exists(FOREGROUND_KEY)) this.add.image(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, FOREGROUND_KEY)
      .setDisplaySize(INTERNAL_WIDTH, INTERNAL_HEIGHT).setDepth(2.4);
    this.darkOverlay = this.add.rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x07101a, 0)
      .setDepth(19).setName('capture-dark-overlay');
  }

  private drawControls(): void {
    const bar = this.add.rectangle(INTERNAL_WIDTH / 2, 34, 1240, 54, 0x101722, 0.93).setStrokeStyle(2, 0xf0c967, 0.7).setDepth(70);
    const title = this.add.text(28, 17, 'FIRST SLICE · NON-AUTHORITATIVE CAPTURE PREFLIGHT', {
      fontFamily: FONT, fontSize: '15px', color: '#ffe39a', fontStyle: 'bold',
    }).setDepth(71);
    const buttons: readonly [string, () => void][] = [
      ['8', () => this.setScenario('CROWD_8')], ['10', () => this.setScenario('CROWD_10')], ['12', () => this.setScenario('CROWD_12')],
      ['F1/F2/F3', () => this.setScenario('FORMS')], ['CONTACT', () => this.setScenario('CONTACT')], ['BOSS SMALL', () => this.setScenario('BOSS_SMALL')],
      ['DARK', () => this.toggleDark()], ['DIAG', () => this.toggleDiagnostics()], ['PAUSE', () => { this.paused = !this.paused; }],
      ['HIDE UI', () => this.toggleControls()], ['BACK', () => this.exitCapture()],
    ];
    let x = 486;
    for (const [label, handler] of buttons) {
      const width = Math.max(44, label.length * 8 + 18);
      const button = this.add.text(x, 34, label, {
        fontFamily: FONT, fontSize: '13px', color: '#f6ead0', backgroundColor: '#26364b', padding: { x: 8, y: 5 },
      }).setOrigin(0.5).setDepth(72).setInteractive({ useHandCursor: true });
      button.on('pointerdown', handler);
      this.controlObjects.push(button);
      x += width + 8;
    }
    this.controlObjects.push(bar, title);
  }

  private bindKeys(): void {
    this.input.keyboard?.on('keydown-EIGHT', () => this.setScenario('CROWD_8'));
    this.input.keyboard?.on('keydown-ZERO', () => this.setScenario('CROWD_10'));
    this.input.keyboard?.on('keydown-TWO', () => this.setScenario('CROWD_12'));
    this.input.keyboard?.on('keydown-F', () => this.setScenario('FORMS'));
    this.input.keyboard?.on('keydown-C', () => this.setScenario('CONTACT'));
    this.input.keyboard?.on('keydown-B', () => this.setScenario('BOSS_SMALL'));
    this.input.keyboard?.on('keydown-D', () => this.toggleDark());
    this.input.keyboard?.on('keydown-G', () => this.toggleDiagnostics());
    this.input.keyboard?.on('keydown-P', () => { this.paused = !this.paused; });
    this.input.keyboard?.on('keydown-H', () => this.toggleControls());
    this.input.keyboard?.on('keydown-ESC', () => this.exitCapture());
  }

  private setScenario(scenario: Scenario): void {
    this.scenario = scenario;
    this.paused = false;
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const queryValue: Record<Scenario, string> = { CROWD_8: '8', CROWD_10: '10', CROWD_12: '12', FORMS: 'forms', CONTACT: 'contact', BOSS_SMALL: 'boss-small' };
      url.searchParams.set('captureScenario', queryValue[scenario]);
      window.history.replaceState(null, '', url);
    }
    this.rebuildScenario();
  }

  private clearScenario(): void {
    for (const actor of this.actors) { actor.sprite.destroy(); actor.shadow.destroy(); actor.label.destroy(); }
    this.actors = [];
    for (const object of this.captureObjects) object.destroy();
    for (const object of this.diagnosticObjects) object.destroy();
    this.captureObjects = [];
    this.diagnosticObjects = [];
  }

  private rebuildScenario(): void {
    this.clearScenario();
    if (this.scenario === 'FORMS') this.buildForms();
    else if (this.scenario === 'CONTACT') this.buildContact();
    else if (this.scenario === 'BOSS_SMALL') this.buildBossSmall();
    else this.buildCrowd(this.scenario === 'CROWD_8' ? 8 : this.scenario === 'CROWD_10' ? 10 : 12);
    this.drawScenarioTitle();
    this.drawDiagnostics();
  }

  private addActor(familyKey: FamilyKey, motion: MotionKey, x: number, y: number, phase = 0, scale = 1): ActorView {
    const family = FAMILIES[familyKey];
    const strip = family.motions[motion];
    const shadow = this.add.ellipse(x, y + 24, familyKey === 'enemy-boss' ? 82 : 56, familyKey === 'enemy-boss' ? 14 : 10, 0x0b0d10, 0.38).setDepth(2);
    const sprite = this.add.sprite(x, y, strip.key, 0).setOrigin(0.5, 1).setDepth(3);
    sprite.setFlipX(family.enemy);
    sprite.setScale((family.displayHeight / strip.frameHeight) * scale);
    const label = this.add.text(x, y + 29, family.label, { fontFamily: FONT, fontSize: '12px', color: '#ffffff', stroke: '#101318', strokeThickness: 4 })
      .setOrigin(0.5, 0).setDepth(10).setVisible(this.diagnostics);
    const actor = { familyKey, family, motion, strip, sprite, shadow, label, phase };
    this.actors.push(actor);
    return actor;
  }

  private buildCrowd(count: number): void {
    const playerPattern: FamilyKey[] = ['militia_f1', 'militia_f2', 'militia_f3'];
    const playerCount = Math.floor(count / 2);
    const enemyCount = count - playerCount;
    for (let i = 0; i < playerCount; i += 1) {
      this.addActor(playerPattern[i % playerPattern.length]!, i % 3 === 0 ? 'idle' : 'run', 340 + i * 54, 510 - (i % 2) * 16, i, 0.88);
    }
    for (let i = 0; i < enemyCount; i += 1) {
      this.addActor('enemy-raider', i % 3 === 0 ? 'idle' : 'run', 920 - i * 54, 510 - ((i + 1) % 2) * 16, i + 2, 0.88);
    }
    this.captureObjects.push(this.add.text(640, 118, `${count} UNIT OVERLAP · 중앙 접촉선 가독성`, {
      fontFamily: FONT, fontSize: '22px', color: '#f6e7c0', stroke: '#17202a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(12));
  }

  private buildForms(): void {
    const positions: readonly [FamilyKey, number][] = [['militia_f1', 380], ['militia_f2', 560], ['militia_f3', 740], ['enemy-raider', 940]];
    for (const [key, x] of positions) this.addActor(key, 'idle', x, 515, x % 7, key === 'enemy-raider' ? 1 : 1.05);
    this.captureObjects.push(this.add.text(640, 118, 'FORM SILHOUETTE · F1 → F2 → F3 ↔ 약탈병', {
      fontFamily: FONT, fontSize: '22px', color: '#f6e7c0', stroke: '#17202a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(12));
  }

  private buildContact(): void {
    const keys: FamilyKey[] = ['militia_f1', 'militia_f2', 'militia_f3', 'enemy-raider', 'enemy-boss'];
    const xs = [260, 450, 640, 830, 1040];
    keys.forEach((key, index) => {
      const actor = this.addActor(key, 'attack', xs[index]!, 515, 0, key === 'enemy-boss' ? 0.9 : 0.92);
      actor.sprite.setFrame(Math.min(actor.family.attackContactFrame, actor.strip.frames - 1));
      const dir = actor.family.enemy ? -1 : 1;
      const markerX = actor.sprite.x + dir * (key === 'enemy-boss' ? 92 : key === 'militia_f2' ? 84 : 68);
      const markerY = actor.sprite.y - (key === 'enemy-boss' ? 108 : 86);
      const ring = this.add.circle(markerX, markerY, 15, 0x000000, 0).setStrokeStyle(3, key === 'enemy-boss' ? 0xf0c967 : 0xff7069, 0.96).setDepth(14);
      const h = this.add.rectangle(markerX, markerY, 42, 2, key === 'enemy-boss' ? 0xf0c967 : 0xff7069, 0.9).setDepth(14);
      const v = this.add.rectangle(markerX, markerY, 2, 42, key === 'enemy-boss' ? 0xf0c967 : 0xff7069, 0.9).setDepth(14);
      this.captureObjects.push(ring, h, v);
    });
    this.captureObjects.push(this.add.text(640, 118, 'ATTACK CONTACT · 각 runtime strip의 고정 contact frame', {
      fontFamily: FONT, fontSize: '22px', color: '#f6e7c0', stroke: '#17202a', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(12));
  }

  private buildBossSmall(): void {
    this.addActor('militia_f2', 'idle', 545, 500, 0, 0.78);
    this.addActor('militia_f3', 'idle', 610, 502, 1, 0.78);
    const boss = this.addActor('enemy-boss', 'attack', 790, 505, 0, 0.88);
    boss.sprite.setFrame(FAMILIES['enemy-boss'].attackContactFrame);
    this.addActor('enemy-raider', 'idle', 875, 508, 2, 0.72);
    const crop = this.add.rectangle(640, 360, 640, 360, 0x000000, 0).setStrokeStyle(4, 0x7fd0ff, 0.95).setDepth(16);
    const top = this.add.rectangle(640, 90, 1280, 180, 0x07101a, 0.48).setDepth(15);
    const bottom = this.add.rectangle(640, 630, 1280, 180, 0x07101a, 0.48).setDepth(15);
    const left = this.add.rectangle(160, 360, 320, 360, 0x07101a, 0.48).setDepth(15);
    const right = this.add.rectangle(1120, 360, 320, 360, 0x07101a, 0.48).setDepth(15);
    this.captureObjects.push(crop, top, bottom, left, right, this.add.text(640, 154, '640×360 BOSS READABILITY WINDOW', {
      fontFamily: FONT, fontSize: '18px', color: '#a8e0ff', stroke: '#17202a', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(17));
  }

  private drawScenarioTitle(): void {
    const map: Record<Scenario, string> = {
      CROWD_8: '8기 중첩', CROWD_10: '10기 중첩', CROWD_12: '12기 중첩', FORMS: 'F1/F2/F3 실루엣', CONTACT: '공격 contact 정지', BOSS_SMALL: '보스 소화면',
    };
    this.captureObjects.push(this.add.text(28, 86, `${map[this.scenario]} · UNAPPROVED`, {
      fontFamily: FONT, fontSize: '15px', color: '#ffd27a', backgroundColor: '#141a22cc', padding: { x: 8, y: 5 },
    }).setDepth(18));
  }

  private drawDiagnostics(): void {
    const safe = this.add.rectangle(640, 475, 500, 250, 0x000000, 0).setStrokeStyle(2, 0x9bd885, 0.7).setDepth(13);
    const safeLabel = this.add.text(640, 342, 'MEADOW CLEAR CORRIDOR x=390..890', {
      fontFamily: FONT, fontSize: '12px', color: '#bfe8ad', backgroundColor: '#162016bb', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(13);
    this.diagnosticObjects.push(safe, safeLabel);
    for (const actor of this.actors) {
      const bounds = actor.sprite.getBounds();
      const box = this.add.rectangle(bounds.centerX, bounds.centerY, bounds.width, bounds.height, 0x000000, 0)
        .setStrokeStyle(1, actor.familyKey === 'enemy-boss' ? 0xf0c967 : actor.family.enemy ? 0xff8e84 : 0x8bc9ff, 0.62).setDepth(11);
      this.diagnosticObjects.push(box);
      if (actor.familyKey === 'enemy-boss') {
        const scale = actor.sprite.scaleX;
        const maskX = actor.sprite.x + (actor.family.enemy ? -(72 - 75) : 72 - 75) * scale;
        const maskY = actor.sprite.y - (150 - 40) * scale;
        const mask = this.add.rectangle(maskX, maskY, 68 * scale, 54 * scale, 0x000000, 0).setStrokeStyle(2, 0xffdf8a, 0.85).setDepth(12);
        const maskLabel = this.add.text(maskX, maskY - 34 * scale, 'MASK', { fontFamily: FONT, fontSize: '10px', color: '#ffdf8a' }).setOrigin(0.5).setDepth(12);
        this.diagnosticObjects.push(mask, maskLabel);
      }
    }
    this.applyDiagnosticVisibility();
  }

  private toggleDark(): void {
    this.dark = !this.dark;
    this.darkOverlay?.setAlpha(this.dark ? 0.68 : 0);
  }

  private toggleDiagnostics(): void {
    this.diagnostics = !this.diagnostics;
    this.applyDiagnosticVisibility();
  }

  private applyDiagnosticVisibility(): void {
    for (const object of this.diagnosticObjects) if ('setVisible' in object) (object as Phaser.GameObjects.GameObject & { setVisible(value: boolean): unknown }).setVisible(this.diagnostics);
    for (const actor of this.actors) actor.label.setVisible(this.diagnostics);
  }

  private toggleControls(): void {
    this.controlsVisible = !this.controlsVisible;
    for (const object of this.controlObjects) if ('setVisible' in object) (object as Phaser.GameObjects.GameObject & { setVisible(value: boolean): unknown }).setVisible(this.controlsVisible);
  }

  private exitCapture(): void {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('capture');
      url.searchParams.delete('captureScenario');
      window.history.replaceState(null, '', url);
    }
    this.scene.start('main-menu');
  }
}
