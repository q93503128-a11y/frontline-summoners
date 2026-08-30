# 구현 ↔ 콘텐츠 위키 정합 감사 — 2026-08-30

상태: `IMPLEMENTATION_AUDIT`

이 문서는 `docs/content-wiki/` 전체와 현재 `main` 실행 코드/콘텐츠를 대조한 결과다. 기획 정본을 대체하지 않으며, 코드가 실행된다는 이유만으로 위키의 DESIGN_TARGET을 자동 폐기하지 않는다.

권위 순서는 `docs/INDEX.md`를 따른다.

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. 관련 시스템 정밀 문서
4. 관련 `docs/content-wiki/` 상세 페이지
5. content/schema/code/test
6. 구현 상태 문서

`DESIGN_TARGET`은 플레이테스트 전 목표값이므로, 불일치가 발견됐다고 숫자를 무조건 덮어쓰지 않는다. 실제 이행 시 deterministic baseline과 사람 플레이테스트를 같이 남긴다.

---

# 1. 현재 실행 규모

현재 표준 stage runtime 기준:

- MAIN: 80
- SPECIAL stage: 61
  - 기존/제한 도전: 9
  - 주기 재화 프로토타입: 18
  - 상시 도전/보스: 23
  - 이벤트: 11
- stage 합계: 141
- 플레이어 캐릭터: 43
- 진화 form 데이터: 129
- 실행 적/보스: 56
- stage collection: 19
- 게스트 save schema: v12

별도 record runtime foundation:

- `record_endless_front`
- `record_boss_rush`

두 기록전은 일반 stage 141개에 억지로 포함하지 않는다.

---

# 2. 정합도가 높은 영역

## 2.1 메인 2~4장 일반 적과 스테이지

2~4장의 적 기준 스탯, 속성/태그, Slow/Push/Revive, map/base/supply, spawn frame, magnification은 상세 위키와 높은 수준으로 일치한다.

예외는 1장 legacy 적을 후속 장에서 재사용하는 자리와 일부 후반 보스 phase grammar다.

## 2.2 공통 C/B/A 및 초기 S/SS F1

현재 `content/units/recruitment-01.json`의 F1 전투 수치는 다음 위키 목표와 대체로 직접 대응한다.

- `COMMON_POOL_V1_COMBAT_SPECS.md`
- `INITIAL_SERIES_01_03_COMBAT_SPECS.md`

배너 확률도 현재 후보값 C42/B32/A22.7/S3/SS0.3과 맞는다.

## 2.3 진화 recipe / 레벨 배율 / 메인 영구 보상

- 43종 F2/F3 진화 recipe는 상세 recipe 문서와 정합도가 높다.
- Lv1~50 multiplier anchor와 +level 배율 foundation이 수치 위키와 맞는다.
- 메인 80 영구 보상은 `MAIN_PERMANENT_REWARDS.md`와 정합도가 높다.
- 이동속도 영구 증가/배치한도 영구 증가를 넣지 않는 현재 방향도 상위 규칙과 일치한다.

## 2.4 도감 미발견/미획득 정책

현재 도감은:

- 미발견 적 → 실루엣 + `???`
- 미획득 아군 → 실루엣 + `???`
- 편성 → 미획득 아군 미표시

를 실제로 구현하고 있다.

## 2.5 최근 상시/제한/이벤트 SPECIAL

- 상시 도전 23전장과 전용 보스의 핵심 사양은 상세 SPECIAL 위키에 맞춰 작성됐다.
- Weaken / one-time Revive / 폭식룡 HP threshold advance가 실제 simulation grammar로 구현됐다.
- `다섯 깃발`은 솔로 최대 5종, 협동 1인 최대 3종을 stage data에서 선언한다.
- `가벼운 주머니`는 선택 형태의 실제 생산비 400 이하를 검사한다.
- 이벤트 11전장은 별도 event content와 availability window를 가진다.
- 이벤트 기간 밖에서는 client sortie/result와 server coop stage open을 차단한다.

---

# 3. 큰 설계 ↔ 실행 드리프트

## 3.1 스토리 10종 F1/F2/F3

가장 큰 캐릭터 드리프트다.

`STORY_ROSTER_V1_COMBAT_SPECS.md`는 초기 프로토타입 이후 작성된 DESIGN_TARGET인데, 현재 `content/units/chapter-01.json`은 과거 전투 수치를 대체로 유지한다.

예:

- 위키 징집병 F1: HP 60 / ATK 20 / cycle 40F / standing 85 / recharge 90F
- 현재 실행 징집병: HP 145 / ATK 15 / cycle 25F / standing 42 / recharge 60F

다른 스토리 캐릭터도 HP/ATK/range/recharge/전문 대상에서 큰 차이가 있다.

현재 43종×3형태 =129 form 데이터는 존재하지만 상당수 F2/F3는 role template 기반으로 생성되어 있으며, 위키의 캐릭터별 상세 3형태 전투 사양과 1:1 대응하지 않는다.

판정:

- `runtime exists`
- `wiki combat fidelity incomplete`
- 무작정 수치 교체 금지
- 1장/스토리 전용 migration + regression/playtest 배치 필요

## 3.2 메인 1장 적/보스

현재 1장 적은 legacy ID/프로토타입 군을 유지한다.

현재 예:

- `enemy-raider`
- `enemy-sprinter`
- `enemy-spearman`
- `enemy-shield`
- `enemy-cultist`
- `enemy-sniper`
- `enemy-knight`
- `enemy-berserker`

위키 목표는 1장의 학습 속성 NEUTRAL/BEAST에 맞춘 별도 roster다.

특히 황금가면은 위키에서 NEUTRAL 보스로 명시되어 있으나 현재 legacy `enemy-boss`는 ARCANE이다.

1장 상세 stage geometry/trigger는 후대 canonicalization으로 위키와 상당히 가까워졌지만, 전투를 구성하는 1장 roster가 옛 계층에 남았다.

따라서 1장 전체를 새로 만드는 것이 아니라:

1. save compatibility를 보존하고
2. canonical Ch1 enemy definitions를 추가하거나 alias/migration하며
3. stage waves를 새 roster로 이행하고
4. 사람 튜토리얼 체감을 재검증

하는 방식이 적절하다.

## 3.3 LOCKED stage schema 일부가 실행되지 않음

`STAGE_SPEC_SCHEMA.md`는 다음을 실행 가능한 stage 사양으로 요구한다.

- killSupplyMultiplier
- first/repeat reward
- charged/depleted reward
- reward charge
- sweep ticket policy
- deterministic baseline metadata 등

현재 CampaignStage schema에는 이들 중 상당수가 직접 표현되지 않는다.

예: 1장 ST09의 `killSupplyMultiplier:1.05`는 현재 `specialRules` 문자열로만 남아 있고 simulation에서 소비되지 않는다.

판정: stage schema migration 미완료.

---

# 4. 성장/경제 루프 감사

## 4.1 Base Lv 성장

구현됨:

- Lv multiplier curve
- +level multiplier
- 장 완료 Lv cap 10→20→30→40→50
- 전투 슬롯에 레벨 적용

미구현:

- 플레이어가 실제로 골드를 지불해 Base Lv를 올리는 Growth UI transaction
- 위키의 레벨별 gold cost 소비 경로

현재 성장 화면은 레벨을 표시하지만 진화/형태 선택이 주 실행 기능이다.

판정: `combat foundation done / player-facing level economy missing`.

## 4.2 MAIN 일반 재화 보상

`MAIN_STAGE_CURRENCY_REWARDS_V1.md`에는 MAIN80 전부의 firstGold/recruitmentCurrency/evolution materials/sweep tickets가 정의돼 있다.

현재 `recordNormalStageClear()`는:

- NORMAL_CLEAR
- permanent reward
- progression

은 기록하지만 MAIN 일반 재화를 ledger에 지급하지 않는다.

따라서 MAIN80 일반 보상 경제는 현재 실행되지 않는다.

## 4.3 모집 비용

위키 수치 목표:

- 1회 모집: 모집재화 100
- 10회 모집: 1,000
- 10회 할인 없음
- 최소 희귀도 보장 없음

현재 `summon_crystal` 공급은 존재하지만 `performGuestRecruitment()`가 모집재화를 차감하지 않아 모집은 실질적으로 무료다.

판정: 명확한 미구현.

## 4.4 중복/+성장

현재:

- 중복 모집 결과를 자동으로 해당 캐릭터 +1 적용

위키 목표:

- 직접 +1 사용이 최고 효율
- 중복을 공용 +성장 재화로 분해할 선택지
- 공용 재화로 다른 캐릭터 +레벨을 올리는 교차 성장

현재 `soul_essence`는 공급되지만 소비 루프가 닫히지 않았다.

재화 명칭은 여러 상세 문서의 과거 가칭 `soul_shard`와 현재 실행 `soul_essence`를 별도 terminology migration에서 정리한다. 구현 상태 문서의 `soul_ember` 표기는 오류다.

---

# 5. 주기 재화 SPECIAL 감사

현재 18개의 플레이 가능한 재화 SPECIAL은 존재한다. 그러나 상세 위키의 정식 사양과는 큰 차이가 있다.

현재 구현:

- legacy `resource_*` stage IDs
- 메인 적 다수 재활용
- 상시 접근 가능
- rewardChargePolicy NONE
- 단일 repeatReward

위키 DESIGN_TARGET:

- collection당 약 72시간 개방
- 닫힌 뒤 최대 5일 내 재등장
- 보상 충전 최대 4
- 12시간마다 +1
- first clear 충전 미소모
- charged 1회 소비
- 0충전 플레이 가능, depleted 약 20%
- collection 전용 적군
- 별도 canonical `special_*` IDs
- first / charged / depleted 보상표

보상 수치도 현재 프로토타입과 위키표가 다르다.

판정:

`18-stage playable prototype`이지 `periodic resource SPECIAL wiki spec complete`가 아니다.

우선순위가 높은 후속 이행:

1. periodic availability state
2. reward charge ledger/timestamps
3. first/charged/depleted reward grammar
4. dedicated enemy roster
5. canonical ID migration/legacy alias
6. reward-economy test

---

# 6. 보스 phase grammar 감사

현재 후반 보스는 기본 스탯/공격 프로파일이 위키와 대체로 맞지만 HP phase 조건을 일부 근사한다.

## 대마도장

위키:

- HP 50% 이후 근거리 B 패턴 혼합

현재:

- 전투 시작부터 static A→A→B 패턴

## 벨자르

위키:

- 세 번째 hit의 Push 35%
- HP 저하 phase cycle 변화 후보

현재:

- unit-level Push 13%를 모든 hit에 적용하는 근사

## 공허엔진 제로

위키:

- HP >70%: AABAC
- 70~35%: ABCAB
- ≤35%: CABC

현재:

- 첫 패턴 루프가 전투 내내 고정

권장:

- boss ID 조건문 대신 generic deterministic HP-phase attack-pattern schema/runtime 추가.

---

# 7. 재클리어/소탕/거점 병기

## 7.1 2배속

NORMAL_CLEAR 후 무료 2× 원칙은 실제 구현 방향과 맞는다.

## 7.2 소탕권

위키에는 소탕권 획득/소비와 prior NORMAL_CLEAR 조건이 정의돼 있으나 현재 ticket inventory/consumption 전체 루프는 미완료다.

## 7.3 거점 병기

현재 sim에는 기본 damage+push weapon foundation이 있다.

위키 v1 목표는 3종:

- 전선포
- 결계발진기
- 보급투하기

각자 cooldown/effect/equip/progression, 협동 shared weapon까지 정의돼 있다.

판정: `single generic weapon foundation`, full v1 weapon catalog/progression 미구현.

---

# 8. 기록 SPECIAL

현재 별도 deterministic foundation이 존재한다.

## 끝없는 전선

- enemy base victory를 억제
- player base 파괴만 종료
- tick 기반 생존기록
- 고정 time schedule

## 보스 러시

- 9보스 순차
- 20초 정비
- 보급/쿨타임 상태 유지
- defeated boss count 기록

Save v12는 최고기록을 max-merge해 stale save가 기록을 낮추지 못한다.

미구현:

- Phaser 플레이어용 기록전 허브/전투/결과 UI
- 구간 최초 돌파 보상 transaction
- 장기 엔티티 안정성/실전 플레이테스트

판정: `runtime foundation implemented / player-facing record mode incomplete`.

---

# 9. 계정/온라인/PvP

## 협동

구현 foundation:

- authoritative 2-player combat
- 각 플레이어 5칸
- 개인 경제
- stage policy scaling
- progression/loadout validation
- 제한전 validation
- event availability validation

미완료:

- 공개 매칭 완성 UX
- reconnect grace / AI handoff
- 친구 기반 invite flow
- quick communication 최종 UX
- full shared base weapon rules

## 친구/PvP

상세 위키에는 친구/차단/최근 플레이어/초대와 1v1 normal/ranked/friendly, 2v2 normal/friendly, MMR/Elo, tier/season/reward가 구현 가능한 수준으로 작성돼 있다.

현재 실질 구현은 거의 없다.

## 계정

현재:

- guest IndexedDB/session save
- schema migration
- monotonic resource ledger
- max-merge record state

미구현:

- authenticated account authoritative save
- revision/version conflict resolution
- guest→account migration UI
- account transfer/delete/reset release flow
- server wallet/record persistence

---

# 10. UI/아트/오디오

## 이미 맞는 것

- 미획득/미발견 silhouette + ???
- 미획득 아군 편성 미표시
- compact viewport 대응 일부
- stage/codex/growth/recruitment 기본 화면

## production pending

- F1/F2/F3별 고유 portrait
- character-specific final sprites
- contact frame와 맞춘 공격 모션
- rarity/series 모집 reveal production
- full filters/search/favorite
- safe-area/zoom 전수 QA
- BGM/SFX audio bus
- accessibility options
- low-spec VFX/audio presets

이는 현재 사용자 개발 순서상 후반 production 단계로 남겨둔 영역이다.

---

# 11. 구현 상태 문서에서 과거 완료 판정을 낮춰야 하는 항목

다음 표현은 수정한다.

- `주기 재화 SPECIAL 구현 완료` → `18 playable prototype, detailed periodic wiki migration pending`
- `성장 구현` → `combat scaling/cap/evolution implemented, base-level gold transaction missing`
- `모집 구현` → `banner/pool/draw/duplicate auto-plus implemented, currency spend/disassembly loop missing`
- `기록전 미구현` → `deterministic runtime/save foundation implemented, UI/rewards pending`
- `제한 SPECIAL 미구현` → 실제 formation restriction까지 구현됨
- `이벤트 미구현` → 11 stages + availability implemented, cosmetic/cumulative rewards pending

---

# 12. 권장 이행 우선순위

## P0 — 현재 branch 구조 일관성

- split stage/enemy/policy import client/server 일치
- status/audit docs 최신화

## P1 — 경제 루프 닫기

1. MAIN80 일반 재화 첫/반복 보상 지급
2. Base Lv 골드 강화 UI/transaction
3. 모집 100/1000 summon_crystal 차감
4. 중복 직접 +1 vs 분해 선택
5. soul common +growth 소비

이 다섯 개가 닫혀야 현재 stage/성장/recruitment의 메타 루프가 실제 게임으로 연결된다.

## P1 — Ch1 canonical migration

- story 10종 상세 전투 target 검토/이행
- 1장 canonical enemy/boss roster 이행
- Ch1 속성 학습 NEUTRAL/BEAST 복원
- stage intent/난이도 재검증

숫자는 플레이테스트 없이 곧바로 LOCKED하지 않는다.

## P1 — 주기 재화 SPECIAL 정식화

- 전용 적
- rotation availability
- reward charge
- charged/depleted
- canonical stage IDs
- 보상 경제

## P2 — combat grammar

- HP phase attack patterns
- per-hit effects
- stage killSupplyMultiplier
- full sweep semantics
- base weapon 3종

## P2 — record player flow

- record hub/UI
- record result
- first-threshold reward transaction
- long-run stability

## P3 — account/social/PvP

- authenticated save
- friends/invites/quick communication
- PvP + ranking/MMR/season

## P4 — production art/audio/release QA

캐릭터/적/보스 고유 art/motion, contact-frame QA, BGM/SFX/accessibility, viewport 전수 QA.

---

# 13. 최종 판정

현재 프로젝트는 콘텐츠 숫자만 놓고 보면 MAIN80 + SPECIAL61까지 크게 확장됐지만, 위키를 정본으로 대조하면 완성도는 균일하지 않다.

가장 안정적으로 정본화된 층:

- MAIN 2~4장 일반 적/스테이지
- 모집 F1 roster
- 진화 recipe
- 메인 영구 보상
- 최근 상시/제한/이벤트 SPECIAL의 구조

가장 큰 이행 부채:

- story 10종/MAIN Ch1 legacy combat layer
- MAIN 일반 currency economy
- Base Lv player transaction
- recruitment currency/duplicate common-growth economy
- periodic resource SPECIAL detailed runtime
- boss HP phase grammar
- account/friends/PvP
- final art/audio

따라서 다음 개발은 stage 수를 계속 늘리는 것보다 먼저 **위키에 이미 상세하게 정의된 기존 시스템을 실제 runtime transaction으로 닫는 작업**이 효과가 크다.

이 문서는 사람 플레이테스트를 대신하지 않는다. DESIGN_TARGET을 TESTED/LOCKED로 승격하려면 `CONTENT_BIBLE_RULES.md`의 검증 조건을 그대로 적용한다.
