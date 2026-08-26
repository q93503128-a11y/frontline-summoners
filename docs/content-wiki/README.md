# Frontline Summoners 개발용 콘텐츠 위키

이 디렉터리는 **캐릭터·적·보스·스테이지·모집 시리즈·이벤트·세부 시스템을 구현 전에 제작 가능한 수준까지 설계하는 내부 콘텐츠 바이블**이다.

플레이어가 보는 공개 위키가 아니다. 내부 ID, 코드 연결, 밸런스 의도, 스폰 frame, 테스트 결과를 기록할 수 있다. 단 내부 용어는 게임 UI에 직접 노출하지 않는다.

---

# 1. 문서 권위

1. `docs/CANONICAL.md` — 최상위 규칙
2. `docs/GAME_DESIGN_FULL.md` — 통합 전체 기획
3. `docs/GROWTH_RECRUITMENT_DESIGN.md`, `docs/STAGE_SYSTEM_DESIGN.md` — 시스템 정밀 규칙
4. 이 위키의 해당 상세 페이지
5. 실제 content/schema/code/test — 정본을 구현한 결과
6. `FEATURE_COVERAGE_MATRIX.md`, `IMPLEMENTATION_STATUS.md` — 구현 현황 기록

`LOCKED` 위키와 실행값이 다르면 구현 불일치다.

`DESIGN_TARGET`은 테스트 전 목표이므로 조정 가능하다. 조정한 경우 코드만 바꾸지 말고 위키 값, 이유, 검증 결과를 함께 변경한다.

---

# 2. 상태

- `CONCEPT` — 방향만 있음, 구현 시작 금지
- `DESIGN_TARGET` — 구현 가능한 필드/숫자 있음, 테스트 전
- `TESTED` — 자동검증 + 실제 플레이 완료
- `LOCKED` — 현재 릴리스 기준 정본
- `REWORK` — 현재 구현/설계를 그대로 사용하지 않음
- `DEPRECATED` — 역사 참고만 가능, 신규 구현 금지

상태가 없으면 `CONCEPT`로 본다.

---

# 3. 디렉터리

- `characters/` — 스토리/확정 획득 아군
- `recruitment/` — 공통 C/B/A, 시리즈 S/SS
- `enemies/` — 메인/SPECIAL 일반 적 및 전용 적
- `bosses/` — 메인 보스/준보스
- `stages/main/` — 메인 80
- `stages/special/` — 주기/상시/이벤트/기록 SPECIAL
- `systems/` — 모든 콘텐츠에 적용되는 공통 설계 규칙
- `events/` — 필요 시 이벤트 단위 장기 바이블

---

# 4. 시스템 위키 읽기 순서

## 제작 규칙

- `CONTENT_BIBLE_RULES.md` — ID/상태/변경/중복/승인
- `CHARACTER_SPEC_SCHEMA.md` — 캐릭터 필수 사양
- `STAGE_SPEC_SCHEMA.md` — 스테이지 필수 사양
- `ATTRIBUTE_TAG_CATALOG.md` — 속성/전투 태그
- `ANIMATION_CONTACT_FRAME_TARGETS.md` — 공격 판정/아트 contact 목표

## 성장/밸런스

- `PROGRESSION_NUMERICAL_TARGETS.md` — Lv/+Lv/골드/중복/진화 재료
- `MAIN_PERMANENT_REWARDS.md` — 메인 80 영구 보상
- `DIFFICULTY_CALIBRATION.md` — 난이도 1~12
- `REWARD_ECONOMY_AND_SKIP.md` — 반복보상/충전/2배속/소탕

## 온라인/계정

- `MULTIPLAYER_SOCIAL_PVP.md` — 친구/협동/PvP 공통
- `PVP_RANKING_MMR_REWARDS.md` — 랭킹 표준화/MMR/티어/보상
- `ACCOUNT_SAVE_SYNC_SPEC.md` — 게스트/로그인/저장/이전/충돌/삭제

## UX

- `UI_UX_ENCYCLOPEDIA.md` — 메뉴/편성/성장/모집/도감/전투/멀티 UI

---

# 5. 플레이어 로스터

현재 1차 DESIGN_TARGET은 43종이다.

## STORY 10

- `characters/STORY_ROSTER_V1.md`
- `characters/STORY_ROSTER_V1_COMBAT_SPECS.md`

스토리 캐릭터는 `rarity:null`이다.

## 공통 C/B/A 15

- `recruitment/COMMON_POOL_V1.md`
- `recruitment/COMMON_POOL_V1_COMBAT_SPECS.md`

C5/B5/A5.

## 초기 시리즈 S/SS 18

- `recruitment/INITIAL_SERIES_01_03.md`
- `recruitment/INITIAL_SERIES_01_03_COMBAT_SPECS.md`

시리즈:

- 성휘의 기사단
- 태고의 거수
- 제로 엣지

각 S5+SS1. **SS는 시리즈당 정확히 1명.**

---

# 6. 적/보스

메인:

- `enemies/INITIAL_ENEMY_ROSTER_V1.md`
- `enemies/INITIAL_ENEMY_ROSTER_V1_COMBAT_SPECS.md`
- `bosses/INITIAL_BOSSES_V1.md`
- `bosses/INITIAL_BOSSES_V1_COMBAT_SPECS.md`

현재 메인 설계군:

- 일반 적 32종
- 메인 보스/준보스 8종

SPECIAL:

- `enemies/SPECIAL_ENEMIES_AND_BOSSES_V1_COMBAT_SPECS.md`

색만 바꾼 새 도감 종을 만들지 않는다. 같은 종의 stage magnification은 같은 enemy ID를 사용한다.

---

# 7. 메인 80

지도:

- `stages/main/INITIAL_MAIN_4_CHAPTERS.md`

상세:

- `CHAPTER_01_DETAILED_STAGE_SPECS.md`
- `CHAPTER_02_DETAILED_STAGE_SPECS.md`
- `CHAPTER_03_DETAILED_STAGE_SPECS.md`
- `CHAPTER_04_DETAILED_STAGE_SPECS.md`

각 스테이지에는 최소 다음이 있어야 한다.

- 목적/학습 요소
- 난이도와 근거
- 권장 성장
- multiplayerPolicy
- map/base/supply
- 정확한 spawn frame/반복 wave/trigger
- boss phase
- FIRST_CLEAR/repeat/permanent reward
- 2배속/소탕
- coop scaling
- 목표 시간
- deterministic baseline
- 사람 플레이테스트 기록

---

# 8. SPECIAL

요약:

- `stages/special/INITIAL_SPECIAL_COLLECTIONS.md`

상세:

- `PERIODIC_RESOURCE_SPECIALS_DETAILED.md`
- `PERMANENT_CHALLENGE_SPECIALS_DETAILED.md`
- `EVENT_AND_RECORD_SPECIALS_DETAILED.md`

1차 기록 SPECIAL은 정확히 두 핵심 모드만 둔다.

- 끝없는 전선
- 보스 러시

대부분의 다른 SPECIAL은 `SOLO_OR_COOP`.

---

# 9. 정상 클리어

`NORMAL_CLEAR`는 실제 전투 승리다.

- 솔로 실제 승리
- 허용된 스테이지의 정상 2인 협동 승리

둘 모두 같은 정상 클리어다.

NORMAL_CLEAR 후:

- 진행/첫 클리어/영구 보상 인정
- 재클리어 2배속 해금
- sweep 허용 스테이지는 소탕 해금

소탕 자체는 NORMAL_CLEAR를 만들지 않는다.

---

# 10. 캐릭터 페이지 필수 항목

## 메타

- 표시 이름 / characterId
- acquisitionClass / rarity / seriesId
- 획득/해금
- attributes[] / combatTags[] / roles[]

## F1/F2/F3 각각

- formId/order/name/unlock
- Lv1 HP/ATK
- hit별 피해 배율
- attackCycle / hitFrames / backswing
- standing/attackMin/attackMax
- targeting/멀티히트
- 이속/KB/비용/재생산
- 대항/상태효과/확률/지속
- 장점/약점/이전형태와의 선택 이유

## 아트/사운드

- 실루엣/체형/화면점유율
- 대표 무기/소품
- Idle/Move/Attack/KB/Death
- anticipation/contact/recovery
- projectile/VFX/SFX
- hit와 시각 contact 동기화
- F1→F2→F3의 실질적 외형 변화

## 밸런스

- 정상 해금 시점
- 비교 캐릭터
- 비용 대비 목적
- 카운터
- 위험 조합
- coop/PvP 위험
- 플레이테스트

---

# 11. 적/보스 필수 항목

- ID/이름/첫 등장
- 실루엣/이동 방식
- 속성/태그
- 기준 HP/ATK/range/cycle/speed/KB
- attack timing/range
- 처치 보급
- stage magnification 허용 범위
- 전투 역할/학습 목적
- 위험 조합
- 도감 설명
- VFX/SFX
- boss phase/trigger
- 테스트 결과

---

# 12. 모집 시리즈 필수 항목

- seriesId/표시명
- 세계관·시각 언어
- 배너 UI/문장/SFX
- 공통 C/B/A 정책
- S 전체 목록
- SS 정확히 1
- 역할/실루엣 중복 검사
- 3형태 방향
- S/SS 결과 연출
- 복각 정책
- 모집 확률 참조
- 사용자 콘셉트 검수 상태

---

# 13. 폐기·금지 용어/규칙

다음은 신규 v1 설계에 사용하지 않는다.

| 구식 | 현재 규칙 |
| --- | --- |
| `LIGHT` 속성 | 삭제. 8속성 카탈로그 사용 |
| `ARMORED`, `BOSS`를 속성처럼 사용 | `combatTags[]`로 분리 |
| `FLYING` | **`FLOATING`** |
| 스토리 캐릭터 C/B/A/S/SS | STORY + `rarity:null` |
| X 희귀도 | 사용하지 않음 |
| 10/30/60/100 모집 보장 | 없음 |
| pity/selectionCredits | 없음 |
| Lv50 약 ×1.595 | 폐기, 현재 앵커 ×10 DESIGN_TARGET |
| 이동속도 영구 보물 | 금지 |
| 아군 출격한도 영구 보물 | 금지 |
| `SPECIAL 5개가 최종 범위` | 폐기. 다단계 상시/주기/이벤트/기록 구조 |
| 난이도 9~12를 1차에 억지 사용 | 금지 |
| 메인 솔로 전용 고정 | 폐기. 대부분 SOLO_OR_COOP |
| 협동은 별도 전용 맵만 | 폐기. 같은 메인/SPECIAL에서 선택 가능 |

역사 설명을 위해 위 단어를 문서에 적을 때는 반드시 `폐기/legacy/REWORK`라는 맥락을 함께 둔다.

---

# 14. 변경 절차

1. 상위 정본 확인
2. 관련 위키 DESIGN_TARGET 작성/수정
3. 상위호환·역할·실루엣·경제 중복 검사
4. 필요한 S/SS 콘셉트 사용자 검수
5. content/schema/code 구현
6. 자동검증
7. 정상 진행 계정 실제 플레이
8. 위키에 결과/수정 이유 기록
9. TESTED
10. 릴리스 기준 LOCKED
11. 폐기된 code/data/test 제거

한쪽만 수정하지 않는다.

---

# 15. LOCKED 전 공통 QA

- 이름/ID 중복 없음
- 참조 속성/태그가 카탈로그에 존재
- 희귀도가 전투력 서열이 아님
- 형태별 선택 이유 존재
- 공격 hit/contact 일치
- 정상 해금 성장으로 클리어 가능
- 난이도 숫자에 근거 있음
- coop scaling이 숨은 추가웨이브를 만들지 않음
- FIRST_CLEAR/repeat/charge 경제가 중복 지급되지 않음
- 2배속/소탕 정책 명확
- 외부 위키 없이 게임 안에서 필요한 전략 정보 제공
- 개발자 문구가 플레이어 UI에 노출되지 않음

이 조건을 만족하지 않는 콘텐츠를 문서가 길다는 이유만으로 LOCKED로 올리지 않는다.
