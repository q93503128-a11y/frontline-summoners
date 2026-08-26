# Frontline Summoners 문서 인덱스 v1.3

이 저장소의 문서는 **최상위 규칙 / 통합 기획 / 시스템 정밀 규칙 / 콘텐츠 바이블 / 구현 검증 상태**로 분리한다. 같은 숫자를 여러 문서에 독립 정본으로 두지 않는다.

---

# 1. 권위 순서

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. 관련 시스템 정밀 문서
4. 해당 `docs/content-wiki/` 상세 페이지
5. 실제 content/schema/code/test는 위 설계를 구현한 결과
6. `FEATURE_COVERAGE_MATRIX.md`, `IMPLEMENTATION_STATUS.md`는 구현 검증 상태 기록

실행된다는 이유만으로 content/code가 새 기획 정본을 덮지 않는다.

---

# 2. 최상위 문서

## `CANONICAL.md`

게임 헌법.

- 1차 완성 = 본능 대응 후반 성장 직전
- 메인 4×20=80
- Lv10→20→30→40→50
- 3형태/+레벨
- STORY와 모집 희귀도 분리
- SS 시리즈당 정확히 1
- 무천장/무직접선택
- 재생산 최소 60F
- 대부분 메인/SPECIAL 협동
- 기록 SPECIAL 2종
- 2배속/소탕
- 친구/PvP

## `GAME_DESIGN_FULL.md`

현재 통합 전체 기획서 v1.2.

개별 HP/spawn frame/아트 제작값은 각 위키로 연결한다.

## `GROWTH_RECRUITMENT_DESIGN.md`

성장/모집/진화 공통 규칙.

## `STAGE_SYSTEM_DESIGN.md`

메인/SPECIAL/NORMAL_CLEAR/2배속/소탕/협동/PvP 연결 규칙.

---

# 3. 콘텐츠 바이블 시작점

- `docs/content-wiki/README.md`
- `docs/content-wiki/systems/CONTENT_BIBLE_RULES.md`

상태:

`CONCEPT → DESIGN_TARGET → TESTED → LOCKED`

보조 상태:

- REWORK
- DEPRECATED

테스트 전 숫자는 확정값이 아니다.

---

# 4. 공통 제작·감사 시스템

- `systems/CONTENT_BIBLE_RULES.md` — 권위/ID/변경 절차
- `systems/CHARACTER_SPEC_SCHEMA.md` — 캐릭터 필수 필드
- `systems/STAGE_SPEC_SCHEMA.md` — 스테이지 필수 필드
- `systems/ATTRIBUTE_TAG_CATALOG.md` — 8속성/태그
- `systems/ANIMATION_CONTACT_FRAME_TARGETS.md` — 43종 hit/contact 목표
- `systems/CHARACTER_ART_MOTION_PRODUCTION_RULES.md` — 캐릭터 공통 실루엣/scale/Idle·Move·Attack·KB·Death/VFX/SFX/모바일 식별 규칙
- `systems/DESIGN_DOCUMENT_AUDIT_V1.md` — 문서 일관성 감사/남은 설계 공백

공식 부유 태그는 `FLOATING`. `FLYING`은 금지 legacy alias.

---

# 5. 성장·경제·보상

- `systems/PROGRESSION_NUMERICAL_TARGETS.md`
  - Lv1~50 앵커
  - +레벨
  - 레벨업 Gold
  - 중복 분해/+1 비용
  - 진화 재료 체급

- `systems/CHARACTER_EVOLUTION_RECIPES_V1.md`
  - 초기 43종 F2/F3 개별 recipe DESIGN_TARGET

- `systems/MAIN_PERMANENT_REWARDS.md`
  - 메인80 영구 HP/ATK/경제/재생산 보너스

- `systems/MAIN_STAGE_CURRENCY_REWARDS_V1.md`
  - 메인80 first Gold/모집재화/repeat Gold
  - milestone 진화재료/소탕권

- `systems/REWARD_ECONOMY_AND_SKIP.md`
  - 반복보상/충전/2배속/소탕

- `systems/DIFFICULTY_CALIBRATION.md`
  - 난이도 1~12 산정

---

# 6. 전투 개입·UI

- `systems/BASE_WEAPON_SYSTEM_V1.md`
  - 전선포
  - 결계발진기
  - 보급투하기
  - 협동 shared weapon/PvP 규칙

- `systems/UI_UX_ENCYCLOPEDIA.md`
  - 메뉴/편성/성장/모집/도감/전투/멀티 UX

---

# 7. 온라인·계정

- `systems/MULTIPLAYER_SOCIAL_PVP.md`
- `systems/PVP_RANKING_MMR_REWARDS.md`
- `systems/ACCOUNT_SAVE_SYNC_SPEC.md`

친구/협동/PvP/MMR/티어/시즌/게스트·로그인·동기화·삭제를 담당한다.

---

# 8. 플레이어 캐릭터 — 43종

## STORY 10

- `characters/STORY_ROSTER_V1.md` — 개념
- `characters/STORY_ROSTER_V1_COMBAT_SPECS.md` — 전투수치
- `characters/STORY_ROSTER_V1_ART_BIBLE.md` — F1/F2/F3 실루엣/모션/VFX/SFX 제작 사양

STORY는 `rarity:null`.

## 공통 C/B/A 15

- `recruitment/COMMON_POOL_V1.md`
- `recruitment/COMMON_POOL_V1_COMBAT_SPECS.md`
- `recruitment/COMMON_POOL_V1_ART_BIBLE.md`

C5/B5/A5.

## 초기 3시리즈 S/SS 18

- `recruitment/INITIAL_SERIES_01_03.md`
- `recruitment/INITIAL_SERIES_01_03_COMBAT_SPECS.md`
- `recruitment/INITIAL_SERIES_01_03_ART_BIBLE.md`

1. 성휘의 기사단
2. 태고의 거수
3. 제로 엣지

각 S5+SS1.

S/SS 아트 바이블은 상세 DESIGN_TARGET이지만 **정식 아트 제작 전 사용자 검수**를 거친다. SS 3종은 승인 전 LOCKED 금지.

---

# 9. 적/보스

메인:

- `enemies/INITIAL_ENEMY_ROSTER_V1.md`
- `enemies/INITIAL_ENEMY_ROSTER_V1_COMBAT_SPECS.md`
- `bosses/INITIAL_BOSSES_V1.md`
- `bosses/INITIAL_BOSSES_V1_COMBAT_SPECS.md`

SPECIAL:

- `enemies/SPECIAL_ENEMIES_AND_BOSSES_V1_COMBAT_SPECS.md`

현재 메인 일반 적 32 + 메인 보스/준보스 8 + SPECIAL 전용군.

---

# 10. 메인 80

지도:

- `stages/main/INITIAL_MAIN_4_CHAPTERS.md`

상세:

- `CHAPTER_01_DETAILED_STAGE_SPECS.md`
- `CHAPTER_02_DETAILED_STAGE_SPECS.md`
- `CHAPTER_03_DETAILED_STAGE_SPECS.md`
- `CHAPTER_04_DETAILED_STAGE_SPECS.md`

장별 stage spec에는 stageId/name/difficulty/recommended growth/map/base/supply/spawn/boss/coop/target time이 들어간다.

재화/영구보상은 별도 80개 표를 함께 사용한다.

---

# 11. SPECIAL

요약:

- `stages/special/INITIAL_SPECIAL_COLLECTIONS.md`

상세:

- `PERIODIC_RESOURCE_SPECIALS_DETAILED.md`
- `PERMANENT_CHALLENGE_SPECIALS_DETAILED.md`
- `EVENT_AND_RECORD_SPECIALS_DETAILED.md`

기록 SPECIAL은 끝없는 전선/보스 러시 두 개가 1차 핵심이며 SOLO_ONLY. 대부분 나머지는 SOLO_OR_COOP.

---

# 12. NORMAL_CLEAR

NORMAL_CLEAR = 실제 전투 승리.

- 솔로 실제 승리
- 허용된 정상 협동 실제 승리

둘 모두 동일.

NORMAL_CLEAR 후 진행/FIRST/permanent reward/재클리어 2배속/sweep eligible 소탕을 인정한다.

---

# 13. 구현 검증 문서

## `FEATURE_COVERAGE_MATRIX.md`

기획 준비도와 구현 검증 상태를 분리한다.

## `IMPLEMENTATION_STATUS.md`

현재 코드 구현 여부는 실제 main 재감사 후 갱신한다.

## `DEVELOPMENT_RULES.md`

구형 경로 병존/누적 hotfix 금지, 검증, main 직접 작업 원칙.

---

# 14. 폐기 규칙

신규 설계에 사용 금지:

- LIGHT
- FLYING
- story rarity
- X rarity
- 10/30/60/100 guarantee
- pity/selectionCredits
- Lv50×1.595
- permanent movement-speed reward
- permanent allied deployment-cap reward
- SPECIAL5를 전체 특수콘텐츠로 간주
- 메인 전체 solo-only
- 협동 전용 복제맵만 지원
- 1차에서 난이도 9~12 억지 사용

과거 설명에서 언급할 때는 폐기/REWORK 문맥이 명확해야 한다.

---

# 15. 다음 세밀화 순서

1. 메인 4장 narrative/story bible
2. UI 화면별 layout/touch/breakpoint spec
3. BGM/SFX/accessibility spec
4. 캐릭터 portrait/도감 문구 + S/SS reveal storyboard
5. 업적/프로필 장식 catalog
6. 최종 링크/ID/schema 검증
7. 실제 구현/플레이테스트 → TESTED

DOCX는 사람이 읽는 시점별 snapshot으로 사용할 수 있으나 GitHub 정본과 독립 수정해 제2 정본으로 만들지 않는다.
