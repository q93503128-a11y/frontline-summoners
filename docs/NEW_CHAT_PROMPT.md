# Frontline Summoners 새 채팅 인수인계 — v1.3 콘텐츠 바이블 기준

전선소환전 / Frontline Summoners 작업을 이전 채팅에서 그대로 이어서 진행한다. 새 게임을 다시 기획하지 말고 **반드시 현재 GitHub `main`을 직접 읽은 뒤 시작**한다.

저장소: `q93503128-a11y/frontline-summoners`  
브랜치: `main`

중요: 이 문서는 기획 방향 인수인계용이다. **구현 완료 여부는 `IMPLEMENTATION_STATUS.md`와 실제 code/content/test를 직접 확인해야 한다.** DESIGN_TARGET 문서가 존재한다고 구현됐다고 가정하지 않는다.

---

# 0. 현재 목표

1차 완성은 냥코 대전쟁의 본능에 대응하는 후반 성장 시스템 직전까지의 **완성된 게임**이다.

1차 완성 전 후반 성장축을 계속 추가하지 않는다.

포함:

- 30Hz 결정론 전투
- 메인 4×20=80
- Lv1~50/+레벨
- 3형태 진화/이전 형태 재선택
- STORY + 공통 C/B/A + 시리즈 S/SS
- SPECIAL 상시/주기/이벤트/기록
- 2배속/소탕
- 2인 PvE 협동
- 친구
- PvP 일반/랭킹/친선
- 도감/편성/성장/모집
- 게스트/로그인/동기화/삭제

싱글만으로 핵심 성장 완주 가능.

---

# 1. 문서 권위

작업 전:

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/GROWTH_RECRUITMENT_DESIGN.md`
4. `docs/STAGE_SYSTEM_DESIGN.md`
5. `docs/content-wiki/README.md`
6. 관련 content-wiki
7. `docs/FEATURE_COVERAGE_MATRIX.md`
8. `docs/IMPLEMENTATION_STATUS.md`
9. `docs/DEVELOPMENT_RULES.md`
10. `docs/INDEX.md`
11. 관련 content JSON
12. 실제 code/test

실행값이 최신 의도 정본과 다르면 자동으로 실행값을 정답 취급하지 않는다.

---

# 2. 상태 체계

`CONCEPT → DESIGN_TARGET → TESTED → LOCKED`

대부분의 새 수치는 아직 DESIGN_TARGET.

---

# 3. 전투 핵심

- 30 tick/s 결정론 sim
- 1D X축 판정
- standingRange / attackMin / attackMax 분리
- anticipation → hit/contact → recovery
- 동일 frame 피해 동시 적용
- 자연 KB/강제이동 분리
- HP≤0 즉시 전투 대상 제외
- 재생산 최종 하한 60F=2초

contact 정본:
`docs/content-wiki/systems/ANIMATION_CONTACT_FRAME_TARGETS.md`

캐릭터 제작 공통 규칙:
`docs/content-wiki/systems/CHARACTER_ART_MOTION_PRODUCTION_RULES.md`

---

# 4. 성장/모집 핵심

레벨 cap:

- 시작 10
- 1장 20
- 2장 30
- 3장 40
- 4장 50

배율 DESIGN_TARGET:

- Lv1 ×1
- Lv10 ×1.90
- Lv20 ×3.25
- Lv30 ×5.00
- Lv40 ×7.25
- Lv50 ×10.00

+레벨:
`plusMultiplier = 1 + 0.02 × plusLevel`, +50 후보.

스토리 캐릭터는 `rarity:null`.

모집:

- C/B/A 공통
- S/SS 시리즈 전용
- SS 시리즈당 정확히 1
- pity/10·30·60·100 보장/직접 선택 없음

확률 후보:

- C 42%
- B 32%
- A 22.7%
- S 3%
- SS 0.3%

진화 recipe:
`docs/content-wiki/systems/CHARACTER_EVOLUTION_RECIPES_V1.md`

---

# 5. 초기 플레이어 캐릭터 43종

## STORY 10

- 개념: `characters/STORY_ROSTER_V1.md`
- 전투: `characters/STORY_ROSTER_V1_COMBAT_SPECS.md`
- 아트/모션: `characters/STORY_ROSTER_V1_ART_BIBLE.md`

## 공통 C/B/A 15

- 개념: `recruitment/COMMON_POOL_V1.md`
- 전투: `recruitment/COMMON_POOL_V1_COMBAT_SPECS.md`
- 아트/모션: `recruitment/COMMON_POOL_V1_ART_BIBLE.md`

## 초기 3시리즈 S/SS 18

- 개념: `recruitment/INITIAL_SERIES_01_03.md`
- 전투: `recruitment/INITIAL_SERIES_01_03_COMBAT_SPECS.md`
- 아트/모션: `recruitment/INITIAL_SERIES_01_03_ART_BIBLE.md`

시리즈:

1. 성휘의 기사단
2. 태고의 거수
3. 제로 엣지

각 S5+SS1.

S/SS 아트 바이블은 상세 DESIGN_TARGET이지만 **정식 아트 제작 전 사용자 검수 필요**. SS 3종은 승인 전 LOCKED 금지.

---

# 6. 속성/태그

속성:

- NEUTRAL
- BEAST
- UNDEAD
- NATURE
- ARCANE
- DEMON
- MACHINE
- ANOMALY

공식 부유 태그는 `FLOATING`. `FLYING` 금지.

---

# 7. 메인 80

1장 뒤집힌 국경 — NEUTRAL/BEAST
2장 뒤틀린 숲 — NATURE/UNDEAD
3장 마도도시 세라페 — ARCANE/DEMON
4장 기어 제국의 균열 — MACHINE/ANOMALY

상세:

- `stages/main/INITIAL_MAIN_4_CHAPTERS.md`
- `CHAPTER_01_DETAILED_STAGE_SPECS.md`
- `CHAPTER_02_DETAILED_STAGE_SPECS.md`
- `CHAPTER_03_DETAILED_STAGE_SPECS.md`
- `CHAPTER_04_DETAILED_STAGE_SPECS.md`

영구보상:
`systems/MAIN_PERMANENT_REWARDS.md`

일반 재화:
`systems/MAIN_STAGE_CURRENCY_REWARDS_V1.md`

1차 난이도는 대부분 1~7, 일부 8. 9~12 억지 사용 금지.

---

# 8. NORMAL_CLEAR / 2배속 / 소탕

`NORMAL_CLEAR = 솔로 실제 승리 OR 허용된 정상 협동 실제 승리`.

NORMAL_CLEAR 후:

- 진행
- first/permanent reward
- 재클리어 2배속
- sweepEligible stage 소탕

소탕은 NORMAL_CLEAR를 새로 만들지 않는다.

기록전/PvP 소탕 불가.

---

# 9. SPECIAL

- 주기 재화 다단계
- 상시/보스 도전
- 이벤트
- 기록 2종: 끝없는 전선 / 보스 러시

기록 2종은 SOLO_ONLY. 대부분 다른 SPECIAL은 SOLO_OR_COOP.

상세:

- `stages/special/INITIAL_SPECIAL_COLLECTIONS.md`
- `PERIODIC_RESOURCE_SPECIALS_DETAILED.md`
- `PERMANENT_CHALLENGE_SPECIALS_DETAILED.md`
- `EVENT_AND_RECORD_SPECIALS_DETAILED.md`
- `enemies/SPECIAL_ENEMIES_AND_BOSSES_V1_COMBAT_SPECS.md`

---

# 10. 거점 병기

상세:
`systems/BASE_WEAPON_SYSTEM_V1.md`

1차 DESIGN_TARGET:

- 전선포
- 결계발진기
- 보급투하기

협동 shared cooldown/PvP 규칙 포함.

---

# 11. 협동/친구/PvP

협동:

- 플레이어당 5칸
- 개인 보급/보급소/생산쿨
- 공유 기지/전장/승패/병기
- 정상 협동 클리어는 NORMAL_CLEAR

친구:

- 요청/수락/거절
- 목록/온라인 상태
- 협동/친선 초대
- 최근 플레이어
- 삭제/차단
- 빠른 통신

PvP:

- 1v1 일반/랭킹/친선
- 2v2 일반/친선
- 2v2 랭킹은 동접 확인 후

랭킹 표준화 DESIGN_TARGET:

- Lv50
- +0
- 메인 영구 전투 보너스 0
- 실제 보유 캐릭터/해금 형태 유지

상세:
`systems/PVP_RANKING_MMR_REWARDS.md`

---

# 12. 계정/저장

상세:
`systems/ACCOUNT_SAVE_SYNC_SPEC.md`

- guest/local
- login/server authority
- revision/conflict
- guest migration
- progress reset/account delete/local delete 분리
- reward idempotency

---

# 13. 구현 상태 주의

현재 문서 바이블은 runtime보다 앞서 있을 수 있다.

legacy 후보:

- LIGHT
- FLYING
- story rarity
- X rarity
- pity/selectionCredits
- Lv50×1.595
- 이동속도/출격한도 영구보상
- SPECIAL5를 전체 출시 범위로 간주
- 메인 전체 solo-only

하지만 실제 code에 이미 제거됐을 수 있으므로 **구현 작업 전 main을 다시 감사**한다.

---

# 14. 다음 문서 우선순위

현재 `거점 병기`, `43종 진화 recipe`, `43종 아트·모션 바이블`까지 작성됨.

다음:

1. **메인 4장 narrative/story bible**
2. UI 화면별 layout/touch/breakpoint spec
3. BGM/SFX/accessibility spec
4. 캐릭터 portrait/도감 문구 + S/SS reveal storyboard
5. 업적/프로필 장식 catalog
6. 최종 링크/ID/schema 검증

새 시스템을 더 늘리기보다 이 범위를 완성한 뒤 실제 구현/플레이테스트로 DESIGN_TARGET을 TESTED로 올린다.

---

# 15. 구현을 요청받으면

1. 최신 `main` commit 확인
2. CANONICAL/관련 위키 재확인
3. 실제 code/content/test 감사
4. 문서와 구현 차이 목록화
5. 기반 schema부터 coherent slice로 구현
6. 구식 경로 즉시 제거
7. typecheck/test/build
8. 실제 플레이/화면 검사
9. 위키/구현상태 갱신

사용자가 구현을 지시했다면 계획만 말하고 끝내지 말고 실제 작업을 진행한다.
