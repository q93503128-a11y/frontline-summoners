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

test('recruitment UI consumes banner data and save authority without duplicating roll rules', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /FIRST_RECRUITMENT_BANNER\.ratesPermille\[rarity\] \/ 10/);
  assert.match(source, /FIRST_RECRUITMENT_BANNER\.poolByRarity\[rarity\]\.length/);
  assert.match(source, /performGuestRecruitment\(count, CRYPTO_RECRUITMENT_RANDOM_SOURCE, FIRST_RECRUITMENT_BANNER\)/);
  assert.doesNotMatch(source, /Math\.random\(/);
});

test('active-banner collection count is derived from the actual banner pool rather than every recruitment definition', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /const BANNER_CHARACTER_IDS = RARITY_ORDER\.flatMap\(\(rarity\) => FIRST_RECRUITMENT_BANNER\.poolByRarity\[rarity\]\);/);
  assert.match(source, /BANNER_CHARACTER_IDS\.filter\(\(characterId\) => owned\.has\(characterId\)\)\.length/);
  assert.match(source, /BANNER_CHARACTER_IDS\.length/);
  assert.doesNotMatch(source, /RECRUITMENT_UNITS\.filter/);
});

test('recruitment UI explicitly communicates independent pulls and contains no pity, milestone guarantee, or selector flow', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /보장 횟수 없음/);
  assert.match(source, /각 모집은 독립 추첨/);
  assert.doesNotMatch(source, /tenPullMinimumRarity|thirtyPullMinimumRarity|pickupSsGuaranteeEvery|selectionCreditEvery/);
  assert.doesNotMatch(source, /guaranteedBy|selectionCreditGranted|redeemGuestBannerSelection|selectionCredits/);
});

test('recruitment result screen exposes new, duplicate, and persistence outcomes only', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /pull\.duplicate \? '중복' : 'NEW'/);
  assert.match(source, /result\.results\.filter\(\(pull\) => !pull\.duplicate\)\.length/);
  assert.match(source, /result\.persisted \? '저장 완료' : '저장에 실패했습니다'/);
  assert.doesNotMatch(source, /GUARANTEE_LABELS|guaranteedBy|selectionCreditGranted/);
});
