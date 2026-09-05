import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const updates = [
  {
    path: 'docs/CANONICAL.md',
    replacements: [
      ['## 13. NORMAL_CLEAR, 2배속, 소탕', '## 13. NORMAL_CLEAR, 배속, 소탕'],
      [
        '- 해당 스테이지 NORMAL_CLEAR 후 무료 1×/2× 재클리어를 사용할 수 있다.',
        '- 모든 일반 MAIN/SPECIAL 직접 전투는 최초 도전부터 무료 1×/2× 전환을 사용할 수 있다.\n- 해당 스테이지 NORMAL_CLEAR 후 무료 3×가 추가 해금되어 1×/2×/3× 전환을 사용할 수 있다.',
      ],
    ],
  },
  {
    path: 'docs/GAME_DESIGN_FULL.md',
    replacements: [
      ['- 정상 클리어 후 무료 2배속', '- 최초 도전부터 무료 2배속 + 해당 스테이지 정상 클리어 후 무료 3배속'],
    ],
  },
  {
    path: 'docs/STAGE_SYSTEM_DESIGN.md',
    replacements: [
      ['- 재클리어 2배속', '- 해당 스테이지 3배속'],
      [
        `## 6. 2배속

- 최초 NORMAL_CLEAR 전: 기본 1×.
- NORMAL_CLEAR 후: 해당 스테이지 1×/2× 무료 전환 가능.
- 소모품 아님.
- simulation 규칙/결과/보상 동일.
- PvP에는 사용하지 않는다.
- 기록 SPECIAL은 1× 고정을 기본 후보로 한다.
- 2배속에서도 보스 공격 예고와 위험 VFX가 판독 가능해야 한다.`,
        `## 6. 배속

- 최초 NORMAL_CLEAR 전부터 해당 스테이지 1×/2× 무료 전환 가능.
- NORMAL_CLEAR 후: 해당 스테이지에 3×가 추가 해금되어 1×/2×/3× 무료 전환 가능.
- 전투 시작 기본값은 1×이며 2×가 처음부터 사용 가능하다는 의미다.
- 소모품 아님.
- simulation 규칙/결과/보상 동일.
- PvP에는 사용하지 않는다.
- 기록 SPECIAL은 1× 고정을 기본 후보로 한다.
- 2×/3×에서도 보스 공격 예고와 위험 VFX가 판독 가능해야 한다.`,
      ],
    ],
  },
];

for (const update of updates) {
  const file = resolve(update.path);
  let text = await readFile(file, 'utf8');
  for (const [from, to] of update.replacements) {
    if (text.includes(to)) continue;
    if (!text.includes(from)) throw new Error(`[battle-speed-docs] missing expected canonical text in ${update.path}: ${from.slice(0, 80)}`);
    text = text.replace(from, to);
  }
  await writeFile(file, text);
  console.log(`[battle-speed-docs] canonicalized ${update.path}`);
}

const canonical = await readFile(resolve('docs/CANONICAL.md'), 'utf8');
const full = await readFile(resolve('docs/GAME_DESIGN_FULL.md'), 'utf8');
const stages = await readFile(resolve('docs/STAGE_SYSTEM_DESIGN.md'), 'utf8');
if (!canonical.includes('최초 도전부터 무료 1×/2×') || !canonical.includes('NORMAL_CLEAR 후 무료 3×')) throw new Error('[battle-speed-docs] CANONICAL speed rule missing');
if (!full.includes('최초 도전부터 무료 2배속 + 해당 스테이지 정상 클리어 후 무료 3배속')) throw new Error('[battle-speed-docs] GAME_DESIGN_FULL speed rule missing');
if (!stages.includes('최초 NORMAL_CLEAR 전부터 해당 스테이지 1×/2×') || !stages.includes('1×/2×/3× 무료 전환')) throw new Error('[battle-speed-docs] STAGE_SYSTEM_DESIGN speed rule missing');
