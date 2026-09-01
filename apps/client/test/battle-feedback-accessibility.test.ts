import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_CLIENT_SETTINGS, normalizeClientSettings } from '../src/client-settings.ts';
import {
  getBattleFeedbackPolicy,
  resolveBattleFeedbackDuration,
  scaleBattleShakeIntensity,
} from '../src/battle-feedback-policy.ts';

test('battle feedback policy derives accessibility settings without touching simulation', () => {
  const settings = normalizeClientSettings({
    ...DEFAULT_CLIENT_SETTINGS,
    screenShakePercent: 50,
    reduceFlashes: true,
    reduceMotion: true,
    graphicsPreset: 'LOW',
  });
  assert.deepEqual(getBattleFeedbackPolicy(settings), {
    screenShakeFactor: 0.5,
    reducedMotion: true,
    reducedDecorativeEffects: true,
    strongFlash: false,
  });
  assert.equal(scaleBattleShakeIntensity(0.004, settings), 0.002);
  assert.equal(resolveBattleFeedbackDuration(260, settings), 0);
});

test('zero shake and battery saver produce deterministic presentation-only reductions', () => {
  const settings = normalizeClientSettings({
    ...DEFAULT_CLIENT_SETTINGS,
    screenShakePercent: 0,
    batterySaver: true,
  });
  const policy = getBattleFeedbackPolicy(settings);
  assert.equal(policy.screenShakeFactor, 0);
  assert.equal(policy.reducedMotion, true);
  assert.equal(policy.reducedDecorativeEffects, true);
  assert.equal(scaleBattleShakeIntensity(0.01, settings), 0);
});

test('standard and Record battle chains share camera feedback gates while boss text remains intact', async () => {
  const [cameraGate, accessible, accessibleRecord, quirk, quirkRecord, boss, policy] = await Promise.all([
    readFile(new URL('../src/battle-camera-feedback.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/accessible-battle-scene.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/accessible-record-battle-scene.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/quirk-battle-scene.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/quirk-record-battle-scene.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/boss-warning.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/battle-feedback-policy.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(quirk, /AccessibleBattleScene as BattleScene/);
  assert.match(quirkRecord, /AccessibleRecordBattleScene as RecordBattleScene/);
  assert.match(accessible, /installAccessibleBattleCameraFeedback\(this\)/);
  assert.match(accessibleRecord, /installAccessibleBattleCameraFeedback\(this\)/);
  assert.match(cameraGate, /camera\.shake\s*=/);
  assert.match(cameraGate, /camera\.flash\s*=/);
  assert.match(cameraGate, /screenShakeFactor <= 0/);
  assert.match(cameraGate, /!getBattleFeedbackPolicy\(\)\.strongFlash/);
  assert.match(boss, /policy\.reducedMotion/);
  assert.match(boss, /policy\.reducedDecorativeEffects/);
  assert.match(boss, /우 두 머 리\s+출 현/);
  assert.match(boss, /bossName/);
  assert.doesNotMatch(policy, /@frontline\/sim/);
  assert.doesNotMatch(cameraGate, /@frontline\/sim/);
});
