# Frontline Summoners 구현 상태

기준: 2026-08-30  
최상위 기획 정본: `docs/CANONICAL.md`  
세부 정합 감사: `docs/content-wiki/systems/IMPLEMENTATION_WIKI_AUDIT_2026-08-30.md`  
주기 SPECIAL 이행 기록: `docs/content-wiki/systems/PERIODIC_RESOURCE_SPECIAL_IMPLEMENTATION_2026-08-30.md`  
전투 grammar / 거점 병기 이행 기록: `docs/content-wiki/systems/COMBAT_GRAMMAR_BASE_WEAPON_IMPLEMENTATION_2026-08-30.md`  
계정 save v2 이행 기록: `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`  
소탕 이행 기록: `docs/content-wiki/systems/SWEEP_SAVE_V14_IMPLEMENTATION_2026-08-30.md`

이 문서는 현재 실행 코드/콘텐츠의 구현 사실과 남은 큰 공백을 기록한다. 기획 정본을 대체하지 않는다. 과거 이행 문서의 `Save v14` 표기는 당시 단계 기록이며 현재 실행 게스트 save schema는 **v15**다.

## 현재 실행 콘텐츠

- MAIN: 4장 × 20 = **80 전장**.
- 일반 SPECIAL stage: **61 전장**.
  - 기존 특수전 5.
  - 제한 SPECIAL 4: 다섯 깃발 2 / 가벼운 주머니 2.
  - 주기 재화 SPECIAL 18: 황금5 / 혼4 / 진화5 / 별빛4.
  - 상시 도전/보스 SPECIAL 23: 폭식룡4 / 망자4 / 유리성4 / 기계성4 / 균열4 / 세 왕3.
  - 기간 이벤트 11: 한여름 괴수 6 / 제로 엣지 5.
- 표준 stage 합계: **141**.
- 기록 SPECIAL: 일반 stage와 분리된 플레이 가능 모드 **2종** — 끝없는 전선 / 보스 러시.
- 플레이어 캐릭터: **43종**.
- 진화 form 데이터: **129**.
- 실행 적/보스: **80종**.
  - MAIN 40.
  - 상시 SPECIAL 실행 적/보스 6.
  - 이벤트 10.
  - 주기 재화 SPECIAL 전용 24.
- stage collection: **19**.

위 숫자는 실행 데이터 규모다. 상세 위키의 DESIGN_TARGET이 모두 사람 플레이까지 거쳐 LOCKED됐다는 뜻은 아니다.

## 저장 / 메타경제

- 게스트 진행 저장 schema **v15**.
- resource ledger:
  - `gold`
  - `evo_fragment`
  - `evo_core`
  - `evo_crown`
  - `soul_essence`
  - `summon_crystal`
  - `sweep_ticket`
- earned/spent monotonic ledger로 stale save가 소비한 재화를 되살리지 못하게 한다.
- v2~v12 세이브는 contiguous MAIN NORMAL_CLEAR를 기준으로 MAIN first-clear 일반 재화를 v13 migration에서 한 번 소급 지급하고 `mainRewardedStageIds`로 재지급을 막는다.
- v13 이하 별도 localStorage periodic charge는 v14 migration 경로에서 `GuestProgress.periodicRewardChargeByCollection`으로 가져온다.
- v14 이하 progress는 v15에서 선택 거점 병기를 기본 전선포격기로 보정하면서 기존 진행/재화/charge/기록을 유지한다.
- periodic charge merge는 소비된 charge가 stale save 때문에 부활하지 않도록 더 낮은 charge 상태를 보수적으로 우선한다.
- 기록 최고점과 기록 보상 high-water는 max-merge하며 reward high-water가 corresponding best보다 높아질 수 없게 normalize한다.
- 기록 저장 필드:
  - `endlessBestTimeMs`
  - `endlessBestReachedMinute`
  - `endlessRewardedMinute`
  - `bossRushBestDefeated`
  - `bossRushRewardedDefeated`
- 선택 거점 병기 `selectedBaseWeaponId`를 durable guest progress에 저장한다.

### 서버 계정 save v2 foundation

- `account_saves` D1 table에 account당 revisioned canonical snapshot 1개를 둘 수 있다.
- 서버 계정 save schema는 **v2**이며 기존 `account_progression_saves` v1은 별도 legacy migration source로 유지한다.
- v2 snapshot은 진행/소유/성장/덱과 함께 다음을 같은 revision 경계에 포함한다.
  - `mainRewardedStageIds`
  - `selectedBaseWeaponId`
  - `resourceLedgerById`
  - `periodicRewardChargeByCollection`
  - `recordModeProgress`
- 서버 snapshot은 unknown currency, `spent > earned`, periodic collection 누락/charge cap 위반, record high-water 불일치, runtime 9보스 초과 기록, 잠긴 거점 병기 선택을 거부한다.
- periodic charge는 서버 시각 기준으로 refresh한다.
- v1→v2 migration은 진행/소유/성장을 보존하고 새 경제 필드는 보수적 기본값으로 초기화한다.
- v1에는 first-clear 재화 수령 ledger가 없으므로 기존 cleared MAIN은 migrated `mainRewardedStageIds`에도 넣어 retroactive 중복 first-clear 지급을 막는다.
- `replaceAccountSave`는 `expectedRevision` 불일치 시 `revision_conflict`를 반환한다.

이 단계는 **server storage/migration/revision foundation**이다. 실제 인증 session, client 계정 상태 머신, battleId/requestId idempotent mutation, 게스트 이전 transaction까지 완료된 것은 아니다.

### MAIN 일반 재화

- MAIN80 first-clear Gold/모집 결정/milestone 진화재료/소탕권 지급 연결.
- 재클리어는 각 stage repeatGold만 지급.
- 모집 결정/영구 보상/milestone extra는 재클리어에서 반복 지급하지 않는다.
- 상세 milestone 합산 기준 MAIN80 first-clear 총량:
  - Gold 249,160
  - 모집 결정 8,470
  - evo_fragment 154
  - evo_core 25
  - evo_crown 4
  - 소탕권 44

### Base Lv / +Lv

- 메인 1/2/3/4장 완료로 Base Lv 상한 20/30/40/50 해금.
- Growth 화면에서 Base Lv +1/+5를 실제 Gold로 구매.
- Lv1→50 Gold 총비용 222,230의 위키 곡선 실행.
- +레벨 상한 +50, +1당 HP/ATK +2% foundation 유지.
- 공용 `soul_essence`로 원하는 보유 캐릭터를 +1 가능.
- 공용 +1 비용: STORY 80 / C16 / B32 / A80 / S280 / SS880.

### 모집 / 중복

- 모집 1회 100, 10회 1,000 `summon_crystal`.
- 10회 할인/최소 희귀 보장/천장/선택권 없음.
- 중복 처리:
  - `+1 우선`: 동일 캐릭터 직접 +1, +50 초과분 자동 분해.
  - `분해 우선`: C4 / B8 / A20 / S70 / SS220 `soul_essence`.
- 신규 획득/중복 처리/결정 소비/혼 지급은 하나의 save transaction 결과로 저장.

### 진화

- F2/F3 진화는 레벨/이전 form/재화 조건을 검사하고 재화를 차감해 해금.
- 이전 해금 형태 재선택 가능.
- 재생산 최종 하한 60F 유지.
- 스토리 10종 F2/F3 20개는 role-template가 아니라 explicit combat form으로 실행.

### 주기 재화 charge

- collection별 max 4.
- 12시간마다 +1.
- 닫힌 동안도 회복.
- first clear 충전 미소모.
- repeat charged 1회 소비.
- charge 0에서도 depleted reward로 플레이 가능.

### 소탕

- prior NORMAL_CLEAR 필요.
- 1회당 `sweep_ticket` 정확히 1장 소비.
- MAIN/일반 SPECIAL/이벤트는 repeat reward만 지급.
- 주기 SPECIAL은 charged/depleted 반복 보상을 같은 resolver로 처리하며 charged면 charge 1칸을 함께 소비.
- 기간 밖 이벤트/주기전은 save authority에서 거부.
- 소탕은 first clear, 영구보상, 캐릭터 해금, 진행도, 기록을 만들지 않는다.
- stage-select에 실제 소탕 버튼, 티켓/charge 표시, 중복 클릭 방지, 즉시 결과 표시 연결.

메타경제에서 남은 큰 작업:

- authenticated account session에서 server save v2를 실제 정본으로 사용하는 mutation/API 연결.
- battleId/requestId idempotency와 협동/기록/모집/성장 결과의 server-authoritative 지급.
- 게스트→계정 이전/충돌 UX.
- 전체 경제 사람 플레이테스트 및 공급량 조정.

## 캐릭터 / 적 전투사양 정합

현재 이행:

- 스토리 10종 F1을 `STORY_ROSTER_V1_COMBAT_SPECS.md`의 Lv1 DESIGN_TARGET으로 이행.
- 스토리 10종 F2/F3 explicit form.
- 제1장 적/보스 10종 상세 전투사양.
- 공통 C/B/A 모집 캐릭터 F1.
- 초기 3시리즈 S/SS F1.
- 메인 2~4장 일반 적/스테이지.
- 상시 SPECIAL 보스 mechanics.
- 이벤트 전용 적/보스 10종.
- 주기 재화 SPECIAL 전용 적/보스 24종.
- 진화 recipe / 메인 영구 보상.

아직 TESTED/LOCKED 아님:

- 스토리/제1장 수치는 사람 플레이테스트 전 `DESIGN_TARGET`.
- generic per-hit damage/effect grammar는 구현됐지만 각 진화 form의 최종 수치/체감은 사람 플레이테스트 전 DESIGN_TARGET.
- 일부 문서의 후보 specialty/tag는 확정값으로 확대하지 않는다.
- 주기 SPECIAL 전용 적 24종은 production art/motion 전 generic visual fallback 사용.

## 전투 코어

- 30Hz 결정론 simulation을 solo와 authoritative co-op이 공유.
- standing/attack range, foreswing/hit/backswing, 자연 KB/강제이동/DYING.
- Slow / Push / Weaken / one-time Revive.
- conditional close-range attack.
- `BOSS_HP_BELOW`, `ANY_OF`, wave dependency trigger.
- 폭식룡 HP 60%/30% threshold advance + 다음 공격 startup 감소.
- deterministic `attackPattern`.
- generic `attackPhases`로 HP 구간별 공격 pattern/cycle 결정론 전환.
- `hitDamages` / `hitEffects`로 다단히트 타격별 피해/상태효과 실행.
- 대마도장 HP 50% phase, 벨자르 25/25/50 3hit + 마지막 hit Push, 공허엔진 제로 3단계 HP phase 실행.
- `main_01_009` `killSupplyMultiplier:1.05`가 실제 처치 보급에 적용.
- evolution explicit form이 공격주기/접촉 프레임/backswing/KB/target mode를 generic data로 교체 가능.
- 상태/정의는 simulation hash/signature에 포함.
- phase/per-hit/kill-supply grammar는 client solo와 server authoritative co-op이 같은 공용 grammar를 사용.

남은 전투 코어:

- 사람 플레이테스트를 통한 수치/예고 가독성/보스 체감 조정.
- production art/motion 실제 contact frame과 판정 일치 QA.

## SPECIAL

### 상시 도전 / 보스

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
- availability window + 복각 window 데이터.
- 기간 밖 client sortie/result 및 server coop open 차단.
- 이벤트 profile/cosmetic/sweep-ticket/cumulative reward는 후속.

### 주기 재화

- canonical 18전장:
  - `special_gold_convoy_01~05`
  - `special_soul_forge_01~04`
  - `special_evolution_gate_01~05`
  - `special_starlight_rift_01~04`
- dedicated enemy/boss 24종.
- detailed first/charged/depleted reward 수치.
- `COLLECTION_CHARGE` 정책 18전장.
- 72h open recurring availability를 client/server 동일 generic 계산기로 판정.
- 168h cycle + 0/42/84/126h stagger.
- collection별 closed 96h = 4일, 정본의 `다음 등장 최대 5일` 충족.
- progression + previous NORMAL_CLEAR 단계 해금.
- first clear charge 미소모 / repeat charge 소비 / depleted 반복 가능.
- sweep도 같은 charged/depleted resolver와 Save v15 transaction 사용.

주기 SPECIAL 잔여:

- production art/motion.
- charge의 authenticated account mutation/API 연결.
- 경제/난이도 사람 플레이테스트 후 TESTED/LOCKED 승격.

## 기록 SPECIAL

플레이어용 실제 flow 연결:

- `record_endless_front`
  - `main_03_020` NORMAL_CLEAR 후 해금.
  - 1× 고정 / SOLO_ONLY / 소탕 불가.
  - 적 거점 승리로 종료하지 않고 플레이어 기지 파괴까지 tick 기반 생존 기록.
  - 새 정수 분 경계를 처음 넘을 때만 구간 재화 보상.
- `record_boss_rush`
  - `main_04_020` NORMAL_CLEAR 후 해금.
  - 1× 고정 / SOLO_ONLY / 소탕 불가.
  - 현재 9보스 순차.
  - 보스 사이 600F(20초) 정비.
  - 보급/보급소/쿨타임/병기 상태를 초기화하지 않는다.
  - 새 보스 격파 구간을 처음 넘을 때만 구간 재화 보상.
- `record-hub` → `record-battle` → `record-result` Phaser flow.
- 실제 저장 덱/레벨/+레벨/진화 form/영구보상/선택 거점 병기를 사용.
- 결과 transaction 전 재도전/복귀 입력 차단.
- reward high-water로 같은 분/같은 boss 반복 보상 차단.
- 실패 run도 새로 넘은 구간은 결과 transaction에서 저장/보상.
- 끝없는 전선 12분(21,600 tick) 연속 entity-bound regression 통과.

기록 SPECIAL 잔여:

- 사람 플레이 장기전 난이도 곡선/가독성/피로도 조정.
- 현재 milestone 정확한 수량은 **DESIGN_TARGET**. 전체 경제 플레이테스트 뒤 TESTED/LOCKED 승격 필요.
- authenticated 계정에서는 서버가 기록/result/reward를 authoritative mutation으로 확정하는 경로가 아직 필요.
- production art/motion/audio polish.

## 재클리어 / 거점 병기

- NORMAL_CLEAR 후 무료 2× foundation.
- 실제 소탕 transaction/UI/Save v15 연결 완료.
- 주기 SPECIAL charged/depleted repeat reward와 sweep charge 소비 연결.
- 거점 병기 3종 deterministic runtime:
  - 전선포격기: 피해 + 비구조 적 Push.
  - 결계발진기: 사용 시점 생존 아군 snapshot 피해감소.
  - 보급낙하기: 지연 후 maxSupply 비례 보급.
- 해금: 전선포격기 기본 / 결계발진기 `main_02_010` / 보급낙하기 `main_03_010`.
- Save v15 `selectedBaseWeaponId` durable 저장.
- 출정 허브 `병기`에서 실제 선택/교체 UI 제공.
- locked/unknown 선택은 전선포격기로 normalize.
- 일반 솔로와 기록 SPECIAL이 저장된 선택 병기를 실제 simulation definition으로 사용.

### 협동 거점 병기 closure

- 협동 병기는 **팀 공유 1슬롯**.
- ready 전 양쪽이 각자 해금된 병기 중 하나를 선택.
- 양쪽 선택이 같아야 최종 ready 성립.
- ready 상태에서는 선택 변경 불가.
- 서버가 양쪽 MAIN clear 진행을 기준으로 병기 해금을 전투 생성 전에 다시 검증.
- 실제 authoritative battle에 합의된 병기 definition 하나를 주입.
- 두 플레이어 모두 사용 가능하되 charge/cooldown은 공유.
- 동일 frame 양쪽 사용 입력은 결정론적 command 순서에서 1회만 승인.
- 승인된 seat를 activator로 기록.
- client HUD는 authoritative snapshot의 실제 shared 병기를 표시.
- 보급낙하기는 30F hit frame에 **승인된 activator seat의 개인 보급에만** 지급.
- 상대 seat와 shared/dummy wallet에는 보급이 들어가지 않는다.

거점 병기 잔여:

- 일반 솔로/협동 HUD 및 병기별 production VFX/SFX 전수 QA.
- 사람 플레이로 3종 사용률/cooldown/효과량/협동 오사용 빈도 조정.
- 병기 강화 단계는 v1 필수 아님.

## 협동

구현 foundation:

- 대부분 MAIN/SPECIAL 동일 stage definition 사용.
- authoritative server runtime.
- 각 플레이어 5칸 loadout / 개인 경제 / shared base victory path.
- progression/evolution/permanent reward validation.
- stage-specific coop scaling.
- formation restriction enforcement.
- event availability enforcement.
- periodic recurring availability enforcement.
- combat HP phase/per-hit/kill-supply grammar는 solo와 동일 공용 정의.
- shared base weapon negotiation / ready agreement / unlock validation.
- shared weapon cooldown authority + activating seat 기록.
- 보급낙하기 activator 개인 보급 귀속.
- client lobby/HUD에 authoritative shared weapon 상태 연결.

협동에서 남은 큰 작업:

- release 수준 공개 매칭/재접속/AI 인계 polish.
- 친구 목록/초대/최근 플레이어/차단.
- 빠른 통신 최종 UX.
- 협동 결과를 server save v2 wallet/periodic charge/progression에 battleId idempotent mutation으로 실제 지급.
- authenticated account snapshot을 기준으로 한 최종 production authority 경계.

## PvP / 계정

서버 계정 save foundation:

- legacy `account_progression_saves` v1 progression authority 존재.
- canonical `account_saves` v2 storage foundation 추가.
- v2는 progression + first-clear receipt + wallet + periodic charge + record + selected base weapon을 하나의 revisioned snapshot으로 보관 가능.
- v1→v2 migration과 미래 schema write-protect.
- 경제/charge/record/병기 unlock strict validation.
- optimistic revision conflict foundation.

아직 큰 공백:

- 실제 Google/email 인증과 `AUTHENTICATED_ONLINE` session.
- client account state machine / offline cache.
- guest→account migration 및 기존 서버 진행 충돌 UX.
- battleId 전투 결과 idempotency / requestId 모집 idempotency.
- 성장/모집/클리어/기록의 server-authoritative mutation API.
- account transfer/delete/reset release UX.
- 친구/차단 및 실시간 세션 계정 권위.
- 1v1 일반/랭킹/친선.
- 2v2 일반/친선.
- Lv50/+0/영구보너스0 PvP standardization.
- MMR/Elo/티어/시즌/순위표/보상.

게스트 IndexedDB/local persistence나 server storage table 존재만으로 계정 시스템 완료라고 하지 않는다.

## 도감 / UI / 아트 / 오디오

구현:

- 미발견 적 silhouette + ???.
- 미획득 아군 silhouette + ???.
- 미획득 아군 편성 미표시.
- 실제 조우 적 discovery 저장. 기록전 조우도 discovery에 포함.
- stage/deck/growth/recruitment/codex/base-weapon/record 기본 UI.
- 협동 shared weapon 선택/표시 UI.
- 일부 compact mobile 대응.

후반 production 단계:

- 캐릭터/적/보스 고유 production art.
- F1/F2/F3 portrait.
- contact-frame에 맞는 character-specific attack animation.
- rarity/series 모집 reveal.
- 거점 병기 production VFX/SFX.
- BGM/SFX audio bus.
- 접근성/저사양 옵션.
- full filter/search/favorite.
- viewport/safe-area/zoom 전수 QA.

현재 temporary/generic art fallback은 최종 아트 완료로 세지 않는다.

## 업적 / 프로필

위키에는 초기 약 45~55 achievement와 title/frame/banner/emblem/badge 구조가 설계돼 있으나 현재 runtime은 미구현이다.
SPECIAL/event 문서의 프로필 보상은 현재 자원 보상으로 대체해 완료 처리하지 않는다.

## 최근 자동검증 기준점

- 전투 grammar / 거점 병기 runtime 묶음: `8fbd6389a52951007254bdd175cbc2c8b11ac835`, CI #671 green.
- 소탕 / Save v14 당시 묶음: `88947a6a0381a69c9d08def810fe576223e9e645`; 낡은 reward API 테스트를 `86067322062fde59e15e20b85801fb7450ca7220`에서 교체해 CI #673 green.
- Base weapon save/equip + Save v15 + record reward high-water 이후 반영.
- 기록 SPECIAL 플레이 flow: `a5afb5305e104602928ce20e1033a202dd74db91`.
- record scene exact optional type fix: `68b74dc328c6bd6e028f75db7cb285b0cd1b3ae5`.
- 12분 장기 record entity regression: `10f5d556a10684be4bc6dfd2cc3b637c7a64e277`, CI #689 전체 green.
- 협동 shared base weapon / supply-drop seat ownership closure: `155a511c272eb2cc70438cbf9ce2278c7bdd6a70`까지 구현, stale server fixture 교정 후 `8ab44ae47c6a82d23fa114d4221133eae8fa8dcc`, CI #705 전체 green.
- authoritative account save v2 storage/migration/strict validation: `194b785a6fb9e4dcb08b05007597c8282abf4b54`, **CI #710 전체 green(typecheck/schema/sim/server/client/build)**.

## 다음 개발 우선순위

1. **계정 authoritative mutation closure**: battleId/requestId idempotency, stage/record/recruitment/growth mutation, guest→account 이전 경계.
2. **기록 SPECIAL 사람 QA / 경제 튜닝**: 장기전 난이도, boss-rush 체감, milestone 수량 TESTED/LOCKED 후보화.
3. **친구 / 협동 release closure**: 친구·초대·재접속/AI 인계/빠른통신 polish.
4. **PvP foundation**: 표준화 규칙, 1v1/2v2, MMR/시즌.
5. 마지막 production art/motion/audio/accessibility/release QA.

## 검증 원칙

- 파일 존재만으로 완료 처리하지 않는다.
- 위키 DESIGN_TARGET과 다르면 실행된다는 이유만으로 코드를 새 정본으로 취급하지 않는다.
- DESIGN_TARGET→TESTED/LOCKED 승격은 deterministic regression + 사람 플레이테스트를 요구한다.
- client/save/server가 필요한 기능은 전체 경로가 연결돼야 구현으로 센다.
- 대형 배치 중 불필요하게 CI를 반복하지 않고 마지막 통합 검증에서 회귀를 모아 수정한다.
