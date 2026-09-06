import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main keeps social on the command presentation adapter', async () => {
  const main = await readSource('../src/main.ts');
  assert.match(main, /import \{ SocialCommandScene as SocialScene \} from '\.\/social-command-scene'/);
  assert.match(main, /game\.scene\.add\('social', SocialScene, false\)/);
});

test('social adapter sanitizes both created and later-updated text', async () => {
  const social = await readSource('../src/social-command-scene.ts');
  assert.match(social, /installDynamicTextSanitizer\(created\)/);
  assert.match(social, /text\.setText =/);

  for (const token of [
    'HTTP_',
    'fetch',
    'network',
    'websocket',
    'state hash',
    'revision',
    'requestId',
    'matchId',
    'seatId',
    'roomId',
    'queueId',
  ]) {
    assert.ok(social.includes(token), `social presentation sanitizer must cover ${token}`);
  }

  assert.match(social, /\(\?:social\|friendly\|pvp\|coop\|account\)_\[a-z0-9_\]\+/);
  assert.match(social, /요청을 처리하지 못했습니다\. 다시 시도해 주세요/);
  assert.match(social, /프로필 장식 적용/);
});
