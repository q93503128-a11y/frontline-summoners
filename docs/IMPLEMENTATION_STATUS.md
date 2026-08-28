# Frontline Summoners 구현 상태 — v1.0 증분 재감사 진행 중

기준일: 2026-08-28  
최상위 정본: `docs/CANONICAL.md`

> **중요:** 2026-08-26 문서 세밀화 패스 뒤 실제 `main`의 코드·content·save·test·CI를 다시 읽는 증분 구현 감사를 시작했다. 이 문서는 이제 과거 구현을 추측하지 않고, 직접 코드/테스트/CI로 확인한 범위만 `검증됨`으로 기록한다. 아직 읽지 않은 온라인/PvP/후반 성장 등의 영역은 계속 재감사 대상으로 남긴다.

이 파일은 기획 정본이 아니다. 현재 구현 사실을 기록하되, 전수감사가 끝나지 않은 영역을 완료라고 확대 해석하지 않는다.

---

# 1. 설계는 어디를 읽는가

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/GROWTH_RECRUITMENT_DESIGN.md`
4. `docs/STAGE_SYSTEM_DESIGN.md`
5. 관련 `docs/content-wiki/`
6. `docs/FEATURE_COVERAGE_MATRIX.md`

---

# 2. 2026-08-28 현재 직접 검증된 구현 슬라이스

현재 `main`에서 다음 범위는 소스와 회귀 테스트를 직접 대조했고 GitHub Actions CI #606의 typecheck/content schema/simulation/client suite/build가 모두 통과했다.

## 도감/소유/출현 적

- 플레이어 로스터 실행 데이터는 현재 43종을 페이지 처리한다.
- 미획득 아군은 도감에서 `???`와 실루엣으로 숨긴다.
- 편성 목록은 `getOwnedCharacterIds()`로 실제 보유 캐릭터만 필터링한다.
- 적 도감은 `discoveredEnemyIds`를 사용한다.
- 적은 stage JSON에 존재한다는 이유로 발견되지 않고 실제 전투 시뮬레이션에서 스폰된 뒤 발견 기록이 저장된다.
- 미발견 적은 이름/수치/특성 대신 `???`와 실루엣을 표시한다.
- 발견한 적은 HP, 공격력, 사거리, 전투 특성, 피해 특화, 처치 보급 등 현재 구현된 상세 전투 정보를 게임 안에서 확인할 수 있다.
- 스테이지 선택 카드에서 고유 출현 적의 발견 수를 확인할 수 있다.
- `출현 적` 모달에서도 미발견 적 이름은 노출하지 않는다.
- 출현 적을 누르면 적 도감의 해당 페이지/카드로 직접 이동하고, 돌아오면 원래 스테이지 collection/page를 복원한다.

## 저장

- 게스트 저장 schema는 현재 v10이다.
- `discoveredEnemyIds`가 영구 저장된다.
- v2~v9 저장을 받아 현재 구조로 migration하는 계약이 회귀 테스트에 포함된다.
- 기존 progression/permanent reward/NORMAL_CLEAR 정규화 계약도 같은 테스트 스위트에서 유지된다.

## 실제 전투 경로

- `main.ts`가 등록하는 전투 Scene은 `ReplayBattleScene`이고, 이 클래스는 `BattleScene`을 상속한다.
- 따라서 `BattleScene`의 시뮬레이션 step, 적 spawn 관찰, 결과 흐름은 실제 런타임 경로다.
- NORMAL_CLEAR 기반 2배속 편의는 이 상속 경로 위에 덧붙여져 있으며 전투 simulation 자체를 별도로 복제하지 않는다.

## 이번 검증의 한계

- 위 확인은 저장/도감/스테이지 출현 적 연결과 그 주변 회귀 범위에 대한 증분 감사다.
- 협동 서버, 친구, 계정 서버 정본, PvP, 메인 2~4장 전체, 모든 SPECIAL, 전체 성장/+레벨/진화 사용자 루프를 이번 슬라이스에서 전수검증했다고 보지 않는다.
- 따라서 이들 영역은 `FEATURE_COVERAGE_MATRIX.md`에서 계속 `RE-AUDIT` 상태를 유지한다.

---

# 3. 재사용 가치가 높은 것으로 알려진 기반

아래 항목은 과거 감사/개발에서 존재가 확인됐던 기반이다. 이번 증분 감사에서 직접 다룬 범위를 제외하면 **현재 main에서 다시 확인하기 전 VERIFIED_DONE이라고 부르지 않는다.**

- `packages/sim` 중심 30Hz 결정론 전투 구조
- 이동/standing range/공격 frame/KB/사망
- 보급/보급소/생산
- 스테이지 wave 기반 구조
- 브라우저 클라이언트/Phaser
- Workers/Durable Objects 기반 서버 구조 일부
- 게스트 저장 기반
- 캐릭터 소유/level/form/deck 관련 코드 일부
- 모집/성장/진화 프로토타입 코드 일부
- 제1장/기존 SPECIAL 프로토타입 content

이 기반은 `삭제 대상`이라고 가정하지도, `완료`라고 가정하지도 않는다. 새 정본과 비교해서 살릴 것과 교체할 것을 결정한다.

---

# 4. 남은 코드 감사에서 반드시 확인할 레거시

다음 항목은 v1 설계에서 폐기되었으므로 현재 main에 활성 경로가 남아 있으면 정리 대상이다.

- `LIGHT` 기반 옛 속성
- `ARMORED`, `BOSS`를 속성 enum으로 쓰는 구조
- `FLYING` 태그 — 공식은 `FLOATING`
- 스토리 캐릭터 C/B/A/S/SS 희귀도
- X 희귀도
- 10/30/60/100 모집 보장
- pity/selectionCredits/직접선택
- Lv50 약 ×1.595 성장곡선
- 이동속도 영구 보물
- 아군 출격한도 영구 보물
- -1F 같은 저체감 재생산 보물의 구식 처리
- SPECIAL 5개가 전체 특수 콘텐츠라고 가정하는 UI/data
- 난이도 9~10을 1차 프로토타입 SPECIAL에 억지 지정한 구식 데이터
- 메인 전체를 솔로 전용으로 고정한 gate
- 별도 협동용 복제 스테이지만 허용하는 구조
- 개발자 문구/내부 ID/save version의 플레이어 UI 노출

레거시 검색 결과가 0인지 직접 확인한다.

---

# 5. 새 v1 설계와 구현을 비교할 핵심 축

## 데이터/schema

- acquisitionClass
- nullable rarity
- seriesId
- attributes[]
- combatTags[]
- roles[]
- F1/F2/F3
- +level
- final recharge clamp 60F
- stage multiplayerPolicy
- NORMAL_CLEAR
- speedUpEligibility
- sweepEligibility
- rewardChargePolicy
- coopStatScaling
- record milestones
- PvP standardization

## 저장

- 현재 schemaVersion
- 구버전 migration
- +level/form/deck
- 모집 레거시 필드 제거 여부
- 게스트 progression
- 서버 계정 save 여부
- idempotency/revision 구조

## 콘텐츠

- 실제 플레이어 unit 수/분류
- 실제 enemy/boss 수
- 현재 main stage 수
- current SPECIAL collections
- 영구 보상
- 배너/확률
- level curve
- evolution data

## UI

- 편성/드래그
- 도감 unknown 처리
- 모집
- 성장/진화
- 2배속/소탕
- 친구/협동/PvP
- 개발자 문구

---

# 6. 재감사 상태 표기

`FEATURE_COVERAGE_MATRIX.md`의 구현 검증 열은 다음으로 갱신한다.

- `VERIFIED_DONE`
- `VERIFIED_PARTIAL`
- `VERIFIED_MISSING`
- `RE-AUDIT`

단순 파일 존재로 DONE 처리하지 않는다.

예:

`recruitment.ts`가 있어도 실제 UI→재화차감→결과→소유/중복→저장까지 연결되지 않으면 DONE이 아니다.

---

# 7. 실제 구현 순서 후보

재감사를 병행하면서 아직 필요하다면 다음 순서를 기본으로 한다.

## P0 — 레거시/기반 정리

- schema/필드 충돌
- save migration
- 구식 희귀도/속성/천장/보물
- 60F 하한

## P1 — v1 데이터 골격

- 8속성/태그
- STORY vs RECRUITMENT
- series/rank
- +level
- stage collection/multiplayer/charge/sweep

## P2 — 대표 로스터 플레이테스트

43종 숫자를 한 번에 LOCKED하지 않는다.

- 스토리 대표 역할
- 공통 C/B/A 대표
- 각 시리즈 S/SS 대표

를 실제 전투로 검증해 밸런스 언어를 먼저 만든다.

## P3 — 메인 1장 재완성

문서의 CH1 상세 spec을 실제 JSON/sim에 연결하고 난이도 1~6을 재측정한다.

## P4 — 성장/편성/도감/모집

실제 사용자 메타 루프 연결. 도감 unknown/출현 적 직접 이동은 2026-08-28 증분 감사에서 구현·검증됨.

## P5 — 2~4장 + SPECIAL

80메인과 1차 SPECIAL 범위 완성.

## P6 — 온라인

친구 → 같은 stage 협동 → 재접속 → 일반 PvP → 랭킹 → 친선/2v2.

## P7 — 릴리스 QA

- 자동검증
- 사람 플레이
- PC/모바일
- 저장 migration
- reconnect
- 문서/실행값 정합
- 레거시 참조 0

---

# 8. 코드 감사 필수 명령 범주

실제 repository script 명칭은 `package.json`을 다시 읽고 사용한다.

최소 범주:

- install
- typecheck
- unit/integration tests
- content/schema validation
- deterministic baseline
- build
- 필요 시 server tests

과거 run 결과를 최신 HEAD 결과처럼 재사용하지 않는다. 각 구현 묶음은 해당 HEAD의 새 CI로 확인한다.

---

# 9. 문서 전용 패스에서 완료된 것

이 항목은 **기획 문서 작성 완료**를 뜻하며 구현 완료가 아니다.

- 통합 v1.2 기획
- 콘텐츠 바이블 권위/상태 규칙
- 스토리 10 설계/전투 목표
- 공통 C/B/A 15 설계/전투 목표
- 초기 3시리즈 S15/SS3 설계/전투 목표
- 메인 일반 적 32 / 보스 8 설계
- SPECIAL 전용 적/보스 설계
- 메인 80 stage 상세 timeline 목표
- SPECIAL 주기/상시/이벤트/기록 상세 목표
- Lv/+Lv/골드/진화 재료 목표
- 80 영구 보상 목표
- 난이도 측정 규칙
- 2배속/소탕/보상충전
- 친구/협동/PvP
- PvP MMR/티어/보상
- 계정/save/sync/delete
- UI/도감
- 43종 공격 contact frame 목표

---

# 10. 1차 완성 후 범위

아직 구현 목록에 섞지 않는다.

- 본능 대응 후반 성장
- 난이도 9~12 본격 콘텐츠
- 메인 5장 이후
- 추가 모집 시리즈
- 2v2 랭킹

---

# 11. 다음 구현 작업 시작 조건

다음 coherent slice를 시작할 때:

1. 현재 main HEAD 재확인
2. 작업 대상과 직접 연결된 코드/data/test/문서 재확인
3. 관련 레거시와 반대 경로 검색
4. 구현과 회귀 테스트를 같은 묶음으로 반영
5. 새 HEAD의 typecheck/content schema/simulation/client suite/build 확인
6. 확인된 범위만 `FEATURE_COVERAGE_MATRIX.md`에 증분 반영

전체 repository audit이 끝나지 않았다는 이유로 이미 직접 검증한 기능을 다시 `RE-AUDIT`으로 되돌리지 않고, 반대로 부분 감사를 전체 v1 완료로 확대하지 않는다.
