# Frontline Summoners 문서 인덱스 v1.0

이 저장소의 문서는 **최상위 규칙 / 통합 기획 / 시스템 정밀 규칙 / 콘텐츠 위키 / 구현 상태**로 분리한다. 같은 숫자를 여러 문서에 독립 정본으로 두지 않는다.

---

# 1. 권위 순서

의도 정본의 우선순위는 다음과 같다.

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. 관련 시스템 정밀 문서
4. 해당 `docs/content-wiki/` 상세 페이지
5. `docs/FEATURE_COVERAGE_MATRIX.md`, `docs/IMPLEMENTATION_STATUS.md`는 구현 현황 기록
6. 실제 `content/`/code/test는 실행 상태이며, 의도 정본과 다르면 구현 불일치로 감사한다.

`content JSON이 현재 실행된다`는 이유만으로 기획 정본을 덮지 않는다.

---

# 2. 최상위 문서

## `CANONICAL.md`

게임의 헌법.

- 1차 완성 = 본능 대응 후반 성장 직전
- 메인 4장 × 20 = 80
- Lv10 → 20 → 30 → 40 → 50
- 3형태/+레벨
- 스토리 캐릭터와 C/B/A/S/SS 모집 희귀도 분리
- 시리즈당 SS 정확히 1명
- 천장/직접 선택 없음
- 재생산 최소 60F
- SPECIAL/소탕/2배속
- 협동/친구/PvP
- 개발자 문구 노출 금지

큰 방향을 바꾸면 가장 먼저 확인/수정한다.

## `GAME_DESIGN_FULL.md`

현재 v1.0의 사람이 읽는 **통합 전체 기획서**다. 역사 자료가 아니다.

- 게임 정의/톤
- 전투 코어
- 성장/모집/진화
- 메인/SPECIAL
- 온라인
- UI/UX
- 계정/저장
- QA/1차 완성 경계

개별 캐릭터 HP, 스폰 프레임 같은 미세 수치는 여기서 중복 정본화하지 않는다.

---

# 3. 시스템 정밀 문서

## `GROWTH_RECRUITMENT_DESIGN.md`

- Lv1~50
- +레벨
- 중복 분해
- 모집 확률/무천장
- C/B/A 공통 풀
- 시리즈 S/SS
- 진화 3형태
- 편성/도감 성장 규칙

## `STAGE_SYSTEM_DESIGN.md`

- 메인 80
- 난이도 1~12
- 영구 보상
- SPECIAL 구조
- 2배속/소탕
- 솔로/협동
- 친구/PvP 연결

---

# 4. 콘텐츠 위키 운영

## 시작점

`docs/content-wiki/README.md`

`docs/content-wiki/systems/CONTENT_BIBLE_RULES.md`

상태:

`CONCEPT → DESIGN_TARGET → TESTED → LOCKED`

테스트 전 숫자를 LOCKED로 부르지 않는다.

---

# 5. 시스템 위키

## 공통 제작 규격

- `systems/CONTENT_BIBLE_RULES.md` — 권위/ID/상태/변경 절차
- `systems/CHARACTER_SPEC_SCHEMA.md` — 캐릭터 필수 필드
- `systems/STAGE_SPEC_SCHEMA.md` — 스테이지 필수 필드
- `systems/ATTRIBUTE_TAG_CATALOG.md` — 속성/태그
- `systems/ANIMATION_CONTACT_FRAME_TARGETS.md` — 43종 공격 contact/hit 목표

공식 부유 태그는 **`FLOATING`**이다. `FLYING`은 구식/금지 별칭이며 새 데이터에 사용하지 않는다.

## 밸런스/성장

- `systems/PROGRESSION_NUMERICAL_TARGETS.md` — Lv/+Lv/골드/중복/진화재료 수치
- `systems/MAIN_PERMANENT_REWARDS.md` — 메인 80 영구보상 및 합연산
- `systems/DIFFICULTY_CALIBRATION.md` — 난이도 1~12 산정
- `systems/REWARD_ECONOMY_AND_SKIP.md` — 반복보상/충전/2배속/소탕

## 온라인/계정

- `systems/MULTIPLAYER_SOCIAL_PVP.md` — 친구/협동/PvP 공통
- `systems/PVP_RANKING_MMR_REWARDS.md` — 랭킹 표준화/MMR/티어/시즌/보상
- `systems/ACCOUNT_SAVE_SYNC_SPEC.md` — 게스트/로그인/동기화/삭제/충돌

## UI

- `systems/UI_UX_ENCYCLOPEDIA.md` — 메인/출정/편성/성장/모집/도감/전투/멀티 UI

---

# 6. 플레이어 캐릭터 위키

## 스토리 10종

- `characters/STORY_ROSTER_V1.md` — 개념/외형/형태 방향
- `characters/STORY_ROSTER_V1_COMBAT_SPECS.md` — Lv1 F1/F2/F3 전투 목표

스토리 캐릭터는 모집 희귀도 `null`이다.

## 공통 C/B/A 15종

- `recruitment/COMMON_POOL_V1.md`
- `recruitment/COMMON_POOL_V1_COMBAT_SPECS.md`

## 초기 모집 3시리즈

- `recruitment/INITIAL_SERIES_01_03.md`
- `recruitment/INITIAL_SERIES_01_03_COMBAT_SPECS.md`

초기 시리즈:

1. 성휘의 기사단
2. 태고의 거수
3. 제로 엣지

각각 S 5 + SS 1로 시작한다.

현재 1차 플레이어 설계 대상 총합:

- STORY 10
- 공통 C/B/A 15
- S/SS 18
- 합계 43종

---

# 7. 적/보스 위키

- `enemies/INITIAL_ENEMY_ROSTER_V1.md` — 메인 일반 적 32종 개념
- `enemies/INITIAL_ENEMY_ROSTER_V1_COMBAT_SPECS.md` — 메인 일반 적 전투 목표
- `bosses/INITIAL_BOSSES_V1.md` — 메인 보스 8종 개념
- `bosses/INITIAL_BOSSES_V1_COMBAT_SPECS.md` — 메인 보스 전투/페이즈 목표
- `enemies/SPECIAL_ENEMIES_AND_BOSSES_V1_COMBAT_SPECS.md` — SPECIAL 전용 적/보스

적은 색놀이/HP 배율만으로 수를 늘리지 않는다.

---

# 8. 메인 스테이지 위키

기본 지도:

- `stages/main/INITIAL_MAIN_4_CHAPTERS.md`

상세 사양:

- `stages/main/CHAPTER_01_DETAILED_STAGE_SPECS.md`
- `stages/main/CHAPTER_02_DETAILED_STAGE_SPECS.md`
- `stages/main/CHAPTER_03_DETAILED_STAGE_SPECS.md`
- `stages/main/CHAPTER_04_DETAILED_STAGE_SPECS.md`

각 장 상세 문서에는 맵 길이, 기지 HP, 시작 보급, 권장 성장, 스폰 frame/반복 wave/보스 trigger, 난이도, 협동 보정, 목표 시간이 들어간다.

1차 최대 난이도는 일부 8 정도. 9~12를 채우기 위해 억지 적 뻥튀기를 하지 않는다.

---

# 9. SPECIAL 위키

요약:

- `stages/special/INITIAL_SPECIAL_COLLECTIONS.md`

세부:

- `PERIODIC_RESOURCE_SPECIALS_DETAILED.md`
- `PERMANENT_CHALLENGE_SPECIALS_DETAILED.md`
- `EVENT_AND_RECORD_SPECIALS_DETAILED.md`

기록전은 1차에서:

- 끝없는 전선
- 보스 러시

두 개만 핵심으로 둔다.

대부분 SPECIAL은 `SOLO_OR_COOP`, 기록전은 `SOLO_ONLY`.

---

# 10. 구현 상태 문서

## `FEATURE_COVERAGE_MATRIX.md`

출시 범위에서 기능 누락을 찾기 위한 매트릭스.

기획 정본이 아니라 구현 상태를 보고하며, 정본과 과거 내용이 충돌하면 갱신 대상이다.

## `IMPLEMENTATION_STATUS.md`

현재 실제 코드/콘텐츠가 어디까지 구현됐는지 기록.

`DESIGN_TARGET` 문서가 존재한다는 이유만으로 구현 완료라고 쓰지 않는다.

## `DEVELOPMENT_RULES.md`

- main 직접 작업 원칙
- 구형 경로 병존 금지
- 누적 hotfix 금지
- 자동/수동 검사
- 개발자 문구 게임 노출 금지

---

# 11. 정본과 구현이 다를 때

예:

- 위키 `FLOATING`, JSON `FLYING`
- 위키 무천장, 코드 selectionCredits 유지
- 위키 Lv50×10, 실행값 Lv50×1.595

이 경우 `현재 실행값이니까 유지`하지 않는다.

1. 의도 정본이 최신인지 확인
2. 최신이면 구현 불일치로 기록
3. schema/data/code/test/UI를 함께 수정
4. 자동검증
5. 실제 플레이테스트
6. 해당 위키 상태를 TESTED/LOCKED로 올림
7. 구식 경로 삭제

---

# 12. 문서 수정 규칙

- 게임 철학/1차 범위 변경 → CANONICAL + GAME_DESIGN_FULL
- 시스템 전체 규칙 변경 → 해당 정밀 문서 + 시스템 위키
- 개별 캐릭터/적/스테이지 변경 → 해당 콘텐츠 위키
- 실행 수치 변경 → 위키 상태 확인 후 content/code/test와 동기화
- 구현 진척 → FEATURE_COVERAGE_MATRIX + IMPLEMENTATION_STATUS
- 새 채팅 인수인계 → NEW_CHAT_PROMPT 최신화

DOCX는 사람이 읽는 시점별 스냅샷으로 만들 수 있지만 GitHub 정본과 독립적으로 별도 수정해 두 번째 정본으로 만들지 않는다.
