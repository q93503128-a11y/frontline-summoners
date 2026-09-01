from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing patch anchor in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'non-unique patch anchor in {path}: {text.count(old)}')
    p.write_text(text.replace(old, new, 1))


# 1) Scope the existing deterministic combat-quirk observer by owning player when requested.
path = 'packages/sim/src/combat-quirk-attribution.ts'
replace_once(
    path,
    "export type CombatQuirkFactId = (typeof COMBAT_QUIRK_FACT_IDS)[number];\n",
    "export type CombatQuirkFactId = (typeof COMBAT_QUIRK_FACT_IDS)[number];\n"
    "export type CombatQuirkPlayerUnitPredicate = (unit: BattleUnit) => boolean;\n",
)
replace_once(
    path,
    "export function captureCombatQuirkFrame(state: BattleState): CombatQuirkFrameCapture {\n",
    "export function captureCombatQuirkFrame(\n"
    "  state: BattleState,\n"
    "  playerUnitPredicate: CombatQuirkPlayerUnitPredicate = () => true,\n"
    "): CombatQuirkFrameCapture {\n",
)
replace_once(
    path,
    "    if (source.team !== 'PLAYER' || source.hp <= 0) continue;\n",
    "    if (source.team !== 'PLAYER' || source.hp <= 0 || !playerUnitPredicate(source)) continue;\n",
)
replace_once(
    path,
    "    turnipAliveBefore: state.units.filter(aliveForTurnipChallenge).length,\n",
    "    turnipAliveBefore: state.units.filter((unit) => aliveForTurnipChallenge(unit) && playerUnitPredicate(unit)).length,\n",
)
replace_once(
    path,
    "export function resolveCombatQuirkFacts(\n"
    "  capture: CombatQuirkFrameCapture,\n"
    "  stateAfterStep: BattleState,\n"
    "): readonly CombatQuirkFactId[] {\n"
    "  const facts = new Set<CombatQuirkFactId>();\n"
    "  const turnipAliveAfter = stateAfterStep.units.filter(aliveForTurnipChallenge).length;\n",
    "export function resolveCombatQuirkFacts(\n"
    "  capture: CombatQuirkFrameCapture,\n"
    "  stateAfterStep: BattleState,\n"
    "  playerUnitPredicate: CombatQuirkPlayerUnitPredicate = () => true,\n"
    "): readonly CombatQuirkFactId[] {\n"
    "  const facts = new Set<CombatQuirkFactId>();\n"
    "  const turnipAliveAfter = stateAfterStep.units.filter((unit) => aliveForTurnipChallenge(unit) && playerUnitPredicate(unit)).length;\n",
)

# 2) Resolve hidden combat facts per co-op seat around the same authoritative 30 Hz step.
path = 'packages/sim/src/coop-playable.ts'
replace_once(
    path,
    "} from './playable.ts';\n\nexport const COOP_PLAYABLE_SEATS",
    "} from './playable.ts';\n"
    "import {\n"
    "  captureCombatQuirkFrame,\n"
    "  resolveCombatQuirkFacts,\n"
    "  type CombatQuirkFactId,\n"
    "} from './combat-quirk-attribution.ts';\n\n"
    "export const COOP_PLAYABLE_SEATS",
)
replace_once(
    path,
    "export type CoopPlayableSeatId = (typeof COOP_PLAYABLE_SEATS)[number];\n",
    "export type CoopPlayableSeatId = (typeof COOP_PLAYABLE_SEATS)[number];\n"
    "export type CoopCombatQuirkFactsBySeat = Readonly<Record<CoopPlayableSeatId, readonly CombatQuirkFactId[]>>;\n",
)
replace_once(
    path,
    "export function applyCoopPlayableFrame(\n"
    "  state: CoopPlayableBattleState,\n"
    "  tick: number,\n"
    "  commandsBySeat: Readonly<Record<CoopPlayableSeatId, readonly CoopPlayableCommand[]>>,\n"
    "): { readonly outcomes: readonly CoopCommandOutcome[]; readonly snapshot: CoopPlayableSnapshot } {\n"
    "  if (tick !== state.shared.battle.tick) {\n"
    "    throw new Error(`co-op frame tick ${tick} does not match simulation tick ${state.shared.battle.tick}`);\n"
    "  }\n"
    "  const outcomes = [\n"
    "    ...applyCoopPlayableCommands(state, 'A', commandsBySeat.A),\n"
    "    ...applyCoopPlayableCommands(state, 'B', commandsBySeat.B),\n"
    "  ];\n"
    "  stepCoopPlayableBattle(state);\n"
    "  return { outcomes, snapshot: getCoopPlayableSnapshot(state) };\n"
    "}\n",
    "export function applyCoopPlayableFrame(\n"
    "  state: CoopPlayableBattleState,\n"
    "  tick: number,\n"
    "  commandsBySeat: Readonly<Record<CoopPlayableSeatId, readonly CoopPlayableCommand[]>>,\n"
    "): {\n"
    "  readonly outcomes: readonly CoopCommandOutcome[];\n"
    "  readonly snapshot: CoopPlayableSnapshot;\n"
    "  readonly quirkFactsBySeat: CoopCombatQuirkFactsBySeat;\n"
    "} {\n"
    "  if (tick !== state.shared.battle.tick) {\n"
    "    throw new Error(`co-op frame tick ${tick} does not match simulation tick ${state.shared.battle.tick}`);\n"
    "  }\n"
    "  const outcomes = [\n"
    "    ...applyCoopPlayableCommands(state, 'A', commandsBySeat.A),\n"
    "    ...applyCoopPlayableCommands(state, 'B', commandsBySeat.B),\n"
    "  ];\n"
    "  const ownedBy = (seatId: CoopPlayableSeatId) => (unit: { readonly simulationId: number }) =>\n"
    "    state.ownerBySimulationId[String(unit.simulationId)] === seatId;\n"
    "  const predicateA = ownedBy('A');\n"
    "  const predicateB = ownedBy('B');\n"
    "  const captures = {\n"
    "    A: captureCombatQuirkFrame(state.shared.battle, predicateA),\n"
    "    B: captureCombatQuirkFrame(state.shared.battle, predicateB),\n"
    "  } as const;\n"
    "  stepCoopPlayableBattle(state);\n"
    "  const quirkFactsBySeat: CoopCombatQuirkFactsBySeat = {\n"
    "    A: resolveCombatQuirkFacts(captures.A, state.shared.battle, predicateA),\n"
    "    B: resolveCombatQuirkFacts(captures.B, state.shared.battle, predicateB),\n"
    "  };\n"
    "  return { outcomes, snapshot: getCoopPlayableSnapshot(state), quirkFactsBySeat };\n"
    "}\n",
)

# 3) Server-owned account persistence for the canonical combat hidden facts.
path = 'apps/server/src/account-coop-authority.ts'
replace_once(
    path,
    "import type { CoopPlayerLoadout } from './coop-room.ts';\n",
    "import type { CoopPlayerLoadout } from './coop-room.ts';\n"
    "import { COMBAT_QUIRK_FACT_IDS, type CombatQuirkFactId } from '@frontline/sim/combat-quirk-attribution';\n\n"
    "const COMBAT_QUIRK_FACT_ID_SET = new Set<string>(COMBAT_QUIRK_FACT_IDS);\n",
)
replace_once(
    path,
    "export async function settleAuthenticatedCoopWin(\n",
    "export async function settleAuthenticatedCoopCombatFacts(\n"
    "  db: D1Database,\n"
    "  accountId: string,\n"
    "  factIds: readonly CombatQuirkFactId[],\n"
    "  nowMs = Date.now(),\n"
    "): Promise<readonly CombatQuirkFactId[]> {\n"
    "  const canonical = [...new Set(factIds.filter((factId) => COMBAT_QUIRK_FACT_ID_SET.has(factId)))];\n"
    "  for (const factId of canonical) await recordAccountAchievementFact(db, accountId, factId, nowMs);\n"
    "  return canonical;\n"
    "}\n\n"
    "export async function settleAuthenticatedCoopWin(\n",
)

# 4) Durable Object accumulates facts by seat and grants them for that seat on either win or loss.
path = 'apps/server/src/index.ts'
replace_once(
    path,
    "  type CoopPlayableBattleState,\n"
    "  type CoopPlayableCommand,\n"
    "} from '@frontline/sim/coop-playable';\n",
    "  type CoopCombatQuirkFactsBySeat,\n"
    "  type CoopPlayableBattleState,\n"
    "  type CoopPlayableCommand,\n"
    "} from '@frontline/sim/coop-playable';\n"
    "import type { CombatQuirkFactId } from '@frontline/sim/combat-quirk-attribution';\n",
)
replace_once(
    path,
    "import { getAccountCoopSeatAuthority, settleAuthenticatedCoopDiscoveries, settleAuthenticatedCoopWin } from './account-coop-authority.ts';\n",
    "import {\n"
    "  getAccountCoopSeatAuthority,\n"
    "  settleAuthenticatedCoopCombatFacts,\n"
    "  settleAuthenticatedCoopDiscoveries,\n"
    "  settleAuthenticatedCoopWin,\n"
    "} from './account-coop-authority.ts';\n",
)
replace_once(
    path,
    "  encounteredEnemyIds?: string[];\n"
    "  battle: CoopPlayableBattleState | null;\n",
    "  encounteredEnemyIds?: string[];\n"
    "  combatQuirkFactIdsBySeat?: Record<CoopSeatId, CombatQuirkFactId[]>;\n"
    "  battle: CoopPlayableBattleState | null;\n",
)
replace_once(
    path,
    "        encounteredEnemyIds: [],\n"
    "        battle: null,\n",
    "        encounteredEnemyIds: [],\n"
    "        combatQuirkFactIdsBySeat: { A: [], B: [] },\n"
    "        battle: null,\n",
)
replace_once(
    path,
    "  private applyCommittedFrames(record: StoredCoopRoom, frames: readonly CoopCommittedFrame[]): boolean {\n",
    "  private recordCombatQuirkFacts(record: StoredCoopRoom, factsBySeat: CoopCombatQuirkFactsBySeat): void {\n"
    "    const current = record.combatQuirkFactIdsBySeat ?? { A: [], B: [] };\n"
    "    for (const seatId of ['A', 'B'] as const) {\n"
    "      current[seatId] = [...new Set([...current[seatId], ...factsBySeat[seatId]])];\n"
    "    }\n"
    "    record.combatQuirkFactIdsBySeat = current;\n"
    "  }\n\n"
    "  private applyCommittedFrames(record: StoredCoopRoom, frames: readonly CoopCommittedFrame[]): boolean {\n",
)
replace_once(
    path,
    "      this.recordEncounteredEnemies(record, applied.snapshot);\n"
    "      this.broadcast({ type: 'FRAME_COMMITTED', frame, outcomes: applied.outcomes, battle: applied.snapshot });\n",
    "      this.recordEncounteredEnemies(record, applied.snapshot);\n"
    "      this.recordCombatQuirkFacts(record, applied.quirkFactsBySeat);\n"
    "      this.broadcast({ type: 'FRAME_COMMITTED', frame, outcomes: applied.outcomes, battle: applied.snapshot });\n",
)
replace_once(
    path,
    "        } else {\n"
    "          await settleAuthenticatedCoopDiscoveries(this.env.DB, accountId, discoveredEnemyIds);\n"
    "        }\n"
    "        record.settledSeats[seatId] = true;\n",
    "        } else {\n"
    "          await settleAuthenticatedCoopDiscoveries(this.env.DB, accountId, discoveredEnemyIds);\n"
    "        }\n"
    "        await settleAuthenticatedCoopCombatFacts(\n"
    "          this.env.DB,\n"
    "          accountId,\n"
    "          record.combatQuirkFactIdsBySeat?.[seatId] ?? [],\n"
    "        );\n"
    "        record.settledSeats[seatId] = true;\n",
)

# 5) Simulation regression coverage.
path = 'packages/sim/test/coop-playable.test.ts'
replace_once(
    path,
    "import type { BattleUnitDefinition } from '../src/index.ts';\n",
    "import { spawnUnit, type BattleUnitDefinition } from '../src/index.ts';\n"
    "import { TURNIP_RIDER_CHARACTER_ID } from '../src/combat-quirk-attribution.ts';\n",
)
p = Path(path)
text = p.read_text()
if "co-op five-turnip hidden fact is attributed per seat" in text:
    raise SystemExit('coop attribution regression test already exists')
text = text.rstrip() + "\n\n" + """test('co-op five-turnip hidden fact is attributed per seat instead of combining teammates', () => {
  const state = createCoopPlayableBattle(config());
  const addTurnip = (seatId: 'A' | 'B', x: number): void => {
    const spawned = spawnUnit(state.shared.battle, unit(TURNIP_RIDER_CHARACTER_ID, { attackDamage: 0 }), 'PLAYER', x);
    state.ownerBySimulationId[String(spawned.simulationId)] = seatId;
  };
  for (const x of [100, 120, 140]) addTurnip('A', x);
  for (const x of [160, 180]) addTurnip('B', x);

  const mixed = applyCoopPlayableFrame(state, 0, { A: [], B: [] });
  assert.ok(!mixed.quirkFactsBySeat.A.includes('quirk_turnip_five'));
  assert.ok(!mixed.quirkFactsBySeat.B.includes('quirk_turnip_five'));

  addTurnip('A', 200);
  addTurnip('A', 220);
  const attributed = applyCoopPlayableFrame(state, 1, { A: [], B: [] });
  assert.ok(attributed.quirkFactsBySeat.A.includes('quirk_turnip_five'));
  assert.ok(!attributed.quirkFactsBySeat.B.includes('quirk_turnip_five'));
});
""" + "\n"
p.write_text(text)

# 6) Server source-wiring regression coverage.
path = 'apps/server/test/social-coop-authority.test.ts'
p = Path(path)
text = p.read_text()
if "authenticated co-op persists combat hidden facts" in text:
    raise SystemExit('server attribution wiring test already exists')
text = text.rstrip() + "\n\n" + """test('authenticated co-op persists combat hidden facts for the owning seat on wins or losses', async () => {
  const [roomSource, authoritySource] = await Promise.all([
    readSource('../src/index.ts'),
    readSource('../src/account-coop-authority.ts'),
  ]);
  assert.match(roomSource, /combatQuirkFactIdsBySeat\\?: Record<CoopSeatId, CombatQuirkFactId\\[\\]>/);
  assert.match(roomSource, /recordCombatQuirkFacts\\(record, applied\\.quirkFactsBySeat\\)/);
  assert.match(roomSource, /record\\.combatQuirkFactIdsBySeat\\?\\.\\[seatId\\] \\?\\? \\[\\]/);
  assert.match(roomSource, /await settleAuthenticatedCoopCombatFacts\\(/);
  assert.match(authoritySource, /COMBAT_QUIRK_FACT_IDS/);
  assert.match(authoritySource, /recordAccountAchievementFact\\(db, accountId, factId, nowMs\\)/);
});
""" + "\n"
p.write_text(text)

# 7) Implementation note. Do not promote to TESTED/LOCKED until actual multiplayer QA.
Path('docs/content-wiki/systems/COOP_HIDDEN_ACHIEVEMENT_ATTRIBUTION_IMPLEMENTATION_2026-09-01.md').write_text("""# 협동 숨김 업적 좌석 귀속 구현 — 2026-09-01

상태: **IMPLEMENTED / automated coverage authored / human multiplayer QA pending**

## 목적

협동전은 두 플레이어가 하나의 PLAYER 팀 BattleState를 공유한다. 기존 전투 숨김 업적 판정기를 팀 전체에 적용하면 서로 다른 플레이어의 유닛이 합쳐져 한 계정의 업적으로 잘못 귀속될 수 있다. 이 구현은 전투 판정 자체를 바꾸지 않고 이미 존재하는 `ownerBySimulationId`를 이용해 판정 source를 좌석 A/B로 분리한다.

## 구현

- `captureCombatQuirkFrame` / `resolveCombatQuirkFacts`에 선택적 PLAYER-unit predicate를 추가했다. 기본값은 전체 PLAYER 유닛이므로 SOLO 동작은 유지된다.
- `applyCoopPlayableFrame`은 같은 authoritative frame에서 A/B 각각 capture → 공용 30Hz step → A/B resolve를 수행한다.
- 대상 적과 적 기지는 공용 전장 그대로 사용한다. 종껍질 게와 태엽오리기사 판정은 실제 공유 적을 보되 공격 source만 소유 좌석으로 제한된다.
- `quirk_turnip_five`는 각 좌석 소유 순무기수만 센다. A 3기 + B 2기는 누구에게도 5기 업적으로 처리되지 않는다.
- Durable Object는 프레임에서 발생한 fact를 `combatQuirkFactIdsBySeat`에 좌석별 union으로 누적한다. 필드는 optional이라 기존 `coop-room-v5` 저장값도 읽을 수 있다.
- 인증 계정 settlement 시 승리/패배와 무관하게 해당 좌석에 누적된 canonical combat quirk fact만 `recordAccountAchievementFact`로 기록한다. 이 세 숨김 업적 정의가 승리를 요구하지 않기 때문이다.
- 클라이언트 제출값으로 업적 fact를 만들지 않는다. 판정과 귀속은 simulation + Durable Object + account authority만 사용한다.

## 자동 회귀 범위

- 협동 A 3기 + B 2기 순무기수가 섞여도 어느 좌석도 `quirk_turnip_five`를 얻지 않는 테스트를 추가했다.
- 같은 전투에서 A가 자체 5기를 채우면 A만 fact를 받는 테스트를 추가했다.
- 서버 wiring 테스트는 per-seat 누적과 승패 공통 account settlement 경로를 고정한다.

## 남은 검증

실제 두 계정/두 브라우저 협동에서 세 숨김 업적 각각을 달성해 프로필 업적/장식 해금까지 확인하기 전에는 TESTED 또는 LOCKED로 승격하지 않는다.
""")

# Self-delete the temporary patch machinery from the feature commit.
Path('.github/workflows/dev-apply-coop-quirk-attribution.yml').unlink()
Path('tools/dev-apply-coop-quirk-attribution.py').unlink()
