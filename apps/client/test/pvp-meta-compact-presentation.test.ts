import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('season presentation keeps compact dynamic copy inside the three information lanes', async () => {
  const source = await readSource('../src/pvp-season-command-scene.ts');
  assert.match(source, /isCompactMobileViewport/);
  assert.match(source, /value\.match\(\/\^참가 \(\\d\+\)명 · 배치 완료 \(\\d\+\)명\$\//);
  assert.match(source, /object\.x === 90[\s\S]*?fitLineToWidth\(object, 292/);
  assert.match(source, /object\.x === 500[\s\S]*?fitLineToWidth\(object, 250/);
  assert.match(source, /object\.x === 878[\s\S]*?fitLineToWidth\(object, 150/);
  assert.match(source, /object\.x === 520[\s\S]*?fitLineToWidth\(object, 430/);
  assert.match(source, /Number\.parseFloat\(String\(target\.style\.fontSize\)\)/);
  assert.doesNotMatch(source, /claimPvpSeasonHonors|getPvpSeasonOverview/);
});

test('leaderboard presentation protects commander, tier, rating and win columns on compact layouts', async () => {
  const source = await readSource('../src/pvp-leaderboard-command-scene.ts');
  assert.match(source, /isCompactMobileViewport/);
  assert.match(source, /object\.x === 240[\s\S]*?fitLineToWidth\(object, 410/);
  assert.match(source, /object\.x === 720[\s\S]*?fitLineToWidth\(object, 170/);
  assert.match(source, /object\.x === 970[\s\S]*?fitLineToWidth\(object, 100/);
  assert.match(source, /object\.x === 1185[\s\S]*?fitLineToWidth\(object, 110/);
  assert.match(source, /object\.x === 1180[\s\S]*?fitLineToWidth\(object, 260/);
  assert.match(source, /Number\.parseFloat\(String\(target\.style\.fontSize\)\)/);
  assert.doesNotMatch(source, /getPvpLeaderboardView|changeScope|loadLeaderboard/);
});
