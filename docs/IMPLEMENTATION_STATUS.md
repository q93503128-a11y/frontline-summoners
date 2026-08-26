# Frontline Summoners 구현 상태 — v1.0 재감사 대기

기준일: 2026-08-26  
최상위 정본: `docs/CANONICAL.md`

> **중요:** 2026-08-26 현재 기획서/콘텐츠 바이블을 크게 세밀화하는 문서 전용 패스를 진행했다. 이 패스에서는 최신 코드, content JSON, save migration, test, CI를 다시 전수검증하지 않았다. 이전 개발 과정에서 기반 코드가 여러 차례 변경됐으므로 이 파일이 과거 스냅샷을 “현재 구현”처럼 단정하지 않게 한다. 다음 구현 작업의 첫 단계는 반드시 repo-wide implementation audit이다.

이 문서는 당분간 `현재 무엇이 구현됐다고 확정할 수 있는가`보다 **무엇을 다시 검증해야 하는가**를 기록한다.

---

# 1. 설계는 어디를 읽는가

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/GROWTH_RECRUITMENT_DESIGN.md`
4. `docs/STAGE_SYSTEM_DESIGN.md`
5. 관련 `docs/content-wiki/`
6. `docs/FEATURE_COVERAGE_MATRIX.md`

이 파일은 기획 정본이 아니다.

---

# 2. 코드 감사 전 재사용 가치가 높은 것으로 알려진 기반

아래 항목은 과거 감사/개발에서 존재가 확인됐던 기반이지만 **현재 main에서 다시 확인하기 전 VERIFIED_DONE이라고 부르지 않는다.**

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

# 3. 다음 코드 감사에서 반드시 확인할 레거시

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

# 4. 새 v1 설계와 구현을 비교할 핵심 축

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

# 5. 재감사 후 상태 표기

코드 감사 후 `FEATURE_COVERAGE_MATRIX.md`의 구현 검증 열을 다음으로 갱신한다.

- `VERIFIED_DONE`
- `VERIFIED_PARTIAL`
- `VERIFIED_MISSING`

단순 파일 존재로 DONE 처리하지 않는다.

예:

`recruitment.ts`가 있어도 실제 UI→재화차감→결과→소유/중복→저장까지 연결되지 않으면 DONE이 아니다.

---

# 6. 실제 구현 순서 후보

재감사 뒤 아직 필요하다면 다음 순서를 기본으로 한다.

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

실제 사용자 메타 루프 연결.

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

# 7. 코드 감사 필수 명령 범주

실제 repository script 명칭은 `package.json`을 다시 읽고 사용한다.

최소 범주:

- install
- typecheck
- unit/integration tests
- content/schema validation
- deterministic baseline
- build
- 필요 시 server tests

과거 run 결과를 최신 HEAD 결과처럼 재사용하지 않는다.

---

# 8. 문서 전용 패스에서 완료된 것

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

# 9. 1차 완성 후 범위

아직 구현 목록에 섞지 않는다.

- 본능 대응 후반 성장
- 난이도 9~12 본격 콘텐츠
- 메인 5장 이후
- 추가 모집 시리즈
- 2v2 랭킹

---

# 10. 다음 구현 작업 시작 조건

문서 작업이 종료된 뒤 사용자가 구현을 지시하면:

1. 현재 main HEAD 재확인
2. repository tree/inventory
3. package scripts
4. content/schema/save/sim/UI/test 전수 검색
5. 위의 레거시 키워드 감사
6. FEATURE_COVERAGE_MATRIX 구현 열 갱신
7. 그 결과에 따라 첫 coherent slice 구현

이 과정을 거치기 전 `현재 오류 다 고쳐졌다`, `기능이 구현됐다`, `CI green이다` 같은 주장을 하지 않는다.
