# Story / Chapter 1 Canonical Migration — 2026-08-30

상태: `IMPLEMENTED / DESIGN_TARGET, PLAYTEST PENDING`

상위 정본:
- `docs/content-wiki/characters/STORY_ROSTER_V1_COMBAT_SPECS.md`
- `docs/content-wiki/enemies/INITIAL_ENEMY_ROSTER_V1_COMBAT_SPECS.md`
- `docs/content-wiki/bosses/INITIAL_BOSSES_V1_COMBAT_SPECS.md`

## 목적

초기 프로토타입 시절의 과도한 수치와 잘못 섞인 ARCANE 적군을 제거하고,
제1장을 `NEUTRAL → BEAST` 속성 학습과 스토리 10종의 역할 학습 구간으로 다시 맞춘다.

## 스토리 캐릭터

10종 F1을 상세 전투사양의 Lv1 목표로 이행했다.

- 징집병: 저비용 물량.
- 방벽기사: 순수 전열.
- 수렵창병: BEAST 특효 장거리 단일.
- 결투검사: 빠른 근접 단일 DPS.
- 청창대: 튼튼한 중거리.
- 전투마도사: 안정 중거리 광역.
- 화염술사: 느린 고화력 광역 + NATURE 특효.
- 왕실기사: 비싼 중장 광역 전열.
- 이단주술사: 사각을 가진 장거리 광역.
- 공허현자: 고비용 결정타.

기존 저장/편성 호환성을 위해 runtime character id (`militia`, `guard` 등)는 유지한다.
이는 combat design의 변경이 아니라 save compatibility 식별자 유지다.

## 진화 형태

스토리 10종의 기존 role-template F2/F3를 20개의 explicit form으로 교체했다.

generic evolution modifier grammar에 다음을 추가했다.

- fractional `moveSpeedDelta`
- absolute `naturalKnockbackCount`
- absolute `attackTiming`
  - `cycleFrames`
  - `hitFrames`
  - `backswingFrames`
- 기존 `targetMode` explicit parsing

따라서 형태별 공속/선딜/KB/광역 전환을 캐릭터 ID 분기 없이 데이터로 표현한다.

공허현자 F3의 3-hit 20/20/60 분할은 원문에서도 후보안이며,
현재 generic per-hit damage split grammar가 없으므로 이번 이행에서 억지로 3회 풀데미지로 만들지 않았다.

## 제1장 적/보스

기존 runtime enemy id는 save/codex 호환을 위해 유지하되 전투 정체성을 상세 목표로 교체했다.

- `enemy-raider` → 약탈병
- `enemy-sprinter` → 달림개
- `enemy-spearman` → 긴목창잡이
- `enemy-shield` → 냄비방패
- `enemy-cultist` → 검은 깃발지기
- `enemy-sniper` → 유리봉 사수
- `enemy-knight` → 굴렁통 멧돼지
- `enemy-berserker` → 철퇴 난동꾼
- `enemy-boss` → 황금가면 사령술사
- `enemy-boss-iron` → 철문장군

실행 속성군은 `NEUTRAL`, `BEAST`만 사용한다.
황금가면 사령술사는 명시적으로 ARCANE이 아니며 `NEUTRAL + BOSS`다.
철문장군은 `NEUTRAL + ARMORED + BOSS`다.

## 보존한 것

- 제1장 20개 stage geometry / trigger / unlock 순서.
- 영구 보상.
- story unlock stage.
- save character/enemy identifiers.
- temporary art mapping.
- F2/F3 진화 recipe 비용.

## 아직 LOCKED가 아닌 것

- 사람 플레이테스트 전이므로 모든 새 수치는 `DESIGN_TARGET`.
- 일부 후보 specialty/tag는 보수적으로 제외하거나 최소 구현만 적용.
- 공허현자 F3 per-hit damage split은 generic grammar 후 검토.
- 최종 캐릭터/적 아트와 고유 공격 모션은 production art 단계에서 수행.
