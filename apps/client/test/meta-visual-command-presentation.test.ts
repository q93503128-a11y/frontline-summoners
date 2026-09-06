import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('runtime routes arsenal and record surfaces through focused presentation wrappers', async () => {
  const main = await readSource('../src/main.ts');
  assert.match(main, /import \{ BaseWeaponScene \} from '\.\/base-weapon-command-scene'/);
  assert.match(main, /import \{ RecordHubScene, RecordResultScene \} from '\.\/record-command-scenes'/);
  assert.match(main, /game\.scene\.add\('record-hub', RecordHubScene, false\)/);
  assert.match(main, /game\.scene\.add\('record-result', RecordResultScene, false\)/);
  assert.match(main, /game\.scene\.add\('pvp-2v2-match', Pvp2v2BattleScene, false\)/);
});

test('arsenal presentation keeps unlock and equip rules in the base scene', async () => {
  const [wrapper, base] = await Promise.all([
    readSource('../src/base-weapon-command-scene.ts'),
    readSource('../src/base-weapon-scene.ts'),
  ]);
  assert.match(wrapper, /extends BaseBaseWeaponScene/);
  assert.match(wrapper, /'출정 병기로 장착'/);
  assert.match(wrapper, /wrapAfter\(carrier, 'renderWeapons'/);
  assert.doesNotMatch(wrapper, /selectActiveBaseWeapon\(|isBaseWeaponUnlocked\(/);
  assert.match(base, /selectActiveBaseWeapon\(baseWeaponId\)/);
  assert.match(base, /isBaseWeaponUnlocked\(focus\.id, this\.progress\.clearedStageIds\)/);
});

test('record presentation stays render-only over trusted and local settlement authority', async () => {
  const [wrapper, hub, result] = await Promise.all([
    readSource('../src/record-command-scenes.ts'),
    readSource('../src/record-hub-scene.ts'),
    readSource('../src/record-result-scene.ts'),
  ]);
  assert.match(wrapper, /extends BaseRecordHubScene/);
  assert.match(wrapper, /extends BaseRecordResultScene/);
  assert.match(wrapper, /'같은 기록전 재도전'/);
  assert.match(wrapper, /'최고 기록과 다음 명예를 노리는 별도 도전 전선입니다\.'/);
  assert.doesNotMatch(wrapper, /recordGuestEndlessResult|recordGuestBossRushResult|completeAuthenticatedTrustedBattle|claimAuthenticatedTrustedBattle/);
  assert.match(hub, /recordHonorProgressText\(mode\.id, record\)/);
  assert.match(result, /recordGuestEndlessResult\(this\.survivalMs\)/);
  assert.match(result, /completeAuthenticatedTrustedBattle\(battleId, commands\)/);
  assert.match(result, /claimAuthenticatedTrustedBattle\(battleId\)/);
});
