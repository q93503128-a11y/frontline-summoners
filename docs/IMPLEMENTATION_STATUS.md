# Frontline Summoners 구현 상태

기준: 2026-08-30  
최상위 기획 정본: `docs/CANONICAL.md`  
세부 정합 감사: `docs/content-wiki/systems/IMPLEMENTATION_WIKI_AUDIT_2026-08-30.md`  
주기 SPECIAL 이행 기록: `docs/content-wiki/systems/PERIODIC_RESOURCE_SPECIAL_IMPLEMENTATION_2026-08-30.md`  
전투 grammar / 거점 병기 이행 기록: `docs/content-wiki/systems/COMBAT_GRAMMAR_BASE_WEAPON_IMPLEMENTATION_2026-08-30.md`  
계정 save v2 이행 기록: `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`  
계정 mutation/idempotency 이행 기록: `docs/content-wiki/systems/ACCOUNT_MUTATION_IDEMPOTENCY_IMPLEMENTATION_2026-08-30.md`  
계정 인증/session 이행 기록: `docs/content-wiki/systems/ACCOUNT_AUTH_SESSION_IMPLEMENTATION_2026-08-30.md`  
소탕 이행 기록: `docs/content-wiki/systems/SWEEP_SAVE_V14_IMPLEMENTATION_2026-08-30.md`

이 문서는 현재 실행 코드/콘텐츠의 구현 사실과 남은 큰 공백을 기록한다. 기획 정본을 대체하지 않는다. 과거 이행 문서의 Save v14 표기는 당시 단계 기록이며 현재 실행 게스트 save schema는 **v15**다.

## 현재 실행 콘텐츠

- MAIN: 4장 × 20 = **80 전장**.
- 일반 SPECIAL: **61 전장**.
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

### 게스트 save

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
- v2~v12 save는 contiguous MAIN NORMAL_CLEAR 기준으로 MAIN first-clear 일반 재화를 v13 migration에서 한 번 소급 지급하고 `mainRewardedStageIds`로 재지급을 막는다.
- v13 이하 별도 localStorage periodic charge는 v14 migration 경로에서 guest progress로 가져온다.
- v14 이하 progress는 v15에서 선택 거점 병기를 기본 전선포격기로 보정하면서 기존 진행/재화/charge/기록을 유지한다.
- periodic charge merge는 stale save 때문에 소비 charge가 부활하지 않게 보수적으로 merge한다.
- 기록 best/high-water는 max-merge하고 reward high-water가 best보다 앞설 수 없게 normalize한다.
- 선택 거점 병기 `selectedBaseWeaponId`를 durable guest progress에 저장한다.

### 서버 계정 save v2

- `account_saves` D1 table에 account당 revisioned canonical snapshot 1개.
- 서버 account save schema **v2**.
- legacy `account_progression_saves` v1은 migration source로 유지.
- 한 revision 아래 보관:
  - MAIN/SPECIAL progression.
  - NORMAL_CLEAR provenance.
  - MAIN first-clear receipt high-water.
  - permanent reward.
  - enemy discovery.
  - recruitment ownership.
  - Base Lv/+Lv/form/deck.
  - selected base weapon.
  - resource ledger.
  - periodic reward charge 4종.
  - record best/reward high-water.
- unknown currency, `spent > earned`, charge map/cap 위반, record high-water 불일치, 9보스 초과 기록, 잠긴 병기 선택을 거부한다.
- periodic charge refresh는 서버 시각 기준.
- v1→v2 migration은 진행/소유/성장을 보존하고 새 경제 필드는 보수적 기본값으로 초기화한다.
- v1에는 first-clear wallet receipt가 없으므로 기존 MAIN clear를 migrated `mainRewardedStageIds`에도 넣어 중복 first-clear 지급을 막는다.
- `replaceAccountSave`는 `expectedRevision` mismatch를 `revision_conflict`로 처리한다.

### account content / stage authority

- account progression authority는 **MAIN80 / SPECIAL61 / enemy80 / 전체 v2 permanent reward·evolution catalog**를 사용한다.
- stage policy authority는 표준 **141 stage** 전체를 읽는다.
- SPECIAL은 서버가 직접:
  - collection `unlockAfterStageId`.
  - `requiredProgressionStageId`.
  - `previousSpecialStageId`.
  - event availability window.
  - periodic availability schedule.
  - sweep eligibility.
  를 검증한다.
- 과거 `SPECIAL clear가 하나라도 있으면 main_01_020 필요` blanket gate는 제거했다.
- `main_01_003`부터 열리는 주기 SPECIAL 등 현재 authored gate를 그대로 따른다.
- 저장된 과거 이벤트 clear는 이벤트가 닫힌 뒤에도 정상 이력으로 남는다. 현재 availability는 새 battle/sweep mutation 때만 재검증한다.

### 공용 경제 정본

client/server가 `@frontline/sim`에서 다음을 공유한다.

- MAIN80 reward.
- record milestone reward.
- 모집/Base Lv/+Lv meta economy.
- 일반/이벤트/상시 SPECIAL reward.
- 주기 SPECIAL first/charged/depleted reward와 charge resolver.

정확한 record/SPECIAL 경제량은 사람 플레이 경제 검증 전 **DESIGN_TARGET**이다.

## 서버 authoritative mutation / idempotency foundation

현재 내부 server mutation foundation:

- MAIN battle result.
- 일반/주기/이벤트 SPECIAL battle result.
- 기록 SPECIAL result.
- 모집 1/10회 server RNG + wallet + ownership/duplicate 처리.
- MAIN/SPECIAL sweep.
- Base Lv.
- +Lv.
- evolution unlock.
- evolution form select.
- deck set.
- base weapon select.

### MAIN

- contiguous next-stage first clear 검증.
- NORMAL_CLEAR source 저장.
- permanent reward 최초 판정.
- first/repeat resource reward 판정.
- progression + reward + wallet을 같은 revision에 저장.

### SPECIAL

- known SPECIAL61 여부.
- collection/main progression/sequential gate.
- event/periodic 현재 availability를 서버 시각으로 검증.
- server snapshot 기준 first clear 판정.
- 일반/이벤트 first/repeat reward 지급.
- 주기 SPECIAL first/charged/depleted reward 지급.
- periodic first clear는 charge 미소모.
- charged repeat는 charge 정확히 1칸 소비.
- charge 0 repeat는 depleted reward.
- SPECIAL clear + wallet + charge를 같은 revision에 저장.

### 기록 SPECIAL

- 끝없는 전선: `main_03_020` unlock, trusted `survivalFrames`로 best/minute 계산, 새 minute high-water만 보상.
- 보스 러시: `main_04_020` unlock, 현재 9보스 cap, 새 defeated high-water만 보상.

### 모집

- canonical banner 3개를 서버가 직접 읽는다.
- 1회/10회만 허용.
- summon crystal 서버 차감.
- Worker crypto 기반 RNG.
- 신규 소유 생성.
- duplicate +1 또는 분해.
- +50 초과는 분해 처리.
- pull 결과/rarity를 client 자기신고로 받지 않는다.

### 소탕

- prior NORMAL_CLEAR 필요.
- stage policy `AFTER_NORMAL_CLEAR` 재검증.
- `sweep_ticket` 정확히 1장 소비.
- MAIN/일반 SPECIAL/이벤트는 repeat reward만 지급.
- 주기 SPECIAL은 charged/depleted repeat reward와 charge 소비를 같은 resolver로 처리.
- 기간 밖 이벤트/주기전은 account authority에서 거부.
- first clear, permanent reward, character unlock, progression, record를 만들지 않는다.

### 성장 / 진화 / 덱 / 병기

`META_PROGRESSION` action으로 서버 snapshot을 직접 변경한다.

Base Lv:
- 시작 cap Lv10.
- `main_01_020` / `main_02_020` / `main_03_020` / `main_04_020`으로 Lv20/30/40/50 해금.
- 보유 캐릭터만 가능.
- 감소 금지.
- canonical Gold curve를 서버가 계산/차감.

+Lv:
- +50 cap.
- 보유 캐릭터만 가능.
- 감소 금지.
- STORY/C/B/A/S/SS authored acquisition/rarity를 서버가 읽고 canonical soul essence 비용 계산.

진화:
- 해당 character의 form인지 확인.
- previous form unlock 필요.
- required Base Lv 필요.
- exact canonical recipe cost 차감.
- unlock과 form select는 별도 action.
- 실제 unlocked form만 선택 가능.

덱:
- 1..10.
- unique.
- owned-only.
- exact order 저장.

거점 병기:
- canonical 3종만 허용.
- account MAIN 진행으로 unlock 재검증.
- 잠긴 병기 선택 거부.

### idempotency / transaction

`account_mutation_receipts` 현재 kind:

- `MAIN_BATTLE_RESULT`
- `SPECIAL_BATTLE_RESULT`
- `RECORD_RESULT`
- `RECRUITMENT`
- `SWEEP`
- `META_PROGRESSION`

- 같은 key + 같은 business input 재전송은 exact result replay.
- 재지급/재차감/재추첨/periodic charge 재소비 없음.
- 같은 key를 다른 input에 재사용하면 거부.
- MAIN/SPECIAL/record battle result는 account 안에서 `battleId` 자체가 서로 겹치지 못한다.
- save revision CAS + receipt insert는 D1 batch 안에서 함께 처리한다.
- revision mismatch는 CHECK 실패로 batch rollback시켜 save/receipt 반쪽 commit을 막는다.

현재 단계는 **server storage/migration/revision + MAIN/SPECIAL/record/recruitment/sweep/meta-progression mutation/idempotency + session-authenticated account read/meta/recruitment/sweep HTTP foundation**이다. MAIN/SPECIAL/record battle result는 trusted completion proof가 아직 없으므로 public route로 노출하지 않는다.

## 인증 / account client state

### server identity / session

- 초기 `users` / `auth_identities` 구조를 유지.
- verified provider 경계: `google` / `email`.
- provider proof 검증이 끝난 identity만 받는 `resolveOrCreateUserForVerifiedIdentity` / `issueAuthSessionForVerifiedIdentity` 내부 함수 구현.
- public request가 provider/subject만 자기신고해 계정을 만드는 route는 없음.
- `auth_sessions` D1 table 추가.
- session token은 256-bit random 64자리 hex.
- DB에는 원문 token 대신 SHA-256 `token_hash`만 저장.
- expiry/revoke 검사.
- authenticated request의 account ownership은 body/query accountId가 아니라 Bearer session의 `principal.userId`로만 결정.

### public authenticated account route

- `GET /api/account`.
- `POST /api/account/meta`.
- `POST /api/account/recruitment`.
- `POST /api/account/sweep`.
- `POST /api/account/logout`.
- `401 authentication_required` / `409 revision_conflict` / `409 idempotency_conflict` 경계.
- CORS `Authorization` 허용.
- MAIN/SPECIAL/record battle result route는 아직 공개하지 않음.

### client state foundation

`apps/client/src/account-network.ts`:

- `GUEST_LOCAL`.
- `AUTHENTICATED_ONLINE`.
- `AUTHENTICATED_OFFLINE_CACHE`.
- Bearer token은 현재 `sessionStorage` foundation.
- server snapshot 읽기 cache는 token 원문이 아닌 session fingerprint와 함께 localStorage에 저장.
- 서버 접속 성공 시 server revision/snapshot 우선.
- 네트워크 실패 시 같은 fingerprint cache만 읽기용으로 사용.
- `401`이면 local credential/cache를 지우고 guest 상태로 복귀.
- authenticated mutation은 ONLINE에서만 가능.
- expectedRevision은 current remote revision에서 파생.
- revision conflict 시 최신 snapshot을 다시 읽지만 원래 재화 mutation을 자동 재실행하지 않음.
- offline mutation journal/queue 없음.

아직 인증 완료로 세지 않는 것:

- Google OAuth/OIDC proof 실제 검증/callback.
- 이메일 magic link/인증코드 발송·검증.
- 실제 로그인/계정 전환 Phaser UI.
- session renewal/rotation/revoke-all-devices 및 최종 credential transport 정책.

## 성장 / 모집 / 진화

### Base Lv / +Lv

- 메인 1/2/3/4장 완료로 Base Lv 상한 20/30/40/50 해금.
- guest Growth 화면에서 Base Lv +1/+5를 Gold로 구매.
- Lv1→50 Gold 총비용 222,230의 위키 곡선 실행.
- +레벨 상한 +50, +1당 HP/ATK +2% foundation.
- 공용 `soul_essence`로 원하는 보유 캐릭터 +1.
- 공용 +1 비용: STORY 80 / C16 / B32 / A80 / S280 / SS880.
- account server mutation과 `/api/account/meta` route가 동일 cap/비용/소유 authority 사용.
- client account-network에 authenticated meta mutation transport 구현.
- 기존 Growth Phaser 화면을 account state에 따라 guest/server authority로 분기하는 UI wiring은 남음.

### 모집 / 중복

- 1회 100 / 10회 1,000 `summon_crystal`.
- 할인/최소 희귀 보장/천장/선택권 없음.
- guest와 server foundation 모두 신규/중복/재화 transaction을 구현.
- 중복:
  - `+1 우선`.
  - `분해 우선`: C4 / B8 / A20 / S70 / SS220 soul essence.
- `/api/account/recruitment` + client authenticated transport 구현.
- 기존 모집 Phaser 화면의 account-state 분기/로그인 UX는 남음.

### 진화

- F2/F3는 level/이전 form/재화 조건 검사 후 해금.
- 이전 해금 form 재선택 가능.
- 재생산 최종 하한 60F.
- 스토리 10종 F2/F3 20개 explicit combat form 실행.
- account server evolution unlock/form select/deck mutation과 authenticated meta route 구현.
- 기존 growth/deck Phaser 화면의 account-state 분기는 남음.

## 전투 코어

- 30Hz deterministic simulation을 solo와 authoritative co-op이 공유.
- standing/attack range, foreswing/hit/backswing, 자연 KB/강제이동/DYING.
- Slow / Push / Weaken / one-time Revive.
- conditional close-range attack.
- `BOSS_HP_BELOW`, `ANY_OF`, wave dependency trigger.
- deterministic `attackPattern`.
- HP phase 기반 `attackPhases`.
- `hitDamages` / `hitEffects` 다단히트.
- 폭식룡 threshold advance.
- 대마도장 phase.
- 벨자르 3hit + 마지막 Push.
- 공허엔진 제로 3단계 phase.
- `main_01_009` kill-supply multiplier 실제 적용.
- evolution form의 cycle/contact/backswing/KB/target mode data-driven 교체.
- simulation hash/signature에 상태/정의 포함.
- phase/per-hit/kill-supply grammar를 client solo/server co-op이 공유.

남은 전투 코어:

- 사람 플레이 수치/예고/보스 체감 조정.
- production art/motion contact frame과 판정 일치 QA.

## 캐릭터 / 적 전투사양

현재 이행:

- 스토리 10종 F1 Lv1 DESIGN_TARGET.
- 스토리 10종 F2/F3 explicit form.
- 제1장 적/보스 10종 상세 사양.
- 공통 C/B/A 모집 캐릭터 F1.
- 초기 3시리즈 S/SS F1.
- 메인 2~4장 일반 적/스테이지.
- 상시 SPECIAL 보스 mechanics.
- 이벤트 적/보스 10종.
- 주기 SPECIAL 전용 적/보스 24종.
- 진화 recipe / 메인 permanent reward.

아직 TESTED/LOCKED 아님:

- 스토리/제1장 수치.
- 각 진화 form 최종 전투 체감.
- 일부 후보 specialty/tag.
- 주기 SPECIAL 전용 적 production visual.

## SPECIAL

### 상시 도전 / 제한 / 이벤트

- 상시 도전/보스 23전장 실행.
- 다섯 깃발 / 가벼운 주머니 제한전 실행.
- 제한은 client preflight/battle factory/authoritative server에서 검증.
- 기간 이벤트 11전장 실행.
- 이벤트 availability + rerun windows 실행.
- 기간 밖 client sortie/result 및 server battle/sweep authority 차단.
- cosmetic/profile/cumulative event reward layer는 후속.

### 주기 재화

- canonical 18전장 실행.
- 전용 적/보스 24종.
- detailed first/charged/depleted reward.
- collection별 max charge 4.
- 12시간 +1, 닫힌 동안도 회복.
- 72h open / 168h cycle / stagger 0/42/84/126h.
- closed 96h = 4일.
- progression + previous SPECIAL 단계 해금.
- guest battle/sweep와 server account mutation foundation 모두 동일 shared resolver 사용.
- authenticated sweep route/client transport도 동일 resolver의 server mutation을 사용.

주기 SPECIAL 잔여:

- authenticated actual-battle completion registry/result proof.
- production art/motion.
- 경제/난이도 사람 플레이 후 TESTED/LOCKED 승격.

## 기록 SPECIAL

플레이어 flow:

- `record_endless_front`
  - `main_03_020` 후 해금.
  - 1× / SOLO_ONLY / sweep 불가.
  - player base 파괴까지 생존 기록.
  - 새 정수 minute만 최초 보상.
- `record_boss_rush`
  - `main_04_020` 후 해금.
  - 1× / SOLO_ONLY / sweep 불가.
  - 현재 9보스 순차.
  - 보스 사이 600F 정비.
  - 보급/worker/cooldown/weapon 상태 유지.
  - 새 defeated boundary만 최초 보상.
- `record-hub → record-battle → record-result` Phaser flow.
- 저장 덱/level/+level/form/permanent reward/선택 base weapon 사용.
- transaction 전 재도전/복귀 입력 차단.
- 12분 연속 entity-bound regression 존재.
- account mutation foundation도 trusted result에서 best/high-water와 reward를 계산.

잔여:

- authenticated trusted battle completion registry/session 연결.
- 장기전 사람 QA와 milestone 경제 조정.
- production art/motion/audio.

## 거점 병기

- 3종 deterministic runtime:
  - 전선포격기: 피해 + 비구조 적 Push.
  - 결계발진기: 생존 아군 snapshot 피해감소.
  - 보급낙하기: 지연 후 maxSupply 비례 보급.
- 해금: 기본 / `main_02_010` / `main_03_010`.
- Save v15 durable selection.
- 출정 허브 실제 선택 UI.
- 일반 solo/record에서 선택 병기 사용.
- account server 내부 병기 선택 mutation도 unlock authority로 구현.
- authenticated meta route/client transport에서 병기 선택 mutation 사용 가능.

### 협동 base weapon closure

- 팀 공유 1슬롯.
- ready 전 양쪽이 자신이 해금한 병기 선택.
- 같은 선택이어야 ready.
- ready 후 변경 불가.
- server가 양쪽 MAIN 진행으로 unlock 재검증.
- authoritative battle에 합의된 definition 1개 주입.
- cooldown/charge 공유.
- same-frame 양쪽 입력은 deterministic ordering으로 1회 승인.
- activator seat 기록.
- supply drop은 승인 seat의 개인 보급에만 귀속.
- client lobby/HUD authoritative shared weapon 표시.

잔여:

- 기존 BaseWeaponScene의 account-state 분기.
- production VFX/SFX QA.
- 사람 플레이 사용률/cooldown/effect 조정.

## 협동

구현 foundation:

- MAIN/SPECIAL stage definition 공유.
- authoritative server runtime.
- 플레이어별 5-slot loadout / 개인 경제 / shared base.
- progression/evolution/permanent reward validation.
- stage-specific coop scaling.
- formation restriction.
- event/periodic availability.
- solo와 같은 combat grammar.
- shared base weapon negotiation/cooldown/seat ownership.

잔여:

- 공개 매칭/reconnect/AI takeover release polish.
- 친구/초대/최근 플레이어/차단.
- 빠른 통신 최종 UX.
- 협동 seat을 authenticated session/account에 bind.
- 협동 completion을 authenticated account progression/wallet/charge mutation에 연결.

## PvP / 계정 제품화

현재 계정 foundation:

- revisioned server account save v2.
- server-authoritative economy/progression/meta mutations.
- idempotency receipts + atomic CAS.
- `users` / `auth_identities` verified identity binding boundary.
- hashed Bearer `auth_sessions`.
- session→accountId binding.
- public authenticated account read/meta/recruitment/sweep/logout API.
- client `GUEST_LOCAL` / `AUTHENTICATED_ONLINE` / `AUTHENTICATED_OFFLINE_CACHE` state foundation.
- fingerprinted read-only account cache.
- online-only authenticated mutation / revision conflict refresh without automatic replay.

남은 큰 공백:

- 실제 Google OAuth/OIDC verification/callback.
- 이메일 magic link/인증코드 발송·검증.
- 로그인/계정전환 UI와 session renewal/rotation/revoke-all 정책.
- guest→account migration 및 existing server progress 충돌 UX.
- trusted solo/SPECIAL/record battle completion registry/result proof.
- 기존 recruitment/growth/evolution/deck/base-weapon Phaser 화면을 account state에 실제 연결.
- 협동 authenticated seat/result binding.
- account transfer/delete/reset UX.
- 친구/차단 및 실시간 세션 계정 권위.
- 1v1 일반/랭킹/친선.
- 2v2 일반/친선.
- Lv50/+0/permanent bonus 0 PvP standardization.
- MMR/Elo/티어/시즌/순위표/보상.

session/API foundation이 존재한다는 이유만으로 provider proof와 battle proof까지 포함한 production 계정 시스템 완료라고 하지 않는다.

## 도감 / UI / 아트 / 오디오

구현:

- 미발견 적 silhouette + ???.
- 미획득 아군 silhouette + ???.
- 미획득 아군 편성 미표시.
- 실제 조우 적 discovery 저장. 기록전 조우 포함.
- stage/deck/growth/recruitment/codex/base-weapon/record 기본 UI.
- 협동 shared weapon 선택/표시 UI.
- 일부 compact mobile 대응.

후반 production:

- 캐릭터/적/보스 고유 production art.
- F1/F2/F3 portrait.
- contact-frame character-specific attack animation.
- rarity/series recruitment reveal.
- base weapon production VFX/SFX.
- BGM/SFX audio bus.
- 접근성/저사양 옵션.
- full filter/search/favorite.
- viewport/safe-area/zoom 전수 QA.

현재 temporary/generic art fallback은 최종 아트 완료로 세지 않는다.

## 업적 / 프로필

위키에는 초기 약 45~55 achievement와 title/frame/banner/emblem/badge 구조가 설계돼 있으나 현재 runtime 미구현이다.
SPECIAL/event 문서의 profile reward를 현재 resource reward로 대체했다고 해서 완료 처리하지 않는다.

## 최근 자동검증 기준점

- 전투 grammar / base weapon runtime: `8fbd6389a52951007254bdd175cbc2c8b11ac835`, CI #671 green.
- sweep / Save v14 당시 묶음 이후 stale reward API test 교정: `86067322062fde59e15e20b85801fb7450ca7220`, CI #673 green.
- record SPECIAL 플레이 flow: `a5afb5305e104602928ce20e1033a202dd74db91`.
- 12분 record entity regression: `10f5d556a10684be4bc6dfd2cc3b637c7a64e277`, CI #689 green.
- coop shared base weapon / supply-drop seat ownership closure: `8ab44ae47c6a82d23fa114d4221133eae8fa8dcc`, CI #705 green.
- account save v2 storage/migration/strict validation: `194b785a6fb9e4dcb08b05007597c8282abf4b54`, CI #710 green.
- MAIN/record/recruitment account mutation/idempotency + full account catalog: `cf91e4e3963347b73a57749b9b79d1cbfcb4c8a1`, CI #730 green.
- battleId cross-result uniqueness 보강: `1d8a96c8676f96ba965640e826106c3fdb56dc35`, CI #735 green.
- SPECIAL/sweep account authority + shared SPECIAL reward + authored history gate: `456bc39e9d4b4bda687f583923277f396d622970`, CI #738 green.
- account Base Lv/+Lv/evolution/form/deck/base-weapon mutation + `META_PROGRESSION` receipt: `2232d4b92a16b49f9bb78efcaf1051d9560902d2`, CI #746 green.
- verified identity/session storage + Bearer account HTTP route: `5972fe8bcfeac8c0c9ac9ee48fbb9222f95fe428`, CI #755 green.
- client account three-state/read-cache/online-mutation foundation: `71653a5df696a38010cb2235fbe24b087c7c2730`, **CI #757 전체 green(typecheck/schema/sim/server/client/build)**.

## 다음 개발 우선순위

1. **provider proof + 로그인 UX**: Google OAuth/OIDC 또는 이메일 proof 실제 검증, session 발급/갱신, 계정전환 UI, 기존 Phaser 화면 account-state 분기.
2. **trusted battle completion registry**: solo/SPECIAL/record battleId 발급·서버 결과 proof·authenticated reward mutation 연결.
3. **guest→account closure**: 빈 계정 이전 transaction, 기존 서버 진행 충돌 선택 UX, read cache/guest 보존 검증.
4. **협동 release/account result closure**: authenticated seat/result 연결, 친구/초대/reconnect/AI takeover/빠른통신 polish.
5. **기록/SPECIAL 사람 QA 및 경제 튜닝**: 장기전 난이도, periodic/SPECIAL reward 공급량 TESTED/LOCKED 후보화.
6. **PvP foundation**: standardization, 1v1/2v2, MMR/season.
7. 마지막 production art/motion/audio/accessibility/release QA.

## 검증 원칙

- 파일 존재만으로 완료 처리하지 않는다.
- DESIGN_TARGET과 다르면 실행된다는 이유만으로 코드를 새 정본으로 취급하지 않는다.
- DESIGN_TARGET→TESTED/LOCKED 승격은 deterministic regression + 사람 플레이테스트를 요구한다.
- client/save/server가 모두 필요한 기능은 전체 경로가 연결돼야 구현 완료로 센다.
- verified provider proof가 없는 내부 identity/session 함수만으로 로그인 완료라고 세지 않는다.
- trusted battle result proof가 없는 공개 client 자기신고 경로를 만들지 않는다.
- 대형 배치 중 불필요하게 CI를 반복하지 않고 마지막 통합 검증에서 회귀를 모아 수정한다.
