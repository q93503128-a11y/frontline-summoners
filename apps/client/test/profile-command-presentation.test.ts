import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main routes profile through the presentation guard', async () => {
  const main = await readSource('../src/main.ts');
  assert.match(main, /import \{ ProfileScene \} from '\.\/profile-command-scene'/);
  assert.match(main, /game\.scene\.add\('profile', ProfileScene, false\)/);
});

test('profile presentation guard keeps loading copy verbatim before sanitizing internal failures', async () => {
  const presentation = await readSource('../src/profile-command-scene.ts');
  const loadingGuard = presentation.indexOf("if (/불러오는 중/.test(value)) return value;");
  const normalization = presentation.indexOf(".replace(/NORMAL_CLEAR/g, '클리어')");
  assert.ok(loadingGuard >= 0 && normalization > loadingGuard, 'loading state must be protected before presentation rewrites');
  assert.match(presentation, /HTTP_\|fetch\|network\|state hash\|revision\|requestId\|account_\|profile_/);
  assert.match(presentation, /지휘관 기록을 불러오지 못했습니다\. 연결 상태를 확인한 뒤 다시 시도해 주세요/);
  assert.match(presentation, /extends BaseProfileScene/);
  assert.doesNotMatch(presentation, /fetch\(|mutateAuthenticatedAccountProfile|loadAuthenticatedAccountProfile/);
});
