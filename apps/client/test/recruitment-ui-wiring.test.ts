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
  assert.match(main, /scene: \[BootScene, MainMenuScene, StageHubScene, StageSelectScene, BaseWeaponScene, DeckScene, CatalogScene, BattleScene, ResultScene\]/);
});

test('recruitment UI consumes banner odds and delegates the paid transaction to save authority', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /this\.banner\.ratesPermille\[rarity\] \/ 10/);
  assert.match(source, /this\.banner\.poolByRarity\[rarity\]\.length/);
  assert.match(source, /performGuestRecruitment\(count, CRYPTO_RECRUITMENT_RANDOM_SOURCE, this\.banner, this\.duplicatePolicy\)/);
  assert.match(source, /getGuestResourceBalance\(this\.progress, 'summon_crystal'\)/);
  assert.match(source, /getRecruitmentCost\(1\)/);
  assert.match(source, /getRecruitmentCost\(10\)/);
  assert.doesNotMatch(source, /Math\.random\(/);
});

test('all three initial series are selectable and restart preserves banner and duplicate policy', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /RECRUITMENT_BANNERS\.forEach/);
  assert.match(source, /getRecruitmentBanner\(data\.bannerId\)/);
  assert.match(source, /this\.scene\.restart\(\{ bannerId: banner\.id, duplicatePolicy: this\.duplicatePolicy \}\)/);
  assert.match(source, /SERIES_TAB_LABELS = \['성휘', '거수', '제로'\]/);
});

test('active-banner collection count is derived from that banner pool rather than every recruitment definition', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /const bannerCharacterIds = getBannerCharacterIds\(this\.banner\)/);
  assert.match(source, /bannerCharacterIds\.filter\(\(characterId\) => owned\.has\(characterId\)\)\.length/);
  assert.match(source, /bannerCharacterIds\.length/);
  assert.doesNotMatch(source, /RECRUITMENT_UNITS\.filter/);
});

test('recruitment UI communicates independent pulls and explicit duplicate conversion without pity or selector state', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /보장 횟수 없음/);
  assert.match(source, /각 모집은 독립 추첨/);
  assert.match(source, /\+1 우선/);
  assert.match(source, /분해 우선/);
  assert.match(source, /혼의 파편/);
  assert.doesNotMatch(source, /tenPullMinimumRarity|thirtyPullMinimumRarity|pickupSsGuaranteeEvery|selectionCreditEvery/);
  assert.doesNotMatch(source, /guaranteedBy|selectionCreditGranted|redeemGuestBannerSelection|selectionCredits/);
});

test('recruitment result screen distinguishes new, direct plus, dismantle, and persistence outcomes', async () => {
  const source = await readSource('../src/recruitment-scene.ts');
  assert.match(source, /pull\.duplicateResolution === 'DISMANTLE'/);
  assert.match(source, /pull\.duplicateResolution === 'PLUS'/);
  assert.match(source, /result\.results\.filter\(\(pull\) => !pull\.duplicate\)\.length/);
  assert.match(source, /result\.persisted \? '저장 완료' : '저장 실패'/);
  assert.match(source, /result\.dismantledSoulEssence/);
  assert.doesNotMatch(source, /GUARANTEE_LABELS|guaranteedBy|selectionCreditGranted/);
});
