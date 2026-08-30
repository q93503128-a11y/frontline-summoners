# 계정 Save v2 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_SERVER_STORAGE_FOUNDATION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`

이 문서는 현재 서버 코드에 실제로 들어간 저장 foundation만 기록한다. 로그인/OAuth, 게스트 이전 UX, 전투결과 지급 API까지 완료됐다는 뜻이 아니다.

## 구현된 범위

### 1. canonical account save snapshot v2

`apps/server/src/account-save-authority.ts`

서버 정본 snapshot에 다음을 한 revision 아래 함께 보관할 수 있게 했다.

- MAIN NORMAL_CLEAR 연속 진행
- NORMAL_CLEAR source
- MAIN first-clear reward receipt high-water (`mainRewardedStageIds`)
- SPECIAL clear
- 영구 보상
- 적 발견
- 모집 캐릭터 소유
- 캐릭터 Base Lv / +Lv / 해금 form / 선택 form
- 덱
- 선택 거점 병기
- meta resource monotonic ledger
- 주기 SPECIAL reward charge 4종
- 기록 SPECIAL 최고기록/보상 high-water

서버 save schema는 `2`다.

### 2. 경제 데이터 엄격 검증

로그인 계정의 서버 snapshot은 게스트 로컬 save처럼 손상값을 조용히 보정하지 않는다.

- 알려지지 않은 재화 ID 거부.
- `earned`, `spent`는 음수/소수 거부.
- `spent > earned` 거부.
- 주기 charge map은 canonical 4 collection이 모두 있어야 한다.
- charge는 0..4만 허용.
- cap 4에서는 `nextChargeAtMs = null`만 허용.
- cap 미만에서는 유효한 다음 충전 시각이 필요하다.
- 정상 charge는 서버 시각 기준으로 refresh한다.

즉 클라이언트가 필드를 누락해 depleted charge를 full로 되돌리거나 임의 currency를 추가하는 snapshot을 정본으로 만들 수 없게 한다.

### 3. 기록 high-water 검증

끝없는 전선:

- `endlessBestTimeMs`
- `endlessBestReachedMinute`
- `endlessRewardedMinute`

`bestReachedMinute`는 `floor(bestTimeMs / 60000)`과 정확히 일치해야 한다.
`rewardedMinute`는 best보다 앞설 수 없다.

보스 러시:

- `bossRushBestDefeated`
- `bossRushRewardedDefeated`

현재 runtime 9보스보다 큰 best를 거부하고 reward high-water가 best보다 앞설 수 없게 한다.

이 검증은 snapshot consistency foundation이다. 실제 신기록 결과를 서버에서 계산하고 battleId idempotency로 지급하는 mutation API는 별도 후속이다.

### 4. 선택 거점 병기 서버 검증

- canonical 3종 ID만 허용.
- 해당 계정의 contiguous MAIN NORMAL_CLEAR 진행으로 실제 해금 여부를 다시 검사.
- 잠긴 결계발진기/보급낙하기를 snapshot에 넣는 것을 거부.

### 5. v1 → v2 migration

기존 `account_progression_saves` v1 snapshot은 진행/소유/성장/덱을 그대로 보존해 v2 구조로 올릴 수 있다.

v1에는 wallet/record/periodic charge/선택 병기 필드가 없으므로:

- wallet: 빈 ledger
- periodic charge: 4칸 full
- record: 0
- selected base weapon: 전선포격기

로 시작한다.

또 v1에 first-clear 재화 수령 여부가 없었기 때문에 기존 cleared MAIN은 `mainRewardedStageIds`에도 넣는다. v2 wallet을 활성화한 뒤 예전 클리어를 다시 first-clear로 판정해 재화를 중복 생성하는 쪽보다 보수적인 migration을 택한다.

원본 v1 row는 migration 실패 시 덮어쓰지 않는다. 새 v2 `account_saves` row를 별도로 초기화하는 구조다.

### 6. revisioned D1 storage

migration:
- `apps/server/migrations/0003_account_save_v2.sql`

canonical table:
- `account_saves`
- account당 1 row
- `schema_version = 2`
- monotonic `revision`
- `snapshot_json`
- `updated_at`

서버 함수:
- `loadAccountSave`
- `initializeAccountSave`
- `replaceAccountSave`

`replaceAccountSave`는 `expectedRevision`이 현재 revision과 다르면 `revision_conflict`를 반환한다.

## 자동검증

`apps/server/test/account-save-authority.test.ts`

검사 항목:

- 신규 계정 v2 기본값.
- v1→v2 migration.
- wallet value 위조/unknown currency 거부.
- periodic charge collection 누락 거부.
- elapsed charge 서버 시각 refresh.
- 기록 high-water 불일치 거부.
- 9보스 초과 기록 거부.
- 잠긴 거점 병기 거부.
- 미래 schema write-protect.
- D1 canonical table/revision/schema 제약.

## 아직 완료하지 않은 것

다음은 `ACCOUNT_SAVE_SYNC_SPEC.md`상 별도 남은 작업이다.

- Google/email 인증 연결과 실제 `AUTHENTICATED_ONLINE` session.
- 클라이언트 계정 상태 머신 (`GUEST_LOCAL`, `AUTHENTICATED_ONLINE`, `AUTHENTICATED_OFFLINE_CACHE`).
- 게스트→빈 서버 계정 이전 transaction/UX.
- 기존 서버 진행과 게스트 진행 충돌 선택 UX.
- battleId 기반 전투 결과 idempotency.
- requestId 기반 모집 idempotency.
- server-authoritative stage/recruitment/growth/record mutation API.
- 협동 결과를 canonical account wallet/periodic charge/record에 실제 지급.
- 계정 초기화/삭제/친구/차단/PvP 계정 데이터.

따라서 현재 단계는 `계정 기능 완료`가 아니라 **서버 정본 save 구조와 migration/revision foundation 완료**로만 센다.
