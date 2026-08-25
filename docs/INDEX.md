# Frontline Summoners 문서 인덱스 v1.0

문서는 **전체 규칙 / 시스템 정밀 규칙 / 콘텐츠 개별 정본 / 구현 상태**를 분리한다. 같은 정보를 여러 문서에 독립적으로 복제해 두 정본이 생기지 않게 한다.

## 읽는 순서

### 1. `CANONICAL.md`
최상위 정본.

- 1차 완성 범위
- 전투/경제/성장/모집/희귀도 핵심
- 초기 4장 80스테이지
- 초기 모집 시리즈 3개
- SPECIAL/소탕/난이도
- 협동/친구/PvP
- UI/계정/개발 원칙

다른 모든 문서는 이 문서와 충돌할 수 없다.

### 2. 관련 시스템 정밀 문서

#### `GROWTH_RECRUITMENT_DESIGN.md`
- 스토리 캐릭터와 모집 희귀도 분리
- C/B/A 공통 풀 + 시리즈별 S/SS
- SS 시리즈당 1명
- 천장/직접 선택 폐기
- 강한 Lv1~50 성장
- +레벨/중복 분해
- 3형태 진화
- 재생산 2초 하한
- 편성/도감

#### `STAGE_SYSTEM_DESIGN.md`
- 메인 4×20 구조
- 영구 보상
- 1~12 난이도
- 2배속/소탕
- SPECIAL 묶음/주기/이벤트/기록
- 끝없는 전선/보스 러시
- 솔로/협동 정책
- 친구 기능
- PvP 일반/랭킹/친선

### 3. `content-wiki/`
**실제 콘텐츠 제작의 상세 정본.**

- `content-wiki/README.md` — 작성 규칙/상태/필수 항목
- `content-wiki/characters/` — 아군 캐릭터 개별 문서
- `content-wiki/enemies/` — 일반 적
- `content-wiki/bosses/` — 보스
- `content-wiki/stages/main/` — 메인 스테이지
- `content-wiki/stages/special/` — SPECIAL
- `content-wiki/recruitment/` — 모집 시리즈/공통 풀
- `content-wiki/events/` — 기간 이벤트
- `content-wiki/systems/` — 콘텐츠 제작 공통 세부 규칙

캐릭터 하나의 공격 프레임, 스테이지 하나의 웨이브 타임라인 같은 구체 내용은 통합 기획서가 아니라 이 위키에 기록한다.

### 4. `FEATURE_COVERAGE_MATRIX.md`
출시 전 필수 기능 누락 방지표.

현재 문서가 과거 설계를 일부 포함할 수 있으므로 v1.0 정본과 불일치하는 항목은 다음 구현 작업에서 갱신한다. 상태를 `DONE/PARTIAL/MISSING/PLANNED/CANDIDATE`로 관리한다.

### 5. `IMPLEMENTATION_STATUS.md`
현재 실제 구현 상태. 기획 정본이 아니다.

### 6. `DEVELOPMENT_RULES.md`
- 정본/위키 확인 후 구현
- 구식 코드/데이터/테스트 동시 청소
- 하나의 권위 경로
- 개발자 문구 게임 노출 금지
- 실제 플레이 감각 QA

### 7. `NEW_CHAT_PROMPT.md`
새 채팅 인수인계용. 사용 시에도 반드시 GitHub `main`을 다시 읽는다.

## `GAME_DESIGN_FULL.md`의 위치

기존 `GAME_DESIGN_FULL.md`는 초기 통합 상세 설계의 역사적/참고 자료다. **v1.0에서 바뀐 성장, 모집, 희귀도, SPECIAL, 협동, 캐릭터 구조의 권위 문서로 사용하지 않는다.**

현재 v1.0의 사람이 읽기 좋은 통합 스냅샷은 별도 DOCX로 유지할 수 있지만, 실제 구현용 세부 정본은 GitHub의 `CANONICAL + 정밀 문서 + content-wiki` 조합이다. 이렇게 해야 문서 한 파일이 수백 페이지가 되어 수정 누락이 생기는 것을 막을 수 있다.

## 의도 정본과 실제 실행값

### 의도 정본

1. `CANONICAL.md`
2. 관련 정밀 시스템 문서
3. 해당 `content-wiki` 페이지

### 실행값

1. `content/` JSON
2. schema/parser/simulation/UI 코드

둘이 다르면 실행값을 정답으로 간주하지 않는다. 불일치 원인을 확인한 뒤 의도 정본 또는 구현을 수정하고 테스트까지 함께 맞춘다.

## 현재 핵심 런타임 데이터

- `content/units/chapter-01.json`
- `content/units/recruitment-01.json`
- `content/enemies/chapter-01.json`
- `content/stages/chapter-01.json`
- `content/stages/special-01.json`
- `content/stage-collections.json`
- `content/treasures/chapter-01.json`
- `content/recruitment/banner-01.json`
- `content/growth/level-curve-01.json`
- `content/evolution/recruitment-01.json`

이 데이터 중 일부는 v1.0 이전 프로토타입이므로 콘텐츠 위키에서 `REWORK`로 지정된 항목은 새 설계에 맞게 교체한다.

## 작업 순서

1. `CANONICAL.md`
2. 관련 정밀 시스템 문서
3. 해당 콘텐츠 위키
4. `FEATURE_COVERAGE_MATRIX.md`
5. `IMPLEMENTATION_STATUS.md`
6. `DEVELOPMENT_RULES.md`
7. 관련 `content/`와 코드/테스트
8. 구현
9. 자동 검증
10. 실제 플레이테스트
11. 위키 상태 갱신
12. 폐기된 구형 경로 제거

## 문서 유지 규칙

- 큰 방향 변경 → `CANONICAL.md` 갱신.
- 성장/모집/진화 → `GROWTH_RECRUITMENT_DESIGN.md` + 관련 위키 갱신.
- 스테이지/협동/PvP → `STAGE_SYSTEM_DESIGN.md` + 관련 위키 갱신.
- 개별 캐릭터/적/보스/스테이지 수치 변경 → 해당 콘텐츠 위키 + `content/` 동시 갱신.
- 구현 상태 변경 → `FEATURE_COVERAGE_MATRIX.md`, `IMPLEMENTATION_STATUS.md` 확인.
- 새 정본으로 폐기된 문구/데이터/코드는 같은 작업에서 정리한다.
