import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('record SPECIAL is reachable from sortie and all three player-facing scenes are registered', async () => {
  const [main, hub] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/stage-hub-scene.ts'),
  ]);
  assert.match(hub, /'기록전', \(\) => this\.scene\.start\('record-hub'\)/);
  assert.match(main, /import \{ RecordHubScene \} from '\.\/record-hub-scene';/);
  assert.match(main, /import \{ QuirkRecordBattleScene as RecordBattleScene \} from '\.\/quirk-record-battle-scene';/);
  assert.match(main, /import \{ RecordResultScene \} from '\.\/record-result-scene';/);
  assert.match(main, /game\.scene\.add\('record-hub', RecordHubScene, false\)/);
  assert.match(main, /game\.scene\.add\('record-battle', RecordBattleScene, false\)/);
  assert.match(main, /game\.scene\.add\('record-result', RecordResultScene, false\)/);
});

test('record hub reads canonical unlock rules and durable personal-best high-water state', async () => {
  const hub = await readSource('../src/record-hub-scene.ts');
  assert.match(hub, /RECORD_MODE_DEFINITIONS\.forEach/);
  assert.match(hub, /isRecordModeUnlocked\(mode\.id, this\.progress\.clearedStageIds\)/);
  assert.match(hub, /record\?\.endlessBestTimeMs/);
  assert.match(hub, /record\?\.endlessRewardedMinute/);
  assert.match(hub, /record\?\.bossRushBestDefeated/);
  assert.match(hub, /record\?\.bossRushRewardedDefeated/);
  assert.match(hub, /1× 고정 · 혼자 도전 · 소탕 없음/);
  assert.doesNotMatch(hub, /SOLO_ONLY|NORMAL_CLEAR|RECORD SPECIAL|LOCKED/);
  assert.match(hub, /setButtonState\(action, 'locked', unlockText\(mode\.id\)\)/);
  assert.match(hub, /this\.scene\.start\('record-battle', \{ modeId: mode\.id \}\)/);
});

test('record battle uses the real deterministic record runtimes at fixed 1x speed', async () => {
  const battle = await readSource('../src/record-battle-scene.ts');
  assert.match(battle, /createGuestEndlessRecordBattle\(progress\)/);
  assert.match(battle, /createGuestBossRushRecordBattle\(progress\)/);
  assert.match(battle, /stepEndlessRecordBattle\(this\.runtime\)/);
  assert.match(battle, /stepBossRushRecordBattle\(this\.runtime\)/);
  assert.match(battle, /this\.accumulator >= SIM_TICK_MS/);
  assert.match(battle, /'1× 고정'/);
  assert.doesNotMatch(battle, /scaleReplayDeltaMs|replaySpeed|2×/);
  assert.match(battle, /trySpawnPlayerUnit\(this\.battleState\(\), slotId\)/);
  assert.match(battle, /tryUpgradeSupply\(this\.battleState\(\)\)/);
  assert.match(battle, /tryFireBaseWeapon\(this\.battleState\(\)\)/);
});

test('record battle presentation routes through the command HUD without leaking prototype vocabulary', async () => {
  const [accessible, command, quirk] = await Promise.all([
    readSource('../src/accessible-record-battle-scene.ts'),
    readSource('../src/record-command-hud.ts'),
    readSource('../src/quirk-record-battle-scene.ts'),
  ]);
  assert.match(accessible, /installRecordCommandHud\(this\)/);
  assert.match(command, /현재 기록/);
  assert.match(command, /혼자 도전 · 1× 고정/);
  assert.match(command, /최대 단계/);
  assert.match(command, /getCurrentMinimumInternalTouchTarget\(\)/);
  assert.match(command, /label\.slice\(0, -1\).*초/);
  assert.doesNotMatch(command, /SOLO_ONLY|RECORD SPECIAL/);
  assert.match(quirk, /계정 확인 중/);
  assert.doesNotMatch(quirk, /서버 검증 대기/);
});

test('record battle applies durable loadout and exposes the selected weapon instead of assuming front cannon', async () => {
  const battle = await readSource('../src/record-battle-scene.ts');
  assert.match(battle, /this\.activeSlots = buildGuestDeckSlots\(progress\)/);
  assert.match(battle, /const weaponId = state\.baseWeapon\.id \?\? 'base_weapon_front_cannon'/);
  assert.match(battle, /BASE_WEAPON_UNLOCKS\.find/);
  assert.match(battle, /kind === 'AEGIS_EMITTER'/);
  assert.match(battle, /kind === 'SUPPLY_DROP'/);
});

test('record result writes reached score before navigation and exposes honest settlement states', async () => {
  const result = await readSource('../src/record-result-scene.ts');
  assert.match(result, /recordGuestEndlessResult\(this\.survivalMs\)/);
  assert.match(result, /recordGuestBossRushResult\(this\.defeatedBosses\)/);
  assert.match(result, /result\.resourceReward/);
  assert.match(result, /result\.recordModeProgress/);
  assert.match(result, /if \(this\.resultRecorded\) action\(\)/);
  assert.match(result, /setActionsLoading/);
  assert.match(result, /setActionsDisabled/);
  assert.match(result, /unlockActions/);
  assert.match(result, /this\.scene\.start\('record-battle', \{ modeId: this\.modeId \}\)/);
  assert.match(result, /this\.scene\.start\('record-hub'\)/);
  assert.doesNotMatch(result, /서버 재생 검증·기록 저장 중/);
  assert.doesNotMatch(result, /recordNormalStageClear|recordSpecialStageClear|sweepGuestStage/);
});
