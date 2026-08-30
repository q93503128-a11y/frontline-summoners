# Frontline Summoners 구현 상태

기준: 2026-08-30  
최상위 기획 정본: `docs/CANONICAL.md`  
세부 정합 감사: `docs/content-wiki/systems/IMPLEMENTATION_WIKI_AUDIT_2026-08-30.md`

이 문서는 현재 실행 코드/콘텐츠의 구현 사실과 남은 큰 공백을 기록한다. 기획 정본을 대체하지 않는다.

## 현재 실행 콘텐츠

- MAIN: 4장 × 20 = **80 전장**.
- 일반 SPECIAL stage: **61 전장**.
  - 기존 프로토타입 5.
  - 제한 SPECIAL 4: 다섯 깃발 2 / 가벼운 주머니 2.
  - 주기 재화 SPECIAL playable prototype 18: 황금5 / 혼4 / 진화5 / 별빛4.
  - 상시 도전/보스 SPECIAL 23: 폭식룡4 / 망자4 / 유리성4 / 기계성4 / 균열4 / 세 왕3.
  - 기간 이벤트 11: 한여름 괴수 6 / 제로 엣지 5.
- 표준 stage 합계: **141**.
- 기록 SPECIAL은 일반 stage와 분리된 runtime foundation 2종: 끝없는 전선 / 보스 러시.
- 플레이어 캐릭터: **43종**.
- 진화 form 데이터: **129**.
- 실행 적/보스: **56종**.
- stage collection: **19**.

주의: 위 숫자는 실행 데이터 규모이며 각 콘텐츠가 상세 위키의 모든 DESIGN_TARGET을 충족한다는 의미가 아니다.

## 저장/메타경제

- 게스트 저장 schema **v13**.
- resource ledger: `gold`, `evo_fragment`, `evo_core`, `evo_crown`, `soul_essence`, `summon_crystal`, `sweep_ticket`.
- earned/spent monotonic ledger로 stale save가 소비한 재화를 되살리지 못하게 한다.
- v2~v12 세이브는 기존 contiguous MAIN NORMAL_CLEAR를 기준으로 MAIN first-clear 일반 재화를 v13 migration에서 한 번 소급 지급하고 `mainRewardedStageIds`로 재지급을 막는다.
- 기록 최고점은 max-merge로 stale save가 개인 기록을 낮추지 못한다.

### MAIN 일반 재화

- MAIN80 first-clear Gold/모집 결정/milestone 진화재료/소탕권 지급 연결.
- 재클리어는 각 stage의 repeatGold만 지급.
- 모집 결정/영구 보상/milestone extra는 재클리어에서 반복 지급하지 않는다.
- 상세 milestone 합산 기준 MAIN80 first-clear 총량:
  - Gold 249,160
  - 모집 결정 8,470
  - evo_fragment 154
  - evo_core 25
  - evo_crown 4
  - 소탕권 44
- 초기 위키 하단 요약의 산술 오기는 stage별 상세 milestone을 직접 합산한 위 수치로 정정했다.

### Base Lv / +Lv

- 메인 1/2/3/4장 완료로 Base Lv 상한 20/30/40/50이 열린다.
- Growth 화면에서 Base Lv +1/+5를 실제 Gold로 구매한다.
- Lv1→50 Gold 총비용 222,230의 위키 곡선을 실행한다.
- +레벨 상한 +50, +1당 HP/ATK +2% foundation 유지.
- 공용 `soul_essence`를 사용해 원하는 보유 캐릭터를 +1 할 수 있다.
- 공용 +1 비용: STORY 80 / C16 / B32 / A80 / S280 / SS880.

### 모집/중복

- 모집 1회 100, 10회 1,000 `summon_crystal`을 transaction 안에서 먼저 검증·차감한다.
- 10회 할인/최소 희귀 보장/천장/선택권 없음.
- 중복 처리 정책을 모집 화면에서 선택 가능:
  - `+1 우선`: 동일 캐릭터에 직접 +1, +50 초과분은 자동 분해.
  - `분해 우선`: C4 / B8 / A20 / S70 / SS220 `soul_essence` 획득.
- 분해→동일 희귀도 교차 +1 효율은 25% 출발값을 유지한다.
- 신규 획득/중복 처리/모집 결정 소비/혼 재화 지급은 하나의 save transaction 결과로 저장한다.

### 진화

- F2/F3 진화는 레벨/이전 form/재화 조건을 검사하고 재화를 차감해 해금한다.
- 이전 해금 형태 재선택 가능.
- 재생산 최종 하한 60F 유지.

아직 메타경제에서 남은 것:

- 실제 sweep action의 소탕권 1장 소비 + repeat reward transaction.
- periodic reward charge max4 / 12h recovery / charged-depleted 경제.
- authenticated account/server resource ledger와 guest→account authoritative sync.
- 전체 경제 사람 플레이테스트 및 공급량 조정.

## 캐릭터/적 전투사양 정합

정합도가 높은 층:

- 공통 C/B/A 모집 캐릭터 F1.
- 초기 3시리즈 S/SS F1.
- 메인 2~4장 일반 적/스테이지.
- 진화 recipe.
- 메인 영구 보상.

큰 migration 부채:

- 스토리 10종의 현재 F1 및 role-template F2/F3가 후대 `STORY_ROSTER_V1_COMBAT_SPECS.md` DESIGN_TARGET과 크게 다름.
- 메인 1장 적/보스는 legacy roster를 유지해 위키의 NEUTRAL/BEAST 학습 구조와 어긋남.
- 1장 stage geometry/trigger 자체는 후대 canonicalization으로 상세 위키와 상당히 가까움.

DESIGN_TARGET 수치는 사람 플레이테스트 전이므로 단순 덮어쓰지 않고 별도 Ch1/story migration batch에서 검증한다.

## 전투 코어

- 30Hz 결정론 simulation을 solo와 authoritative co-op이 공유.
- standing/attack range, foreswing/hit/backswing, 자연 KB/강제이동/DYING.
- Slow / Push / Weaken / one-time Revive.
- conditional close-range attack.
- 폭식룡 HP 60%/30% threshold advance + 다음 공격 startup 감소.
- 상태/정의가 simulation hash/signature에 포함됨.

아직 근사인 위키 세부사양:

- 대마도장 HP phase attack pattern.
- 벨자르 특정 hit만 Push하는 per-hit effect.
- 공허엔진 제로 HP 구간별 pattern loop.
- 일부 stage의 `killSupplyMultiplier`처럼 현재 문자열 specialRule로만 남은 규칙.

권장 후속: boss-ID 하드코딩이 아니라 generic deterministic HP-phase / per-hit grammar.

## SPECIAL

### 상시 도전/보스

- 23전장 실행.
- 전용 SPECIAL 보스 핵심 mechanics 실행.
- collection/main progression/sequential unlock을 save 경계에서도 재검증.
- 반복보상은 낮고 first-clear 중심.
- 프로필 훈장/장식 등 cosmetic layer는 아직 없음.

### 제한전

- 다섯 깃발: 솔로 최대 5종, 협동 플레이어당 최대 3종.
- 가벼운 주머니: 선택 형태 실제 생산비 400 이하.
- client preflight / battle factory / authoritative server에서 검증.
- 협동 제한은 stage ID 하드코딩이 아니라 stage data 필드로 선언.

### 이벤트

- 한여름 괴수 6 + 제로 엣지 5.
- 이벤트 적/보스 10종 별도 실행 데이터.
- availability window와 복각 window 데이터.
- 기간 밖 client sortie/result 및 server coop open 차단.
- 이벤트 profile/cosmetic/sweep-ticket/cumulative reward는 후속.

### 주기 재화

현재 상태는 **상세 위키 완성본이 아니라 18-stage playable prototype**이다.

구현됨:

- 18개 전투 stage.
- gold/evolution/soul/recruitment resource reward supply.
- sequential/progression unlock.

위키 대비 미구현/드리프트:

- periodic 72h rotation.
- reward charge max4 / 12h recovery.
- charged/depleted reward grammar.
- dedicated periodic enemy roster.
- 위키 canonical `special_*` stage IDs.
- 상세 위키의 first/charged/depleted 경제 수치.

따라서 `주기 재화 SPECIAL 완료`라고 표기하지 않는다.

## 기록 SPECIAL

별도 deterministic runtime foundation 구현:

- `record_endless_front`: 적 기지 파괴로 종료하지 않고 플레이어 기지 파괴 시 종료, tick 기반 생존 기록.
- `record_boss_rush`: 9보스 순차, 보스 사이 600F 정비, 보급/쿨타임 상태 유지, 최고 격파 보스 기록.

Save v13에 `endlessBestTimeMs`, `endlessBestReachedMinute`, `bossRushBestDefeated` 저장.

아직 미완료:

- 플레이어용 기록전 허브/전투/결과 Phaser flow.
- 기록 구간 first reward transaction.
- 장시간 entity 안정성 및 실제 플레이테스트.

## 재클리어/거점 병기

- NORMAL_CLEAR 후 무료 2× foundation은 구현.
- `sweep_ticket`은 실제 획득/저장되지만 sweep 실행 및 1장 소비 transaction은 미완료.
- periodic reward charge 미완료.
- 거점 병기는 generic damage+push foundation만 있음.
- 위키의 전선포/결계발진기/보급투하기 catalog/equip/progression/shared-coop rules는 미완료.

## 협동

구현 foundation:

- 대부분 MAIN/SPECIAL 동일 stage definition 사용.
- authoritative server runtime.
- 각 플레이어 5칸 loadout.
- 개인 경제.
- shared base victory path.
- progression/evolution/permanent reward validation.
- stage-specific coop scaling.
- formation restriction enforcement.
- event availability enforcement.

미완료:

- release 수준 공개 매칭/재접속/AI 인계.
- 친구 목록/초대/최근 플레이어/차단.
- 빠른 통신 최종 UX.
- full shared base weapon semantics.
- 협동 결과의 server-authoritative 계정 wallet 지급.

## PvP / 계정

현재 큰 공백:

- 1v1 일반/랭킹/친선.
- 2v2 일반/친선.
- Lv50/+0/영구보너스0 PvP standardization.
- MMR/Elo/티어/시즌/순위표/보상.
- authenticated server-authoritative account save.
- guest→account migration.
- account transfer/delete/reset release UX.
- server wallet/record persistence.

게스트 IndexedDB save만으로 계정 시스템 완료라고 하지 않는다.

## 도감/UI/아트/오디오

구현:

- 미발견 적 silhouette + ???.
- 미획득 아군 silhouette + ???.
- 미획득 아군 편성 미표시.
- 실제 조우 적 discovery 저장.
- 기본 stage/deck/growth/recruitment/codex UI.
- 일부 compact mobile 대응.

후반 production 단계:

- 캐릭터/적/보스 고유 production art.
- F1/F2/F3 portrait.
- contact-frame에 맞는 character-specific attack animation.
- rarity/series 모집 reveal.
- BGM/SFX audio bus.
- 접근성/저사양 옵션.
- full filter/search/favorite.
- viewport/safe-area/zoom 전수 QA.

현재 temporary art mapping은 최종 아트 완료로 세지 않는다.

## 업적/프로필

위키에는 초기 약 45~55 achievement와 title/frame/banner/emblem/badge 구조가 설계돼 있으나 현재 runtime은 미구현이다.
SPECIAL/event 문서의 프로필 보상은 현재 자원 보상으로 대체해 완료 처리하지 않는다.

## 다음 개발 우선순위

1. **Ch1/story canonical migration**: 스토리 10종 + 1장 적/보스 + 속성 학습을 위키 목표와 대조해 이행하고 플레이테스트.
2. **주기 재화 SPECIAL 정식화**: dedicated enemies + rotation + reward charge + charged/depleted + canonical ID migration.
3. **전투 grammar 확장**: HP phase pattern, per-hit effect, killSupplyMultiplier, full sweep semantics, base weapon 3종.
4. **기록전 사용자 flow**: hub/battle/result/reward + long-run QA.
5. **계정/친구/PvP**.
6. 마지막 production art/motion/audio/accessibility/release QA.

## 검증 원칙

- 파일 존재만으로 완료 처리하지 않는다.
- 위키 DESIGN_TARGET과 다르면 실행된다는 이유만으로 코드를 새 정본으로 취급하지 않는다.
- DESIGN_TARGET→TESTED/LOCKED 승격은 deterministic regression + 사람 플레이테스트를 요구한다.
- client/save/server가 필요한 기능은 전체 경로가 연결돼야 구현으로 센다.
- 대형 배치 중 반복 CI를 돌리지 않고 마지막 통합 검증에서 회귀를 모아 수정한다.
