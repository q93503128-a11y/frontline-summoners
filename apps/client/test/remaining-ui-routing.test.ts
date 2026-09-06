import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('runtime routes season leaderboard sortie and settings through presentation-only wrappers', async () => {
  const [main, season, leaderboard, sortie, settings] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/pvp-season-command-scene.ts'),
    readSource('../src/pvp-leaderboard-command-scene.ts'),
    readSource('../src/stage-sortie-command-scene.ts'),
    readSource('../src/settings-command-scene.ts'),
  ]);

  assert.match(main, /PvpSeasonScene \} from '\.\/pvp-season-command-scene'/);
  assert.match(main, /PvpLeaderboardScene \} from '\.\/pvp-leaderboard-command-scene'/);
  assert.match(main, /StageSortieModeScene \} from '\.\/stage-sortie-command-scene'/);
  assert.match(main, /SettingsScene \} from '\.\/settings-command-scene'/);

  assert.match(season, /extends BasePvpSeasonScene/);
  assert.match(season, /'내 시즌 위치': '내 위치'/);
  assert.match(season, /'티어 분포': '시즌 분포'/);

  assert.match(leaderboard, /extends BasePvpLeaderboardScene/);
  assert.match(leaderboard, /'전체 순위': '전체 전선'/);
  assert.match(leaderboard, /object\.text\.includes\(' · 나'\)/);

  assert.match(sortie, /extends BaseStageSortieModeScene/);
  assert.match(sortie, /'출정 확인': '출정 준비'/);
  assert.match(sortie, /\['renderLoading', 'renderBlocked', 'renderHome', 'renderFriends'\]/);

  assert.match(settings, /extends BaseSettingsScene/);
  assert.match(settings, /'변경 내용은 이 기기에 저장됩니다\.': '변경 내용은 이 기기에 저장'/);
});

test('presentation wrappers do not replace gameplay or persistence authority', async () => {
  const [season, leaderboard, sortie, settings] = await Promise.all([
    readSource('../src/pvp-season-command-scene.ts'),
    readSource('../src/pvp-leaderboard-command-scene.ts'),
    readSource('../src/stage-sortie-command-scene.ts'),
    readSource('../src/settings-command-scene.ts'),
  ]);
  const combined = `${season}\n${leaderboard}\n${sortie}\n${settings}`;

  assert.doesNotMatch(combined, /claimPvpSeasonHonors|getPvpLeaderboardView|joinPublicCoopMatchmaking|updateClientSettings/);
  assert.doesNotMatch(combined, /stepPlayableBattle|trySpawnPlayerUnit|tryUpgradeSupply|tryFireBaseWeapon/);
});
