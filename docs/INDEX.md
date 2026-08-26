# Frontline Summoners 문서 인덱스 v1.5

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

- `CANONICAL.md` — 게임 헌법
- `GAME_DESIGN_FULL.md` — 통합 전체 기획
- `GROWTH_RECRUITMENT_DESIGN.md` — 성장/모집/진화
- `STAGE_SYSTEM_DESIGN.md` — 메인/SPECIAL/NORMAL_CLEAR/2배속/소탕/협동/PvP

현재 중요한 SPECIAL 규칙:

`main_01_020 NORMAL_CLEAR → 제1장 완료 → SPECIAL 허브 개방`

---

# 3. 콘텐츠 바이블 상태

`CONCEPT → DESIGN_TARGET → TESTED → LOCKED`

보조:

- REWORK
- DEPRECATED

현재 대부분의 새 v1 수치는 DESIGN_TARGET이며 플레이테스트 전 확정값이 아니다.

---

# 4. 공통 제작·감사

`docs/content-wiki/systems/`

- `CONTENT_BIBLE_RULES.md`
- `CHARACTER_SPEC_SCHEMA.md`
- `STAGE_SPEC_SCHEMA.md`
- `ATTRIBUTE_TAG_CATALOG.md`
- `ANIMATION_CONTACT_FRAME_TARGETS.md`
- `CHARACTER_ART_MOTION_PRODUCTION_RULES.md`
- `DESIGN_DOCUMENT_AUDIT_V1.md`
- `DOCUMENT_LINK_ID_SCHEMA_AUDIT_V1_5.md`

공식 부유 태그는 `FLOATING`. `FLYING`은 금지 legacy alias.

---

# 5. 성장·경제·보상

- `PROGRESSION_NUMERICAL_TARGETS.md` — Lv1~50/+레벨/Gold/중복/재료 수치
- `CHARACTER_EVOLUTION_RECIPES_V1.md` — 43종 F2/F3 recipe
- `MAIN_PERMANENT_REWARDS.md` — 메인80 영구보상
- `MAIN_STAGE_CURRENCY_REWARDS_V1.md` — 메인80 일반 재화
- `REWARD_ECONOMY_AND_SKIP.md` — 반복/충전/2배속/소탕
- `DIFFICULTY_CALIBRATION.md` — 난이도 1~12

---

# 6. SPECIAL 접근·스토리

- `SPECIAL_ACCESS_AND_STORY_PRESENTATION.md`

핵심:

- SPECIAL 허브는 제1장 ST20 NORMAL_CLEAR 후 개방
- 허브/collection/stage 해금 분리
- 대부분 SPECIAL SOLO_OR_COOP
- 기록전 SOLO_ONLY
- 스토리는 선택형
- 처음 보는 장면도 즉시 Skip
- 자동 story skip
- 스토리를 읽지 않아도 진행/보상/튜토리얼 이해 가능
- 협동 파트너를 narrative 때문에 대기시키지 않음

장대한 narrative bible은 1차 핵심에서 제외.

---

# 7. UI·오디오·접근성

- `UI_UX_ENCYCLOPEDIA.md` — UI 일반 원칙
- `UI_SCREEN_LAYOUT_TOUCH_SPEC.md` — 화면별 layout/touch/breakpoint
- `AUDIO_BGM_SFX_ACCESSIBILITY_SPEC.md` — BGM/SFX/오디오 bus/접근성/저사양

UI 상세 목표:

- 640×360~1920×1080
- COMPACT/MEDIUM/WIDE
- 일반 최소 touch 44×44
- mobile drag long press 220ms
- 전투 10슬롯 실제 입력 가능
- safe area/zoom/overflow QA

접근성:

- screen shake 0/50/100
- flash reduction
- reduce motion
- color/high contrast
- VFX density
- low-spec preset

---

# 8. 거점 병기

- `BASE_WEAPON_SYSTEM_V1.md`

초기 DESIGN_TARGET:

- 전선포
- 결계발진기
- 보급투하기

---

# 9. 플레이어 캐릭터 43종

## STORY 10

- `characters/STORY_ROSTER_V1.md`
- `characters/STORY_ROSTER_V1_COMBAT_SPECS.md`
- `characters/STORY_ROSTER_V1_ART_BIBLE.md`

`rarity:null`.

## 공통 C/B/A 15

- `recruitment/COMMON_POOL_V1.md`
- `recruitment/COMMON_POOL_V1_COMBAT_SPECS.md`
- `recruitment/COMMON_POOL_V1_ART_BIBLE.md`

## 초기 S/SS 18

- `recruitment/INITIAL_SERIES_01_03.md`
- `recruitment/INITIAL_SERIES_01_03_COMBAT_SPECS.md`
- `recruitment/INITIAL_SERIES_01_03_ART_BIBLE.md`

성휘의 기사단 / 태고의 거수 / 제로 엣지, 각 S5+SS1.

S/SS 정식 아트는 사용자 검수 전 LOCKED 금지.

---

# 10. 초상화·도감·모집 연출

- `CHARACTER_PORTRAIT_CODEX_REVEAL_SPEC.md`

정의:

- ICON/CARD/CODEX HERO crop
- F1/F2/F3 portrait
- STORY rarity frame 금지
- lore 짧게, 전략 정보 우선
- C/B/A/S/SS reveal 시간
- 성휘/거수/제로 엣지 SS 전용 reveal
- 10회 모집/Skip/접근성

---

# 11. 적/보스

메인:

- `enemies/INITIAL_ENEMY_ROSTER_V1.md`
- `enemies/INITIAL_ENEMY_ROSTER_V1_COMBAT_SPECS.md`
- `bosses/INITIAL_BOSSES_V1.md`
- `bosses/INITIAL_BOSSES_V1_COMBAT_SPECS.md`

SPECIAL:

- `enemies/SPECIAL_ENEMIES_AND_BOSSES_V1_COMBAT_SPECS.md`

메인 일반 적 32 + 보스/준보스 8 + SPECIAL 전용군.

---

# 12. 메인 80

- `stages/main/INITIAL_MAIN_4_CHAPTERS.md`
- `CHAPTER_01_DETAILED_STAGE_SPECS.md`
- `CHAPTER_02_DETAILED_STAGE_SPECS.md`
- `CHAPTER_03_DETAILED_STAGE_SPECS.md`
- `CHAPTER_04_DETAILED_STAGE_SPECS.md`

stageId/name/difficulty/recommended growth/map/base/supply/spawn/boss/coop/target time까지 DESIGN_TARGET 존재.

---

# 13. SPECIAL

- `stages/special/INITIAL_SPECIAL_COLLECTIONS.md`
- `PERIODIC_RESOURCE_SPECIALS_DETAILED.md`
- `PERMANENT_CHALLENGE_SPECIALS_DETAILED.md`
- `EVENT_AND_RECORD_SPECIALS_DETAILED.md`

글로벌:

- 제1장 ST20 전 허브 잠금
- 제1장 완료 후 개방
- 고단계 진행도 잠금 가능
- 끝없는 전선 제3장 완료 후보
- 보스 러시 제4장 완료 후보

---

# 14. 온라인·계정

- `MULTIPLAYER_SOCIAL_PVP.md`
- `PVP_RANKING_MMR_REWARDS.md`
- `ACCOUNT_SAVE_SYNC_SPEC.md`

친구/협동/PvP/MMR/티어/시즌/게스트·로그인·동기화·삭제.

---

# 15. 업적·프로필

- `ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`

초기 목표 약 45~55 achievements.

- 메인
- 성장/수집
- SPECIAL
- 협동
- PvP
- 기록
- 기묘한 도전

보상은 장식/소량 재화 중심. PvP/이벤트 전용 필수 성능 금지.

프로필:

- 대표 캐릭터
- title
- frame
- banner
- emblem
- badge
- PvP tier

---

# 16. NORMAL_CLEAR

NORMAL_CLEAR = 실제 전투 승리.

- 솔로 실제 승리
- 허용된 정상 협동 실제 승리

둘 모두 진행/FIRST/permanent/2배속/sweep 해금에 동일 취급.

제1장 ST20은 SPECIAL 허브도 해금.

---

# 17. 폐기 규칙

신규 설계 금지:

- LIGHT
- FLYING
- story rarity
- X rarity
- 10/30/60/100 guarantee
- pity/selectionCredits
- Lv50×1.595
- permanent movement-speed reward
- permanent allied deployment-cap reward
- SPECIAL5를 전체 출시 범위로 간주
- SPECIAL 시작부터 전부 개방
- 메인 전체 solo-only
- 협동 전용 복제맵만 지원
- 1차 난이도 9~12 억지 사용
- 스토리를 읽어야 핵심 진행을 이해하는 구조

GitHub search는 2026-08-26 기준 `FLYING/LIGHT/selectionCredits/pity/SPECIAL5` 활성 결과를 반환하지 않았지만 구현 시작 시 실제 전체 검색을 다시 한다.

---

# 18. 구현 검증 문서

- `FEATURE_COVERAGE_MATRIX.md`
- `IMPLEMENTATION_STATUS.md`
- `DEVELOPMENT_RULES.md`

문서가 상세하다는 이유만으로 실제 구현 완료라고 쓰지 않는다.

---

# 19. 현재 문서 판정

- 기획 구조: PASS
- 콘텐츠 세밀도: PASS — DESIGN_TARGET
- 문서 링크/ID namespace: PASS, 구현 시 validator 필요
- 코드/실제 게임: 이 문서 패스에서는 미평가

상세 감사:

`systems/DOCUMENT_LINK_ID_SCHEMA_AUDIT_V1_5.md`

---

# 20. 다음 단계

문서 P0는 현재 충분히 닫혔다.

다음은 문서를 더 크게 늘리기보다:

1. 최신 main 코드/content/test 재감사
2. schema/validator 정본화
3. coherent slice 구현
4. typecheck/test/build
5. PC/mobile 실제 플레이
6. DESIGN_TARGET → TESTED

순으로 진행한다.

DOCX는 사람이 읽는 snapshot으로 사용할 수 있으나 GitHub와 별도 정본으로 관리하지 않는다.
