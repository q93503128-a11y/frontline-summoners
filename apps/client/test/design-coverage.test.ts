import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readDoc(path: string): Promise<string> {
  return readFile(new URL(`../../../docs/${path}`, import.meta.url), 'utf8');
}

const mandatoryCoverageIds = [
  'BATTLE-05',
  'CODEX-01',
  'CODEX-02',
  'GACHA-01',
  'GACHA-04',
  'LEVEL-01',
  'PLUS-03',
  'EVO-01',
  'EVO-02',
  'PERM-04',
  'PERM-05',
  'UI-03',
  'SAVE-03',
  'SAVE-05',
] as const;

test('v1 mandatory meta and battle rules remain visible in the current feature coverage matrix', async () => {
  const matrix = await readDoc('FEATURE_COVERAGE_MATRIX.md');
  for (const id of mandatoryCoverageIds) {
    assert.match(matrix, new RegExp(`\\| ${id.replace('-', '\\-')} \\|`), `${id} disappeared from mandatory feature coverage`);
  }
  assert.match(matrix, /무천장\/무직접선택/);
  assert.match(matrix, /미획득 아군 \?\?\?/);
  assert.match(matrix, /이동속도 증가 금지/);
  assert.match(matrix, /출격한도 영구 증가 금지/);
});

test('development authority docs explicitly retain the coverage matrix and recruitment-growth design', async () => {
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
