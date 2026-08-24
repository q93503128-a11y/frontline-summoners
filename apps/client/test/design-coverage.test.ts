import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readDoc(path: string): Promise<string> {
  return readFile(new URL(`../../../docs/${path}`, import.meta.url), 'utf8');
}

const mandatoryCoverageIds = [
  'DECK-01',
  'GACHA-01',
  'GACHA-02',
  'GACHA-03',
  'GACHA-04',
  'DUP-01',
  'LEVEL-01',
  'LEVEL-05',
  'EVO-01',
  'EVO-02',
  'EVO-06',
  'METAUI-03',
  'METAUI-04',
  'SAVE-05',
] as const;

test('initial full-design mandatory meta systems remain visible in the feature coverage matrix', async () => {
  const matrix = await readDoc('FEATURE_COVERAGE_MATRIX.md');
  for (const id of mandatoryCoverageIds) {
    assert.match(matrix, new RegExp(`\\| ${id.replace('-', '\\-')} \\|`), `${id} disappeared from mandatory feature coverage`);
  }
  assert.match(matrix, /전투 vertical slice 뒤로 영구 미뤄서는 안 되는 출시 전 필수 묶음/);
  assert.match(matrix, /보유 캐릭터가 10종을 넘으면 수동 10칸 덱/);
});

test('development authority docs must explicitly require the coverage matrix and recruitment-growth design', async () => {
  const [index, rules, handoff] = await Promise.all([
    readDoc('INDEX.md'),
    readDoc('DEVELOPMENT_RULES.md'),
    readDoc('NEW_CHAT_PROMPT.md'),
  ]);
  for (const doc of [index, rules, handoff]) {
    assert.match(doc, /GROWTH_RECRUITMENT_DESIGN\.md/);
    assert.match(doc, /FEATURE_COVERAGE_MATRIX\.md/);
  }
});
