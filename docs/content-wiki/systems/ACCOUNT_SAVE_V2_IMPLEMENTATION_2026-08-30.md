# 계정 Save v2 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_SERVER_STORAGE_AND_MUTATION_FOUNDATION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`

후속 이행 기록:
- `docs/content-wiki/systems/ACCOUNT_MUTATION_IDEMPOTENCY_IMPLEMENTATION_2026-08-30.md`

이 문서는 현재 서버 코드에 실제로 들어간 저장 foundation을 기록한다. 로그인/OAuth, 게스트 이전 UX, 공개 계정 API까지 완료됐다는 뜻이 아니다.

## 구현된 범위

### 1. canonical account save snapshot v2

`apps/server/src/account-save-authority.ts`

서버 정본 snapshot에 다음을 한 revision 아래 보관한다.

- MAIN NORMAL_CLEAR 연속 진행.
- NORMAL_CLEAR source.
- MAIN first-clear reward receipt high-water (`mainRewardedStageIds`).
- SPECIAL clear.
- 영구 보상.
- 적 발견.
- 모집 캐릭터 소유.
- 캐릭터 Base Lv / +Lv / 해금 form / 선택 form.
- 덱.
- 선택 거점 병기.
- meta resource monotonic ledger.
- 주기 SPECIAL reward charge 4종.
- 기록 SPECIAL 최고기록/보상 high-water.

서버 save schema는 `2`다.

### 2. 경제 데이터 엄격 검증

로그인 계정의 서버 snapshot은 게스트 로컬 save처럼 손상값을 조용히 보정하지 않는다.

- unknown resource ID 거부.
- `earned`, `spent` 음수/소수 거부.
- `spent > earned` 거부.
- canonical periodic charge collection 4종 전체 필요.
- charge 0..4.
- cap 4에서 `nextChargeAtMs = null`.
- cap 미만에서 유효한 다음 충전 시각 필요.
- charge refresh는 서버 시각 기준.

### 3. 기록 high-water

끝없는 전선:
- `endlessBestTimeMs`
- `endlessBestReachedMinute`
- `endlessRewardedMinute`

보스 러시:
- `bossRushBestDefeated`
- `bossRushRewardedDefeated`

best/reward high-water 관계와 현재 9보스 runtime cap을 strict validation한다.
`applyAccountRecordResult`는 trusted battle result를 받아 신규 milestone만 지급한다.

### 4. 선택 거점 병기 validation

- canonical 3종 ID만 허용.
- account MAIN NORMAL_CLEAR 진행으로 unlock 재검증.
- 잠긴 병기 snapshot 거부.

### 5. v1 → v2 migration

기존 `account_progression_saves` v1의 진행/소유/성장/덱을 보존한다.

v1에 없던 필드 기본값:
- wallet: 빈 ledger.
- periodic charge: 4칸 full.
- record: 0.
- selected base weapon: 전선포격기.

v1에는 MAIN first-clear wallet receipt가 없으므로 기존 cleared MAIN을 migrated `mainRewardedStageIds`에도 넣어 소급 중복 지급을 막는다.
원본 v1 row는 migration 실패 시 덮어쓰지 않는다.

### 6. revisioned D1 storage

migration:
- `apps/server/migrations/0003_account_save_v2.sql`

canonical table:
- `account_saves`
- account당 1 row.
- `schema_version = 2`.
- monotonic `revision`.
- `snapshot_json`.
- `updated_at`.

서버 함수:
- `loadAccountSave`
- `initializeAccountSave`
- `replaceAccountSave`

`replaceAccountSave`는 `expectedRevision` mismatch 시 `revision_conflict`를 반환한다.

### 7. authoritative mutation / idempotency foundation

현재 account save v2 위에서 구현된 내부 server mutation:

- MAIN battle result.
- 일반/주기/이벤트 SPECIAL battle result.
- 기록 SPECIAL result.
- 모집 server RNG + wallet + ownership/duplicate.
- MAIN/SPECIAL sweep.
- Base Lv.
- +Lv.
- evolution unlock.
- evolution form select.
- deck set.
- base weapon select.

`battleId` / `requestId` receipt를 사용하며 동일 key + 동일 business input 재전송은 exact replay다.
save CAS와 receipt는 D1 batch로 함께 확정하고 revision race는 CHECK 실패로 전체 rollback한다.

상세는 `ACCOUNT_MUTATION_IDEMPOTENCY_IMPLEMENTATION_2026-08-30.md`를 따른다.

### 8. SPECIAL progression / availability authority

account authority 범위:
- MAIN80.
- SPECIAL61.
- 전체 실행 enemy discovery catalog.
- 전체 v2 permanent reward/evolution catalog.
- stage policy 141.

SPECIAL은 authored collection/unlock data를 사용한다.

- collection `unlockAfterStageId`.
- `requiredProgressionStageId`.
- `previousSpecialStageId`.
- event availability.
- periodic availability.
- sweep policy.

과거 blanket `main_01_020` SPECIAL gate는 제거했다.
과거 SPECIAL clear history는 구조적 unlock 정합만 검사하고, 새 battle/sweep에서만 현재 server-time availability를 검사한다.

### 9. server-authoritative SPECIAL reward / sweep

SPECIAL reward는 `@frontline/sim/special-rewards` 공용 resolver를 사용한다.

- 주기 18전장: first / charged / depleted.
- 일반/상시/제한/이벤트 rewarded stage 38개: first bonus + repeat.
- 현재 resource reward 없는 challenge stage는 `{}`.

주기 first clear는 charge 미소모, charged repeat는 1칸 소비, charge 0은 depleted reward다.

소탕:
- prior NORMAL_CLEAR.
- server sweep policy.
- ticket 1장.
- repeat reward only.
- periodic charge 필요 시 1칸 소비.
- first clear/progression/permanent reward/record 생성 금지.

### 10. server-authoritative meta progression

`apps/server/src/account-meta-mutation-authority.ts`

모든 action은 보유/해금/재화 판정을 server snapshot/content에서 다시 계산한다.

Base Lv:
- 시작 cap 10.
- 장 완료마다 20 / 30 / 40 / 50.
- canonical Gold curve로 서버 차감.

+Lv:
- +50 cap.
- STORY/C/B/A/S/SS authored acquisition/rarity 기준 canonical soul essence 비용.
- client가 rarity/cost를 제출하지 않음.

진화:
- 해당 character form 여부.
- previous form.
- required Base Lv.
- canonical recipe cost.
- unlock된 form만 선택.

덱:
- 1..10.
- unique.
- owned-only.
- exact order.

거점 병기:
- canonical 3종.
- MAIN 진행 기반 server unlock.

이 mutation들은 `META_PROGRESSION` request receipt와 account revision CAS를 공유한다.

## 자동검증

관련 테스트:
- `apps/server/test/account-save-authority.test.ts`
- `apps/server/test/account-mutation-authority.test.ts`
- `apps/server/test/account-special-mutation-authority.test.ts`
- `apps/server/test/account-meta-mutation-authority.test.ts`
- `apps/server/test/progression-authority.test.ts`
- `packages/sim/test/special-rewards.test.ts`

검사 범위:
- 신규 account v2 / v1→v2 migration.
- wallet/charge/record/base weapon strict validation.
- MAIN80 / SPECIAL61 / policy141 authority.
- MAIN/SPECIAL/record/recruitment/sweep transaction.
- SPECIAL authored history/current availability.
- Base Lv canonical Gold + 장별 cap.
- +Lv rarity/acquisition별 soul cost.
- evolution prerequisite/recipe/selection.
- deck exact order/ownership/uniqueness.
- base weapon unlock authority.
- insufficient wallet rejection.
- mutation receipt migration / battleId unique / rollback-safe CAS.

## 아직 완료하지 않은 것

`ACCOUNT_SAVE_SYNC_SPEC.md`상 남은 작업:

- Google/email 인증 및 실제 `AUTHENTICATED_ONLINE` session.
- client account state machine (`GUEST_LOCAL`, `AUTHENTICATED_ONLINE`, `AUTHENTICATED_OFFLINE_CACHE`).
- guest→빈 account 이전 transaction/UX.
- 기존 server 진행과 guest 진행 충돌 선택 UX.
- authenticated 공개 account mutation route.
- trusted solo/SPECIAL/record battle completion registry/result proof.
- 모집/성장/진화/덱/병기 mutation을 실제 authenticated client flow에 연결.
- 협동 결과를 canonical account progression/wallet/periodic charge에 실제 지급.
- account reset/delete/friend/block/PvP account data.

따라서 현재 단계는 `계정 기능 완료`가 아니라 **서버 정본 save v2 + migration/revision + MAIN/SPECIAL/record/recruitment/sweep/meta-progression mutation/idempotency foundation 완료**로 센다.
