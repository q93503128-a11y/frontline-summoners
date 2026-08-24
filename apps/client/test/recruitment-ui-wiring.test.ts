import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relative: string): Promise<string> => readFile(new URL(relative, import.meta.url), 'utf8');

test('main menu exposes recruitment and the scene is registered without replacing the core scene order', async () => {
  const [main, navigation] = await Promise.all([
    readSource('../src/main.ts'),
    readSource('../src/navigation-scenes.ts'),
  ]);
  assert.match(navigation, /'모 집', \(\) => this\.scene\.start\('recruitment'\)/);
  assert.match(main, /import \{ RecruitmentScene \} from '\.\/recruitment-scene';/);
  assert.match(main, /game\.scene\.add\('recruitment', RecruitmentScene, false\);/);
  assert.match(main, /scene: \[BootScene, MainMenuScene, StageHubScene, StageSelectScene, DeckScene, CatalogScene, BattleScene, ResultScene\]/);
});

test('recruitment UI consumes banner data and the save recruitment authority instead of duplicating roll rules', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /FIRST_RECRUITMENT_BANNER\.ratesPermille\[rarity\] \/ 10/);
  assert.match(source, /FIRST_RECRUITMENT_BANNER\.poolByRarity\[rarity\]\.length/);
  assert.match(source, /FIRST_RECRUITMENT_BANNER\.tenPullMinimumRarity/);
  assert.match(source, /FIRST_RECRUITMENT_BANNER\.thirtyPullMinimumRarity/);
  assert.match(source, /FIRST_RECRUITMENT_BANNER\.pickupSsGuaranteeEvery/);
  assert.match(source, /FIRST_RECRUITMENT_BANNER\.selectionCreditEvery/);
  assert.match(source, /performGuestRecruitment\(count, CRYPTO_RECRUITMENT_RANDOM_SOURCE, FIRST_RECRUITMENT_BANNER\)/);
  assert.doesNotMatch(source, /Math\.random\(/);
});

test('recruitment result screen exposes new, duplicate, guarantee, save, and selection-credit outcomes', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /pull\.duplicate \? '중복' : 'NEW'/);
  assert.match(source, /GUARANTEE_LABELS\[pull\.guaranteedBy\]/);
  assert.match(source, /pull\.selectionCreditGranted/);
  assert.match(source, /result\.persisted \? '저장 완료' : '영구 저장 실패 · 현재 탭 유지'/);
  assert.match(source, /result\.results\.filter\(\(pull\) => !pull\.duplicate\)\.length/);
});

test('100-pull banner selection stays a separate saved action and allows explicit banner character choice', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /bannerProgress\.selectionCredits <= 0/);
  assert.match(source, /RECRUITMENT_UNITS\.forEach\(\(unit, index\) =>/);
  assert.match(source, /redeemGuestBannerSelection\(characterId, FIRST_RECRUITMENT_BANNER\)/);
  assert.match(source, /result\.duplicate \? '중복' : '신규 획득'/);
});

test('unfinalized economy is not fabricated in the recruitment UI', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /모집 재화\/가격 미적용/);
  assert.match(source, /중복은 현재 판정만 저장 · 조각\/교환 경제는 아직 미적용/);
  assert.doesNotMatch(source, /보석|다이아|티켓 \d+|골드 \d+/);
});
