import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main routes every PvP battle surface through command presentation wrappers', async () => {
  const main = await readSource('../src/main.ts');
  assert.match(main, /import \{ FriendlyPvpLobbyScene, FriendlyPvpMatchScene, PvpMatchScene \} from '\.\/pvp-mobile-safe-match-scenes'/);
  assert.match(main, /import \{ Pvp2v2BattleScene, Pvp2v2MatchmakingScene \} from '\.\/pvp-2v2-mobile-safe-scenes'/);
  assert.match(main, /import \{ FriendlyPvp2v2LobbyScene \} from '\.\/pvp-friendly-2v2-command-scene'/);
  assert.match(main, /game\.scene\.add\('pvp-match', PvpMatchScene, false\)/);
  assert.match(main, /game\.scene\.add\('pvp-2v2-match', Pvp2v2BattleScene, false\)/);
  assert.match(main, /game\.scene\.add\('pvp-friendly-match', FriendlyPvpMatchScene, false\)/);
  assert.match(main, /game\.scene\.add\('pvp-friendly-2v2-lobby', FriendlyPvp2v2LobbyScene, false\)/);
});

test('1v1 command presentation uses authored units and frontline pressure', async () => {
  const presentation = await readSource('../src/pvp-command-match-scene.ts');
  assert.match(presentation, /familyForUnit\(unit\.definitionId\)/);
  assert.match(presentation, /unit\.hp \/ Math\.max\(1, unit\.maxHp\)/);
  assert.match(presentation, /내 전선 우세/);
  assert.match(presentation, /setButtonState\(button, 'disabled'/);
  assert.match(presentation, /queueCommand\(\{ type: 'SPAWN', slotId \}\)/);
  assert.match(presentation, /queueCommand\(\{ type: 'UPGRADE_SUPPLY' \}\)/);
  assert.match(presentation, /queueCommand\(\{ type: 'FIRE_BASE_WEAPON' \}\)/);
});

test('1v1 command presentation remains render-only over existing PvP session authority', async () => {
  const presentation = await readSource('../src/pvp-command-match-scene.ts');
  assert.match(presentation, /extends BasePvpMatchScene/);
  assert.match(presentation, /carrier\.renderBattle =/);
  assert.match(presentation, /carrier\.renderControls =/);
  assert.doesNotMatch(presentation, /new WebSocket|joinPvpMatchmaking|leavePvpMatchmaking|FRAME_INPUT/);
});

test('compact duel wrapper pages touch-safe controls without replacing session authority', async () => {
  const compact = await readSource('../src/pvp-mobile-safe-match-scenes.ts');
  assert.match(compact, /computePvpCompactCommandLayout\(getCurrentMinimumInternalTouchTarget\(\), slotIds\.length\)/);
  assert.match(compact, /병력 전환/);
  assert.match(compact, /scene\[PAGE\] = \(page \+ 1\) % geometry\.pageCount/);
  assert.match(compact, /extends BasePvpMatchScene/);
  assert.match(compact, /extends BaseFriendlyPvpMatchScene/);
  assert.match(compact, /if \(!isCompactMobileViewport\(\)\) \{/);
  assert.doesNotMatch(compact, /new WebSocket|FRAME_INPUT|joinPvpMatchmaking|leavePvpMatchmaking/);
});

test('2v2 team presentation replaces seat and frame vocabulary with team command language', async () => {
  const presentation = await readSource('../src/pvp-2v2-command-scenes.ts');
  assert.match(presentation, /familyForUnit\(unit\.definitionId\)/);
  assert.match(presentation, /우리 팀 전선 우세/);
  assert.match(presentation, /팀원 보급/);
  assert.match(presentation, /getCurrentMinimumInternalTouchTarget\(\)/);
  assert.match(presentation, /재사용까지 .*초 남았습니다/);
  assert.match(presentation, /팀 배정 완료 · 2v2 전투로 이동합니다/);
  assert.doesNotMatch(presentation, /CASUAL 2v2|4인 lockstep|\bREADY\b|보급소 MAX|\d+F/);
  assert.match(presentation, /extends BasePvp2v2BattleScene/);
  assert.match(presentation, /extends BasePvp2v2MatchmakingScene/);
  assert.doesNotMatch(presentation, /new WebSocket|FRAME_INPUT/);
});

test('compact 2v2 wrapper keeps five summons and two commands on one tested safe rail', async () => {
  const compact = await readSource('../src/pvp-2v2-mobile-safe-scenes.ts');
  assert.match(compact, /computePvp2v2CompactRailLayout\(getCurrentMinimumInternalTouchTarget\(\), slotIds\.length\)/);
  assert.match(compact, /geometry\.buttonWidth/);
  assert.match(compact, /geometry\.buttonHeight/);
  assert.match(compact, /if \(!isCompactMobileViewport\(\)\) \{/);
  assert.match(compact, /extends BasePvp2v2BattleScene/);
  assert.doesNotMatch(compact, /new WebSocket|FRAME_INPUT|joinPvp2v2Matchmaking/);
});

test('friendly duel keeps growth-rule identity while sharing command battle grammar', async () => {
  const friendly = await readSource('../src/pvp-friendly-command-scenes.ts');
  assert.match(friendly, /결투 서약서/);
  assert.match(friendly, /표준 성장/);
  assert.match(friendly, /실제 성장/);
  assert.match(friendly, /시즌 평점·티어·보상에 영향을 주지 않습니다/);
  assert.match(friendly, /familyForUnit\(unit\.definitionId\)/);
  assert.match(friendly, /내 전선 우세/);
  assert.match(friendly, /시즌 평점·티어·보상 변동 없음/);
  assert.match(friendly, /if \(\/30Hz\|서버 권위\/i\.test\(value\)\) return '친선전 진행 중'/);
  assert.match(friendly, /if \(\/MMR 변화 없음\/i\.test\(value\)\) return '친선전 기록 저장 완료 · 시즌 평점 변화 없음'/);
  assert.match(friendly, /HTTP_\|state hash\|seatId\|matchId/);
  assert.match(friendly, /return '친선전 연결 상태를 확인하지 못했습니다\. 다시 시도해 주세요\.'/);
  assert.doesNotMatch(friendly, /\bREADY\b|보급소 MAX|\d+F/);
});

test('friendly 2v2 lobby presents party positions instead of raw seat identifiers', async () => {
  const friendly2v2 = await readSource('../src/pvp-friendly-2v2-command-scene.ts');
  assert.match(friendly2v2, /2v2 친선전/);
  assert.match(friendly2v2, /'나', '팀원', '상대 1', '상대 2'/);
  assert.match(friendly2v2, /참가 코드/);
  assert.match(friendly2v2, /팀 배정 완료 · 나머지 지휘관을 기다립니다/);
  assert.doesNotMatch(friendly2v2, /FRIENDLY TEAM BATTLE|A1 방장|B1 참가자|A2 참가자|B2 참가자/);
});
