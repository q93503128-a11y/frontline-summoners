import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main routes 1v1 PvP battle through the command presentation wrapper', async () => {
  const [main, presentation] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/pvp-command-match-scene.ts'),
  ]);
  assert.match(main, /import \{ PvpMatchScene \} from '\.\/pvp-command-match-scene'/);
  assert.match(main, /game\.scene\.add\('pvp-match', PvpMatchScene, false\)/);
  assert.match(presentation, /familyForUnit\(unit\.definitionId\)/);
  assert.match(presentation, /unit\.hp \/ Math\.max\(1, unit\.maxHp\)/);
  assert.match(presentation, /내 전선 우세/);
  assert.match(presentation, /getCurrentMinimumInternalTouchTarget\(\)/);
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
