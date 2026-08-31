# Frontline Summoners 구현 상태

기준: 2026-08-31  
최상위 기획 정본: `docs/CANONICAL.md`  
세부 정합 감사: `docs/content-wiki/systems/IMPLEMENTATION_WIKI_AUDIT_2026-08-30.md`  
주기 SPECIAL 이행 기록: `docs/content-wiki/systems/PERIODIC_RESOURCE_SPECIAL_IMPLEMENTATION_2026-08-30.md`  
전투 grammar / 거점 병기 이행 기록: `docs/content-wiki/systems/COMBAT_GRAMMAR_BASE_WEAPON_IMPLEMENTATION_2026-08-30.md`  
계정 save v2 이행 기록: `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`  
계정 mutation/idempotency 이행 기록: `docs/content-wiki/systems/ACCOUNT_MUTATION_IDEMPOTENCY_IMPLEMENTATION_2026-08-30.md`  
계정 인증/session 이행 기록: `docs/content-wiki/systems/ACCOUNT_AUTH_SESSION_IMPLEMENTATION_2026-08-30.md`  
소탕 이행 기록: `docs/content-wiki/systems/SWEEP_SAVE_V14_IMPLEMENTATION_2026-08-30.md`  
업적/프로필 이행 기록: `docs/content-wiki/systems/ACHIEVEMENT_PROFILE_IMPLEMENTATION_2026-08-31.md`

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
- 초기 achievement runtime catalog: **50개**.
- profile cosmetic runtime: TITLE / FRAME / BANNER / EMBLEM / BADGE.

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

### 게스트 profile meta

- 별도 local key `frontline-summoners:achievement-profile:v1`.
- guest combat/economy save v15와 분리.
- claimed achievement / cosmetic ownership / profile loadout / future fact / optional PvP tier 보관.
- 완료 업적은 별도 claim 버튼 없이 자동 claim.
- 미보유 장식 장착 금지, badge 최대 3.

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

### 서버 account profile v1

전투/경제 save revision과 프로필 꾸미기 revision을 분리한다.

- `account_profiles`: account당 profile schema v1 + 독립 revision + canonical snapshot.
- `account_profile_mutation_receipts`: `(user_id, request_id)` idempotency receipt.
- server account save v2에서 MAIN/SPECIAL/성장/진화/소유/도감/협동/기록 업적을 재평가한다.
- 완료 achievement는 profile read/sync 시 자동 claim.
- cosmetic ownership은 arbitrary 저장 list를 신뢰하지 않고 기본 장식 + server claimed achievement reward에서 재구성한다.
- client가 알려진 cosmetic id를 위조해도 claim이 없으면 ownership이 생기지 않는다.
- public profile mutation은 장착 `profileLoadout`만 받는다.
- fact id / PvP tier 기록 함수는 server-internal hook으로만 존재한다.

## account content / stage authority

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
- 과거 blanket SPECIAL gate는 제거했고 authored progression gate를 따른다.
- 저장된 과거 이벤트 clear는 이벤트가 닫힌 뒤에도 이력으로 남는다. availability는 새 battle/sweep 때 재검증한다.

## 공용 경제 정본

client/server가 `@frontline/sim`에서 다음을 공유한다.

- MAIN80 reward.
- record milestone reward.
- 모집/Base Lv/+Lv meta economy.
- 일반/이벤트/상시 SPECIAL reward.
- 주기 SPECIAL first/charged/depleted reward와 charge resolver.

정확한 record/SPECIAL 및 미확정 achievement resource 보상량은 사람 플레이 경제 검증 전 **DESIGN_TARGET**이다.

## 서버 authoritative mutation / idempotency

account save v2 mutation foundation:

- MAIN battle result.
- 일반/주기/이벤트 SPECIAL battle result.
- 기록 SPECIAL result resolver.
- 모집 1/10회 server RNG + wallet + ownership/duplicate 처리.
- MAIN/SPECIAL sweep.
- Base Lv.
- +Lv.
- evolution unlock.
- evolution form select.
- deck set.
- base weapon select.

### MAIN / SPECIAL

- MAIN contiguous next-stage first clear 검증.
- NORMAL_CLEAR provenance 저장.
- permanent reward/first/repeat resource 서버 판정.
- SPECIAL collection/progression/sequential/availability gate 서버 검증.
- periodic first clear는 charge 미소모.
- charged repeat는 charge 정확히 1 소모.
- charge 0 repeat는 depleted reward.
- progression + reward + wallet + 필요 charge를 같은 account revision에 저장.

### 기록 SPECIAL mutation resolver

- 끝없는 전선: `main_03_020` unlock, trusted survival frame 기반 best/minute와 새 high-water만 보상.
- 보스 러시: `main_04_020` unlock, 현재 9보스 cap, 새 defeated high-water만 보상.
- 다만 현재 공개 trusted battle transport는 MAIN/SPECIAL stage를 대상으로 하며 record mode의 authenticated proof/client 연결은 잔여다.

### 모집 / 성장 / 덱 / 병기

- canonical banner 3개, 1/10회만 허용, summon crystal 서버 차감, Worker crypto RNG.
- 신규 소유/duplicate +1/분해 서버 판정, +50 초과 분해.
- Base Lv chapter cap 10→20→30→40→50 및 canonical Gold cost.
- +Lv +50 cap 및 acquisition/rarity 기반 soul essence cost.
- evolution previous form/Base Lv/recipe resource 검증.
- deck 1..10 unique owned-only exact order.
- base weapon canonical 3종 + MAIN unlock 재검증.

### account save idempotency

`account_mutation_receipts` kind:

- `MAIN_BATTLE_RESULT`
- `SPECIAL_BATTLE_RESULT`
- `RECORD_RESULT`
- `RECRUITMENT`
- `SWEEP`
- `META_PROGRESSION`

- 같은 key + 같은 business input 재전송은 exact replay.
- 재지급/재차감/재추첨/charge 재소비 없음.
- 같은 key를 다른 input에 재사용하면 거부.
- battleId cross-result uniqueness 보강.
- save revision CAS + receipt insert를 D1 batch에 함께 처리.

### account profile idempotency

- profile-local revision 사용.
- `account_profile_mutation_receipts` 사용.
- 같은 requestId + 같은 loadout은 exact replay.
- requestId 재사용 input mismatch는 conflict.
- stale profile revision은 conflict.
- profile CAS + receipt insert를 batch에 함께 처리.
- profile 변경은 `account_saves` revision을 건드리지 않는다.

## 인증 / account client state

### Google provider / session

현재 Google 로그인은 실제 실행 경로가 있다.

- Google Identity Services button UI.
- `/api/auth/config`으로 public Google client id 조회.
- `/api/auth/google` credential exchange.
- server가 Google ID token RS256 signature/audience/expiry를 검증.
- Google JWKS cache.
- 검증된 stable `sub` identity만 account identity binding에 사용.
- origin allowlist 및 exact CORS 경계.
- `auth_sessions` D1 table.
- 256-bit random session token.
- DB에는 plaintext token 대신 SHA-256 `token_hash` 저장.
- expiry/revoke 검사.
- authenticated account ownership은 Bearer session의 `principal.userId`에서만 파생.

잔여 인증 제품화:

- 이메일 magic link/인증코드 발송·검증.
- session renewal/rotation/revoke-all-devices 정책.
- 계정 복구/전송/삭제 최종 UX.

### public authenticated routes

- `GET /api/account`.
- `POST /api/account/meta`.
- `POST /api/account/recruitment`.
- `POST /api/account/sweep`.
- `POST /api/account/logout`.
- `GET /api/account/profile`.
- `POST /api/account/profile`.
- `POST /api/account/battles/start`.
- `POST /api/account/battles/complete`.
- `POST /api/account/battles/claim`.

### client account state

`apps/client/src/account-network.ts`:

- `GUEST_LOCAL`.
- `AUTHENTICATED_ONLINE`.
- `AUTHENTICATED_OFFLINE_CACHE`.
- Bearer token은 현재 sessionStorage.
- server snapshot cache는 session fingerprint에 묶인 read-only cache.
- `401` 시 credential/cache 삭제 후 guest 복귀.
- authenticated mutation은 ONLINE에서만 가능.
- expectedRevision은 current remote revision에서 파생.
- revision conflict 시 최신 snapshot을 읽되 원 mutation을 자동 재실행하지 않음.
- offline mutation journal 없음.

`apps/client/src/account-profile-network.ts`:

- profile 전용 server read/mutation transport.
- profile read cache도 session fingerprint에 묶임.
- live memory의 current profile도 session fingerprint에 묶여 계정 전환 시 이전 계정 revision을 재사용하지 않음.
- ONLINE profile edit / OFFLINE_CACHE read-only.

## authenticated trusted solo battle

MAIN/SPECIAL 일반 전장은 client 자기신고 result 대신 trusted replay 경로를 사용한다.

- battle start에서 server snapshot과 target을 고정.
- client는 locally accepted deterministic command만 tick과 함께 기록.
- complete 요청은 battleId + command log를 전송.
- server가 canonical runtime을 재구성해 command를 replay하고 terminal winner/frame/hash/base HP를 계산.
- client가 forged winner/discovery/reward를 제출하는 surface 없음.
- server completion proof 저장.
- claim에서 stored proof로 account mutation을 실행.
- enemy discovery도 server replay에서 실제 simulation에 들어온 적만 merge.
- battle start/completion/claim replay/idempotency와 expiry/active-run 경계 존재.
- authenticated solo battle client와 `TrustedBattleResultScene`이 이 경로에 연결되어 있다.

잔여:

- record SPECIAL을 같은 authenticated proof 경계에 연결.
- 협동 authoritative room completion을 account mutation에 연결.

## 성장 / 모집 / 진화

- Base Lv cap: 시작 10, MAIN 장 완료마다 20/30/40/50.
- guest Growth에서 Gold 구매.
- Lv1→50 Gold 총비용 222,230.
- +Lv +50, +1당 HP/ATK +2% foundation.
- soul essence +1 비용: STORY80 / C16 / B32 / A80 / S280 / SS880.
- 모집 1회100 / 10회1000 summon crystal, 할인/최소 희귀 보장/천장/선택권 없음.
- duplicate policy: +1 우선 또는 분해 우선.
- F2/F3는 level/previous form/resource 조건.
- 이전 unlock form 재선택 가능.
- 재생산 최종 하한 60F.
- 43종 × 3 = **129 authored form** 실행.
- account server meta/recruitment API와 client transport 존재.

잔여:

- 기존 Growth/Recruitment/Deck/BaseWeapon Phaser 화면의 모든 account-state write 경로를 최종 일관 UX로 정리/QA.

## 전투 코어

- 30Hz deterministic simulation을 solo와 authoritative co-op이 공유.
- standing/attack range, foreswing/hit/backswing, 자연 KB/강제이동/DYING.
- Slow / Push / Weaken / one-time Revive.
- conditional close-range attack.
- `BOSS_HP_BELOW`, `ANY_OF`, wave dependency trigger.
- deterministic `attackPattern`.
- HP phase 기반 `attackPhases`.
- `hitDamages` / `hitEffects` multi-hit.
- 폭식룡 threshold advance.
- 대마도장 phase.
- 벨자르 3hit + 마지막 Push.
- 공허엔진 제로 3단계 phase.
- `main_01_009` kill-supply multiplier.
- evolution form timing/geometry/status data-driven override.
- simulation hash/signature에 future-relevant state/definition 포함.

잔여:

- 사람 플레이 수치/예고/보스 체감 조정.
- production art/motion contact frame과 판정 일치 QA.

## SPECIAL

### 상시 / 제한 / 이벤트

- 상시 도전/보스 23전장.
- 다섯 깃발 / 가벼운 주머니 제한전.
- 제한 client/server validation.
- 기간 이벤트 11전장 + availability/rerun window.
- 기간 밖 sortie/result/server battle/sweep 차단.
- event 전용 누적/profile reward는 일반 achievement catalog와 별도 후속.

### 주기 재화

- canonical 18전장, 전용 적/보스 24종.
- detailed first/charged/depleted reward.
- collection별 max charge 4.
- 12시간 +1, 닫힌 동안도 회복.
- 72h open / 168h cycle / stagger 0/42/84/126h.
- progression + previous SPECIAL tier gate.
- guest battle/sweep와 server account mutation이 동일 shared resolver 사용.

잔여:

- production art/motion.
- 경제/난이도 사람 플레이 후 TESTED/LOCKED 승격.

## 기록 SPECIAL

- `record_endless_front`: MAIN3 완료 후, 1× SOLO_ONLY, base 파괴까지 생존, 새 정수 minute 보상.
- `record_boss_rush`: MAIN4 완료 후, 1× SOLO_ONLY, 현재 9보스 순차, boss 사이 600F, 경제/cooldown/weapon 유지, 새 defeated boundary 보상.
- `record-hub → record-battle → record-result` Phaser flow.
- guest 저장 덱/level/+level/form/permanent reward/base weapon 사용.
- 12분 entity-bound regression.

잔여:

- authenticated trusted completion proof/client 연결.
- 장기전 사람 QA와 milestone 경제 조정.
- production art/motion/audio.

## 거점 병기

3종 deterministic runtime:

- 전선포격기: 피해 + 비구조 적 Push.
- 결계발진기: 생존 아군 snapshot 피해감소.
- 보급낙하기: 지연 후 maxSupply 비례 보급.

- 해금: 기본 / `main_02_010` / `main_03_010`.
- guest Save v15 durable selection.
- solo/record 실제 simulation에서 선택 병기 사용.
- account server 병기 선택 mutation도 unlock authority 사용.

### 협동 base weapon

- 팀 공유 1슬롯.
- 양쪽 동일 병기 합의 후 ready.
- ready 후 변경 불가.
- server가 양쪽 progression으로 unlock 재검증.
- shared cooldown/charge.
- same-frame 양쪽 fire는 deterministic 1회 승인.
- activator seat 기록.
- Supply Drop은 activator 개인 보급에만 귀속.
- client lobby/HUD authoritative shared weapon 표시.

## 협동

구현 foundation:

- MAIN/SPECIAL stage definition 공유.
- authoritative server room/runtime.
- 플레이어별 5-slot loadout / 개인 경제 / shared base.
- progression/evolution/permanent reward validation.
- stage-specific coop scaling.
- formation restriction.
- event/periodic availability.
- solo와 같은 combat grammar.
- shared base weapon negotiation/cooldown/seat ownership.
- disconnect AI no-op takeover + same-seat reconnect foundation.

잔여:

- 공개 매칭/reconnect/AI takeover release polish.
- 친구/초대/최근 플레이어/차단.
- 빠른 통신 최종 UX.
- 협동 seat을 authenticated session/account에 bind.
- 협동 completion을 authenticated account progression/wallet/charge mutation에 연결.

## 업적 / 프로필

현재 **guest + account profile authority foundation**까지 실행됐다.

### 카탈로그

초기 50 achievement:

- MAIN 8.
- SPECIAL 8.
- GROWTH 10.
- CODEX 4.
- COOP 4.
- PVP 6.
- RECORD 6.
- QUIRK 4.

- typed requirement + 공용 evaluator.
- TITLE / FRAME / BANNER / EMBLEM / BADGE catalog.
- 대표 캐릭터 1 / 칭호 0..1 / 프레임1 / 배너1 / 문장1 / badge0..3.
- hidden QUIRK는 미완료 시 `??? / 조건 비공개`.
- 미확정 Gold/모집재화/소탕권 보상은 임의 지급하지 않는다.

### account authority

- account save v2에서 진행형 achievement를 서버 재평가.
- 완료 achievement 자동 claim.
- cosmetic ownership은 server claim에서 재구성.
- `GET/POST /api/account/profile`.
- profile-local revision + idempotency receipt.
- public client는 claimed/cosmetic/fact/PvP tier를 자기신고할 수 없음.
- online account ProfileScene은 server authoritative editable.
- offline cache는 read-only.
- profile cache와 live memory 모두 session fingerprint binding.

### guest → account profile preference

계정 화면의 `게스트 프로필 가져오기`는 명시적 opt-in이다.

- guest의 현재 profile loadout 취향만 전송.
- server가 account 실제 ownership으로 재검증.
- guest claimed achievement / cosmetic ownership / fact / PvP tier는 전송하지 않음.
- guest progression/economy 자체를 이전하지 않음.

잔여:

- 전체 guest progression/economy/character ownership → 빈 account migration transaction.
- 이미 진행된 server account와 guest가 모두 있을 때 선택/충돌 UX.
- 친구/재접속 authoritative fact source.
- 실제 PvP match/tier source.
- QUIRK battle fact source.
- exact achievement resource reward 경제 검증 + server mutation.
- completion toast/card.
- cosmetic production art.
- 프로필 공유/친구/랭킹 surface.
- 모바일/PC 사람 QA.

## 도감 / UI / 아트 / 오디오

구현:

- 미발견 적 silhouette + ???.
- 미획득 아군 silhouette + ???.
- 미획득 아군 편성 미표시.
- 실제 조우 적 discovery 저장; authenticated MAIN/SPECIAL은 trusted replay discovery 사용.
- stage/deck/growth/recruitment/codex/base-weapon/record/profile/account 기본 UI.
- 협동 shared weapon 선택/표시 UI.
- 일부 compact mobile 대응.

production 잔여:

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

## PvP / 소셜 / 계정 제품화 잔여

- 이메일 auth.
- session renewal/rotation/revoke-all.
- 전체 guest save → account migration/conflict UX.
- account transfer/delete/reset/recovery UX.
- 친구/초대/최근 플레이어/차단.
- 협동 authenticated seat/result binding.
- record authenticated trusted proof.
- 1v1 일반/랭킹/친선.
- 2v2 일반/친선.
- Lv50/+0/permanent bonus 0 PvP standardization.
- MMR/Elo/티어/시즌/순위표/보상.
- PvP achievement tier/fact source.

Google 로그인/session/trusted MAIN/SPECIAL battle/profile API가 존재한다는 이유만으로 위 product closure까지 완료라고 하지 않는다.

## 최근 자동검증 기준점

- 전투 grammar / base weapon runtime: `8fbd6389a52951007254bdd175cbc2c8b11ac835`, CI #671 green.
- record SPECIAL 플레이 flow: `a5afb5305e104602928ce20e1033a202dd74db91`.
- 12분 record entity regression: `10f5d556a10684be4bc6dfd2cc3b637c7a64e277`, CI #689 green.
- coop shared base weapon / supply-drop seat ownership: `8ab44ae47c6a82d23fa114d4221133eae8fa8dcc`, CI #705 green.
- account save v2 strict storage: `194b785a6fb9e4dcb08b05007597c8282abf4b54`, CI #710 green.
- MAIN/record/recruitment mutation/idempotency: `cf91e4e3963347b73a57749b9b79d1cbfcb4c8a1`, CI #730 green.
- SPECIAL/sweep account authority: `456bc39e9d4b4bda687f583923277f396d622970`, CI #738 green.
- account meta progression mutation: `2232d4b92a16b49f9bb78efcaf1051d9560902d2`, CI #746 green.
- verified identity/session foundation: `5972fe8bcfeac8c0c9ac9ee48fbb9222f95fe428`, CI #755 green.
- client account 3-state foundation: `71653a5df696a38010cb2235fbe24b087c7c2730`, CI #757 green.
- Google ID token verification + login UI: `5a45fc2d2960a3ccad19ccfc933dcadb5ced8d9e`.
- authenticated trusted solo battle wiring: `dfb52e2bc04fa41ee3a66a33e04f633e0ac27c46` and follow-up tests through `75f368ee6090a81d794577e2a2e32f895c746a78`.
- 43종/129 authored form closure: `ab0b152755a216526b76b8e496615cfb80829c18`, CI #799 green.
- achievement/profile 50개 guest runtime: `30374313e1372a0da5a8370f08648775079dc140`, CI #801 green.
- account authoritative achievement/profile storage/API/edit/import boundary + session-bound profile memory: code baseline `b6a3c7a640269cc59fe83e9e60dbca332ac78bff`, **CI #813 전체 green(typecheck/schema/sim/server/client/build)**.

## 다음 개발 우선순위

1. **전체 guest → account migration/conflict closure**: 빈 account 이전 transaction, 이미 진행된 server account와의 명시적 선택 UX, rollback/idempotency 검증.
2. **친구/협동 release closure**: 친구/초대/최근 플레이어/차단, authenticated seat/result, reconnect/AI takeover/빠른통신 polish와 achievement fact 연결.
3. **record account trusted proof**: 기록전 authenticated start/replay/claim 경계와 account record mutation 연결.
4. **PvP foundation**: standardization, 1v1/2v2, MMR/season, PvP achievement tier/event source.
5. **기록/SPECIAL/achievement 경제·사람 QA**: 장기전 난이도와 reward 공급량 TESTED/LOCKED 후보화.
6. **production UX/art**: achievement toast/card, cosmetic art, 공유/친구/랭킹 profile surface, 전체 art/motion/audio/accessibility/release QA.

## 검증 원칙

- 파일 존재만으로 완료 처리하지 않는다.
- DESIGN_TARGET과 다르면 실행된다는 이유만으로 코드를 새 정본으로 취급하지 않는다.
- DESIGN_TARGET→TESTED/LOCKED 승격은 deterministic regression + 사람 플레이테스트를 요구한다.
- client/save/server가 모두 필요한 기능은 전체 경로가 연결돼야 구현 완료로 센다.
- 공개 account reward route는 authenticated session + server-derived proof 경계를 요구한다.
- profile/public client가 claim/fact/tier/cosmetic ownership을 자기신고할 수 있게 만들지 않는다.
- guest와 populated account를 자동 병합하지 않는다.
- revision conflict에서 재화/profile mutation을 자동 재실행하지 않는다.
- 대형 배치 중 불필요하게 CI를 반복하지 않고 마지막 통합 검증에서 회귀를 모아 수정한다.
