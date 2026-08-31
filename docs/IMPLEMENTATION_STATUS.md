# Frontline Summoners 구현 상태

기준: 2026-08-31  
최상위 기획 정본: `docs/CANONICAL.md`

주요 이행 기록:

- 세부 정합 감사: `docs/content-wiki/systems/IMPLEMENTATION_WIKI_AUDIT_2026-08-30.md`
- 주기 SPECIAL: `docs/content-wiki/systems/PERIODIC_RESOURCE_SPECIAL_IMPLEMENTATION_2026-08-30.md`
- 전투 grammar / 거점 병기: `docs/content-wiki/systems/COMBAT_GRAMMAR_BASE_WEAPON_IMPLEMENTATION_2026-08-30.md`
- account save v2: `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`
- account mutation/idempotency: `docs/content-wiki/systems/ACCOUNT_MUTATION_IDEMPOTENCY_IMPLEMENTATION_2026-08-30.md`
- account auth/session: `docs/content-wiki/systems/ACCOUNT_AUTH_SESSION_IMPLEMENTATION_2026-08-30.md`
- guest → account migration: `docs/content-wiki/systems/GUEST_ACCOUNT_MIGRATION_IMPLEMENTATION_2026-08-31.md`
- achievement/profile: `docs/content-wiki/systems/ACHIEVEMENT_PROFILE_IMPLEMENTATION_2026-08-31.md`
- social/friend co-op: `docs/content-wiki/systems/SOCIAL_FRIEND_COOP_IMPLEMENTATION_2026-08-31.md`
- Record trusted proof: `docs/content-wiki/systems/RECORD_TRUSTED_PROOF_IMPLEMENTATION_2026-08-31.md`
- sweep: `docs/content-wiki/systems/SWEEP_SAVE_V14_IMPLEMENTATION_2026-08-30.md`

이 문서는 현재 실행 코드/콘텐츠의 구현 사실과 남은 큰 공백을 기록한다. 기획 정본을 대체하지 않는다. 과거 이행 문서의 Save v14 같은 표기는 해당 구현 시점 기록이며 현재 실행 guest progress schema는 **v15**다.

---

## 1. 현재 실행 콘텐츠

- MAIN: 4장 × 20 = **80 전장**.
- 일반 SPECIAL: **61 전장**.
  - 기존 특수전 5.
  - 제한 SPECIAL 4.
  - 주기 재화 SPECIAL 18.
  - 상시 도전/보스 SPECIAL 23.
  - 기간 이벤트 11.
- 표준 stage: **141**.
- 기록 SPECIAL: 일반 stage와 분리된 플레이 가능 모드 **2종**.
  - 끝없는 전선.
  - 보스 러시.
- 플레이어 캐릭터: **43종**.
- 진화 form: **129 authored form**.
- 실행 적/보스: **80종**.
- stage collection: **19**.
- 초기 achievement runtime catalog: **50개**.
- profile cosmetic runtime: TITLE / FRAME / BANNER / EMBLEM / BADGE.

실행 데이터가 존재한다는 사실과 사람이 충분히 플레이해 TESTED/LOCKED됐다는 것은 구분한다.

---

## 2. guest 저장 / 메타경제

### guest progress v15

현재 저장:

- MAIN/SPECIAL clear.
- NORMAL_CLEAR provenance.
- MAIN first-clear receipt high-water.
- permanent reward.
- enemy discovery.
- recruitment ownership/history.
- Base Lv/+Lv/form/deck.
- selected base weapon.
- resource ledger.
- periodic charge.
- Record best/reward high-water.

resource ledger:
- `gold`
- `evo_fragment`
- `evo_core`
- `evo_crown`
- `soul_essence`
- `summon_crystal`
- `sweep_ticket`

`earned/spent` monotonic ledger로 stale merge가 이미 소비한 재화를 되살리지 못하게 한다.
v2~v15 migration 경로를 유지하며 과거 MAIN reward, periodic charge, selected weapon, record high-water를 현재 schema로 보정한다.

### guest profile meta

combat/economy save와 별도 local profile meta를 유지한다.

- claimed achievement.
- cosmetic ownership.
- profile loadout.
- future fact.
- optional PvP tier placeholder.

완료 guest achievement는 자동 claim하며 badge 최대 3, 미보유 장식 장착을 금지한다.

---

## 3. server account save v2 / profile v1

### account save v2

`account_saves` D1 table에 account당 revisioned canonical snapshot 1개를 둔다.

포함:
- MAIN/SPECIAL progression.
- NORMAL_CLEAR provenance.
- first-clear receipt.
- permanent reward.
- enemy discovery.
- recruitment ownership.
- character growth/form/deck.
- selected base weapon.
- resource ledger.
- periodic charge 4종.
- Record best/reward high-water.

strict validation:
- unknown currency 거부.
- `spent > earned` 거부.
- malformed periodic charge 거부.
- impossible record high-water 거부.
- Boss Rush 9 초과 거부.
- progression상 잠긴 base weapon 거부.
- future schema write-protect.

`expectedRevision` CAS conflict를 자동 재실행하지 않는다.

### account profile v1

`account_profiles`는 combat/economy save revision과 독립된 profile revision을 쓴다.

- achievement evaluation/claim은 server account save에서 재평가.
- cosmetic ownership은 기본 장식 + server claimed achievement reward에서 재구성.
- arbitrary known cosmetic id 저장을 신뢰하지 않음.
- public mutation은 `profileLoadout`만 허용.
- fact/PvP tier는 server-internal hook만 허용.
- profile-local idempotency receipt 사용.

---

## 4. guest → account migration

**구현됨: `IMPLEMENTED_REVERSIBLE_ACCOUNT_MIGRATION`.**

- login만으로 guest save 자동 overwrite 금지.
- guest v15 → strict account save v2 mapping.
- preview에서 guest/server 진행 비교.
- pristine account만 `IMPORT_IF_EMPTY` 허용.
- populated account는 자동 merge하지 않음.
- populated account 교체는 2단 destructive confirmation.
- source hash + current revision 검증.
- account save + profile + migration archive를 D1 batch로 원자 처리.
- 동일 migration id/input idempotent replay.
- migration 직전 account/profile snapshot archive.
- 직후 다른 mutation이 없을 때 explicit rollback 가능.
- rollback도 revision을 과거 숫자로 되돌리지 않고 새 revision으로 증가.
- guest claimed cosmetic/fact/PvP tier를 server authority로 가져오지 않음.

잔여:
- guest `totalPulls` 통계 보존 surface.
- 장기 migration archive retention/cleanup 정책.
- 여러 기기 prompt/marker 사람 QA.
- migration 이후 guest local save 보관/삭제 최종 UX.

---

## 5. 공용 경제 / authoritative mutation

client/server가 `@frontline/sim`에서 공유:

- MAIN80 reward.
- Record milestone reward.
- recruitment/Base Lv/+Lv economy.
- 일반/이벤트/상시 SPECIAL reward.
- periodic SPECIAL first/charged/depleted reward와 charge resolver.
- Record mode ID/unlock/wave/Boss Rush sequence.

account mutation:

- MAIN result.
- SPECIAL result.
- Record result.
- recruitment 1/10.
- MAIN/SPECIAL sweep.
- Base Lv.
- +Lv.
- evolution unlock/form select.
- deck set.
- base weapon select.

`account_mutation_receipts`와 revision CAS를 D1 batch에 묶어 동일 business input replay에서 재지급/재차감/재추첨/charge 재소비를 막는다.
Record result는 trusted replay에서 얻은 기록 high-water, milestone reward, 실제 적 발견을 같은 account revision에 합친다.

정확한 일부 Record/SPECIAL/achievement resource 수량은 사람 경제 검증 전 DESIGN_TARGET이다.

---

## 6. 인증 / account client state

### 구현

Google 로그인 실제 실행 경로:

- Google Identity Services button.
- `/api/auth/config`.
- `/api/auth/google`.
- RS256 signature/audience/expiry 검증.
- Google JWKS cache.
- stable `sub` identity binding.
- exact origin allowlist/CORS.
- `auth_sessions` D1.
- 256-bit random token.
- DB에는 SHA-256 token hash만 저장.
- expiry/revoke 검사.

client account state:

- `GUEST_LOCAL`.
- `AUTHENTICATED_ONLINE`.
- `AUTHENTICATED_OFFLINE_CACHE`.
- Bearer token은 sessionStorage.
- remote save/profile cache는 session fingerprint에 묶임.
- offline account cache는 read-only.
- `401`이면 credential/cache 삭제 후 guest 복귀.
- online mutation만 허용.
- revision conflict에서 원 mutation 자동 재실행 금지.
- offline mutation journal 없음.

잔여 account 제품화:
- email magic link/인증코드.
- session renewal/rotation/revoke-all-devices 최종 정책.
- account transfer/delete/reset/recovery UX.

---

## 7. authenticated trusted solo / Record battle

MAIN/SPECIAL/Record의 authenticated solo 결과는 client 자기신고 결과 대신 trusted replay 경로를 사용한다.

공통:
- start에서 server snapshot + target + revision 고정.
- client는 locally accepted deterministic command만 tick과 함께 기록.
- complete는 `battleId + command log`만 전송.
- client forged winner/discovery/reward/score 입력 surface 없음.
- server canonical runtime replay.
- completion proof 저장.
- claim에서 stored proof로 account mutation 실행.
- 실제 simulation encounter enemy만 discovery merge.
- start/complete/claim replay/idempotency/expiry/active-run 경계.

MAIN/SPECIAL:
- server가 terminal winner/frame/hash/base HP를 계산.
- 승리 proof만 clear/reward mutation.
- 패배는 실제 발견 enemy만 저장.

Record:
- shared `@frontline/sim/record-content`의 동일 wave/boss 정본 사용.
- start ticket `initialStateHash`와 local Record runtime hash 불일치 시 진행 거부.
- Endless는 server가 player base 파괴 frame을 authoritative survival score로 계산.
- Boss Rush는 server가 실제 boss death transition으로 defeated count/전체 완료를 계산.
- Record는 패배해도 그 시점까지의 high-water를 저장.
- Record high-water + milestone reward + encounter discovery를 동일 mutation/revision에 저장.
- offline account cache는 Record 조회만 가능하고 새 기록 도전은 차단.
- trusted 결과 처리 실패 시 guest save로 fallback하지 않고 동일 proof 재전송 UX 제공.

현재 trusted replay에는 server CPU/abuse guard로 최대 30분 frame 제한이 있다. 이것은 디자인상 Record 상한으로 LOCKED된 값이 아니며 장기전 부하 QA 대상이다.

---

## 8. 전투 코어 / 성장 / 모집

### 전투

- 30Hz deterministic simulation.
- standing/attack range.
- foreswing/hit/backswing.
- natural KB/forced displacement/DYING.
- Slow/Push/Weaken/Revive.
- conditional close-range attack.
- wave dependency / HP trigger.
- deterministic attack pattern/phase/multi-hit.
- late MAIN/SPECIAL boss mechanics.
- data-driven evolution timing/geometry/status override.
- future-relevant state/definition을 state hash에 포함.

### 성장/모집

- Base Lv cap 10→20→30→40→50.
- Lv1→50 Gold 총 222,230.
- +Lv +50, +1당 HP/ATK +2% foundation.
- rarity/acquisition별 soul essence cost.
- recruitment 1회100 / 10회1000 crystal.
- 할인/최소 희귀 보장/천장/선택권 없음.
- duplicate +1 또는 분해 policy.
- F2/F3 level/previous form/resource 조건.
- 이전 form 재선택.
- 재생산 최종 하한 60F.
- 43종 × 3 = 129 authored form.

잔여:
- 전투/경제 사람 플레이 수치 조정.
- Growth/Recruitment/Deck/BaseWeapon 화면의 account-state UX 최종 QA.
- production contact frame과 판정 일치 QA.

---

## 9. SPECIAL / Record

### 일반 SPECIAL61

구현:
- 제한전.
- 주기 재화 18.
- 상시 도전/보스 23.
- 기간 이벤트 11.
- client/server restriction/availability/progression gate.
- periodic collection별 max charge4.
- 12시간 +1.
- 닫힌 동안도 charge 회복.
- 72h open / 168h cycle stagger.
- first/charged/depleted reward semantics.
- guest battle/sweep와 account mutation이 shared resolver 사용.

잔여:
- production art/motion.
- 사람 경제/난이도 QA 후 TESTED/LOCKED 승격.
- event 전용 누적/profile reward 후속.

### Record SPECIAL

구현:
- Endless: MAIN3 완료 후, 1× SOLO_ONLY, base 파괴까지 생존, 새 정수 minute high-water reward.
- Boss Rush: MAIN4 완료 후, 1× SOLO_ONLY, 9보스 순차, boss 사이 600F, 경제/cooldown/weapon 유지.
- `record-hub → record-battle → record-result`.
- guest는 guest 덱/성장/permanent reward/base weapon과 local durable high-water 사용.
- authenticated account는 server snapshot 덱/성장/permanent reward/base weapon과 trusted start/replay/claim 사용.
- account score/보상/도감은 server replay 결과만 저장.
- 12분 entity-bound regression.

잔여:
- 장기전 사람 QA / milestone 경제 조정.
- 30분 이상 Record 정책/서버 부하 검증.
- production art/motion/audio.

---

## 10. 거점 병기

3종 deterministic runtime:

- 전선포격기: 피해 + 비구조 적 Push.
- 결계발진기: 현재 생존 아군 snapshot 피해감소.
- 보급낙하기: 지연 후 maxSupply 비례 보급.

해금:
- 전선포격기 기본.
- 결계발진기 `main_02_010`.
- 보급낙하기 `main_03_010`.

solo/record/account에서 선택 weapon authority가 실제 simulation/mutation에 연결됐다.

co-op:
- 팀 공유 1슬롯.
- 양쪽 같은 unlocked weapon 합의 후 ready.
- server가 양쪽 progression으로 재검증.
- shared cooldown.
- same-frame double fire deterministic 1회 승인.
- activator seat 기록.
- Supply Drop은 activator 개인 supply에만 지급.

---

## 11. 협동 / 친구 / 소셜

### authoritative co-op foundation

- MAIN/SPECIAL stage definition 공유.
- server-authoritative Durable Object room/runtime.
- 플레이어별 5-slot / 개인 economy / shared base.
- progression/evolution/permanent reward validation.
- stage-specific coop scaling.
- restriction/event/periodic gate.
- solo와 같은 combat grammar.
- shared base weapon.
- disconnect AI no-op takeover + same-seat reconnect foundation.

### authenticated friend/social closure

구현:
- friend code + display name.
- presence TTL/online 표시.
- incoming/outgoing friend request.
- friend accept/remove.
- block/unblock.
- recent co-op players.
- friend direct co-op invite/accept/decline.
- social invite DB에 join token 비저장.
- Durable Object 내부 seat token 보관.
- friend A/B seat account binding.
- READY 시 account save의 deck/growth/form/permanent reward/base weapon 재구성.
- guest code co-op과 account friend-coop 저장 경계 분리.
- canonical quick communication 8종.
- 900ms cooldown + 8초 최대4회 burst.
- block relation이면 상대 quick message 차단.
- actual AI handoff 뒤 reconnect seat 기록.
- victory에서 각 account에 canonical MAIN/SPECIAL clear/reward/progression 저장.
- victory/loss 모두 actual authoritative snapshot encounter enemy discovery 저장.
- recent-player relation 저장.
- `coop_friend_first` / `coop_reconnected_win` server achievement fact.

잔여 online/co-op 제품화:
- **공개 PvE 협동 matchmaking queue**.
- reconnect grace/AI takeover 모바일·네트워크 soak와 최종 UX.
- quick-message sound on/off option.
- 친구 profile icon/frame 및 invite-availability presentation polish.

---

## 12. 업적 / 프로필

초기 achievement 50:
- MAIN 8.
- SPECIAL 8.
- GROWTH 10.
- CODEX 4.
- COOP 4.
- PVP 6.
- RECORD 6.
- QUIRK 4.

구현:
- typed requirement + shared evaluator.
- hidden QUIRK 미완료 mask.
- account save 기반 server evaluation/auto-claim.
- cosmetic ownership server claim 재구성.
- profile-local revision/idempotency.
- online editable / offline cache read-only.
- guest profile loadout preference explicit import.
- friend first co-op fact source.
- reconnect-after-handoff win fact source.

잔여:
- actual PvP match/tier source.
- QUIRK battle fact source.
- `codex_main_core_complete`에 추가 authoritative fact가 필요하다면 해당 정의와 함께 연결.
- exact achievement resource reward 경제 검증 + server mutation.
- completion toast/card.
- cosmetic production art.
- public/shared profile 및 ranking surface.
- 모바일/PC 사람 QA.

---

## 13. 도감 / UI / production art/audio

구현:
- 미발견 enemy silhouette + ???.
- 미획득 ally silhouette + ???.
- 미획득 ally 편성 미표시.
- guest actual encounter discovery.
- authenticated MAIN/SPECIAL trusted replay discovery.
- authenticated Record trusted replay discovery.
- authenticated friend co-op actual authoritative encounter discovery.
- stage/deck/growth/recruitment/codex/base-weapon/record/profile/account/social/co-op 기본 UI.
- 일부 compact mobile/safe-area 대응.

production 잔여:
- character/enemy/boss 고유 production art.
- F1/F2/F3 portrait.
- character-specific contact-frame attack animation.
- rarity/series recruitment reveal.
- base weapon production VFX/SFX.
- BGM/SFX audio bus.
- accessibility/low-end options.
- full filter/search/favorite.
- viewport/safe-area/zoom 전수 QA.

현재 temporary/generic art fallback은 최종 art 완료로 세지 않는다.

---

## 14. PvP 잔여

PvP는 아직 foundation 이전 단계다.

남음:
- 1v1 일반.
- 1v1 랭킹.
- 1v1 친선.
- 2v2 일반.
- 2v2 친선.
- Lv50/+0/permanent bonus0 standardization.
- matchmaking.
- MMR/rating.
- tier/season/leaderboard.
- PvP reward.
- PvP achievement tier/fact source.

2v2 랭킹은 동접/큐 분산 자료 전 기본 보류라는 DESIGN_TARGET을 유지한다.

---

## 15. 최근 자동검증 기준점

- combat grammar / base weapon: `8fbd6389a52951007254bdd175cbc2c8b11ac835`, CI #671 green.
- record playable flow: `a5afb5305e104602928ce20e1033a202dd74db91`.
- 12분 Record entity regression: `10f5d556a10684be4bc6dfd2cc3b637c7a64e277`, CI #689 green.
- co-op shared base weapon / Supply Drop seat ownership: `8ab44ae47c6a82d23fa114d4221133eae8fa8dcc`, CI #705 green.
- account save v2 strict storage: `194b785a6fb9e4dcb08b05007597c8282abf4b54`, CI #710 green.
- MAIN/record/recruitment mutation/idempotency: `cf91e4e3963347b73a57749b9b79d1cbfcb4c8a1`, CI #730 green.
- SPECIAL/sweep authority: `456bc39e9d4b4bda687f583923277f396d622970`, CI #738 green.
- account meta progression: `2232d4b92a16b49f9bb78efcaf1051d9560902d2`, CI #746 green.
- verified identity/session foundation: `5972fe8bcfeac8c0c9ac9ee48fbb9222f95fe428`, CI #755 green.
- client account 3-state foundation: `71653a5df696a38010cb2235fbe24b087c7c2730`, CI #757 green.
- trusted solo battle wiring: `dfb52e2bc04fa41ee3a66a33e04f633e0ac27c46`, follow-up through `75f368ee6090a81d794577e2a2e32f895c746a78`.
- 43 characters / 129 authored forms: `ab0b152755a216526b76b8e496615cfb80829c18`, CI #799 green.
- account achievement/profile authority: `b6a3c7a640269cc59fe83e9e60dbca332ac78bff`, CI #813 full green.
- authenticated social/friend co-op closure: `a9d743d514fcdb69bcd68bfa862dad6641aad1ed`, Actions `33351096636` full green.
- authenticated Record trusted proof: code/test baseline `3f26839d238d276a7e861db0a5fd046c604fecf0`, Actions `33355073898` **typecheck/schema/sim/server/client/build 전체 green**.

---

## 16. 다음 개발 우선순위

1. **공개 협동 matchmaking + co-op release hardening**: public queue, reconnect grace/AI takeover network soak, quick-communication/audio/profile polish.
2. **PvP foundation**: standardization, 1v1/2v2 runtime/matchmaking, rating/season, PvP achievement source.
3. **account lifecycle 제품화**: email auth, renewal/rotation/revoke-all, transfer/delete/reset/recovery.
4. **Record/SPECIAL/achievement 경제·사람 QA**: 장기전 난이도, 30분 guard 정책, reward 공급량 TESTED/LOCKED 후보화.
5. **production UX/art/audio/accessibility**: achievement toast/card, cosmetic/profile presentation, 전체 production art/motion/audio/viewport/release QA.

---

## 17. 검증 원칙

- 파일 존재만으로 완료 처리하지 않는다.
- DESIGN_TARGET과 실행 코드를 혼동하지 않는다.
- DESIGN_TARGET→TESTED/LOCKED 승격은 deterministic regression + 사람 플레이테스트를 요구한다.
- client/save/server가 모두 필요한 기능은 전체 경로가 연결돼야 구현 완료로 센다.
- 공개 account reward route는 authenticated session + server-derived proof 경계를 요구한다.
- profile/public client가 claim/fact/tier/cosmetic ownership을 자기신고할 수 있게 만들지 않는다.
- guest와 populated account를 자동 merge하지 않는다.
- revision conflict에서 재화/profile mutation을 자동 재실행하지 않는다.
- social DB에 co-op seat join token을 보관하지 않는다.
- co-op account reward/discovery는 server room의 authoritative terminal/snapshot 상태에서만 파생한다.
- authenticated Record score/reward/discovery는 server replay completion에서만 파생한다.
- 대형 배치 중 불필요하게 CI를 반복하지 않고 마지막 통합 검증에서 회귀를 모아 수정한다.
