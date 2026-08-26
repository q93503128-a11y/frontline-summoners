# Frontline Summoners 새 채팅 인수인계 — v1.0 콘텐츠 바이블 기준

전선소환전 / Frontline Summoners 작업을 이전 채팅에서 그대로 이어서 진행한다. 새 게임을 다시 기획하지 말고 **반드시 현재 GitHub `main`을 직접 읽은 뒤 시작**한다.

저장소: `q93503128-a11y/frontline-summoners`  
브랜치: `main`

중요: 이 문서는 현재 기획 방향을 인수인계하기 위한 요약이다. **구현 완료 여부는 `IMPLEMENTATION_STATUS.md`와 실제 코드/콘텐츠/테스트를 직접 확인해야 한다.** 문서에 DESIGN_TARGET이 있다고 구현됐다고 가정하지 않는다.

---

# 0. 가장 중요한 현재 목표

1차 완성은 냥코 대전쟁의 본능에 대응하는 후반 성장 시스템 **직전까지의 완성된 게임**을 목표로 한다.

1차 완성 전에 후반 성장축을 계속 추가하지 않는다.

1차 범위 안에서 다음을 충분히 완성한다.

- 30Hz 결정론 전투 코어
- 메인 4장 × 20 = 80스테이지
- Lv1~50 강한 성장
- +레벨
- 3형태 진화/이전 형태 재선택
- 스토리 캐릭터 + 모집 캐릭터
- 공통 C/B/A + 시리즈별 S/SS
- SPECIAL 상시/주기/이벤트/기록
- 2배속/소탕
- 2인 PvE 협동
- 친구 기능
- PvP 일반/랭킹/친선
- 도감/편성/성장/모집 UI
- 게스트/로그인/저장/이전/삭제

싱글 플레이만으로 전체 핵심 성장이 가능해야 한다.

---

# 1. 문서 권위 순서

작업 전 다음 순서로 읽는다.

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/GROWTH_RECRUITMENT_DESIGN.md`
4. `docs/STAGE_SYSTEM_DESIGN.md`
5. `docs/content-wiki/README.md`
6. 관련 `docs/content-wiki/` 상세 문서
7. `docs/FEATURE_COVERAGE_MATRIX.md`
8. `docs/IMPLEMENTATION_STATUS.md`
9. `docs/DEVELOPMENT_RULES.md`
10. `docs/INDEX.md`
11. 관련 `content/` JSON
12. 실제 code/test

의도 정본과 실행값이 다르면 실행값을 자동으로 정답으로 삼지 않는다.

---

# 2. 콘텐츠 바이블 상태

상태 전환:

`CONCEPT → DESIGN_TARGET → TESTED → LOCKED`

- CONCEPT: 아이디어 수준, 구현 금지.
- DESIGN_TARGET: 구현 가능한 필드/숫자 있음, 테스트 전.
- TESTED: 자동검증 + 플레이테스트 완료.
- LOCKED: 현재 릴리스 기준.

대부분의 새 v1 수치는 아직 DESIGN_TARGET이다.

---

# 3. 전투 코어

- 30 tick/s 결정론 simulation.
- 판정은 1D X축.
- standingRange와 실제 attackMin/Max 분리.
- 선딜 → hitFrame → 후딜/복귀.
- 동일 frame 타격은 수집 후 함께 적용.
- 자연 KB와 강제이동 분리.
- HP≤0 즉시 사망 대상 제외.
- 아군/적 모두 같은 combat core.
- 캐릭터 액티브 버튼 남발 금지.
- 직접 개입은 소환, 보급소, 거점 병기 중심.
- 재생산 최종 하한: **60F = 2초**.

애니메이션/hit 동기화:
`docs/content-wiki/systems/ANIMATION_CONTACT_FRAME_TARGETS.md`

---

# 4. 전투 경제

1장 저속 경제 방향을 유지한다.

현재 DESIGN_TARGET 기본 보급소:

- Lv1 12/s, cap 1000
- Lv2 20/s, cap 1400, cost 160
- Lv3 30/s, cap 1900, cost 260
- Lv4 42/s, cap 2500, cost 390
- Lv5 56/s, cap 3200, cost 560
- Lv6 72/s, cap 4000, cost 760
- Lv7 90/s, cap 5000, cost 1000
- Lv8 110/s, cap 6200, cost 1300

초반부터 보급이 넘쳐 버튼을 무지성 연타하는 구조로 되돌리지 않는다.

---

# 5. 성장

기본 레벨 상한:

- 시작 Lv10
- 1장 완료 → Lv20
- 2장 → Lv30
- 3장 → Lv40
- 4장 → Lv50

배율 DESIGN_TARGET:

- Lv1 ×1
- Lv10 ×1.90
- Lv20 ×3.25
- Lv30 ×5.00
- Lv40 ×7.25
- Lv50 ×10.00

+레벨:

```text
plusMultiplier = 1 + 0.02 × plusLevel
```

+50 후보. Lv50+50은 Lv1 기준 ×20 목표.

상세 골드/중복/진화 수치:
`docs/content-wiki/systems/PROGRESSION_NUMERICAL_TARGETS.md`

---

# 6. 진화

- F1/F2/F3.
- 소유/기본Lv/+Lv 공유.
- 이전 형태 무료 재선택 기본.
- 3형태가 반드시 상위호환일 필요 없음.
- 비용/재생산/사거리/이속/KB/공격방식/능력까지 변할 수 있음.
- 색만 바꾸는 진화 금지.
- SS 진화재료는 C/스토리의 약 4~5배 체급까지 허용.

---

# 7. 획득 분류/희귀도

스토리/기본 캐릭터:

- 모집 희귀도 없음 (`rarity:null`).
- 캠페인/확정 획득.
- 저등급 취급 금지.

모집:

- C / B / A / S / SS.
- C/B/A는 대부분 시리즈 공통 풀.
- S/SS는 시리즈 전용.
- **SS는 시리즈당 정확히 1명**.
- 희귀도는 전투력/비용 서열이 아님.

X는 희귀도로 사용하지 않는다.

---

# 8. 모집

과거 천장 체계는 폐기.

금지:

- 10연 A 보장
- 30연 S 보장
- 60연 SS 보장
- 100연 직접 선택
- 누적 pity/selection credit

현재 확률 DESIGN_TARGET:

- C 42.0%
- B 32.0%
- A 22.7%
- S 3.0%
- SS 0.3%

1회 모집재화 100, 10회 1000 후보. 10회 할인/보장 없음.

---

# 9. 초기 플레이어 로스터

현재 DESIGN_TARGET 총 43종.

## STORY 10

- 징집병
- 방벽기사
- 수렵창병
- 결투검사
- 청창대
- 전투마도사
- 화염술사
- 왕실기사
- 이단주술사
- 공허현자

상세:
`content-wiki/characters/STORY_ROSTER_V1*`

## 공통 C/B/A 15

C5 / B5 / A5.

상세:
`content-wiki/recruitment/COMMON_POOL_V1*`

## 초기 3시리즈

1. 성휘의 기사단 — 미소녀/판타지 영웅
2. 태고의 거수 — 괴수/이형
3. 제로 엣지 — SF/기계/드론/검단

각 시리즈 S5 + SS1.

상세:
`content-wiki/recruitment/INITIAL_SERIES_01_03*`

S/SS 콘셉트는 최종 아트 제작 전에 사용자 검수한다.

---

# 10. 속성/태그

속성:

- NEUTRAL
- BEAST
- UNDEAD
- NATURE
- ARCANE
- DEMON
- MACHINE
- ANOMALY

전투 태그:

- ARMORED
- FLOATING
- GIANT
- BOSS
- STRUCTURE
- SUMMON
- SWARM 등 실제 카탈로그에 정의된 것

**공식 부유 태그는 FLOATING. `FLYING`은 구식 금지 별칭.**

속성은 전역 가위바위보가 아니다. 특정 대항 능력의 타겟이다.

---

# 11. 메인 캠페인

4장 × 20 = 80.

1장 `뒤집힌 국경`
- NEUTRAL/BEAST
- 난이도 1~6
- Lv1~10 진행

2장 `뒤틀린 숲`
- NATURE/UNDEAD
- 난이도 3~7

3장 `마도도시 세라페`
- ARCANE/DEMON
- 난이도 4~7

4장 `기어 제국의 균열`
- MACHINE/ANOMALY
- 난이도 5~8

난이도 9~12는 지금 채우지 않는다. 본능 이후 업데이트에 자연스럽게 사용.

상세 스폰/기지/맵/보급/권장성장:

- `CHAPTER_01_DETAILED_STAGE_SPECS.md`
- `CHAPTER_02_DETAILED_STAGE_SPECS.md`
- `CHAPTER_03_DETAILED_STAGE_SPECS.md`
- `CHAPTER_04_DETAILED_STAGE_SPECS.md`

---

# 12. 메인 영구 보상

- 첫 클리어 확정.
- RNG 보물 품질 없음.
- 같은 효과 반복 허용.
- 이동속도 영구 증가 금지.
- 아군 출격 개체 한도 영구 증가 금지.
- 사거리 영구 증가 기본 금지.

축:

- 전체/역할 HP·공격
- 거점 HP
- 시작 보급
- 처치 보급
- 보급소 강화비
- 재생산 감소

합연산.

상세:
`systems/MAIN_PERMANENT_REWARDS.md`

---

# 13. 난이도

공통 표시 1~12.

1차 완성:

- 대부분 1~7
- 일부 최종 SPECIAL/보스 8
- 9~12 억지 사용 금지

난이도는 정상 해금 계정으로 측정한다.

평가:

- 성장 요구
- 초반 압박
- 지속 압박
- 보스
- 경제
- 덱 민감도
- 사거리/맵
- 실제 사람 테스트

상세:
`systems/DIFFICULTY_CALIBRATION.md`

---

# 14. SPECIAL

분류:

- 상시
- 주기
- 이벤트
- 기록

하나의 SPECIAL 묶음 안에 여러 단계 가능.

주기 재화전:

- 황금 수송대 5단계
- 혼의 제련소 4
- 진화의 문 5
- 별빛 균열 4

상시/보스:

- 폭식룡의 둥지
- 망자의 행진
- 유리성의 재판
- 녹슨 기계성
- 균열 관측기록
- 세 왕의 잔향
- 소수 제한전

이벤트:

- 한여름 괴수 대소동
- 제로 엣지 시험운용 등 복각 가능한 소형 캠페인

기록 SPECIAL은 1차에서 두 개만:

- 끝없는 전선
- 보스 러시

둘 다 SOLO_ONLY.

SPECIAL 전용 적/보스:
`enemies/SPECIAL_ENEMIES_AND_BOSSES_V1_COMBAT_SPECS.md`

---

# 15. 2배속/소탕/보상 충전

- 첫 클리어는 기본 1×.
- 직접 1회 클리어 후 무료 1×/2×.
- 소탕권은 이미 직접 클리어한 스테이지에만.
- 소탕 없어도 직접 플레이 가능.
- 소탕은 에너지/입장권이 아님.
- 기록전/PvP 소탕 불가.
- 주기 재화 SPECIAL의 고효율 반복보상은 충전 사용.
- 충전이 없어도 플레이 자체는 가능.

---

# 16. 협동

대부분 메인/SPECIAL은 `SOLO_OR_COOP`.

기록전은 SOLO_ONLY.

2인:

- 각자 5칸 → 팀 10칸
- 개인 보급
- 개인 보급소
- 개인 생산쿨
- 공유 기지/전장/승패/병기

협동 첫 클리어도 정상 진행/보상 인정.

적 2배 강화 금지.

출발 후보:

- HP ×1.15~1.30
- 공격 ×1.05~1.15
- 적 거점 ×1.10~1.20

사거리/속도/웨이브/스폰을 협동이라는 이유로 몰래 변경하지 않는다.

---

# 17. 친구

- 고유 친구 코드
- 요청/수락/거절
- 친구 목록
- 온라인/초대 가능 상태
- 협동 초대
- 친선전
- 최근 함께 플레이한 사람
- 삭제/차단

1차 자유 텍스트 채팅은 필수 아님. 빠른 통신 우선.

---

# 18. PvP

1차:

- 1v1 일반
- 1v1 랭킹
- 1v1 친선
- 2v2 일반
- 2v2 친선

2v2 랭킹은 동접 확인 후.

랭킹 표준화:

- 모든 캐릭터 Lv50
- +0
- 메인 영구 전투 보너스 0
- 실제 보유 캐릭터/해금 형태만 사용

MMR/티어/시즌/보상:
`systems/PVP_RANKING_MMR_REWARDS.md`

---

# 19. UI/도감/편성

- 솔로/1v1 10칸.
- 협동/2v2 각 5칸.
- PC drag&drop.
- 모바일 long press drag.
- 미보유 캐릭터는 편성에 표시 안 함.
- 미획득/미발견 도감은 silhouette + ???.
- 필요한 전투 수치는 게임 내부에서 확인 가능.
- 개발자 ID/debug/save version 노출 금지.

상세:
`systems/UI_UX_ENCYCLOPEDIA.md`

---

# 20. 계정/저장

- 게스트 플레이.
- Google/이메일 로그인 후보.
- 로그인 시 서버가 경제/소유/진행 정본.
- 게스트→로그인 migration.
- 서버 진행이 이미 있으면 자동 merge 금지, 사용자 선택.
- 진행 초기화와 계정 삭제 분리.
- 게스트 데이터 삭제 별도.
- battle/recruitment reward는 idempotent 처리.

상세:
`systems/ACCOUNT_SAVE_SYNC_SPEC.md`

---

# 21. 현재 문서와 실제 구현의 관계

중요: v1 콘텐츠 바이블이 실제 runtime보다 앞서 있을 수 있다.

예전 runtime에 다음이 남아 있으면 새 정본과 충돌하는 레거시다.

- LIGHT/옛 trait 체계
- 스토리 희귀도
- FLYING 표기
- 옛 pity/selectionCredits
- Lv50 약 1.595배
- 이동속도/출격한도 보물
- SPECIAL5 고난도 9~10

무조건 실제 main을 확인해 현재 남아 있는 것만 수정한다. 이미 제거된 것을 다시 건드리지 않는다.

---

# 22. 작업 원칙

- 새+옛 구현 병존 금지.
- 누적 hotfix/override 금지.
- 교체 시 레거시 code/data/test 함께 제거.
- 문서 DESIGN_TARGET → 구현 → 자동검증 → 사람 테스트 → TESTED/LOCKED.
- 구현 전에 관련 위키가 DESIGN_TARGET 이상인지 확인.
- 기능 체크리스트뿐 아니라 play-feel QA를 별도 수행.
- PC/모바일 실제 해상도에서 텍스트/입력/전투 가시성 검사.

---

# 23. 다음 채팅에서 구현을 요청받으면

1. 현재 GitHub main 최신 commit 확인.
2. 이 인수인계 숫자를 과거 대화에서 그대로 믿지 말고 현재 파일 재확인.
3. `CANONICAL/GAME_DESIGN_FULL/관련 위키` 읽기.
4. `IMPLEMENTATION_STATUS/FEATURE_COVERAGE_MATRIX`와 실제 code/content 비교.
5. 문서와 구현의 차이를 목록화.
6. 가장 하위 기반 schema부터 coherent slice로 구현.
7. 구식 경로 즉시 정리.
8. typecheck/test/build.
9. 실제 플레이/화면 검사.
10. 위키 상태와 구현상태 문서를 갱신.

질문/계획만 하고 끝내지 말고, 사용자가 구현을 지시했다면 실제 작업을 진행한다.
