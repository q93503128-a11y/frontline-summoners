# 계정 Save v2 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_ACCOUNT_AUTHORITY_FOUNDATION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`

관련 이행 기록:
- `docs/content-wiki/systems/ACCOUNT_MUTATION_IDEMPOTENCY_IMPLEMENTATION_2026-08-30.md`
- `docs/content-wiki/systems/ACCOUNT_AUTH_SESSION_IMPLEMENTATION_2026-08-30.md`
- `docs/content-wiki/systems/GUEST_ACCOUNT_MIGRATION_IMPLEMENTATION_2026-08-31.md`
- `docs/content-wiki/systems/RECORD_TRUSTED_PROOF_IMPLEMENTATION_2026-08-31.md`

이 문서는 현재 account save v2의 저장/검증/인증/authoritative mutation 경계를 기록한다. account lifecycle, PvP, production QA까지 완료됐다는 뜻은 아니다.

## 1. canonical account save snapshot v2

`apps/server/src/account-save-authority.ts`

하나의 revisioned server snapshot에 다음을 보관한다.

- MAIN NORMAL_CLEAR 연속 진행과 source.
- MAIN first-clear reward receipt high-water.
- SPECIAL clear.
- permanent reward.
- enemy discovery.
- recruitment character ownership.
- Base Lv / +Lv / unlocked form / selected form.
- deck.
- selected base weapon.
- monotonic resource ledger.
- periodic SPECIAL charge 4종.
- Record best/reward high-water.

server save schema는 `2`다.

## 2. strict server validation

로그인 계정 snapshot은 guest local save처럼 손상값을 조용히 보정하지 않는다.

- unknown resource ID 거부.
- `earned`, `spent` 음수/소수 거부.
- `spent > earned` 거부.
- canonical periodic collection 4종 전체 필요.
- charge 0..4.
- cap 4에서 `nextChargeAtMs = null`.
- cap 미만에서 유효한 다음 충전 시각 필요.
- charge refresh는 server time 기준.
- Record best/reward high-water 관계 검증.
- Boss Rush runtime cap 9 검증.
- selected base weapon을 MAIN 진행으로 재검증.
- future schema write-protect.

## 3. v1 → v2 migration

기존 `account_progression_saves` v1의 진행/소유/성장/덱을 보존한다.

v1에 없던 필드 기본값:
- wallet: 빈 ledger.
- periodic charge: 4칸 full.
- Record: 0.
- selected base weapon: 전선포격기.

v1에는 MAIN first-clear wallet receipt가 없으므로 기존 cleared MAIN을 migrated `mainRewardedStageIds`에도 넣어 소급 중복 지급을 막는다.
원본 v1 row는 migration 실패 시 덮어쓰지 않는다.

## 4. revisioned D1 storage

migration:
- `apps/server/migrations/0003_account_save_v2.sql`

canonical table:
- `account_saves`.
- account당 1 row.
- `schema_version = 2`.
- monotonic `revision`.
- `snapshot_json`.
- `updated_at`.

서버 함수:
- `loadAccountSave`.
- `initializeAccountSave`.
- `replaceAccountSave`.

`replaceAccountSave`는 `expectedRevision` mismatch에서 `revision_conflict`를 반환한다.
재화/성장 mutation은 conflict를 자동 재실행하지 않는다.

## 5. authoritative mutation / idempotency

현재 account save v2 위에서 server가 authoritative하게 처리한다.

- MAIN battle result.
- 일반/주기/이벤트/permanent SPECIAL result.
- Record result.
- recruitment server RNG + wallet + ownership/duplicate.
- MAIN/SPECIAL sweep.
- Base Lv.
- +Lv.
- evolution unlock/form select.
- deck set.
- base weapon select.

`battleId` / `requestId` receipt를 사용한다.
동일 key + 동일 business input 재전송은 exact replay다.
save CAS와 receipt는 D1 batch에서 함께 확정되며 race에서 재지급/재차감/재추첨을 허용하지 않는다.

## 6. Record authority

Record reward resolver와 mode/wave/boss sequence는 `@frontline/sim` 공용 구현을 사용한다.

끝없는 전선:
- `endlessBestTimeMs`.
- `endlessBestReachedMinute`.
- `endlessRewardedMinute`.

보스 러시:
- `bossRushBestDefeated`.
- `bossRushRewardedDefeated`.

authenticated account Record는 public score mutation을 받지 않는다.

- start에서 account snapshot/revision과 initial state hash를 고정.
- client는 accepted deterministic command log만 제출.
- server가 동일 Record runtime을 재생.
- Endless survival frame과 Boss Rush defeated count를 server가 계산.
- Record 패배도 정상적인 high-water 저장 대상으로 처리.
- 실제 encounter enemy discovery와 milestone reward를 Record mutation의 같은 revision에 합침.
- 동일 battleId replay에서 중복 milestone reward/discovery 없음.

상세는 `RECORD_TRUSTED_PROOF_IMPLEMENTATION_2026-08-31.md`를 따른다.

## 7. SPECIAL progression / reward / sweep authority

account authority 범위:
- MAIN80.
- SPECIAL61.
- stage policy 141.
- 전체 실행 enemy discovery catalog.
- 전체 v2 permanent reward/evolution catalog.

SPECIAL은 authored collection/unlock data와 server time availability를 사용한다.

- collection `unlockAfterStageId`.
- `requiredProgressionStageId`.
- `previousSpecialStageId`.
- event availability.
- periodic availability.
- sweep policy.

주기 SPECIAL:
- first / charged / depleted reward.
- first clear는 charge 미소모.
- charged repeat는 1칸 소비.
- charge 0은 depleted reward.

소탕:
- prior NORMAL_CLEAR.
- server sweep policy.
- ticket 1장.
- repeat reward only.
- periodic charge 필요 시 1칸 소비.
- first clear/progression/permanent reward/Record 생성 금지.

## 8. meta progression authority

`apps/server/src/account-meta-mutation-authority.ts`

Base Lv:
- 시작 cap 10.
- 장 완료마다 20 / 30 / 40 / 50.
- canonical Gold curve server 차감.

+Lv:
- +50 cap.
- STORY/C/B/A/S/SS authored acquisition/rarity별 soul essence 비용.
- client가 rarity/cost를 제출하지 않음.

진화:
- character/form 관계 검증.
- previous form.
- required Base Lv.
- canonical recipe cost.
- unlocked form만 선택.

덱:
- 1..10.
- unique.
- owned-only.
- exact order.

거점 병기:
- canonical 3종.
- MAIN 진행 기반 server unlock.

## 9. verified auth/session + client account state

현재 구현:
- Google Identity Services login.
- Google ID token RS256/audience/expiry 검증.
- stable Google `sub` binding.
- server `auth_sessions`.
- random bearer session token, DB에는 SHA-256 hash 저장.
- exact origin/CORS 경계.

client state:
- `GUEST_LOCAL`.
- `AUTHENTICATED_ONLINE`.
- `AUTHENTICATED_OFFLINE_CACHE`.

online account에서만 mutation을 허용한다.
offline cache에는 mutation queue/journal이 없으며 read-only다.

## 10. reversible guest → account migration

현재 실제 client/server 경로가 있다.

- login만으로 guest를 server에 자동 덮어쓰지 않음.
- pristine account import와 populated account conflict를 구분.
- populated replacement는 destructive confirmation 필요.
- source hash / expected revision 검증.
- account save + profile + archive 원자 처리.
- migration replay idempotency.
- 직후 다른 mutation이 없을 때 explicit rollback 가능.

상세는 `GUEST_ACCOUNT_MIGRATION_IMPLEMENTATION_2026-08-31.md`를 따른다.

## 11. trusted battle proof

authenticated solo MAIN/SPECIAL/Record는 client 자기신고 terminal result를 account reward authority로 쓰지 않는다.

- start proof.
- accepted tick command log.
- canonical server replay.
- stored completion proof.
- claim.
- idempotent battle receipt.
- actual encounter discovery.

MAIN/SPECIAL은 terminal victory가 clear/reward 조건이다.
Record는 defeat까지 포함한 server-derived score가 high-water 조건이다.

## 12. 자동검증

관련 테스트 예:
- `apps/server/test/account-save-authority.test.ts`.
- `apps/server/test/account-mutation-authority.test.ts`.
- `apps/server/test/account-special-mutation-authority.test.ts`.
- `apps/server/test/account-meta-mutation-authority.test.ts`.
- `apps/server/test/trusted-battle-authority.test.ts`.
- `apps/server/test/trusted-record-battle.test.ts`.
- `apps/client/test/account-network.test.ts`.
- `apps/client/test/record-account-proof.test.ts`.
- `packages/sim/test/special-rewards.test.ts`.
- `packages/sim/test/record-playable.test.ts`.

Record trusted proof 코드 기준점:
- `3f26839d238d276a7e861db0a5fd046c604fecf0`.
- Actions `33355073898`.
- typecheck / schema / sim / server / client / build 전체 green.

## 아직 완료하지 않은 것

account/save authority 자체가 더 이상 초기 storage-only 단계는 아니지만 다음은 남아 있다.

- email magic-link/인증코드.
- session renewal/rotation/revoke-all-devices 최종 정책.
- account transfer/delete/reset/recovery 제품 UX.
- migration archive 장기 retention/cleanup 정책.
- 여러 기기 migration/account lifecycle 사람 QA.
- 공개 PvE co-op matchmaking queue 및 reconnect/network release hardening.
- PvP runtime/matchmaking/MMR/season/tier/account reward.
- PvP/QUIRK 등 아직 실제 authoritative fact source가 없는 achievement 일부.
- Record/SPECIAL/achievement exact 경제와 장기전 사람 QA.
- production art/motion/audio/accessibility/viewport/release QA.

따라서 현재 단계는 **account save v2 + verified session + reversible migration + authoritative mutation + MAIN/SPECIAL/Record trusted proof가 연결된 account authority foundation 완료**로 센다. 전체 온라인 제품/게임 release complete로 세지는 않는다.
